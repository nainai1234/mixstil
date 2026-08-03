import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
let mixId = '';

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${body.error ?? response.statusText}`);
  return body;
};

try {
  const created = await request('/api/quick-create', { method: 'POST', body: JSON.stringify({ goal: 'focus', scene: 'deep_focus', prompt: 'quiet ambient music for deep work, no voice', durationSeconds: 300 }) });
  mixId = created.mix.id;
  const before = created.mix.recipeData.tracks.map((track: any) => ({ stemId: track.stemId, role: track.role, volume: track.volume, isMuted: track.isMuted }));
  const adjusted = await request(`/api/mixes/${mixId}/recipe-edits`, { method: 'POST', body: JSON.stringify({ instruction: 'make it quieter' }) });
  const after = adjusted.mix.recipeData.tracks.map((track: any) => ({ stemId: track.stemId, role: track.role, volume: track.volume, isMuted: track.isMuted }));
  if (before.length !== after.length) throw new Error('Adjustment changed track count.');
  if (before.some((track: any, index: number) => track.stemId !== after[index].stemId || track.role !== after[index].role || track.isMuted !== after[index].isMuted)) {
    throw new Error('Volume-only adjustment changed track identity or mute state.');
  }
  if (!after.some((track: any, index: number) => track.volume < before[index].volume)) throw new Error('Volume-only adjustment did not lower a track.');
  const curved = await request(`/api/mixes/${mixId}/recipe-edits`, { method: 'POST', body: JSON.stringify({ instruction: 'make the music gradually louder' }) });
  const curvedTracks = curved.mix.recipeData.tracks;
  const curvedMusic = curvedTracks.find((track: any) => track.role === 'music');
  if (curved.edit.operation !== 'volume_rise_music' || curvedMusic?.volumeAutomation?.length !== 5) {
    throw new Error(`Natural-language curve adjustment did not create a five-point music rise: ${JSON.stringify({ operation: curved.edit.operation, tracks: curvedTracks.map((track: any) => ({ role: track.role, volume: track.volume, points: track.volumeAutomation?.length ?? 0 })) })}`);
  }
  if (!curvedMusic.volumeAutomation.every((point: any, index: number, points: any[]) => index === 0 || point.volume > points[index - 1].volume)) {
    throw new Error('Natural-language music rise is not monotonically increasing.');
  }
  if (curvedTracks.some((track: any) => track.role !== 'music' && JSON.stringify(track) !== JSON.stringify(adjusted.mix.recipeData.tracks.find((candidate: any) => candidate.stemId === track.stemId && candidate.role === track.role)))) {
    throw new Error('Natural-language music curve changed an unrelated track.');
  }
  const undone = await request(`/api/mixes/${mixId}/recipe-edits/undo`, { method: 'POST' });
  if (JSON.stringify(undone.mix.recipeData.tracks) !== JSON.stringify(adjusted.mix.recipeData.tracks)) {
    throw new Error('Undo did not restore the tracks from before the volume curve edit.');
  }
  const timingAdjusted = await request(`/api/mixes/${mixId}/recipe-edits`, { method: 'POST', body: JSON.stringify({ instruction: '音乐晚一点进入' }) });
  const beforeMusic = adjusted.mix.recipeData.tracks.find((track: any) => track.role === 'music');
  const timedMusic = timingAdjusted.mix.recipeData.tracks.find((track: any) => track.role === 'music');
  if (timingAdjusted.edit.operation !== 'start_later_music' || timedMusic?.startTime !== Number(beforeMusic?.startTime ?? 0) + 30) {
    throw new Error(`Natural-language timing adjustment did not delay music deterministically: ${JSON.stringify({ operation: timingAdjusted.edit.operation, before: beforeMusic, after: timedMusic })}`);
  }
  if (timedMusic.startTime + timedMusic.duration !== beforeMusic.startTime + beforeMusic.duration) {
    throw new Error('Natural-language timing adjustment did not preserve the music end time.');
  }
  if (timingAdjusted.mix.recipeData.tracks.some((track: any) => track.role !== 'music' && JSON.stringify(track) !== JSON.stringify(adjusted.mix.recipeData.tracks.find((candidate: any) => candidate.stemId === track.stemId && candidate.role === track.role)))) {
    throw new Error('Natural-language timing adjustment changed an unrelated track.');
  }
  const timingUndone = await request(`/api/mixes/${mixId}/recipe-edits/undo`, { method: 'POST' });
  if (JSON.stringify(timingUndone.mix.recipeData.tracks) !== JSON.stringify(adjusted.mix.recipeData.tracks)) {
    throw new Error('Undo did not restore the tracks from before the timing edit.');
  }
  console.log(JSON.stringify({
    passed: true,
    operations: [adjusted.edit.operation, curved.edit.operation, timingAdjusted.edit.operation],
    curve: curvedMusic.volumeAutomation,
    delayedMusic: { startTime: timedMusic.startTime, duration: timedMusic.duration },
    undoRestored: true,
  }, null, 2));
} finally {
  if (mixId) await query('delete from mixes where id = $1', [mixId]);
  await pool.end();
}
