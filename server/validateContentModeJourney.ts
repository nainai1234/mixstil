import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const createdMixIds: string[] = [];

const cases = [
  {
    expected: 'pure_soundscape',
    body: { prompt: '只要轻雨和棕噪音，不要音乐也不要人声', goal: 'sleep', durationSeconds: 300 },
  },
  {
    expected: 'functional_music',
    body: { prompt: '用于专注工作的稳定氛围音乐，不要人声', goal: 'focus', durationSeconds: 300 },
  },
  {
    expected: 'sound_journey',
    body: { prompt: '从篝火环境慢慢过渡到柔和音乐的疗愈声音旅程', goal: 'calm', durationSeconds: 300 },
  },
  {
    expected: 'guided_meditation',
    body: { prompt: '带中文引导的呼吸冥想', goal: 'calm', guidedVoice: true, durationSeconds: 300 },
  },
] as const;

try {
  for (const testCase of cases) {
    const response = await fetch(`${API_BASE}/api/quick-create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(testCase.body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`${testCase.expected}: ${payload.error ?? response.statusText}`);
    createdMixIds.push(payload.mix.id);
    if (payload.audioIntent?.contentMode !== testCase.expected) {
      throw new Error(`${testCase.expected}: AudioIntent returned ${payload.audioIntent?.contentMode}`);
    }
    if (payload.mix?.recipeData?.contentMode !== testCase.expected) {
      throw new Error(`${testCase.expected}: Recipe V2 returned ${payload.mix?.recipeData?.contentMode}`);
    }
  }
  console.log(`Content mode journey validation passed for ${cases.length} modes.`);
} finally {
  if (createdMixIds.length > 0) {
    await query('delete from mixes where id = any($1)', [createdMixIds]);
  }
  await pool.end();
}
