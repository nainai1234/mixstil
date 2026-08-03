import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const cases = [
  ['sleep-rain', '睡前只要轻柔长雨和很低的底噪，不要音乐，不要人声，不要雷声', 'sleep', 'pure_soundscape'],
  ['sleep-no-water', '夜醒后回睡，不要水声、鸟叫和音乐，只要稳定室内底噪', 'sleep', 'pure_soundscape'],
  ['sleep-no-water-simple', '睡前，不要水声', 'sleep', 'pure_soundscape'],
  ['sleep-dry-music', '我想在睡觉之前得到一段干爽的、能够让我静下心来的音乐。这里面不要有水声。', 'sleep', 'functional_music'],
  ['sleep-music-late', '先安静下来，之后再慢慢进入很轻的温暖音乐，不要水声', 'sleep', 'sound_journey'],
  ['sleep-local-drone-journey', '睡前不要水声，希望先安静下来，再慢慢进入柔和、没有节拍的低沉音乐，20分钟，不要人声', 'sleep', 'sound_journey'],
  ['calm-breathing-zh', '中文轻声呼吸引导，短句，长停顿，背景很安静', 'calm', 'pure_soundscape'],
  ['calm-breathing-en', 'A slow English breathing guide with long pauses and a very quiet background.', 'calm', 'pure_soundscape'],
  ['calm-forest', '安静森林环境让我慢慢平静，最后留白，不要音乐', 'calm', 'pure_soundscape'],
  ['calm-no-rain', 'Help me settle after work with soft indoor ambience, no rain, no water.', 'calm', 'pure_soundscape'],
  ['focus-functional', '稳定、低音量的专注氛围音乐，不要人声，不要自然声', 'focus', 'functional_music'],
  ['focus-no-music', 'Focus background like a quiet train cabin, no music and no speaking.', 'focus', 'pure_soundscape'],
  ['focus-rain', 'Gentle low-stimulation rain for reading, no voice and no melody.', 'focus', 'pure_soundscape'],
  ['focus-office', 'A soft office room tone with a little warm music entering later.', 'focus', 'sound_journey'],
  ['focus-train-default-sleep', '列车或室内底噪专注', 'sleep', 'pure_soundscape', 'focus'],
  ['voice-sleep-zh', '睡前需要柔和的人声引导，句子短，最后人声退出', 'sleep', 'pure_soundscape'],
  ['voice-calm-en', 'Short spoken relaxation prompts, then silence and ambient sound.', 'calm', 'pure_soundscape'],
  ['pure-night', 'Night insects and a distant fan, only environmental sound, no music.', 'sleep', 'pure_soundscape'],
] as const;

const expectedSupplyGapNames = new Set([
  'sleep-no-water',
  'calm-no-rain',
  'focus-no-music',
  'focus-office',
  'focus-train-default-sleep',
  'pure-night',
]);
const rejectedSemanticSimulationStemIds = new Set([
  'stem_internal_quiet_room',
  'stem_internal_fan_low',
  'stem_internal_fan_medium',
  'stem_internal_fan_high',
  'stem_internal_airplane_cabin',
  'stem_internal_train_carriage',
  'stem_internal_air_conditioner',
  'stem_internal_humidifier',
  'stem_internal_distant_highway',
]);

const run = async () => {
  const createdIds: string[] = [];
  const results: Record<string, unknown>[] = [];
  const stemUsage = new Map<string, { count: number; roles: Set<string>; names: Set<string> }>();
  try {
    for (const [name, prompt, goal, expectedMode, expectedGoal] of cases) {
      const response = await fetch(`${API_BASE}/api/quick-create`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, goal, durationSeconds: 300, guidedVoice: false }),
      });
      const payload = await response.json();
      if (expectedSupplyGapNames.has(name)) {
        if (response.status !== 422 || !Array.isArray(payload.unmetRequirements) || payload.unmetRequirements.length === 0) {
          throw new Error(`${name}: expected an honest supply gap, got ${response.status}`);
        }
        results.push({ name, supplyGap: true, unmetRequirements: payload.unmetRequirements });
        continue;
      }
      if (!response.ok) throw new Error(`${name}: ${payload.error ?? response.statusText}`);
      const mixId = String(payload.mix?.id ?? '');
      createdIds.push(mixId);
      const actualMode = payload.audioIntent?.contentMode ?? payload.mix?.recipeData?.contentMode;
      if (actualMode !== expectedMode) throw new Error(`${name}: expected ${expectedMode}, got ${actualMode}`);
      if (payload.audioIntent?.goal !== (expectedGoal ?? goal)) throw new Error(`${name}: expected goal ${expectedGoal ?? goal}, got ${payload.audioIntent?.goal}`);
      const excluded = payload.audioIntent?.excludedSounds ?? [];
      if (payload.audioIntent?.guidedVoice?.enabled !== false || payload.audioIntent?.intensity?.voice !== 0 || !excluded.includes('voice')) throw new Error(`${name}: voice-free beta contract was not applied`);
      if (/(no|不要|only|只要)/i.test(prompt) && /water|水声/.test(prompt) && !excluded.includes('water')) throw new Error(`${name}: water exclusion lost`);
      if (name === 'sleep-rain' && (excluded.includes('rain') || !excluded.includes('thunder'))) throw new Error(`${name}: rain and thunder were not separated`);
      const tracks = (payload.mix?.recipeData?.tracks ?? payload.tracks ?? []).map((track: any) => ({
        stemId: String(track.stemId ?? track.id ?? ''),
        name: String(track.name ?? ''),
        role: String(track.role ?? ''),
        volume: Number(track.volume ?? 0),
        sourceGainDb: Number(track.sourceGainDb ?? 0),
        automationPoints: Array.isArray(track.volumeAutomation) ? track.volumeAutomation.length : 0,
      }));
      if (name === 'focus-rain' && !tracks.some((track: any) => track.stemId === 'stem_mixkit_rain_2394')) throw new Error(`${name}: rain preference was lost`);
      if (tracks.some((track: any) => rejectedSemanticSimulationStemIds.has(track.stemId))) throw new Error(`${name}: rejected semantic simulation was selected`);
      if (name === 'sleep-no-water-simple' && tracks.some((track: any) => /ocean|rain|water|stream|river/i.test(track.stemId))) throw new Error(`${name}: water-family stem remained audible`);
      if (name === 'sleep-dry-music' && (tracks.length !== 1 || tracks[0].role !== 'music')) throw new Error(`${name}: dry music request received a non-music layer`);
      if (name === 'sleep-local-drone-journey' && !tracks.some((track: any) => track.stemId.startsWith('stem_local_procedural_') && track.role === 'music')) throw new Error(`${name}: approved local procedural music was not selected`);
      if (excluded.includes('music') && tracks.some((track: any) => track.role === 'music' && track.volume > 0)) throw new Error(`${name}: excluded music remained audible`);
      if (excluded.includes('voice') && tracks.some((track: any) => track.role === 'voice' && track.volume > 0)) throw new Error(`${name}: excluded voice remained audible`);
      if (tracks.some((track: any) => track.volume < 0 || track.volume > 100)) throw new Error(`${name}: track volume is outside the supported range`);
      if (name.startsWith('focus-') && tracks.some((track: any) => track.sourceGainDb !== 0)) throw new Error(`${name}: focus track still has a legacy source boost`);
      if (expectedMode === 'sound_journey' && tracks.filter((track: any) => track.automationPoints >= 3).length < 2) throw new Error(`${name}: sound journey has insufficient stage automation`);
      for (const track of tracks) {
        const current = stemUsage.get(track.stemId) ?? { count: 0, roles: new Set<string>(), names: new Set<string>() };
        current.count += 1;
        current.roles.add(track.role);
        current.names.add(track.name);
        stemUsage.set(track.stemId, current);
      }
      results.push({ name, contentMode: actualMode, scene: payload.audioIntent?.scene, excluded, trackCount: tracks.length, tracks });
    }
    console.log(JSON.stringify({
      passed: true,
      caseCount: results.length,
      distinctStems: stemUsage.size,
      stemUsage: [...stemUsage.entries()].sort((a, b) => b[1].count - a[1].count).map(([stemId, value]) => ({ stemId, count: value.count, roles: [...value.roles], names: [...value.names] })),
      cases: results,
    }, null, 2));
  } finally {
    if (createdIds.length) await query('delete from mixes where id = any($1)', [createdIds]);
    await pool.end();
  }
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
