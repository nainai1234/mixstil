import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db';

const APPLY = process.argv.includes('--apply');
const MIX_ID = 'mix_m9sxkb1t';
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'batch-07-four-track-repair-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'batch-07-four-track-repair-2026-07-15.md');
const versionId = () => `recipev_batch07_repair_${randomBytes(6).toString('hex')}`;
const trackPlan = [
  {
    stemId: 'stem_batch07_fma_holizna_meditation_01',
    volume: 7,
    trimEnd: 1279.944979,
    automation: [[0, 4], [180, 6], [600, 7], [1500, 5], [1800, 3]],
  },
  {
    stemId: 'stem_batch07_fma_holizna_dreamscape',
    volume: 6,
    trimEnd: 1319.952979,
    automation: [[0, 3], [300, 5], [900, 6], [1500, 4], [1800, 2]],
  },
  {
    stemId: 'stem_batch07_fma_holizna_rain_sleep',
    volume: 18,
    trimEnd: 875.952979,
    automation: [[0, 16], [120, 18], [1500, 18], [1800, 12]],
  },
  {
    stemId: 'stem_batch07_fma_holizna_cosmic_waves',
    volume: 10,
    trimEnd: 1984.536979,
    automation: [[0, 10], [600, 9], [1200, 8], [1800, 6]],
  },
] as const;

const client = await pool.connect();
let report: Record<string, any>;
try {
  await client.query('begin');
  const result = await client.query<any>('select * from mixes where id = $1 for update', [MIX_ID]);
  const mix = result.rows[0];
  if (!mix) throw new Error(`Mix ${MIX_ID} was not found.`);
  const recipe = mix.recipe_data;
  const existingByStem = new Map((recipe.tracks ?? []).map((track: any) => [String(track.stemId), track]));
  const repairedTracks = trackPlan.map((plan) => {
    const existing = existingByStem.get(plan.stemId) as any;
    if (!existing) throw new Error(`Expected Batch 07 track ${plan.stemId} is missing.`);
    return {
      ...existing,
      role: 'music',
      volume: plan.volume,
      isMuted: false,
      startTime: 0,
      duration: 1800,
      trimStart: 0,
      trimEnd: plan.trimEnd,
      playbackRate: 1,
      loop: { enabled: true, crossfadeSeconds: 3 },
      fade: { inSeconds: Math.max(6, Number(existing.fade?.inSeconds ?? 6)), outSeconds: 12 },
      phaseIds: ['arrival', 'core', 'release'],
      volumeAutomation: plan.automation.map(([atSeconds, volume]) => ({ atSeconds, volume })),
    };
  });
  const nextVersionResult = await client.query<{ next_version: number }>(
    'select coalesce(max(version_number), 0) + 1 as next_version from mix_recipe_versions where mix_id = $1',
    [MIX_ID],
  );
  const nextVersion = Number(nextVersionResult.rows[0]?.next_version ?? 1);
  const frozenVersionId = versionId();
  const repairedRecipe = {
    ...recipe,
    tracks: repairedTracks,
    durationSeconds: 1800,
    versionId: frozenVersionId,
    versionState: 'frozen',
    versionNumber: nextVersion,
    frozenAt: new Date().toISOString(),
    audit: {
      ...(recipe.audit ?? {}),
      batch07FourTrackRepair: {
        date: '2026-07-15',
        reason: 'Restore the approved four separate music tracks, remove the unrelated fifth Nature track, and cover the full 30-minute timeline.',
        previousVersionId: mix.published_version_id,
        removedStemIds: (recipe.tracks ?? [])
          .map((track: any) => String(track.stemId))
          .filter((stemId: string) => !trackPlan.some((plan) => plan.stemId === stemId)),
        defaultBalance: {
          anchor: 'stem_batch07_fma_holizna_rain_sleep',
          strategy: 'one_anchor_three_low_support_layers',
        },
      },
    },
  };

  if (APPLY) {
    await client.query(
      `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
       values ($1, $2, $3, $4::jsonb)`,
      [frozenVersionId, MIX_ID, nextVersion, JSON.stringify(repairedRecipe)],
    );
    await client.query(
      `update mixes set
         recipe_data = $2::jsonb,
         published_version_id = $3,
         render_status = 'not_rendered',
         rendered_audio_url = '',
         rendered_at = null,
         render_error = '',
         updated_at = now()
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
    resultingVersionNumber: nextVersion,
    trackCount: repairedTracks.length,
    removedStemIds: repairedRecipe.audit.batch07FourTrackRepair.removedStemIds,
    durationSeconds: repairedRecipe.durationSeconds,
    tracks: repairedTracks.map((track) => ({
      stemId: track.stemId,
      volume: track.volume,
      duration: track.duration,
      volumeAutomation: track.volumeAutomation,
    })),
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
  '# Batch 07 Four-Track Repair',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Applied: ${report.applied ? 'yes' : 'no (dry run)'}`,
  `- Work: ${report.title} (\`${report.mixId}\`)`,
  `- Frozen version: \`${report.resultingVersionId}\``,
  `- Tracks: ${report.trackCount}`,
  `- Duration: ${report.durationSeconds} seconds`,
  `- Removed unrelated Stems: ${(report.removedStemIds as string[]).map((id) => `\`${id}\``).join(', ') || 'none'}`,
  '',
  '| Stem | Default volume | Timeline |',
  '| --- | ---: | ---: |',
  ...(report.tracks as any[]).map((track) => `| \`${track.stemId}\` | ${track.volume}% | ${track.duration}s |`),
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
