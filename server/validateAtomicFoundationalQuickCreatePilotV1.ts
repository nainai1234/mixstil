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
  const requests = [
    ['睡前需要温暖、稀疏的钢琴音乐感，没有人声和鼓点。', 'sleep', 'bedtime', 'piano'],
    ['十分钟冥想，想要一点柔和吉他质感，不要人声和鼓点。', 'calm', 'breathing', 'guitar'],
    ['白天深度工作，需要低干扰 Rhodes 背景，没有人声。', 'focus', 'deep_focus', 'rhodes'],
  ] as const;

  const fingerprints = new Set<string>();
  for (const [prompt, goal, scene, expectedInstrument] of requests) {
    const created = await create(prompt, goal, scene);
    const plan = created.planning?.elementCompositionPlan;
    assert(plan?.source === 'atomic-foundation-elements-v1', `${goal} did not use atomic foundation elements`);
    assert(plan?.runtimeExternalApiUsed === false, `${goal} attempted a runtime external API`);
    assert(plan?.pilotOnly === true, `${goal} did not mark atomic Quick Create as pilot-only`);
    assert(Array.isArray(plan.selected) && plan.selected.length === 3, `${goal} did not select three atomic elements`);
    assert(plan.selected.some((entry: Json) => String(entry.instrument).includes(expectedInstrument)), `${goal} did not honor expected instrument ${expectedInstrument}`);
    assert(Array.isArray(plan.selectedSymbolicRuleIds) && plan.selectedSymbolicRuleIds.length >= 4, `${goal} did not expose symbolic rules`);
    assert(created.mix?.recipeData?.schemaVersion === 2, `${goal} did not persist Recipe V2`);
    assert(created.mix.recipeData.tracks.length === 3, `${goal} recipe did not keep three independently adjustable atomic tracks`);
    assert(created.mix.recipeData.tracks.every((track: Json) => String(track.stemId).startsWith('stem_atomic_atom_')), `${goal} fell back to old Lyria/MusicKit/baseline stems`);
    assert(created.mix.recipeData.quickCreate?.recipeId === plan.id, `${goal} did not retain atomic plan recipe id`);
    assert(created.mix.recipeData.tracks.every((track: Json) => track.loop?.enabled === true), `${goal} atomic tracks must loop in Recipe V2`);
    assert(created.generationDecision?.kind !== 'generate_full_track', `${goal} attempted a runtime full-track API call`);
    await Promise.all(created.tracks.map(async (track: Json) => {
      const response = await fetch(`${API_BASE}${track.url}`, { method: 'HEAD' });
      assert(response.ok, `${track.stemId} is not reachable at ${track.url}`);
    }));
    fingerprints.add(plan.selected.map((entry: Json) => entry.atomicElementId).sort().join('|'));
  }

  const noMusic = await create('Only steady rain, no music and no voice.', 'sleep', 'bedtime');
  assert(noMusic.planning?.elementCompositionPlan == null, 'no-music request still used atomic music elements');
  assert(noMusic.mix.recipeData.tracks.every((track: Json) => !String(track.stemId).startsWith('stem_atomic_atom_')), 'no-music recipe contains atomic music elements');

  assert(fingerprints.size === requests.length, 'Sleep, Calm, and Focus collapsed to the same atomic selection');

  console.log(JSON.stringify({
    passed: true,
    mode: 'atomic_foundation_quick_create_pilot_v1',
    cases: requests.length,
    distinctAtomicSelections: fingerprints.size,
    noMusicBypass: true,
    runtimeExternalApiUsed: false,
  }, null, 2));
} finally {
  await fetch(`${API_BASE}/api/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}`, 'x-confirm-account-deletion': 'DELETE' },
  }).catch(() => undefined);
}
