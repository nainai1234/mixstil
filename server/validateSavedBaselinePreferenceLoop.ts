import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';

type Json = Record<string, any>;

let authToken = '';
let userId = '';
const mixIds: string[] = [];

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
  const guest = await request<Json>('/api/auth/guest', { method: 'POST', body: '{}' });
  authToken = String(guest.token ?? '');
  userId = String(guest.user?.id ?? '');
  assert(authToken && userId, 'Guest auth did not return a user and token.');
  await query("update users set subscription_tier = 'pro' where id = $1", [userId]);

  const savedCandidate = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '睡前总是忍不住刷手机，想放下手机慢慢安静下来',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  const savedMixId = String(savedCandidate.mix?.id ?? '');
  const savedSeed = String(savedCandidate.planning?.internalBaselineSeed ?? '');
  mixIds.push(savedMixId);
  assert(savedMixId, 'Initial Quick Create did not return a mix id.');
  assert(savedSeed.startsWith('sleep_'), 'Initial saved candidate did not select a sleep baseline seed.');
  assert(savedSeed.includes('phone_down'), 'Initial saved candidate should select the phone-down bedtime baseline for this validation.');
  assert(savedCandidate.mix?.recipeData?.quickCreate?.internalBaselineMatch?.seedId === savedSeed, 'Initial candidate did not retain baseline match metadata.');

  const saved = await request<Json>(`/api/mixes/${savedMixId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'private',
      recipeData: savedCandidate.mix.recipeData,
    }),
  });
  assert(saved.status === 'private', 'Saved baseline did not become a private My Sounds item.');
  assert(saved.publishedVersionId, 'Saved baseline did not freeze a Recipe version.');

  const profile = await request<Json>('/api/me/sound-profile');
  const savedEvidence = (profile.evidence ?? []).find((item: Json) => (
    item.source === 'saved_sound'
      && item.kind === 'like'
      && item.value === `internal_baseline:${savedSeed}`
      && item.mixId === savedMixId
  ));
  assert(savedEvidence, 'Saving a baseline did not create saved_sound preference evidence.');
  assert(savedEvidence.details?.internalBaselineMatch?.seedId === savedSeed, 'Saved preference evidence lost baseline metadata.');

  const genericAfterSave = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '今晚睡前想安静下来，给我一个适合保存复听的声音',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(genericAfterSave.mix?.id ?? ''));
  assert(genericAfterSave.planning?.internalBaselineSeed === savedSeed, 'Saved baseline preference did not influence the next similar sleep request.');
  assert(genericAfterSave.planning?.savedBaselinePreferenceApplied === true, 'Quick Create did not report saved baseline preference application.');

  await request<Json>(`/api/me/preference-evidence/${savedEvidence.id}`, { method: 'DELETE' });

  const genericAfterRemoval = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '今晚睡前想安静下来，给我一个适合保存复听的声音',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(genericAfterRemoval.mix?.id ?? ''));
  assert(genericAfterRemoval.planning?.savedBaselinePreferenceApplied !== true, 'Removed saved baseline preference still reports as applied.');
  assert(genericAfterRemoval.planning?.internalBaselineSeed !== savedSeed, 'Removed saved baseline preference still controls the next similar request.');

  const returnToSleep = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '半夜醒来以后想重新入睡',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(returnToSleep.mix?.id ?? ''));
  assert(returnToSleep.planning?.internalBaselineSeed !== savedSeed, 'Saved baseline preference overrode a clearly different return-to-sleep request.');
  assert(String(returnToSleep.planning?.internalBaselineSeed ?? '').includes('return_sleep'), 'Return-to-sleep request no longer maps to its specific baseline.');

  const noMusic = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: '睡前只要柔和粉噪音，不要音乐和人声',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixIds.push(String(noMusic.mix?.id ?? ''));
  assert(noMusic.planning?.internalBaselineSeed === null, 'Saved baseline preference overrode an explicit no-music exclusion.');

  console.log(JSON.stringify({
    passed: true,
    savedSeed,
    savedEvidence: {
      source: savedEvidence.source,
      kind: savedEvidence.kind,
      value: savedEvidence.value,
      stable: savedEvidence.stable,
    },
    similarRequestSelectedSavedSeed: genericAfterSave.planning?.internalBaselineSeed === savedSeed,
    removalStoppedSavedPreference: genericAfterRemoval.planning?.internalBaselineSeed !== savedSeed,
    explicitDifferentSceneStillSpecific: returnToSleep.planning?.internalBaselineSeed,
    explicitNoMusicBypass: noMusic.planning?.internalBaselineSeed === null,
  }, null, 2));
} finally {
  for (const mixId of mixIds.filter(Boolean)) {
    await query('delete from playback_events where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from mixes where id = $1', [mixId]).catch(() => undefined);
  }
  if (userId) await query('delete from users where id = $1', [userId]).catch(() => undefined);
  await pool.end();
}
