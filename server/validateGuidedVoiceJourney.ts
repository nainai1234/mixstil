import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const mixIds: string[] = [];
const generatedAudioUrls: string[] = [];

const request = async (pathname: string, init?: RequestInit, expectedStatus?: number) => {
  const response = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (expectedStatus != null ? response.status !== expectedStatus : !response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${pathname} returned ${response.status}: ${body.error ?? JSON.stringify(body)}`);
  }
  return body;
};

try {
  const guided = await request('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      goal: 'sleep',
      scene: 'bedtime',
      prompt: '轻柔雨声帮助入睡，需要简短中文引导',
      durationSeconds: 300,
      guidedVoice: true,
      voiceIntensity: 45,
    }),
  });
  const guidedMixId = String(guided.mix?.id ?? '');
  if (!guidedMixId) throw new Error('Guided Quick Create did not return a mix id.');
  mixIds.push(guidedMixId);
  if (guided.mix.recipeData.tracks.some((track: any) => track.role === 'voice')) {
    throw new Error('Quick Create blocked on voice instead of returning the immediate voice-free Recipe.');
  }

  const ensured = await request(`/api/mixes/${guidedMixId}/voice-preview/ensure`, { method: 'POST' });
  if (ensured.status !== 'ready' || !ensured.stemId || !ensured.audioUrl) {
    throw new Error(`Controlled voice preview was not generated: ${JSON.stringify(ensured)}`);
  }
  generatedAudioUrls.push(ensured.audioUrl);
  const voiceTrack = ensured.mix.recipeData.tracks.find((track: any) => track.role === 'voice');
  if (!voiceTrack || voiceTrack.stemId !== ensured.stemId || voiceTrack.loop?.enabled) {
    throw new Error('Generated voice was not inserted as a non-looping Recipe V2 voice track.');
  }
  if (!ensured.mix.recipeData.ducking?.some((rule: any) => rule.triggerRole === 'voice' && rule.targetRoles.includes('environment'))) {
    throw new Error('Generated voice did not add Recipe V2 background ducking.');
  }
  const voicePlan = ensured.mix.recipeData.voicePlan;
  if (!voicePlan || voicePlan.cues.length < 1 || voicePlan.exitAtSeconds <= voiceTrack.startTime) {
    throw new Error('Generated voice did not persist a reproducible sentence-level voice plan.');
  }
  if (voicePlan.cues.slice(0, -1).some((cue: any) => cue.pauseAfterSeconds < 3)) {
    throw new Error('Meditation voice plan did not preserve deliberate between-sentence pauses.');
  }

  const repeated = await request(`/api/mixes/${guidedMixId}/voice-preview/ensure`, { method: 'POST' });
  if (!repeated.existing || repeated.stemId !== ensured.stemId) {
    throw new Error('Repeated ensure did not reuse the existing controlled voice preview.');
  }
  const jobCount = await query<{ count: string }>('select count(*)::text as count from tts_jobs where mix_id = $1', [guidedMixId]);
  if (Number(jobCount.rows[0]?.count) !== 1) throw new Error('Idempotent ensure created duplicate TTS jobs.');

  const exportCheck = await request(`/api/mixes/${guidedMixId}/export-check`);
  const blockedVoice = exportCheck.blockedStems?.find((stem: any) => stem.stemId === ensured.stemId);
  if (exportCheck.exportReady || !blockedVoice?.reasons?.includes('qa_needs_review')) {
    throw new Error('Voice preview bypassed the production export QA gate.');
  }

  const fallback = await request('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      goal: 'focus',
      scene: 'deep_focus',
      prompt: 'steady focus sound with a short guide',
      durationSeconds: 300,
      guidedVoice: true,
    }),
  });
  const fallbackMixId = String(fallback.mix?.id ?? '');
  if (!fallbackMixId) throw new Error('Fallback Quick Create did not return a mix id.');
  mixIds.push(fallbackMixId);
  const fallbackTrackIds = fallback.mix.recipeData.tracks.map((track: any) => track.stemId).sort();
  const fallbackResult = await request(`/api/mixes/${fallbackMixId}/voice-preview/ensure`, { method: 'POST' }, 400);
  if (fallbackResult.fallback !== 'voice_off') throw new Error('Failed voice generation did not declare voice_off fallback.');
  const fallbackAfter = await request(`/api/mixes/${fallbackMixId}`);
  const fallbackAfterTrackIds = fallbackAfter.mix.recipeData.tracks.map((track: any) => track.stemId).sort();
  if (JSON.stringify(fallbackAfterTrackIds) !== JSON.stringify(fallbackTrackIds)) {
    throw new Error('Voice failure changed the playable voice-free Recipe.');
  }

  console.log(JSON.stringify({
    passed: true,
    immediateVoiceFreeTrackCount: guided.mix.recipeData.tracks.length,
    generatedVoiceStemId: ensured.stemId,
    duplicateEnsureReusedStem: repeated.stemId === ensured.stemId,
    exportBlockedPendingVoiceQa: true,
    unsupportedSceneFallback: fallbackResult.fallback,
  }, null, 2));
} finally {
  if (mixIds.length > 0) {
    const stems = await query<{ id: string; audio_url: string }>(
      `select id, audio_url from audio_stems where source_item_id in (
         select id from tts_jobs where mix_id = any($1)
       )`,
      [mixIds],
    );
    generatedAudioUrls.push(...stems.rows.map((row) => row.audio_url));
    if (stems.rows.length > 0) await query('delete from audio_stems where id = any($1)', [stems.rows.map((row) => row.id)]);
    await query('delete from user_history where mix_id = any($1)', [mixIds]);
    await query('delete from ai_sessions where generated_mix_id = any($1)', [mixIds]);
    await query('delete from mixes where id = any($1)', [mixIds]);
  }
  for (const audioUrl of new Set(generatedAudioUrls)) {
    if (audioUrl.startsWith('/audio/voice/generated/')) {
      await unlink(path.join(PUBLIC_DIR, audioUrl)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
  await pool.end();
}
