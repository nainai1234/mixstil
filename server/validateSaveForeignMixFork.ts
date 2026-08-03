import { pool } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

let authToken = '';
let userId = '';
let savedMixId = '';

const request = async <T>(path: string, init: RequestInit = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${response.status} ${payload?.error ?? response.statusText}`);
  }
  return payload as T;
};

const main = async () => {
  const guest = await request<{ token: string; user: { id: string } }>('/api/auth/guest', {
    method: 'POST',
    body: '{}',
  });
  authToken = guest.token;
  userId = guest.user.id;

  const currentUser = await request<{ id: string }>('/api/me');
  const foreignMix = await request<{
    mix: {
      id: string;
      creatorId: string;
      recipeData: Record<string, unknown>;
    };
  }>('/api/mixes/mix_ocean_calm');

  if (foreignMix.mix.creatorId === currentUser.id) {
    throw new Error('Fixture mix_ocean_calm must belong to another creator for this regression.');
  }

  const saved = await request<{
    id: string;
    creatorId: string;
    title: string;
    status: string;
    publishedVersionId: string | null;
    recipeData: Record<string, unknown>;
  }>('/api/mixes', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Forked Ocean Save Regression',
      description: 'Regression coverage for saving a foreign example mix as a new owned work.',
      status: 'published',
      recipeData: foreignMix.mix.recipeData,
    }),
  });
  savedMixId = saved.id;

  if (saved.id === foreignMix.mix.id) throw new Error('Foreign mix was updated instead of forked.');
  if (saved.creatorId !== currentUser.id) throw new Error('Forked work was not assigned to the current user.');
  if (saved.status !== 'published') throw new Error('Forked work was not published.');
  if (!saved.publishedVersionId) throw new Error('Forked publish did not freeze a recipe version.');
  if (saved.recipeData.versionState !== 'frozen') throw new Error('Forked publish recipe is not frozen.');

  console.log(JSON.stringify({
    passed: true,
    sourceMixId: foreignMix.mix.id,
    sourceCreatorId: foreignMix.mix.creatorId,
    savedMixId: saved.id,
    savedCreatorId: saved.creatorId,
    publishedVersionId: saved.publishedVersionId,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (savedMixId) await pool.query('delete from mixes where id = $1', [savedMixId]).catch(() => undefined);
    if (userId) {
      await pool.query('delete from preference_evidence where user_id = $1', [userId]).catch(() => undefined);
      await pool.query('delete from users where id = $1', [userId]).catch(() => undefined);
    }
    await pool.end();
  });
