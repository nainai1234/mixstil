import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';
import { buildDemandCoverage, type DemandCoverageMixRow, type DemandCoverageStemRow } from './demandCoverage';
import { coverForDemand } from './demandCoverAssets';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeV2, type RecipeV2Track } from './recipeV2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DISCOVER_CONFIG_PATH = path.join(PROJECT_ROOT, 'data', 'discover-feed-config.json');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
const CREATOR_ID = process.env.DEMAND_PRODUCTION_CREATOR_ID ?? 'user_alex';
const BATCH_ID = process.env.DEMAND_PRODUCTION_BATCH_ID ?? `demand-plus-variants-${new Date().toISOString().slice(0, 10)}`;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
const roleForCategory = (category: string): RecipeV2Track['role'] => {
  if (category === 'Music') return 'music';
  if (category === 'Noise') return 'base';
  if (category === 'Accent') return 'accent';
  return 'environment';
};

const loadDiscoverConfig = async () => JSON.parse(await readFile(DISCOVER_CONFIG_PATH, 'utf8'));

const fetchCoverage = async () => {
  const config = await loadDiscoverConfig();
  const [mixes, stems] = await Promise.all([
    query<DemandCoverageMixRow>(
      `select m.id, m.title, m.description, m.status, m.render_status, m.published_version_id,
              coalesce(m.recipe_data #>> '{audioIntent,goal}', m.recipe_data #>> '{quickCreate,soundProfileSnapshot,defaultGoal}', 'unknown') as goal,
              coalesce(m.recipe_data #>> '{audioIntent,scene}', 'unknown') as scene,
              coalesce(m.recipe_data #>> '{audioIntent,contentMode}', 'pure_soundscape') as content_mode,
              count(recipe_track.value->>'stemId')::int as track_count,
              count(s.id) filter (
                where s.qa_status = 'approved'
                  and s.file_sha256 <> ''
                  and s.commercial_use_allowed = true
                  and s.derivative_use_allowed = true
                  and s.category <> 'Voice'
              )::int as eligible_track_count,
              count(s.id) filter (
                where s.id is not null
                  and not (
                    s.qa_status = 'approved'
                    and s.file_sha256 <> ''
                    and s.commercial_use_allowed = true
                    and s.derivative_use_allowed = true
                    and s.category <> 'Voice'
                  )
              )::int as blocked_track_count,
              coalesce(array_agg(distinct s.category) filter (where s.category is not null), '{}') as track_categories
       from mixes m
       left join lateral jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) as recipe_track(value) on true
       left join audio_stems s on s.id = recipe_track.value->>'stemId'
       group by m.id
       order by (m.status = 'published' and m.render_status = 'ready' and m.published_version_id is not null) desc, m.updated_at desc
       limit 500`,
    ),
    query<DemandCoverageStemRow>(
      `select id, name, category, qa_status, tags, description, file_sha256,
              commercial_use_allowed, derivative_use_allowed
       from audio_stems
       order by (qa_status = 'approved') desc, imported_at desc nulls last, name asc
       limit 800`,
    ),
  ]);
  return buildDemandCoverage(config, mixes.rows, stems.rows);
};

const sourceMixesById = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, any>();
  const rows = await query<any>(
    `select id, title, description, cover_image_url, recipe_data
     from mixes
     where id = any($1::text[])`,
    [ids],
  );
  return new Map(rows.rows.map((row) => [row.id, row]));
};

const stemsById = async (ids: string[]) => {
  if (ids.length === 0) return new Map<string, any>();
  const rows = await query<any>(
    `select id, name, category, default_volume, tags
     from audio_stems
     where id = any($1::text[])
       and qa_status = 'approved'
       and file_sha256 <> ''
       and commercial_use_allowed = true
       and derivative_use_allowed = true
       and category <> 'Voice'`,
    [ids],
  );
  return new Map(rows.rows.map((row) => [row.id, row]));
};

const volumeCurve = (base: number, variantIndex: number, role: RecipeV2Track['role']) => {
  const nudges = [
    [-5, -2, 0, -2, -5],
    [-8, -3, 2, -1, -7],
    [-3, 0, 3, 0, -4],
  ][variantIndex % 3];
  const roleScale = role === 'music' ? 0.85 : role === 'base' ? 0.95 : 1;
  return [0, 60, 420, 780, 900].map((atSeconds, index) => ({
    atSeconds,
    volume: Math.max(1, Math.min(92, Math.round((base + nudges[index]) * roleScale))),
  }));
};

const buildVariantRecipe = (input: {
  sourceMix: any;
  demand: any;
  plan: any;
  material: any;
  variantIndex: number;
  mixId: string;
}): RecipeV2 => {
  const sourceRecipe = upgradeRecipeToV2(input.sourceMix.recipe_data, `${input.sourceMix.id}|${BATCH_ID}|source`);
  const durationSeconds = input.demand.scene === 'return_to_sleep' ? 900 : input.demand.goal === 'focus' ? 1500 : 1800;
  const tracks = sourceRecipe.tracks
    .filter((track) => track.role !== 'voice' && !track.isMuted && Number(track.volume ?? 0) > 0)
    .slice(0, 4)
    .map((track, index) => {
      const baseVolume = Math.max(8, Math.min(85, Number(track.volume ?? 45)));
      const variantVolume = Math.max(6, Math.min(88, baseVolume + ((input.variantIndex + index) % 3 - 1) * 4));
      return {
        ...track,
        duration: durationSeconds,
        trimStart: 0,
        trimEnd: Math.min(durationSeconds, Number(track.trimEnd ?? track.duration ?? durationSeconds)),
        volume: variantVolume,
        phaseIds: ['arrival', 'core', 'release'],
        fade: {
          inSeconds: track.role === 'music' ? 18 : 8,
          outSeconds: track.role === 'music' ? 24 : 14,
        },
        loop: { enabled: true, crossfadeSeconds: track.role === 'music' ? 4 : 3 },
        volumeAutomation: volumeCurve(variantVolume, input.variantIndex + index, track.role),
      };
    });

  const materialRole = roleForCategory(input.material.category);
  const alreadyUsesMaterial = tracks.some((track) => track.stemId === input.material.id);
  if (!alreadyUsesMaterial && tracks.length < 5) {
    const materialVolume = materialRole === 'music' ? 18 : materialRole === 'base' ? 24 : 28;
    tracks.push({
      stemId: input.material.id,
      role: materialRole,
      volume: materialVolume,
      startTime: 0,
      duration: durationSeconds,
      trimStart: 0,
      trimEnd: durationSeconds,
      isMuted: false,
      phaseIds: ['arrival', 'core', 'release'],
      fade: { inSeconds: materialRole === 'music' ? 22 : 10, outSeconds: materialRole === 'music' ? 26 : 16 },
      loop: { enabled: true, crossfadeSeconds: materialRole === 'music' ? 4 : 3 },
      volumeAutomation: volumeCurve(materialVolume, input.variantIndex, materialRole),
    });
  }

  const recipe = upgradeRecipeToV2({
    schemaVersion: 2,
    versionState: 'live',
    tracks,
    durationSeconds,
    intent: input.demand.scene,
    contentMode: input.demand.contentMode,
    moodTags: ['Voice-free Beta', 'Demand Coverage Plus Variant', input.demand.title],
    audioIntent: {
      goal: input.demand.goal,
      scene: input.demand.scene,
      contentMode: input.demand.contentMode,
      rawPrompt: input.plan.prompt,
      excludedSounds: input.demand.exclusions,
    },
    quickCreate: {
      prompt: input.plan.prompt,
      source: 'admin_demand_production_batch',
      productionBatchId: BATCH_ID,
      sourceMixId: input.sourceMix.id,
      materialStemId: input.material.id,
    },
    audit: {
      demandProductionBatch: {
        batchId: BATCH_ID,
        planId: input.plan.id,
        demandTypeId: input.demand.id,
        sourceMixId: input.sourceMix.id,
        materialStemId: input.material.id,
        route: input.plan.route,
        approvalState: 'content_review_candidate',
        publicReleaseAllowed: false,
        discoverPlacementAllowed: false,
        createdAt: new Date().toISOString(),
      },
    },
  }, `${input.mixId}|${input.variantIndex}`);

  return {
    ...recipe,
    versionId: `recipev_${slug(input.mixId)}`,
    versionState: 'frozen',
    versionNumber: 1,
    frozenAt: new Date().toISOString(),
  };
};

const upsertPrivateCandidate = async (input: {
  mixId: string;
  title: string;
  description: string;
  coverImageUrl: string;
  recipe: RecipeV2;
}) => {
  const errors = validateRecipeV2(input.recipe);
  if (errors.length > 0) throw new Error(`${input.mixId}: ${errors.join('; ')}`);
  await query(
    `insert into mixes (
       id, creator_id, title, description, cover_image_url, status, recipe_data,
       render_status, rendered_audio_url, rendered_at, render_error, published_version_id
     ) values ($1, $2, $3, $4, $5, 'private', $6::jsonb, 'not_rendered', '', null, '', $7)
     on conflict (id) do update set
       title = excluded.title,
       description = excluded.description,
       cover_image_url = excluded.cover_image_url,
       status = 'private',
       recipe_data = excluded.recipe_data,
       render_status = 'not_rendered',
       rendered_audio_url = '',
       rendered_at = null,
       render_error = '',
       published_version_id = excluded.published_version_id,
       updated_at = now()`,
    [input.mixId, CREATOR_ID, input.title, input.description, input.coverImageUrl, JSON.stringify(input.recipe), input.recipe.versionId],
  );
  await query(
    `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
     values ($1, $2, 1, $3::jsonb)
     on conflict (id) do update set recipe_data = excluded.recipe_data`,
    [input.recipe.versionId, input.mixId, JSON.stringify(input.recipe)],
  );
};

const run = async () => {
  const coverage = await fetchCoverage();
  const plans = coverage.productionPlan.items
    .filter((item) => item.action === 'compose_reviewed_soundscape')
    .filter((item) => item.priority === 'p0_free_proof' || item.priority === 'p1_paid_inventory')
    .slice(0, 4);
  const sourceIds = Array.from(new Set(plans.flatMap((plan) => plan.candidateSourceMixIds)));
  const materialIds = Array.from(new Set(plans.flatMap((plan) => plan.candidateMaterialIds)));
  const [sourceMixById, stemById] = await Promise.all([sourceMixesById(sourceIds), stemsById(materialIds)]);
  const created: any[] = [];

  for (const plan of plans) {
    const demand = coverage.coverage.find((item) => item.demandType.id === plan.demandTypeId)?.demandType;
    if (!demand) throw new Error(`Missing demand type for ${plan.id}`);
    const sources = plan.candidateSourceMixIds.map((id) => sourceMixById.get(id)).filter(Boolean);
    const materials = plan.candidateMaterialIds.map((id) => stemById.get(id)).filter(Boolean);
    if (sources.length === 0 || materials.length === 0) throw new Error(`${plan.id}: missing source mixes or approved materials`);

    for (let index = 0; index < plan.targetCount; index += 1) {
      const sourceMix = sources[index % sources.length];
      const material = materials[(index + 1) % materials.length];
      const serial = String(index + 1).padStart(2, '0');
      const mixId = `mix_${slug(BATCH_ID)}_${slug(plan.demandTypeId)}_${serial}`;
      const recipe = buildVariantRecipe({ sourceMix, demand, plan, material, variantIndex: index, mixId });
      const title = `${demand.title} Plus Variant ${serial}`;
      await upsertPrivateCandidate({
        mixId,
        title,
        description: `${plan.reason} Source: ${sourceMix.title}. Candidate for content review, not Discover release.`,
        coverImageUrl: coverForDemand(demand.id, demand.goal),
        recipe,
      });
      created.push({
        mixId,
        title,
        planId: plan.id,
        demandTypeId: demand.id,
        sourceMixId: sourceMix.id,
        sourceMixTitle: sourceMix.title,
        materialStemId: material.id,
        materialName: material.name,
        trackCount: recipe.tracks.length,
        durationSeconds: recipe.durationSeconds,
        status: 'private',
        renderStatus: 'not_rendered',
        approvalState: 'content_review_candidate',
      });
    }
  }

  await mkdir(REPORTS_DIR, { recursive: true });
  const report = {
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    policy: 'Private content-review candidates only. Render, listening QA, and release governance are required before Discover placement.',
    coverageBefore: coverage.totals,
    productionPlan: coverage.productionPlan.totals,
    created,
  };
  const reportPath = path.join(REPORTS_DIR, `${BATCH_ID}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
