import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');

type JsonObject = Record<string, any>;
let authToken = '';

const request = async <T extends JsonObject | JsonObject[]>(pathname: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(authToken ? { authorization: `Bearer ${authToken}` } : {}), ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  }
  return body as T;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let mixId = '';
let renderedAudioUrl = '';
let validationUserId = '';

try {
  const guest = await request<JsonObject>('/api/auth/guest', { method: 'POST' });
  authToken = String(guest.token ?? '');
  validationUserId = String(guest.user?.id ?? '');
  assert(authToken, 'Validation guest session was not created.');
  const startedAt = performance.now();
  const created = await request<JsonObject>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Gentle rain and soft brown noise for deep sleep, no sudden sounds and no voice',
      durationSeconds: 300,
      guidedVoice: false,
      environmentIntensity: 42,
      musicIntensity: 20,
      voiceIntensity: 0,
    }),
  });
  const quickCreateMs = Math.round(performance.now() - startedAt);
  mixId = String(created.mix?.id ?? '');
  assert(mixId, 'Quick Create did not return a mix id.');
  assert(created.mix.recipeData?.schemaVersion === 2, 'Quick Create did not persist Recipe V2.');
  assert(created.mix.recipeData?.versionState === 'live', 'Quick Create should return a live recipe.');
  assert(created.audioIntent?.scene === 'bedtime', 'Prompt did not resolve to the bedtime scene.');
  assert(created.audioIntent?.excludedSounds?.includes('voice'), 'Prompt exclusion for voice was not preserved.');
  assert(created.tracks?.length >= 2, 'Quick Create returned too few playable layers.');
  assert(created.mix.recipeData.tracks.every((track: JsonObject) => Number(track.sourceGainDb ?? 0) === 0), 'Quick Create applied a legacy source boost after acoustic normalization.');

  await Promise.all(created.tracks.map(async (track: JsonObject) => {
    const response = await fetch(`${API_BASE}${track.url}`, { method: 'HEAD' });
    assert(response.ok, `Stem ${track.stemId ?? track.name} is not reachable (${response.status}).`);
  }));

  const originalEnvironment = created.mix.recipeData.tracks.find((track: JsonObject) => track.role === 'environment');
  const originalBase = created.mix.recipeData.tracks.find((track: JsonObject) => track.role === 'base');
  assert(originalEnvironment && originalBase, 'Validation recipe is missing its base or environment layer.');

  const edited = await request<JsonObject>(`/api/mixes/${mixId}/recipe-edits`, {
    method: 'POST',
    body: JSON.stringify({ instruction: '环境声小一点' }),
  });
  const editedEnvironment = edited.mix.recipeData.tracks.find((track: JsonObject) => track.role === 'environment');
  const editedBase = edited.mix.recipeData.tracks.find((track: JsonObject) => track.role === 'base');
  assert(edited.edit?.operation === 'decrease_environment', 'Scoped edit did not select decrease_environment.');
  assert(editedEnvironment.volume < originalEnvironment.volume, 'Scoped edit did not lower the environment layer.');
  assert(editedBase.volume === originalBase.volume, 'Scoped edit changed the unrelated base layer.');

  const undone = await request<JsonObject>(`/api/mixes/${mixId}/recipe-edits/undo`, { method: 'POST' });
  const restoredEnvironment = undone.mix.recipeData.tracks.find((track: JsonObject) => track.role === 'environment');
  const restoredBase = undone.mix.recipeData.tracks.find((track: JsonObject) => track.role === 'base');
  assert(restoredEnvironment.volume === originalEnvironment.volume, 'Undo did not restore the environment layer.');
  assert(restoredBase.volume === originalBase.volume, 'Undo changed the unrelated base layer.');

  const published = await request<JsonObject>(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Mainline Journey Validation',
      description: 'Temporary end-to-end Recipe V2 validation.',
      status: 'published',
      recipeData: undone.mix.recipeData,
    }),
  });
  assert(published.status === 'published', 'Mix was not published.');
  assert(published.publishedVersionId, 'Publishing did not freeze a recipe version.');
  assert(published.recipeData?.versionState === 'frozen', 'Published recipe is not frozen.');

  const versions = await request<JsonObject[]>(`/api/mixes/${mixId}/versions`);
  assert(versions.length === 1 && versions[0].isCurrent, 'Published recipe version is missing or not current.');
  assert(versions[0].recipeData?.randomSeed === published.recipeData.randomSeed, 'Frozen version changed the deterministic seed.');

  const exportCheck = await request<JsonObject>(`/api/mixes/${mixId}/export-check`);
  assert(exportCheck.exportReady, `Approved recipe failed export checks: ${JSON.stringify(exportCheck.blockedStems)}`);

  const rendered = await request<JsonObject>(`/api/mixes/${mixId}/render`, { method: 'POST' });
  renderedAudioUrl = String(rendered.renderedAudioUrl ?? '');
  assert(renderedAudioUrl, 'Render did not return an audio URL.');
  assert(rendered.mix?.renderStatus === 'ready', 'Rendered mix is not ready.');
  assert(rendered.qaReport?.passed, 'Rendered mix failed automatic technical QA.');
  assert(Math.abs(Number(rendered.qaReport.durationSeconds) - 300) < 1, 'Rendered duration differs from Recipe V2 by more than one second.');

  const download = await fetch(`${API_BASE}/api/mixes/${mixId}/download`, { method: 'HEAD' });
  assert(download.ok, `Rendered work is not downloadable (${download.status}).`);

  console.log(JSON.stringify({
    passed: true,
    quickCreateMs,
    mixId,
    scene: created.audioIntent.scene,
    trackCount: created.tracks.length,
    recipeVersionId: published.publishedVersionId,
    renderDurationSeconds: rendered.qaReport.durationSeconds,
    automaticQaPassed: rendered.qaReport.passed,
  }, null, 2));
} finally {
  if (mixId) {
    const stored = await query<{ rendered_audio_url: string }>('select rendered_audio_url from mixes where id = $1', [mixId]);
    renderedAudioUrl ||= stored.rows[0]?.rendered_audio_url ?? '';
    await query('delete from user_history where mix_id = $1', [mixId]);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]);
    await query('delete from mixes where id = $1', [mixId]);
  }
  if (renderedAudioUrl.startsWith('/exports/')) {
    await unlink(path.join(PUBLIC_DIR, renderedAudioUrl)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  if (validationUserId) await query('delete from users where id = $1', [validationUserId]);
  await pool.end();
}
