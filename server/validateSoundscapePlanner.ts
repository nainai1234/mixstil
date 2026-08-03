import { pool, query } from './db';
import { planQuickCreateSoundscape, SupplyGapError } from './soundscapePlanner';

const cases = [
  { id: 'voice-free-sleep-music', prompt: '无水声、无人声、低刺激助眠音乐', goal: 'sleep', durationSeconds: 900, expectedMode: 'functional_music', requiredRole: 'music', forbidden: ['source.natural.water', 'source.human.voice'] },
  { id: 'no-water-music', prompt: '睡前需要温暖音乐，不要任何水声，也不要人声', goal: 'sleep', expectedMode: 'functional_music', forbidden: ['source.natural.water'] },
  { id: 'meditation-music-bed', prompt: '我需要真实的冥想音乐，帮助我快速安静下来，不要人声', goal: 'calm', expectedMode: 'functional_music', requiredAny: ['source.music.meditation'], forbidden: ['source.human.voice'] },
  { id: 'rain-meditation-music', prompt: '睡前想听柔和的雨感氛围音乐，宽广、稳定、不要人声，不要突然变化', goal: 'sleep', expectedMode: 'functional_music', requiredAll: ['source.music.meditation', 'source.natural.water.rain'], forbidden: ['source.human.voice', 'source.natural.thunder'] },
  { id: 'train-or-indoor', prompt: '列车或室内底噪专注，不要雨水和音乐', goal: 'focus', expectedMode: 'pure_soundscape', requiredAny: ['source.vehicle.rail.carriage', 'source.domestic'], forbidden: ['source.natural.water', 'source.music'] },
  { id: 'aircraft-cabin-focus', prompt: '飞机客舱的稳定底噪帮助专注，不要人声、广播、雨水和音乐', goal: 'focus', expectedMode: 'pure_soundscape', requiredAny: ['source.vehicle.aircraft.cabin'], forbidden: ['source.human.voice', 'source.natural.water', 'source.music'] },
  { id: 'rain-reading', prompt: '阅读时只要很轻的雨声，不要雷声、音乐和人声', goal: 'focus', expectedMode: 'pure_soundscape', expectedSingleSource: true, requiredAny: ['source.natural.water.rain'], forbidden: ['source.natural.thunder', 'source.music', 'source.human.voice'] },
  { id: 'single-pink-noise', prompt: '睡前只要柔和粉噪音，不要音乐、自然声和人声', goal: 'sleep', expectedMode: 'pure_soundscape', expectedSingleSource: true, requiredAny: ['source.noise.pink'], forbidden: ['source.music', 'source.natural', 'source.human.voice'] },
  { id: 'focus-music', prompt: '低音量少变化的专注音乐，不要自然声和人声', goal: 'focus', expectedMode: 'functional_music', requiredRole: 'music', forbidden: ['source.natural', 'source.human.voice'] },
  { id: 'music-later', prompt: '睡前不要水声，先用安静底噪稳定下来，之后温暖音乐再慢慢进入', goal: 'sleep', expectedMode: 'sound_journey', expectedStructure: 'music_later', requiredRole: 'music', forbidden: ['source.natural.water'] },
  { id: 'dry-fire', prompt: '只要壁炉火焰声帮助我睡前放松，不要水声和音乐', goal: 'sleep', expectedMode: 'pure_soundscape', expectedSingleSource: true, requiredAny: ['source.natural.fire'], forbidden: ['source.natural.water', 'source.music'] },
  { id: 'dry-wind', prompt: '睡前只要轻柔风声，不要水声、音乐和人声', goal: 'sleep', expectedMode: 'pure_soundscape', expectedSingleSource: true, requiredAny: ['source.natural.wind'], forbidden: ['source.natural.water', 'source.music', 'source.noise'] },
  { id: 'night-crickets', prompt: '夜间只要真实蟋蟀和虫鸣，不要水声、音乐和白噪音', goal: 'sleep', expectedMode: 'pure_soundscape', expectedSingleSource: true, requiredAny: ['source.animal.insect.cricket'], forbidden: ['source.natural.water', 'source.music', 'source.noise'] },
  { id: 'ordinary-sleep-noise', prompt: '晚上睡不好觉，但是又不想听音乐，白噪音也不能声音太大', goal: 'sleep', expectedMode: 'pure_soundscape', requiredAny: ['source.noise'], forbidden: ['source.music', 'source.natural.water'], expectedMaxEnvironmentIntensity: 35 },
  { id: 'goal-only-sleep', prompt: '晚上总是睡不好，也有点焦虑，希望能更容易安静下来', goal: 'sleep', expectedMode: 'pure_soundscape', requiredRole: 'base', forbidden: ['source.music', 'source.natural.water'] },
  { id: 'goal-only-calm', prompt: '我想冥想十分钟，让情绪慢慢安静下来', goal: 'calm', expectedMode: 'sound_journey', expectedMinTracks: 2, expectsAutomation: true, expectsEarlyMusic: true, requiredRole: 'music', forbidden: ['source.human.voice'] },
  { id: 'goal-only-focus', prompt: 'Help me focus on my work without voices', goal: 'focus', expectedMode: 'functional_music', expectedMinTracks: 2, requiredRole: 'music', forbidden: ['source.human.voice'] },
] as const;

const requestIds: string[] = [];
const requireExternal = process.argv.includes('--require-external');
const run = async () => {
  const results: unknown[] = [];
  try {
    for (const item of cases) {
      let plan;
      try {
        plan = await planQuickCreateSoundscape({ prompt: item.prompt, requestedGoal: item.goal, durationSeconds: 'durationSeconds' in item ? item.durationSeconds : 300 });
      } catch (error) {
        if ('expectedSupplyGap' in item && item.expectedSupplyGap && error instanceof SupplyGapError) {
          results.push({ id: item.id, supplyGap: true, unmetRequirements: error.unmetRequirements });
          continue;
        }
        throw error;
      }
      if ('expectedSupplyGap' in item && item.expectedSupplyGap) throw new Error(`${item.id}: expected an honest supply gap`);
      requestIds.push(plan.requestId);
      if (requireExternal && plan.audioIntent.planner.provider === 'rules') throw new Error(`${item.id}: external planner fell back to rules`);
      if (plan.audioIntent.contentMode !== item.expectedMode) throw new Error(`${item.id}: expected ${item.expectedMode}, received ${plan.audioIntent.contentMode}`);
      const selectedCandidates = plan.selected.map((selection) => plan.candidates.find((candidate) => candidate.stemId === selection.stemId)!);
      for (const forbidden of item.forbidden) {
        if (selectedCandidates.some((candidate) => candidate.concepts.some((concept) => concept === forbidden || concept.startsWith(`${forbidden}.`)))) {
          throw new Error(`${item.id}: selected forbidden concept ${forbidden}`);
        }
      }
      if ('requiredAny' in item && item.requiredAny && !selectedCandidates.some((candidate) => item.requiredAny.some((required) => candidate.concepts.some((concept) => concept === required || concept.startsWith(`${required}.`))))) {
        throw new Error(`${item.id}: explicit preference was not selected`);
      }
      if ('requiredAll' in item && item.requiredAll) {
        for (const required of item.requiredAll) {
          if (!selectedCandidates.some((candidate) => candidate.concepts.some((concept) => concept === required || concept.startsWith(`${required}.`)))) {
            throw new Error(`${item.id}: required concept ${required} was not selected`);
          }
        }
      }
      if ('requiredRole' in item && item.requiredRole && !plan.selected.some((selection) => selection.role === item.requiredRole)) {
        throw new Error(`${item.id}: required role ${item.requiredRole} was not selected`);
      }
      if ('expectedStructure' in item && item.expectedStructure && plan.audioIntent.planner.structure !== item.expectedStructure) {
        throw new Error(`${item.id}: expected structure ${item.expectedStructure}, received ${plan.audioIntent.planner.structure}`);
      }
      if ('expectedMaxEnvironmentIntensity' in item && item.expectedMaxEnvironmentIntensity && plan.audioIntent.intensity.environment > item.expectedMaxEnvironmentIntensity) {
        throw new Error(`${item.id}: environment intensity ${plan.audioIntent.intensity.environment} exceeds ${item.expectedMaxEnvironmentIntensity}`);
      }
      const expectedSingleSource = 'expectedSingleSource' in item && item.expectedSingleSource;
      const expectedMinTracks = 'expectedMinTracks' in item ? item.expectedMinTracks : expectedSingleSource ? 1 : 2;
      if (plan.recipe.tracks.length < expectedMinTracks) throw new Error(`${item.id}: expected at least ${expectedMinTracks} tracks, received ${plan.recipe.tracks.length}`);
      if (expectedSingleSource && plan.recipe.tracks.length !== 1) {
        throw new Error(`${item.id}: an explicit single-source request received ${plan.recipe.tracks.length} tracks`);
      }
      if ('expectsAutomation' in item && item.expectsAutomation && !plan.recipe.tracks.some((track) => (track.volumeAutomation?.length ?? 0) >= 3)) {
        throw new Error(`${item.id}: expected an audible arrival/core/release volume structure`);
      }
      if ('expectsEarlyMusic' in item && item.expectsEarlyMusic) {
        const music = plan.recipe.tracks.find((track) => track.role === 'music');
        if (!music || Number(music.volumeAutomation?.[0]?.volume ?? 0) <= 0 || !music.volumeAutomation?.some((point) => point.atSeconds <= 30 && point.volume >= music.volume)) {
          throw new Error(`${item.id}: music is not clearly audible within the first 30 seconds`);
        }
      }
      if (plan.recipe.tracks.some((track) => track.volume < 1 || track.volume > 100)) throw new Error(`${item.id}: measured volume is outside the supported range`);
      if (item.id === 'dry-fire' && plan.recipe.tracks.some((track) => track.stemId === 'stem_fire' && track.volume <= 9)) {
        throw new Error('dry-fire: acoustic normalization did not raise the very quiet fire source above the old fixed cap');
      }
      if (['dry-fire', 'dry-wind', 'night-crickets'].includes(item.id) && plan.recipe.tracks.some((track) => track.role === 'base')) {
        throw new Error(`${item.id}: an authentic scene request received an unsolicited generic base layer`);
      }
      results.push({ id: item.id, provider: plan.audioIntent.planner.provider, recipeId: plan.recipe.id, selected: plan.selected });
    }
    if (!requireExternal) {
      const diversityPrompts = [
        '白天阅读时我要低音量、少变化的专注音乐，不要自然声和人声',
        '写作时我要稳定、不抢注意力的专注音乐，不要自然声和人声',
        '学习时我要变化很少的背景专注音乐，不要自然声和人声',
        '做深度工作时我要低刺激的稳定专注音乐，不要自然声和人声',
      ];
      const diversitySelections: string[] = [];
      for (const prompt of diversityPrompts) {
        const plan = await planQuickCreateSoundscape({ prompt, requestedGoal: 'focus', durationSeconds: 300 });
        requestIds.push(plan.requestId);
        const musicStem = plan.selected.find((selection) => selection.role === 'music')?.stemId;
        if (!musicStem) throw new Error(`top-k-diversity: focus request did not select a music Stem for "${prompt}" (${JSON.stringify(plan.selected)})`);
        diversitySelections.push(musicStem);
      }
      if (new Set(diversitySelections).size < 2) {
        throw new Error(`top-k-diversity: equivalent focus requests collapsed to one Stem (${diversitySelections.join(', ')})`);
      }
      results.push({ id: 'top-k-diversity', distinctMusicStems: [...new Set(diversitySelections)], selections: diversitySelections });
    }
    console.log(JSON.stringify({ passed: true, cases: results }, null, 2));
  } finally {
    if (requestIds.length) await query('delete from selection_traces where request_id = any($1)', [requestIds]);
    await query("delete from supply_gaps where id = 'gap_request_source_natural_fire_sleep_bedtime'");
  }
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
