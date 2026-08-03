import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8788';
const root = process.cwd();

type Json = Record<string, any>;

let authToken = '';
let userId = '';
const mixIds: string[] = [];

const request = async <T extends Json>(pathname: string, init: RequestInit = {}): Promise<T> => {
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

const ownerDecisionPath = path.join(root, 'config/foundational-eligibility-coverage-render-v1-owner-decision.json');
const inventoryAuditPath = path.join(root, 'reports/business-audio-element-inventory-v1.json');
const readinessReportPath = path.join(root, 'reports/content-foundation-routing-and-material-readiness-v1.json');
assert(existsSync(ownerDecisionPath), 'missing foundational owner decision');
assert(existsSync(inventoryAuditPath), 'missing business inventory audit');
assert(existsSync(readinessReportPath), 'missing content foundation readiness report');

const ownerDecision = JSON.parse(readFileSync(ownerDecisionPath, 'utf8')) as Json;
const inventoryAudit = JSON.parse(readFileSync(inventoryAuditPath, 'utf8')) as Json;
const readinessReport = JSON.parse(readFileSync(readinessReportPath, 'utf8')) as Json;
assert(ownerDecision.productionAllowed === false, 'foundational owner decision must keep production blocked');
assert(inventoryAudit.decision?.verdict === 'not_ready_for_internal_audible_foundational_baseline', 'inventory audit must state foundational baseline is not ready');
assert(readinessReport.status === 'internal_content_foundation_ready_for_controlled_composer_pilot', 'readiness report must allow controlled composer pilot');
assert(readinessReport.productionAllowed === false && readinessReport.publicReleaseAllowed === false, 'readiness report must keep production/public release blocked');
assert(Object.values(readinessReport.materialCoverage?.gap ?? {}).every((value) => Number(value) <= 0), 'readiness report must show no positive structural material gap');

try {
  const guest = await request<Json>('/api/auth/guest', { method: 'POST', body: '{}' });
  authToken = String(guest.token ?? '');
  userId = String(guest.user?.id ?? '');
  assert(authToken && userId, 'guest auth did not return token/user');

  const genericSleep = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '晚上总是睡不好，也有点焦虑，希望能更容易安静下来',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(genericSleep.mix?.id ?? ''));
  assert(genericSleep.planning?.elementCompositionPlan === null, 'generic sleep request should not be swallowed by foundational element routing');
  assert(genericSleep.planning?.composerBundlePlan == null, 'generic sleep request should not expose foundational composer bundle plan');
  assert(String(genericSleep.planning?.internalBaselineSeed ?? '').startsWith('sleep_'), 'generic sleep request should use finished/internal baseline seed');
  assert(String(genericSleep.mix?.recipeData?.quickCreate?.recipeId ?? '').startsWith('content-baseline-'), 'generic sleep recipe should preserve content-baseline id');

  const explicitRain = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '睡前想听很轻的雨声，不要人声、不要鼓点',
      goal: 'sleep',
      durationSeconds: 300,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(explicitRain.mix?.id ?? ''));
  const rainPlan = explicitRain.planning?.elementCompositionPlan;
  assert(rainPlan?.source === 'foundational_recipe_eligibility_map_v1', 'explicit rain request should use foundational element routing');
  assert(explicitRain.planning?.composerBundlePlan?.version === 'composer_bundle_plan_v1', 'explicit rain request should expose composer bundle plan');
  assert(explicitRain.planning?.composerBundlePlan?.mode === 'music_supported', 'explicit rain request with no music exclusion can keep music-supported bundle plan');
  assert((rainPlan.selected ?? []).some((entry: Json) => /rain/i.test(String(entry.eligibilityId ?? ''))), 'explicit rain request should select a rain identity bed');
  assert(explicitRain.planning?.internalBaselineSeed === null, 'explicit rain element request should not be replaced by finished seed content');

  const explicitNoMusic = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '只要深一点的安静底层和柔和遮蔽，不要音乐、不要人声、不要鼓点、不要水声、不要公路感。',
      goal: 'sleep',
      scene: 'bedtime',
      durationSeconds: 300,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(explicitNoMusic.mix?.id ?? ''));
  const noMusicPlan = explicitNoMusic.planning?.elementCompositionPlan;
  assert(noMusicPlan?.source === 'foundational_recipe_eligibility_map_v1', 'explicit no-music masking request should use foundational element routing');
  assert(explicitNoMusic.planning?.composerBundlePlan?.version === 'composer_bundle_plan_v1', 'explicit no-music request should expose composer bundle plan');
  assert(explicitNoMusic.planning?.composerBundlePlan?.mode === 'support_only', 'explicit no-music request should become support-only composer bundle');
  assert(!JSON.stringify(explicitNoMusic.planning?.composerBundlePlan?.bundle ?? {}).includes('distant_ocean_wash'), 'explicit no-water/no-road composer bundle selected ocean material');
  assert(!JSON.stringify(explicitNoMusic.planning?.composerBundlePlan?.bundle ?? {}).includes('gentle_rain_canopy'), 'explicit no-water/no-road composer bundle selected rain material');
  assert(!JSON.stringify(explicitNoMusic.planning?.composerBundlePlan?.bundle ?? {}).includes('steady_room_ventilation'), 'explicit no-road composer bundle selected ventilation/road-risk material');
  assert((noMusicPlan.selected ?? []).every((entry: Json) => !['harmony_cell', 'playable_note_source', 'melodic_motif', 'bass_support'].includes(String(entry.recipeRole ?? ''))), 'explicit no-music request selected music roles');
  assert((noMusicPlan.selected ?? []).every((entry: Json) => !/rain|water|ocean|sea|far_ocean|room_air|pine_air/i.test(String(entry.eligibilityId ?? ''))), 'explicit no-water/no-road request selected forbidden identity bed');

  const genericFocus = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '下午要工作一会儿，给我一个适合专注的声音',
      goal: 'focus',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(genericFocus.mix?.id ?? ''));
  assert(genericFocus.planning?.elementCompositionPlan === null, 'generic focus request should not default to foundational element routing');
  assert(genericFocus.planning?.composerBundlePlan == null, 'generic focus request should not expose foundational composer bundle plan');
  assert(String(genericFocus.planning?.internalBaselineSeed ?? '').startsWith('focus_'), 'generic focus request should use finished/internal baseline seed');

  console.log(JSON.stringify({
    passed: true,
    policy: 'content_foundation_routing_policy_v1',
    genericSleepRoute: 'finished_internal_baseline',
    explicitRainRoute: rainPlan.source,
    explicitNoMusicRoute: noMusicPlan.source,
    genericFocusRoute: 'finished_internal_baseline',
    legacyFoundationalInventoryVerdict: inventoryAudit.decision.verdict,
    currentMaterialReadinessStatus: readinessReport.status,
    currentStructuralMaterialGap: readinessReport.materialCoverage.gap,
    productionAllowed: false,
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
