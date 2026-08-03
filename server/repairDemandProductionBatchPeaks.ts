import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const REPORTS_DIR = path.resolve('reports');
const BATCH_ID = process.env.DEMAND_PRODUCTION_BATCH_ID ?? `demand-plus-variants-${new Date().toISOString().slice(0, 10)}`;
const RENDER_REPORT_JSON = path.join(REPORTS_DIR, `${BATCH_ID}-renders.json`);

const repairRecipe = (recipe: any) => ({
  ...recipe,
  tracks: (recipe.tracks ?? []).map((track: any) => ({
    ...track,
    volume: Math.max(1, Math.round(Number(track.volume ?? 50) * 0.72)),
    sourceGainDb: Math.min(Number(track.sourceGainDb ?? 0), -3),
    volumeAutomation: Array.isArray(track.volumeAutomation)
      ? track.volumeAutomation.map((point: any) => ({
        ...point,
        volume: Math.max(1, Math.round(Number(point.volume ?? track.volume ?? 50) * 0.72)),
      }))
      : track.volumeAutomation,
  })),
  audit: {
    ...(recipe.audit ?? {}),
    demandProductionPeakRepair: {
      batchId: BATCH_ID,
      repair: 'scaled_track_volumes_to_72_percent_and_capped_source_gain_at_minus_3db',
      repairedAt: new Date().toISOString(),
    },
  },
});

const run = async () => {
  const report = JSON.parse(await readFile(RENDER_REPORT_JSON, 'utf8'));
  const failedIds = (report.items ?? [])
    .filter((item: any) => item.resultingRenderStatus !== 'ready' || !item.qaReport?.passed)
    .map((item: any) => String(item.mixId));
  const repaired = [];
  for (const mixId of failedIds) {
    const current = await query<any>(
      `select m.id, m.published_version_id, m.recipe_data, v.recipe_data as frozen_recipe
       from mixes m
       left join mix_recipe_versions v on v.id = m.published_version_id and v.mix_id = m.id
       where m.id = $1
         and m.status = 'private'
         and m.recipe_data #>> '{audit,demandProductionBatch,batchId}' = $2`,
      [mixId, BATCH_ID],
    );
    const row = current.rows[0];
    if (!row) continue;
    const repairedRecipe = repairRecipe(row.frozen_recipe ?? row.recipe_data);
    await query(
      `update mixes
       set recipe_data = $2::jsonb,
           render_status = 'not_rendered',
           rendered_audio_url = '',
           rendered_at = null,
           render_error = '',
           updated_at = now()
       where id = $1`,
      [mixId, JSON.stringify(repairedRecipe)],
    );
    await query(
      `update mix_recipe_versions
       set recipe_data = $3::jsonb
       where id = $1 and mix_id = $2`,
      [row.published_version_id, mixId, JSON.stringify(repairedRecipe)],
    );
    repaired.push({ mixId, publishedVersionId: row.published_version_id });
  }
  const repairReport = {
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    repairedCount: repaired.length,
    repaired,
  };
  await writeFile(path.join(REPORTS_DIR, `${BATCH_ID}-peak-repair.json`), `${JSON.stringify(repairReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(repairReport, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
