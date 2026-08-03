import type { CatalogRecipe, CatalogTrack, ContentMode, ProductScene } from './contentCatalog';

export const RECIPE_SCHEMA_VERSION = 2 as const;

export type RecipeTrackRole = 'base' | 'environment' | 'music' | 'voice' | 'accent';
export type MusicKitStemRole = 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition';
export type ResolvedLanguage = 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi';
export type LanguagePreference = 'system' | ResolvedLanguage;

export type RecipeV2Track = Omit<CatalogTrack, 'role' | 'isMuted'> & {
  role: RecipeTrackRole;
  isMuted: boolean;
  playbackRate?: number;
  sourceGainDb?: number;
  musicKitId?: string;
  musicKitVersion?: string;
  musicPart?: MusicKitStemRole;
  phaseIds: string[];
  fade: { inSeconds: number; outSeconds: number };
  loop: { enabled: boolean; crossfadeSeconds: number };
};

export type RecipeV2 = {
  schemaVersion: typeof RECIPE_SCHEMA_VERSION;
  versionId: string;
  versionState: 'live' | 'frozen';
  randomSeed: number;
  tracks: RecipeV2Track[];
  durationSeconds: number;
  intent?: string;
  moodTags: string[];
  contentMode?: ContentMode;
  phases: Array<{
    id: string;
    role: 'arrival' | 'core' | 'release';
    startTime: number;
    duration: number;
  }>;
  ducking: Array<{
    triggerRole: 'voice';
    targetRoles: RecipeTrackRole[];
    reductionDb: number;
    attackSeconds: number;
    releaseSeconds: number;
  }>;
  events: Array<{
    id: string;
    type: 'accent';
    stemId: string;
    atSeconds: number;
    volume: number;
  }>;
  voicePlan?: {
    language: 'en' | 'zh';
    mode: 'guided_meditation';
    exitAtSeconds: number;
    cues: Array<{
      id: string;
      text: string;
      startTime: number;
      speechDuration: number;
      pauseAfterSeconds: number;
    }>;
  };
  audit?: {
    replacements?: unknown[];
    renders?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const deterministicRecipeSeed = (parts: Array<string | number | boolean | undefined>) =>
  hashSeed(parts.map((part) => String(part ?? '')).join('|'));

const buildPhases = (durationSeconds: number, scene?: ProductScene | string) => {
  const arrivalRatio = scene === 'deep_focus' ? 0.04 : 0.1;
  const releaseRatio = scene === 'return_to_sleep' ? 0.04 : 0.1;
  const arrivalDuration = Math.max(10, Math.round(durationSeconds * arrivalRatio));
  const releaseDuration = Math.max(10, Math.round(durationSeconds * releaseRatio));
  const coreDuration = Math.max(1, durationSeconds - arrivalDuration - releaseDuration);
  return [
    { id: 'arrival', role: 'arrival' as const, startTime: 0, duration: arrivalDuration },
    { id: 'core', role: 'core' as const, startTime: arrivalDuration, duration: coreDuration },
    { id: 'release', role: 'release' as const, startTime: arrivalDuration + coreDuration, duration: releaseDuration },
  ];
};

const inferRole = (track: any): RecipeTrackRole => {
  if (track.role) return track.role;
  return 'environment';
};

const upgradeTrack = (track: any, durationSeconds: number): RecipeV2Track => {
  const role = inferRole(track);
  const isAccent = role === 'accent';
  return {
    ...track,
    role,
    phaseIds: track.phaseIds ?? (isAccent ? ['core'] : ['arrival', 'core', 'release']),
    fade: track.fade ?? {
      inSeconds: isAccent ? 0.05 : Math.min(4, Math.max(1, durationSeconds * 0.01)),
      outSeconds: isAccent ? Math.min(3, Number(track.duration ?? 3)) : Math.min(6, Math.max(2, durationSeconds * 0.015)),
    },
    playbackRate: track.playbackRate ?? (role === 'voice' ? 1 : 1),
    loop: track.loop ?? {
      enabled: !isAccent,
      crossfadeSeconds: isAccent ? 0 : role === 'base' ? 2 : 3,
    },
  };
};

export const upgradeRecipeToV2 = (recipe: any, seedHint = ''): RecipeV2 => {
  const durationSeconds = Math.max(1, Number(recipe.durationSeconds ?? 900));
  const randomSeed = Number.isInteger(recipe.randomSeed)
    ? recipe.randomSeed
    : deterministicRecipeSeed([recipe.catalogRecipeId, recipe.intent, durationSeconds, seedHint]);
  const tracks = (recipe.tracks ?? []).map((track: any) => upgradeTrack(track, durationSeconds));
  const events = recipe.events ?? tracks
    .filter((track: RecipeV2Track) => track.role === 'accent')
    .map((track: RecipeV2Track, index: number) => ({
      id: `accent-${index + 1}`,
      type: 'accent' as const,
      stemId: track.stemId,
      atSeconds: track.startTime,
      volume: track.volume,
    }));

  return {
    ...recipe,
    schemaVersion: RECIPE_SCHEMA_VERSION,
    versionId: recipe.versionId ?? `live-${randomSeed}`,
    versionState: recipe.versionState ?? 'live',
    randomSeed,
    tracks,
    durationSeconds,
    moodTags: recipe.moodTags ?? [],
    phases: recipe.phases ?? buildPhases(durationSeconds, recipe.intent),
    ducking: recipe.ducking ?? [],
    events,
  };
};

export const createCatalogRecipeV2 = (input: {
  recipe: CatalogRecipe;
  tracks: CatalogTrack[];
  durationSeconds: number;
  prompt?: string;
  guidedVoice?: boolean;
  languagePreference?: LanguagePreference;
  resolvedLanguage?: ResolvedLanguage;
  soundProfile?: {
    likedSounds: string[];
    excludedSounds: string[];
    defaultGoal: string;
    defaultDurationSeconds: number;
  };
  audioIntent?: unknown;
  supply?: unknown;
}) => upgradeRecipeToV2({
  tracks: input.tracks,
  durationSeconds: input.durationSeconds,
  intent: input.recipe.scene,
  moodTags: input.recipe.moodTags,
  contentMode: (input.audioIntent as { contentMode?: ContentMode } | undefined)?.contentMode ?? input.recipe.contentMode,
  mixProfile: input.recipe.mixProfile,
  catalogRecipeId: input.recipe.id,
  audioIntent: input.audioIntent,
  quickCreate: {
    recipeId: input.recipe.id,
    prompt: input.prompt ?? '',
    guidedVoiceRequested: Boolean(input.guidedVoice),
    guidedVoiceStatus: input.guidedVoice ? 'queued_for_controlled_tts' : 'off',
    languagePreference: input.languagePreference ?? 'system',
    resolvedLanguage: input.resolvedLanguage ?? 'zh',
    soundProfileSnapshot: input.soundProfile,
    internalBaselineMatch: (input.recipe as CatalogRecipe & { internalBaselineMatch?: unknown }).internalBaselineMatch,
    supply: input.supply,
  },
}, `${input.prompt ?? ''}|${Boolean(input.guidedVoice)}|${input.languagePreference ?? 'system'}|${input.resolvedLanguage ?? 'zh'}`);

export const validateRecipeV2 = (recipe: RecipeV2) => {
  const errors: string[] = [];
  if (recipe.schemaVersion !== RECIPE_SCHEMA_VERSION) errors.push('schemaVersion must be 2');
  if (!recipe.versionId) errors.push('versionId is required');
  if (!Number.isInteger(recipe.randomSeed)) errors.push('randomSeed must be an integer');
  if (recipe.phases.length < 1) errors.push('at least one phase is required');
  if (recipe.tracks.length < 1) errors.push('at least one track is required');
  if (recipe.voicePlan) {
    if (recipe.voicePlan.cues.length < 1) errors.push('voicePlan must contain at least one cue');
    if (recipe.voicePlan.exitAtSeconds > recipe.durationSeconds) errors.push('voicePlan must exit before the Recipe ends');
    for (const [index, cue] of recipe.voicePlan.cues.entries()) {
      const isFinalCue = index === recipe.voicePlan.cues.length - 1;
      if (cue.startTime < 0 || cue.speechDuration <= 0 || (!isFinalCue && cue.pauseAfterSeconds < 3) || cue.pauseAfterSeconds < 0) {
        errors.push(`voice cue ${cue.id} has invalid timing`);
      }
    }
  }
  for (const track of recipe.tracks) {
    if (!track.role) errors.push(`track ${track.stemId} is missing role`);
    if (!track.fade) errors.push(`track ${track.stemId} is missing fade`);
    if (!track.loop) errors.push(`track ${track.stemId} is missing loop`);
    if (track.playbackRate !== undefined && (!Number.isFinite(Number(track.playbackRate)) || Number(track.playbackRate) <= 0)) {
      errors.push(`track ${track.stemId} has invalid playbackRate`);
    }
    const musicKitFields = [track.musicKitId, track.musicKitVersion, track.musicPart].filter(Boolean);
    if (musicKitFields.length > 0 && track.role !== 'music') {
      errors.push('track ' + track.stemId + ' has MusicKit metadata but is not a music track');
    }
    if (musicKitFields.length > 0 && musicKitFields.length !== 3) {
      errors.push('track ' + track.stemId + ' has incomplete MusicKit metadata');
    }
  }
  return errors;
};
