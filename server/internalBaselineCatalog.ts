import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CatalogRecipe, CatalogTrack, ProductGoal, ProductScene } from './contentCatalog';
import type { PlannedAudioIntent } from './soundscapePlanner';

type PromotionItem = {
  id: string;
  title: string;
  goal: ProductGoal;
  scene: string;
  outputPath: string;
  outputUrl: string;
  sha256: string;
  durationSeconds: number;
  promotionStatus: string;
  ownerListeningVerdict: string;
  ownerListeningQuote: string;
};

export type InternalBaselineSeed = PromotionItem & {
  stemId: string;
  catalogRecipeId: string;
  canonicalScene: ProductScene;
  keywords: string[];
};

export type InternalBaselineMatch = {
  seedId: string;
  title: string;
  goal: ProductGoal;
  scene: string;
  canonicalScene: ProductScene;
  matchedSignals: string[];
  matchReason: string;
  ownerListeningVerdict: 'save_and_replay_worthy';
};

export type SavedInternalBaselinePreference = {
  seedId: string;
  goal: ProductGoal;
  scene: string;
  canonicalScene: ProductScene;
  savedCount?: number;
};

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const promotionFiles = ['012', '013', '014', '015', '016', '017']
  .map((batch) => path.join(PROJECT_ROOT, `data/content-baseline/content-baseline-batch-${batch}-promotion.json`));

const titleKeywords = (value: string) => value
  .toLowerCase()
  .replace(/[—–]/g, ' ')
  .split(/[^a-z0-9_]+/)
  .filter((item) => item.length >= 3 && !['sleep', 'calm', 'focus', 'saveable'].includes(item));

const canonicalSceneFor = (goal: ProductGoal, scene: string): ProductScene => {
  if (goal === 'sleep') return /return|early_morning|wake|回睡/i.test(scene) ? 'return_to_sleep' : 'bedtime';
  if (goal === 'calm') return /breath|meditation|mindful/i.test(scene) ? 'breathing' : 'emotional_settling';
  return 'deep_focus';
};

const readPromotions = (): InternalBaselineSeed[] => promotionFiles.flatMap((filePath) => {
  if (!existsSync(filePath)) return [];
  const promotion = JSON.parse(readFileSync(filePath, 'utf8')) as { promoted?: PromotionItem[] };
  return (promotion.promoted ?? [])
    .filter((item) => item.promotionStatus === 'internal_audible_product_baseline_seed' && item.ownerListeningVerdict === 'save_and_replay_worthy')
    .map((item) => ({
      ...item,
      stemId: `stem_content_baseline_${item.id}`,
      catalogRecipeId: `content-baseline-${item.id}`,
      canonicalScene: canonicalSceneFor(item.goal, item.scene),
      keywords: [...new Set([...titleKeywords(item.title), ...titleKeywords(item.scene.replaceAll('_', ' '))])],
    }));
});

export const internalBaselineSeeds = readPromotions();

export const getInternalBaselineStems = () => internalBaselineSeeds.map((seed) => ({
  id: seed.stemId,
  name: seed.title.replace(/\s+[—-]\s+(Sleep|Calm|Focus)$/i, ''),
  category: 'Music',
  audioUrl: seed.outputUrl,
  isPremium: false,
  tags: ['Internal Baseline', 'Save Replay Worthy', seed.goal, seed.scene, ...seed.keywords],
  defaultVolume: seed.goal === 'focus' ? 64 : 54,
  description: `Owner-approved internal baseline soundscape seed for ${seed.goal}/${seed.scene}.`,
  sourcePlatform: 'MixStil internal content baseline',
  sourceUrl: seed.outputPath,
  sourceItemId: seed.id,
  sourceCreator: 'MixStil internal content factory',
  licenseName: 'MixStil derivative work with documented embedded source licenses',
  licenseUrl: 'internal://snooze/content-baseline-rights-2026-07-20',
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  attributionRequired: false,
  rawRedistributionAllowed: false,
  qaStatus: 'approved',
  qaNotes: `Owner listening QA: "${seed.ownerListeningQuote}". Rights lineage and long-form release packaging passed on 2026-07-20. Not licensed for raw stem redistribution.`,
  fileSha256: seed.sha256,
  importedAt: null,
}));

const trackForSeed = (seed: InternalBaselineSeed, durationSeconds: number): CatalogTrack => ({
  stemId: seed.stemId,
  role: 'music',
  volume: seed.goal === 'focus' ? 64 : 54,
  startTime: 0,
  duration: durationSeconds,
  trimStart: 0,
  trimEnd: Math.max(1, Math.round(seed.durationSeconds)),
  isMuted: false,
  volumeAutomation: [
    { atSeconds: 0, volume: seed.goal === 'focus' ? 42 : 36 },
    { atSeconds: Math.round(durationSeconds * 0.08), volume: seed.goal === 'focus' ? 64 : 54 },
    { atSeconds: Math.round(durationSeconds * 0.86), volume: seed.goal === 'focus' ? 58 : 48 },
    { atSeconds: durationSeconds, volume: seed.goal === 'focus' ? 34 : 28 },
  ],
});

const supportTrackForSeed = (seed: InternalBaselineSeed, durationSeconds: number): CatalogTrack => {
  const supportStemId = seed.goal === 'sleep'
    ? 'stem_internal_brown_soft'
    : 'stem_internal_pink_balanced';
  const supportVolume = seed.goal === 'focus' ? 11 : seed.goal === 'calm' ? 10 : 12;
  return {
    stemId: supportStemId,
    role: 'base',
    volume: supportVolume,
    startTime: 0,
    duration: durationSeconds,
    trimStart: 0,
    trimEnd: durationSeconds,
    isMuted: false,
    volumeAutomation: seed.goal === 'sleep'
      ? [
          { atSeconds: 0, volume: Math.max(4, supportVolume - 4) },
          { atSeconds: Math.round(durationSeconds * 0.12), volume: supportVolume },
          { atSeconds: Math.round(durationSeconds * 0.84), volume: Math.max(4, supportVolume - 2) },
          { atSeconds: durationSeconds, volume: Math.max(3, Math.round(supportVolume * 0.6)) },
        ]
      : [
          { atSeconds: 0, volume: Math.max(4, supportVolume - 2) },
          { atSeconds: Math.round(durationSeconds * 0.1), volume: supportVolume },
          { atSeconds: Math.round(durationSeconds * 0.86), volume: Math.max(4, supportVolume - 1) },
          { atSeconds: durationSeconds, volume: Math.max(3, Math.round(supportVolume * 0.65)) },
        ],
  };
};

export const recipeForInternalBaselineSeed = (
  seed: InternalBaselineSeed,
  durationSeconds: number,
  match?: InternalBaselineMatch,
): CatalogRecipe & { internalBaselineMatch?: InternalBaselineMatch } => ({
  id: seed.catalogRecipeId,
  name: seed.title.replace(/\s+[—-]\s+(Sleep|Calm|Focus)$/i, ''),
  goal: seed.goal,
  scene: seed.canonicalScene,
  durationSeconds,
  tracks: [
    trackForSeed(seed, durationSeconds),
    supportTrackForSeed(seed, durationSeconds),
  ],
  moodTags: ['Internal Baseline', 'Save Replay Worthy', seed.goal, seed.scene, ...seed.keywords],
  contentMode: 'functional_music',
  mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'music' } },
  internalBaselineMatch: match,
});

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

const sceneAliases: Record<string, string[]> = {
  bedtime_sleep: ['bedtime', 'sleep', '入睡', '睡前', '晚上睡', '睡不好'],
  return_to_sleep: ['return', 'back to sleep', 'wake', 'woke', '夜醒', '半夜醒', '醒来', '回睡', '重新入睡'],
  short_nap: ['nap', '午休', '小睡', '短睡', '午睡'],
  late_night_reset: ['late night', '深夜', '很晚', '凌晨', '夜里'],
  travel_rest: ['travel', 'trip', 'hotel', 'flight', '旅途', '旅行', '出差', '酒店', '飞机'],
  restless_mind: ['restless', 'racing mind', 'thoughts', '脑子停不下来', '胡思乱想', '思绪很多', '想太多'],
  anxious_bedtime: ['anxious', 'anxiety', 'nervous', '焦虑', '紧张', '不安'],
  early_morning_return: ['early morning', 'dawn', '清晨', '早醒', '天快亮', '凌晨醒'],
  phone_down_bedtime: ['phone', 'screen', 'scroll', '手机', '刷手机', '放下手机', '屏幕'],
  quiet_relaxation: ['relax', 'quiet', '安静', '放松', '缓下来'],
  after_work_settling: ['after work', '下班', '工作后', '收工'],
  morning_settle: ['morning', '早晨', '早上', '上午'],
  evening_release: ['evening', '傍晚', '晚上放松', '晚间'],
  midday_recenter: ['midday', 'lunch', '中午', '午间', '下午重新开始'],
  pre_meeting_settle: ['meeting', 'before meeting', '开会', '会议前', '会前'],
  emotional_buffer: ['emotion', 'overload', '情绪', '情绪过载', '烦躁', '崩溃', '缓冲'],
  weekend_unwind: ['weekend', '周末', '休息日', '放空'],
  after_work_release: ['after work', '下班', '释放', '卸下', '工作结束'],
  deep_work: ['deep work', 'work', '专注工作', '深度工作', '工作'],
  light_focus: ['light focus', '轻专注', '低压力专注'],
  reading_focus: ['reading', 'read', 'book', '阅读', '读书', '看书'],
  writing_focus: ['writing', 'write', 'draft', '写作', '写东西', '文档'],
  low_energy_admin: ['admin', 'email', 'low energy', '低能量', '邮件', '杂事', '行政'],
  coding_focus: ['coding', 'code', 'programming', '代码', '编程', '写代码'],
  study_focus: ['study', 'learning', '学习', '复习', '备考'],
};

const sceneLabels: Record<string, string> = {
  bedtime_sleep: 'bedtime sleep',
  return_to_sleep: 'return to sleep',
  short_nap: 'short nap',
  late_night_reset: 'late-night reset',
  travel_rest: 'travel rest',
  restless_mind: 'restless mind',
  anxious_bedtime: 'anxious bedtime',
  early_morning_return: 'early-morning return to sleep',
  phone_down_bedtime: 'phone-down bedtime',
  quiet_relaxation: 'quiet relaxation',
  after_work_settling: 'after-work settling',
  morning_settle: 'morning settling',
  evening_release: 'evening release',
  midday_recenter: 'midday recentering',
  pre_meeting_settle: 'pre-meeting settling',
  emotional_buffer: 'emotional buffer',
  weekend_unwind: 'weekend unwind',
  after_work_release: 'after-work release',
  deep_work: 'deep work',
  light_focus: 'light focus',
  reading_focus: 'reading focus',
  writing_focus: 'writing focus',
  low_energy_admin: 'low-energy admin focus',
  coding_focus: 'coding focus',
  study_focus: 'study focus',
};

const aliasScoreForSeed = (seed: InternalBaselineSeed, prompt: string) => {
  const aliases = sceneAliases[seed.scene] ?? [];
  const exactAliasScore = aliases.some((alias) => prompt.includes(alias)) ? 90 : 0;
  const titleAliasScore = seed.keywords.filter((keyword) => prompt.includes(keyword)).length * 18;
  return exactAliasScore + titleAliasScore;
};

const matchSignalsForSeed = (seed: InternalBaselineSeed, prompt: string, intent: PlannedAudioIntent) => {
  const signals = [
    ...(seed.goal === intent.goal ? [`goal:${intent.goal}`] : []),
    ...(seed.canonicalScene === intent.scene ? [`scene:${intent.scene}`] : []),
    ...(sceneAliases[seed.scene] ?? []).filter((alias) => prompt.includes(alias)).map((alias) => `phrase:${alias}`),
    ...seed.keywords.filter((keyword) => prompt.includes(keyword)).map((keyword) => `keyword:${keyword}`),
  ];
  return [...new Set(signals)].slice(0, 8);
};

const buildMatch = (seed: InternalBaselineSeed, prompt: string, intent: PlannedAudioIntent): InternalBaselineMatch => {
  const matchedSignals = matchSignalsForSeed(seed, prompt, intent);
  const sceneLabel = sceneLabels[seed.scene] ?? seed.scene.replaceAll('_', ' ');
  const signalText = matchedSignals
    .filter((signal) => signal.startsWith('phrase:') || signal.startsWith('keyword:'))
    .map((signal) => signal.replace(/^(phrase|keyword):/, ''))
    .slice(0, 2)
    .join(', ');
  return {
    seedId: seed.id,
    title: seed.title,
    goal: seed.goal,
    scene: seed.scene,
    canonicalScene: seed.canonicalScene,
    matchedSignals,
    matchReason: signalText
      ? `Matched your ${sceneLabel} request from cues like “${signalText}”, then used an owner-approved save/replay baseline for ${seed.goal}.`
      : `Matched your ${sceneLabel} request and used an owner-approved save/replay baseline for ${seed.goal}.`,
    ownerListeningVerdict: 'save_and_replay_worthy',
  };
};

const seedScore = (
  seed: InternalBaselineSeed,
  prompt: string,
  intent: PlannedAudioIntent,
  savedPreferences: SavedInternalBaselinePreference[] = [],
) => {
  let score = seed.goal === intent.goal ? 100 : -100;
  if (seed.canonicalScene === intent.scene) score += 35;
  score += aliasScoreForSeed(seed, prompt);
  if (intent.goal === 'sleep' && hasAny(prompt, ['wake', 'woke', 'return', 'morning', '夜醒', '醒来', '回睡']) && seed.canonicalScene === 'return_to_sleep') score += 28;
  if (intent.goal === 'sleep' && hasAny(prompt, ['phone', '手机', 'bedtime', '睡前']) && /phone|bedtime|descent|blanket|restless|anxious/.test(seed.scene)) score += 18;
  if (intent.goal === 'sleep' && hasAny(prompt, ['phone', 'screen', 'scroll', '手机', '刷手机', '放下手机', '屏幕']) && /phone_down/.test(seed.scene)) score += 42;
  if (intent.goal === 'sleep' && hasAny(prompt, ['anxious', 'anxiety', '焦虑', '紧张', '不安']) && /anxious/.test(seed.scene)) score += 42;
  if (intent.goal === 'sleep' && hasAny(prompt, ['nap', '午休', '小睡', '午睡']) && /nap/.test(seed.scene)) score += 42;
  if (intent.goal === 'sleep' && hasAny(prompt, ['travel', 'hotel', '出差', '旅行', '酒店']) && /travel/.test(seed.scene)) score += 42;
  if (intent.goal === 'calm' && hasAny(prompt, ['work', 'meeting', 'after', '情绪', '下班', '会议']) && /work|meeting|emotional|release|settle|buffer/.test(seed.scene)) score += 18;
  if (intent.goal === 'focus' && hasAny(prompt, ['read', 'reading', 'study', 'coding', 'write', '阅读', '学习', '写作', '代码']) && /reading|study|coding|writing|work/.test(seed.scene)) score += 18;
  for (const preference of savedPreferences.filter((item) => item.goal === intent.goal)) {
    const savedWeight = Math.min(3, Math.max(1, preference.savedCount ?? 1));
    if (preference.seedId === seed.id) score += 130 * savedWeight;
    else if (preference.scene === seed.scene) score += 32 * savedWeight;
    else if (preference.canonicalScene === seed.canonicalScene) score += 10 * savedWeight;
  }
  score += Number.parseInt(createHash('sha1').update(`${prompt}|${seed.id}`).digest('hex').slice(0, 4), 16) / 65535;
  return score;
};

export const selectInternalBaselineRecipe = (input: {
  prompt: string;
  audioIntent: PlannedAudioIntent;
  durationSeconds: number;
  savedBaselinePreferences?: SavedInternalBaselinePreference[];
}) => {
  const prompt = input.prompt.toLowerCase();
  const explicitSingleSource = /(?:\bonly\b|\bjust\b|只要|只有|仅要|仅需)/i.test(input.prompt);
  const excluded = new Set(input.audioIntent.excludedSounds.map((item) => item.toLowerCase()));
  const preferredNonMusicEnvironment = input.audioIntent.environmentPreferences
    .map((item) => item.toLowerCase())
    .filter((item) => item !== 'music');
  const excludedConcepts = input.audioIntent.excludedConceptIds ?? [];
  const explicitNaturalOrNoisePreference = preferredNonMusicEnvironment.length > 0;
  const musicBlocked = excluded.has('music') || excludedConcepts.includes('source.music') || /不要音乐|不想听音乐|no music|without music/i.test(input.prompt);
  if (musicBlocked || explicitNaturalOrNoisePreference || explicitSingleSource) return null;
  const candidates = internalBaselineSeeds.filter((seed) => (
    seed.goal === input.audioIntent.goal && seed.canonicalScene === input.audioIntent.scene
  ));
  const seed = candidates
    .map((candidate) => ({ candidate, score: seedScore(candidate, prompt, input.audioIntent, input.savedBaselinePreferences ?? []) }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;
  if (!seed) return null;
  const match = buildMatch(seed, prompt, input.audioIntent);
  return { seed, match, recipe: recipeForInternalBaselineSeed(seed, input.durationSeconds, match) };
};
