const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:8788';
type Json = Record<string, any>;
let token = '';
const guestTokens: string[] = [];

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

const authenticateGuest = async () => {
  const guest = await request('/api/auth/guest', { method: 'POST' });
  token = String(guest.token ?? '');
  assert(token, 'guest authentication failed');
  guestTokens.push(token);
};

try {
  await authenticateGuest();

  const requests = [
    ['Warm sleep music with sparse felt piano, no voice or drums.', 'sleep', 'bedtime'],
    ['Meditation music with warm Rhodes and open space, no voice.', 'calm', 'emotional_settling'],
    ['Steady focus music with soft nylon guitar, no voice.', 'focus', 'deep_focus'],
  ] as const;
  for (const [prompt, goal, scene] of requests) {
    const created = await create(prompt, goal, scene);
    const plan = created.planning?.elementCompositionPlan;
    assert(plan?.runtimeExternalApiUsed === false, `${goal} did not return a no-API ElementCompositionPlan`);
    assert(plan.selected?.length === 3, `${goal} did not select three elements`);
    assert(created.mix?.recipeData?.schemaVersion === 2, `${goal} did not persist Recipe V2`);
    assert(created.mix.recipeData.tracks.length === 3, `${goal} recipe did not keep three independently adjustable tracks`);
    assert(created.mix.recipeData.tracks.every((track: Json) => String(track.stemId).startsWith('stem_lyria_element_')), `${goal} fell back to a fixed MusicKit`);
    assert(created.generationDecision?.kind !== 'generate_full_track', `${goal} attempted a runtime full-track API call`);
    await Promise.all(created.tracks.map(async (track: Json) => {
      const response = await fetch(`${API_BASE}${track.url}`, { method: 'HEAD' });
      assert(response.ok, `${track.stemId} is not reachable`);
    }));
  }

  // Keep the production rate limit intact while testing the remaining ten
  // Quick Create requests under a second independent guest identity.
  await authenticateGuest();

  const variants = new Set<string>();
  for (let index = 0; index < 8; index += 1) {
    const created = await create('Warm sleep music with sparse felt piano, no voice or drums.', 'sleep', 'bedtime');
    variants.add(created.planning.elementCompositionPlan.selected.map((entry: Json) => entry.stemId).sort().join('|'));
  }
  assert(variants.size >= 3, `repeated Quick Create only produced ${variants.size} distinct element combinations`);

  const noPiano = await create('Sleep music without piano, no voice.', 'sleep', 'bedtime');
  assert(noPiano.planning?.elementCompositionPlan, 'no-piano request unexpectedly lost element composition');
  assert(!noPiano.planning.elementCompositionPlan.selected.some((entry: Json) => entry.family === 'felt_piano_phrase'), 'no-piano request still selected felt piano');

  const noMusic = await create('Only steady rain, no music and no voice.', 'sleep', 'bedtime');
  assert(noMusic.planning?.elementCompositionPlan == null, 'no-music request still used foundational music elements');
  assert(noMusic.mix.recipeData.tracks.every((track: Json) => !String(track.stemId).startsWith('stem_lyria_element_')), 'no-music recipe contains a foundational music element');

  console.log(`PASS: real Quick Create used ElementCompositionPlan for Sleep, Calm, and Focus; produced ${variants.size} Sleep variants; respected instrument and music exclusions; all selected files are reachable.`);
} finally {
  await Promise.all(guestTokens.map((guestToken) => fetch(`${API_BASE}/api/me`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${guestToken}`, 'x-confirm-account-deletion': 'DELETE' },
  }).catch(() => undefined)));
}
