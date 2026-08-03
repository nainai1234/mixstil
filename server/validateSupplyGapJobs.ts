import { pool } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

type JsonObject = Record<string, any>;
let authToken = '';

const request = async <T extends JsonObject>(pathname: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body as T;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  const guest = await request<JsonObject>('/api/auth/guest', { method: 'POST' });
  authToken = String(guest.token ?? '');
  assert(authToken, 'Validation guest session was not created.');

  const inventory = await request<JsonObject>('/api/generation-decision', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'gentle piano sleep music',
      goal: 'sleep',
      scene: 'bedtime',
      requiredConceptIds: [],
    }),
  });
  assert(inventory.decision.kind === 'inventory_only', 'Expected inventory-only decision for a supported piano sleep prompt.');

  const createdMix = await request<JsonObject>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'gentle piano sleep music, no voice',
      goal: 'sleep',
      scene: 'bedtime',
      durationSeconds: 300,
    }),
  });
  assert(createdMix.generationDecision?.kind === 'inventory_only', 'Quick Create response should expose the generation decision.');
  assert(createdMix.mix?.recipeData?.quickCreate?.supply?.kind === 'inventory_only', 'Quick Create mix should persist the supply decision for Player and saved replay.');

  const prompt = `quiet harp sleep support ${Date.now()}`;
  const created = await request<JsonObject>('/api/supply-gap-jobs/ensure', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      goal: 'sleep',
      scene: 'bedtime',
      requiredConceptIds: ['source.music.harp'],
    }),
  });
  assert(created.status === 'created', 'First supply gap ensure should create a job.');
  assert(created.job?.status === 'queued', 'Single-gap job should queue for the missing Stem factory.');
  assert(created.job?.providerPolicy === 'local_musickit_factory_only', 'Single-gap job must stay local-only.');
  assert(created.job?.generationSpec?.role === 'music.bed', 'Single-gap job should target the missing music bed stem.');

  const cached = await request<JsonObject>('/api/supply-gap-jobs/ensure', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      goal: 'sleep',
      scene: 'bedtime',
      requiredConceptIds: ['source.music.harp'],
    }),
  });
  assert(cached.status === 'cached', 'Repeated ensure should return the cached job.');
  assert(cached.job?.id === created.job?.id, 'Repeated ensure should reuse the same job id.');
  assert(Number(cached.job?.cacheHitCount ?? 0) > Number(created.job?.cacheHitCount ?? 0), 'Cached job should increment cacheHitCount.');

  const processed = await request<JsonObject>(`/api/supply-gap-jobs/${created.job.id}/process`, { method: 'POST' });
  assert(processed.job?.status === 'candidate_ready', 'Local MusicKit supply job should become candidate_ready.');
  assert(processed.job?.qaStatus === 'machine_pending', 'Local MusicKit candidates should await machine QA.');
  assert(Array.isArray(processed.candidates) && processed.candidates.length === 4, 'Local MusicKit provider should create four candidate specs.');
  assert(processed.candidates.every((candidate: JsonObject) => candidate.originRecord?.fullTrack === false), 'Supply candidates must not be full-track generation.');
  assert(processed.candidates.every((candidate: JsonObject) => candidate.licenseRecord?.paidApi === false), 'Local MusicKit candidates must not depend on a paid API.');

  const fetched = await request<JsonObject>(`/api/supply-gap-jobs/${created.job.id}`);
  assert(fetched.candidates?.length === 4, 'Supply gap status endpoint should include job candidates.');

  const externalPrompt = `quiet desert ambience no music ${Date.now()}`;
  const externalQueued = await request<JsonObject>('/api/supply-gap-jobs/ensure', {
    method: 'POST',
    body: JSON.stringify({
      prompt: externalPrompt,
      goal: 'calm',
      scene: 'emotional_settling',
      requiredConceptIds: ['source.natural.desert'],
    }),
  });
  assert(externalQueued.status === 'created', 'Missing environment job should be created before provider processing.');
  assert(externalQueued.job?.providerPolicy === 'approved_inventory_import_first_then_external_sfx_candidates', 'Environment gap should prefer inventory import then external SFX candidates.');
  const externalProcessed = await request<JsonObject>(`/api/supply-gap-jobs/${externalQueued.job.id}/process`, { method: 'POST' });
  assert(externalProcessed.job?.status === 'failed', 'External SFX job should fail closed while provider is disabled.');
  assert(externalProcessed.fallback === 'external_provider_disabled', 'Disabled external provider should return an explicit fallback reason.');
  assert(!externalProcessed.candidates?.length, 'Disabled external provider should not create candidates.');

  const blocked = await request<JsonObject>('/api/supply-gap-jobs/ensure', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'harp in a desert with rare bells',
      goal: 'calm',
      scene: 'emotional_settling',
      requiredConceptIds: ['source.music.harp', 'source.natural.desert', 'source.accent.bell'],
    }),
  });
  assert(blocked.status === 'blocked', 'Multi-gap request should be blocked instead of routed to a full-track provider.');
  assert(blocked.job?.status === 'blocked', 'Blocked request should persist as blocked.');
  assert(!blocked.job?.generationSpec, 'Blocked request must not include a generation spec.');

  console.log('PASS: supply-gap jobs cache one-gap requests, create local candidate specs, fail external providers closed, block multi-gap requests, and keep full-track generation out of scope.');
} finally {
  await pool.end();
}
