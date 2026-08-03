import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');

type JsonObject = Record<string, any>;

const request = async <T extends JsonObject>(pathname: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${pathname} failed (${response.status}): ${body.error ?? JSON.stringify(body)}`);
  return body as T;
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let mixId = '';
let renderedAudioUrl = '';

try {
  const created = await request('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      goal: 'calm',
      prompt: '我需要真实的冥想音乐，帮助我快速安静下来，不要人声',
      durationSeconds: 300,
      guidedVoice: false,
      musicIntensity: 35,
      voiceIntensity: 0,
    }),
  });

  mixId = String(created.mix?.id ?? '');
  assert(mixId, 'Quick Create did not return a mix id.');
  assert(created.mix.recipeData?.schemaVersion === 2, 'Quick Create did not persist Recipe V2.');
  assert(created.audioIntent?.contentMode === 'functional_music', 'Meditation music request did not resolve to functional_music.');
  assert(created.audioIntent?.preferredConceptIds?.includes('source.music.meditation') || created.audioIntent?.requiredConceptIds?.includes('source.music.meditation'), 'Meditation music concept was not preserved.');

  const selectedStemIds = (created.planning?.selected ?? []).map((item: JsonObject) => item.stemId);
  assert(selectedStemIds.some((id: string) => id.startsWith('stem_batch07_fma_holizna_')), `Quick Create did not select Batch 07 meditation music: ${selectedStemIds.join(', ')}`);
  assert(created.mix.recipeData.tracks.some((track: JsonObject) => selectedStemIds.includes(track.stemId)), 'Selected Batch 07 stem was not persisted into Recipe V2 tracks.');

  await Promise.all((created.tracks ?? []).map(async (track: JsonObject) => {
    const response = await fetch(`${API_BASE}${track.url}`, { method: 'HEAD' });
    assert(response.ok, `Stem ${track.stemId ?? track.name} is not reachable (${response.status}).`);
  }));

  const exportCheck = await request(`/api/mixes/${mixId}/export-check`);
  assert(exportCheck.exportReady, `Batch 07 recipe failed export checks: ${JSON.stringify(exportCheck.blockedStems)}`);

  const published = await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: 'Batch 07 Meditation Music Validation',
      description: 'Temporary validation for approved Batch 07 meditation music routing.',
      status: 'published',
      recipeData: created.mix.recipeData,
    }),
  });
  assert(published.publishedVersionId, 'Publishing did not freeze a recipe version.');
  assert(published.recipeData?.versionState === 'frozen', 'Published recipe is not frozen.');

  const rendered = await request(`/api/mixes/${mixId}/render`, { method: 'POST' });
  renderedAudioUrl = String(rendered.renderedAudioUrl ?? '');
  assert(renderedAudioUrl, 'Render did not return an audio URL.');
  assert(rendered.mix?.renderStatus === 'ready', 'Rendered mix is not ready.');
  assert(rendered.qaReport?.passed, 'Rendered Batch 07 mix failed automatic technical QA.');

  const download = await fetch(`${API_BASE}/api/mixes/${mixId}/download`, { method: 'HEAD' });
  assert(download.ok, `Rendered Batch 07 work is not downloadable (${download.status}).`);

  console.log(JSON.stringify({
    passed: true,
    mixId,
    selectedStemIds,
    contentMode: created.audioIntent.contentMode,
    renderedAudioUrl,
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
  await pool.end();
}
