import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CatalogRecipe, CatalogTrack, ProductGoal, ProductScene } from './contentCatalog';

type AtomicAudioElement = {
  elementId: string;
  elementType: 'single_note' | 'harmony_cell' | 'short_motif' | 'bass_support';
  goal: ProductGoal;
  instrument: string;
  instrumentSourceId: string;
  notes: string[];
  preparedAudioUrl: string;
  durationSeconds: number;
  analysis: {
    durationSeconds: number;
    peakDbfs: number;
    integratedLufs: number;
    sampleRate: number;
  };
};

type AtomicSymbolicElement = {
  elementId: string;
  elementType: string;
  goal: ProductGoal | 'multi';
};

type AtomicManifest = {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  audioElements: AtomicAudioElement[];
  symbolicElements: AtomicSymbolicElement[];
};

type OwnerDecision = {
  ownerDecision: string;
  quickCreatePilotAllowed: boolean;
  productionAllowed: boolean;
  requiredRuntimeFlag: string;
};

type GoalSuitability = 'primary' | 'secondary' | 'avoid' | 'not_applicable';

type EligibilityMapping = {
  id: string;
  sourceKind: 'atomic_audio' | 'deterministic_audio' | 'dsp_config' | 'symbolic_rule';
  sourceBatchId: string;
  recipeRole: string;
  goalSuitability: Record<ProductGoal, GoalSuitability>;
  foregroundAllowed: boolean;
  supportOnly: boolean;
  defaultGainDb: number | null;
  minGainDb: number | null;
  maxGainDb: number | null;
  maxSimultaneousInstances: number;
  loopPolicy: string;
  routeStatus: string;
  hardExclusions: string[];
  riskTags: string[];
  notes: string;
  audioUrl?: string;
  productionAllowed: false;
  formalUsable: false;
};

type EligibilityMap = {
  mapId: string;
  status: string;
  ownerDecision: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  eligibilities: EligibilityMapping[];
};

type FoundationalMaterialOwnerDecision = {
  ownerDecision: string;
  nextAllowedStage: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
};

export type AtomicElementCompositionPlan = {
  id: string;
  version: '1.0.0';
  source: 'atomic-foundation-elements-v1' | 'foundational_recipe_eligibility_map_v1';
  goal: ProductGoal;
  scene: ProductScene;
  selectionSeed: number;
  selected: Array<{
    stemId: string;
    atomicElementId: string;
    elementType: AtomicAudioElement['elementType'];
    instrument: string;
    notes: string[];
    reason: string;
    eligibilityId?: string;
    recipeRole?: string;
    sourceKind?: EligibilityMapping['sourceKind'];
    routeStatus?: string;
    supportOnly?: boolean;
    riskTags?: string[];
  }>;
  selectedSymbolicRuleIds: string[];
  runtimeExternalApiUsed: false;
  pilotOnly: true;
  eligibilityMapId?: 'foundational_recipe_eligibility_map_v1';
};

const root = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(root, 'public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json');
const ownerDecisionPath = path.join(root, 'config/atomic-composer-router-proof-v1-owner-decision.json');
const eligibilityMapPath = path.join(root, 'config/foundational-recipe-eligibility-map-v1.json');
const foundationalMaterialDecisionPath = path.join(root, 'config/foundational-material-complete-v1-owner-decision.json');

const readJson = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, 'utf8')) as T;

const manifest = readJson<AtomicManifest>(manifestPath);
const ownerDecision = readJson<OwnerDecision>(ownerDecisionPath);
const eligibilityMap = readJson<EligibilityMap>(eligibilityMapPath);
const foundationalMaterialDecision = readJson<FoundationalMaterialOwnerDecision>(foundationalMaterialDecisionPath);

if (manifest.batchId !== 'atomic-foundation-elements-v1' || manifest.status !== 'atomic_foundation_elements_pending_human_review') {
  throw new Error('Atomic foundation elements manifest is not in the expected reviewed source state.');
}
if (ownerDecision.ownerDecision !== 'passed_for_quick_create_pilot' || ownerDecision.quickCreatePilotAllowed !== true) {
  throw new Error('Atomic composer router proof has not been approved for Quick Create pilot.');
}
if (
  eligibilityMap.mapId !== 'foundational_recipe_eligibility_map_v1'
  || eligibilityMap.status !== 'recipe_eligibility_mapping_ready_for_router_integration'
  || eligibilityMap.productionAllowed !== false
  || eligibilityMap.formalUsablePromotionAllowed !== false
) {
  throw new Error('Foundational Recipe Eligibility Map V1 is not in the expected router-integration state.');
}
if (
  foundationalMaterialDecision.ownerDecision !== 'passed_for_recipe_eligibility_mapping'
  || foundationalMaterialDecision.nextAllowedStage !== 'foundational_recipe_eligibility_map_v1'
  || foundationalMaterialDecision.productionAllowed !== false
  || foundationalMaterialDecision.formalUsablePromotionAllowed !== false
) {
  throw new Error('Foundational Material Complete V1 has not been accepted for recipe eligibility mapping.');
}

export const atomicQuickCreatePilotEnabled = () => process.env.ATOMIC_QUICK_CREATE_PILOT === '1';
export const foundationalEligibilityMapPilotEnabled = () => process.env.FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1 === '1';

const hash = (value: string) => {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const shaForPublicUrl = (publicUrl: string) => {
  const filePath = path.join(root, 'public', publicUrl.replace(/^\//, ''));
  return existsSync(filePath) ? createHash('sha256').update(readFileSync(filePath)).digest('hex') : createHash('sha256').update(publicUrl).digest('hex');
};

const stemIdFor = (elementId: string) => `stem_atomic_${elementId}`;
const eligibilityStemIdFor = (mapping: EligibilityMapping) =>
  mapping.sourceKind === 'atomic_audio' ? stemIdFor(mapping.id) : `stem_foundation_${mapping.id}`;

export const atomicFoundationElements = manifest.audioElements;
export const foundationalEligibilityAudioElements = eligibilityMap.eligibilities.filter((item) => item.audioUrl);

export const getAtomicFoundationStems = () => manifest.audioElements.map((element) => ({
  id: stemIdFor(element.elementId),
  name: element.elementId.replace(/^atom_/, '').replaceAll('_', ' '),
  category: 'Music',
  audioUrl: element.preparedAudioUrl,
  isPremium: false,
  tags: [
    'Atomic Foundation',
    'Quick Create Pilot',
    element.goal,
    element.elementType,
    element.instrument,
    element.instrumentSourceId,
  ],
  defaultVolume: element.goal === 'focus' ? 38 : element.goal === 'calm' ? 34 : 30,
  description: `Owner-approved atomic ${element.elementType} for ${element.goal}; used only by the local Atomic Quick Create pilot until release gates pass.`,
  sourcePlatform: 'MixStil atomic foundation element renderer',
  sourceUrl: `internal://snooze/atomic-foundation-elements-v1/${element.elementId}`,
  sourceItemId: element.elementId,
  sourceCreator: 'MixStil internal composition system',
  licenseName: 'MixStil original/internal generated audio element for pilot validation',
  licenseUrl: 'internal://snooze/atomic-foundation-elements-v1-owner-decision',
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  attributionRequired: false,
  rawRedistributionAllowed: false,
  qaStatus: 'approved',
  qaNotes: 'Owner passed Atomic Foundation Elements V1 and Atomic Composer Router Proof V1 for local Quick Create pilot only; not public release promoted.',
  fileSha256: shaForPublicUrl(element.preparedAudioUrl),
  importedAt: null,
}));

const goalDefaultVolume = (mapping: EligibilityMapping) => {
  if (mapping.recipeRole === 'playable_note_source') return 42;
  if (mapping.recipeRole === 'harmony_cell') return 44;
  if (mapping.recipeRole === 'melodic_motif') return 32;
  if (mapping.recipeRole === 'bass_support') return 24;
  if (mapping.recipeRole === 'environment_identity_bed') return mapping.supportOnly ? 18 : 32;
  if (mapping.recipeRole === 'organic_texture') return 36;
  if (mapping.recipeRole === 'accent_transition') return 6;
  if (mapping.recipeRole === 'masking_support') return 22;
  return 4;
};

export const getFoundationalEligibilityStems = () => foundationalEligibilityAudioElements.map((mapping) => ({
  id: eligibilityStemIdFor(mapping),
  name: mapping.id.replace(/^(atom_|proc_)/, '').replaceAll('_', ' '),
  category: mapping.recipeRole.includes('environment') ? 'Nature' : mapping.recipeRole.includes('masking') ? 'Noise' : 'Music',
  audioUrl: mapping.audioUrl!,
  isPremium: false,
  tags: [
    'Foundational Recipe Eligibility Map',
    mapping.sourceKind,
    mapping.recipeRole,
    mapping.routeStatus,
    mapping.supportOnly ? 'support_only' : 'foreground_possible',
    ...Object.entries(mapping.goalSuitability).filter(([, value]) => value === 'primary').map(([goal]) => goal),
    ...mapping.riskTags,
  ],
  defaultVolume: goalDefaultVolume(mapping),
  description: `Eligibility-map ${mapping.recipeRole}; ${mapping.notes}`,
  sourcePlatform: 'MixStil foundational recipe eligibility map',
  sourceUrl: `internal://snooze/foundational-recipe-eligibility-map-v1/${mapping.id}`,
  sourceItemId: mapping.id,
  sourceCreator: 'MixStil internal composition system',
  licenseName: 'MixStil original/internal foundational audio element for Recipe eligibility pilot',
  licenseUrl: 'internal://snooze/foundational-material-complete-v1-owner-decision',
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  attributionRequired: false,
  rawRedistributionAllowed: false,
  qaStatus: 'approved',
  qaNotes: 'Owner said Foundational Material Complete V1 sounds good; Recipe eligibility map passed validation. Pilot-only, not public production promoted.',
  fileSha256: shaForPublicUrl(mapping.audioUrl!),
  importedAt: null,
}));

const byTypeAndGoal = (goal: ProductGoal, type: AtomicAudioElement['elementType']) =>
  manifest.audioElements.filter((element) => element.goal === goal && element.elementType === type);

const symbolicForGoal = (goal: ProductGoal) =>
  manifest.symbolicElements
    .filter((element) => element.goal === goal || element.goal === 'multi')
    .map((element) => element.elementId);

const pick = <T>(items: T[], key: string) => items[hash(key) % items.length];

const trackForElement = (
  element: AtomicAudioElement,
  role: CatalogTrack['role'],
  volume: number,
  durationSeconds: number,
  volumeAutomation?: CatalogTrack['volumeAutomation'],
): CatalogTrack => ({
  stemId: stemIdFor(element.elementId),
  role,
  volume,
  startTime: 0,
  duration: durationSeconds,
  trimStart: 0,
  trimEnd: Math.max(0.5, element.durationSeconds),
  isMuted: false,
  volumeAutomation,
});

const arc = (duration: number, arrival: number, core: number, release: number) => [
  { atSeconds: 0, volume: arrival },
  { atSeconds: Math.round(duration * 0.12), volume: core },
  { atSeconds: Math.round(duration * 0.88), volume: core },
  { atSeconds: duration, volume: release },
];

const explicitMusic = (prompt: string) => /(music|piano|guitar|rhodes|instrumental|melody|音乐|轻音乐|钢琴|吉他|电钢琴|旋律|乐器|和声|动机)/i.test(prompt);
const explicitlyExcludes = (prompt: string, words: string[]) => words.some((word) => (
  new RegExp(`(?:no|without|exclude|remove|不要|不想要|没有|去掉|不能有|不能包含|不能出现)[^,.，。]{0,20}${word}|${word}[^,.，。]{0,10}(?:不要|去掉|不能有|不能包含|不能出现)`, 'i').test(prompt)
));
const riskyBedTexture = (mapping: EligibilityMapping) =>
  mapping.riskTags.includes('road_like_or_hvac_like_review') || mapping.riskTags.includes('water_association_review');

const safeTextureIdsByUse = {
  sleepDark: ['proc_brown_velvet_hush_a', 'proc_brown_velvet_hush_b', 'proc_dark_granular_smooth_a', 'proc_dark_granular_smooth_b', 'proc_low_felt_resonance_a', 'proc_low_felt_resonance_b'],
  focusMasking: ['proc_dark_granular_smooth_a', 'proc_dark_granular_smooth_b', 'proc_low_felt_resonance_a', 'proc_low_felt_resonance_b', 'proc_warm_pink_haze_a', 'proc_warm_pink_haze_b'],
  neutral: ['proc_dark_granular_smooth_a', 'proc_dark_granular_smooth_b', 'proc_low_felt_resonance_a', 'proc_low_felt_resonance_b', 'proc_warm_pink_haze_a', 'proc_warm_pink_haze_b', 'proc_brown_velvet_hush_a', 'proc_brown_velvet_hush_b'],
} as const;

const environmentPreferencePattern = (preference: string) => {
  if (preference === 'rain') return /rain/i;
  if (preference === 'ocean' || preference === 'sea') return /ocean|sea/i;
  if (preference === 'water') return /rain|ocean|water|sea|river|stream/i;
  if (preference === 'forest') return /forest|pine/i;
  if (preference === 'fire') return /fire/i;
  if (preference === 'indoor') return /room_air|room|fan|indoor/i;
  if (preference === 'noise') return /pink|brown|noise|haze|hush/i;
  if (preference === 'wind') return /wind|air/i;
  return new RegExp(preference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
};

const environmentPreferenceLabel = (preference: string) => {
  if (preference === 'rain') return 'rain';
  if (preference === 'ocean' || preference === 'sea') return 'ocean';
  if (preference === 'water') return 'water';
  if (preference === 'forest') return 'forest';
  if (preference === 'fire') return 'fire';
  if (preference === 'indoor') return 'indoor';
  if (preference === 'noise') return 'noise';
  if (preference === 'wind') return 'wind';
  return preference;
};

const eligibilityMappings = eligibilityMap.eligibilities;
const atomicAudioById = new Map(manifest.audioElements.map((item) => [item.elementId, item]));

const eligibilityForGoal = (goal: ProductGoal, options: { includeSecondary?: boolean } = {}) =>
  foundationalEligibilityAudioElements.filter((item) => {
    const suitability = item.goalSuitability[goal];
    return suitability === 'primary' || (options.includeSecondary && suitability === 'secondary');
  });

const excludesMapping = (prompt: string, excludedSounds: string[], mapping: EligibilityMapping) => {
  const lower = prompt.toLowerCase();
  const explicitExcluded = (words: string[]) => explicitlyExcludes(lower, words) || words.some((word) => excludedSounds.includes(word));
  if (explicitExcluded(['music', '音乐']) && ['playable_note_source', 'harmony_cell', 'melodic_motif', 'bass_support'].includes(mapping.recipeRole)) return true;
  if (explicitExcluded(['piano', '钢琴']) && /piano/.test(mapping.id)) return true;
  if (explicitExcluded(['guitar', '吉他']) && /guitar/.test(mapping.id)) return true;
  if (explicitExcluded(['rhodes', 'electric piano', '电钢琴']) && /rhodes/.test(mapping.id)) return true;
  if (explicitExcluded(['rain', '雨', '雨声']) && (/rain/.test(mapping.id) || mapping.riskTags.includes('water_association_review'))) return true;
  if (explicitExcluded(['ocean', 'water', 'sea', '海', '水', '水声', '海浪']) && (/ocean|water|rain/.test(mapping.id) || mapping.riskTags.includes('water_association_review'))) return true;
  if (explicitExcluded(['road', 'highway', 'car', 'traffic', 'hvac', 'machine', '公路', '高速', '汽车', '车流', '机器', '机械', '空调']) && mapping.riskTags.includes('road_like_or_hvac_like_review')) return true;
  if (explicitExcluded(['noise', 'white noise', 'pink noise', 'brown noise', '噪声', '白噪音', '粉噪音', '棕噪音']) && mapping.recipeRole === 'masking_support') return true;
  return false;
};

const pickMapping = (items: EligibilityMapping[], key: string) => {
  if (items.length === 0) return null;
  return items[hash(key) % items.length];
};

const durationForScene = (scene: ProductScene) =>
  scene === 'bedtime' ? 1800 : scene === 'return_to_sleep' ? 900 : scene === 'deep_focus' ? 1500 : 1200;

const sourceDurationFor = (mapping: EligibilityMapping) => {
  if (mapping.sourceKind === 'atomic_audio') return atomicAudioById.get(mapping.id)?.durationSeconds ?? 4;
  return mapping.recipeRole === 'accent_transition' ? 8 : 60;
};

const volumeFor = (mapping: EligibilityMapping, goal: ProductGoal) => {
  const base = goalDefaultVolume(mapping);
  if (goal === 'sleep' && mapping.recipeRole === 'melodic_motif') return Math.max(10, base - 4);
  if (goal === 'focus' && mapping.recipeRole === 'environment_identity_bed') return Math.min(22, base + 2);
  return base;
};

const trackForMapping = (
  mapping: EligibilityMapping,
  goal: ProductGoal,
  durationSeconds: number,
  order: number,
): CatalogTrack => {
  const role: CatalogTrack['role'] = mapping.recipeRole === 'environment_identity_bed'
    ? 'environment'
    : mapping.recipeRole === 'accent_transition'
      ? 'accent'
      : mapping.recipeRole === 'masking_support' || mapping.recipeRole === 'organic_texture'
        ? 'base'
        : 'music';
  const volume = volumeFor(mapping, goal);
  const sourceDuration = sourceDurationFor(mapping);
  const trackDuration = mapping.recipeRole === 'accent_transition' ? Math.min(8, sourceDuration) : durationSeconds;
  const startTime = mapping.recipeRole === 'accent_transition' ? Math.round(durationSeconds * (0.18 + order * 0.08)) : 0;
  return {
    stemId: eligibilityStemIdFor(mapping),
    role,
    volume,
    sourceGainDb: mapping.sourceKind === 'atomic_audio' ? 8 : mapping.recipeRole === 'masking_support' ? 6 : mapping.recipeRole === 'organic_texture' ? 8 : 4,
    startTime,
    duration: trackDuration,
    trimStart: 0,
    trimEnd: sourceDuration,
    isMuted: false,
    loop: {
      enabled: mapping.recipeRole !== 'accent_transition',
      crossfadeSeconds: mapping.sourceKind === 'atomic_audio' ? 0.35 : 2,
    },
    fade: {
      inSeconds: mapping.recipeRole === 'accent_transition' ? 0.05 : 2,
      outSeconds: mapping.recipeRole === 'accent_transition' ? 2 : 4,
    },
    volumeAutomation: mapping.recipeRole === 'accent_transition'
      ? undefined
      : arc(durationSeconds, Math.max(2, Math.round(volume * 0.45)), volume, Math.max(2, Math.round(volume * 0.42))),
  };
};

const symbolicRuleIdsFor = (goal: ProductGoal) =>
  eligibilityMappings
    .filter((item) => item.sourceKind === 'symbolic_rule' && ['primary', 'secondary'].includes(item.goalSuitability[goal]))
    .map((item) => item.id)
    .slice(0, 8);

const selectFoundationalEligibilityRecipe = (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';
  excludedSounds: string[];
  environmentPreferences?: string[];
  selectionKey?: string;
  durationSeconds?: number;
}): { recipe: CatalogRecipe; plan: AtomicElementCompositionPlan } | null => {
  if (!foundationalEligibilityMapPilotEnabled()) return null;
  const prompt = input.prompt.toLowerCase();
  const key = `${prompt}|${input.goal}|${input.scene}|${input.selectionKey ?? ''}|eligibility`;
  const requestedInstrument = /guitar|吉他/.test(prompt)
    ? 'guitar'
    : /rhodes|electric piano|电钢琴/.test(prompt)
      ? 'rhodes'
      : /piano|钢琴/.test(prompt)
        ? 'piano'
        : null;
  const hardTextMusicExcluded = explicitlyExcludes(prompt, ['music', '音乐', '轻音乐']);
  const effectiveExcludedSounds = input.excludedSounds.filter((sound) => (
    sound !== 'music'
    || hardTextMusicExcluded
    || (!requestedInstrument && !/音乐感|轻音乐感|乐器感/.test(prompt))
  ));
  const musicWordsOnlyExcluded = explicitlyExcludes(prompt, [
    'music',
    '音乐',
    '轻音乐',
    'piano',
    '钢琴',
    'guitar',
    '吉他',
    'rhodes',
    'electric piano',
    '电钢琴',
    'instrumental',
    '乐器',
    'harmony',
    '和声',
    'motif',
    '动机',
    'melody',
    '旋律',
  ]);
  const focusDefaultSubtleMusic = false;
  const explicitMusicRequested = Boolean(requestedInstrument) || focusDefaultSubtleMusic || (explicitMusic(prompt) && !musicWordsOnlyExcluded);
  const musicExcluded = hardTextMusicExcluded || effectiveExcludedSounds.includes('music');
  const wantsMaskingTexture = /mask|遮蔽|干扰|no melody|不要旋律|不要音乐|no music|不要水声|不要公路感/i.test(prompt);
  const avoidEnvironmentBeds = input.goal === 'focus'
    || explicitlyExcludes(prompt, ['water', 'rain', 'ocean', 'sea', '海', '水', 'road', 'highway', 'car', 'traffic', 'hvac', 'machine', '公路', '高速', '汽车', '车流', '机器', '机械', '空调']);
  const pool = eligibilityForGoal(input.goal, { includeSecondary: true })
    .filter((item) => item.audioUrl)
    .filter((item) => !excludesMapping(prompt, effectiveExcludedSounds, item));
  const positiveEnvironmentPreferences = [...new Set(input.environmentPreferences ?? [])]
    .filter((preference) => preference !== 'music')
    .filter((preference) => !effectiveExcludedSounds.includes(preference));
  const explicitElementLevelNeed = explicitMusicRequested
    || musicExcluded
    || wantsMaskingTexture
    || positiveEnvironmentPreferences.length > 0
    || /texture|textural|air texture|space|spacious|masking|low distraction|distraction|support|noise|rain|wind|forest|ocean|water|room tone|drone|pad|空气|空间|纹理|质感|遮蔽|低干扰|干扰|支撑|噪音|噪声|雨|风|森林|海|水声|房间声|底噪|铺底|氛围垫|无人声|不要鼓点|不要水声|不要公路/i.test(prompt);
  if (!explicitElementLevelNeed) return null;

  const rolePool = (role: string, extraFilter: (item: EligibilityMapping) => boolean = () => true) =>
    pool.filter((item) => item.recipeRole === role && extraFilter(item));
  const safeForegroundBed = (item: EligibilityMapping) => !item.supportOnly && !riskyBedTexture(item);
  const preferredEnvironmentPool = () => {
    for (const preference of positiveEnvironmentPreferences) {
      const pattern = environmentPreferencePattern(preference);
      const matches = rolePool('environment_identity_bed', (item) => pattern.test(item.id));
      if (matches.length) return { preference, matches };
    }
    return null;
  };

  const instrumentFilter = (item: EligibilityMapping) => {
    if (!requestedInstrument) return true;
    const haystack = `${item.id} ${item.notes}`.toLowerCase();
    return haystack.includes(requestedInstrument)
      || (requestedInstrument === 'piano' && haystack.includes('piano'))
      || (requestedInstrument === 'rhodes' && haystack.includes('rhodes'))
      || (requestedInstrument === 'guitar' && haystack.includes('guitar'));
  };
  const selected: EligibilityMapping[] = [];
  const add = (candidate: EligibilityMapping | null) => {
    if (candidate && !selected.some((item) => item.id === candidate.id)) selected.push(candidate);
  };

  if (explicitMusicRequested && !musicExcluded) {
    add(pickMapping(rolePool('harmony_cell', instrumentFilter), `${key}|harmony`)
      ?? (requestedInstrument === 'piano'
        ? pickMapping(rolePool('harmony_cell', (item) => !riskyBedTexture(item)), `${key}|piano-feel-harmony`)
        : null)
      ?? pickMapping(rolePool('playable_note_source', instrumentFilter), `${key}|note`));
    if (!explicitlyExcludes(prompt, ['melody', '旋律'])) {
      add(pickMapping(rolePool('melodic_motif', instrumentFilter), `${key}|motif`));
    } else {
      add(pickMapping(rolePool('playable_note_source', instrumentFilter), `${key}|note-no-melody`));
    }
    add(pickMapping(rolePool('bass_support'), `${key}|bass`));
    const preferredEnvironment = preferredEnvironmentPool();
    add(preferredEnvironment
      ? pickMapping(preferredEnvironment.matches, `${key}|environment-preference|${preferredEnvironment.preference}`)
      : null);
    add(pickMapping(rolePool('environment_identity_bed', safeForegroundBed), `${key}|environment-safe`)
      ?? pickMapping(rolePool('organic_texture', (item) => !riskyBedTexture(item)), `${key}|environment-texture-safe`));
    if (input.goal === 'sleep') add(pickMapping(rolePool('masking_support'), `${key}|sleep-mask`));
  } else {
    const texturePreference = wantsMaskingTexture
      ? (input.goal === 'sleep' ? safeTextureIdsByUse.sleepDark : safeTextureIdsByUse.focusMasking)
      : safeTextureIdsByUse.neutral;
    const pickPreferredTexture = (suffix: string, ids: readonly string[]) =>
      pickMapping(rolePool('organic_texture', (item) => ids.includes(item.id)), `${key}|${suffix}`);
    const addPreferredTextures = (ids: readonly string[], suffix: string) => {
      for (const id of ids) {
        if (selected.length >= 3) break;
        const candidate = pickPreferredTexture(`${suffix}|${id}`, [id]);
        if (candidate) add(candidate);
      }
    };

    const preferredEnvironment = preferredEnvironmentPool();
    if (preferredEnvironment && !wantsMaskingTexture) {
      add(pickMapping(preferredEnvironment.matches, `${key}|environment-preference|${preferredEnvironment.preference}`));
    }
    if (!avoidEnvironmentBeds && !wantsMaskingTexture) {
      add(pickMapping(rolePool('environment_identity_bed', safeForegroundBed), `${key}|environment-safe`));
    }

    addPreferredTextures(texturePreference, 'texture-preferred');
    if (input.goal === 'focus' && wantsMaskingTexture && !musicExcluded) {
      add(pickMapping(rolePool('bass_support'), `${key}|focus-nonmelodic-bass-anchor`));
    }
    if (!avoidEnvironmentBeds && selected.length < 2) {
      add(pickMapping(rolePool('environment_identity_bed', safeForegroundBed), `${key}|support-environment-safe`));
    }
    if (selected.length < 3) {
      add(pickMapping(rolePool('organic_texture', (item) => !selected.some((selectedItem) => selectedItem.id === item.id)), `${key}|texture-backup-safe`));
    }
  }

  if (selected.length < 3 && explicitMusicRequested && !musicExcluded) {
    add(pickMapping(rolePool('harmony_cell'), `${key}|fallback-harmony`));
    add(pickMapping(rolePool('melodic_motif'), `${key}|fallback-motif`));
  }
  if (selected.length < 2) return null;

  const durationSeconds = Math.max(300, Math.min(7200, Math.round(input.durationSeconds ?? durationForScene(input.scene))));
  const tracks = selected.map((mapping, index) => trackForMapping(mapping, input.goal, durationSeconds, index));
  const selectionSeed = hash(key);
  const planId = `foundational-eligibility-plan-${input.goal}-${selectionSeed.toString(16)}`;
  const plan: AtomicElementCompositionPlan = {
    id: planId,
    version: '1.0.0',
    source: 'foundational_recipe_eligibility_map_v1',
    eligibilityMapId: 'foundational_recipe_eligibility_map_v1',
    goal: input.goal,
    scene: input.scene,
    selectionSeed,
    selected: selected.map((mapping) => {
      const atomicElement = mapping.sourceKind === 'atomic_audio' ? atomicAudioById.get(mapping.id) : null;
      return {
        stemId: eligibilityStemIdFor(mapping),
        atomicElementId: mapping.id,
        elementType: atomicElement?.elementType ?? 'single_note',
        instrument: atomicElement?.instrument ?? mapping.recipeRole,
        notes: atomicElement?.notes ?? [],
        eligibilityId: mapping.id,
        recipeRole: mapping.recipeRole,
        sourceKind: mapping.sourceKind,
        routeStatus: mapping.routeStatus,
        supportOnly: mapping.supportOnly,
        riskTags: mapping.riskTags,
        reason: `Selected ${mapping.id} as ${mapping.recipeRole} from Foundational Recipe Eligibility Map V1.`,
      };
    }),
    selectedSymbolicRuleIds: symbolicRuleIdsFor(input.goal),
    runtimeExternalApiUsed: false,
    pilotOnly: true,
  };

  return {
    plan,
    recipe: {
      id: planId,
      name: `${input.goal === 'sleep' ? 'Sleep' : input.goal === 'focus' ? 'Focus' : 'Calm'} Foundational Eligibility Mix`,
      goal: input.goal,
      scene: input.scene,
      durationSeconds,
      tracks,
      moodTags: [
        input.goal,
        'Foundational Recipe Eligibility',
        ...positiveEnvironmentPreferences.map(environmentPreferenceLabel),
        ...selected.map((item) => item.recipeRole),
        ...selected.map((item) => item.id),
      ],
      contentMode: musicExcluded || !explicitMusicRequested ? 'pure_soundscape' : 'functional_music',
      mixProfile: {
        phaseBalance: musicExcluded || !explicitMusicRequested
          ? { arrival: 'environment', core: 'environment', release: 'environment' }
          : { arrival: 'music', core: 'music', release: input.goal === 'focus' ? 'base' : 'music' },
      },
    },
  };
};

export const selectAtomicFoundationalElementRecipe = (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';
  excludedSounds: string[];
  environmentPreferences?: string[];
  selectionKey?: string;
  durationSeconds?: number;
}): { recipe: CatalogRecipe; plan: AtomicElementCompositionPlan } | null => {
  const eligibilitySelection = selectFoundationalEligibilityRecipe(input);
  if (eligibilitySelection) return eligibilitySelection;
  if (!atomicQuickCreatePilotEnabled()) return null;
  if (input.excludedSounds.includes('music')) return null;

  const prompt = input.prompt.toLowerCase();
  const positiveEnvironmentPreferences = [...new Set(input.environmentPreferences ?? [])]
    .filter((preference) => preference !== 'music')
    .filter((preference) => !input.excludedSounds.includes(preference));
  const explicitlyRequestsAtomicElement = explicitMusic(prompt)
    || positiveEnvironmentPreferences.length > 0
    || explicitlyExcludes(prompt, ['music', '音乐', '轻音乐', 'melody', '旋律', 'drone', 'pad', '底噪', '氛围垫'])
    || /texture|textural|masking|low distraction|noise|drone|pad|harmony|motif|single note|空气|空间|纹理|质感|遮蔽|低干扰|噪音|噪声|底噪|铺底|氛围垫|和声|动机|单音|无人声|不要鼓点|不要水声|不要公路/i.test(prompt);
  if (!explicitlyRequestsAtomicElement) return null;

  const key = `${prompt}|${input.goal}|${input.scene}|${input.selectionKey ?? ''}`;
  const wantsGuitar = /guitar|吉他/.test(prompt) && !explicitlyExcludes(prompt, ['guitar', '吉他']);
  const wantsRhodes = /rhodes|electric piano|电钢琴/.test(prompt) && !explicitlyExcludes(prompt, ['rhodes', 'electric piano', '电钢琴']);
  const wantsPiano = /piano|钢琴/.test(prompt) && !explicitlyExcludes(prompt, ['piano', '钢琴']);

  const chordPool = byTypeAndGoal(input.goal, 'harmony_cell');
  const motifPool = byTypeAndGoal(input.goal, 'short_motif');
  const notePool = byTypeAndGoal(input.goal, 'single_note');
  const bassPool = byTypeAndGoal(input.goal, 'bass_support');

  if (!chordPool.length || !motifPool.length) return null;
  const instrumentFilter = (items: AtomicAudioElement[]) => {
    const requested = wantsGuitar ? 'guitar' : wantsRhodes ? 'rhodes' : wantsPiano ? 'piano' : null;
    const filtered = requested ? items.filter((element) => element.instrument === requested) : items;
    return filtered.length ? filtered : items;
  };

  const chord = pick(instrumentFilter(chordPool), `${key}|chord`);
  const motif = pick(instrumentFilter(motifPool), `${key}|motif`);
  const supportPool = bassPool.length ? bassPool : notePool;
  if (!supportPool.length) return null;
  const support = pick(supportPool, `${key}|support`);
  const selected = [chord, motif, support];
  const durationSeconds = Math.max(300, Math.min(7200, Math.round(input.durationSeconds ?? (input.scene === 'bedtime' ? 1800 : input.scene === 'return_to_sleep' ? 900 : input.scene === 'deep_focus' ? 1500 : 1200))));
  const tracks = [
    trackForElement(chord, 'music', input.goal === 'focus' ? 34 : 30, durationSeconds, arc(durationSeconds, 12, input.goal === 'focus' ? 34 : 30, 14)),
    trackForElement(motif, 'music', input.goal === 'sleep' ? 16 : input.goal === 'calm' ? 20 : 18, durationSeconds, arc(durationSeconds, 4, input.goal === 'sleep' ? 16 : input.goal === 'calm' ? 20 : 18, 6)),
    trackForElement(support, 'music', input.goal === 'focus' ? 16 : 10, durationSeconds, arc(durationSeconds, 4, input.goal === 'focus' ? 16 : 10, 4)),
  ];
  const selectionSeed = hash(key);
  const planId = `atomic-element-plan-${input.goal}-${selectionSeed.toString(16)}`;
  const plan: AtomicElementCompositionPlan = {
    id: planId,
    version: '1.0.0',
    source: 'atomic-foundation-elements-v1',
    goal: input.goal,
    scene: input.scene,
    selectionSeed,
    selected: selected.map((element) => ({
      stemId: stemIdFor(element.elementId),
      atomicElementId: element.elementId,
      elementType: element.elementType,
      instrument: element.instrument,
      notes: element.notes,
      reason: `Selected ${element.elementType} ${element.elementId} from owner-passed atomic foundation elements for ${input.goal}.`,
    })),
    selectedSymbolicRuleIds: symbolicForGoal(input.goal).slice(0, 6),
    runtimeExternalApiUsed: false,
    pilotOnly: true,
  };
  return {
    plan,
    recipe: {
      id: planId,
      name: `${input.goal === 'sleep' ? 'Sleep' : input.goal === 'focus' ? 'Focus' : 'Calm'} Atomic Element Pilot`,
      goal: input.goal,
      scene: input.scene,
      durationSeconds,
      tracks,
      moodTags: [input.goal, 'Atomic Foundation Elements', 'Pilot', ...selected.map((element) => element.elementType)],
      contentMode: 'functional_music',
      mixProfile: { phaseBalance: { arrival: 'music', core: 'music', release: 'music' } },
    },
  };
};
