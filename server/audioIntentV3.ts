import type { AudioIntentV2 } from './audioIntentV2';
import { parseAudioIntentV2 } from './audioIntentV2';

export type SessionSubtype =
  | 'bedtime_wind_down' | 'sleep_onset' | 'return_to_sleep' | 'all_night_masking' | 'nap'
  | 'breath_awareness' | 'grounding' | 'open_awareness' | 'emotional_release' | 'sound_meditation'
  | 'reading_writing' | 'deep_work' | 'study' | 'creative_work' | 'repetitive_task' | 'distraction_masking';

export type Level = 'low' | 'medium' | 'high' | 'unknown';
export type DesiredTrajectory = 'settle_quickly' | 'settle_gradually' | 'release_then_settle' | 'maintain_calm' | 'maintain_alert' | 'mask_distraction';

export type AudioIntentV3 = Omit<AudioIntentV2, 'schemaVersion'> & {
  schemaVersion: 3;
  rawPrompt: string;
  durationSeconds: number;
  sessionSubtype: SessionSubtype;
  desiredOutcomes: string[];
  currentState: {
    mentalActivity: Level;
    emotionalTension: Level;
    sleepiness: Level;
    attentionStability: Level;
    physicalRestlessness: Level;
  };
  desiredTrajectory: DesiredTrajectory;
  stimulationTolerance: {
    eventDensity: Level;
    transientSensitivity: Level;
    brightness: 'low' | 'balanced' | 'high' | 'unknown';
    rhythm: 'none' | 'subtle' | 'steady' | 'unknown';
    melody: 'none' | 'sparse' | 'present' | 'unknown';
    lowFrequency: Level;
    variation: Level;
  };
  context: {
    device: 'headphones' | 'speaker' | 'unknown';
    externalNoise: 'quiet' | 'variable' | 'loud' | 'unknown';
    timeOfDay: 'day' | 'evening' | 'night' | 'unknown';
    loopPreference: 'single_session' | 'continuous' | 'unknown';
  };
  narrativeArc: Array<{
    phase: 'arrival' | 'core' | 'release';
    change: 'enter' | 'rise' | 'hold' | 'fall' | 'exit';
    relativeStart: number;
  }>;
  confidence: number;
  fieldConfidence: Record<string, number>;
};

const sessionSubtype = (prompt: string, base: AudioIntentV2): SessionSubtype => {
  if (base.goal === 'sleep') {
    if (base.scene === 'return_to_sleep') return 'return_to_sleep';
    if (/(all night|overnight|整夜|一整晚|通宵)/i.test(prompt)) return 'all_night_masking';
    if (/(nap|午睡|小睡)/i.test(prompt)) return 'nap';
    if (/(can't sleep|cannot sleep|fall asleep|insomnia|睡不着|难入睡|入睡困难)/i.test(prompt)) return 'sleep_onset';
    return 'bedtime_wind_down';
  }
  if (base.goal === 'calm') {
    if (base.scene === 'breathing') return 'breath_awareness';
    if (/(ground|grounding|落地感|脚底|身体感受)/i.test(prompt)) return 'grounding';
    if (/(open awareness|observe|觉察|观照|观察念头)/i.test(prompt)) return 'open_awareness';
    if (/(release|let go|释放|放下|情绪宣泄)/i.test(prompt)) return 'emotional_release';
    return 'sound_meditation';
  }
  if (/(read|write|阅读|写作)/i.test(prompt)) return 'reading_writing';
  if (/(study|memor|学习|背诵|记忆)/i.test(prompt)) return 'study';
  if (/(creative|design|brainstorm|创作|设计|灵感)/i.test(prompt)) return 'creative_work';
  if (/(repetitive|routine|data entry|重复|机械任务)/i.test(prompt)) return 'repetitive_task';
  if (/(mask|noisy|distraction|遮蔽|吵|干扰)/i.test(prompt)) return 'distraction_masking';
  return 'deep_work';
};

const level = (prompt: string, high: RegExp, low: RegExp): Level => high.test(prompt) ? 'high' : low.test(prompt) ? 'low' : 'unknown';

const desiredTrajectory = (prompt: string, base: AudioIntentV2): DesiredTrajectory => {
  if (/(release then|let go then|先释放|先放下|释放.*再|宣泄.*再)/i.test(prompt)) return 'release_then_settle';
  if (/(quickly|as soon as possible|快速|尽快|马上)/i.test(prompt)) return 'settle_quickly';
  if (/(gradually|slowly|慢慢|逐渐|缓缓)/i.test(prompt)) return 'settle_gradually';
  if (base.goal === 'focus' && /(mask|noisy|distraction|遮蔽|吵|干扰)/i.test(prompt)) return 'mask_distraction';
  if (base.goal === 'focus') return 'maintain_alert';
  if (base.goal === 'calm') return 'maintain_calm';
  return 'settle_gradually';
};

export const buildNarrativeArcV3 = (trajectory: DesiredTrajectory) => trajectory === 'settle_quickly'
  ? [{ phase: 'arrival' as const, change: 'enter' as const, relativeStart: 0 }, { phase: 'core' as const, change: 'hold' as const, relativeStart: 0.08 }, { phase: 'release' as const, change: 'fall' as const, relativeStart: 0.88 }]
  : trajectory === 'maintain_alert' || trajectory === 'mask_distraction' || trajectory === 'maintain_calm'
    ? [{ phase: 'arrival' as const, change: 'enter' as const, relativeStart: 0 }, { phase: 'core' as const, change: 'hold' as const, relativeStart: 0.12 }, { phase: 'release' as const, change: 'hold' as const, relativeStart: 0.92 }]
    : [{ phase: 'arrival' as const, change: 'enter' as const, relativeStart: 0 }, { phase: 'core' as const, change: 'rise' as const, relativeStart: 0.2 }, { phase: 'release' as const, change: 'fall' as const, relativeStart: 0.86 }];

export const parseAudioIntentV3 = (input: Parameters<typeof parseAudioIntentV2>[0] & { durationSeconds?: number }): AudioIntentV3 => {
  const prompt = input.prompt?.trim() ?? '';
  const base = parseAudioIntentV2(input);
  const subtype = sessionSubtype(prompt, base);
  const trajectory = desiredTrajectory(prompt, base);
  const noSudden = /(no sudden|no startling|不要突然|不要突发|容易被吓|怕突然)/i.test(prompt);
  const lowStimulus = /(low stimulation|steady|predictable|少变化|稳定|低刺激|不要刺激)/i.test(prompt) || base.goal === 'sleep';
  const noBeat = /(no beat|without rhythm|没有.{0,8}(节拍|节奏)|无节拍|无节奏|不要.{0,6}(节拍|节奏))/i.test(prompt);
  const noMelody = base.excludedSounds.includes('music') || /(no melody|without melody|没有旋律|无旋律)/i.test(prompt);
  const sparseMelody = /(sparse|minimal music|少量旋律|极简音乐)/i.test(prompt);
  const desiredOutcomes = [
    base.goal === 'sleep' ? 'rest' : base.goal === 'focus' ? 'sustained_attention' : 'emotional_regulation',
    subtype,
    trajectory,
  ];
  const explicitState = /(脑子停不下来|racing thoughts|overthink|焦虑|anxious|分心|distract|疲惫|tired|困|sleepy|坐立不安|restless)/i.test(prompt);
  return {
    ...base,
    schemaVersion: 3,
    rawPrompt: prompt,
    durationSeconds: Math.max(60, Number(input.durationSeconds ?? 900)),
    sessionSubtype: subtype,
    desiredOutcomes,
    currentState: {
      mentalActivity: level(prompt, /(脑子停不下来|思绪很多|racing thoughts|overthink|mind won't stop)/i, /(脑子很空|mentally tired|思维迟钝)/i),
      emotionalTension: level(prompt, /(焦虑|紧张|压力|烦躁|anxious|tense|stress|irritated)/i, /(平静|calm already|relaxed)/i),
      sleepiness: level(prompt, /(困|很想睡|sleepy|drowsy)/i, /(不困|清醒|not sleepy|wide awake)/i),
      attentionStability: level(prompt, /(专注稳定|注意力很好|focused)/i, /(分心|注意力不集中|distract|can't focus)/i) === 'high' ? 'high' : /(分心|注意力不集中|distract|can't focus)/i.test(prompt) ? 'low' : 'unknown',
      physicalRestlessness: level(prompt, /(坐立不安|身体紧绷|restless|physically tense)/i, /(身体放松|physically relaxed)/i),
    },
    desiredTrajectory: trajectory,
    stimulationTolerance: {
      eventDensity: lowStimulus ? 'low' : /(rich|many changes|丰富|变化多)/i.test(prompt) ? 'high' : 'unknown',
      transientSensitivity: noSudden ? 'high' : base.goal === 'sleep' ? 'medium' : 'unknown',
      brightness: /(dark|warm|not bright|不刺耳|暗一点|温暖)/i.test(prompt) ? 'low' : /(bright|清亮|明亮)/i.test(prompt) ? 'high' : 'unknown',
      rhythm: noBeat ? 'none' : /(steady beat|pulse|稳定节拍|律动)/i.test(prompt) ? 'steady' : 'unknown',
      melody: noMelody ? 'none' : sparseMelody ? 'sparse' : /(music|melody|音乐|旋律)/i.test(prompt) ? 'present' : 'unknown',
      lowFrequency: /(不要低频|低频不舒服|no bass|no low frequency)/i.test(prompt) ? 'low' : /(deep|low drone|低沉|低频)/i.test(prompt) ? 'high' : 'unknown',
      variation: lowStimulus ? 'low' : /(变化丰富|many changes|dynamic)/i.test(prompt) ? 'high' : 'unknown',
    },
    context: {
      device: /(headphones|earbuds|耳机)/i.test(prompt) ? 'headphones' : /(speaker|音箱|外放)/i.test(prompt) ? 'speaker' : 'unknown',
      externalNoise: /(noisy|loud environment|很吵|环境吵)/i.test(prompt) ? 'loud' : /(quiet room|安静房间|环境安静)/i.test(prompt) ? 'quiet' : 'unknown',
      timeOfDay: /(morning|daytime|白天|早上)/i.test(prompt) ? 'day' : /(evening|傍晚|睡前)/i.test(prompt) ? 'evening' : /(night|midnight|晚上|半夜|夜间)/i.test(prompt) ? 'night' : 'unknown',
      loopPreference: /(all night|continuous|loop|整夜|一直播放|循环)/i.test(prompt) ? 'continuous' : 'unknown',
    },
    narrativeArc: buildNarrativeArcV3(trajectory),
    confidence: explicitState ? 0.9 : 0.78,
    fieldConfidence: {
      goal: 0.95,
      scene: 0.9,
      sessionSubtype: 0.82,
      currentState: explicitState ? 0.9 : 0.45,
      desiredTrajectory: /(quickly|gradually|slowly|快速|尽快|慢慢|逐渐|释放)/i.test(prompt) ? 0.92 : 0.72,
      stimulationTolerance: noSudden || lowStimulus || noBeat || noMelody ? 0.9 : 0.55,
    },
  };
};
