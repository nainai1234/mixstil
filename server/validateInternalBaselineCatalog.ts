import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getInternalBaselineStems, internalBaselineSeeds, selectInternalBaselineRecipe } from './internalBaselineCatalog';
import type { ProductGoal, ProductScene } from './contentCatalog';
import type { PlannedAudioIntent } from './soundscapePlanner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures: string[] = [];

const assert = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};

const intent = (goal: ProductGoal, scene: ProductScene, overrides: Partial<PlannedAudioIntent> = {}): PlannedAudioIntent => ({
  schemaVersion: 3,
  rawPrompt: 'Validation fixture.',
  durationSeconds: 900,
  goal,
  scene,
  contentMode: 'functional_music',
  environmentPreferences: [],
  excludedSounds: ['voice'],
  intensity: { environment: 35, music: 50, voice: 0 },
  qualities: { warmth: 50, spaciousness: 50, variation: 35 },
  guidedVoice: { enabled: false, language: 'en', density: 'light' },
  sessionSubtype: 'bedtime_wind_down',
  desiredOutcomes: [],
  currentState: {
    mentalActivity: 'unknown',
    emotionalTension: 'unknown',
    sleepiness: 'unknown',
    attentionStability: 'unknown',
    physicalRestlessness: 'unknown',
  },
  desiredTrajectory: 'settle_gradually',
  stimulationTolerance: {
    eventDensity: 'low',
    transientSensitivity: 'low',
    brightness: 'low',
    rhythm: 'none',
    melody: 'sparse',
    lowFrequency: 'low',
    variation: 'low',
  },
  context: { device: 'unknown', externalNoise: 'unknown', timeOfDay: 'unknown', loopPreference: 'unknown' },
  narrativeArc: [],
  confidence: 0.8,
  fieldConfidence: {},
  requiredConceptIds: [],
  preferredConceptIds: [],
  excludedConceptIds: ['source.human.voice'],
  planner: { provider: 'rules', model: null, structure: 'steady', explanation: 'Validation fixture.' },
  ...overrides,
});

assert(internalBaselineSeeds.length === 30, `Expected 30 internal baseline seeds, found ${internalBaselineSeeds.length}.`);
assert(new Set(internalBaselineSeeds.map((seed) => seed.id)).size === 30, 'Internal baseline seed ids must be unique.');

for (const seed of internalBaselineSeeds) {
  assert(seed.ownerListeningVerdict === 'save_and_replay_worthy', `${seed.id} must be owner-approved.`);
  assert(seed.promotionStatus === 'internal_audible_product_baseline_seed', `${seed.id} must be promoted as an internal baseline seed.`);
  assert(existsSync(path.join(root, seed.outputPath)), `${seed.id} audio file is missing at ${seed.outputPath}.`);
}

const stems = getInternalBaselineStems();
assert(stems.length === 30, `Expected 30 internal baseline stems, found ${stems.length}.`);
for (const stem of stems) {
  assert(stem.qaStatus === 'approved', `${stem.id} must be approved for internal playback wiring.`);
  assert(stem.commercialUseAllowed && stem.derivativeUseAllowed, `${stem.id} must pass export eligibility wiring.`);
  assert(stem.audioUrl.startsWith('/audio/content-baseline/'), `${stem.id} must point at a local content-baseline audio URL.`);
  assert(stem.tags.includes('Save Replay Worthy'), `${stem.id} must carry the save/replay tag.`);
}

const genericSleep = selectInternalBaselineRecipe({
  prompt: '晚上总是睡不好，也有点焦虑，希望能更容易安静下来',
  audioIntent: intent('sleep', 'bedtime'),
  durationSeconds: 900,
});
assert(genericSleep?.seed.goal === 'sleep', 'Generic sleep request should select a sleep baseline seed.');
assert((genericSleep?.recipe.tracks?.length ?? 0) >= 2, 'Sleep baseline recipe should expose a layered soundscape.');
assert(genericSleep?.recipe.tracks.some((track) => track.role === 'base'), 'Sleep baseline recipe should include a support layer.');
assert(genericSleep?.recipe.tracks.some((track) => track.role === 'music' && track.stemId.startsWith('stem_content_baseline_')), 'Sleep baseline recipe should keep the internal baseline stem as the main layer.');
assert(genericSleep?.match.matchReason.includes('save/replay baseline'), 'Generic sleep match should include a user-facing match reason.');

const genericCalm = selectInternalBaselineRecipe({
  prompt: '我下班后想放松下来，不要人声',
  audioIntent: intent('calm', 'emotional_settling'),
  durationSeconds: 900,
});
assert(genericCalm?.seed.goal === 'calm', 'Generic calm request should select a calm baseline seed.');

const genericFocus = selectInternalBaselineRecipe({
  prompt: 'Help me focus on reading without voices',
  audioIntent: intent('focus', 'deep_focus'),
  durationSeconds: 900,
});
assert(genericFocus?.seed.goal === 'focus', 'Generic focus request should select a focus baseline seed.');

const scenarioCases: Array<{ prompt: string; goal: ProductGoal; scene: ProductScene; expectedSeed: string }> = [
  { prompt: '焦虑睡前想安静下来', goal: 'sleep', scene: 'bedtime', expectedSeed: 'sleep_025_anxious_bedtime_soften' },
  { prompt: '半夜醒来以后想重新入睡', goal: 'sleep', scene: 'return_to_sleep', expectedSeed: 'sleep_020_return_sleep_soft_floor' },
  { prompt: '午休小睡一下', goal: 'sleep', scene: 'bedtime', expectedSeed: 'sleep_021_nap_soft_hold' },
  { prompt: '出差在酒店休息', goal: 'sleep', scene: 'bedtime', expectedSeed: 'sleep_023_travel_rest_shell' },
  { prompt: '放下手机准备睡觉', goal: 'sleep', scene: 'bedtime', expectedSeed: 'sleep_027_phone_down_bedtime' },
  { prompt: '下班以后放松', goal: 'calm', scene: 'emotional_settling', expectedSeed: 'calm_016_after_work_settle' },
  { prompt: '开会前安定一下', goal: 'calm', scene: 'emotional_settling', expectedSeed: 'calm_020_before_meeting_settle' },
  { prompt: '情绪有点烦躁需要缓冲', goal: 'calm', scene: 'emotional_settling', expectedSeed: 'calm_021_emotional_buffer' },
  { prompt: '周末放空', goal: 'calm', scene: 'emotional_settling', expectedSeed: 'calm_022_weekend_unwind' },
  { prompt: '早上先安静下来', goal: 'calm', scene: 'emotional_settling', expectedSeed: 'calm_017_morning_clear_room' },
  { prompt: '阅读时低干扰专注', goal: 'focus', scene: 'deep_focus', expectedSeed: 'focus_026_reading_low_distraction' },
  { prompt: '写作时稳定一点', goal: 'focus', scene: 'deep_focus', expectedSeed: 'focus_022_writing_flow_low' },
  { prompt: '学习时长期专注', goal: 'focus', scene: 'deep_focus', expectedSeed: 'focus_025_study_long_arc' },
  { prompt: '写代码的时候不要抢注意力', goal: 'focus', scene: 'deep_focus', expectedSeed: 'focus_024_coding_low_loop' },
  { prompt: '低能量处理邮件杂事', goal: 'focus', scene: 'deep_focus', expectedSeed: 'focus_023_low_energy_admin' },
];

const scenarioSelections = scenarioCases.map((item) => {
  const selection = selectInternalBaselineRecipe({
    prompt: item.prompt,
    audioIntent: intent(item.goal, item.scene),
    durationSeconds: 900,
  });
  assert(selection?.seed.id === item.expectedSeed, `${item.prompt} should select ${item.expectedSeed}, received ${selection?.seed.id ?? 'none'}.`);
  assert(selection?.match.seedId === item.expectedSeed, `${item.prompt} match metadata should retain ${item.expectedSeed}.`);
  assert((selection?.match.matchedSignals.length ?? 0) >= 2, `${item.prompt} should retain useful match signals.`);
  return selection?.seed.id ?? 'none';
});
assert(new Set(scenarioSelections).size >= 12, `Scenario baseline mapping collapsed to too few seeds: ${scenarioSelections.join(', ')}`);

const noMusic = selectInternalBaselineRecipe({
  prompt: '睡前只要柔和粉噪音，不要音乐和人声',
  audioIntent: intent('sleep', 'bedtime', {
    environmentPreferences: ['pink_noise'],
    excludedSounds: ['voice', 'music'],
    excludedConceptIds: ['source.human.voice', 'source.music'],
    preferredConceptIds: ['source.noise.pink'],
  }),
  durationSeconds: 900,
});
assert(noMusic === null, 'Explicit no-music/noise request must not be overridden by the music-led baseline.');

const rainOnly = selectInternalBaselineRecipe({
  prompt: '阅读时只要很轻的雨声，不要雷声、音乐和人声',
  audioIntent: intent('focus', 'deep_focus', {
    environmentPreferences: ['rain'],
    excludedSounds: ['thunder', 'music', 'voice'],
    excludedConceptIds: ['source.natural.thunder', 'source.music', 'source.human.voice'],
    preferredConceptIds: ['source.natural.water.rain'],
  }),
  durationSeconds: 900,
});
assert(rainOnly === null, 'Explicit rain-only request must not be overridden by the music-led baseline.');

if (failures.length) {
  throw new Error(`Internal baseline catalog validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  seeds: internalBaselineSeeds.length,
  stems: stems.length,
  selected: {
    sleep: genericSleep?.seed.id,
    calm: genericCalm?.seed.id,
    focus: genericFocus?.seed.id,
  },
  scenarioDiversity: {
    cases: scenarioCases.length,
    distinctSeeds: new Set(scenarioSelections).size,
  },
  sampleMatchReason: genericSleep?.match.matchReason,
  exclusionsRespected: {
    noMusic: noMusic === null,
    rainOnly: rainOnly === null,
  },
}, null, 2));
