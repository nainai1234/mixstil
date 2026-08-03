import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ProductGoal, ProductScene } from './contentCatalog';

type CountAs = 'pad_drone' | 'environment_bed' | 'organic_texture' | 'accent_one_shot';
type InstrumentSource = {
  id: string;
  label: string;
  instrumentType: string;
  sourceType: string;
  status: string;
  candidateInstruments: string[];
  verifiedNoteRange: string;
  notes: string;
};
type HarmonyTemplate = { id: string; chords: string[][]; family: string };
type Motif = { id: string; notes: string[]; beats: number[]; contour: string };
type CompositionPlan = {
  id: string;
  goal: ProductGoal;
  scene: ProductScene;
  harmonyId: string;
  motifId: string;
  formId: string;
  grammarId: string;
  tempo: number;
  seed: number;
  instrument: string;
  lowpass: number;
  variant: string;
};
type LyriaFamily = {
  id: string;
  countAs: CountAs;
  sourceManifest: string;
  expectedVariants: number;
  includedVariants?: number[];
  status: string;
  loopMode: string;
};
type DeterministicConfig = {
  id: string;
  countAs: CountAs;
  status: string;
  label: string;
  goals: ProductGoal[];
  parameters: Record<string, unknown>;
};
type NonMusicRegistry = {
  deterministicEnvironmentConfigs: DeterministicConfig[];
  deterministicAccentConfigs: DeterministicConfig[];
  lyriaCandidateFamilies: LyriaFamily[];
};
type SelectableMaterial = {
  id: string;
  countAs: CountAs;
  sourceKind: string;
  status: string;
  goals?: ProductGoal[];
};

const root = process.cwd();
const readJson = <T>(relative: string): T => JSON.parse(readFileSync(path.join(root, relative), 'utf8')) as T;

const instrumentRegistry = readJson<{ sources: InstrumentSource[] }>('config/instrument-source-registry-v1.json');
const materialLibrary = readJson<{ harmonyPool: HarmonyTemplate[]; motifPool: Motif[]; compositionPlans: CompositionPlan[] }>('config/composition-material-library-v1.json');
const nonMusicRegistry = readJson<NonMusicRegistry>('config/formal-foundational-non-music-elements-v1.json');

export type FoundationalCompositionRouterInput = {
  prompt: string;
  goal: ProductGoal;
  scene: ProductScene;
  excludedSounds: string[];
  preferredSounds?: string[];
  selectionKey?: string;
};

export type FoundationalCompositionBundle = {
  id: string;
  version: 'composer_bundle_plan_v1';
  goal: ProductGoal;
  scene: ProductScene;
  promptSummary: string;
  excludedSounds: string[];
  mode: 'music_supported' | 'support_only';
  bundle: {
    instrumentSource: InstrumentSource | null;
    compositionPlan: CompositionPlan | null;
    harmony: HarmonyTemplate | null;
    motif: Motif | null;
    padDrone: string | null;
    environmentBed: string;
    organicTexture: string;
    accentOneShot: string | null;
    deterministicAcousticConfig: string;
  };
  selectedMaterials: Array<{
    role: string;
    id: string;
    sourceKind: string;
    reason: string;
    formalStatus: string;
  }>;
  exclusionsApplied: string[];
  intentionallyExcluded: string[];
  rationale: string[];
  runtimeExternalApiUsed: false;
};

const hash = (value: string) => {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const includesAny = (source: string, terms: string[]) => terms.some((term) => source.includes(term));
const lowerSet = (items: string[]) => new Set(items.map((item) => item.toLowerCase()));
const promptExcludes = (prompt: string, terms: string[]) => {
  const lower = prompt.toLowerCase();
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:no|without|exclude|remove|不要|不想要|没有|去掉|不能有|不能包含|不能出现)[^,.，。]{0,24}${escaped}|${escaped}[^,.，。]{0,12}(?:不要|去掉|不能有|不能包含|不能出现)`, 'i').test(lower);
  });
};

const supportsMusic = (prompt: string, excludedSounds: string[]) => !(
  lowerSet(excludedSounds).has('music')
  || promptExcludes(prompt, ['music', '音乐', '轻音乐', 'melody', '旋律'])
);

const explicitInstrumentIntent = (source: string) => {
  const lower = source.toLowerCase();
  if (includesAny(lower, ['guitar', '吉他'])) return 'guitar';
  if (includesAny(lower, ['rhodes', '电钢琴'])) return 'rhodes';
  if (includesAny(lower, ['piano', '钢琴'])) return 'piano';
  if (includesAny(lower, ['woodwind', 'flute', '笛', '箫'])) return 'woodwinds';
  return null;
};

const sourceMatchesPlayableInstrument = (source: InstrumentSource, instrument: string) => {
  const normalized = instrument === 'rhodes' ? 'electric_piano' : instrument;
  if (normalized === 'piano') {
    return source.instrumentType === 'piano' || source.candidateInstruments.some((item) => item.includes('soft_piano'));
  }
  if (normalized === 'guitar') {
    return source.instrumentType.includes('guitar')
      || source.candidateInstruments.some((item) => item.includes('guitar'));
  }
  if (normalized === 'electric_piano') {
    return source.instrumentType === 'electric_piano'
      || source.candidateInstruments.some((item) => item.includes('rhodes'));
  }
  if (normalized === 'woodwinds') {
    return source.instrumentType === 'woodwinds'
      || source.candidateInstruments.some((item) => ['flute', 'oboe', 'clarinet', 'soft_wind'].some((term) => item.includes(term)));
  }
  return source.instrumentType.includes(normalized)
    || source.candidateInstruments.some((item) => item.includes(normalized) || normalized.includes(item));
};

const selectInstrumentSource = (goal: ProductGoal, prompt: string, compositionPlan: CompositionPlan | null) => {
  const lower = prompt.toLowerCase();
  const candidateTypes = goal === 'sleep'
    ? ['piano', 'woodwinds']
    : goal === 'calm'
      ? ['piano', 'electric_piano', 'nylon_guitar', 'woodwinds', 'steel_string_guitar']
      : ['electric_piano', 'nylon_guitar', 'steel_string_guitar', 'bass'];
  const matched = instrumentRegistry.sources.filter((source) => candidateTypes.some((type) => (
    source.instrumentType.includes(type)
    || source.candidateInstruments.some((instrument) => instrument.includes(type) || type.includes(instrument) || (type.includes('guitar') && instrument.includes('guitar')))
  )));
  const promptInstrument = explicitInstrumentIntent(lower);
  const plannedInstrument = compositionPlan?.instrument === 'rhodes' ? 'electric_piano' : compositionPlan?.instrument ?? null;
  const preferredInstrument = promptInstrument === 'rhodes' ? 'electric_piano' : promptInstrument ?? plannedInstrument;
  const promptPool = preferredInstrument
    ? matched.filter((source) => sourceMatchesPlayableInstrument(source, preferredInstrument))
    : [];
  const dedicatedPromptPool = promptPool.filter((source) => source.instrumentType !== 'multi_instrument_soundfont');
  const pool = preferredInstrument
    ? (dedicatedPromptPool.length > 0 ? dedicatedPromptPool : promptPool)
    : matched.filter((source) => source.instrumentType !== 'multi_instrument_soundfont');
  return pool[hash(`${prompt}|${goal}`) % pool.length] ?? instrumentRegistry.sources[0];
};

const selectHarmony = (goal: ProductGoal, prompt: string) => {
  const lower = prompt.toLowerCase();
  const wantsPiano = includesAny(lower, ['piano', '钢琴']);
  const wantsGuitar = includesAny(lower, ['guitar', '吉他']);
  const wantsRhodes = includesAny(lower, ['rhodes', '电钢琴']);
  const familyHint = goal === 'sleep' ? 'sleep' : goal === 'calm' ? 'calm' : 'focus';
  const harmonyPool = materialLibrary.harmonyPool.filter((harmony) =>
    harmony.family.includes(familyHint)
    || (wantsPiano && harmony.family.includes('sleep'))
    || (wantsGuitar && harmony.family.includes('guitar'))
    || (wantsRhodes && harmony.family.includes('calm')));
  return harmonyPool[hash(`${prompt}|${goal}|harmony`) % harmonyPool.length] ?? materialLibrary.harmonyPool[0];
};

const selectMotif = (goal: ProductGoal, prompt: string) => {
  const lower = prompt.toLowerCase();
  const goalPrefix = `${goal}_`;
  const pool = materialLibrary.motifPool.filter((motif) => motif.id.startsWith(goalPrefix));
  const filtered = includesAny(lower, ['piano', '钢琴'])
    ? pool.filter((motif) => /piano/i.test(motif.id) || /falling|sleep/i.test(motif.id))
    : includesAny(lower, ['guitar', '吉他'])
      ? pool.filter((motif) => /guitar/i.test(motif.id))
      : includesAny(lower, ['rhodes', '电钢琴'])
        ? pool.filter((motif) => /rhodes/i.test(motif.id))
        : pool;
  return filtered[hash(`${prompt}|${goal}|motif`) % filtered.length] ?? pool[0] ?? materialLibrary.motifPool[0];
};

const selectCompositionPlan = (goal: ProductGoal, prompt: string) => {
  const candidates = materialLibrary.compositionPlans.filter((plan) => plan.goal === goal);
  const lower = prompt.toLowerCase();
  const filtered = includesAny(lower, ['guitar', '吉他'])
    ? candidates.filter((plan) => /guitar/i.test(plan.instrument))
    : includesAny(lower, ['rhodes', '电钢琴'])
      ? candidates.filter((plan) => /rhodes/i.test(plan.instrument))
      : includesAny(lower, ['piano', '钢琴'])
        ? candidates.filter((plan) => /piano/i.test(plan.instrument))
        : candidates;
  return filtered[hash(`${prompt}|${goal}|composition`) % filtered.length] ?? candidates[0] ?? materialLibrary.compositionPlans[0];
};

const findHarmony = (id: string | undefined) => materialLibrary.harmonyPool.find((harmony) => harmony.id === id) ?? null;
const findMotif = (id: string | undefined) => materialLibrary.motifPool.find((motif) => motif.id === id) ?? null;

const toSelectable = (item: LyriaFamily | DeterministicConfig): SelectableMaterial => ({
  id: item.id,
  countAs: item.countAs,
  sourceKind: 'sourceManifest' in item ? item.sourceManifest : 'deterministic_dsp',
  status: item.status,
  goals: 'goals' in item ? item.goals : undefined,
});

const blockedFamilies = (prompt: string, excludedSounds: string[], role: CountAs) => {
  const exclusions = lowerSet(excludedSounds);
  const blocked = new Set<string>();

  if (role === 'environment_bed') {
    if (exclusions.has('water') || exclusions.has('rain') || promptExcludes(prompt, ['water', 'rain', 'ocean', 'sea', 'river', 'stream', '水', '雨', '海', '河'])) {
      blocked.add('distant_ocean_wash');
      blocked.add('gentle_rain_canopy');
    }
    if (exclusions.has('road') || exclusions.has('traffic') || promptExcludes(prompt, ['road', 'highway', 'car', 'traffic', 'vehicle', '公路', '高速', '汽车', '车流'])) {
      blocked.add('steady_room_ventilation');
      blocked.add('distant_ocean_wash');
    }
    if (exclusions.has('natural') || promptExcludes(prompt, ['natural', 'nature', '自然', '自然声'])) {
      blocked.add('distant_ocean_wash');
      blocked.add('gentle_rain_canopy');
      blocked.add('night_forest_hush');
      blocked.add('quiet_fireplace_embers');
      blocked.add('soft_pine_wind');
      blocked.add('steady_room_ventilation');
    }
    if (promptExcludes(prompt, ['hvac', 'machine', 'mechanical', '空调', '机器', '机械'])) {
      blocked.add('steady_room_ventilation');
    }
  }

  if (role === 'organic_texture') {
    if (!supportsMusic(prompt, excludedSounds)) blocked.add('muted_string_harmonics');
    if (promptExcludes(prompt, ['water', 'rain', 'ocean', 'sea', 'river', 'stream', '水', '雨', '海', '河'])) blocked.add('granular_mist');
    if (promptExcludes(prompt, ['road', 'highway', 'car', 'traffic', 'vehicle', '公路', '高速', '汽车', '车流'])) blocked.add('granular_mist');
    if (promptExcludes(prompt, ['natural', 'nature', '自然', '自然声'])) {
      blocked.add('granular_mist');
      blocked.add('low_wood_resonance');
    }
  }

  if (role === 'accent_one_shot') {
    if (!supportsMusic(prompt, excludedSounds)) blocked.add('single_singing_bowl');
    if (promptExcludes(prompt, ['natural', 'nature', '自然', '自然声'])) {
      blocked.add('single_low_temple_bell');
      blocked.add('single_wood_chime');
    }
  }

  return blocked;
};

const preferMaterial = (pool: SelectableMaterial[], preferredIds: string[]) => {
  for (const id of preferredIds) {
    const item = pool.find((candidate) => candidate.id === id);
    if (item) return item;
  }
  return null;
};

const preferredMaterialIds = (goal: ProductGoal, prompt: string, role: CountAs, musicSupported: boolean) => {
  const lower = prompt.toLowerCase();
  const wantsAirOrMasking = includesAny(lower, ['air', 'airflow', '空气', '遮蔽', 'masking', '低干扰', 'stable', '稳定']);
  if (role === 'environment_bed') {
    if (!musicSupported || wantsAirOrMasking || goal === 'focus') {
      return ['env_procedural_soft_airflow_bed_v1', 'soft_pine_wind', 'night_forest_hush'];
    }
    if (goal === 'sleep') return ['env_procedural_soft_airflow_bed_v1', 'soft_pine_wind', 'night_forest_hush'];
    if (goal === 'calm') return ['env_procedural_soft_airflow_bed_v1', 'soft_pine_wind', 'night_forest_hush'];
  }
  if (role === 'organic_texture') {
    if (!musicSupported || wantsAirOrMasking || goal === 'focus') return ['soft_tape_air', 'low_wood_resonance'];
    if (goal === 'sleep') return ['soft_tape_air', 'low_wood_resonance', 'granular_mist'];
    if (goal === 'calm') return ['soft_tape_air', 'muted_string_harmonics', 'low_wood_resonance'];
  }
  if (role === 'accent_one_shot') {
    if (!musicSupported || goal === 'sleep' || wantsAirOrMasking) return ['accent_soft_filtered_noise_breath_v1', 'accent_soft_sine_bell_c5_v1'];
    if (goal === 'calm') return ['accent_soft_sine_bell_c5_v1', 'single_low_temple_bell', 'single_singing_bowl'];
    if (goal === 'focus') return ['accent_low_wood_tone_g3_v1', 'accent_soft_filtered_noise_breath_v1'];
  }
  return [];
};

const selectMaterial = (items: SelectableMaterial[], goal: ProductGoal, prompt: string, role: CountAs, excludedSounds: string[], musicSupported: boolean) => {
  const blocked = blockedFamilies(prompt, excludedSounds, role);
  const pool = items.filter((item) => (!item.goals || item.goals.includes(goal)) && !blocked.has(item.id));
  if (!pool.length) throw new Error(`No ${role} candidates for ${goal} after exclusions: ${Array.from(blocked).join(', ')}`);
  const preferred = preferMaterial(pool, preferredMaterialIds(goal, prompt, role, musicSupported));
  if (preferred) return preferred;
  return pool[hash(`${prompt}|${goal}|${role}`) % pool.length];
};

export const buildFoundationalCompositionBundle = (input: FoundationalCompositionRouterInput): FoundationalCompositionBundle => {
  const prompt = input.prompt.trim();
  const lower = prompt.toLowerCase();
  const selectionText = `${prompt}|${input.selectionKey ?? ''}`;
  const musicSupported = supportsMusic(prompt, input.excludedSounds);

  const compositionPlan = musicSupported ? selectCompositionPlan(input.goal, selectionText) : null;
  const instrumentSource = musicSupported ? selectInstrumentSource(input.goal, selectionText, compositionPlan) : null;
  const harmony = musicSupported ? (findHarmony(compositionPlan?.harmonyId) ?? selectHarmony(input.goal, selectionText)) : null;
  const motif = musicSupported ? (findMotif(compositionPlan?.motifId) ?? selectMotif(input.goal, selectionText)) : null;

  const pads = nonMusicRegistry.lyriaCandidateFamilies.filter((family) => family.countAs === 'pad_drone').map(toSelectable);
  const envs = [
    ...nonMusicRegistry.lyriaCandidateFamilies.filter((family) => family.countAs === 'environment_bed').map(toSelectable),
    ...nonMusicRegistry.deterministicEnvironmentConfigs.filter((config) => config.countAs === 'environment_bed').map(toSelectable),
  ];
  const textures = nonMusicRegistry.lyriaCandidateFamilies.filter((family) => family.countAs === 'organic_texture').map(toSelectable);
  const accents = [
    ...nonMusicRegistry.lyriaCandidateFamilies.filter((family) => family.countAs === 'accent_one_shot').map(toSelectable),
    ...nonMusicRegistry.deterministicAccentConfigs.filter((config) => config.countAs === 'accent_one_shot').map(toSelectable),
  ];
  const deterministicEnv = nonMusicRegistry.deterministicEnvironmentConfigs.filter((item) => item.goals.includes(input.goal));
  const deterministicAccent = nonMusicRegistry.deterministicAccentConfigs.filter((item) => item.goals.includes(input.goal));

  const pad = musicSupported ? selectMaterial(pads, input.goal, selectionText, 'pad_drone', input.excludedSounds, musicSupported) : null;
  const environment = selectMaterial(envs, input.goal, selectionText, 'environment_bed', input.excludedSounds, musicSupported);
  const texture = selectMaterial(textures, input.goal, selectionText, 'organic_texture', input.excludedSounds, musicSupported);
  const accent = selectMaterial(accents, input.goal, selectionText, 'accent_one_shot', input.excludedSounds, musicSupported);
  const deterministicAcousticConfig = input.goal === 'calm' && includesAny(lower, ['528', 'tone', 'binaural'])
    ? 'dsp_tone_reference_528hz_v1'
    : input.goal === 'focus' && includesAny(lower, ['binaural', 'theta'])
      ? 'dsp_binaural_offset_theta_6hz_v1'
      : deterministicEnv[hash(`${selectionText}|${input.goal}|env`) % deterministicEnv.length]?.id
        ?? deterministicAccent[hash(`${selectionText}|${input.goal}|dsp`) % deterministicAccent.length]?.id
        ?? 'dsp_noise_pink_balanced_v1';

  const selectedMaterials: FoundationalCompositionBundle['selectedMaterials'] = [
    ...(instrumentSource ? [{
      role: 'instrument_source',
      id: instrumentSource.id,
      sourceKind: instrumentSource.sourceType,
      reason: `Playable ${instrumentSource.instrumentType} source chosen for ${input.goal}.`,
      formalStatus: instrumentSource.status,
    }] : []),
    ...(harmony ? [{
      role: 'harmony_template',
      id: harmony.id,
      sourceKind: 'composition_material_library',
      reason: `Harmony family ${harmony.family} matches the selected goal and instrument intent.`,
      formalStatus: 'formal_candidate',
    }] : []),
    ...(motif ? [{
      role: 'motif',
      id: motif.id,
      sourceKind: 'composition_material_library',
      reason: `Motif contour ${motif.contour} gives reusable phrase motion without fixed full-track audio.`,
      formalStatus: 'formal_candidate',
    }] : []),
    ...(pad ? [{
      role: 'pad_drone',
      id: pad.id,
      sourceKind: pad.sourceKind,
      reason: 'Support pad/drone selected for stable background layer.',
      formalStatus: pad.status,
    }] : []),
    {
      role: 'environment_bed',
      id: environment.id,
      sourceKind: environment.sourceKind,
      reason: 'Environment identity bed selected to shape scene feel without becoming a finished song.',
      formalStatus: environment.status,
    },
    {
      role: 'organic_texture',
      id: texture.id,
      sourceKind: texture.sourceKind,
      reason: 'Organic texture selected for low-attention motion and continuity.',
      formalStatus: texture.status,
    },
    {
      role: 'accent_one_shot',
      id: accent.id,
      sourceKind: accent.sourceKind,
      reason: 'Accent selected as sparse event material, not as a loop bed.',
      formalStatus: accent.status,
    },
    {
      role: 'deterministic_acoustic_config',
      id: deterministicAcousticConfig,
      sourceKind: 'deterministic_dsp',
      reason: 'Deterministic acoustic config selected for controllable masking/frequency shape without effect claims.',
      formalStatus: 'formal_usable_parameters',
    },
  ];

  const allBlocked = [
    ...blockedFamilies(prompt, input.excludedSounds, 'environment_bed'),
    ...blockedFamilies(prompt, input.excludedSounds, 'organic_texture'),
    ...blockedFamilies(prompt, input.excludedSounds, 'accent_one_shot'),
  ];

  return {
    id: `foundational-bundle-${input.goal}-${hash(`${prompt}|${input.selectionKey ?? ''}`).toString(16)}`,
    version: 'composer_bundle_plan_v1',
    goal: input.goal,
    scene: input.scene,
    promptSummary: prompt.slice(0, 180),
    excludedSounds: [...new Set(input.excludedSounds)],
    mode: musicSupported ? 'music_supported' : 'support_only',
    bundle: {
      instrumentSource,
      compositionPlan,
      harmony,
      motif,
      padDrone: pad?.id ?? null,
      environmentBed: environment.id,
      organicTexture: texture.id,
      accentOneShot: accent.id,
      deterministicAcousticConfig,
    },
    selectedMaterials,
    exclusionsApplied: [...new Set([...input.excludedSounds.map((item) => item.toLowerCase()), ...allBlocked])],
    intentionallyExcluded: musicSupported ? [...new Set(allBlocked)] : [
      'instrument_source',
      'composition_plan',
      'harmony_template',
      'motif',
      'pad_drone',
      ...new Set(allBlocked),
    ],
    rationale: [
      musicSupported
        ? `Selected ${instrumentSource?.label} as the playable source spine for ${input.goal}.`
        : 'User excluded music or melody, so the bundle is support-only and skips playable instrument, harmony, motif, and pad/drone music layers.',
      musicSupported
        ? `Selected harmony template ${harmony?.id}, motif ${motif?.id}, and composition plan ${compositionPlan?.id}.`
        : 'Selected non-music support materials only: environment, texture, accent, and DSP configuration.',
      `Selected support layers ${environment.id}, ${texture.id}, and ${accent.id}.`,
      `Selected ${deterministicAcousticConfig} as the deterministic acoustic configuration.`,
      allBlocked.length > 0
        ? `Applied exclusion filters to avoid ${[...new Set(allBlocked)].join(', ')}.`
        : 'No additional family exclusions were needed beyond the explicit prompt.',
    ],
    runtimeExternalApiUsed: false,
  };
};
