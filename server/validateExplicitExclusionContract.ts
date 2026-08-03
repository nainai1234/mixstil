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

const fail = (message: string): never => {
  throw new Error(`Explicit exclusion contract failed: ${message}`);
};

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
  if (!response.ok) fail(`${init?.method ?? 'GET'} ${pathname} returned ${response.status}: ${body.error ?? JSON.stringify(body)}`);
  return body as T;
};

try {
  const aiHeal = await readFile(path.join(root, 'src/pages/AIHealPage.tsx'), 'utf8');
  const soundGroups = await readFile(path.join(root, 'src/lib/soundGroupVolumes.ts'), 'utf8');
  if (aiHeal.includes('avoids ${label.toLowerCase()}') || aiHeal.includes('avoids no water')) {
    fail('Create avoid shortcut still produces ambiguous "avoids no ..." copy.');
  }
  for (const labelKey of ['avoid.water', 'avoid.rain', 'avoid.wind', 'avoid.voices', 'avoid.birds', 'avoid.music']) {
    if (!aiHeal.includes(`{ labelKey: '${labelKey}' }`)) {
      fail(`Create page is missing ${labelKey} hard-exclusion shortcut.`);
    }
  }
  if (soundGroups.includes('Rain, water, forest, room')) {
    fail('Player environment group still implies water even when the selected layer is not water.');
  }

  const guest = await request<Json>('/api/auth/guest', { method: 'POST', body: '{}' });
  authToken = String(guest.token ?? '');
  userId = String(guest.user?.id ?? '');
  if (!authToken || !userId) fail('Guest auth did not return a token and user id.');

  const created = await request<Json>('/api/quick-create', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Help me with a soundscape. No water. No rain. No wind. No voices. No birds. No music.',
      goal: 'sleep',
      durationSeconds: 900,
      guidedVoice: false,
    }),
  });
  mixId = String(created.mix?.id ?? '');
  if (!mixId) fail('Quick Create did not return a mix id.');

  const excludedSounds = new Set<string>(created.audioIntent?.excludedSounds ?? created.mix?.recipeData?.audioIntent?.excludedSounds ?? []);
  for (const excluded of ['water', 'rain', 'wind', 'voice', 'birds', 'music', 'ocean']) {
    if (!excludedSounds.has(excluded)) fail(`AudioIntent did not preserve ${excluded} as a hard exclusion.`);
  }
  if (created.audioIntent?.environmentPreferences?.some((item: string) => ['water', 'rain', 'wind', 'ocean'].includes(item))) {
    fail('AudioIntent promoted an excluded environment sound into preferences.');
  }

  const forbiddenPattern = /\b(water|rain|wind|ocean|sea|wave|river|stream|waterfall|bird|voice|vocal|music|melody)\b|水|雨|风|海|浪|河|溪|瀑|鸟|人声|音乐|旋律/i;
  const absencePattern = /\b(no|without|non)[ -]?(human )?(voice|vocal|music|melody|bird|water|rain|wind)\b/i;
  const trackEvidence = [
    ...(created.tracks ?? []).map((track: Json) => `${track.name ?? ''} ${(track.tags ?? []).join(' ')} ${track.url ?? ''}`),
    ...(created.mix?.recipeData?.moodTags ?? []),
  ];
  const offending = trackEvidence.find((text) => {
    const value = String(text);
    return forbiddenPattern.test(value) && !absencePattern.test(value);
  });
  if (offending) fail(`Generated result includes excluded sound evidence: ${offending}`);

  console.log(JSON.stringify({
    passed: true,
    mixId,
    excludedSounds: [...excludedSounds],
    tracks: (created.tracks ?? []).map((track: Json) => ({ stemId: track.stemId, name: track.name, role: track.role })),
    gates: [
      'create_avoid_shortcuts_are_unambiguous',
      'player_environment_group_does_not_imply_water',
      'audio_intent_preserves_water_rain_wind_voice_bird_music_exclusions',
      'generated_tracks_do_not_contain_excluded_sound_families',
    ],
  }, null, 2));
} finally {
  if (mixId) {
    await query('delete from playback_events where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from user_history where mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from ai_sessions where generated_mix_id = $1', [mixId]).catch(() => undefined);
    await query('delete from mixes where id = $1', [mixId]).catch(() => undefined);
  }
  if (userId) {
    await query('delete from preference_evidence where user_id = $1', [userId]).catch(() => undefined);
    await query('delete from users where id = $1', [userId]).catch(() => undefined);
  }
  await pool.end();
}
