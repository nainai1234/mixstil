import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
let authToken = '';
const cases = [
  { name: 'sleep-rain-no-voice', prompt: '睡前只要很轻的雨声和底噪，不要音乐，不要人声，不要雷声', goal: 'sleep', expectedMode: 'pure_soundscape' },
  { name: 'return-to-sleep-no-water', prompt: '半夜醒来想回睡，不要水声，不要鸟叫，只要低动态室内底噪', goal: 'sleep', expectedMode: 'pure_soundscape' },
  { name: 'calm-journey', prompt: '先用安静的森林环境让我慢慢稳定，再进入很轻的温暖音乐，最后留白', goal: 'calm', expectedMode: 'sound_journey' },
  { name: 'breathing-voice', prompt: '带中文轻声引导的呼吸放松，句子短，停顿多，音乐很轻', goal: 'calm', guidedVoice: true, expectedMode: 'sound_journey' },
  { name: 'focus-music', prompt: '专注工作用的稳定氛围音乐，不要人声，不要明显自然声', goal: 'focus', expectedMode: 'functional_music' },
  { name: 'focus-train', prompt: '像安静列车车厢一样的专注背景，不要旋律，不要说话', goal: 'focus', expectedMode: 'pure_soundscape' },
  { name: 'english-bedtime', prompt: 'Gentle indoor room tone for bedtime, no water, no voice, no music, very low stimulation', goal: 'sleep', expectedMode: 'pure_soundscape' },
  { name: 'english-guided', prompt: 'A slow guided meditation with short English phrases and long pauses', goal: 'calm', guidedVoice: true, expectedMode: 'sound_journey' },
  { name: 'prompt-only-guided', prompt: '睡前需要柔和的真人引导，短句和长停顿，背景音乐很轻', goal: 'sleep', expectedMode: 'functional_music' },
] as const;

const run = async () => {
  const createdIds: string[] = [];
  const results: Array<Record<string, unknown>> = [];
  try {
    const guestResponse = await fetch(`${API_BASE}/api/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' } });
    const guest = await guestResponse.json();
    if (!guestResponse.ok) throw new Error(`Could not create validation guest: ${guest.error ?? guestResponse.statusText}`);
    authToken = String(guest.token ?? '');
    if (!authToken) throw new Error('Creator loop validation guest did not return a token.');
    for (const item of cases) {
      const response = await fetch(`${API_BASE}/api/quick-create`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ ...item, durationSeconds: 300 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(`${item.name}: ${payload.error ?? response.statusText}`);
      const mixId = String(payload.mix?.id ?? '');
      if (!mixId) throw new Error(`${item.name}: missing mix id`);
      createdIds.push(mixId);
      const actualMode = payload.audioIntent?.contentMode ?? payload.mix?.recipeData?.contentMode;
      if (actualMode !== item.expectedMode) throw new Error(`${item.name}: expected ${item.expectedMode}, got ${actualMode}`);
      const excluded = payload.audioIntent?.excludedSounds ?? [];
      if (payload.audioIntent?.guidedVoice?.enabled !== false || payload.audioIntent?.intensity?.voice !== 0 || !excluded.includes('voice')) {
        throw new Error(`${item.name}: voice-free beta contract was not applied`);
      }
      if ((payload.mix?.recipeData?.tracks ?? []).some((track: any) => track.role === 'voice' && !track.isMuted && track.volume > 0)) {
        throw new Error(`${item.name}: voice-free beta returned an audible Voice track`);
      }
      const shouldExcludeWater = /water|水声/.test(item.prompt);
      if (shouldExcludeWater && !excluded.includes('water')) throw new Error(`${item.name}: water exclusion was lost`);
      results.push({ name: item.name, mixId, contentMode: actualMode, trackCount: payload.tracks?.length ?? 0, excluded });
    }
    console.log(JSON.stringify({ passed: true, cases: results }, null, 2));
  } finally {
    if (createdIds.length > 0) await query('delete from mixes where id = any($1)', [createdIds]);
    if (authToken) {
      await fetch(`${API_BASE}/api/me`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${authToken}`, 'x-confirm-account-deletion': 'DELETE' },
      }).catch(() => undefined);
    }
    await pool.end();
  }
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
