import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

type Json = Record<string, any>;

let authToken = '';
let userId = '';
let mixId = '';

const request = async <T extends Json>(pathname: string, init?: RequestInit): Promise<T> => {
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
  const playerSource = await readFile(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');
  const createSource = await readFile(path.join(root, 'src/pages/AIHealPage.tsx'), 'utf8');
  assert(playerSource.includes('Why this sound'), 'Player page must visibly explain why the sound was selected.');
  assert(playerSource.includes('internalBaselineMatch?.matchReason'), 'Player page must display the internal baseline match reason.');
  assert(playerSource.includes('internalBaselineSeed'), 'Player save telemetry must include internalBaselineSeed.');
  assert(createSource.includes('internalBaselineSeed: generated.planning.internalBaselineSeed'), 'Create recipe_ready telemetry must include internalBaselineSeed.');

  const guest = await request<Json>('/api/auth/guest', { method: 'POST', body: '{}' });
  authToken = String(guest.token ?? '');
  userId = String(guest.user?.id ?? '');
  assert(authToken && userId, 'Guest auth did not return a user and token.');

  const journeyId = `baseline_loop_${Date.now()}`;
  const created = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '晚上总是睡不好，也有点焦虑，希望能更容易安静下来',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixId = String(created.mix?.id ?? '');
  assert(mixId, 'Quick Create did not return a mix id.');
  assert(String(created.planning?.internalBaselineSeed ?? '').startsWith('sleep_'), 'Quick Create did not select a sleep internal baseline seed.');
  assert(String(created.mix?.recipeData?.quickCreate?.recipeId ?? '').startsWith('content-baseline-'), 'Recipe does not retain the content-baseline recipe id.');
  assert(String(created.mix?.recipeData?.quickCreate?.internalBaselineMatch?.matchReason ?? '').includes('save/replay baseline'), 'Recipe does not retain a user-facing baseline match reason.');
  assert(created.mix?.recipeData?.tracks?.length >= 2, 'Baseline recipe should expose a layered soundscape.');
  assert(created.mix?.recipeData?.tracks?.some((track: Json) => track.role === 'base'), 'Baseline recipe should include a support layer.');
  assert(created.mix?.recipeData?.tracks?.some((track: Json) => String(track.stemId).startsWith('stem_content_baseline_')), 'Baseline recipe did not keep a content-baseline main stem.');
  assert(String(created.tracks?.[0]?.url ?? '').startsWith('/audio/content-baseline/'), 'Playable track does not point to content-baseline audio.');

  await request<Json>(`/api/mixes/${mixId}/playback-events`, {
    method: 'POST',
    body: JSON.stringify({
      journeyId,
      events: [{
        type: 'work_saved',
        elapsedMs: 1000,
        details: { destination: 'my_sounds', access: 'private', internalBaselineSeed: created.planning.internalBaselineSeed },
      }],
    }),
  });

  const saved = await request<Json>(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'private',
      recipeData: created.mix.recipeData,
    }),
  });
  assert(saved.status === 'private', 'Saved baseline mix did not become private.');
  assert(saved.publishedVersionId, 'Saving to My Sounds did not freeze a recipe version.');
  assert(saved.recipeData?.versionState === 'frozen', 'Saved baseline recipe is not frozen.');
  assert(String(saved.recipeData?.quickCreate?.recipeId ?? '').startsWith('content-baseline-'), 'Saved recipe lost its baseline recipe id.');
  assert(String(saved.recipeData?.quickCreate?.internalBaselineMatch?.matchReason ?? '').includes('save/replay baseline'), 'Saved recipe lost the baseline match reason.');

  const fetched = await request<Json>(`/api/mixes/${mixId}`);
  assert(fetched.mix?.status === 'private', 'Saved baseline mix is not fetchable as a private My Sounds item.');
  assert(String(fetched.mix?.recipeData?.quickCreate?.recipeId ?? '').startsWith('content-baseline-'), 'Fetched saved mix lost baseline metadata.');

  const eventRows = await query<{ details: Json }>(
    `select details from playback_events
     where mix_id = $1 and journey_id = $2 and event_type = 'work_saved'
     order by created_at desc limit 1`,
    [mixId, journeyId],
  );
  assert(eventRows.rows[0]?.details?.internalBaselineSeed === created.planning.internalBaselineSeed, 'work_saved telemetry did not persist internalBaselineSeed.');

  const noMusic = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '睡前只要柔和粉噪音，不要音乐和人声',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  assert(noMusic.planning?.internalBaselineSeed === null, 'Explicit no-music request was incorrectly routed to the internal baseline.');

  console.log(JSON.stringify({
    passed: true,
    mixId,
    internalBaselineSeed: created.planning.internalBaselineSeed,
    savedStatus: saved.status,
    recipeVersionId: saved.publishedVersionId,
    noMusicBypass: noMusic.planning?.internalBaselineSeed === null,
  visiblePlayerLabel: true,
  matchReason: created.mix.recipeData.quickCreate.internalBaselineMatch.matchReason,
  }, null, 2));
} finally {
  if (mixId) {
    await query('delete from playback_events where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from mixes where id = $1', [mixId]).catch(() => undefined);
  }
  if (userId) await query('delete from users where id = $1', [userId]).catch(() => undefined);
  await pool.end();
}
