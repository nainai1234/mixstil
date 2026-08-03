import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db';
import { upgradeRecipeToV2 } from './recipeV2';
import { planRecipeRenderTracks } from './renderRecipeV2';

const APPLY = process.argv.includes('--apply');
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'empty-published-work-repair-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'empty-published-work-repair-2026-07-15.md');
const client = await pool.connect();
const repairs: Array<{ mixId: string; title: string; previousStatus: string; resultingStatus: string; reason: string }> = [];

try {
  await client.query('begin');
  const result = await client.query<any>(
    `select m.*, v.recipe_data as frozen_recipe
     from mixes m
     left join mix_recipe_versions v on v.id = m.published_version_id and v.mix_id = m.id
     where m.status = 'published'
     order by m.id
     for update of m`,
  );

  for (const mix of result.rows) {
    const recipe = upgradeRecipeToV2(mix.frozen_recipe ?? mix.recipe_data, `${mix.id}|empty-release-repair`);
    if (planRecipeRenderTracks(recipe).length > 0) continue;
    const reason = 'Published Work had no audible tracks and could not produce a truthful playable result.';
    const repairedRecipe = {
      ...recipe,
      versionState: 'live',
      versionId: null,
      frozenAt: null,
      audit: {
        ...(recipe.audit ?? {}),
        releaseRepair: {
          date: '2026-07-15',
          action: 'returned_to_draft',
          previousPublishedVersionId: mix.published_version_id,
          reason,
        },
      },
    };

    if (APPLY) {
      await client.query(
        `update mixes set
           status = 'draft',
           published_version_id = null,
           recipe_data = $2::jsonb,
           render_status = 'not_rendered',
           rendered_audio_url = '',
           rendered_at = null,
           render_error = '',
           updated_at = now()
         where id = $1`,
        [mix.id, JSON.stringify(repairedRecipe)],
      );
      await client.query(
        `update share_links set revoked_at = now()
         where mix_id = $1 and revoked_at is null`,
        [mix.id],
      );
    }
    repairs.push({
      mixId: mix.id,
      title: mix.title,
      previousStatus: mix.status,
      resultingStatus: 'draft',
      reason,
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
  repairCount: repairs.length,
  repairs,
};
await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Empty Published Work Repair',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Applied: ${APPLY ? 'yes' : 'no (dry run)'}`,
  `- Repaired Works: ${repairs.length}`,
  '',
  '| Work | Previous state | Result | Reason |',
  '| --- | --- | --- | --- |',
  ...repairs.map((item) => `| ${item.title} (\`${item.mixId}\`) | ${item.previousStatus} | ${item.resultingStatus} | ${item.reason} |`),
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
