import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

type Json = Record<string, any>;

const request = async <T extends Json | Json[]>(
  path: string,
  init: RequestInit = {},
  token = '',
  expectedStatus = 200,
) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method ?? 'GET'} ${path}: expected ${expectedStatus}, received ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload as T;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const register = (suffix: string, token = '') => request<Json>('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    username: `Isolation ${suffix}`,
    email: `isolation-${suffix}-${Date.now()}@example.com`,
    password: 'isolation-pass-123',
  }),
}, token, 201);

let userAId = '';
let userBId = '';
let mixId = '';

try {
  const guest = await request<Json>('/api/auth/guest', { method: 'POST' }, '', 201);
  const userA = await register('a', guest.token);
  userAId = userA.user.id;
  assert(userAId === guest.user.id, 'Guest registration did not preserve the existing account and its data ownership.');

  const userB = await register('b');
  userBId = userB.user.id;
  assert(userAId !== userBId, 'The two test users unexpectedly share an identity.');

  await request<Json>('/api/me/sound-profile', {
    method: 'PUT',
    body: JSON.stringify({ likedSounds: ['forest'], excludedSounds: ['water'], defaultGoal: 'sleep' }),
  }, userA.token);
  const profileB = await request<Json>('/api/me/sound-profile', {}, userB.token);
  assert(!profileB.profile.likedSounds.includes('forest'), 'User B received User A liked sounds.');
  assert(!profileB.profile.excludedSounds.includes('water'), 'User B received User A exclusions.');

  const source = await request<Json>('/api/public/mixes/mix_ocean_calm');
  const created = await request<Json>('/api/mixes', {
    method: 'POST',
    body: JSON.stringify({
      title: 'User A Isolation Draft',
      description: 'Temporary ownership isolation fixture.',
      status: 'draft',
      recipeData: source.mix.recipeData,
    }),
  }, userA.token, 201);
  mixId = created.id;
  assert(created.creatorId === userAId, 'New mix was not assigned to User A.');

  const studioA = await request<Json>('/api/studio?all=true', {}, userA.token);
  const studioB = await request<Json>('/api/studio?all=true', {}, userB.token);
  assert(studioA.mixes.some((mix: Json) => mix.id === mixId), 'User A cannot see their own mix.');
  assert(!studioB.mixes.some((mix: Json) => mix.id === mixId), 'User B can see User A mix in My Sounds.');

  await request<Json>(`/api/mixes/${mixId}`, {}, userB.token, 404);
  await request<Json>(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Unauthorized update' }),
  }, userB.token, 403);
  await request<Json>(`/api/mixes/${mixId}/versions`, {}, userB.token, 403);
  await request<Json>(`/api/mixes/${mixId}/analytics`, {}, userB.token, 403);

  await request<Json>(`/api/me/playback-states/${mixId}`, {
    method: 'PUT',
    body: JSON.stringify({ positionSeconds: 45, durationSeconds: 300 }),
  }, userA.token);
  await request<Json>(`/api/me/playback-states/${mixId}`, {
    method: 'PUT',
    body: JSON.stringify({ positionSeconds: 90, durationSeconds: 300 }),
  }, userB.token, 404);
  const statesB = await request<Json[]>('/api/me/playback-states', {}, userB.token);
  assert(!statesB.some((state) => state.mixId === mixId), 'User B received User A playback state.');

  const journeyId = `isolation_${Date.now()}`;
  await request<Json>(`/api/mixes/${mixId}/playback-events`, {
    method: 'POST',
    body: JSON.stringify({
      journeyId,
      events: [{ type: 'playback_requested', elapsedMs: 10, details: { source: 'isolation-test' } }],
    }),
  }, userA.token, 201);
  const journeyA = await request<Json>(`/api/playback-events/journeys/${journeyId}`, {}, userA.token);
  const journeyB = await request<Json>(`/api/playback-events/journeys/${journeyId}`, {}, userB.token);
  assert(journeyA.events.length === 1, 'User A playback event was not recorded.');
  assert(journeyB.events.length === 0, 'User B can read User A playback events.');

  await request<Json>('/api/me', {
    method: 'DELETE',
    headers: { 'x-confirm-account-deletion': 'DELETE' },
  }, userB.token);
  const stillOwned = await request<Json>(`/api/mixes/${mixId}`, {}, userA.token);
  assert(stillOwned.mix.creatorId === userAId, 'Deleting User B affected User A resources.');

  console.log(JSON.stringify({
    passed: true,
    checks: [
      'guest-account-upgrade',
      'sound-profile-isolation',
      'my-sounds-isolation',
      'draft-read-and-write-ownership',
      'versions-and-analytics-ownership',
      'playback-state-isolation',
      'playback-event-isolation',
      'account-deletion-scope',
    ],
  }, null, 2));
} finally {
  if (userAId || userBId) {
    const userIds = [userAId, userBId].filter(Boolean);
    const mixes = await query<{ id: string }>('select id from mixes where creator_id = any($1::text[])', [userIds]).catch(() => ({ rows: [] } as any));
    const mixIds = mixes.rows.map((row: { id: string }) => row.id);
    await query('delete from user_history where user_id = any($1::text[]) or mix_id = any($2::text[])', [userIds, mixIds]).catch(() => undefined);
    await query('delete from ai_sessions where user_id = any($1::text[]) or generated_mix_id = any($2::text[])', [userIds, mixIds]).catch(() => undefined);
    await query('delete from playback_events where user_id = any($1::text[])', [userIds]).catch(() => undefined);
    await query('delete from share_links where creator_id = any($1::text[])', [userIds]).catch(() => undefined);
    await query('delete from mixes where creator_id = any($1::text[])', [userIds]).catch(() => undefined);
    await query('delete from users where id = any($1::text[])', [userIds]).catch(() => undefined);
  }
  await pool.end();
}
