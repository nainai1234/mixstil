import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AudioIntentV3, DesiredTrajectory, Level, SessionSubtype } from './audioIntentV3';
import { buildNarrativeArcV3, parseAudioIntentV3 } from './audioIntentV3';
import type { CatalogRecipe, CatalogTrack, ContentMode, ProductGoal, ProductScene } from './contentCatalog';
import { query } from './db';
import { requestStructuredAiJson } from './aiRecipe';
import { deterministicRecipeSeed } from './recipeV2';
import { isStemDurationEligible } from './audioKnowledgeV3';

type CandidateRole = 'base' | 'environment' | 'music' | 'accent';

type AssetCandidate = {
  stemId: string;
  name: string;
  category: string;
  defaultVolume: number;
  descriptions: string[];
  metadataRoles: string[];
  concepts: string[];
  goalFit: Array<{ goal: ProductGoal; scene: ProductScene; score: number; verified: boolean }>;
  temporal: { loopMode?: string; recommendedPhases?: string[] };
  mix: { recommendedGainDb?: [number, number]; frequencyRole?: string };
  durationSeconds: number | null;
  integratedLufs: number | null;
  truePeakDb: number | null;
};

const root = path.resolve(import.meta.dirname, '..');

const hasReadableLocalAudio = (audioUrl: string) => {
  if (!audioUrl.startsWith('/audio/')) return true;
  if (process.env.AUDIO_PUBLIC_BASE_URL) return true;
  return existsSync(path.join(root, 'public', audioUrl.replace(/^\//, '')));
};

type AiSoundscapePlan = {
  title: string;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: ContentMode;
  requiredConceptIds: string[];
  preferredConceptIds: string[];
  excludedConceptIds: string[];
  structure: 'steady' | 'music_later' | 'environment_first' | 'music_first';
  guidedVoice: { enabled: boolean; language: 'zh' | 'en'; density: 'light' | 'standard' | 'frequent' };
  qualities: { warmth: number; spaciousness: number; variation: number };
  sessionSubtype: SessionSubtype;
  desiredTrajectory: DesiredTrajectory;
  currentState: AudioIntentV3['currentState'];
  stimulationTolerance: AudioIntentV3['stimulationTolerance'];
  context: AudioIntentV3['context'];
  confidence: number;
  selected: Array<{ stemId: string; role: CandidateRole; reason: string }>;
  explanation: string;
};

export type PlannedAudioIntent = AudioIntentV3 & {
  requiredConceptIds: string[];
  preferredConceptIds: string[];
  excludedConceptIds: string[];
  planner: {
    provider: 'deepseek' | 'openai' | 'rules';
    model: string | null;
    structure: AiSoundscapePlan['structure'];
    explanation: string;
  };
};

export type QuickCreatePlan = {
  requestId: string;
  audioIntent: PlannedAudioIntent;
  recipe: CatalogRecipe;
  selected: Array<{ stemId: string; role: CandidateRole; reason: string }>;
  candidates: AssetCandidate[];
  rejected: Array<{ stemId: string; reasons: string[] }>;
};

export class SupplyGapError extends Error {
  statusCode = 422;
  constructor(public requestId: string, public unmetRequirements: string[]) {
    super(`No approved assets satisfy: ${unmetRequirements.join(', ')}`);
  }
}

const goals = new Set<ProductGoal>(['sleep', 'calm', 'focus']);
const scenesByGoal: Record<ProductGoal, ProductScene[]> = {
  sleep: ['bedtime', 'return_to_sleep'],
  calm: ['breathing', 'emotional_settling'],
  focus: ['deep_focus'],
};
const contentModes = new Set<ContentMode>(['pure_soundscape', 'functional_music', 'sound_journey', 'guided_meditation']);
const structures = new Set<AiSoundscapePlan['structure']>(['steady', 'music_later', 'environment_first', 'music_first']);
const sessionSubtypes = new Set<SessionSubtype>(['bedtime_wind_down', 'sleep_onset', 'return_to_sleep', 'all_night_masking', 'nap', 'breath_awareness', 'grounding', 'open_awareness', 'emotional_release', 'sound_meditation', 'reading_writing', 'deep_work', 'study', 'creative_work', 'repetitive_task', 'distraction_masking']);
const trajectories = new Set<DesiredTrajectory>(['settle_quickly', 'settle_gradually', 'release_then_settle', 'maintain_calm', 'maintain_alert', 'mask_distraction']);
const levels = new Set<Level>(['low', 'medium', 'high', 'unknown']);

const legacyConcepts: Record<string, string> = {
  rain: 'source.natural.water.rain',
  ocean: 'source.natural.water.ocean',
  water: 'source.natural.water',
  nature: 'source.natural',
  forest: 'source.natural.forest',
  birds: 'source.animal.bird',
  fire: 'source.natural.fire',
  wind: 'source.natural.wind',
  crickets: 'source.animal.insect.cricket',
  train: 'source.vehicle.rail.carriage',
  aircraft: 'source.vehicle.aircraft.cabin',
  indoor: 'source.domestic',
  chime: 'source.accent.chime',
  thunder: 'source.natural.thunder',
  music: 'source.music',
  voice: 'source.human.voice',
  noise: 'source.noise',
};

const normalizeLegacySoundList = (items: string[]) =>
  [...new Set(items.map((item) => String(item).trim().toLowerCase()).filter((item) => legacyConcepts[item]))];

const conceptToLegacy = (conceptId: string) => {
  // A subtype exclusion such as source.music.drone must not become the coarse legacy exclusion "music".
  const pair = Object.entries(legacyConcepts).find(([, value]) => conceptId === value);
  return pair?.[0];
};

const explicitGoalFromPrompt = (prompt: string): ProductGoal | null => {
  if (/(focus|study|concentrat|deep work|专注|学习|集中)/i.test(prompt)) return 'focus';
  if (/(sleep|bed|night|nap|insomnia|入睡|睡眠|睡觉|睡不好|睡不着|失眠|难以入睡|睡眠困难|助眠|夜醒|回睡)/i.test(prompt)) return 'sleep';
  if (/(calm|breath|breathe|anxious|stress|settle|冥想|呼吸|焦虑|压力|放松|平静)/i.test(prompt)) return 'calm';
  return null;
};

const explicitStructureFromPrompt = (prompt: string): AiSoundscapePlan['structure'] | null => {
  if (/(音乐|music).{0,18}(先|first).{0,18}(环境|底噪|background|ambience)/i.test(prompt)) return 'music_first';
  if (/(音乐晚一点|音乐.*(之后|然后|再|慢慢进入)|之后.*音乐|然后.*音乐|再.*音乐|music.{0,20}(later|after|slowly enter)|later.{0,20}music)/i.test(prompt)) return 'music_later';
  if (/(先.*(自然|环境|森林|雨|海浪|底噪).*(之后|然后|再).*(音乐|music)|start.{0,20}(nature|environment|ambience).{0,30}(then|music))/i.test(prompt)) return 'environment_first';
  return null;
};

const explicitConceptsFromPrompt = (prompt: string) => [
  { id: 'source.music.meditation', pattern: /(meditation music|sleep music|calming music|quiet music|long[- ]form ambient|rain[- ]themed ambient|dreamscape|cosmic|冥想音乐|睡眠音乐|助眠音乐|静心音乐|安静音乐|长段氛围|雨感氛围|雨感音乐|梦境感|梦幻感|宇宙感)/i },
  { id: 'source.music.pad', pattern: /(ambient pad|pad music|dreamlike ambient|dreamscape|氛围垫|铺底音乐|梦境感|梦幻感)/i },
  { id: 'source.music.drone', pattern: /(drone music|cosmic drone|low drone|持续低音|低频氛围|宇宙感|空灵低音)/i },
  { id: 'source.music', pattern: /(music|piano|pad|drone|guitar|音乐|钢琴|吉他|氛围音乐)/i },
  { id: 'source.noise.brown', pattern: /(brown noise|棕噪)/i },
  { id: 'source.noise.pink', pattern: /(pink noise|粉噪)/i },
  { id: 'source.noise.white', pattern: /(white noise|白噪)/i },
  { id: 'source.domestic.room_tone', pattern: /(room tone|quiet room|房间声|室内底噪)/i },
  { id: 'source.domestic.fan', pattern: /(fan|风扇)/i },
].filter((item) => item.pattern.test(prompt)).map((item) => item.id);

const compactConceptRequirements = (conceptIds: string[]) => [...new Set(conceptIds)].filter((conceptId, _index, values) => (
  !values.some((other) => other !== conceptId && other.startsWith(`${conceptId}.`))
));

const explicitlyRequestsSingleSource = (prompt: string, conceptIds: string[]) => {
  const hasOnlySignal = /(?:\bonly\b|\bjust\b|只要|只有|仅要|仅需)/i.test(prompt);
  return hasOnlySignal && compactConceptRequirements(conceptIds).length === 1;
};

const clamp = (value: unknown, fallback: number) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : fallback));
const matchesConcept = (candidateConcept: string, requestedConcept: string) =>
  candidateConcept === requestedConcept || candidateConcept.startsWith(`${requestedConcept}.`);
const candidateMatches = (candidate: AssetCandidate, conceptId: string) => candidate.concepts.some((item) => matchesConcept(item, conceptId));

const legacyLabelPatterns: Partial<Record<string, RegExp>> = {
  water: /(?:^|[^a-z0-9])(water|ocean|sea|rain|river|stream|waterfall|pond|wave|surf)(?:$|[^a-z0-9])|水声|雨声|海浪|河流|瀑布/i,
  ocean: /(?:^|[^a-z0-9])(ocean|sea|wave|surf)(?:$|[^a-z0-9])|海浪|海洋/i,
  rain: /(?:^|[^a-z0-9])rain(?:$|[^a-z0-9])|雨声|下雨/i,
  forest: /(?:^|[^a-z0-9])(forest|woodland|jungle)(?:$|[^a-z0-9])|森林|丛林/i,
  birds: /(?:^|[^a-z0-9])(bird|birds|birdsong)(?:$|[^a-z0-9])|鸟叫|鸟鸣|鸟声/i,
  fire: /(?:^|[^a-z0-9])(fire|fireplace|bonfire|campfire)(?:$|[^a-z0-9])|火焰|壁炉|篝火/i,
  wind: /(?:^|[^a-z0-9])(wind|breeze)(?:$|[^a-z0-9])|风声|微风/i,
  crickets: /(?:^|[^a-z0-9])(cricket|insect)(?:$|[^a-z0-9])|蟋蟀|虫鸣|夜间昆虫/i,
  train: /(?:^|[^a-z0-9])(train|rail|carriage)(?:$|[^a-z0-9])|列车|火车|车厢/i,
  aircraft: /(?:^|[^a-z0-9])(aircraft|airplane|plane cabin|aircraft cabin)(?:$|[^a-z0-9])|飞机|客舱|机舱/i,
  thunder: /(?:^|[^a-z0-9])(thunder|storm)(?:$|[^a-z0-9])|雷声|雷雨/i,
  music: /(?:^|[^a-z0-9])(music|piano|guitar|melody|instrumental)(?:$|[^a-z0-9])|音乐|钢琴|吉他|旋律/i,
  voice: /(?:^|[^a-z0-9])(voice|spoken|narration|guided)(?:$|[^a-z0-9])|人声|语音|旁白|引导/i,
};

const candidateMatchesExcludedLabel = (candidate: AssetCandidate, exclusion: string) => {
  const pattern = legacyLabelPatterns[exclusion];
  if (!pattern) return false;
  // Structured concepts are authoritative. Descriptions may explicitly say
  // "without water" or "no music" and must not be interpreted as containing it.
  return pattern.test(candidate.name);
};

const fetchCandidates = async (): Promise<AssetCandidate[]> => {
  const result = await query<any>(
    `select s.id, s.name, s.category, s.audio_url, s.default_volume,
       m.semantic_descriptions, m.roles, m.goal_fit, m.temporal_profile, m.mix_profile,
       array_remove(array_agg(sc.concept_id order by sc.concept_id), null) as concepts,
       f.duration_seconds, f.integrated_lufs, f.true_peak_db
     from audio_stems s
     join stem_metadata_v3 m on m.stem_id = s.id and m.metadata_version = 3
     left join stem_concepts sc on sc.stem_id = s.id and sc.verified = true
     left join stem_acoustic_features f on f.stem_id = s.id
     where s.qa_status = 'approved' and s.commercial_use_allowed = true and s.derivative_use_allowed = true
     group by s.id, m.stem_id, f.stem_id
     order by s.id`,
  );
  return result.rows.filter((row) => hasReadableLocalAudio(String(row.audio_url ?? ''))).map((row) => ({
    stemId: row.id,
    name: row.name,
    category: row.category,
    defaultVolume: Number(row.default_volume),
    descriptions: row.semantic_descriptions ?? [],
    metadataRoles: row.roles ?? [],
    concepts: row.concepts ?? [],
    goalFit: row.goal_fit ?? [],
    temporal: row.temporal_profile ?? {},
    mix: row.mix_profile ?? {},
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    integratedLufs: row.integrated_lufs === null ? null : Number(row.integrated_lufs),
    truePeakDb: row.true_peak_db === null ? null : Number(row.true_peak_db),
  })).filter((candidate) => isStemDurationEligible(candidate.metadataRoles, candidate.durationSeconds));
};

const allowedRoleForCandidate = (candidate: AssetCandidate, role: CandidateRole) => {
  const expected = { base: 'base.masking', environment: 'environment.scene', music: 'music.bed', accent: 'accent.event' }[role];
  return candidate.metadataRoles.includes(expected);
};

const plannerSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    goal: { type: 'string', enum: ['sleep', 'calm', 'focus'] },
    scene: { type: 'string', enum: ['bedtime', 'return_to_sleep', 'breathing', 'emotional_settling', 'deep_focus'] },
    contentMode: { type: 'string', enum: ['pure_soundscape', 'functional_music', 'sound_journey', 'guided_meditation'] },
    requiredConceptIds: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    preferredConceptIds: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    excludedConceptIds: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    structure: { type: 'string', enum: ['steady', 'music_later', 'environment_first', 'music_first'] },
    sessionSubtype: { type: 'string', enum: [...sessionSubtypes] },
    desiredTrajectory: { type: 'string', enum: [...trajectories] },
    currentState: {
      type: 'object', additionalProperties: false,
      properties: {
        mentalActivity: { type: 'string', enum: [...levels] },
        emotionalTension: { type: 'string', enum: [...levels] },
        sleepiness: { type: 'string', enum: [...levels] },
        attentionStability: { type: 'string', enum: [...levels] },
        physicalRestlessness: { type: 'string', enum: [...levels] },
      },
      required: ['mentalActivity', 'emotionalTension', 'sleepiness', 'attentionStability', 'physicalRestlessness'],
    },
    stimulationTolerance: {
      type: 'object', additionalProperties: false,
      properties: {
        eventDensity: { type: 'string', enum: [...levels] },
        transientSensitivity: { type: 'string', enum: [...levels] },
        brightness: { type: 'string', enum: ['low', 'balanced', 'high', 'unknown'] },
        rhythm: { type: 'string', enum: ['none', 'subtle', 'steady', 'unknown'] },
        melody: { type: 'string', enum: ['none', 'sparse', 'present', 'unknown'] },
        lowFrequency: { type: 'string', enum: [...levels] },
        variation: { type: 'string', enum: [...levels] },
      },
      required: ['eventDensity', 'transientSensitivity', 'brightness', 'rhythm', 'melody', 'lowFrequency', 'variation'],
    },
    context: {
      type: 'object', additionalProperties: false,
      properties: {
        device: { type: 'string', enum: ['headphones', 'speaker', 'unknown'] },
        externalNoise: { type: 'string', enum: ['quiet', 'variable', 'loud', 'unknown'] },
        timeOfDay: { type: 'string', enum: ['day', 'evening', 'night', 'unknown'] },
        loopPreference: { type: 'string', enum: ['single_session', 'continuous', 'unknown'] },
      },
      required: ['device', 'externalNoise', 'timeOfDay', 'loopPreference'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    explanation: { type: 'string', maxLength: 300 },
  },
  required: ['goal', 'scene', 'contentMode', 'requiredConceptIds', 'preferredConceptIds', 'excludedConceptIds', 'structure', 'sessionSubtype', 'desiredTrajectory', 'currentState', 'stimulationTolerance', 'context', 'confidence', 'explanation'],
} as const;

const safeStringArray = (value: unknown, allowedConcepts: Set<string>) => Array.isArray(value)
  ? [...new Set(value.map(String).filter((item) => allowedConcepts.has(item)))].slice(0, 10)
  : [];

const safeLevel = (value: unknown, fallback: Level): Level => levels.has(value as Level) ? value as Level : fallback;
const safeEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

const validateAiPlan = (value: any, allowedConcepts: Set<string>, fallback: AudioIntentV3): AiSoundscapePlan => {
  const goal = goals.has(value?.goal) ? value.goal as ProductGoal : fallback.goal;
  const scene = scenesByGoal[goal].includes(value?.scene)
    ? value.scene as ProductScene
    : scenesByGoal[goal].includes(fallback.scene)
      ? fallback.scene
      : scenesByGoal[goal][0];
  const contentMode = contentModes.has(value?.contentMode) ? value.contentMode as ContentMode : fallback.contentMode;
  const language = value?.guidedVoice?.language === 'zh' || value?.guidedVoice?.language === 'en' ? value.guidedVoice.language : fallback.guidedVoice.language;
  const density = ['light', 'standard', 'frequent'].includes(value?.guidedVoice?.density) ? value.guidedVoice.density : fallback.guidedVoice.density;
  return {
    title: `${goal === 'focus' ? 'Deep Focus' : scene === 'return_to_sleep' ? 'Return to Sleep' : goal === 'calm' ? 'Calm' : 'Bedtime'} Soundscape`,
    goal, scene, contentMode,
    requiredConceptIds: safeStringArray(value?.requiredConceptIds, allowedConcepts),
    preferredConceptIds: safeStringArray(value?.preferredConceptIds, allowedConcepts),
    excludedConceptIds: safeStringArray(value?.excludedConceptIds, allowedConcepts),
    structure: structures.has(value?.structure) ? value.structure : 'steady',
    sessionSubtype: sessionSubtypes.has(value?.sessionSubtype) ? value.sessionSubtype : fallback.sessionSubtype,
    desiredTrajectory: trajectories.has(value?.desiredTrajectory) ? value.desiredTrajectory : fallback.desiredTrajectory,
    currentState: {
      mentalActivity: safeLevel(value?.currentState?.mentalActivity, fallback.currentState.mentalActivity),
      emotionalTension: safeLevel(value?.currentState?.emotionalTension, fallback.currentState.emotionalTension),
      sleepiness: safeLevel(value?.currentState?.sleepiness, fallback.currentState.sleepiness),
      attentionStability: safeLevel(value?.currentState?.attentionStability, fallback.currentState.attentionStability),
      physicalRestlessness: safeLevel(value?.currentState?.physicalRestlessness, fallback.currentState.physicalRestlessness),
    },
    stimulationTolerance: {
      eventDensity: safeLevel(value?.stimulationTolerance?.eventDensity, fallback.stimulationTolerance.eventDensity),
      transientSensitivity: safeLevel(value?.stimulationTolerance?.transientSensitivity, fallback.stimulationTolerance.transientSensitivity),
      brightness: safeEnum(value?.stimulationTolerance?.brightness, ['low', 'balanced', 'high', 'unknown'] as const, fallback.stimulationTolerance.brightness),
      rhythm: safeEnum(value?.stimulationTolerance?.rhythm, ['none', 'subtle', 'steady', 'unknown'] as const, fallback.stimulationTolerance.rhythm),
      melody: safeEnum(value?.stimulationTolerance?.melody, ['none', 'sparse', 'present', 'unknown'] as const, fallback.stimulationTolerance.melody),
      lowFrequency: safeLevel(value?.stimulationTolerance?.lowFrequency, fallback.stimulationTolerance.lowFrequency),
      variation: safeLevel(value?.stimulationTolerance?.variation, fallback.stimulationTolerance.variation),
    },
    context: {
      device: safeEnum(value?.context?.device, ['headphones', 'speaker', 'unknown'] as const, fallback.context.device),
      externalNoise: safeEnum(value?.context?.externalNoise, ['quiet', 'variable', 'loud', 'unknown'] as const, fallback.context.externalNoise),
      timeOfDay: safeEnum(value?.context?.timeOfDay, ['day', 'evening', 'night', 'unknown'] as const, fallback.context.timeOfDay),
      loopPreference: safeEnum(value?.context?.loopPreference, ['single_session', 'continuous', 'unknown'] as const, fallback.context.loopPreference),
    },
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(value?.confidence)) ? Number(value.confidence) : fallback.confidence)),
    guidedVoice: { enabled: Boolean(value?.guidedVoice?.enabled), language, density },
    qualities: {
      warmth: clamp(value?.qualities?.warmth, fallback.qualities.warmth),
      spaciousness: clamp(value?.qualities?.spaciousness, fallback.qualities.spaciousness),
      variation: clamp(value?.qualities?.variation, fallback.qualities.variation),
    },
    selected: [],
    explanation: typeof value?.explanation === 'string' ? value.explanation.slice(0, 300) : 'Planned from the approved asset catalog.',
  };
};

const defaultStructure = (intent: AudioIntentV3): AiSoundscapePlan['structure'] => intent.contentMode === 'sound_journey' ? 'music_later' : 'steady';

const fallbackPlan = (intent: AudioIntentV3): AiSoundscapePlan => ({
  title: `${intent.scene.replaceAll('_', ' ')} soundscape`, goal: intent.goal, scene: intent.scene, contentMode: intent.contentMode,
  requiredConceptIds: [],
  preferredConceptIds: intent.environmentPreferences.map((item) => legacyConcepts[item]).filter(Boolean),
  excludedConceptIds: intent.excludedSounds.map((item) => legacyConcepts[item]).filter(Boolean),
  structure: defaultStructure(intent), guidedVoice: intent.guidedVoice, qualities: intent.qualities, selected: [],
  sessionSubtype: intent.sessionSubtype, desiredTrajectory: intent.desiredTrajectory,
  currentState: intent.currentState, stimulationTolerance: intent.stimulationTolerance, context: intent.context, confidence: intent.confidence,
  explanation: 'The external planner was unavailable, so approved assets were matched locally.',
});

const goalScore = (candidate: AssetCandidate, goal: ProductGoal, scene: ProductScene) => {
  const fit = candidate.goalFit.find((item) => item.goal === goal && item.scene === scene);
  return fit ? fit.score * (fit.verified ? 1 : 0.8) : 0;
};

const candidateScore = (candidate: AssetCandidate, plan: AiSoundscapePlan) => {
  const subtypeScore = () => {
    if (['reading_writing', 'study', 'deep_work'].includes(plan.sessionSubtype)) {
      return candidate.concepts.some((item) => ['source.music.drone', 'source.music.pad'].includes(item)) ? 3 : 0;
    }
    if (plan.sessionSubtype === 'creative_work') {
      return candidate.concepts.some((item) => ['source.music.guitar', 'source.music.pad'].includes(item)) ? 4 : 0;
    }
    if (['all_night_masking', 'distraction_masking'].includes(plan.sessionSubtype)) {
      return candidate.concepts.some((item) => item.startsWith('source.noise.')) ? 5 : 0;
    }
    if (plan.sessionSubtype === 'grounding') {
      return candidate.concepts.some((item) => ['source.natural.forest', 'source.natural.fire', 'acoustic.low_brightness'].includes(item)) ? 3 : 0;
    }
    return 0;
  };
  return goalScore(candidate, plan.goal, plan.scene) * 10
    + plan.requiredConceptIds.filter((item) => candidateMatches(candidate, item)).length * 20
    // Preferred concepts are alternatives, not cumulative bonuses. A broadly
    // tagged asset must not outrank a stronger scene fit merely by matching
    // several sibling labels such as pad, drone, and meditation.
    + (plan.preferredConceptIds.some((item) => candidateMatches(candidate, item)) ? 8 : 0)
    + (plan.stimulationTolerance.eventDensity === 'low' && candidate.concepts.includes('acoustic.low_event_density') ? 4 : 0)
    - (plan.stimulationTolerance.eventDensity === 'low' && candidate.concepts.includes('acoustic.medium_event_density') ? 3 : 0)
    - (plan.stimulationTolerance.transientSensitivity === 'high' && candidate.concepts.includes('risk.sudden_peak') ? 8 : 0)
    - (plan.currentState.attentionStability === 'low' && candidate.concepts.includes('risk.attention_capture') ? 5 : 0)
    + (plan.stimulationTolerance.brightness === 'low' && candidate.concepts.includes('acoustic.low_brightness') ? 3 : 0)
    - (plan.stimulationTolerance.brightness === 'low' && candidate.concepts.includes('acoustic.high_brightness') ? 4 : 0)
    + (plan.stimulationTolerance.rhythm === 'none' && candidate.concepts.includes('source.music.drone') ? 5 : 0)
    - (plan.stimulationTolerance.melody === 'none' && candidate.concepts.some((item) => ['source.music.piano', 'source.music.guitar', 'source.music.bell'].includes(item)) ? 6 : 0)
    + subtypeScore();
};

const sortCandidates = (candidates: AssetCandidate[], plan: AiSoundscapePlan, seed: number) => [...candidates].sort((left, right) => {
  const scoreDifference = candidateScore(right, plan) - candidateScore(left, plan);
  if (scoreDifference !== 0) return scoreDifference;
  return deterministicRecipeSeed([seed, right.stemId]) - deterministicRecipeSeed([seed, left.stemId]);
});

const sourceFamily = (candidate: AssetCandidate) => candidate.concepts.find((item) => item.startsWith('source.'))
  ?.split('.').slice(0, 3).join('.') ?? candidate.stemId;

const chooseFromTopCandidates = (input: {
  candidates: AssetCandidate[];
  plan: AiSoundscapePlan;
  seed: number;
  selectionKey: string;
  selectedCandidates?: AssetCandidate[];
}) => {
  const sorted = sortCandidates(input.candidates, input.plan, input.seed);
  if (!sorted.length) return undefined;
  const bestScore = candidateScore(sorted[0], input.plan);
  const selectedFamilies = new Set((input.selectedCandidates ?? []).map(sourceFamily));
  const nearBest = sorted.filter((candidate) => bestScore - candidateScore(candidate, input.plan) <= 1.5).slice(0, 5);
  const distinct = nearBest.filter((candidate) => !selectedFamilies.has(sourceFamily(candidate)));
  const shortlist = distinct.length > 0 ? distinct : nearBest;
  return shortlist.reduce((best, candidate) => (
    deterministicRecipeSeed([candidate.stemId, input.selectionKey, input.seed])
      > deterministicRecipeSeed([best.stemId, input.selectionKey, input.seed]) ? candidate : best
  ));
};

const modeAllowsRole = (mode: ContentMode, role: CandidateRole) => {
  if (mode === 'pure_soundscape') return role === 'base' || role === 'environment';
  if (mode === 'functional_music') return role === 'music' || role === 'base' || role === 'environment';
  return true;
};

const localSelection = (candidates: AssetCandidate[], plan: AiSoundscapePlan, seed: number, allowSingleSource: boolean) => {
  const selected: Array<{ stemId: string; role: CandidateRole; reason: string }> = [];
  const add = (candidate: AssetCandidate | undefined, role: CandidateRole, reason: string) => {
    if (!candidate || selected.some((item) => item.stemId === candidate.stemId)) return;
    selected.push({ stemId: candidate.stemId, role, reason });
  };
  for (const conceptId of plan.requiredConceptIds) {
    const candidate = chooseFromTopCandidates({
      candidates: candidates.filter((item) => candidateMatches(item, conceptId)),
      plan,
      seed,
      selectionKey: `required:${conceptId}`,
      selectedCandidates: selected.map((item) => candidates.find((candidate) => candidate.stemId === item.stemId)!).filter(Boolean),
    });
    const role = candidate?.metadataRoles.includes('music.bed') ? 'music'
      : candidate?.metadataRoles.includes('environment.scene') ? 'environment'
        : candidate?.metadataRoles.includes('accent.event') ? 'accent' : 'base';
    if (modeAllowsRole(plan.contentMode, role)) add(candidate, role, `Matches required concept ${conceptId}.`);
  }
  const findRole = (role: CandidateRole) => chooseFromTopCandidates({
    candidates: candidates.filter((item) => allowedRoleForCandidate(item, role)),
    plan,
    seed,
    selectionKey: `role:${role}`,
    selectedCandidates: selected.map((item) => candidates.find((candidate) => candidate.stemId === item.stemId)!).filter(Boolean),
  });
  const requestedSceneSource = plan.requiredConceptIds.some((id) => id.startsWith('source.natural.') || id.startsWith('source.animal.'))
    || plan.preferredConceptIds.some((id) => id.startsWith('source.natural.') || id.startsWith('source.animal.'));
  if (plan.contentMode === 'pure_soundscape' && !selected.length) {
    add(findRole(requestedSceneSource ? 'environment' : 'base'), requestedSceneSource ? 'environment' : 'base', 'Best approved match for a pure soundscape.');
  }
  if (plan.contentMode === 'functional_music') {
    if (!selected.some((item) => item.role === 'music')) {
      add(findRole('music'), 'music', 'Best approved music match.');
    }
    if (!allowSingleSource && !selected.some((item) => item.role === 'base' || item.role === 'environment')) {
      add(findRole('base'), 'base', 'Supports a non-scene functional request at low level.');
    }
  }
  if (plan.contentMode === 'sound_journey' || plan.contentMode === 'guided_meditation') {
    if (!selected.some((item) => item.role === 'environment')) {
      add(findRole(requestedSceneSource ? 'environment' : 'base') ?? findRole('environment'), requestedSceneSource ? 'environment' : 'base', 'Establishes the arrival background.');
    }
    add(findRole('music'), 'music', 'Provides the evolving core layer.');
  }
  if (!allowSingleSource && plan.contentMode === 'pure_soundscape' && selected.length < 2) {
    const selectedCandidates = selected.map((item) => candidates.find((candidate) => candidate.stemId === item.stemId)!).filter(Boolean);
    if (selected.some((item) => item.role === 'environment')) {
      add(chooseFromTopCandidates({
        candidates: candidates.filter((item) => allowedRoleForCandidate(item, 'base')),
        plan, seed, selectionKey: `support:base:${plan.goal}`, selectedCandidates,
      }), 'base', 'Adds a low-level masking bed so the result is more than a single field recording.');
    } else {
      const preferredEnvironmentConcepts = plan.goal === 'focus'
        ? ['source.domestic', 'source.vehicle.rail.carriage', 'source.vehicle.aircraft.cabin']
        : ['source.natural.wind', 'source.natural.forest', 'source.natural.fire', 'source.domestic'];
      add(chooseFromTopCandidates({
        candidates: candidates.filter((item) => allowedRoleForCandidate(item, 'environment')
          && preferredEnvironmentConcepts.some((conceptId) => candidateMatches(item, conceptId))),
        plan, seed, selectionKey: `support:environment:${plan.goal}`, selectedCandidates,
      }), 'environment', `Adds a subtle ${plan.goal} scene layer instead of returning generic noise alone.`);
    }
  }
  return selected.slice(0, 3);
};

const buildCatalogRecipe = (input: {
  title: string;
  plan: AiSoundscapePlan;
  audioIntent: PlannedAudioIntent;
  selected: Array<{ stemId: string; role: CandidateRole; reason: string }>;
  candidateById: Map<string, AssetCandidate>;
  durationSeconds: number;
  seed: number;
  allowSingleSource: boolean;
  explicitStructure: AiSoundscapePlan['structure'] | null;
}): CatalogRecipe => {
  const duration = input.durationSeconds;
  const journey = input.plan.contentMode === 'sound_journey' || input.plan.contentMode === 'guided_meditation';
  const roleVolume = (candidate: AssetCandidate, role: CandidateRole) => {
    if (candidate.integratedLufs === null || candidate.truePeakDb === null) {
      return Math.min(candidate.defaultVolume, { base: 12, environment: 9, music: 12, accent: 5 }[role]);
    }
    const targetLufs = {
      sleep: { base: -38, environment: -36, music: -34, accent: -42 },
      calm: { base: -38, environment: -35, music: -29, accent: -40 },
      focus: { base: -40, environment: -37, music: -30, accent: -42 },
    }[input.plan.goal][role];
    const targetPeak = { base: -12, environment: -10, music: -6, accent: -14 }[role];
    const loudnessLimitedPercent = 100 * (10 ** ((targetLufs - candidate.integratedLufs) / 20));
    const peakLimitedPercent = 100 * (10 ** ((targetPeak - candidate.truePeakDb) / 20));
    return Math.max(1, Math.min(100, Math.round(Math.min(loudnessLimitedPercent, peakLimitedPercent))));
  };
  const tracks: CatalogTrack[] = input.selected.map((selection) => {
    const candidate = input.candidateById.get(selection.stemId)!;
    const volume = roleVolume(candidate, selection.role);
    const isAccent = selection.role === 'accent';
    let volumeAutomation: CatalogTrack['volumeAutomation'];
    if (journey && !isAccent) {
      if (selection.role === 'music') {
        const explicitlyDeferred = input.explicitStructure === 'music_later' || input.explicitStructure === 'environment_first';
        volumeAutomation = explicitlyDeferred
          ? [{ atSeconds: 0, volume: 0 }, { atSeconds: Math.round(duration * 0.16), volume: 0 }, { atSeconds: Math.round(duration * 0.35), volume }, { atSeconds: Math.round(duration * 0.9), volume: Math.max(2, Math.round(volume * 0.65)) }, { atSeconds: duration, volume: 2 }]
          : [{ atSeconds: 0, volume: Math.max(2, Math.round(volume * (input.explicitStructure === 'music_first' ? 0.55 : 0.25))) }, { atSeconds: Math.min(8, Math.round(duration * 0.03)), volume: Math.max(3, Math.round(volume * 0.55)) }, { atSeconds: Math.min(24, Math.round(duration * 0.1)), volume }, { atSeconds: Math.round(duration * 0.9), volume: Math.max(2, Math.round(volume * 0.65)) }, { atSeconds: duration, volume: 2 }];
      } else {
        volumeAutomation = [{ atSeconds: 0, volume }, { atSeconds: Math.round(duration * 0.15), volume }, { atSeconds: Math.round(duration * 0.55), volume: Math.max(3, Math.round(volume * 0.7)) }, { atSeconds: Math.round(duration * 0.9), volume: Math.max(2, Math.round(volume * 0.5)) }, { atSeconds: duration, volume: 2 }];
      }
    } else if (!input.allowSingleSource && input.plan.goal === 'sleep' && !isAccent) {
      volumeAutomation = [
        { atSeconds: 0, volume },
        { atSeconds: Math.round(duration * 0.2), volume: Math.max(2, Math.round(volume * 0.9)) },
        { atSeconds: Math.round(duration * 0.82), volume: Math.max(2, Math.round(volume * 0.72)) },
        { atSeconds: duration, volume: Math.max(1, Math.round(volume * 0.5)) },
      ];
    } else if (!input.allowSingleSource && input.plan.goal === 'calm' && !isAccent) {
      volumeAutomation = [
        { atSeconds: 0, volume: Math.max(1, Math.round(volume * 0.55)) },
        { atSeconds: Math.round(duration * 0.18), volume },
        { atSeconds: Math.round(duration * 0.78), volume: Math.max(2, Math.round(volume * 0.82)) },
        { atSeconds: duration, volume: Math.max(1, Math.round(volume * 0.45)) },
      ];
    }
    return {
      stemId: selection.stemId, role: selection.role, volume,
      startTime: isAccent ? Math.min(30, Math.round(duration * 0.1)) : 0,
      duration: isAccent ? Math.min(10, Math.max(1, candidate.durationSeconds ?? 5)) : duration,
      trimStart: 0, trimEnd: isAccent ? Math.min(10, Math.max(1, candidate.durationSeconds ?? 5)) : duration,
      isMuted: false, volumeAutomation,
    };
  });
  const availableRoles = new Set(tracks.map((track) => track.role));
  const firstOf = (...roles: Array<'base' | 'environment' | 'music'>) => roles.find((role) => availableRoles.has(role)) ?? 'base';
  return {
    id: `ai-catalog-${input.seed}`,
    name: input.title,
    goal: input.plan.goal,
    scene: input.plan.scene,
    durationSeconds: duration,
    tracks,
    moodTags: [...new Set([
      input.plan.goal, input.plan.scene, input.plan.contentMode,
      ...input.selected.flatMap((item) => [input.candidateById.get(item.stemId)?.name ?? item.stemId, ...input.candidateById.get(item.stemId)?.concepts ?? []]),
    ])],
    contentMode: input.plan.contentMode === 'guided_meditation' ? 'sound_journey' : input.plan.contentMode,
    mixProfile: {
      phaseBalance: {
        arrival: input.plan.structure === 'music_first' ? firstOf('music', 'base', 'environment') : firstOf('base', 'environment', 'music'),
        core: firstOf('music', 'environment', 'base'),
        release: firstOf('base', 'music', 'environment'),
      },
    },
  };
};

const recordTrace = async (input: {
  requestId: string;
  candidates: AssetCandidate[];
  rejected: Array<{ stemId: string; reasons: string[] }>;
  selected: Array<{ stemId: string; role: CandidateRole; reason: string }>;
  unmet: string[];
  recipeId?: string;
  seed: number;
  provider: string;
}) => {
  await query(
    `insert into selection_traces (id, request_id, intent_version, ontology_version, embedding_model_version, candidates, rejected, selected, unmet_requirements, recipe_id, seed)
     values ($1, $2, 'audio-intent-v3', '3', $3, $4, $5, $6, $7, $8, $9)`,
    [`trace_${input.requestId}`, input.requestId, input.provider === 'rules' ? null : `llm:${input.provider}`,
      JSON.stringify(input.candidates.map((item) => ({ stemId: item.stemId, concepts: item.concepts, roles: item.metadataRoles }))),
      JSON.stringify(input.rejected), JSON.stringify(input.selected), input.unmet, input.recipeId ?? null, input.seed],
  );
};

export const planQuickCreateSoundscape = async (input: {
  prompt: string;
  requestedGoal?: ProductGoal;
  requestedScene?: ProductScene;
  guidedVoice?: boolean;
  voiceEnabled?: boolean;
  durationSeconds: number;
  environmentIntensity?: number;
  musicIntensity?: number;
  voiceIntensity?: number;
  stableExcludedSounds?: string[];
  stableLikedSounds?: string[];
}): Promise<QuickCreatePlan> => {
  const requestId = `qcp_${deterministicRecipeSeed([input.prompt, Date.now()]).toString(36)}`;
  const fallbackGoal = explicitGoalFromPrompt(input.prompt) ?? input.requestedGoal;
  const fallbackScene = input.requestedScene && fallbackGoal && scenesByGoal[fallbackGoal].includes(input.requestedScene)
    ? input.requestedScene
    : undefined;
  const fallbackIntent = parseAudioIntentV3({
    prompt: input.prompt, goal: fallbackGoal, scene: fallbackScene, guidedVoice: input.guidedVoice,
    environmentIntensity: input.environmentIntensity, musicIntensity: input.musicIntensity, voiceIntensity: input.voiceIntensity,
    durationSeconds: input.durationSeconds,
  });
  const allCandidates = await fetchCandidates();
  const allowedConceptsResult = await query<{ id: string }>("select id from audio_concepts where active = true and dimension in ('source_event', 'role') order by id");
  const allowedConcepts = new Set(allowedConceptsResult.rows.map((row) => row.id));
  let aiResult: Awaited<ReturnType<typeof requestStructuredAiJson<AiSoundscapePlan>>> = null;
  try {
    aiResult = await requestStructuredAiJson<AiSoundscapePlan>({
      schemaName: 'quick_create_soundscape_intent', schema: plannerSchema, timeoutMs: 12_000, maxTokens: 1_000,
      systemPrompt: `Understand a user's request for a sleep, calm, or focus soundscape and convert it into compact structured search requirements. Return exactly these fields: goal, scene, contentMode, requiredConceptIds, preferredConceptIds, excludedConceptIds, structure, sessionSubtype, desiredTrajectory, currentState, stimulationTolerance, context, confidence, explanation. Do not choose audio files and do not invent inventory. Treat explicit exclusions as hard constraints. Use only concept IDs shown in ALLOWED_CONCEPT_IDS. Distinguish the user's present state from the desired trajectory. Preserve sensitivity to sudden events, brightness, rhythm, melody, variation, and low-frequency weight. Put explicitly mandatory sounds in requiredConceptIds, optional or alternative sounds in preferredConceptIds, and excluded sound families in excludedConceptIds. Preserve phase instructions such as music entering later in structure. Do not make medical claims. Return JSON only.`,
      userPrompt: JSON.stringify({
        request: input.prompt,
        uiContext: {
          requestedGoal: input.requestedGoal ?? null,
          requestedScene: input.requestedScene ?? null,
          guidedVoice: Boolean(input.guidedVoice),
          durationSeconds: input.durationSeconds,
          stableExcludedSounds: input.stableExcludedSounds ?? [],
          stableLikedSounds: input.stableLikedSounds ?? [],
        },
        allowedConceptIds: [...allowedConcepts].filter((id) => id.startsWith('source.')),
      }),
    });
  } catch (error) {
    console.warn('Quick Create AI planner failed; using local approved-asset matching:', error instanceof Error ? error.message : error);
  }
  const modelPlan = aiResult ? validateAiPlan(aiResult.data, allowedConcepts, fallbackIntent) : fallbackPlan(fallbackIntent);
  const preferKnown = <T extends Record<string, string>>(local: T, model: T): T => Object.fromEntries(
    Object.entries(local).map(([key, value]) => [key, value === 'unknown' ? model[key] : value]),
  ) as T;
  const rawPlan: AiSoundscapePlan = {
    ...modelPlan,
    sessionSubtype: fallbackIntent.sessionSubtype,
    desiredTrajectory: fallbackIntent.fieldConfidence.desiredTrajectory >= 0.9
      ? fallbackIntent.desiredTrajectory
      : modelPlan.desiredTrajectory,
    currentState: preferKnown(fallbackIntent.currentState, modelPlan.currentState),
    stimulationTolerance: preferKnown(fallbackIntent.stimulationTolerance, modelPlan.stimulationTolerance),
    context: preferKnown(fallbackIntent.context, modelPlan.context),
  };
  const stableExcludedSounds = normalizeLegacySoundList(input.stableExcludedSounds ?? []);
  const stableLikedSounds = normalizeLegacySoundList(input.stableLikedSounds ?? []);
  const explicitExcludedConcepts = [...new Set([...fallbackIntent.excludedSounds, ...stableExcludedSounds])]
    .map((item) => legacyConcepts[item]).filter(Boolean);
  const explicitPreferredConcepts = [...new Set([
    ...fallbackIntent.environmentPreferences.map((item) => legacyConcepts[item]).filter(Boolean),
    ...stableLikedSounds.map((item) => legacyConcepts[item]).filter(Boolean),
    ...explicitConceptsFromPrompt(input.prompt),
  ])];
  const voiceEnabled = input.voiceEnabled !== false;
  const confirmedModelExclusions = rawPlan.excludedConceptIds.filter((modelExclusion) => (
    explicitExcludedConcepts.some((explicitExclusion) => (
      matchesConcept(modelExclusion, explicitExclusion) || matchesConcept(explicitExclusion, modelExclusion)
    ))
  ));
  const excludedConceptIds = [...new Set([
    ...confirmedModelExclusions,
    ...explicitExcludedConcepts,
    ...(voiceEnabled ? [] : ['source.human.voice']),
  ])]
    .filter((item) => (!voiceEnabled && item === 'source.human.voice')
      || explicitExcludedConcepts.includes(item)
      || !explicitPreferredConcepts.some((preferred) => matchesConcept(preferred, item)));
  // Controlled voice is attached by the voice pipeline, not selected from the shared background-stem catalog.
  const preferredConceptIds = [...new Set([...rawPlan.preferredConceptIds, ...rawPlan.requiredConceptIds, ...explicitPreferredConcepts])]
    .filter((item) => item !== 'source.human.voice')
    .filter((item) => !excludedConceptIds.some((excluded) => matchesConcept(item, excluded)));
  const explicitAlternatives = /(?:\bor\b|或者|或)/i.test(input.prompt);
  const confirmedModelRequirements = rawPlan.requiredConceptIds.filter((modelRequirement) => (
    explicitPreferredConcepts.some((explicitPreference) => (
      matchesConcept(modelRequirement, explicitPreference) || matchesConcept(explicitPreference, modelRequirement)
    ))
  ));
  const explicitEnvironmentRequirements = explicitPreferredConcepts.filter((conceptId) => !conceptId.startsWith('source.music'));
  const finishedSleepMusicRequest = fallbackIntent.goal === 'sleep'
    && /助眠音乐/i.test(input.prompt)
    && explicitExcludedConcepts.length > 0;
  const requiredConceptIds = compactConceptRequirements([
    ...confirmedModelRequirements,
    ...(explicitAlternatives
      ? []
      : finishedSleepMusicRequest
        ? explicitEnvironmentRequirements
        : explicitPreferredConcepts),
  ])
    .filter((item) => item !== 'source.human.voice')
    .filter((item) => !excludedConceptIds.some((excluded) => matchesConcept(item, excluded)));
  const voiceExcluded = !voiceEnabled || excludedConceptIds.includes('source.human.voice');
  const musicExplicitlyRequested = explicitPreferredConcepts.includes('source.music') && !excludedConceptIds.includes('source.music');
  const locallyRequestedVoice = Boolean(input.guidedVoice) || fallbackIntent.guidedVoice.enabled;
  const guidedVoice = {
    enabled: voiceEnabled && (locallyRequestedVoice || rawPlan.guidedVoice.enabled) && !voiceExcluded,
    language: locallyRequestedVoice ? fallbackIntent.guidedVoice.language : rawPlan.guidedVoice.language,
    density: rawPlan.guidedVoice.density,
  };
  const requestedGuidedMode = fallbackIntent.contentMode === 'guided_meditation' || rawPlan.contentMode === 'guided_meditation';
  const calmGuidedFallback = fallbackIntent.goal === 'calm' && !explicitExcludedConcepts.includes('source.music');
  const calmJourneyDefault = fallbackIntent.goal === 'calm'
    && ['sound_meditation', 'breath_awareness', 'open_awareness'].includes(fallbackIntent.sessionSubtype)
    && !musicExplicitlyRequested
    && !explicitExcludedConcepts.includes('source.music');
  const contentMode: ContentMode = guidedVoice.enabled
    ? 'guided_meditation'
    : !voiceEnabled && requestedGuidedMode
      ? calmGuidedFallback ? 'sound_journey' : musicExplicitlyRequested ? 'functional_music' : 'pure_soundscape'
    : fallbackIntent.contentMode === 'sound_journey'
      ? 'sound_journey'
    : calmJourneyDefault
      ? 'sound_journey'
      : musicExplicitlyRequested
        ? rawPlan.contentMode === 'sound_journey' ? 'sound_journey' : 'functional_music'
    : fallbackIntent.contentMode === 'functional_music' && !explicitExcludedConcepts.includes('source.music')
      ? 'functional_music'
    : fallbackIntent.contentMode === 'pure_soundscape' && explicitPreferredConcepts.length === 0
      ? 'pure_soundscape'
      : rawPlan.contentMode;
  const plan: AiSoundscapePlan = {
    ...rawPlan,
    contentMode,
    requiredConceptIds,
    preferredConceptIds,
    excludedConceptIds,
    guidedVoice,
    structure: explicitStructureFromPrompt(input.prompt) ?? rawPlan.structure,
  };
  const rejected = allCandidates.map((candidate) => {
    const conceptMatches = excludedConceptIds.filter((conceptId) => candidateMatches(candidate, conceptId));
    const labelMatches = fallbackIntent.excludedSounds.filter((exclusion) => candidateMatchesExcludedLabel(candidate, exclusion));
    const reasons = [
      ...(conceptMatches.length ? [`Matches excluded concept family: ${conceptMatches.join(', ')}`] : []),
      ...(labelMatches.length ? [`Matches excluded label family: ${labelMatches.join(', ')}`] : []),
    ];
    return { stemId: candidate.stemId, reasons };
  }).filter((candidate) => candidate.reasons.length > 0);
  const eligible = allCandidates.filter((candidate) => !rejected.some((item) => item.stemId === candidate.stemId));
  const applicableExplicitPreferences = explicitPreferredConcepts
    .filter((conceptId) => !excludedConceptIds.some((excluded) => matchesConcept(conceptId, excluded)));
  const explicitSceneAlternatives = applicableExplicitPreferences
    .filter((conceptId) => !conceptId.startsWith('source.noise'));
  const alternativesToRequire = explicitSceneAlternatives.length > 0 ? explicitSceneAlternatives : applicableExplicitPreferences;
  const allowSingleSource = explicitlyRequestsSingleSource(input.prompt, alternativesToRequire);
  const unmetAlternatives = explicitAlternatives
    && alternativesToRequire.length > 0
    && !eligible.some((candidate) => alternativesToRequire.some((conceptId) => candidateMatches(candidate, conceptId)))
    ? alternativesToRequire
    : [];
  const unmet = [...new Set([
    ...requiredConceptIds.filter((conceptId) => !eligible.some((candidate) => candidateMatches(candidate, conceptId))),
    ...unmetAlternatives,
  ])];
  const seed = deterministicRecipeSeed([input.prompt, plan.goal, plan.scene, contentMode]);
  if (unmet.length) {
    await recordTrace({ requestId, candidates: eligible, rejected, selected: [], unmet, seed, provider: aiResult?.provider ?? 'rules' });
    for (const conceptId of unmet) {
      await query(
        `insert into supply_gaps (id, concept_id, role, goal, scene, content_mode, phase, request_count, estimated_reuse_score, acoustic_target, example_prompts, status)
         values ($1, $2, 'requested', $3, $4, $5, 'core', 1, 1, '{}'::jsonb, $6, 'open')
         on conflict (id) do update set request_count = supply_gaps.request_count + 1,
           example_prompts = array(select distinct unnest(supply_gaps.example_prompts || excluded.example_prompts)),
           status = 'open', resolved_stem_id = null, updated_at = now()`,
        [`gap_request_${conceptId.replace(/\W+/g, '_')}_${plan.goal}_${plan.scene}`, conceptId, plan.goal, plan.scene, contentMode, [input.prompt]],
      );
    }
    throw new SupplyGapError(requestId, unmet);
  }
  const candidateById = new Map(eligible.map((candidate) => [candidate.stemId, candidate]));
  let selected = plan.selected.filter((selection) => {
    const candidate = candidateById.get(selection.stemId);
    return Boolean(candidate && allowedRoleForCandidate(candidate, selection.role) && modeAllowsRole(contentMode, selection.role));
  });
  for (const conceptId of requiredConceptIds) {
    if (selected.some((item) => candidateMatches(candidateById.get(item.stemId)!, conceptId))) continue;
    const candidate = chooseFromTopCandidates({
      candidates: eligible.filter((item) => candidateMatches(item, conceptId)),
      plan,
      seed,
      selectionKey: `required:${conceptId}`,
      selectedCandidates: selected.map((item) => candidateById.get(item.stemId)!).filter(Boolean),
    });
    if (candidate) {
      const role: CandidateRole = candidate.metadataRoles.includes('music.bed') ? 'music' : candidate.metadataRoles.includes('environment.scene') ? 'environment' : candidate.metadataRoles.includes('accent.event') ? 'accent' : 'base';
      if (modeAllowsRole(contentMode, role)) selected.push({ stemId: candidate.stemId, role, reason: `Added locally to satisfy ${conceptId}.` });
    }
  }
  if (preferredConceptIds.length > 0 && !selected.some((item) => preferredConceptIds.some((conceptId) => candidateMatches(candidateById.get(item.stemId)!, conceptId)))) {
    const preferredCandidate = chooseFromTopCandidates({
      candidates: eligible.filter((candidate) => preferredConceptIds.some((conceptId) => candidateMatches(candidate, conceptId))),
      plan,
      seed,
      selectionKey: `preferred:${preferredConceptIds.join('|')}`,
      selectedCandidates: selected.map((item) => candidateById.get(item.stemId)!).filter(Boolean),
    });
    if (preferredCandidate) {
      const role: CandidateRole = preferredCandidate.metadataRoles.includes('music.bed') ? 'music'
        : preferredCandidate.metadataRoles.includes('environment.scene') ? 'environment'
          : preferredCandidate.metadataRoles.includes('accent.event') ? 'accent' : 'base';
      if (modeAllowsRole(contentMode, role)) selected.push({ stemId: preferredCandidate.stemId, role, reason: 'Added locally to preserve an explicit sound preference.' });
    }
  }
  if (!selected.length || (contentMode === 'functional_music' && !selected.some((item) => item.role === 'music'))
    || ((contentMode === 'sound_journey' || contentMode === 'guided_meditation') && selected.filter((item) => item.role !== 'accent').length < 2)) {
    selected = localSelection(eligible, plan, seed, allowSingleSource);
  }
  if (!allowSingleSource && selected.length < 2) {
    selected = localSelection(eligible, plan, seed, false);
  }
  selected = selected
    .filter((item, index, values) => values.findIndex((other) => other.stemId === item.stemId) === index)
    .sort((left, right) => {
      const priority = (item: { stemId: string }) => requiredConceptIds.filter((conceptId) => candidateMatches(candidateById.get(item.stemId)!, conceptId)).length * 10
        + preferredConceptIds.filter((conceptId) => candidateMatches(candidateById.get(item.stemId)!, conceptId)).length * 5;
      return priority(right) - priority(left);
    })
    .slice(0, 3);
  if (!selected.length) {
    await recordTrace({ requestId, candidates: eligible, rejected, selected: [], unmet: ['approved_asset_combination'], seed, provider: aiResult?.provider ?? 'rules' });
    throw new SupplyGapError(requestId, ['approved_asset_combination']);
  }
  if (!allowSingleSource && selected.length < 2) {
    await recordTrace({ requestId, candidates: eligible, rejected, selected, unmet: ['layered_soundscape'], seed, provider: aiResult?.provider ?? 'rules' });
    throw new SupplyGapError(requestId, ['layered_soundscape']);
  }
  const legacyExcluded = [...new Set([...fallbackIntent.excludedSounds, ...stableExcludedSounds, ...excludedConceptIds.map(conceptToLegacy).filter((item): item is string => Boolean(item))])];
  // Legacy environmentPreferences are a user contract. Model-suggested concepts stay in
  // preferredConceptIds so they can guide ranking without being misreported as explicit input.
  const legacyPreferences = [...new Set([...fallbackIntent.environmentPreferences, ...stableLikedSounds])];
  const audioIntent: PlannedAudioIntent = {
    ...fallbackIntent,
    goal: plan.goal,
    scene: plan.scene,
    contentMode,
    environmentPreferences: legacyPreferences,
    excludedSounds: legacyExcluded,
    qualities: plan.qualities,
    sessionSubtype: plan.sessionSubtype,
    currentState: plan.currentState,
    desiredTrajectory: plan.desiredTrajectory,
    stimulationTolerance: plan.stimulationTolerance,
    context: plan.context,
    narrativeArc: buildNarrativeArcV3(plan.desiredTrajectory),
    confidence: plan.confidence,
    intensity: voiceEnabled ? fallbackIntent.intensity : { ...fallbackIntent.intensity, voice: 0 },
    guidedVoice,
    requiredConceptIds,
    preferredConceptIds,
    excludedConceptIds,
    planner: { provider: aiResult?.provider ?? 'rules', model: aiResult?.model ?? null, structure: plan.structure, explanation: plan.explanation },
  };
  const selectedNames = selected.map((item) => candidateById.get(item.stemId)?.name).filter(Boolean);
  const recipeTitle = selectedNames.length > 0
    ? `${selectedNames.slice(0, 2).join(' + ')} ${plan.goal === 'focus' ? 'Focus' : plan.goal === 'calm' ? 'Calm' : 'Bedtime'}`
    : plan.title;
  const recipe = buildCatalogRecipe({
    title: recipeTitle,
    plan,
    audioIntent,
    selected,
    candidateById,
    durationSeconds: input.durationSeconds,
    seed,
    allowSingleSource,
    explicitStructure: explicitStructureFromPrompt(input.prompt),
  });
  await recordTrace({ requestId, candidates: eligible, rejected, selected, unmet: [], recipeId: recipe.id, seed, provider: aiResult?.provider ?? 'rules' });
  return { requestId, audioIntent, recipe, selected, candidates: eligible, rejected };
};
