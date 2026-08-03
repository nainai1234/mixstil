import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const PUBLIC_DIR = path.resolve('public');
let mixId = '';
let renderedAudioUrl = '';

const request = async (pathname: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE}${pathname}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${pathname}: ${body.error ?? response.statusText}`);
  return body;
};

try {
  const created = await request('/api/quick-create', { method: 'POST', body: JSON.stringify({ goal: 'focus', prompt: 'quiet ambient music for focused writing, no voice', durationSeconds: 300 }) });
  mixId = created.mix.id;
  const adjusted = await request(`/api/mixes/${mixId}/recipe-edits`, { method: 'POST', body: JSON.stringify({ instruction: 'make it quieter' }) });
  const adjustedVolumes = adjusted.mix.recipeData.tracks.map((track: any) => [track.stemId, track.volume]);
  const published = await request(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Quiet Writing Test', description: 'Deterministic publish-loop validation.', status: 'published', recipeData: adjusted.mix.recipeData }),
  });
  if (!published.publishedVersionId || published.recipeData.versionState !== 'frozen') throw new Error('Published mix did not freeze Recipe V2.');
  const frozenVolumes = published.recipeData.tracks.map((track: any) => [track.stemId, track.volume]);
  if (JSON.stringify(adjustedVolumes) !== JSON.stringify(frozenVolumes)) throw new Error('Frozen Recipe lost the user adjustment.');
  const rendered = await request(`/api/mixes/${mixId}/render`, { method: 'POST', body: '{}' });
  renderedAudioUrl = rendered.renderedAudioUrl;
  if (!renderedAudioUrl || rendered.mix.renderStatus !== 'ready') throw new Error('Frozen Recipe did not render.');
  const shared = await request(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    body: JSON.stringify({ intent: 'tonight', visibility: 'public', title: 'Quiet Writing Test' }),
  });
  if (shared.recipeVersionId !== published.publishedVersionId) throw new Error('Share link did not bind to the frozen Recipe V2 version.');
  const sharedPayload = await request(`/api/share-links/${shared.slug}`);
  if (sharedPayload.shareLink.recipeVersionId !== published.publishedVersionId || sharedPayload.tracks.length === 0) {
    throw new Error('Recipient share payload did not preserve the frozen playable version.');
  }
  const fetched = await request(`/api/mixes/${mixId}`);
  if (fetched.mix.publishedVersionId !== published.publishedVersionId || fetched.mix.renderedAudioUrl !== renderedAudioUrl || fetched.mix.shareClicks < 1) {
    throw new Error('Public fetch did not preserve the frozen rendered version.');
  }
  console.log(JSON.stringify({ passed: true, mixId, publishedVersionId: published.publishedVersionId, renderedAudioUrl, shareSlug: shared.slug, shareClicks: fetched.mix.shareClicks }, null, 2));
} finally {
  if (mixId) await query('delete from mixes where id = $1', [mixId]);
  if (renderedAudioUrl.startsWith('/exports/')) await unlink(path.join(PUBLIC_DIR, renderedAudioUrl)).catch(() => undefined);
  await pool.end();
}
