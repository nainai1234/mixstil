import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

const request = async (pathname: string, init?: RequestInit, expectedStatus = 200) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(`${init?.method ?? 'GET'} ${pathname} expected ${expectedStatus}, received ${response.status}: ${body.error ?? JSON.stringify(body)}`);
  }
  return body as Record<string, any>;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let mixId = '';
const validationUserIds: string[] = [];

try {
  const creatorGuest = await request('/api/auth/guest', { method: 'POST' }, 201);
  const creatorToken = String(creatorGuest.token ?? '');
  assert(creatorToken, 'Publish privacy validation did not create a guest session.');
  validationUserIds.push(String(creatorGuest.user.id));
  const auth = { authorization: `Bearer ${creatorToken}` };

  const created = await request('/api/quick-create', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      goal: 'sleep',
      prompt: 'Soft rain for a private publication test, no voice',
      durationSeconds: 60,
      guidedVoice: false,
    }),
  }, 201);
  mixId = String(created.mix.id);

  const privateMix = await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      title: 'Private Publication Test',
      status: 'private',
      recipeData: created.mix.recipeData,
    }),
  });
  assert(privateMix.status === 'private', 'Work was not privately published.');
  assert(privateMix.publishedVersionId, 'Private publication did not freeze a recipe version.');

  await request(`/api/public/mixes/${mixId}`, undefined, 404);
  const discover = await request('/api/discover');
  assert(!discover.trending.some((mix: Record<string, any>) => mix.id === mixId), 'Private work leaked into Discover.');

  await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ intent: 'tonight', visibility: 'public' }),
  }, 409);
  const privateShare = await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ intent: 'gift', visibility: 'unlisted' }),
  }, 201);
  const privateGate = await request(`/api/share-links/${privateShare.slug}`, undefined, 401);
  assert(privateGate.code === 'private_share_login_required', 'Private publication did not create a one-person gated share.');

  await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'published', recipeData: created.mix.recipeData }),
  });
  const publicShare = await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ intent: 'tonight', visibility: 'public' }),
  }, 201);
  await request(`/api/share-links/${publicShare.slug}`);

  await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'private', recipeData: created.mix.recipeData }),
  });
  await request(`/api/share-links/${publicShare.slug}`, undefined, 410);

  console.log(JSON.stringify({
    passed: true,
    mixId,
    privateShareSlug: privateShare.slug,
    revokedPublicShareSlug: publicShare.slug,
  }, null, 2));
} finally {
  if (mixId) {
    await query('delete from user_history where mix_id = $1', [mixId]);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]);
    await query('delete from mixes where id = $1', [mixId]);
  }
  for (const userId of validationUserIds) await query('delete from users where id = $1', [userId]);
  await pool.end();
}
