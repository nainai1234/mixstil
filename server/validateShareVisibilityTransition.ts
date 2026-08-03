import { createHash, randomBytes } from 'node:crypto';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const sessionId = `session_share_visibility_${randomBytes(6).toString('hex')}`;
let mixId = '';

const request = async (pathname: string, init?: RequestInit, expectedStatus = 200) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status !== expectedStatus) {
    throw new Error(`${init?.method ?? 'GET'} ${pathname} expected ${expectedStatus}, received ${response.status}: ${body.error ?? JSON.stringify(body)}`);
  }
  return body as Record<string, any>;
};

try {
  const source = await query<any>(
    `select recipe_data from mixes
     where status in ('published', 'private')
       and jsonb_array_length(coalesce(recipe_data->'tracks', '[]'::jsonb)) > 0
     order by updated_at desc limit 1`,
  );
  if (!source.rows[0]) throw new Error('No audible frozen Work is available for the share transition validation.');

  await query(
    `insert into auth_sessions (id, token_hash, user_id, expires_at)
     values ($1, $2, 'user_serenity', now() + interval '5 minutes')`,
    [sessionId, tokenHash],
  );
  const created = await request('/api/mixes', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Share Visibility Transition Probe',
      description: 'Temporary validation Work.',
      status: 'private',
      recipeData: source.rows[0].recipe_data,
    }),
  }, 201);
  mixId = String(created.id);

  await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    body: JSON.stringify({ intent: 'tonight', visibility: 'public' }),
  }, 409);

  const published = await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'published' }),
  });
  if (published.status !== 'published') throw new Error('Private Work did not transition to published visibility.');

  const publicShare = await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    body: JSON.stringify({
      intent: 'tonight',
      visibility: 'public',
      title: 'Share Visibility Transition Probe',
    }),
  }, 201);
  if (publicShare.visibility !== 'public') throw new Error('The transitioned Work did not create a public share link.');

  console.log(JSON.stringify({
    passed: true,
    initialStatus: 'private',
    resultingStatus: published.status,
    shareVisibility: publicShare.visibility,
  }, null, 2));
} finally {
  if (mixId) await query('delete from mixes where id = $1', [mixId]);
  await query('delete from auth_sessions where id = $1', [sessionId]);
  await pool.end();
}
