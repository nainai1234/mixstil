import { productionMusicKits, productionMusicKitStems } from './musicKitProduction';
import { foundationalElements, type FoundationalElement } from './foundationalElementProduction';
import { atomicFoundationElements, foundationalEligibilityAudioElements, selectAtomicFoundationalElementRecipe } from './atomicFoundationElementProduction';

export type ProductGoal = 'sleep' | 'calm' | 'focus';
export type ProductScene = 'bedtime' | 'return_to_sleep' | 'breathing' | 'emotional_settling' | 'deep_focus';
export type ContentMode = 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';

export type CatalogTrack = {
  stemId: string;
  role: 'base' | 'environment' | 'music' | 'accent';
  volume: number;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  isMuted: false;
  musicKitId?: string;
  musicKitVersion?: string;
  musicPart?: 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition';
  volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
  sourceGainDb?: number;
  fade?: { inSeconds: number; outSeconds: number };
  loop?: { enabled: boolean; crossfadeSeconds: number };
};

export type CatalogRecipe = {
  id: string;
  name: string;
  goal: ProductGoal;
  scene: ProductScene;
  durationSeconds: number;
  tracks: CatalogTrack[];
  moodTags: string[];
  contentMode: Exclude<ContentMode, 'guided_meditation'>;
  mixProfile: {
    phaseBalance: {
      arrival: 'base' | 'environment' | 'music';
      core: 'base' | 'environment' | 'music';
      release: 'base' | 'environment' | 'music';
    };
  };
};

export const goals = [
  { id: 'sleep', name: 'Sleep', scenes: ['bedtime', 'return_to_sleep'] },
  { id: 'calm', name: 'Calm', scenes: ['breathing', 'emotional_settling'] },
  { id: 'focus', name: 'Focus', scenes: ['deep_focus'] },
] as const;

export const scenes = [
  { id: 'bedtime', goal: 'sleep', name: 'Bedtime', defaultDurationSeconds: 1800 },
  { id: 'return_to_sleep', goal: 'sleep', name: 'Return to Sleep', defaultDurationSeconds: 900 },
  { id: 'breathing', goal: 'calm', name: 'Mindful Breathing', defaultDurationSeconds: 600 },
  { id: 'emotional_settling', goal: 'calm', name: 'Emotional Settling', defaultDurationSeconds: 1200 },
  { id: 'deep_focus', goal: 'focus', name: 'Deep Focus', defaultDurationSeconds: 1500 },
] as const;

export const coreStemIds = [
  ...foundationalElements.map((element) => element.id),
  ...atomicFoundationElements.map((element) => `stem_atomic_${element.elementId}`),
  ...foundationalEligibilityAudioElements.map((element) => (
    element.sourceKind === 'atomic_audio' ? `stem_atomic_${element.id}` : `stem_foundation_${element.id}`
  )),
  ...productionMusicKitStems.map(({ stem }) => stem.id),
  'stem_internal_white_soft',
  'stem_internal_white_deep',
  'stem_internal_pink_soft',
  'stem_internal_pink_balanced',
  'stem_internal_brown_soft',
  'stem_internal_brown_deep',
  'stem_mixkit_rain_2394',
  'stem_mixkit_ocean_1195',
  'stem_mixkit_pond_1783',
  'stem_mixkit_forest_1210',
  'stem_mixkit_waterfall_2517',
  'stem_mixkit_2393',
  'stem_mixkit_2474',
  'stem_mixkit_3126',
  'stem_mixkit_1213',
  'stem_mixkit_1736',
  'stem_mixkit_2414',
  'stem_mixkit_2475',
  'stem_mixkit_2658',
  'stem_commons_pine_forest_wind',
  'stem_mixkit_3109',
  'stem_mixkit_1879',
  'stem_mixkit_1107',
  'stem_mixkit_music_614',
  'stem_mixkit_music_587',
  'stem_mixkit_music_584',
  'stem_mixkit_music_109',
  'stem_mixkit_music_127',
  'stem_mixkit_music_493',
  'stem_mixkit_music_441',
  'stem_mixkit_music_251',
  'stem_mixkit_music_340',
  'stem_mixkit_music_184',
  'stem_batch07_fma_holizna_rain_sleep',
  'stem_batch07_fma_holizna_cosmic_waves',
  'stem_batch07_fma_holizna_meditation_01',
  'stem_batch07_fma_holizna_dreamscape',
  'stem_batch07_incompetech_meditation_impromptu_01',
  'stem_batch07_incompetech_meditation_impromptu_02',
  'stem_batch07_incompetech_meditation_impromptu_03',
  'stem_batch07_scott_buckley_solace',
  'stem_local_procedural_night_neutral_drone',
  'stem_local_procedural_deep_sleep_low',
  'stem_local_procedural_return_to_sleep_soft',
  'stem_mixkit_2397',
  'stem_mixkit_2399',
  'stem_mixkit_2390',
  'stem_mixkit_1194',
  'stem_mixkit_1181',
  'stem_mixkit_2402',
] as const;

export const pendingMusicCoreCandidates = [
] as const;

const track = (
  stemId: string,
  role: CatalogTrack['role'],
  volume: number,
  duration: number,
  startTime = 0,
  volumeAutomation?: CatalogTrack['volumeAutomation'],
): CatalogTrack => ({
  stemId,
  role,
  volume,
  startTime,
  duration,
  trimStart: 0,
  trimEnd: duration,
  isMuted: false,
  volumeAutomation,
});

const arc = (duration: number, arrival: number, core: number, release: number) => [
  { atSeconds: 0, volume: arrival },
  { atSeconds: Math.round(duration * 0.1), volume: core },
  { atSeconds: Math.round(duration * 0.9), volume: core },
  { atSeconds: duration, volume: release },
];

const musicKitCatalogRecipes: CatalogRecipe[] = productionMusicKits.map((kit) => {
  const durationSeconds = kit.goal === 'sleep' ? 1800 : kit.goal === 'focus' ? 1500 : 1200;
  const scene: ProductScene = kit.goal === 'sleep' ? 'bedtime' : kit.goal === 'focus' ? 'deep_focus' : 'emotional_settling';
  return {
    id: `music-kit-${kit.id}`,
    name: kit.compositionId
      ? kit.compositionId.split('_').map((word: string) => word[0].toUpperCase() + word.slice(1)).join(' ')
      : kit.profileId.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' '),
    goal: kit.goal,
    scene,
    durationSeconds,
    tracks: kit.stems.map((stem) => ({
      stemId: stem.id,
      role: 'music',
      volume: stem.defaultVolume,
      startTime: 0,
      duration: durationSeconds,
      trimStart: 0,
      trimEnd: kit.durationSeconds,
      isMuted: false,
      musicKitId: kit.id,
      musicKitVersion: kit.version,
      musicPart: stem.role,
    })),
    moodTags: [kit.goal === 'sleep' ? 'Sleep' : kit.goal === 'focus' ? 'Focus' : 'Calm', 'Original MusicKit', kit.form],
    contentMode: 'functional_music',
    mixProfile: { phaseBalance: { arrival: 'music', core: 'music', release: 'music' } },
  };
});

export const selectMusicKitCatalogRecipe = (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: ContentMode;
  excludedSounds: string[];
  selectionKey?: string;
}) => {
  if (input.excludedSounds.includes('music')) return null;
  const explicitMusic = /(music|piano|guitar|rhodes|instrumental|音乐|钢琴|吉他|纯音乐)/i.test(input.prompt);
  if (!explicitMusic && input.contentMode !== 'functional_music') return null;
  const candidates = musicKitCatalogRecipes.filter((recipe) => recipe.goal === input.goal && recipe.scene === input.scene);
  if (candidates.length === 0) return null;
  const lower = input.prompt.toLowerCase();
  const instrumentMatches = candidates.filter((recipe) => (
    (/(guitar|吉他)/i.test(lower) && /guitar/i.test(recipe.id))
    || (/(rhodes|electric piano|电钢琴)/i.test(lower) && /rhodes/i.test(recipe.id))
    || (/(piano|钢琴)/i.test(lower) && /piano/i.test(recipe.id))
  ));
  const selectionPool = instrumentMatches.length > 0 ? instrumentMatches : candidates;
  let hash = 0;
  for (const character of `${lower}:${input.selectionKey ?? ''}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return selectionPool[hash % selectionPool.length];
};

export type ElementCompositionPlan = {
  id: string;
  version: '1.0.0';
  goal: ProductGoal;
  scene: ProductScene;
  selectionSeed: number;
  compatibilityScore: number;
  selected: Array<{
    stemId: string;
    family: string;
    elementRole: FoundationalElement['elementRole'];
    key: FoundationalElement['key'];
    reason: string;
  }>;
  runtimeExternalApiUsed: false;
};

const elementFamilyDefaults: Record<ProductGoal, string[]> = {
  sleep: ['deep_low_drone', 'warm_analog_pad', 'felt_piano_phrase'],
  calm: ['airy_bright_pad', 'warm_rhodes_phrase', 'sparse_tonal_texture'],
  focus: ['open_fifth_harmonic_bed', 'nylon_guitar_phrase', 'sparse_tonal_texture'],
};

const elementHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const chromaSimilarity = (left: FoundationalElement, right: FoundationalElement) => {
  const a = left.acoustic.chroma;
  const b = right.acoustic.chroma;
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return dot / Math.max(1e-12, normA * normB);
};

const elementArc = (duration: number, arrival: number, core: number, release: number) => [
  { atSeconds: 0, volume: arrival },
  { atSeconds: Math.round(duration * 0.12), volume: core },
  { atSeconds: Math.round(duration * 0.88), volume: core },
  { atSeconds: duration, volume: release },
];

const explicitlyExcludes = (prompt: string, words: string[]) => words.some((word) => (
  new RegExp(`(?:no|without|exclude|remove|不要|不想要|没有|去掉)[^,.，。]{0,12}${word}|${word}[^,.，。]{0,8}(?:不要|去掉)`, 'i').test(prompt)
));

export const selectFoundationalElementRecipe = (input: {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: ContentMode;
  excludedSounds: string[];
  environmentPreferences?: string[];
  selectionKey?: string;
  durationSeconds?: number;
}): { recipe: CatalogRecipe; plan: ElementCompositionPlan } | null => {
  const atomicSelection = selectAtomicFoundationalElementRecipe(input);
  if (atomicSelection) return atomicSelection as unknown as { recipe: CatalogRecipe; plan: ElementCompositionPlan };
  if (input.excludedSounds.includes('music')) return null;
  const explicitMusic = /(music|piano|guitar|rhodes|instrumental|melody|drone|pad|音乐|钢琴|吉他|电钢琴|旋律|氛围)/i.test(input.prompt);
  const positiveEnvironmentPreferences = [...new Set(input.environmentPreferences ?? [])]
    .filter((preference) => preference !== 'music')
    .filter((preference) => !input.excludedSounds.includes(preference));
  const explicitElementLevelNeed = explicitMusic
    || positiveEnvironmentPreferences.length > 0
    || input.excludedSounds.some((sound) => ['music', 'rain', 'water', 'ocean', 'road', 'traffic', 'noise'].includes(sound))
    || /texture|textural|masking|low distraction|noise|drone|pad|harmony|motif|single note|空气|空间|纹理|质感|遮蔽|低干扰|噪音|噪声|底噪|铺底|氛围垫|和声|动机|单音|无人声|不要鼓点|不要水声|不要公路/i.test(input.prompt);
  if (!explicitElementLevelNeed) return null;

  const prompt = input.prompt.toLowerCase();
  const excludedFamilies = new Set<string>();
  if (explicitlyExcludes(prompt, ['piano', '钢琴'])) excludedFamilies.add('felt_piano_phrase');
  if (explicitlyExcludes(prompt, ['rhodes', 'electric piano', '电钢琴'])) excludedFamilies.add('warm_rhodes_phrase');
  if (explicitlyExcludes(prompt, ['guitar', '吉他'])) excludedFamilies.add('nylon_guitar_phrase');
  const excludesMelody = explicitlyExcludes(prompt, ['melody', '旋律']);

  let families = [...elementFamilyDefaults[input.goal]];
  const requestedMelodyFamily = /(felt piano|毛毡钢琴|piano|钢琴)/i.test(prompt)
    ? 'felt_piano_phrase'
    : /(rhodes|electric piano|电钢琴)/i.test(prompt)
      ? 'warm_rhodes_phrase'
      : /(guitar|吉他)/i.test(prompt)
        ? 'nylon_guitar_phrase'
        : null;
  if (requestedMelodyFamily && !excludedFamilies.has(requestedMelodyFamily)) {
    families = families.filter((family) => !['felt_piano_phrase', 'warm_rhodes_phrase', 'nylon_guitar_phrase'].includes(family));
    families.push(requestedMelodyFamily);
  }
  families = families.filter((family) => !excludedFamilies.has(family) && (!excludesMelody || !['felt_piano_phrase', 'warm_rhodes_phrase', 'nylon_guitar_phrase'].includes(family)));
  const fallbackFamilies = input.goal === 'sleep'
    ? ['deep_low_drone', 'warm_analog_pad', 'open_fifth_harmonic_bed']
    : input.goal === 'calm'
      ? ['airy_bright_pad', 'open_fifth_harmonic_bed', 'sparse_tonal_texture']
      : ['open_fifth_harmonic_bed', 'airy_bright_pad', 'sparse_tonal_texture'];
  for (const family of fallbackFamilies) if (families.length < 3 && !families.includes(family)) families.push(family);
  families = families.slice(0, 3);

  const pools = families.map((family) => foundationalElements.filter((element) => element.family === family && element.goals.includes(input.goal)));
  if (pools.some((pool) => pool.length === 0)) return null;
  const combinations = pools[0].flatMap((first) => pools[1].flatMap((second) => pools[2].map((third) => {
    const elements = [first, second, third];
    const pairScores = [[first, second], [first, third], [second, third]].map(([left, right]) => chromaSimilarity(left, right));
    return { elements, score: pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length };
  })));
  combinations.sort((left, right) => right.score - left.score);
  const selectionSeed = elementHash(`${prompt}|${input.goal}|${input.scene}|${input.selectionKey ?? ''}`);
  const selectionPool = combinations.slice(0, Math.min(12, combinations.length));
  const selectedCombination = selectionPool[selectionSeed % selectionPool.length];
  const durationSeconds = Math.max(300, Math.min(7200, Math.round(input.durationSeconds ?? (scenes.find((scene) => scene.id === input.scene)?.defaultDurationSeconds ?? 1200))));
  const roleScale: Record<FoundationalElement['elementRole'], number> = { low_support: 1, harmony: 0.92, melody: 0.75, texture: 0.62 };
  const tracks = selectedCombination.elements.map((element) => ({
    stemId: element.id,
    role: 'music' as const,
    volume: Math.round(element.defaultVolume * roleScale[element.elementRole]),
    startTime: 0,
    duration: durationSeconds,
    trimStart: 0,
    trimEnd: element.acoustic.durationSeconds,
    isMuted: false as const,
    volumeAutomation: elementArc(
      durationSeconds,
      Math.round(element.defaultVolume * roleScale[element.elementRole] * (element.elementRole === 'melody' ? 0.35 : 0.65)),
      Math.round(element.defaultVolume * roleScale[element.elementRole]),
      Math.round(element.defaultVolume * roleScale[element.elementRole] * 0.45),
    ),
  }));
  const planId = `element-plan-${input.goal}-${selectionSeed.toString(16)}`;
  const plan: ElementCompositionPlan = {
    id: planId,
    version: '1.0.0',
    goal: input.goal,
    scene: input.scene,
    selectionSeed,
    compatibilityScore: Number(selectedCombination.score.toFixed(4)),
    selected: selectedCombination.elements.map((element) => ({
      stemId: element.id,
      family: element.family,
      elementRole: element.elementRole,
      key: element.key,
      reason: requestedMelodyFamily === element.family ? 'Explicit instrument request.' : `Compatible ${element.elementRole} element for ${input.goal}.`,
    })),
    runtimeExternalApiUsed: false,
  };
  return {
    plan,
    recipe: {
      id: planId,
      name: `${input.goal === 'sleep' ? 'Sleep' : input.goal === 'focus' ? 'Focus' : 'Meditation'} Element Composition`,
      goal: input.goal,
      scene: input.scene,
      durationSeconds,
      tracks,
      moodTags: [input.goal, 'Foundational Elements', ...selectedCombination.elements.flatMap((element) => element.tags)],
      contentMode: 'functional_music',
      mixProfile: { phaseBalance: { arrival: 'music', core: 'music', release: 'music' } },
    },
  };
};

export const defaultRecipes: CatalogRecipe[] = [
  {
    id: 'bedtime-soft-rain', name: 'Soft Rain Bedtime', goal: 'sleep', scene: 'bedtime', durationSeconds: 1800,
    tracks: [track('stem_internal_brown_soft', 'base', 12, 1800), track('stem_mixkit_rain_2394', 'environment', 8, 1800)],
    moodTags: ['Sleep', 'Rain', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'environment', core: 'environment', release: 'environment' } },
  },
  {
    id: 'bedtime-ocean', name: 'Distant Ocean Bedtime', goal: 'sleep', scene: 'bedtime', durationSeconds: 1800,
    tracks: [track('stem_internal_brown_deep', 'base', 6, 1800, 0, arc(1800, 8, 6, 4)), track('stem_mixkit_ocean_1195', 'environment', 3, 1800, 0, arc(1800, 7, 3, 1)), track('stem_mixkit_music_614', 'music', 18, 1800, 0, arc(1800, 6, 18, 8))],
    moodTags: ['Sleep', 'Ocean', 'Piano'],
    contentMode: 'sound_journey',
    mixProfile: { phaseBalance: { arrival: 'environment', core: 'music', release: 'music' } },
  },
  {
    id: 'bedtime-warm-music', name: 'Warm Music Bedtime', goal: 'sleep', scene: 'bedtime', durationSeconds: 1800,
    tracks: [
      track('stem_internal_brown_soft', 'base', 8, 1800, 0, arc(1800, 10, 7, 4)),
      track('stem_mixkit_music_614', 'music', 0, 1800, 0, arc(1800, 0, 12, 5)),
    ],
    moodTags: ['Sleep', 'Warm Music', 'Sound Journey'],
    contentMode: 'sound_journey',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'base' } },
  },
  {
    id: 'bedtime-dry-music', name: 'Quiet Music Bedtime', goal: 'sleep', scene: 'bedtime', durationSeconds: 1800,
    tracks: [track('stem_mixkit_music_614', 'music', 10, 1800)],
    moodTags: ['Sleep', 'Quiet Music', 'Low Stimulation'],
    contentMode: 'functional_music',
    mixProfile: { phaseBalance: { arrival: 'music', core: 'music', release: 'music' } },
  },
  {
    id: 'bedtime-low-fan', name: 'Soft Colored Noise Bedtime', goal: 'sleep', scene: 'bedtime', durationSeconds: 1800,
    tracks: [track('stem_internal_brown_soft', 'base', 12, 1800), track('stem_internal_pink_soft', 'base', 4, 1800)],
    moodTags: ['Sleep', 'Colored Noise', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'base', release: 'base' } },
  },
  {
    id: 'return-soft-rain', name: 'Soft Noise and Music Return', goal: 'sleep', scene: 'return_to_sleep', durationSeconds: 900,
    tracks: [track('stem_internal_brown_soft', 'base', 14, 900), track('stem_internal_pink_soft', 'base', 5, 900), track('stem_mixkit_music_614', 'music', 17, 900)],
    moodTags: ['Return to Sleep', 'Colored Noise', 'Minimal Piano'],
    contentMode: 'functional_music',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'music' } },
  },
  {
    id: 'return-low-fan', name: 'Low Colored Noise Return', goal: 'sleep', scene: 'return_to_sleep', durationSeconds: 900,
    tracks: [track('stem_internal_brown_deep', 'base', 18, 900), track('stem_internal_brown_soft', 'base', 5, 900)],
    moodTags: ['Return to Sleep', 'Brown Noise', 'Steady Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'base', release: 'base' } },
  },
  {
    id: 'breathing-water', name: 'Meditation Tones Breathing', goal: 'calm', scene: 'breathing', durationSeconds: 600,
    tracks: [track('stem_internal_pink_soft', 'base', 14, 600, 0, arc(600, 18, 14, 12)), track('stem_mixkit_music_441', 'music', 16, 600, 0, arc(600, 8, 16, 6)), track('stem_mixkit_1107', 'accent', 4, 8, 30)],
    moodTags: ['Breathing', 'Meditation Tones', 'Present'],
    contentMode: 'sound_journey',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'music' } },
  },
  {
    id: 'breathing-forest', name: 'Forest Breathing', goal: 'calm', scene: 'breathing', durationSeconds: 600,
    tracks: [track('stem_internal_white_soft', 'base', 14, 600), track('stem_mixkit_1213', 'environment', 12, 600)],
    moodTags: ['Breathing', 'Forest', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'environment', core: 'environment', release: 'environment' } },
  },
  {
    id: 'settling-ocean', name: 'Valley Sunset Settling', goal: 'calm', scene: 'emotional_settling', durationSeconds: 1200,
    tracks: [track('stem_internal_pink_balanced', 'base', 14, 1200), track('stem_mixkit_music_127', 'music', 18, 1200)],
    moodTags: ['Calm', 'Sunset', 'Open Ambient'],
    contentMode: 'functional_music',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'music' } },
  },
  {
    id: 'settling-forest', name: 'Quiet Forest Settling', goal: 'calm', scene: 'emotional_settling', durationSeconds: 1200,
    tracks: [track('stem_internal_pink_soft', 'base', 8, 1200), track('stem_mixkit_1213', 'environment', 8, 1200)],
    moodTags: ['Calm', 'Forest', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'environment', core: 'environment', release: 'environment' } },
  },
  {
    id: 'settling-indoor-room', name: 'Dry Colored Noise Settling', goal: 'calm', scene: 'emotional_settling', durationSeconds: 1200,
    tracks: [track('stem_internal_pink_soft', 'base', 6, 1200), track('stem_internal_brown_soft', 'base', 8, 1200)],
    moodTags: ['Calm', 'Colored Noise', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'base', release: 'base' } },
  },
  {
    id: 'settling-warm-music', name: 'Warm Music Settling', goal: 'calm', scene: 'emotional_settling', durationSeconds: 1200,
    tracks: [
      track('stem_internal_pink_soft', 'base', 6, 1200, 0, arc(1200, 8, 5, 3)),
      track('stem_mixkit_music_493', 'music', 0, 1200, 0, arc(1200, 0, 12, 5)),
    ],
    moodTags: ['Calm', 'Warm Music', 'Sound Journey'],
    contentMode: 'sound_journey',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'base' } },
  },
  {
    id: 'focus-waterfall', name: 'Ambient Low Focus', goal: 'focus', scene: 'deep_focus', durationSeconds: 1500,
    tracks: [track('stem_internal_pink_balanced', 'base', 12, 1500), track('stem_mixkit_music_251', 'music', 15, 1500)],
    moodTags: ['Focus', 'Ambient', 'Masking'],
    contentMode: 'functional_music',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'base', release: 'base' } },
  },
  {
    id: 'focus-flowing-water', name: 'Balanced Noise Focus', goal: 'focus', scene: 'deep_focus', durationSeconds: 1500,
    tracks: [track('stem_internal_pink_balanced', 'base', 18, 1500), track('stem_internal_white_deep', 'base', 5, 1500)],
    moodTags: ['Focus', 'Colored Noise', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'base', release: 'base' } },
  },
  {
    id: 'focus-rain', name: 'Soft Rain Focus', goal: 'focus', scene: 'deep_focus', durationSeconds: 1500,
    tracks: [track('stem_internal_pink_soft', 'base', 6, 1500), track('stem_mixkit_rain_2394', 'environment', 5, 1500)],
    moodTags: ['Focus', 'Rain', 'Pure Soundscape'],
    contentMode: 'pure_soundscape',
    mixProfile: { phaseBalance: { arrival: 'environment', core: 'environment', release: 'environment' } },
  },
  {
    id: 'focus-office-journey', name: 'Neutral Noise Flow', goal: 'focus', scene: 'deep_focus', durationSeconds: 1500,
    tracks: [
      track('stem_internal_pink_balanced', 'base', 10, 1500, 0, arc(1500, 10, 7, 5)),
      track('stem_mixkit_music_251', 'music', 0, 1500, 0, arc(1500, 0, 8, 5)),
    ],
    moodTags: ['Focus', 'Colored Noise', 'Music Later', 'Sound Journey'],
    contentMode: 'sound_journey',
    mixProfile: { phaseBalance: { arrival: 'base', core: 'music', release: 'base' } },
  },
  ...musicKitCatalogRecipes,
];
