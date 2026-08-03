import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db';

const APPLY = process.argv.includes('--apply');
const MIX_ID = 'mix_b29811da';
const STEM_ID = 'stem_commons_pine_forest_wind';
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'pine-forest-boundary-trim-repair-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'pine-forest-boundary-trim-repair-2026-07-15.md');
const client = await pool.connect();
let report: Record<string, any>;

try {
  await client.query('begin');
  const result = await client.query<any>('select * from mixes where id = $1 for update', [MIX_ID]);
  const mix = result.rows[0];
  if (!mix) throw new Error(`Mix ${MIX_ID} was not found.`);
  const nextResult = await client.query<{ next_version: number }>(
    'select coalesce(max(version_number), 0) + 1 as next_version from mix_recipe_versions where mix_id = $1',
    [MIX_ID],
  );
  const versionNumber = Number(nextResult.rows[0]?.next_version ?? 1);
  const frozenVersionId = `recipev_pine_trim_${randomBytes(6).toString('hex')}`;
  const repairedTracks = (mix.recipe_data.tracks ?? []).map((track: any) => track.stemId === STEM_ID
    ? { ...track, trimStart: 1.2, trimEnd: 238.7 }
    : track);
  if (!repairedTracks.some((track: any) => track.stemId === STEM_ID)) {
    throw new Error(`Expected Pine Forest Stem ${STEM_ID} is missing.`);
  }
  const repairedRecipe = {
    ...mix.recipe_data,
    tracks: repairedTracks,
    versionId: frozenVersionId,
    versionState: 'frozen',
    versionNumber,
    frozenAt: new Date().toISOString(),
    audit: {
      ...(mix.recipe_data.audit ?? {}),
      pineForestBoundaryTrimRepair: {
        date: '2026-07-15',
        reason: 'Remove the source-only opening and closing silence before crossfade looping.',
        previousVersionId: mix.published_version_id,
        stemId: STEM_ID,
        sourceDurationSeconds: 241.032,
        trimStart: 1.2,
        trimEnd: 238.7,
      },
    },
  };

  if (APPLY) {
    await client.query(
      `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
       values ($1, $2, $3, $4::jsonb)`,
      [frozenVersionId, MIX_ID, versionNumber, JSON.stringify(repairedRecipe)],
    );
    await client.query(
      `update mixes set recipe_data = $2::jsonb, published_version_id = $3,
         render_status = 'not_rendered', rendered_audio_url = '', rendered_at = null,
         render_error = '', updated_at = now()
       where id = $1`,
      [MIX_ID, JSON.stringify(repairedRecipe), frozenVersionId],
    );
    await client.query('commit');
  } else {
    await client.query('rollback');
  }

  report = {
    generatedAt: new Date().toISOString(),
    applied: APPLY,
    mixId: MIX_ID,
    title: mix.title,
    previousVersionId: mix.published_version_id,
    resultingVersionId: frozenVersionId,
    versionNumber,
    stemId: STEM_ID,
    sourceDurationSeconds: 241.032,
    trimStart: 1.2,
    trimEnd: 238.7,
    usableLoopSeconds: 237.5,
  };
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}

await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Pine Forest Boundary Trim Repair',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Applied: ${report.applied ? 'yes' : 'no (dry run)'}`,
  `- Work: ${report.title} (\`${report.mixId}\`)`,
  `- Frozen version: \`${report.resultingVersionId}\``,
  `- Source: \`${report.stemId}\``,
  `- Trim: ${report.trimStart}s to ${report.trimEnd}s`,
  `- Usable crossfade-loop source: ${report.usableLoopSeconds}s`,
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
