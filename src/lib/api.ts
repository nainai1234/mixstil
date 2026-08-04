import type {
  AiSession,
  AdminAssetList,
  AdminDemandCoverage,
  AdminDemandProductionReview,
  AdminImportInbox,
  AdminKnowledgeCatalog,
  AdminOverview,
  AdminUnifiedContentModel,
  CatalogGoal,
  CatalogRecipe,
  CatalogScene,
  ExportCheck,
  AudioStem,
  Mix,
  MixRecipe,
  MixStatus,
  ProductGoal,
  ProductScene,
  PreferenceEvidence,
  GenerationDecision,
  RenderStatus,
  ShareEventType,
  ShareIntent,
  ShareLink,
  ShareVisibility,
  StemCategory,
  User,
  UserSoundProfile,
  WorkAnalyticsSummary,
} from './domain';

const AUTH_TOKEN_KEY = 'snooze_auth_token';
const SERVICE_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const AUDIO_BASE_URL = String(import.meta.env.VITE_AUDIO_BASE_URL ?? '').replace(/\/$/, '');
const AUDIO_REMOTE_PREFIXES = String(import.meta.env.VITE_AUDIO_REMOTE_PREFIXES ?? '/audio/')
  .split(',')
  .map((prefix) => prefix.trim())
  .filter(Boolean);

export const resolveServiceUrl = (url: string) => {
  const audioRemotePrefix = AUDIO_REMOTE_PREFIXES.find((prefix) => url.startsWith(prefix));
  if (AUDIO_BASE_URL && audioRemotePrefix) {
    return `${AUDIO_BASE_URL}${url.slice(audioRemotePrefix.length)}`;
  }
  if (!SERVICE_BASE_URL || !url.startsWith('/')) return url;
  return `${SERVICE_BASE_URL}${url}`;
};

export const clearAuthToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);
export const hasAuthToken = () => typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
const GUEST_SESSION_PATHS = [
  '/api/me',
  '/api/me/billing',
  '/api/quick-create',
  '/api/listen/home',
  '/api/studio',
  '/api/mixes',
  '/api/playback-events',
  '/api/playback-metrics',
  '/api/ai/sessions',
];
const canBootstrapGuest = (path: string) => GUEST_SESSION_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));

const request = async <T>(path: string, options: RequestInit = {}, retryGuest = true): Promise<T> => {
  let response: Response;
  try {
    const authToken = typeof localStorage === 'undefined' ? '' : localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
    response = await fetch(resolveServiceUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw Object.assign(new Error('The soundscape service is not connected. Start the local API and try again.'), {
      code: 'API_UNAVAILABLE',
      cause: error,
    });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; reasons?: string[] } | null;
    if (response.status === 401 && retryGuest && canBootstrapGuest(path)) {
      const guest = await request<{ token: string }>('/api/auth/guest', { method: 'POST' }, false);
      localStorage.setItem(AUTH_TOKEN_KEY, guest.token);
      return request<T>(path, options, false);
    }
    const baseMessage = response.status === 502 || response.status === 503 || response.status === 504
      ? 'The soundscape service is temporarily unavailable. Please try again in a moment.'
      : payload?.error ?? response.statusText;
    const message = [baseMessage, ...(payload?.reasons ?? [])].join('\n');
    throw Object.assign(new Error(message), {
      status: response.status,
      payload: payload ?? { error: message },
    });
  }

  return response.json() as Promise<T>;
};

export const getDownloadUrl = (mixId: string) => resolveServiceUrl(`/api/mixes/${mixId}/download`);
export const getCreditsJsonDownloadUrl = (mixId: string) => resolveServiceUrl(`/api/mixes/${mixId}/credits.json`);
export const getCreditsTextDownloadUrl = (mixId: string) => resolveServiceUrl(`/api/mixes/${mixId}/credits.txt`);

export type AdminResumableUploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  uploadedParts: number;
  totalParts: number;
  percent: number;
  resumed: boolean;
};

type AdminResumableUploadSession = {
  id: string;
  filename: string;
  fileSize: number;
  contentType: string;
  partSize: number;
  totalParts: number;
  status: 'uploading' | 'finalizing' | 'completed' | 'aborted' | 'failed';
  uploadedParts: Array<{ partNumber: number; bytes: number }>;
  uploadedBytes: number;
  audioUrl: string;
  updatedAt: string;
};

const uploadBinaryPart = async (sessionId: string, partNumber: number, body: Blob) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const authToken = typeof localStorage === 'undefined' ? '' : localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
      const response = await fetch(resolveServiceUrl(`/api/admin/assets/resumable/${encodeURIComponent(sessionId)}/parts/${partNumber}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? response.statusText);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
};

export const tracksToRecipe = (
  tracks: Array<{
    stemId?: string;
    name: string;
    volume: number;
    isMuted: boolean;
    startTime: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
    role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
    eventId?: string;
    playbackRate?: number;
    musicKitId?: string;
    musicKitVersion?: string;
    musicPart?: 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition';
    phaseIds?: string[];
    fade?: { inSeconds: number; outSeconds: number };
    loop?: boolean | { enabled: boolean; crossfadeSeconds: number };
    volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
  }>,
  stems: AudioStem[],
  baseRecipe?: MixRecipe,
): MixRecipe => {
  const events = tracks
    .filter((track) => track.eventId)
    .map((track) => ({
      id: track.eventId as string,
      type: 'accent' as const,
      stemId: track.stemId as string,
      atSeconds: track.startTime,
      volume: track.volume,
    }));
  const recipeTracks = tracks.filter((track) => !track.eventId).map((track) => {
    const stem = stems.find((item) => item.id === track.stemId) ?? stems.find((item) => item.name === track.name) ?? stems[0];
    if (!track.stemId && !stem) throw new Error(`Cannot save track without a registered stem: ${track.name}`);
    return {
      stemId: track.stemId ?? stem.id,
      volume: track.volume,
      isMuted: track.isMuted,
      startTime: track.startTime,
      duration: track.duration,
      trimStart: track.trimStart,
      trimEnd: track.trimEnd,
      role: track.role ?? stem.category.toLowerCase() as 'base' | 'environment' | 'music' | 'voice' | 'accent',
      playbackRate: track.playbackRate,
      musicKitId: track.musicKitId,
      musicKitVersion: track.musicKitVersion,
      musicPart: track.musicPart,
      phaseIds: track.phaseIds,
      fade: track.fade,
      loop: typeof track.loop === 'boolean' ? { enabled: track.loop, crossfadeSeconds: track.loop ? 3 : 0 } : track.loop,
      volumeAutomation: track.volumeAutomation,
    };
  });
  for (const eventTrack of tracks.filter((track) => track.eventId)) {
    if (recipeTracks.some((track) => track.stemId === eventTrack.stemId && track.role === 'accent')) continue;
    const stem = stems.find((item) => item.id === eventTrack.stemId);
    if (!stem) continue;
    recipeTracks.push({
      stemId: stem.id,
      volume: eventTrack.volume,
      isMuted: eventTrack.isMuted,
      startTime: eventTrack.startTime,
      duration: eventTrack.duration,
      trimStart: eventTrack.trimStart,
      trimEnd: eventTrack.trimEnd,
      role: 'accent',
      playbackRate: eventTrack.playbackRate,
      musicKitId: undefined,
      musicKitVersion: undefined,
      musicPart: undefined,
      phaseIds: eventTrack.phaseIds ?? ['core'],
      fade: eventTrack.fade,
      loop: { enabled: false, crossfadeSeconds: 0 },
      volumeAutomation: eventTrack.volumeAutomation,
    });
  }
  return {
    ...baseRecipe,
    schemaVersion: 2,
    versionState: 'live',
    tracks: recipeTracks,
    events: events.length > 0 ? events : baseRecipe?.events ?? [],
    durationSeconds: Math.max(600, ...tracks.map((track) => track.startTime + track.duration)),
    moodTags: baseRecipe?.moodTags ?? ['Custom Mix'],
  };
};

export const api = {
  register: async (input: { username: string; email: string; password: string }) => {
    const result = await request<{ user: User; token: string; expiresAt: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    return result;
  },

  login: async (input: { email: string; password: string }) => {
    const result = await request<{ user: User; token: string; expiresAt: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    return result;
  },

  getAuthSession: () => request<{ user: User }>('/api/auth/session'),
  deleteAccount: () => request<{ deleted: boolean }>('/api/me', {
    method: 'DELETE',
    headers: { 'X-Confirm-Account-Deletion': 'DELETE' },
  }),

  getPublicMix: (mixId: string) => request<{
    mix: Mix;
    creatorName: string;
    stems: AudioStem[];
    playbackPolicy: { maxSessionSeconds: number | null; isPreview: boolean };
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
    }>;
  }>(`/api/public/mixes/${mixId}`),

  getProductCapabilities: () => request<{
    releaseChannel: 'voice-free-beta';
    guidedVoice: boolean;
  }>('/api/product-capabilities'),

  getCurrentUser: () => request<User>('/api/me'),
  getBilling: () => request<{
    tier: 'free' | 'pro';
    plan: 'Free' | 'Plus';
    generation: { used: number; limit: number | null; remaining: number | null };
    savedSounds: { used: number; limit: number | null };
    playback: { maxSessionSeconds: number | null; communityPreviewSeconds: number | null; offline: boolean };
    pricing: { monthly: number; annual: number; foundingAnnual: number };
  }>('/api/me/billing'),

  getSoundProfile: () => request<{
    profile: UserSoundProfile;
    evidence: PreferenceEvidence[];
  }>('/api/me/sound-profile'),

  updateSoundProfile: (input: Partial<Pick<UserSoundProfile, 'likedSounds' | 'excludedSounds' | 'defaultGoal' | 'defaultDurationSeconds' | 'sensitivity'>>) => request<{
    profile: UserSoundProfile;
    evidence: PreferenceEvidence[];
  }>('/api/me/sound-profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  }),

  deletePreferenceEvidence: (id: string) => request<{
    profile: UserSoundProfile;
    evidence: PreferenceEvidence[];
  }>(`/api/me/preference-evidence/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),

  listAudioStems: () => request<AudioStem[]>('/api/audio-stems'),

  getContentCatalog: () => request<{
    goals: CatalogGoal[];
    scenes: CatalogScene[];
    recipes: CatalogRecipe[];
  }>('/api/content-catalog'),

  getAdminOverview: () => request<AdminOverview>('/api/admin/overview'),

  getAdminContentModel: () => request<AdminUnifiedContentModel>('/api/admin/content-model'),

  getAdminDemandCoverage: () => request<AdminDemandCoverage>('/api/admin/content-demand-coverage'),

  getAdminDemandProductionReview: (batchId = '') => request<AdminDemandProductionReview>(`/api/admin/demand-production-review${batchId ? `?batchId=${encodeURIComponent(batchId)}` : ''}`),

  reviewAdminDemandProductionCandidate: (mixId: string, input: {
    decision: 'passed' | 'needs_rework' | 'rejected';
    notes?: string;
  }) => request<{
    mixId: string;
    decision: 'passed' | 'needs_rework' | 'rejected';
    approvalState: string;
  }>(`/api/admin/demand-production-review/${encodeURIComponent(mixId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),

  releaseAdminDemandProductionCandidate: (mixId: string) => request<{
    mixId: string;
    status: MixStatus;
    renderStatus: RenderStatus;
    publishedVersionId: string;
    approvalState: string;
    discoverBoundary: string;
    discoverPlacementAllowed: boolean;
  }>(`/api/admin/demand-production-review/${encodeURIComponent(mixId)}/release-governance`, {
    method: 'POST',
    body: JSON.stringify({ releasedBy: 'admin' }),
  }),

  getAdminKnowledge: (input: { query?: string; dimension?: string; conceptId?: string } = {}) => {
    const params = new URLSearchParams();
    if (input.query?.trim()) params.set('query', input.query.trim());
    if (input.dimension) params.set('dimension', input.dimension);
    if (input.conceptId) params.set('conceptId', input.conceptId);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<AdminKnowledgeCatalog>(`/api/admin/knowledge${suffix}`);
  },

  updateAdminKnowledgeConcept: (id: string, input: { name: string; description: string; synonyms: string[]; active: boolean }) => request<{
    concept: AdminKnowledgeCatalog['selectedConcept'];
  }>(`/api/admin/knowledge/concepts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),

  getAdminAssets: (input: { query?: string; category?: string; status?: string; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams();
    if (input.query?.trim()) params.set('query', input.query.trim());
    if (input.category) params.set('category', input.category);
    if (input.status) params.set('status', input.status);
    if (input.limit) params.set('limit', String(input.limit));
    if (input.offset) params.set('offset', String(input.offset));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<AdminAssetList>(`/api/admin/assets${suffix}`);
  },

  getAdminImportInbox: () => request<AdminImportInbox>('/api/admin/assets/import-inbox'),

  importAdminInboxAssets: (paths?: string[]) => request<{
    imported: Array<{ relativePath: string; asset: AudioStem }>;
    skipped: Array<{ relativePath: string; reason: string; existingStemId: string | null }>;
    summary: { imported: number; skipped: number };
  }>('/api/admin/assets/import-inbox', {
    method: 'POST',
    body: JSON.stringify({ paths }),
  }),

  inspectAdminAssetUpload: async (file: File) => {
    const formData = new FormData();
    formData.set('file', file);
    const authToken = typeof localStorage === 'undefined' ? '' : localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
    const response = await fetch(resolveServiceUrl('/api/admin/assets/inspect-upload'), {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: formData,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string; reasons?: string[] } | null;
      throw new Error([payload?.error ?? response.statusText, ...(payload?.reasons ?? [])].join('\n'));
    }
    return response.json() as Promise<{
      suggestion: {
        name: string;
        category: StemCategory;
        tags: string;
        description: string;
        defaultVolume: number;
        sourcePlatform: string;
        sourceCreator: string;
        sourceUrl: string;
        licenseName: string;
        licenseUrl: string;
        commercialUseAllowed: boolean;
        derivativeUseAllowed: boolean;
        attributionRequired: boolean;
        rawRedistributionAllowed: boolean;
        fileSha256: string;
        durationSeconds: number | null;
        sampleRate: number | null;
        contentType: string;
        warnings: string[];
      };
    }>;
  },

  uploadAdminAssetResumable: async (input: {
    file: File;
    name: string;
    category: StemCategory;
    tags: string;
    description: string;
    defaultVolume: number;
    sourcePlatform: string;
    sourceUrl: string;
    sourceCreator: string;
    licenseName: string;
    licenseUrl: string;
    commercialUseAllowed: boolean;
    derivativeUseAllowed: boolean;
    attributionRequired: boolean;
    rawRedistributionAllowed: boolean;
  }, onProgress?: (progress: AdminResumableUploadProgress) => void) => {
    const fingerprint = `${input.file.name}:${input.file.size}:${input.file.lastModified}`;
    const storageKey = `snooze_admin_resumable_upload:${fingerprint}`;
    const resumeSessionId = typeof localStorage === 'undefined' ? '' : localStorage.getItem(storageKey) ?? '';
    const metadata = {
      name: input.name,
      category: input.category,
      tags: input.tags,
      description: input.description,
      defaultVolume: input.defaultVolume,
      sourcePlatform: input.sourcePlatform,
      sourceUrl: input.sourceUrl,
      sourceCreator: input.sourceCreator,
      licenseName: input.licenseName,
      licenseUrl: input.licenseUrl,
      commercialUseAllowed: input.commercialUseAllowed,
      derivativeUseAllowed: input.derivativeUseAllowed,
      attributionRequired: input.attributionRequired,
      rawRedistributionAllowed: input.rawRedistributionAllowed,
    };
    const created = await request<{ session: AdminResumableUploadSession }>('/api/admin/assets/resumable', {
      method: 'POST',
      body: JSON.stringify({
        filename: input.file.name,
        fileSize: input.file.size,
        contentType: input.file.type,
        lastModified: input.file.lastModified,
        metadata,
        resumeSessionId,
      }),
    });
    let session = created.session;
    const resumed = Boolean(resumeSessionId && session.id === resumeSessionId && session.uploadedParts.length > 0);
    if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, session.id);
    const uploadedParts = new Set(session.uploadedParts.map((part) => part.partNumber));
    let uploadedBytes = session.uploadedBytes;
    const reportProgress = () => onProgress?.({
      uploadedBytes,
      totalBytes: input.file.size,
      uploadedParts: uploadedParts.size,
      totalParts: session.totalParts,
      percent: Math.min(100, Math.round((uploadedBytes / input.file.size) * 100)),
      resumed,
    });
    reportProgress();
    if (session.status === 'uploading') {
      const missingParts = Array.from({ length: session.totalParts }, (_, index) => index + 1)
        .filter((partNumber) => !uploadedParts.has(partNumber));
      let cursor = 0;
      const worker = async () => {
        while (cursor < missingParts.length) {
          const partNumber = missingParts[cursor++];
          const start = (partNumber - 1) * session.partSize;
          const end = Math.min(input.file.size, start + session.partSize);
          await uploadBinaryPart(session.id, partNumber, input.file.slice(start, end));
          uploadedParts.add(partNumber);
          uploadedBytes += end - start;
          reportProgress();
        }
      };
      await Promise.all(Array.from({ length: Math.min(2, missingParts.length) }, () => worker()));
    }
    const completed = await request<{ session: AdminResumableUploadSession; asset: AudioStem; duplicate: boolean }>(
      `/api/admin/assets/resumable/${encodeURIComponent(session.id)}/complete`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    session = completed.session;
    uploadedBytes = input.file.size;
    reportProgress();
    if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
    return completed;
  },

  uploadAdminAsset: async (input: {
    file: File;
    name: string;
    category: StemCategory;
    tags: string;
    description: string;
    defaultVolume: number;
    sourcePlatform: string;
    sourceUrl: string;
    sourceCreator: string;
    licenseName: string;
    licenseUrl: string;
    commercialUseAllowed: boolean;
    derivativeUseAllowed: boolean;
    attributionRequired: boolean;
    rawRedistributionAllowed: boolean;
  }) => {
    const formData = new FormData();
    formData.set('file', input.file);
    formData.set('name', input.name);
    formData.set('category', input.category);
    formData.set('tags', input.tags);
    formData.set('description', input.description);
    formData.set('defaultVolume', String(input.defaultVolume));
    formData.set('sourcePlatform', input.sourcePlatform);
    formData.set('sourceUrl', input.sourceUrl);
    formData.set('sourceCreator', input.sourceCreator);
    formData.set('licenseName', input.licenseName);
    formData.set('licenseUrl', input.licenseUrl);
    formData.set('commercialUseAllowed', String(input.commercialUseAllowed));
    formData.set('derivativeUseAllowed', String(input.derivativeUseAllowed));
    formData.set('attributionRequired', String(input.attributionRequired));
    formData.set('rawRedistributionAllowed', String(input.rawRedistributionAllowed));
    const authToken = typeof localStorage === 'undefined' ? '' : localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
    const response = await fetch(resolveServiceUrl('/api/admin/assets/upload'), {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: formData,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? response.statusText);
    }
    return response.json() as Promise<{ asset: AudioStem; audioUrl: string; localPath: string }>;
  },

  reviewAdminAsset: (id: string, input: { qaStatus: 'approved' | 'needs_review' | 'rejected'; notes: string }) => request<{ asset: AudioStem; releaseEligible: boolean; warnings: string[] }>(`/api/admin/assets/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),

  getListeningQaSession: () => request<{
    generatedAt: string;
    checklistUrl: string;
    scoringFields: string[];
    items: Array<{
      recipeId: string;
      name: string;
      goal: ProductGoal;
      scene: ProductScene;
      durationSeconds: number;
      mixId: string;
      renderedAudioUrl: string;
      renderStatus: string;
      autoQa: null | {
        renderedAudioUrl: string;
        durationSeconds: number;
        peakDb: number | null;
        integratedLufs: number | null;
        abnormalSilenceCount: number;
        passed: boolean;
        createdAt: string;
      };
    }>;
  }>('/api/listening-qa/session'),

  saveListeningQaResults: (input: { markdown: string; status: 'draft' | 'final' }) => request<{
    saved: boolean;
    status: 'draft' | 'final';
    filename: string;
    path: string;
    relativePath: string;
  }>('/api/listening-qa/results', {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  quickCreate: (input: {
    goal?: ProductGoal;
    scene?: ProductScene;
    prompt?: string;
    durationSeconds?: number;
    guidedVoice?: boolean;
    environmentIntensity?: number;
    musicIntensity?: number;
    voiceIntensity?: number;
    languagePreference?: 'system' | 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi';
    resolvedLanguage?: 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi';
    stableExcludedSounds?: string[];
    stableLikedSounds?: string[];
  }, options: { internalMobilePlaybackQa?: boolean } = {}) => request<{
    mix: Mix;
    stems: AudioStem[];
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
      role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
      eventId?: string;
      phaseIds?: string[];
      playbackRate?: number;
      sourceGainDb?: number;
      fade?: { inSeconds: number; outSeconds: number };
      loop?: boolean | { enabled: boolean; crossfadeSeconds: number };
      volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
    }>;
    recipe: CatalogRecipe;
    planning: {
      requestId: string;
      provider: string;
      model: string | null;
      selected: unknown;
      rejectedCount: number;
      internalBaselineSeed?: string | null;
      composerBundlePlan?: unknown | null;
      composerRenderPilot?: unknown | null;
    };
    generationDecision: GenerationDecision;
  }>('/api/quick-create', {
    method: 'POST',
    headers: options.internalMobilePlaybackQa
      ? { 'X-SNOOZE-Internal-QA': 'mobile-playback' }
      : undefined,
    body: JSON.stringify(input),
  }),

  getHomeFeed: () => request<{
    daily: Mix;
    recentlyPlayed: Mix[];
  }>('/api/listen/home'),

  getPlaybackStates: () => request<Array<{
    mixId: string;
    positionSeconds: number;
    durationSeconds: number;
    updatedAt: string;
  }>>('/api/me/playback-states'),

  updatePlaybackState: (mixId: string, input: { positionSeconds: number; durationSeconds: number }) => request<{
    mixId: string;
    positionSeconds: number;
    durationSeconds: number;
    updatedAt: string;
  }>(`/api/me/playback-states/${encodeURIComponent(mixId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),

  getDiscoverFeed: (query = '') => request<{
    editorsChoice: Mix | null;
    trending: Mix[];
    tags: string[];
    heroLabel: string;
    quickActions: Array<{ label: string; prompt: string }>;
    sections: Array<{
      id: string;
      eyebrow: string;
      title: string;
      description: string;
      prompt: string;
      icon: string;
      mixIds: string[];
      mixes: Mix[];
    }>;
    creators: User[];
    search: { query: string; total: number; exactContentMatches: boolean };
  }>(`/api/discover?query=${encodeURIComponent(query)}`),

  getDiscoverConfig: () => request<{
    version: number;
    heroLabel: string;
    tags: string[];
    quickActions: Array<{ label: string; prompt: string }>;
    sections: Array<{
      id: string;
      enabled: boolean;
      eyebrow: string;
      title: string;
      description: string;
      prompt: string;
      keywords: string[];
      mixIds: string[];
      icon: string;
      limit: number;
    }>;
    availableMixes: Mix[];
    demandPools: Array<{
      id: string;
      title: string;
      description: string;
      prompt: string;
      keywords: string[];
      goal: ProductGoal;
      scene: ProductScene;
      contentMode: string;
      freeTargetCount: number;
      paidTargetCount: number;
      eligibleMixCount: number;
      eligibleMixIds: string[];
      mixes: Array<{
        id: string;
        title: string;
        goal: string;
        scene: string;
        contentMode: string;
        playsCount: number;
        trackCategories: string[];
      }>;
    }>;
    governance: {
      releaseEligibleMixIds: string[];
      blockedBindings: Array<{ sectionId: string; mixId: string; reason: string }>;
      emptySections: Array<{ sectionId: string; title: string; reason: string }>;
    };
  }>('/api/admin/discover-config'),

  updateDiscoverConfig: (input: {
    version: number;
    heroLabel: string;
    tags: string[];
    quickActions: Array<{ label: string; prompt: string }>;
    sections: Array<{
      id: string;
      enabled: boolean;
      eyebrow: string;
      title: string;
      description: string;
      prompt: string;
      keywords: string[];
      mixIds: string[];
      icon: string;
      limit: number;
    }>;
  }) => request<{
    version: number;
    heroLabel: string;
    tags: string[];
    quickActions: Array<{ label: string; prompt: string }>;
    sections: Array<{
      id: string;
      enabled: boolean;
      eyebrow: string;
      title: string;
      description: string;
      prompt: string;
      keywords: string[];
      mixIds: string[];
      icon: string;
      limit: number;
    }>;
    governance: {
      releaseEligibleMixIds: string[];
      blockedBindings: Array<{ sectionId: string; mixId: string; reason: string }>;
      emptySections: Array<{ sectionId: string; title: string; reason: string }>;
    };
  }>('/api/admin/discover-config', {
    method: 'PUT',
    body: JSON.stringify(input),
  }),

  getStudioDashboard: (input: { query?: string; goal?: ProductGoal; page?: number; pageSize?: number; all?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (input.query?.trim()) params.set('query', input.query.trim());
    if (input.goal) params.set('goal', input.goal);
    if (input.page) params.set('page', String(input.page));
    if (input.pageSize) params.set('pageSize', String(input.pageSize));
    if (input.all) params.set('all', 'true');
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<{
    mixes: Mix[];
    totalPlays: number;
    engagementRate: number;
      pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
    }>(`/api/studio${suffix}`);
  },

  getMix: (id: string, options: { internalMobilePlaybackQa?: boolean } = {}) => request<{
    mix: Mix;
    creatorName: string;
    stems: AudioStem[];
    playbackPolicy: { maxSessionSeconds: number | null; isPreview: boolean };
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
      role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
      eventId?: string;
      phaseIds?: string[];
      playbackRate?: number;
      sourceGainDb?: number;
      fade?: { inSeconds: number; outSeconds: number };
      loop?: boolean | { enabled: boolean; crossfadeSeconds: number };
      volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
    }>;
  }>(`/api/mixes/${id}`, {
    headers: options.internalMobilePlaybackQa
      ? { 'X-SNOOZE-Internal-QA': 'mobile-playback' }
      : undefined,
  }),

  getMixVersions: (id: string) => request<Array<{
    id: string;
    versionNumber: number;
    recipeData: MixRecipe;
    createdAt: string;
    isCurrent: boolean;
  }>>(`/api/mixes/${id}/versions`),

  getMixQaReports: (id: string) => request<Array<{
    id: string;
    recipeVersionId: string | null;
    renderedAudioUrl: string;
    durationSeconds: number;
    peakDb: number | null;
    meanDb: number | null;
    integratedLufs: number | null;
    truePeakDb: number | null;
    abnormalSilenceCount: number;
    passed: boolean;
    createdAt: string;
  }>>(`/api/mixes/${id}/qa-reports`),

  getVoiceScript: (id: string, language: 'en' | 'zh') => request<{
    language: 'en' | 'zh';
    blocks: Array<{ id: string; role: string; text: string; pauseAfterSeconds: number }>;
    script: string;
  }>(`/api/mixes/${id}/voice-script?language=${language}`),

  generateVoicePreview: (id: string, input: { language: 'en' | 'zh'; scriptText?: string; voice?: string }) => request<{
    jobId: string; status: 'ready'; audioUrl: string; stemId: string; mix: Mix;
  }>(`/api/mixes/${id}/voice-generation`, { method: 'POST', body: JSON.stringify(input) }),

  ensureVoicePreview: (id: string) => request<{
    jobId?: string;
    status: 'ready' | 'running';
    existing?: boolean;
    audioUrl?: string;
    stemId?: string;
    fallback?: 'voice_off';
    mix: Mix;
  }>(`/api/mixes/${id}/voice-preview/ensure`, { method: 'POST' }),

  getVoicePreviewStatus: (id: string) => request<{
    jobId?: string | null;
    status: 'not_started' | 'queued' | 'running' | 'ready' | 'failed';
    audioUrl?: string;
    stemId?: string;
    error?: string;
    fallback?: 'voice_off';
    mix: Mix;
  }>(`/api/mixes/${id}/voice-preview/status`),

  saveMix: (input: {
    title: string;
    description: string;
    status: MixStatus;
    recipeData: MixRecipe;
    coverImageUrl?: string;
  }) => request<Mix>('/api/mixes', {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  updateMix: (mixId: string, input: {
    title?: string;
    description?: string;
    status?: MixStatus;
    recipeData?: MixRecipe;
    coverImageUrl?: string;
  }) => request<Mix>(`/api/mixes/${mixId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),

  recordPlay: (mixId: string, durationListened = 0) => request<Mix>(`/api/mixes/${mixId}/play`, {
    method: 'POST',
    body: JSON.stringify({ durationListened }),
  }),

  recordPlaybackEvents: (mixId: string, journeyId: string, events: Array<{
    type: 'quick_create_started' | 'recipe_ready' | 'playback_requested' | 'playback_started' | 'playback_failed' | 'playback_checkpoint' | 'native_media_session_ready' | 'native_media_session_failed' | 'result_accepted' | 'result_adjust_requested' | 'result_adjust_applied' | 'result_adjust_failed' | 'result_retry_requested' | 'work_saved' | 'work_published' | 'share_created';
    elapsedMs: number;
    details?: Record<string, unknown>;
  }>) => request<{ recorded: number; journeyId: string }>(`/api/mixes/${mixId}/playback-events`, {
    method: 'POST',
    body: JSON.stringify({ journeyId, events }),
  }),

  recordFitFeedback: (mixId: string, input: {
    feedback: 'fits_me' | 'too_loud' | 'too_bright' | 'too_plain' | 'do_not_use';
    listenedSeconds?: number;
    journeyId?: string;
  }) => request<{
    recorded: boolean;
    evidence: PreferenceEvidence;
  }>(`/api/mixes/${mixId}/fit-feedback`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  getPlaybackJourneyEvents: (journeyId: string) => request<{
    journeyId: string;
    events: Array<{
      type: string;
      elapsedMs: number;
      details: Record<string, unknown>;
      createdAt: string;
    }>;
  }>(`/api/playback-events/journeys/${encodeURIComponent(journeyId)}`),

  getPlaybackMetricsSummary: (filters?: { cohort?: string; participant?: string; source?: string; includeSynthetic?: boolean }) => {
    const search = new URLSearchParams();
    if (filters?.cohort) search.set('cohort', filters.cohort);
    if (filters?.participant) search.set('participant', filters.participant);
    if (filters?.source) search.set('source', filters.source);
    if (filters?.includeSynthetic) search.set('includeSynthetic', '1');
    return request<{
    filters: { cohort: string | null; participant: string | null; source: string | null; includeSynthetic: boolean };
    totalJourneys: number;
    playbackRequestedJourneys: number;
    successfulJourneys: number;
    failedJourneys: number;
    pendingPlaybackJourneys: number;
    awaitingUserPlayJourneys: number;
    successRate: number | null;
    resultDecisions: {
      decidedJourneys: number;
      acceptedJourneys: number;
      firstAcceptedJourneys: number;
      adjustRequestedJourneys: number;
      retryRequestedJourneys: number;
      firstResultAcceptanceRate: number | null;
    };
    resultOutcomes: {
      savedJourneys: number;
      saveRate: number | null;
      adjustedThenSavedJourneys: number;
      adjustedThenSavedRate: number | null;
      replayedJourneys: number;
      replayRate: number | null;
      publishedJourneys: number;
      shareCreatedJourneys: number;
    };
    adjustments: {
      requestedJourneys: number;
      appliedJourneys: number;
      failedJourneys: number;
      successRate: number | null;
    };
    failureReasons: Array<{ reason: string; count: number }>;
    retentionReadiness: {
      paymentReadiness: 'collecting_data' | 'ready_to_test_paywall' | 'not_ready';
      enoughDecisionData: boolean;
      recommendations: string[];
      gates: {
        acceptedOrSaved: { value: number | null; target: number; passed: boolean; numerator: number; denominator: number };
        threeDayReplay: { value: number; target: number; passed: boolean };
        preferenceMemory: { value: number; target: number; passed: boolean };
      };
      account30Day: {
        totalPlaybacks: number;
        playDays: number;
        listenedSeconds: number;
        savedSounds: number;
      };
      preferenceEvidence: {
        total: number;
        explicitProfile: number;
        savedSound: number;
        playbackBehavior: number;
        exclusions: number;
      };
    };
    timeToRecipeReadyMs: { p50: number | null; p95: number | null };
    timeToFirstPlaybackMs: { p50: number | null; p95: number | null };
    journeys: Array<{
      journeyId: string;
      recipeReadyMs: number | null;
      playbackStartedMs: number | null;
      requested: boolean;
      failed: boolean;
      accepted: boolean;
      adjustRequested: boolean;
      retryRequested: boolean;
      firstDecision: 'accepted' | 'adjusted' | 'retried' | null;
      firstResultAccepted: boolean;
      adjustmentApplied: boolean;
      adjustmentFailed: boolean;
      saved: boolean;
      published: boolean;
      shareCreated: boolean;
      playbackCount: number;
      request: Record<string, unknown> | null;
      recipe: Record<string, unknown> | null;
      adjustments: Array<Record<string, unknown>>;
    }>;
  }>(`/api/playback-metrics/summary${search.size ? `?${search}` : ''}`);
  },

  favoriteMix: (mixId: string) => request<Mix>(`/api/mixes/${mixId}/favorite`, {
    method: 'POST',
  }),

  recordShare: (mixId: string) => request<Mix>(`/api/mixes/${mixId}/share`, {
    method: 'POST',
  }),

  createShareLink: (mixId: string, input: {
    intent: ShareIntent;
    visibility: ShareVisibility;
    title?: string;
    description?: string;
    creatorName?: string;
    recipientLabel?: string;
    personalMessage?: string;
    expiresAt?: string | null;
  }) => request<ShareLink>(`/api/mixes/${mixId}/share-links`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  getMixShareLinks: (mixId: string) => request<{ shareLinks: ShareLink[] }>(`/api/mixes/${mixId}/share-links`),

  getShareLink: (slug: string, creatorPreviewToken = '') => request<{
    shareLink: ShareLink;
    durationSeconds: number;
    playbackPolicy: { maxSessionSeconds: number | null; isPreview: boolean };
    attributionCredits: import('./domain').AttributionCredit[];
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
      role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
      eventId?: string;
      phaseIds?: string[];
      playbackRate?: number;
      sourceGainDb?: number;
      fade?: { inSeconds: number; outSeconds: number };
      loop?: boolean | { enabled: boolean; crossfadeSeconds: number };
      volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
    }>;
  }>(`/api/share-links/${slug}${creatorPreviewToken ? `?creatorPreviewToken=${encodeURIComponent(creatorPreviewToken)}` : ''}`),

  recordShareEvent: (slug: string, input: {
    eventType: ShareEventType;
    visitorId?: string;
    source?: string;
    elapsedMs?: number;
    playbackSeconds?: number;
    details?: Record<string, unknown>;
  }, creatorPreviewToken = '') => request<{ recorded: boolean }>(`/api/share-links/${slug}/events${creatorPreviewToken ? `?creatorPreviewToken=${encodeURIComponent(creatorPreviewToken)}` : ''}`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  renderMix: (mixId: string) => request<{
    mix: Mix;
    renderedAudioUrl: string;
    exportCheck?: ExportCheck;
  }>(`/api/mixes/${mixId}/render`, {
    method: 'POST',
  }),

  getExportCheck: (mixId: string) => request<ExportCheck>(`/api/mixes/${mixId}/export-check`),

  replaceBlockedStems: (mixId: string, input: { stemId?: string; replacementStemId?: string } = {}) => request<{
    mix: Mix;
    replacements: Array<{
      fromStemId: string;
      fromName: string;
      toStemId: string;
      toName: string;
    }>;
    exportCheck: ExportCheck;
  }>(`/api/mixes/${mixId}/replace-blocked-stems`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),

  applyRecipeEdit: (mixId: string, instruction: string) => request<{
    mix: Mix;
    edit: {
      instruction: string;
      operation: string;
      changedTrackStemIds: string[];
      previousRecipeData: MixRecipe;
      createdAt: string;
    };
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
    }>;
  }>(`/api/mixes/${mixId}/recipe-edits`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  }),

  undoRecipeEdit: (mixId: string) => request<{
    mix: Mix;
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
    }>;
  }>(`/api/mixes/${mixId}/recipe-edits/undo`, {
    method: 'POST',
  }),

  getWorkAnalytics: (mixId: string) => request<WorkAnalyticsSummary>(`/api/mixes/${mixId}/analytics`),

  getAiStatus: () => request<{
    provider: 'deepseek' | 'openai' | 'rules';
    model: string | null;
    fallback: 'rules';
    ready: boolean;
  }>('/api/ai/status'),

  generateAiRecipe: (prompt: string) => request<{
    session: AiSession;
    mix: Mix;
    stems: AudioStem[];
    tracks: Array<{
      id: number;
      stemId?: string;
      name: string;
      url: string;
      volume: number;
      isMuted: boolean;
      startTime: number;
      duration: number;
      sourceDuration: number;
      trimStart: number;
      trimEnd: number;
      tags: string[];
    }>;
    audioIntent?: Mix['recipeData']['audioIntent'];
    planning?: {
      requestId: string;
      provider: string;
      model: string | null;
      selected: unknown;
      rejectedCount: number;
      internalBaselineSeed?: string | null;
      composerBundlePlan?: unknown | null;
    };
    generationDecision: GenerationDecision;
  }>('/api/ai/sessions', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }),

  generateLyriaMusic: (input: {
    prompt: string;
    model?: string;
    projectId?: string;
    location?: string;
    endpoint?: string;
  }) => request<{
    provider: 'google-cloud-vertex-ai';
    product: 'lyria-music-generation';
    projectId: string;
    location: string;
    model: string;
    endpoint: string;
    mimeType: string;
    audioUrl: string;
    bytes: number;
    prompt: string;
  }>('/api/music-generation/lyria', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
};
