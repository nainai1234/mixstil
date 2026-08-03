import { query, pool } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const cases = [
  {
    id: 'healing_compare_guided_meditation',
    label: 'guided_meditation',
    body: {
      prompt: '带中文轻声引导的睡前放松，前段引导，后段留白和极轻背景，不要持续讲话',
      goal: 'sleep', scene: 'bedtime', durationSeconds: 600, guidedVoice: true, voiceIntensity: 28,
    },
    script: '请让身体慢慢安静下来。\n不需要完成任何事情。\n每一次呼吸，都让你更靠近休息。',
  },
  {
    id: 'healing_compare_sound_journey',
    label: 'sound_journey',
    body: {
      prompt: '先听很轻的森林自然声，再慢慢进入柔和音乐，最后回到平静留白的声音旅程',
      goal: 'calm', scene: 'emotional_settling', durationSeconds: 600,
    },
  },
  {
    id: 'healing_compare_pure_soundscape',
    label: 'pure_soundscape',
    body: {
      prompt: '只要温和的雨声和柔和底噪，不要音乐，不要人声，不要明显雷声',
      goal: 'sleep', scene: 'bedtime', durationSeconds: 600,
    },
  },
  {
    id: 'healing_compare_asmr_no_talking',
    label: 'asmr_no_talking',
    body: {
      prompt: '无人声睡眠 ASMR，低动态雨声、火焰和很少的柔和点缀，不要音乐',
      goal: 'sleep', scene: 'return_to_sleep', durationSeconds: 600,
    },
  },
] as const;

const postJson = async (path: string, body: unknown) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${payload.error ?? response.statusText}`);
  return payload;
};

const run = async () => {
  const output: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    const created = await postJson('/api/quick-create', item.body);
    const mixId = item.id;
    await query('delete from mixes where id = $1', [mixId]);
    await query(
      `update mixes set id = $1, title = $2, description = $3, updated_at = now() where id = $4`,
      [mixId, `Internal healing comparison · ${item.label}`, `Internal-only YouTube-informed structure comparison (${item.label}).`, created.mix.id],
    );
    let mix = created.mix;
    if ('script' in item) {
      const voice = await postJson(`/api/mixes/${mixId}/voice-generation`, {
        language: 'zh', scriptText: item.script,
      });
      mix = voice.mix ?? mix;
    }
    let renderedAudioUrl = '';
    let renderNote = '';
    try {
      const rendered = await postJson(`/api/mixes/${mixId}/render`, {});
      renderedAudioUrl = rendered.renderedAudioUrl;
    } catch (error) {
      // Internal voice previews intentionally remain non-publishable until rights QA passes.
      renderNote = error instanceof Error ? error.message : String(error);
    }
    output.push({ label: item.label, mixId, contentMode: mix.recipeData?.contentMode, audioUrl: renderedAudioUrl, renderNote });
  }
  console.log(JSON.stringify(output, null, 2));
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
