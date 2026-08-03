import { query } from './db';
import { productionMusicKitStems } from './musicKitProduction';
import { internalBaselineSeeds } from './internalBaselineCatalog';

export const AUDIO_ONTOLOGY_VERSION = 3;
export const STEM_METADATA_VERSION = 3;

type AudioConcept = {
  id: string;
  parentId?: string;
  dimension: 'source_event' | 'role' | 'acoustic' | 'affect' | 'temporal' | 'risk' | 'provenance';
  name: string;
  description: string;
  synonyms?: string[];
};

export type GoalFit = {
  goal: 'sleep' | 'calm' | 'focus';
  scene: 'bedtime' | 'return_to_sleep' | 'breathing' | 'emotional_settling' | 'deep_focus';
  score: number;
  verified: boolean;
};

export type StemMetadataSeed = {
  stemId: string;
  reviewStatus?: 'editorial_baseline' | 'catalog_baseline';
  reviewedOn?: string;
  provenanceConcept?: 'provenance.field_recording' | 'provenance.synthesized' | 'provenance.generated';
  sourceConcepts: string[];
  acousticConcepts: string[];
  affectConcepts: string[];
  semanticDescriptions: string[];
  roles: Array<'base.masking' | 'environment.scene' | 'music.bed' | 'accent.event'>;
  goalFit: GoalFit[];
  temporal: {
    loopMode: 'seamless' | 'crossfade' | 'one_shot';
    safeLoopMinSeconds?: number;
    recommendedPhases: Array<'arrival' | 'settling' | 'core' | 'release'>;
  };
  mix: {
    recommendedGainDb: [number, number];
    maxConcurrentForegrounds: number;
    frequencyRole: 'low' | 'mid' | 'high' | 'full';
  };
  risks: Array<{ riskId: string; severity: number; evidence: string }>;
};

export const isStemDurationEligible = (roles: StemMetadataSeed['roles'], durationSeconds: number | null) => {
  if (durationSeconds === null || durationSeconds <= 0) return false;
  if (roles.includes('accent.event')) return durationSeconds >= 0.25;
  if (roles.includes('environment.scene')) return durationSeconds >= 10;
  if (roles.includes('base.masking') || roles.includes('music.bed')) return durationSeconds >= 30;
  return false;
};

const concept = (
  id: string,
  dimension: AudioConcept['dimension'],
  name: string,
  description: string,
  parentId?: string,
  synonyms: string[] = [],
): AudioConcept => ({ id, dimension, name, description, parentId, synonyms });

export const audioConcepts: AudioConcept[] = [
  concept('source', 'source_event', 'Sound source', 'Root node for audible source events.'),
  concept('source.human', 'source_event', 'Human sound', 'Human-produced sound.', 'source'),
  concept('source.human.voice', 'source_event', 'Human voice', 'Spoken or guided human voice.', 'source.human', ['voice', 'speech', '人声', '引导']),
  concept('source.noise', 'source_event', 'Noise', 'Broadband and masking noise.', 'source'),
  concept('source.noise.white', 'source_event', 'White noise', 'Broad-spectrum white noise.', 'source.noise', ['white noise', '白噪音']),
  concept('source.noise.pink', 'source_event', 'Pink noise', 'Frequency-weighted pink noise.', 'source.noise', ['pink noise', '粉噪音']),
  concept('source.noise.brown', 'source_event', 'Brown noise', 'Low-frequency weighted brown noise.', 'source.noise', ['brown noise', '棕噪音']),
  concept('source.domestic', 'source_event', 'Domestic sound', 'Indoor and home acoustic sources.', 'source'),
  concept('source.domestic.room_tone', 'source_event', 'Room tone', 'Steady indoor room ambience.', 'source.domestic', ['indoor ambience', '室内底噪', '房间声']),
  concept('source.domestic.fan', 'source_event', 'Fan', 'Steady mechanical fan airflow.', 'source.domestic', ['fan hum', '风扇']),
  concept('source.domestic.air_conditioner', 'source_event', 'Air conditioner', 'Steady indoor air-conditioner hum.', 'source.domestic', ['air conditioner', 'AC hum', '空调声']),
  concept('source.domestic.humidifier', 'source_event', 'Humidifier', 'Soft continuous humidifier appliance sound.', 'source.domestic', ['humidifier', '加湿器']),
  concept('source.vehicle', 'source_event', 'Vehicle', 'Transportation sound.', 'source'),
  concept('source.vehicle.rail', 'source_event', 'Rail transport', 'Train and rail vehicle sound.', 'source.vehicle'),
  concept('source.vehicle.rail.carriage', 'source_event', 'Train carriage', 'Interior train carriage ambience.', 'source.vehicle.rail', ['train cabin', '列车', '火车车厢']),
  concept('source.vehicle.aircraft', 'source_event', 'Aircraft', 'Aircraft and aviation sound.', 'source.vehicle'),
  concept('source.vehicle.aircraft.cabin', 'source_event', 'Airplane cabin', 'Steady interior airplane cabin hum.', 'source.vehicle.aircraft', ['airplane cabin', 'plane cabin', '飞机舱']),
  concept('source.vehicle.road', 'source_event', 'Road transport', 'Road and motor-vehicle sound.', 'source.vehicle'),
  concept('source.vehicle.road.highway', 'source_event', 'Distant highway', 'Diffuse distant highway traffic bed.', 'source.vehicle.road', ['highway hum', 'distant traffic', '远处公路']),
  concept('source.natural', 'source_event', 'Natural sound', 'Natural and environmental sound.', 'source'),
  concept('source.natural.wind', 'source_event', 'Wind', 'Continuous or gently varying wind and airflow.', 'source.natural', ['wind', 'breeze', '风声', '微风']),
  concept('source.natural.vegetation', 'source_event', 'Vegetation', 'Plant and vegetation movement.', 'source.natural'),
  concept('source.natural.vegetation.leaves', 'source_event', 'Leaves', 'Dry or living leaves moving and rustling.', 'source.natural.vegetation', ['leaves', 'leaf rustle', '树叶', '树叶沙沙声']),
  concept('source.natural.thunder', 'source_event', 'Thunder', 'Thunder and storm-rumble events.', 'source.natural', ['thunder', '雷声']),
  concept('source.natural.fire', 'source_event', 'Fire', 'Fire and fireplace sound.', 'source.natural', ['fire', 'fireplace', 'campfire', '火焰', '壁炉', '篝火']),
  concept('source.natural.water', 'source_event', 'Water', 'Root water-sound family.', 'source.natural', ['water', '水声']),
  concept('source.natural.water.rain', 'source_event', 'Rain', 'Rainfall without an implied thunder event.', 'source.natural.water', ['rain', '雨声']),
  concept('source.natural.water.ocean', 'source_event', 'Ocean waves', 'Sea and ocean wave sound.', 'source.natural.water', ['ocean', 'sea waves', '海浪']),
  concept('source.natural.water.flowing', 'source_event', 'Flowing water', 'River or stream water flow.', 'source.natural.water', ['river', 'stream', '流水']),
  concept('source.natural.water.waterfall', 'source_event', 'Waterfall', 'Broad continuous waterfall sound.', 'source.natural.water', ['waterfall', '瀑布']),
  concept('source.natural.water.drop', 'source_event', 'Water drop', 'A discrete water drop event.', 'source.natural.water', ['water drip', '水滴']),
  concept('source.natural.water.bubble', 'source_event', 'Water bubble', 'A discrete bubbling water event.', 'source.natural.water', ['water bubble', '水泡']),
  concept('source.natural.forest', 'source_event', 'Forest ambience', 'Woodland environmental ambience.', 'source.natural', ['forest', '森林']),
  concept('source.animal', 'source_event', 'Animal sound', 'Animal-produced sound.', 'source'),
  concept('source.animal.bird', 'source_event', 'Bird vocalization', 'Bird calls and birdsong.', 'source.animal', ['birds', '鸟鸣']),
  concept('source.animal.insect', 'source_event', 'Insect sound', 'Insect-produced sound.', 'source.animal'),
  concept('source.animal.insect.cricket', 'source_event', 'Crickets', 'Cricket calls and night insects.', 'source.animal.insect', ['crickets', '夜间昆虫']),
  concept('source.music', 'source_event', 'Music', 'Musical content.', 'source'),
  concept('source.music.piano', 'source_event', 'Piano', 'Sparse or ambient piano music.', 'source.music', ['piano', '钢琴']),
  concept('source.music.pad', 'source_event', 'Ambient pad', 'Sustained ambient pad texture.', 'source.music', ['pad', '氛围铺底']),
  concept('source.music.drone', 'source_event', 'Drone', 'Sustained drone texture.', 'source.music', ['drone', '长音']),
  concept('source.music.meditation', 'source_event', 'Meditation music', 'Long-form calm music bed intended for meditation, sleep, and quiet settling.', 'source.music', ['meditation music', 'sleep music', '冥想音乐', '睡眠音乐', '助眠音乐', '静心音乐']),
  concept('source.music.guitar', 'source_event', 'Guitar', 'Soft ambient guitar music.', 'source.music', ['guitar', '吉他']),
  concept('source.music.bell', 'source_event', 'Meditation tones', 'Bell or bowl-like musical tones.', 'source.music', ['bell', 'bowl', '音钵']),
  concept('source.accent', 'source_event', 'Accent event', 'Discrete awareness or transition accent.', 'source'),
  concept('source.accent.chime', 'source_event', 'Chime', 'Single or sparse chime event.', 'source.accent', ['chime', '钟声']),
  concept('role.base.masking', 'role', 'Masking base', 'Steady low-attention masking layer.'),
  concept('role.environment.scene', 'role', 'Scene environment', 'Environmental layer that establishes place.'),
  concept('role.music.bed', 'role', 'Music bed', 'Music layer that supports the target state.'),
  concept('role.accent.event', 'role', 'Accent event', 'Sparse event used for transition or awareness.'),
  concept('acoustic.steady', 'acoustic', 'Steady', 'Low short-term variation.'),
  concept('acoustic.low_event_density', 'acoustic', 'Low event density', 'Few discrete attention-capturing events.'),
  concept('acoustic.medium_event_density', 'acoustic', 'Medium event density', 'Occasional distinct events.'),
  concept('acoustic.low_brightness', 'acoustic', 'Low brightness', 'Dark or low-frequency weighted spectrum.'),
  concept('acoustic.medium_brightness', 'acoustic', 'Medium brightness', 'Balanced spectrum.'),
  concept('acoustic.high_brightness', 'acoustic', 'High brightness', 'Strong upper-frequency energy.'),
  concept('affect.warm', 'affect', 'Warm', 'Warm and comforting character.'),
  concept('affect.neutral', 'affect', 'Neutral', 'Low-association neutral character.'),
  concept('affect.spacious', 'affect', 'Spacious', 'Wide or distant spatial character.'),
  concept('affect.attentive', 'affect', 'Attentive', 'Supports alert, non-sedating attention.'),
  concept('temporal.seamless_loop', 'temporal', 'Seamless loop', 'Can repeat without an exposed seam.'),
  concept('temporal.crossfade_loop', 'temporal', 'Crossfade loop', 'Requires crossfade looping.'),
  concept('temporal.one_shot', 'temporal', 'One shot', 'Plays once as a discrete event.'),
  concept('risk.urination_association', 'risk', 'Urination association', 'Water sound may trigger discomfort or bathroom association.'),
  concept('risk.attention_capture', 'risk', 'Attention capture', 'Distinct events may pull attention forward.'),
  concept('risk.fatigue', 'risk', 'Repetition fatigue', 'Long repetition may become tiring.'),
  concept('risk.sudden_peak', 'risk', 'Sudden peak', 'Transient may be startling at sleep loudness.'),
  concept('provenance.field_recording', 'provenance', 'Field recording', 'Recorded acoustic source.'),
  concept('provenance.synthesized', 'provenance', 'Synthesized', 'Locally synthesized source.'),
  concept('provenance.generated', 'provenance', 'Generated', 'Model-generated source.'),
];

const fit = (goal: GoalFit['goal'], scene: GoalFit['scene'], score: number): GoalFit => ({ goal, scene, score, verified: true });
const catalogFit = (goal: GoalFit['goal'], scene: GoalFit['scene'], score: number): GoalFit => ({ goal, scene, score, verified: false });
const sleepFit = (bedtime = 0.9, returning = 0.85): GoalFit[] => [fit('sleep', 'bedtime', bedtime), fit('sleep', 'return_to_sleep', returning)];
const calmFit = (breathing = 0.75, settling = 0.85): GoalFit[] => [fit('calm', 'breathing', breathing), fit('calm', 'emotional_settling', settling)];
const focusFit = (score = 0.85): GoalFit[] => [fit('focus', 'deep_focus', score)];
const allFit = (): GoalFit[] => [...sleepFit(0.8, 0.8), ...calmFit(0.8, 0.8), ...focusFit(0.8)];
const risk = (riskId: string, severity: number, evidence: string) => ({ riskId, severity, evidence });
const catalogFits = ({ bedtime, returning, breathing, settling, focus }: Partial<Record<'bedtime' | 'returning' | 'breathing' | 'settling' | 'focus', number>>): GoalFit[] => [
  bedtime === undefined ? null : catalogFit('sleep', 'bedtime', bedtime),
  returning === undefined ? null : catalogFit('sleep', 'return_to_sleep', returning),
  breathing === undefined ? null : catalogFit('calm', 'breathing', breathing),
  settling === undefined ? null : catalogFit('calm', 'emotional_settling', settling),
  focus === undefined ? null : catalogFit('focus', 'deep_focus', focus),
].filter((item): item is GoalFit => item !== null);

const base = (
  stemId: StemMetadataSeed['stemId'],
  sourceConcepts: string[],
  semanticDescriptions: string[],
  goalFit: GoalFit[],
  frequencyRole: StemMetadataSeed['mix']['frequencyRole'],
  acousticConcepts = ['acoustic.steady', 'acoustic.low_event_density'],
  affectConcepts = ['affect.neutral'],
  risks: StemMetadataSeed['risks'] = [],
): StemMetadataSeed => ({
  stemId, sourceConcepts, semanticDescriptions, goalFit, acousticConcepts, affectConcepts, risks,
  roles: ['base.masking'],
  temporal: { loopMode: 'seamless', safeLoopMinSeconds: 30, recommendedPhases: ['arrival', 'settling', 'core', 'release'] },
  mix: { recommendedGainDb: [-34, -26], maxConcurrentForegrounds: 0, frequencyRole },
});

const environment = (
  stemId: StemMetadataSeed['stemId'],
  sourceConcepts: string[],
  semanticDescriptions: string[],
  goalFit: GoalFit[],
  frequencyRole: StemMetadataSeed['mix']['frequencyRole'],
  risks: StemMetadataSeed['risks'] = [],
  acousticConcepts = ['acoustic.medium_event_density', 'acoustic.medium_brightness'],
): StemMetadataSeed => ({
  stemId, sourceConcepts, semanticDescriptions, goalFit, acousticConcepts, risks,
  affectConcepts: ['affect.spacious'], roles: ['environment.scene'],
  temporal: { loopMode: 'crossfade', safeLoopMinSeconds: 20, recommendedPhases: ['arrival', 'settling', 'core'] },
  mix: { recommendedGainDb: [-34, -25], maxConcurrentForegrounds: 1, frequencyRole },
});

const music = (
  stemId: StemMetadataSeed['stemId'],
  sourceConcept: string,
  description: string,
  goalFit: GoalFit[],
  frequencyRole: StemMetadataSeed['mix']['frequencyRole'],
  affectConcepts = ['affect.warm'],
): StemMetadataSeed => ({
  stemId, sourceConcepts: [sourceConcept], semanticDescriptions: [description], goalFit, affectConcepts,
  acousticConcepts: ['acoustic.low_event_density', 'acoustic.medium_brightness'], roles: ['music.bed'],
  temporal: { loopMode: 'crossfade', safeLoopMinSeconds: 30, recommendedPhases: ['settling', 'core', 'release'] },
  mix: { recommendedGainDb: [-32, -23], maxConcurrentForegrounds: 1, frequencyRole },
  risks: [risk('risk.fatigue', 0.25, 'Long-form repetition requires a collection-level listening check.')],
});

const accent = (
  stemId: string,
  sourceConcepts: string[],
  description: string,
  goalFit: GoalFit[],
  frequencyRole: StemMetadataSeed['mix']['frequencyRole'],
  risks: StemMetadataSeed['risks'] = [],
): StemMetadataSeed => ({
  stemId, sourceConcepts, semanticDescriptions: [description], goalFit, reviewStatus: 'catalog_baseline',
  acousticConcepts: ['acoustic.low_event_density', 'acoustic.medium_brightness'], affectConcepts: ['affect.spacious'], roles: ['accent.event'],
  temporal: { loopMode: 'one_shot', recommendedPhases: ['arrival', 'settling', 'release'] },
  mix: { recommendedGainDb: [-40, -30], maxConcurrentForegrounds: 1, frequencyRole },
  risks: [risk('risk.attention_capture', 0.55, 'Discrete event can pull attention forward.'), ...risks],
});

const musicKitMetadataV3: StemMetadataSeed[] = productionMusicKitStems.map(({ kit, stem }) => {
  const goalFit = kit.goal === 'sleep' ? sleepFit(0.94, 0.9)
    : kit.goal === 'focus' ? focusFit(0.94) : calmFit(0.9, 0.92);
  const sourceConcept = kit.profileId.includes('guitar') ? 'source.music.guitar' : 'source.music.piano';
  const frequencyRole: StemMetadataSeed['mix']['frequencyRole'] = stem.role === 'low_support' ? 'low' : stem.role === 'melody' ? 'mid' : 'full';
  const metadata = music(
    stem.id,
    sourceConcept,
    `${stem.role} layer from the approved ${kit.profileId} synchronized MusicKit.`,
    goalFit,
    frequencyRole,
    kit.goal === 'focus' ? ['affect.neutral', 'affect.attentive'] : ['affect.warm'],
  );
  return {
    ...metadata,
    sourceConcepts: [sourceConcept, 'source.music.meditation'],
    temporal: { loopMode: 'crossfade', safeLoopMinSeconds: kit.durationSeconds, recommendedPhases: ['arrival', 'settling', 'core', 'release'] },
    risks: stem.role === 'melody' ? [risk('risk.attention_capture', 0.25, 'Keep the melody subordinate for long functional listening.')] : metadata.risks,
    reviewedOn: '2026-07-20',
  };
});

const finishedContentMetadataV3: StemMetadataSeed[] = internalBaselineSeeds.map((seed) => ({
  ...music(
    seed.stemId,
    'source.music.meditation',
    `Owner-approved finished ${seed.goal} soundscape for ${seed.scene}.`,
    seed.goal === 'sleep' ? sleepFit(0.94, 0.92) : seed.goal === 'focus' ? focusFit(0.94) : calmFit(0.9, 0.94),
    seed.goal === 'focus' ? 'mid' : 'full',
    seed.goal === 'focus' ? ['affect.neutral', 'affect.attentive'] : ['affect.warm'],
  ),
  sourceConcepts: ['source.music.meditation'],
  temporal: { loopMode: 'crossfade', safeLoopMinSeconds: seed.durationSeconds, recommendedPhases: ['arrival', 'settling', 'core', 'release'] },
  reviewedOn: '2026-07-20',
}));

export const coreStemMetadataV3: StemMetadataSeed[] = [
  base('stem_internal_white_soft', ['source.noise.white'], ['Soft broadband masking noise with a light high-frequency texture.'], allFit(), 'full', ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.high_brightness'], ['affect.neutral'], [risk('risk.fatigue', 0.35, 'High-frequency energy can become tiring at excessive gain.')]),
  base('stem_internal_white_deep', ['source.noise.white'], ['Dense broadband white noise for strong masking and alert focus.'], catalogFits({ bedtime: 0.65, returning: 0.65, focus: 0.9 }), 'full', ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.high_brightness'], ['affect.attentive'], [risk('risk.fatigue', 0.55, 'High-frequency energy may fatigue at elevated gain.')]),
  base('stem_internal_pink_soft', ['source.noise.pink'], ['Soft balanced pink noise for unobtrusive masking.'], allFit(), 'full'),
  base('stem_internal_pink_balanced', ['source.noise.pink'], ['Balanced pink noise with steady full-spectrum support.'], [...sleepFit(), ...calmFit(), ...focusFit(0.9)], 'full'),
  base('stem_internal_brown_soft', ['source.noise.brown'], ['Soft low-frequency brown noise for sleep masking.'], [...sleepFit(0.95, 0.95), ...calmFit(0.6, 0.8)], 'low', ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness'], ['affect.warm']),
  base('stem_internal_brown_deep', ['source.noise.brown'], ['Deep low-frequency brown noise with strong masking weight.'], [...sleepFit(0.85, 0.8), ...focusFit(0.75)], 'low', ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']),
  environment('stem_mixkit_rain_2394', ['source.natural.water.rain'], ['Steady long rain bed without an intended thunder event.'], [...sleepFit(0.9, 0.85), ...calmFit(0.65, 0.8), ...focusFit(0.8)], 'full', [risk('risk.urination_association', 0.6, 'Water-family sound may be unwanted for bedtime.')]),
  environment('stem_mixkit_ocean_1195', ['source.natural.water.ocean'], ['Close sea waves with recurring surf movement.'], [...sleepFit(0.75, 0.65), ...calmFit(0.7, 0.8)], 'full', [risk('risk.urination_association', 0.7, 'Prominent water-family sound.'), risk('risk.attention_capture', 0.35, 'Wave cycles can occupy the foreground.')]),
  environment('stem_mixkit_pond_1783', ['source.natural.water', 'source.animal.insect.cricket'], ['Night pond ambience with continuous cricket activity.'], [...sleepFit(0.65, 0.6), ...calmFit(0.55, 0.7)], 'high', [risk('risk.urination_association', 0.35, 'Pond context belongs to the water family.'), risk('risk.attention_capture', 0.5, 'Insect events can hold attention.')]),
  environment('stem_mixkit_forest_1210', ['source.natural.forest', 'source.animal.bird'], ['Daytime forest ambience with noticeable birdsong.'], [...calmFit(0.8, 0.8), ...focusFit(0.45)], 'high', [risk('risk.attention_capture', 0.65, 'Bird calls are distinct foreground events.')]),
  environment('stem_mixkit_waterfall_2517', ['source.natural.water.waterfall', 'source.natural.forest'], ['Broad waterfall masking texture in a wooded setting.'], [...calmFit(0.55, 0.7), ...focusFit(0.75)], 'full', [risk('risk.urination_association', 0.8, 'Strong continuous water-family sound.'), risk('risk.fatigue', 0.35, 'Broadband water texture can fatigue at high gain.')]),
  environment('stem_mixkit_2393', ['source.natural.water.rain'], ['Light rain loop with a soft, even surface texture.'], [...sleepFit(0.9, 0.8), ...calmFit(0.6, 0.8), ...focusFit(0.75)], 'full', [risk('risk.urination_association', 0.55, 'Water-family sound may be unwanted.')]),
  environment('stem_mixkit_2474', ['source.natural.water.rain'], ['Light atmospheric rain with gentle variation.'], [...sleepFit(0.8, 0.75), ...calmFit(0.7, 0.85)], 'full', [risk('risk.urination_association', 0.55, 'Water-family sound may be unwanted.')]),
  environment('stem_mixkit_3126', ['source.natural.water.flowing'], ['Continuous flowing river water loop.'], [...calmFit(0.65, 0.8), ...focusFit(0.7)], 'full', [risk('risk.urination_association', 0.8, 'Explicit flowing-water sound.')]),
  { ...environment('stem_mixkit_1213', ['source.natural.forest'], ['European forest ambience with natural environmental variation.'], [...calmFit(0.85, 0.85), ...focusFit(0.6)], 'full', [risk('risk.attention_capture', 0.35, 'Natural events may pull attention forward.')]), reviewedOn: '2026-07-14' },
  { ...environment('stem_mixkit_2658', ['source.natural.wind'], ['Continuous authentic open-wind ambience without water.'], [...sleepFit(0.75, 0.7), ...calmFit(0.7, 0.88), ...focusFit(0.82)], 'full', [risk('risk.fatigue', 0.3, 'Broad wind can fatigue at elevated gain.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-14' },
  { ...environment('stem_commons_pine_forest_wind', ['source.natural.wind', 'source.natural.forest', 'source.natural.vegetation.leaves'], ['Authentic wind moving through a pine forest without water.'], [...sleepFit(0.82, 0.76), ...calmFit(0.82, 0.9), ...focusFit(0.74)], 'full', [risk('risk.fatigue', 0.22, 'Wind movement should remain at conservative gain.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-14' },
  { ...environment('stem_mixkit_1736', ['source.natural.fire', 'source.natural.wind'], ['Authentic campfire crackle with audible night wind.'], [...sleepFit(0.78, 0.68), ...calmFit(0.68, 0.86)], 'full', [risk('risk.sudden_peak', 0.45, 'Fire crackles require conservative gain.'), risk('risk.fatigue', 0.3, 'Wind movement may fatigue at elevated gain.')]), reviewedOn: '2026-07-14' },
  { ...environment('stem_mixkit_2414', ['source.natural.forest', 'source.animal.insect'], ['Authentic night forest with sustained insect activity and no required water layer.'], [...sleepFit(0.78, 0.7), ...calmFit(0.68, 0.76)], 'high', [risk('risk.attention_capture', 0.5, 'Repeated insect events may hold attention.')]), reviewedOn: '2026-07-14' },
  { ...environment('stem_mixkit_2475', ['source.animal.insect.cricket'], ['Authentic night crickets without an explicit water or music layer.'], [...sleepFit(0.82, 0.74), ...calmFit(0.65, 0.78)], 'high', [risk('risk.attention_capture', 0.55, 'Repeated cricket calls may hold attention.')]), reviewedOn: '2026-07-14' },
  {
    stemId: 'stem_mixkit_3109', sourceConcepts: ['source.accent.chime'], semanticDescriptions: ['Relaxing bell chime for a sparse awareness cue.'],
    roles: ['accent.event'], goalFit: calmFit(0.95, 0.65), acousticConcepts: ['acoustic.low_event_density', 'acoustic.high_brightness'], affectConcepts: ['affect.spacious'],
    temporal: { loopMode: 'one_shot', recommendedPhases: ['settling', 'release'] }, mix: { recommendedGainDb: [-38, -30], maxConcurrentForegrounds: 1, frequencyRole: 'high' },
    risks: [risk('risk.sudden_peak', 0.45, 'Chime onset must stay below the sleep transient ceiling.'), risk('risk.attention_capture', 0.65, 'Designed to capture awareness.')],
  },
  {
    stemId: 'stem_mixkit_1879', sourceConcepts: ['source.natural.water.drop'], semanticDescriptions: ['Single sparse water-drop accent with an audible decay.'],
    roles: ['accent.event'], goalFit: calmFit(0.7, 0.55), acousticConcepts: ['acoustic.low_event_density', 'acoustic.high_brightness'], affectConcepts: ['affect.spacious'],
    temporal: { loopMode: 'one_shot', recommendedPhases: ['settling'] }, mix: { recommendedGainDb: [-40, -32], maxConcurrentForegrounds: 1, frequencyRole: 'high' },
    risks: [risk('risk.urination_association', 0.75, 'Explicit water-drop event.'), risk('risk.attention_capture', 0.55, 'Discrete impact draws attention.')],
  },
  {
    stemId: 'stem_mixkit_1107', sourceConcepts: ['source.accent.chime'], semanticDescriptions: ['Single soft chime for a controlled transition cue.'],
    roles: ['accent.event'], goalFit: calmFit(0.9, 0.65), acousticConcepts: ['acoustic.low_event_density', 'acoustic.high_brightness'], affectConcepts: ['affect.spacious'],
    temporal: { loopMode: 'one_shot', recommendedPhases: ['settling', 'release'] }, mix: { recommendedGainDb: [-40, -32], maxConcurrentForegrounds: 1, frequencyRole: 'high' },
    risks: [risk('risk.sudden_peak', 0.35, 'Keep the single onset below the transient ceiling.'), risk('risk.attention_capture', 0.6, 'Designed as a transition cue.')],
  },
  music('stem_mixkit_music_614', 'source.music.piano', 'Sparse night piano with clear note events and open space.', [...sleepFit(0.9, 0.85), ...calmFit(0.55, 0.75)], 'mid'),
  music('stem_mixkit_music_587', 'source.music.piano', 'Gentle quiet piano for light meditation and settling.', [...sleepFit(0.65, 0.65), ...calmFit(0.9, 0.85)], 'mid'),
  music('stem_mixkit_music_584', 'source.music.pad', 'Soft sustained ambient pad designed for rest.', [...sleepFit(0.95, 0.85), ...calmFit(0.7, 0.85)], 'full'),
  music('stem_mixkit_music_109', 'source.music.drone', 'Deep meditation drone with a low, sustained texture.', [...sleepFit(0.7, 0.65), ...calmFit(0.9, 0.85)], 'low'),
  music('stem_mixkit_music_127', 'source.music.pad', 'Wide ambient sunset pad with a spacious slow texture.', [...sleepFit(0.65, 0.6), ...calmFit(0.75, 0.9)], 'full', ['affect.spacious']),
  music('stem_mixkit_music_493', 'source.music.guitar', 'Soft dreamy guitar with warm melodic movement.', [...sleepFit(0.75, 0.6), ...calmFit(0.65, 0.85)], 'mid'),
  music('stem_mixkit_music_441', 'source.music.bell', 'Meditation tones with discrete bell-like events.', calmFit(0.95, 0.7), 'high', ['affect.spacious']),
  music('stem_mixkit_music_251', 'source.music.drone', 'Low ambient music bed for steady sleep or focus support.', [...sleepFit(0.85, 0.75), ...focusFit(0.9)], 'low', ['affect.neutral']),
  { ...music('stem_mixkit_music_340', 'source.music.pad', 'Soft low-stimulation pad for naps, bedtime, and quiet settling.', [...sleepFit(0.9, 0.86), ...calmFit(0.68, 0.82)], 'full', ['affect.warm']), sourceConcepts: ['source.music.pad', 'source.music.meditation'] },
  { ...music('stem_mixkit_music_184', 'source.music.pad', 'Spacious ambient pad for calm focus and low-pressure meditation.', [...sleepFit(0.68, 0.7), ...calmFit(0.78, 0.86), ...focusFit(0.82)], 'full', ['affect.spacious']), sourceConcepts: ['source.music.pad', 'source.music.drone', 'source.music.meditation'] },
  { ...music('stem_batch07_fma_holizna_rain_sleep', 'source.music.meditation', 'Long-form rain-themed ambient meditation bed for sleep and calm scenes.', [...sleepFit(0.92, 0.88), ...calmFit(0.82, 0.88)], 'full', ['affect.spacious']), sourceConcepts: ['source.music.meditation', 'source.music.pad'] },
  { ...music('stem_batch07_fma_holizna_cosmic_waves', 'source.music.meditation', 'Spacious long-form ambient waves for sleep and calm scenes.', [...sleepFit(0.9, 0.84), ...calmFit(0.78, 0.88)], 'full', ['affect.spacious']), sourceConcepts: ['source.music.meditation', 'source.music.drone'] },
  { ...music('stem_batch07_fma_holizna_meditation_01', 'source.music.meditation', 'Long-form meditation bed for calm and sleep scenes.', [...sleepFit(0.85, 0.82), ...calmFit(0.9, 0.88)], 'full', ['affect.warm']), sourceConcepts: ['source.music.meditation', 'source.music.pad'] },
  { ...music('stem_batch07_fma_holizna_dreamscape', 'source.music.meditation', 'Dreamlike ambient music bed for sleep and calm scenes.', [...sleepFit(0.85, 0.8), ...calmFit(0.82, 0.88)], 'full', ['affect.spacious']), sourceConcepts: ['source.music.meditation', 'source.music.pad'] },
  { ...music('stem_batch07_incompetech_meditation_impromptu_01', 'source.music.meditation', 'Sparse CC-BY piano meditation bed for calm and sleep scenes.', [...sleepFit(0.72, 0.72), ...calmFit(0.86, 0.82)], 'mid', ['affect.warm']), sourceConcepts: ['source.music.meditation', 'source.music.piano'], risks: [risk('risk.attention_capture', 0.35, 'Piano note events may pull attention forward for sleep-sensitive listeners.'), risk('risk.fatigue', 0.3, 'Shorter melodic piece requires low-volume use and loop review.')] },
  { ...music('stem_batch07_incompetech_meditation_impromptu_02', 'source.music.meditation', 'Sparse CC-BY piano meditation bed with low-volume calm and sleep fit.', [...sleepFit(0.76, 0.74), ...calmFit(0.88, 0.84)], 'mid', ['affect.warm']), sourceConcepts: ['source.music.meditation', 'source.music.piano'], risks: [risk('risk.attention_capture', 0.3, 'Piano note events may pull attention forward for sleep-sensitive listeners.'), risk('risk.fatigue', 0.25, 'Shorter melodic piece requires low-volume use and loop review.')] },
  { ...music('stem_batch07_incompetech_meditation_impromptu_03', 'source.music.meditation', 'Sparse CC-BY piano meditation bed for calm and light sleep support.', [...sleepFit(0.7, 0.7), ...calmFit(0.84, 0.82)], 'mid', ['affect.warm']), sourceConcepts: ['source.music.meditation', 'source.music.piano'], risks: [risk('risk.attention_capture', 0.38, 'Piano note events may pull attention forward for sleep-sensitive listeners.'), risk('risk.fatigue', 0.3, 'Shorter melodic piece requires low-volume use and loop review.')] },
  { ...music('stem_batch07_scott_buckley_solace', 'source.music.meditation', 'CC-BY spacious calm/focus music bed with cinematic warmth.', [...calmFit(0.72, 0.84), ...focusFit(0.78)], 'full', ['affect.spacious']), sourceConcepts: ['source.music.meditation', 'source.music.pad'], risks: [risk('risk.attention_capture', 0.42, 'Cinematic swells can become foreground if mixed too high.'), risk('risk.fatigue', 0.3, 'Use at low volume for calm/focus rather than bedtime-first routing.')] },
  { ...music('stem_local_procedural_night_neutral_drone', 'source.music.drone', 'Deterministic low-stimulation neutral drone with no pulse or chord progression for bedtime.', [...sleepFit(0.98, 0.95), ...calmFit(0.65, 0.8)], 'low', ['affect.neutral']), provenanceConcept: 'provenance.synthesized' },
  { ...music('stem_local_procedural_deep_sleep_low', 'source.music.drone', 'Deep low-register deterministic sleep drone with no rhythmic events for bedtime and return to sleep.', [...sleepFit(0.98, 0.98), ...calmFit(0.6, 0.75)], 'low', ['affect.neutral']), provenanceConcept: 'provenance.synthesized' },
  { ...music('stem_local_procedural_return_to_sleep_soft', 'source.music.drone', 'Soft deterministic return-to-sleep drone with no pulse and a low-attention tonal bed.', [...sleepFit(0.95, 0.98), ...calmFit(0.65, 0.78)], 'low', ['affect.neutral']), provenanceConcept: 'provenance.synthesized' },
  { ...environment('stem_mixkit_2397', ['source.natural.water.rain', 'source.natural.thunder'], ['Clear rain with thunderstorm rumble for explicitly requested storm or heavy-rain scenes.'], catalogFits({ settling: 0.62, focus: 0.58 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.'), risk('risk.sudden_peak', 0.7, 'Thunder can startle sleep-sensitive listeners.')], ['acoustic.medium_event_density', 'acoustic.medium_brightness']), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2399', ['source.natural.water.rain'], ['Steady heavy rain drops with no intended human voice for masking and focus.'], catalogFits({ bedtime: 0.72, returning: 0.72, settling: 0.78, focus: 0.82 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.'), risk('risk.fatigue', 0.3, 'Heavy rain can feel dense at elevated gain.')], ['acoustic.steady', 'acoustic.medium_brightness']), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2390', ['source.natural.water.rain', 'source.natural.thunder'], ['Rain storm bed with audible thunder for explicit storm ambience requests.'], catalogFits({ settling: 0.58, focus: 0.55 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.'), risk('risk.sudden_peak', 0.78, 'Thunder events can be startling near sleep onset.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1194', ['source.natural.water.ocean'], ['Rough sea waves with broad ocean movement for coastal calm and masking.'], catalogFits({ bedtime: 0.68, returning: 0.62, breathing: 0.7, settling: 0.8, focus: 0.65 }), 'full', [risk('risk.urination_association', 0.8, 'Ocean belongs to the water family.'), risk('risk.attention_capture', 0.45, 'Rough wave cycles may become foreground.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1181', ['source.natural.water.ocean'], ['Even sea swimming loop with a close water texture for calm or focus scenes.'], catalogFits({ breathing: 0.66, settling: 0.76, focus: 0.72 }), 'full', [risk('risk.urination_association', 0.82, 'Close sea-water texture can carry bathroom association for some users.'), risk('risk.attention_capture', 0.42, 'Close water motion may occupy attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2402', ['source.natural.water.rain', 'source.natural.thunder'], ['Thunderstorm rain loop for users who explicitly ask for stormy rain ambience.'], catalogFits({ settling: 0.6, focus: 0.58 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.'), risk('risk.sudden_peak', 0.76, 'Thunderstorm peaks require conservative sleep routing.')]), reviewStatus: 'catalog_baseline' },
];

const supplementaryStemMetadataV3: StemMetadataSeed[] = [
  // Approved catalog assets receive conservative baseline labels here. Goal fits remain unverified until expert review.

  { ...environment('stem_batch09_room_apartment_small', ['source.domestic.room_tone'], ['Authentic small-apartment room tone with low event density and no audible human voice.'], [...sleepFit(0.88, 0.9), ...calmFit(0.72, 0.82), ...focusFit(0.86)], 'full', [], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_room_bedroom_night', ['source.domestic.room_tone'], ['Authentic night bedroom room tone with faint distant exterior movement and no audible human voice.'], [...sleepFit(0.92, 0.92), ...calmFit(0.7, 0.82), ...focusFit(0.72)], 'full', [risk('risk.attention_capture', 0.2, 'Faint distant exterior movement may become noticeable for highly sensitive listeners.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_room_office_distant_traffic', ['source.domestic.room_tone', 'source.vehicle.road.highway'], ['Authentic office room tone with diffuse distant traffic and no audible human voice.'], [...calmFit(0.55, 0.72), ...focusFit(0.95)], 'full', [risk('risk.attention_capture', 0.25, 'Occasional traffic variation can become noticeable at elevated gain.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_fan_deep_ventilation', ['source.domestic.fan'], ['Authentic deep indoor ventilation-fan bed with steady masking energy.'], [...sleepFit(0.88, 0.88), ...calmFit(0.58, 0.75), ...focusFit(0.92)], 'low', [risk('risk.fatigue', 0.2, 'Keep the mechanical bed below foreground level for long sessions.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_fan_mine_ventilation', ['source.domestic.fan'], ['Authentic mine ventilation fan with a stable mechanical airflow texture and no audible human voice.'], [...sleepFit(0.68, 0.7), ...calmFit(0.5, 0.68), ...focusFit(0.94)], 'low', [risk('risk.fatigue', 0.3, 'Industrial mechanical texture should remain subordinate in sleep scenes.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_train_taiwan_ep727', ['source.vehicle.rail.carriage'], ['Authentic Taiwan rail-car interior ambience with steady carriage movement and no audible human voice.'], [...sleepFit(0.62, 0.7), ...calmFit(0.55, 0.7), ...focusFit(0.95)], 'full', [risk('risk.attention_capture', 0.35, 'Rail movement variation can pull attention forward at high gain.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_air_conditioner_hum_1', ['source.domestic.air_conditioner'], ['Authentic steady air-conditioner hum for indoor masking and focus.'], [...sleepFit(0.86, 0.86), ...calmFit(0.55, 0.72), ...focusFit(0.92)], 'low', [risk('risk.fatigue', 0.18, 'Short source requires conservative crossfade repetition.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_batch09_air_conditioner_hum_2', ['source.domestic.air_conditioner'], ['A second authentic air-conditioner hum with a distinct steady spectrum.'], [...sleepFit(0.84, 0.84), ...calmFit(0.55, 0.72), ...focusFit(0.94)], 'low', [risk('risk.fatigue', 0.18, 'Short source requires conservative crossfade repetition.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_supply_gap_02_aircraft_cabin_csnmedia_381174', ['source.vehicle.aircraft.cabin'], ['Authentic steady jet-cabin rumble with no audible human voice or announcement, approved for distraction masking.'], focusFit(0.97), 'low', [risk('risk.fatigue', 0.18, 'Keep the cabin bed below foreground level during long focus sessions.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_supply_gap_02_airbus_a330_cabin_fillsoko_456092', ['source.vehicle.aircraft.cabin'], ['Authentic Airbus A330 cabin ambience with a steady low-event texture and no audible human voice or announcement.'], focusFit(0.98), 'full', [risk('risk.fatigue', 0.15, 'Use at a restrained level for long distraction-masking sessions.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewedOn: '2026-07-15' },
  { ...environment('stem_supply_gap_02_train_taiwan_all_night_variant', ['source.vehicle.rail.carriage'], ['Lower-brightness authentic Taiwan rail-car interior variant approved for low-stimulation all-night masking without audible human voice.'], [...sleepFit(0.94, 0.9), ...focusFit(0.82)], 'low', [risk('risk.attention_capture', 0.18, 'Rail movement remains recognizable and should stay below foreground level.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.low_brightness']), reviewedOn: '2026-07-15' },
  { ...music('stem_local_procedural_focus_neutral_clean', 'source.music.pad', 'Deterministic neutral ambient pad with no beat, voice, melody hook, or cinematic lift for deep focus.', focusFit(0.98), 'mid', ['affect.neutral', 'affect.attentive']), provenanceConcept: 'provenance.synthesized', reviewedOn: '2026-07-15' },
  { ...music('stem_local_procedural_focus_warm_mid', 'source.music.pad', 'Deterministic warm-mid ambient pad designed to remain unobtrusive during sustained focus.', focusFit(0.96), 'mid', ['affect.warm', 'affect.attentive']), provenanceConcept: 'provenance.synthesized', reviewedOn: '2026-07-15' },
  { ...music('stem_local_procedural_focus_low_anchor', 'source.music.pad', 'Deterministic low-register focus pad without pulse or melodic hooks.', focusFit(0.96), 'low', ['affect.neutral', 'affect.attentive']), provenanceConcept: 'provenance.synthesized', reviewedOn: '2026-07-15' },
  { ...music('stem_local_procedural_focus_open_air', 'source.music.pad', 'Deterministic spacious ambient focus pad with restrained brightness and no cinematic lift.', focusFit(0.95), 'high', ['affect.spacious', 'affect.attentive']), provenanceConcept: 'provenance.synthesized', reviewedOn: '2026-07-15' },
  accent('stem_mixkit_1278', ['source.natural.thunder'], 'Single distant thunder event for an explicitly requested storm scene.', catalogFits({ bedtime: 0.35, settling: 0.45 }), 'low', [risk('risk.sudden_peak', 0.75, 'Thunder transient can startle at sleep loudness.')]),
  accent('stem_mixkit_2395', ['source.natural.thunder'], 'Long distant thunder rumble used only for an explicitly requested storm layer.', catalogFits({ bedtime: 0.4, settling: 0.5 }), 'low', [risk('risk.sudden_peak', 0.65, 'Rumble onset and peaks require conservative gain.')]),
  accent('stem_mixkit_2428', ['source.natural.vegetation.leaves'], 'Short dry-leaf movement for a sparse forest detail.', catalogFits({ breathing: 0.55, settling: 0.7 }), 'high'),
  accent('stem_mixkit_2430', ['source.natural.vegetation.leaves', 'source.natural.wind'], 'Short leaf rustle caused by a light breeze.', catalogFits({ breathing: 0.65, settling: 0.75 }), 'high'),
  accent('stem_mixkit_1108', ['source.accent.chime'], 'Soft return chime for a controlled breathing or release transition.', catalogFits({ breathing: 0.9, settling: 0.65 }), 'high', [risk('risk.sudden_peak', 0.3, 'Keep onset below the transient ceiling.')]),
  accent('stem_mixkit_2014', ['source.accent.chime', 'source.natural.wind'], 'Light wind-chime event for an explicitly requested meditation cue.', catalogFits({ breathing: 0.8, settling: 0.6 }), 'high', [risk('risk.sudden_peak', 0.35, 'Bright onset requires low gain.')]),
  accent('stem_mixkit_1317', ['source.natural.water.bubble'], 'Single soft water-bubble event with a short decay.', catalogFits({ breathing: 0.65, settling: 0.55 }), 'high', [risk('risk.urination_association', 0.7, 'Explicit water-family event.')]),
  { ...accent('stem_bowl', ['source.music.bell'], 'Single meditation-bowl resonance for a sparse breathing cue.', catalogFits({ breathing: 0.9, settling: 0.7 }), 'mid', [risk('risk.sudden_peak', 0.35, 'Bowl onset should remain below the meditation transient ceiling.')]), provenanceConcept: 'provenance.synthesized' },
  accent('stem_b05_commons_001', ['source.music.bell'], 'Single singing-bowl resonance for a sparse breathing or release cue.', catalogFits({ breathing: 0.85, settling: 0.65 }), 'mid', [risk('risk.sudden_peak', 0.4, 'Bowl onset requires conservative gain.')]),
  accent('stem_b05_commons_002', ['source.music.bell'], 'Alternate singing-bowl resonance for an explicitly requested meditation cue.', catalogFits({ breathing: 0.85, settling: 0.65 }), 'mid', [risk('risk.sudden_peak', 0.4, 'Bowl onset requires conservative gain.')]),
  accent('stem_b05_commons_004', ['source.accent.chime'], 'Synthetic bell event for a sparse controlled transition.', catalogFits({ breathing: 0.75, settling: 0.55 }), 'high', [risk('risk.sudden_peak', 0.45, 'Bell onset requires conservative gain.')]),

  { ...environment('stem_mixkit_2427', ['source.natural.wind', 'source.natural.forest', 'source.natural.vegetation.leaves'], ['Gentle breeze moving through trees without water.'], catalogFits({ bedtime: 0.8, returning: 0.7, breathing: 0.75, settling: 0.85, focus: 0.7 }), 'full', [risk('risk.attention_capture', 0.25, 'Leaf movement may become noticeable.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_61', ['source.natural.water.flowing', 'source.animal.bird'], ['Flowing water with audible birds in the foreground.'], catalogFits({ breathing: 0.65, settling: 0.75 }), 'full', [risk('risk.urination_association', 0.8, 'Explicit flowing-water bed.'), risk('risk.attention_capture', 0.65, 'Bird calls can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1212', ['source.natural.forest', 'source.animal.bird'], ['Forest ambience dominated by distinct morning birdsong.'], catalogFits({ breathing: 0.65, settling: 0.75, focus: 0.4 }), 'high', [risk('risk.attention_capture', 0.75, 'Frequent bird calls occupy the foreground.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1225', ['source.natural.water.rain', 'source.natural.forest'], ['Forest rain loop with a continuous water bed and soft vegetation texture.'], catalogFits({ bedtime: 0.85, returning: 0.8, settling: 0.8, focus: 0.7 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2516', ['source.natural.water.waterfall', 'source.natural.forest'], ['Forest waterfall with broad masking energy.'], catalogFits({ settling: 0.75, focus: 0.75 }), 'full', [risk('risk.urination_association', 0.85, 'Strong continuous water sound.'), risk('risk.fatigue', 0.4, 'Broadband waterfall can fatigue at high gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1208', ['source.natural.water.ocean'], ['Ocean waves breaking against harbor rocks with recurring surf movement.'], catalogFits({ bedtime: 0.65, breathing: 0.7, settling: 0.75 }), 'full', [risk('risk.urination_association', 0.8, 'Prominent ocean sound.'), risk('risk.attention_capture', 0.45, 'Rock impacts create recurring events.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1247', ['source.natural.water.rain'], ['Long stable rain ambience suited to masking and return-to-sleep requests.'], catalogFits({ bedtime: 0.9, returning: 0.9, settling: 0.75, focus: 0.8 }), 'full', [risk('risk.urination_association', 0.6, 'Rain belongs to the water family.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1248', ['source.natural.water.rain', 'source.vehicle.road'], ['Rain heard on car glass with a close enclosed perspective.'], catalogFits({ bedtime: 0.85, returning: 0.8, settling: 0.75 }), 'full', [risk('risk.urination_association', 0.6, 'Rain belongs to the water family.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2458', ['source.natural.water.flowing', 'source.animal.bird'], ['Morning river with wildlife and noticeable natural events.'], catalogFits({ breathing: 0.65, settling: 0.7 }), 'full', [risk('risk.urination_association', 0.8, 'Explicit river sound.'), risk('risk.attention_capture', 0.6, 'Wildlife events can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_river', ['source.natural.water.flowing'], ['Synthesized continuous river-like flow without distinct wildlife.'], catalogFits({ breathing: 0.7, settling: 0.8, focus: 0.75 }), 'full', [risk('risk.urination_association', 0.85, 'Explicit flowing-water texture.'), risk('risk.fatigue', 0.35, 'Short source requires repetition review.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewStatus: 'catalog_baseline', provenanceConcept: 'provenance.synthesized' },
  { ...environment('stem_mixkit_2454', ['source.natural.water.flowing'], ['Continuous river water flow with moderate natural variation.'], catalogFits({ bedtime: 0.65, settling: 0.8, focus: 0.75 }), 'full', [risk('risk.urination_association', 0.85, 'Explicit flowing-water sound.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1196', ['source.natural.water.ocean'], ['Repeatable sea-wave loop with regular surf cycles.'], catalogFits({ bedtime: 0.8, returning: 0.7, settling: 0.75 }), 'full', [risk('risk.urination_association', 0.8, 'Prominent ocean sound.'), risk('risk.attention_capture', 0.35, 'Wave cycles may become foreground.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1185', ['source.natural.water.ocean', 'source.animal.bird'], ['Morning sea waves with distinct bird calls.'], catalogFits({ breathing: 0.6, settling: 0.7 }), 'full', [risk('risk.urination_association', 0.8, 'Prominent ocean sound.'), risk('risk.attention_capture', 0.7, 'Bird calls can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1253', ['source.natural.water.rain'], ['Soft even rain loop with low event density.'], catalogFits({ bedtime: 0.9, returning: 0.85, settling: 0.8, focus: 0.85 }), 'full', [risk('risk.urination_association', 0.55, 'Rain belongs to the water family.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1789', ['source.animal.insect.cricket'], ['Summer night crickets without an explicit water setting.'], catalogFits({ bedtime: 0.75, returning: 0.65, settling: 0.75 }), 'high', [risk('risk.attention_capture', 0.6, 'Repeated cricket calls may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2513', ['source.natural.water.waterfall'], ['Broad waterfall ambience for strong natural masking.'], catalogFits({ settling: 0.7, focus: 0.8 }), 'full', [risk('risk.urination_association', 0.9, 'Strong continuous water sound.'), risk('risk.fatigue', 0.45, 'Broadband waterfall can fatigue at high gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2658', ['source.natural.wind'], ['Continuous open wind ambience without water.'], catalogFits({ bedtime: 0.7, returning: 0.65, settling: 0.8, focus: 0.85 }), 'full', [risk('risk.fatigue', 0.3, 'Broad wind can fatigue at elevated gain.')], ['acoustic.steady', 'acoustic.low_event_density', 'acoustic.medium_brightness']), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1200', ['source.natural.water.ocean', 'source.natural.wind'], ['Windy coastal sea loop with both surf and strong air movement.'], catalogFits({ settling: 0.7 }), 'full', [risk('risk.urination_association', 0.8, 'Ocean belongs to the water family.'), risk('risk.fatigue', 0.45, 'Combined wind and surf can become dense.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1206', ['source.natural.water.ocean'], ['Coastal breaking waves with recurring surf movement.'], catalogFits({ bedtime: 0.65, settling: 0.75 }), 'full', [risk('risk.urination_association', 0.8, 'Prominent ocean sound.'), risk('risk.attention_capture', 0.4, 'Breaking-wave cycles can occupy the foreground.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1216', ['source.natural.water.flowing', 'source.natural.forest', 'source.animal.bird'], ['Forest river with audible bird calls.'], catalogFits({ breathing: 0.6, settling: 0.7 }), 'full', [risk('risk.urination_association', 0.85, 'Explicit flowing-water bed.'), risk('risk.attention_capture', 0.7, 'Bird calls can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1227', ['source.natural.forest', 'source.animal.insect'], ['Summer night forest with continuous insect activity.'], catalogFits({ bedtime: 0.75, returning: 0.65, settling: 0.75 }), 'high', [risk('risk.attention_capture', 0.5, 'Repeated insect events may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1238', ['source.natural.forest', 'source.natural.wind', 'source.animal.bird'], ['Windy forest with audible bird calls and vegetation movement.'], catalogFits({ breathing: 0.55, settling: 0.7 }), 'full', [risk('risk.attention_capture', 0.7, 'Bird calls and wind changes can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1736', ['source.natural.fire', 'source.natural.wind'], ['Campfire crackle with audible night wind.'], catalogFits({ bedtime: 0.7, settling: 0.8 }), 'full', [risk('risk.sudden_peak', 0.45, 'Fire crackles require conservative gain.'), risk('risk.fatigue', 0.3, 'Wind movement may fatigue at elevated gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1782', ['source.natural.forest', 'source.animal.insect.cricket'], ['Dense swamp-night cricket ambience without a required music layer.'], catalogFits({ bedtime: 0.7, returning: 0.6, settling: 0.7 }), 'high', [risk('risk.attention_capture', 0.6, 'Dense cricket calls may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1784', ['source.natural.water.flowing', 'source.animal.insect.cricket'], ['River shore with continuous cricket activity.'], catalogFits({ bedtime: 0.6, settling: 0.7 }), 'full', [risk('risk.urination_association', 0.8, 'Explicit river-shore water sound.'), risk('risk.attention_capture', 0.55, 'Cricket calls may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_1785', ['source.natural.water.flowing', 'source.animal.insect'], ['River shore with sustained insect activity.'], catalogFits({ bedtime: 0.6, settling: 0.7 }), 'full', [risk('risk.urination_association', 0.8, 'Explicit river-shore water sound.'), risk('risk.attention_capture', 0.5, 'Insect events may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2414', ['source.natural.forest', 'source.animal.insect'], ['Night forest with sustained insect activity.'], catalogFits({ bedtime: 0.75, returning: 0.65, settling: 0.7 }), 'high', [risk('risk.attention_capture', 0.5, 'Repeated insect events may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2415', ['source.natural.forest', 'source.natural.water.rain', 'source.natural.thunder'], ['Jungle rain with audible thunder events.'], catalogFits({ settling: 0.55 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.'), risk('risk.sudden_peak', 0.8, 'Thunder can startle at sleep loudness.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2431', ['source.natural.forest', 'source.natural.water.rain', 'source.animal.bird'], ['Jungle rain with distinct bird calls.'], catalogFits({ breathing: 0.55, settling: 0.7 }), 'full', [risk('risk.urination_association', 0.65, 'Rain belongs to the water family.'), risk('risk.attention_capture', 0.7, 'Bird calls can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2434', ['source.natural.forest', 'source.animal.bird'], ['Jungle ambience dominated by bird calls.'], catalogFits({ breathing: 0.6, settling: 0.65 }), 'high', [risk('risk.attention_capture', 0.8, 'Frequent bird calls occupy the foreground.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2456', ['source.natural.water.flowing', 'source.animal.bird', 'source.animal.insect'], ['River environment with mixed wildlife events.'], catalogFits({ breathing: 0.55, settling: 0.65 }), 'full', [risk('risk.urination_association', 0.8, 'Explicit river sound.'), risk('risk.attention_capture', 0.75, 'Mixed wildlife events can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2466', ['source.natural.forest', 'source.animal.bird'], ['Night forest with distinct owl calls.'], catalogFits({ bedtime: 0.55, settling: 0.65 }), 'high', [risk('risk.attention_capture', 0.8, 'Owl calls are distinct foreground events.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2473', ['source.natural.water.flowing', 'source.animal.bird'], ['Bird calls near a flowing river.'], catalogFits({ breathing: 0.55, settling: 0.65 }), 'full', [risk('risk.urination_association', 0.8, 'Explicit river sound.'), risk('risk.attention_capture', 0.75, 'Bird calls can capture attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2475', ['source.animal.insect.cricket'], ['Night crickets without an explicit water or music layer.'], catalogFits({ bedtime: 0.8, returning: 0.7, settling: 0.75 }), 'high', [risk('risk.attention_capture', 0.55, 'Repeated cricket calls may hold attention.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2514', ['source.natural.water.waterfall', 'source.natural.forest'], ['Looping forest waterfall with broad masking energy.'], catalogFits({ settling: 0.7, focus: 0.75 }), 'full', [risk('risk.urination_association', 0.9, 'Strong continuous waterfall.'), risk('risk.fatigue', 0.45, 'Broadband waterfall can fatigue at high gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2515', ['source.natural.water.waterfall'], ['Large looping waterfall with strong broadband masking.'], catalogFits({ settling: 0.65, focus: 0.8 }), 'full', [risk('risk.urination_association', 0.95, 'Strong continuous waterfall.'), risk('risk.fatigue', 0.5, 'Broadband waterfall can fatigue at high gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_2518', ['source.natural.water.waterfall'], ['Continuous flowing waterfall with moderate natural variation.'], catalogFits({ settling: 0.7, focus: 0.75 }), 'full', [risk('risk.urination_association', 0.9, 'Strong continuous waterfall.'), risk('risk.fatigue', 0.45, 'Broadband waterfall can fatigue at high gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_3030', ['source.natural.water.waterfall'], ['Large waterfall loop for strong natural masking.'], catalogFits({ settling: 0.65, focus: 0.8 }), 'full', [risk('risk.urination_association', 0.95, 'Strong continuous waterfall.'), risk('risk.fatigue', 0.55, 'Dense broadband masking can fatigue at high gain.')]), reviewStatus: 'catalog_baseline' },
  { ...environment('stem_mixkit_39', ['source.animal.insect'], ['Wild cricket and insect ambience without an explicit water layer.'], catalogFits({ bedtime: 0.75, returning: 0.65, settling: 0.7 }), 'high', [risk('risk.attention_capture', 0.6, 'Dense insect calls may hold attention.')]), reviewStatus: 'catalog_baseline' },
];

const promotedAuthenticStemIds = new Set(coreStemMetadataV3.map((metadata) => metadata.stemId));
export const matchableStemMetadataV3: StemMetadataSeed[] = [
  ...coreStemMetadataV3,
  ...musicKitMetadataV3,
  ...finishedContentMetadataV3,
  ...supplementaryStemMetadataV3.filter((metadata) => !promotedAuthenticStemIds.has(metadata.stemId)),
];

export const compatibilityEdges = [
  { leftId: 'source.vehicle.rail.carriage', rightId: 'source.noise.pink', relation: 'preferred', score: 0.85, conditions: { maxCombinedGainDb: -23 }, evidence: 'editorial', notes: 'Pink noise can smooth the train bed without changing the requested setting.' },
  { leftId: 'source.vehicle.rail.carriage', rightId: 'source.noise.brown', relation: 'preferred', score: 0.9, conditions: { maxCombinedGainDb: -24 }, evidence: 'listening_test', notes: 'Soft brown noise stabilizes the lower-brightness rail variant for all-night masking.' },
  { leftId: 'source.vehicle.aircraft.cabin', rightId: 'source.noise.pink', relation: 'preferred', score: 0.92, conditions: { maxCombinedGainDb: -23 }, evidence: 'listening_test', notes: 'Soft pink noise provides restrained broadband support beneath an authentic cabin bed.' },
  { leftId: 'source.domestic.fan', rightId: 'source.noise.pink', relation: 'preferred', score: 0.8, conditions: { maxCombinedGainDb: -24 }, evidence: 'editorial', notes: 'Stable indoor masking combination.' },
  { leftId: 'source.natural.water.ocean', rightId: 'source.music.piano', relation: 'conditional', score: 0.15, conditions: { maxCombinedGainDb: -24, requiresDucking: true, allowedPhases: ['settling', 'core'] }, evidence: 'listening_test', notes: 'Only valid when one layer clearly recedes.' },
  { leftId: 'source.animal.bird', rightId: 'goal.focus.deep_work', relation: 'avoid', score: -0.65, conditions: {}, evidence: 'editorial', notes: 'Distinct calls can interrupt sustained attention.' },
  { leftId: 'source.natural.water', rightId: 'risk.urination_association', relation: 'conditional', score: -0.5, conditions: {}, evidence: 'listening_test', notes: 'Exclude the full family for users with this sensitivity.' },
  { leftId: 'source.accent.chime', rightId: 'goal.sleep.bedtime', relation: 'conditional', score: -0.2, conditions: { maxCombinedGainDb: -30, allowedPhases: ['arrival'] }, evidence: 'editorial', notes: 'Avoid repeated chimes after the arrival phase.' },
] as const;

const conceptIdsForStem = (metadata: StemMetadataSeed) => [
  ...metadata.sourceConcepts,
  ...metadata.acousticConcepts,
  ...metadata.affectConcepts,
  ...metadata.roles.map((role) => `role.${role}`),
  metadata.temporal.loopMode === 'seamless'
    ? 'temporal.seamless_loop'
    : metadata.temporal.loopMode === 'crossfade'
      ? 'temporal.crossfade_loop'
      : 'temporal.one_shot',
  ...metadata.risks.map((item) => item.riskId),
  metadata.provenanceConcept ?? (metadata.stemId.startsWith('stem_internal_') ? 'provenance.synthesized' : 'provenance.field_recording'),
];

export const seedAudioKnowledgeV3 = async () => {
  for (const item of audioConcepts) {
    await query(
      `insert into audio_concepts (id, ontology_version, parent_id, dimension, name, description, synonyms)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set ontology_version = excluded.ontology_version, parent_id = excluded.parent_id,
         dimension = excluded.dimension, name = excluded.name, description = excluded.description,
         synonyms = excluded.synonyms, active = true, updated_at = now()`,
      [item.id, AUDIO_ONTOLOGY_VERSION, item.parentId ?? null, item.dimension, item.name, item.description, item.synonyms ?? []],
    );
  }

  for (const metadata of matchableStemMetadataV3) {
    const conceptSource = metadata.reviewStatus === 'catalog_baseline' ? 'rules' : 'editorial';
    await query(
      `insert into stem_metadata_v3 (stem_id, metadata_version, semantic_descriptions, roles, goal_fit, temporal_profile, mix_profile, risks, review)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (stem_id) do update set metadata_version = excluded.metadata_version,
         semantic_descriptions = excluded.semantic_descriptions, roles = excluded.roles,
         goal_fit = excluded.goal_fit, temporal_profile = excluded.temporal_profile,
         mix_profile = excluded.mix_profile, risks = excluded.risks, review = excluded.review, updated_at = now()`,
      [metadata.stemId, STEM_METADATA_VERSION, metadata.semanticDescriptions, metadata.roles, JSON.stringify(metadata.goalFit),
        JSON.stringify(metadata.temporal), JSON.stringify(metadata.mix), JSON.stringify(metadata.risks),
        JSON.stringify({
          labeledAt: metadata.reviewedOn ?? '2026-07-13',
          contentVerifiedAt: metadata.reviewStatus === 'catalog_baseline' ? null : metadata.reviewedOn ?? '2026-07-13',
          reviewerIds: metadata.reviewStatus === 'catalog_baseline' ? [] : ['project_owner'],
          status: metadata.reviewStatus ?? 'editorial_baseline',
        })],
    );
    await query("delete from stem_concepts where stem_id = $1 and source in ('editorial', 'rules')", [metadata.stemId]);
    for (const conceptId of new Set(conceptIdsForStem(metadata))) {
      await query(
        `insert into stem_concepts (stem_id, concept_id, confidence, source, verified, reviewed_at)
         values ($1, $2, 1, $3, true, now())
         on conflict (stem_id, concept_id, source) do update set confidence = 1, verified = true, reviewed_at = now()`,
        [metadata.stemId, conceptId, conceptSource],
      );
    }
  }

  for (const edge of compatibilityEdges) {
    await query(
      `insert into stem_compatibility_edges (left_id, right_id, relation, score, conditions, evidence, notes)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (left_id, right_id) do update set relation = excluded.relation, score = excluded.score,
         conditions = excluded.conditions, evidence = excluded.evidence, notes = excluded.notes, updated_at = now()`,
      [edge.leftId, edge.rightId, edge.relation, edge.score, JSON.stringify(edge.conditions), edge.evidence, edge.notes],
    );
  }
};
