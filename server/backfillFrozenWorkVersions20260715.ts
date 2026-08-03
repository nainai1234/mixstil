import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db';
import { productCapabilities } from './productCapabilities';
import { upgradeRecipeToV2 } from './recipeV2';
import { planRecipeRenderTracks } from './renderRecipeV2';

const APPLY = process.argv.includes('--apply');
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'frozen-work-backfill-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'frozen-work-backfill-2026-07-15.md');
const preferredReplacements: Record<string, string> = {
  stem_wind: 'stem_mixkit_2658',
};
const versionId = () => `recipev_backfill_${randomBytes(6).toString('hex')}`;

const client = await pool.connect();
const results: any[] = [];

try {
  await client.query('begin');
  const mixesResult = await client.query<any>(
    `select * from mixes
     where status in ('published', 'private')
     order by status, id
     for update`,
  );
  const stemResult = await client.query<any>('select * from audio_stems');
  const stems = new Map<string, any>(stemResult.rows.map((stem: any) => [stem.id, stem]));

  for (const mix of mixesResult.rows) {
    const upgraded = upgradeRecipeToV2(mix.recipe_data, `${mix.id}|historical-backfill`);
    const audible = planRecipeRenderTracks(upgraded);
    const replacementByStemId = new Map<string, string>();
    const blocked: string[] = [];

    for (const track of audible) {
      const stem = stems.get(track.stemId);
      const isVoiceBlocked = !productCapabilities.guidedVoice && (track.role === 'voice' || stem?.category === 'Voice');
      const isRightsBlocked = !stem
        || stem.qa_status !== 'approved'
        || !stem.commercial_use_allowed
        || !stem.derivative_use_allowed;
      if (!isVoiceBlocked && !isRightsBlocked) continue;
      const replacementId = preferredReplacements[track.stemId];
      const replacement = replacementId ? stems.get(replacementId) : null;
      if (
        replacement
        && replacement.qa_status === 'approved'
        && replacement.commercial_use_allowed
        && replacement.derivative_use_allowed
        && (productCapabilities.guidedVoice || replacement.category !== 'Voice')
      ) {
        replacementByStemId.set(track.stemId, replacementId);
      } else {
        blocked.push(track.stemId);
      }
    }

    const matchingQaResult = mix.render_status === 'ready' && mix.rendered_audio_url
      ? await client.query<any>(
        `select id from render_qa_reports
         where mix_id = $1 and rendered_audio_url = $2 and passed = true
         order by created_at desc limit 1`,
        [mix.id, mix.rendered_audio_url],
      )
      : { rows: [] };
    const hasValidReadyRender = mix.render_status !== 'ready' || matchingQaResult.rows.length > 0;

    if (blocked.length > 0) {
      throw new Error(`${mix.id} cannot be frozen; no approved replacement exists for ${[...new Set(blocked)].join(', ')}.`);
    }

    const replacements = [...replacementByStemId.entries()].map(([fromStemId, toStemId]) => ({
      fromStemId,
      fromName: stems.get(fromStemId)?.name ?? fromStemId,
      toStemId,
      toName: stems.get(toStemId)?.name ?? toStemId,
      reason: 'historical_frozen_version_backfill',
      createdAt: new Date().toISOString(),
    }));
    const repairedRecipe = {
      ...upgraded,
      tracks: upgraded.tracks.map((track) => ({
        ...track,
        stemId: replacementByStemId.get(track.stemId) ?? track.stemId,
      })),
      events: upgraded.events.map((event) => ({
        ...event,
        stemId: replacementByStemId.get(event.stemId) ?? event.stemId,
      })),
      audit: {
        ...(upgraded.audit ?? {}),
        replacements: [
          ...((upgraded.audit?.replacements ?? []) as any[]),
          ...replacements,
        ],
        historicalBackfill: {
          date: '2026-07-15',
          reason: 'Bind historical published/private Work to a frozen Recipe V2 version.',
          previousVersionId: upgraded.versionId,
        },
      },
    };

    const nextVersionResult = await client.query<{ next_version: number }>(
      `select coalesce(max(version_number), 0) + 1 as next_version
       from mix_recipe_versions where mix_id = $1`,
      [mix.id],
    );
    const versionNumber = Number(nextVersionResult.rows[0]?.next_version ?? 1);
    const frozenVersionId = versionId();
    const frozenRecipe = {
      ...repairedRecipe,
      versionId: frozenVersionId,
      versionState: 'frozen',
      versionNumber,
      frozenAt: new Date().toISOString(),
    };

    const keepExistingRender = matchingQaResult.rows.length > 0;
    const needsVersion = !mix.published_version_id || replacements.length > 0 || !hasValidReadyRender;
    if (!needsVersion) continue;

    if (APPLY) {
      await client.query(
        `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
         values ($1, $2, $3, $4::jsonb)`,
        [frozenVersionId, mix.id, versionNumber, JSON.stringify(frozenRecipe)],
      );
      await client.query(
        `update mixes set
           published_version_id = $2,
           recipe_data = $3::jsonb,
           render_status = case when $4 then render_status else 'not_rendered' end,
           rendered_audio_url = case when $4 then rendered_audio_url else '' end,
           rendered_at = case when $4 then rendered_at else null end,
           render_error = '',
           updated_at = now()
         where id = $1`,
        [mix.id, frozenVersionId, JSON.stringify(frozenRecipe), keepExistingRender],
      );
      if (keepExistingRender) {
        await client.query(
          'update render_qa_reports set recipe_version_id = $2 where id = $1',
          [matchingQaResult.rows[0].id, frozenVersionId],
        );
      }
    }

    results.push({
      mixId: mix.id,
      title: mix.title,
      status: mix.status,
      versionId: frozenVersionId,
      versionNumber,
      replacements,
      previousRenderStatus: mix.render_status,
      resultingRenderStatus: keepExistingRender ? mix.render_status : 'not_rendered',
      keptExistingRender: keepExistingRender,
    });
  }

  if (APPLY) await client.query('commit');
  else await client.query('rollback');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}

const report = {
  generatedAt: new Date().toISOString(),
  applied: APPLY,
  releaseChannel: productCapabilities.releaseChannel,
  targetCount: results.length,
  replacementCount: results.reduce((total, item) => total + item.replacements.length, 0),
  keptExistingRenderCount: results.filter((item) => item.keptExistingRender).length,
  resetRenderCount: results.filter((item) => !item.keptExistingRender).length,
  items: results,
};
await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Historical Work Frozen-Version Backfill',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Applied: ${report.applied ? 'yes' : 'no (dry run)'}`,
  `- Release channel: ${report.releaseChannel}`,
  `- Works: ${report.targetCount}`,
  `- Replacements: ${report.replacementCount}`,
  `- Existing renders retained with matching QA: ${report.keptExistingRenderCount}`,
  `- Renders reset because the Recipe changed or QA evidence was missing: ${report.resetRenderCount}`,
  '',
  '| Work | Visibility | Frozen version | Repair | Render result |',
  '| --- | --- | --- | --- | --- |',
  ...results.map((item) => `| ${item.title} (\`${item.mixId}\`) | ${item.status} | \`${item.versionId}\` | ${item.replacements.length ? item.replacements.map((replacement: any) => `${replacement.fromName} -> ${replacement.toName}`).join('; ') : 'none'} | ${item.resultingRenderStatus} |`),
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
