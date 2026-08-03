const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8788';
type Json = Record<string, any>;
let token = '';

const request = async (pathname: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body as Json;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const create = (prompt: string, goal: 'sleep' | 'calm' | 'focus', scene: string) => request('/api/quick-create', {
  method: 'POST',
  body: JSON.stringify({ prompt, goal, scene, durationSeconds: 300, guidedVoice: false }),
});

const guest = await request('/api/auth/guest', { method: 'POST' });
token = String(guest.token ?? '');
assert(token, 'guest authentication failed');

try {
  type EligibilityQuickCreateCase = {
    id: string;
    prompt: string;
    goal: 'sleep' | 'calm' | 'focus';
    scene: string;
    expectedAnyRole: string[];
    expectedStemPrefix: string;
  };

  const cases: EligibilityQuickCreateCase[] = [
    {
      id: 'sleep_music',
      prompt: '睡前需要温暖、稀疏的钢琴音乐感，没有人声和鼓点。',
      goal: 'sleep',
      scene: 'bedtime',
      expectedAnyRole: ['harmony_cell', 'melodic_motif', 'bass_support'],
      expectedStemPrefix: 'stem_atomic_',
    },
    {
      id: 'calm_soundscape',
      prompt: '十分钟冥想，只要舒缓空间感和空气纹理，不要音乐、不要人声、不要鼓点。',
      goal: 'calm',
      scene: 'breathing',
      expectedAnyRole: ['environment_identity_bed', 'organic_texture', 'masking_support'],
      expectedStemPrefix: 'stem_foundation_',
    },
    {
      id: 'focus_low_distraction',
      prompt: '白天深度工作，需要低干扰的环境层和一点柔和支撑，不要人声，不要强节奏。',
      goal: 'focus',
      scene: 'deep_focus',
      expectedAnyRole: ['environment_identity_bed', 'organic_texture', 'masking_support'],
      expectedStemPrefix: 'stem_foundation_',
    },
  ];

  const fingerprints = new Set<string>();
  for (const item of cases) {
    const created = await create(item.prompt, item.goal, item.scene);
    const plan = created.planning?.elementCompositionPlan;
    assert(plan?.source === 'foundational_recipe_eligibility_map_v1', `${item.id} did not use foundational eligibility map`);
    assert(plan?.eligibilityMapId === 'foundational_recipe_eligibility_map_v1', `${item.id} missing eligibility map id`);
    assert(plan?.runtimeExternalApiUsed === false, `${item.id} attempted runtime external API`);
    assert(plan?.pilotOnly === true, `${item.id} must remain pilot-only`);
    assert(Array.isArray(plan.selected) && plan.selected.length >= 2, `${item.id} selected too few foundational elements`);
    assert(Array.isArray(plan.selectedSymbolicRuleIds) && plan.selectedSymbolicRuleIds.length >= 4, `${item.id} missing symbolic rules`);
    assert(plan.selected.some((entry: Json) => item.expectedAnyRole.includes(String(entry.recipeRole))), `${item.id} missing expected recipe role`);
    assert(plan.selected.every((entry: Json) => entry.routeStatus && entry.sourceKind), `${item.id} missing route metadata`);
    assert(plan.selected.every((entry: Json) => entry.supportOnly !== true || entry.routeStatus === 'support_only'), `${item.id} support-only item not marked support_only`);
    assert(created.mix?.recipeData?.schemaVersion === 2, `${item.id} did not persist Recipe V2`);
    assert(created.mix.recipeData.tracks.length >= 2, `${item.id} recipe did not keep independently adjustable tracks`);
    assert(created.mix.recipeData.tracks.some((track: Json) => String(track.stemId).startsWith(item.expectedStemPrefix)), `${item.id} did not use expected foundational stem prefix`);
    assert(created.mix.recipeData.tracks.every((track: Json) => !String(track.stemId).includes('music-kit')), `${item.id} fell back to MusicKit`);
    assert(created.mix.recipeData.tracks.every((track: Json) => !String(track.stemId).includes('mixkit_music')), `${item.id} fell back to fixed music stem`);
    assert(created.generationDecision?.kind !== 'generate_full_track', `${item.id} attempted full-track generation`);
    await Promise.all(created.tracks.map(async (track: Json) => {
      const response = await fetch(`${API_BASE}${track.url}`, { method: 'HEAD' });
      assert(response.ok, `${item.id} ${track.stemId} is not reachable at ${track.url}`);
    }));
    fingerprints.add(plan.selected.map((entry: Json) => entry.eligibilityId).sort().join('|'));
  }

  assert(fingerprints.size === cases.length, 'Sleep, Calm, and Focus collapsed to the same eligibility selection');

  console.log(JSON.stringify({
    passed: true,
    mode: 'foundational_recipe_eligibility_quick_create_v1',
    cases: cases.length,
    distinctEligibilitySelections: fingerprints.size,
    runtimeExternalApiUsed: false,
    productionAllowed: false,
  }, null, 2));
} finally {
  await fetch(`${API_BASE}/api/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}`, 'x-confirm-account-deletion': 'DELETE' },
  }).catch(() => undefined);
}
