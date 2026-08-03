import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db';
import { productCapabilities } from './productCapabilities';
import type { RecipeV2, RecipeV2Track } from './recipeV2';

const APPLY = process.argv.includes('--apply');
const TARGET_MIX_ID = process.env.MIX_ID ?? '';
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'backfilled-published-acoustic-qa-repair-2026-07-21.json');
const REPORT_MD = path.join(REPORTS_DIR, 'backfilled-published-acoustic-qa-repair-2026-07-21.md');

const versionId = () => `recipev_acoustic_repair_${randomBytes(6).toString('hex')}`;

type Goal = 'sleep' | 'calm' | 'focus';

type SupportBedConfig = {
  stemId: string;
  role: RecipeV2Track['role'];
  volume: number;
  sourceGainDb?: number;
  note: string;
};

type RepairTrack = RecipeV2Track & { auditTag?: string };

const supportBedByGoal: Record<Goal, SupportBedConfig> = {
  sleep: {
    stemId: 'stem_internal_brown_soft',
    role: 'base',
    volume: 12,
    note: 'Very low brown-noise floor copied from the approved bedtime catalog pattern.',
  },
  calm: {
    stemId: 'stem_internal_pink_balanced',
    role: 'base',
    volume: 10,
    note: 'Very low balanced pink floor copied from the approved emotional-settling catalog pattern.',
  },
  focus: {
    stemId: 'stem_internal_pink_balanced',
    role: 'base',
    volume: 12,
    note: 'Very low balanced pink floor copied from the approved deep-focus catalog pattern.',
  },
};

const extraSupportBedByMixId: Record<string, SupportBedConfig> = {
  mix_finished_calm_020_before_meeting_settle: {
    stemId: 'stem_internal_brown_soft',
    role: 'base',
    volume: 12,
    note: 'Extra low brown floor added to eliminate the last interior silence in the outlier calm render.',
  },
};

const inferGoal = (mix: any): Goal => {
  const explicitGoal = mix.recipe_data?.audioIntent?.goal ?? mix.recipe_data?.goal;
  if (explicitGoal === 'sleep' || explicitGoal === 'calm' || explicitGoal === 'focus') return explicitGoal;
  if (String(mix.id).includes('_sleep_')) return 'sleep';
  if (String(mix.id).includes('_focus_')) return 'focus';
  return 'calm';
};

const buildSupportTrack = (recipe: RecipeV2, goal: Goal, config: SupportBedConfig): RecipeV2Track => ({
  stemId: config.stemId,
  role: config.role,
  volume: config.volume,
  sourceGainDb: config.sourceGainDb ?? 0,
  isMuted: false,
  startTime: 0,
  duration: recipe.durationSeconds,
  trimStart: 0,
  trimEnd: recipe.durationSeconds,
  playbackRate: 1,
  phaseIds: ['arrival', 'core', 'release'],
  fade: {
    inSeconds: 4,
    outSeconds: goal === 'sleep' ? 12 : 8,
  },
  loop: {
    enabled: true,
    crossfadeSeconds: 2,
  },
});

const client = await pool.connect();
const results: any[] = [];

try {
  await client.query('begin');

  const mixes = await client.query<any>(
    `select m.*,
            q.id as latest_qa_id,
            q.passed as latest_qa_passed,
            q.peak_db as latest_peak_db,
            q.abnormal_silence_count as latest_abnormal_silence_count
     from mixes m
     left join lateral (
       select *
       from render_qa_reports
       where mix_id = m.id
       order by created_at desc
       limit 1
     ) q on true
     where m.status = 'published'
       and m.recipe_data #>> '{audit,historicalBackfill,date}' = '2026-07-15'
       and ($1 = '' or m.id = $1)
       and (
         m.render_status = 'failed'
         or coalesce(q.passed, false) = false
       )
     order by m.id
     for update of m`,
    [TARGET_MIX_ID],
  );

  const stemIds = [...new Set(Object.values(supportBedByGoal).map((config) => config.stemId))];
  const stemResult = await client.query<any>(
    `select id, name, category, qa_status, commercial_use_allowed, derivative_use_allowed
     from audio_stems
     where id = any($1::text[])`,
    [stemIds],
  );
  const stems = new Map<string, any>(stemResult.rows.map((stem) => [stem.id, stem]));

  for (const config of Object.values(supportBedByGoal)) {
    const stem = stems.get(config.stemId);
    const blocked = !stem
      || stem.qa_status !== 'approved'
      || !stem.commercial_use_allowed
      || !stem.derivative_use_allowed
      || (!productCapabilities.guidedVoice && stem.category === 'Voice');
    if (blocked) {
      throw new Error(`Support Stem ${config.stemId} is not approved for the Voice-free Beta release repair.`);
    }
  }

  for (const mix of mixes.rows) {
    const recipe = mix.recipe_data as RecipeV2 & { tracks: RepairTrack[]; audit?: Record<string, unknown> };
    const goal = inferGoal(mix);
    const supportConfig = supportBedByGoal[goal];
    const alreadyHasRepairBed = recipe.tracks.some((track) => {
      const repairTrack = track as RepairTrack;
      return repairTrack.stemId === supportConfig.stemId
        && repairTrack.role === supportConfig.role
        && repairTrack.auditTag === 'historical_acoustic_qa_support_bed';
    });
    const extraSupportConfig = extraSupportBedByMixId[mix.id];
    const alreadyHasExtraRepairBed = extraSupportConfig
      ? recipe.tracks.some((track) => {
        const repairTrack = track as RepairTrack;
        return repairTrack.stemId === extraSupportConfig.stemId
          && repairTrack.role === extraSupportConfig.role
          && repairTrack.auditTag === 'historical_acoustic_qa_support_bed_extra';
      })
      : true;

    if (alreadyHasRepairBed && alreadyHasExtraRepairBed) {
      results.push({
        mixId: mix.id,
        title: mix.title,
        goal,
        action: 'skipped',
        reason: 'repair support bed already exists',
      });
      continue;
    }

    const nextVersionResult = await client.query<{ next_version: number }>(
      `select coalesce(max(version_number), 0) + 1 as next_version
       from mix_recipe_versions
       where mix_id = $1`,
      [mix.id],
    );
    const nextVersionNumber = Number(nextVersionResult.rows[0]?.next_version ?? 1);
    const nextVersionId = versionId();
    const supportTrack: RepairTrack = {
      ...buildSupportTrack(recipe, goal, supportConfig),
      auditTag: 'historical_acoustic_qa_support_bed',
    };
    const repairedRecipe = {
      ...recipe,
      versionId: nextVersionId,
      versionState: 'frozen',
      versionNumber: nextVersionNumber,
      frozenAt: new Date().toISOString(),
      tracks: [
        supportTrack,
        ...recipe.tracks,
      ],
      audit: {
        ...(recipe.audit ?? {}),
        acousticQaRepair: {
          date: '2026-07-21',
          reason: 'Historical finished content was backfilled as a single sparse music track; add a very low approved continuous support bed so frozen renders do not contain interior dead-air gaps.',
          previousVersionId: mix.published_version_id ?? recipe.versionId,
          previousRenderStatus: mix.render_status,
          previousQa: {
            id: mix.latest_qa_id,
            passed: mix.latest_qa_passed,
            peakDb: mix.latest_peak_db == null ? null : Number(mix.latest_peak_db),
            abnormalSilenceCount: mix.latest_abnormal_silence_count == null ? null : Number(mix.latest_abnormal_silence_count),
          },
          addedSupportBed: {
            stemId: supportConfig.stemId,
            role: supportConfig.role,
            volume: supportConfig.volume,
            note: supportConfig.note,
          },
        },
      },
    } as RecipeV2 & { tracks: RepairTrack[]; audit?: Record<string, unknown> };

    if (extraSupportConfig && !alreadyHasExtraRepairBed) {
      repairedRecipe.tracks = [
        ...repairedRecipe.tracks,
        {
          ...buildSupportTrack(recipe, goal, extraSupportConfig),
          auditTag: 'historical_acoustic_qa_support_bed_extra',
        } as RepairTrack,
      ];
      const existingAcousticQaRepair = (repairedRecipe.audit ?? {}).acousticQaRepair;
      repairedRecipe.audit = {
        ...(repairedRecipe.audit ?? {}),
        acousticQaRepair: {
          ...(typeof existingAcousticQaRepair === 'object' && existingAcousticQaRepair !== null
            ? existingAcousticQaRepair as Record<string, unknown>
            : {}),
          extraSupportBed: {
            stemId: extraSupportConfig.stemId,
            role: extraSupportConfig.role,
            volume: extraSupportConfig.volume,
            note: extraSupportConfig.note,
          },
        },
      };
    }

    if (APPLY) {
      await client.query(
        `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
         values ($1, $2, $3, $4::jsonb)`,
        [nextVersionId, mix.id, nextVersionNumber, JSON.stringify(repairedRecipe)],
      );
      await client.query(
        `update mixes
         set published_version_id = $2,
             recipe_data = $3::jsonb,
             render_status = 'not_rendered',
             rendered_audio_url = '',
             rendered_at = null,
             render_error = '',
             updated_at = now()
         where id = $1`,
        [mix.id, nextVersionId, JSON.stringify(repairedRecipe)],
      );
    }

    results.push({
      mixId: mix.id,
      title: mix.title,
      goal,
      action: APPLY ? 'repaired' : 'would_repair',
      previousVersionId: mix.published_version_id,
      nextVersionId,
      nextVersionNumber,
      addedSupportBed: {
        stemId: supportConfig.stemId,
        volume: supportConfig.volume,
      },
      previousQa: {
        passed: mix.latest_qa_passed,
        peakDb: mix.latest_peak_db == null ? null : Number(mix.latest_peak_db),
        abnormalSilenceCount: mix.latest_abnormal_silence_count == null ? null : Number(mix.latest_abnormal_silence_count),
      },
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
  repairedCount: results.filter((item) => item.action === 'repaired' || item.action === 'would_repair').length,
  skippedCount: results.filter((item) => item.action === 'skipped').length,
  items: results,
};

await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Backfilled Published Acoustic QA Repair',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Applied: ${report.applied ? 'yes' : 'no (dry run)'}`,
  `- Release channel: ${report.releaseChannel}`,
  `- Targets: ${report.targetCount}`,
  `- Repaired: ${report.repairedCount}`,
  `- Skipped: ${report.skippedCount}`,
  '',
  '| Work | Goal | Action | Added support bed | Previous QA | New frozen version |',
  '| --- | --- | --- | --- | --- | --- |',
  ...results.map((item) => `| ${item.title} (\`${item.mixId}\`) | ${item.goal ?? ''} | ${item.action} | ${item.addedSupportBed ? `${item.addedSupportBed.stemId} @ ${item.addedSupportBed.volume}` : ''} | ${item.previousQa ? `${item.previousQa.abnormalSilenceCount ?? 'unknown'} silences, peak ${item.previousQa.peakDb ?? 'unknown'} dB` : item.reason ?? ''} | ${item.nextVersionId ? `\`${item.nextVersionId}\`` : ''} |`),
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
