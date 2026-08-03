import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8788';
const root = process.cwd();
const regressionId = 'consumer-quick-create-internal-baseline-regression-v1';

type Json = Record<string, any>;

let authToken = '';
let userId = '';
const mixIds: string[] = [];

const request = async <T extends Json | Json[]>(pathname: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body as T;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const selectedIds = (plan: Json) => (plan.selected ?? []).map((entry: Json) => String(entry.eligibilityId ?? ''));
const selectedRoles = (plan: Json) => (plan.selected ?? []).map((entry: Json) => String(entry.recipeRole ?? ''));
const selectedRiskTags = (plan: Json) => (plan.selected ?? []).flatMap((entry: Json) => entry.riskTags ?? []).map(String);
const hasAny = (values: string[], pattern: RegExp) => values.some((value) => pattern.test(value));

const ownerDecisionPath = path.join(root, 'config/foundational-eligibility-coverage-render-v1-owner-decision.json');
if (!existsSync(ownerDecisionPath)) throw new Error('Missing foundational eligibility coverage owner decision.');
const ownerDecision = JSON.parse(readFileSync(ownerDecisionPath, 'utf8')) as Json;
assert(ownerDecision.ownerDecision === 'passed_for_internal_audible_product_baseline_regression', 'Coverage render content has not been owner-approved for this regression stage.');
assert(ownerDecision.quickCreateInternalBaselineAllowed === true, 'Owner decision does not allow Quick Create internal baseline regression.');
assert(ownerDecision.productionAllowed === false, 'Owner decision must not allow production.');

type RegressionCase = {
  id: string;
  goal: string;
  scene: string;
  prompt: string;
  expectedAnyRole: string[];
  forbiddenRoles?: string[];
  forbiddenIdPattern?: RegExp;
  forbiddenRiskTags?: string[];
  requiredEligibilityIds?: string[];
  saveAndReplay?: boolean;
};

const cases: RegressionCase[] = [
  {
    id: 'sleep_bedtime_warm_sparse',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '睡前想要温暖、很慢、很稀疏的声音，有一点钢琴感，但不要人声、不要鼓点、不要明显旋律。',
    expectedAnyRole: ['harmony_cell', 'playable_note_source', 'bass_support'],
    saveAndReplay: true,
  },
  {
    id: 'sleep_no_music_dark_hush',
    goal: 'sleep',
    scene: 'bedtime',
    prompt: '只要深一点的安静底层和柔和遮蔽，不要音乐、不要人声、不要鼓点、不要水声、不要公路感。',
    expectedAnyRole: ['organic_texture', 'masking_support'],
    forbiddenRoles: ['harmony_cell', 'playable_note_source', 'melodic_motif', 'bass_support'],
    forbiddenIdPattern: /ocean|rain|water|sea|room_air|pine_air|far_ocean/i,
    forbiddenRiskTags: ['water_association_review', 'road_like_or_hvac_like_review'],
  },
  {
    id: 'calm_breathing_space',
    goal: 'calm',
    scene: 'breathing',
    prompt: '十分钟呼吸冥想，需要宽一点的空间感和慢慢起伏的空气纹理，不要人声、不要鼓点。',
    expectedAnyRole: ['environment_identity_bed', 'organic_texture', 'masking_support'],
  },
  {
    id: 'focus_no_melody_masking',
    goal: 'focus',
    scene: 'deep_focus',
    prompt: '写代码时需要遮蔽外界干扰，不要旋律、不要水声、不要人声、不要强节奏。',
    expectedAnyRole: ['bass_support', 'organic_texture', 'masking_support'],
    forbiddenRoles: ['melodic_motif'],
    forbiddenIdPattern: /ocean|rain|water|sea|room_air|pine_air|far_ocean/i,
    forbiddenRiskTags: ['water_association_review', 'road_like_or_hvac_like_review'],
    requiredEligibilityIds: ['atom_bass_focus_low_pulse_free_anchor'],
  },
];

const results: Json[] = [];
let savedReplayProof: Json | null = null;

try {
  const guest = await request<Json>('/api/auth/guest', { method: 'POST', body: '{}' });
  authToken = String(guest.token ?? '');
  userId = String(guest.user?.id ?? '');
  assert(authToken && userId, 'Guest auth did not return a user and token.');

  for (const item of cases) {
    const startedAt = performance.now();
    const created = await request<Json>('/api/quick-create', {
      method: 'POST',
      body: JSON.stringify({
        prompt: item.prompt,
        goal: item.goal,
        scene: item.scene,
        durationSeconds: 300,
        guidedVoice: false,
      }),
    });
    const quickCreateMs = Math.round(performance.now() - startedAt);
    const mixId = String(created.mix?.id ?? '');
    mixIds.push(mixId);
    assert(mixId, `${item.id} Quick Create did not return a mix id.`);

    const plan = created.planning?.elementCompositionPlan;
    assert(plan?.source === 'foundational_recipe_eligibility_map_v1', `${item.id} did not use foundational recipe eligibility map.`);
    assert(plan?.eligibilityMapId === 'foundational_recipe_eligibility_map_v1', `${item.id} lost eligibility map id.`);
    assert(plan?.runtimeExternalApiUsed === false, `${item.id} used a runtime external API.`);
    assert(plan?.pilotOnly === true, `${item.id} must remain pilot-only.`);
    assert(created.generationDecision?.kind !== 'generate_full_track', `${item.id} attempted full-track generation.`);
    assert(created.mix?.recipeData?.schemaVersion === 2, `${item.id} did not persist Recipe V2.`);
    assert(created.mix?.recipeData?.versionState === 'live', `${item.id} should remain a live recipe before saving.`);
    assert(created.mix?.recipeData?.tracks?.length >= 2, `${item.id} has too few independently adjustable tracks.`);
    assert(created.mix.recipeData.tracks.every((track: Json) => !String(track.stemId).includes('mixkit_music') && !String(track.stemId).includes('music-kit')), `${item.id} fell back to fixed finished music.`);
    assert(created.tracks.every((track: Json) => !String(track.url).includes('foundational-eligibility-coverage-render-v1')), `${item.id} used coverage proof render as a source asset.`);
    assert(created.tracks.every((track: Json) => !String(track.url).includes('foundational-eligibility-quick-create-review-v1')), `${item.id} used prior review render as a source asset.`);

    const ids = selectedIds(plan);
    const roles = selectedRoles(plan);
    const riskTags = selectedRiskTags(plan);
    assert((plan.selected ?? []).length >= 2, `${item.id} selected too few foundational items.`);
    assert((plan.selectedSymbolicRuleIds ?? []).length >= 4, `${item.id} missing symbolic rule ids.`);
    assert(roles.some((role) => item.expectedAnyRole.includes(role)), `${item.id} did not select an expected foundational role.`);
    assert((plan.selected ?? []).every((entry: Json) => entry.routeStatus && entry.sourceKind && entry.recipeRole), `${item.id} missing route metadata.`);
    assert((plan.selected ?? []).every((entry: Json) => entry.supportOnly !== true || entry.routeStatus === 'support_only'), `${item.id} support-only item was not marked support_only.`);

    for (const forbiddenRole of item.forbiddenRoles ?? []) {
      assert(!roles.includes(forbiddenRole), `${item.id} selected forbidden role ${forbiddenRole}.`);
    }
    if (item.forbiddenIdPattern) {
      assert(!hasAny(ids, item.forbiddenIdPattern), `${item.id} selected a forbidden water/air/road-like identity.`);
    }
    for (const forbiddenRisk of item.forbiddenRiskTags ?? []) {
      assert(!riskTags.includes(forbiddenRisk), `${item.id} retained forbidden risk tag ${forbiddenRisk}.`);
    }
    for (const requiredId of item.requiredEligibilityIds ?? []) {
      assert(ids.includes(requiredId), `${item.id} missing required eligibility ${requiredId}.`);
    }

    await Promise.all(created.tracks.map(async (track: Json) => {
      const response = await fetch(`${API_BASE}${track.url}`, { method: 'HEAD' });
      assert(response.ok, `${item.id} track ${track.stemId ?? track.name} is not reachable at ${track.url}.`);
    }));

    if (item.saveAndReplay) {
      const saved = await request<Json>(`/api/mixes/${mixId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Consumer Quick Create Internal Baseline Regression',
          status: 'private',
          recipeData: created.mix.recipeData,
        }),
      });
      assert(saved.status === 'private', `${item.id} did not save as a private My Sounds item.`);
      assert(saved.publishedVersionId, `${item.id} save did not freeze a recipe version.`);
      assert(saved.recipeData?.versionState === 'frozen', `${item.id} saved recipe is not frozen.`);
      assert(saved.recipeData?.quickCreate?.recipeId === created.mix.recipeData.quickCreate?.recipeId, `${item.id} saved recipe lost quickCreate recipe id.`);

      const fetched = await request<Json>(`/api/mixes/${mixId}`);
      assert(fetched.mix?.id === mixId, `${item.id} saved mix is not fetchable.`);
      assert(fetched.mix?.status === 'private', `${item.id} fetched saved mix lost private status.`);
      assert(fetched.mix?.recipeData?.versionState === 'frozen', `${item.id} fetched saved mix lost frozen Recipe V2.`);
      assert(String(fetched.mix?.recipeData?.quickCreate?.recipeId ?? '').startsWith('foundational-eligibility-plan-'), `${item.id} fetched saved recipe lost foundational recipe id.`);
      assert(fetched.mix?.recipeData?.quickCreate?.supply?.kind === 'inventory_only', `${item.id} fetched saved recipe lost inventory-only supply metadata.`);
      assert(fetched.mix?.recipeData?.quickCreate?.supply?.fullTrackProviderAllowed === false, `${item.id} fetched saved recipe allowed full-track provider unexpectedly.`);

      const versions = await request<Json[]>(`/api/mixes/${mixId}/versions`);
      assert(versions.length >= 1, `${item.id} saved mix has no frozen versions.`);
      assert(versions.some((version) => version.isCurrent === true), `${item.id} saved mix has no current frozen version.`);

      savedReplayProof = {
        mixId,
        status: saved.status,
        versionState: saved.recipeData.versionState,
        publishedVersionId: saved.publishedVersionId,
        fetchedStatus: fetched.mix.status,
        currentVersionCount: versions.filter((version) => version.isCurrent === true).length,
      };
    }

    results.push({
      id: item.id,
      goal: item.goal,
      scene: item.scene,
      prompt: item.prompt,
      quickCreateMs,
      mixId,
      contentMode: created.mix.recipeData.contentMode,
      recipeId: created.mix.recipeData.quickCreate?.recipeId,
      selectedEligibilityIds: ids,
      selectedRecipeRoles: roles,
      selectedRiskTags: riskTags,
      selectedSymbolicRuleIds: plan.selectedSymbolicRuleIds,
      trackCount: created.mix.recipeData.tracks.length,
      trackStemIds: created.mix.recipeData.tracks.map((track: Json) => track.stemId),
      audioTrackUrls: created.tracks.map((track: Json) => track.url),
      excludedSounds: created.audioIntent?.excludedSounds ?? [],
      excludedConceptIds: created.audioIntent?.excludedConceptIds ?? [],
      runtimeExternalApiUsed: plan.runtimeExternalApiUsed,
      productionAllowed: false,
    });
  }

  const fingerprints = new Set(results.map((item) => [...item.selectedEligibilityIds].sort().join('|')));
  assert(fingerprints.size >= 3, 'Sleep, Calm, and Focus collapsed into too few foundational selections.');
  assert(savedReplayProof, 'No saved replay proof was produced.');

  const report = {
    schemaVersion: '1.0.0',
    regressionId,
    generatedAt: new Date().toISOString(),
    status: 'passed',
    apiBase: API_BASE,
    requiredRuntimeFlag: 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1',
    ownerDecisionSource: 'config/foundational-eligibility-coverage-render-v1-owner-decision.json',
    sourceMap: 'config/foundational-recipe-eligibility-map-v1.json',
    productionAllowed: false,
    formalUsablePromotionAllowed: false,
    purpose: 'Verify the owner-approved foundational eligibility material route works inside the real consumer Quick Create, save, and replay metadata loop.',
    hardRules: [
      'User-facing Quick Create must use foundational_recipe_eligibility_map_v1.',
      'Coverage proof renders must not be used as source assets.',
      'Rendered proof files remain route proofs, not foundational materials.',
      'Runtime external full-track generation must not be used.',
      'Explicit no-music, no-melody, no-water, no-road, no-voice, and no-drum constraints must survive routing.',
      'Production and formal usable promotion remain blocked.',
    ],
    counts: {
      cases: results.length,
      sleep: results.filter((item) => item.goal === 'sleep').length,
      calm: results.filter((item) => item.goal === 'calm').length,
      focus: results.filter((item) => item.goal === 'focus').length,
      distinctSelections: fingerprints.size,
      savedReplayProofs: savedReplayProof ? 1 : 0,
      runtimeExternalApiUsed: results.filter((item) => item.runtimeExternalApiUsed).length,
      productionAllowed: 0,
    },
    savedReplayProof,
    results,
  };

  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(path.join(root, 'reports', `${regressionId}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, 'reports', `${regressionId}.md`), `# Consumer Quick Create Internal Baseline Regression V1

Generated: ${report.generatedAt}

Status: \`${report.status}\`

## Verdict

The owner-approved foundational eligibility route passed the real consumer Quick
Create regression for Sleep, Calm, and Focus.

This proves the current user-facing route can select approved foundational
elements, preserve explicit exclusions, save a generated Recipe V2 result to My
Sounds, and fetch the frozen replay metadata again.

## Counts

| Metric | Count |
| --- | ---: |
| Cases | ${report.counts.cases} |
| Sleep | ${report.counts.sleep} |
| Calm | ${report.counts.calm} |
| Focus | ${report.counts.focus} |
| Distinct foundational selections | ${report.counts.distinctSelections} |
| Saved replay proofs | ${report.counts.savedReplayProofs} |
| Runtime external API used | ${report.counts.runtimeExternalApiUsed} |
| Production allowed | ${report.counts.productionAllowed} |

## Boundary

These are regression results, not new foundational materials and not production
release assets. Coverage proof renders remain blocked as source assets.

## Cases

${results.map((item) => `- \`${item.id}\`: ${item.goal}/${item.scene}, tracks=${item.trackCount}, quickCreateMs=${item.quickCreateMs}, selected=${item.selectedEligibilityIds.join(', ')}`).join('\n')}

## Next

The next mainline step is Sprint 1 playback reliability: background playback,
interruption/resume, long-session stability, system media controls, and
playback-state recovery against the now-approved internal audible baseline.
`);

  console.log(JSON.stringify({
    passed: true,
    regressionId,
    counts: report.counts,
    productionAllowed: report.productionAllowed,
    reportPath: `reports/${regressionId}.md`,
    jsonReportPath: `reports/${regressionId}.json`,
  }, null, 2));
} finally {
  for (const mixId of mixIds.filter(Boolean)) {
    await query('delete from playback_events where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from user_history where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from mixes where id = $1', [mixId]).catch(() => undefined);
  }
  if (userId) await query('delete from users where id = $1', [userId]).catch(() => undefined);
  await pool.end();
}
