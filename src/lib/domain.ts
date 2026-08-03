export type UserRole = 'consumer' | 'creator' | 'admin';
export type SubscriptionTier = 'free' | 'pro';
export type MixStatus = 'draft' | 'published' | 'private';
export type RenderStatus = 'not_rendered' | 'rendering' | 'ready' | 'failed';
export type ShareIntent = 'tonight' | 'gift';
export type ShareVisibility = 'public' | 'unlisted';
export type StemCategory = 'Nature' | 'Music' | 'Noise' | 'Voice' | 'Accent';
export type StemQaStatus = 'candidate' | 'approved' | 'needs_review' | 'rejected';
export type ProductGoal = 'sleep' | 'calm' | 'focus';
export type ProductScene = 'bedtime' | 'return_to_sleep' | 'breathing' | 'emotional_settling' | 'deep_focus';
export type MusicKitStemRole = 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition';
export type GenerationDecisionKind = 'inventory_only' | 'inventory_plus_missing_stem' | 'unsupported_multi_gap';
export type MissingStemRole = 'music.bed' | 'environment.scene' | 'base.masking' | 'accent.event';

export type GenerationDecision = {
  kind: GenerationDecisionKind;
  goal: ProductGoal;
  scene: ProductScene;
  contentMode: 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';
  inventoryStemIds: string[];
  missing: Array<{ role: MissingStemRole; conceptIds: string[] }>;
  generationSpec: {
    targetConceptIds: string[];
    semanticDescription: string;
    role: MissingStemRole;
    durationSeconds: number;
    loopRequired: boolean;
    acousticTargets: {
      brightness: [number, number];
      eventDensity: [number, number];
      dynamicRangeDb: [number, number];
    };
    forbiddenConceptIds: string[];
    phaseFit: Array<'arrival' | 'settling' | 'core' | 'release'>;
    candidateCount: number;
    providerPolicy: 'local_musickit_factory_only' | 'approved_inventory_import_first_then_external_sfx_candidates';
  } | null;
  fullTrackProviderAllowed: false;
  reason: string;
};

export type UserSoundProfile = {
  userId: string;
  likedSounds: string[];
  excludedSounds: string[];
  defaultGoal: ProductGoal;
  defaultDurationSeconds: number;
  sensitivity: Record<string, string>;
  updatedAt: string;
};

export type PreferenceEvidence = {
  id: string;
  kind: 'like' | 'exclusion' | 'default_goal' | 'default_duration' | 'sensitivity';
  value: string;
  source: 'explicit_profile' | 'saved_sound' | 'ai_refinement' | 'playback_behavior';
  stable: boolean;
  mixId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type User = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  createdAt: string;
  updatedAt: string;
};

export type AudioStem = {
  id: string;
  name: string;
  category: StemCategory;
  audioUrl: string;
  isPremium: boolean;
  tags: string[];
  defaultVolume: number;
  description: string;
  sourcePlatform: string;
  sourceUrl: string;
  sourceItemId: string;
  sourceCreator: string;
  licenseName: string;
  licenseUrl: string;
  commercialUseAllowed: boolean;
  derivativeUseAllowed: boolean;
  attributionRequired: boolean;
  rawRedistributionAllowed: boolean;
  qaStatus: StemQaStatus;
  qaNotes: string;
  fileSha256: string;
  importedAt: string | null;
};

export type AdminOverview = {
  generatedAt: string;
  users: {
    total: number;
    byRole: Record<string, number>;
    bySubscriptionTier: Record<string, number>;
    recent: User[];
    management: Array<{
      id: string;
      username: string;
      email: string;
      role: UserRole;
      subscriptionTier: SubscriptionTier;
      createdAt: string;
      updatedAt: string;
      savedSounds: number;
      totalPlays: number;
      preferenceCount: number;
      exclusionCount: number;
      playbackStateCount: number;
      lastPlayedAt: string | null;
    }>;
    playbackRecords: Array<{
      userId: string;
      username: string;
      mixId: string;
      title: string;
      durationListened: number;
      playedAt: string;
    }>;
  };
  products: {
    totalMixes: number;
    byStatus: Record<string, number>;
    byRenderStatus: Record<string, number>;
    byGoal: Record<string, number>;
    topMixes: Mix[];
    goals: CatalogGoal[];
    scenes: CatalogScene[];
    defaultRecipes: Array<{
      id: string;
      name: string;
      goal: ProductGoal;
      scene: ProductScene;
      contentMode: 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';
      durationSeconds: number;
      trackCount: number;
    }>;
  };
  assets: {
    total: number;
    byCategory: Record<string, number>;
    byQaStatus: Record<string, number>;
    recent: AudioStem[];
  };
  knowledge: {
    conceptCount: number;
    byDimension: Record<string, number>;
    metadataSummary: {
      total: number;
      editorialBaseline: number;
      catalogBaseline: number;
    };
    sampleConcepts: Array<{
      id: string;
      parentId: string | null;
      dimension: string;
      name: string;
      description: string;
      synonyms: string[];
      active: boolean;
    }>;
  };
  operations: {
    contentPipeline: {
      principles: string[];
      summary: {
        totalAssets: number;
        releaseEligibleAssets: number;
        blockedAssets: number;
        semanticMetadata: number;
        discoverEligibleContent: number;
        openProductionGaps: number;
      };
      assetGovernance: Array<{
        id: string;
        name: string;
        category: StemCategory;
        qaStatus: StemQaStatus;
        licenseName: string;
        conceptCount: number;
        contentUsageCount: number;
        releaseEligible: boolean;
        blockers: string[];
      }>;
      contentItems: Array<{
        id: string;
        title: string;
        status: MixStatus;
        renderStatus: RenderStatus;
        publishedVersionId: string | null;
        goal: string;
        scene: string;
        trackCount: number;
        eligibleTrackCount: number;
        blockedTrackCount: number;
        discoverEligible: boolean;
      }>;
    };
    supplyGapJobsByStatus: Record<string, number>;
    supplyGapCandidatesByStatus: Record<string, number>;
    openSupplyGaps: Array<{
      id: string;
      role: string;
      goal: string;
      scene: string;
      contentMode: string;
      phase: string;
      requestCount: number;
      estimatedReuseScore: number;
      status: string;
      updatedAt: string;
    }>;
    renderQa: {
      total: number;
      passed: number;
      failed: number;
    };
    voiceQaByDecision: Record<string, number>;
  };
  analytics: {
    playbackEventsByType: Record<string, number>;
    funnel: {
      quickCreateStarted: number;
      recipeReady: number;
      playbackStarted: number;
      playbackFailed: number;
      resultAccepted: number;
      workSaved: number;
      generationSuccessRate: number;
      saveRate: number;
      acceptanceRate: number;
    };
    preferenceSignals: Array<{
      kind: string;
      value: string;
      count: number;
    }>;
    generationQuotaSignals: {
      aiSessions: number;
      aiUsers: number;
    };
  };
  system: {
    releaseChannel: 'voice-free-beta';
    guidedVoiceEnabled: boolean;
    production: boolean;
    storageDriver: string;
    corsOriginCount: number;
    rateLimits: {
      generalPerMinute: number;
      quickCreatePerMinute: number;
      aiSessionsPerMinute: number;
      musicGenerationPerMinute: number;
    };
    providerStatus: {
      aiRecipe: unknown;
      lyriaConfigured: boolean;
      ttsConfigured: boolean;
    };
  };
};

export type AdminAssetList = {
  assets: AudioStem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type AdminUnifiedContentModel = {
  generatedAt: string;
  summary: {
    audioAssets: number;
    audioStems: number;
    orphanStems: number;
    annotations: number;
    contentItems: number;
    releaseEligibleContent: number;
    enabledPlacements: number;
    invalidPlacements: number;
  };
  relationships: string[];
  migration: {
    runtimeSource: string;
    governanceSource: string;
    compatibility: string;
  };
};

export type AdminImportInbox = {
  rootPath: string;
  folderPlan: string[];
  manifestTemplate: string;
  shelves: Array<{
    folder: string;
    total: number;
    ready: number;
    duplicate: number;
  }>;
  files: Array<{
    relativePath: string;
    sizeBytes: number;
    existingStemId: string | null;
    status: 'ready' | 'duplicate';
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
  summary: {
    total: number;
    ready: number;
    duplicate: number;
  };
};

export type AdminKnowledgeConcept = {
  id: string;
  parentId: string | null;
  dimension: string;
  name: string;
  description: string;
  synonyms: string[];
  active: boolean;
  childCount: number;
  verifiedAssetCount: number;
  candidateAssetCount: number;
};

export type AdminKnowledgeCatalog = {
  generatedAt: string;
  dimensions: Record<string, number>;
  concepts: AdminKnowledgeConcept[];
  selectedConcept: null | (AdminKnowledgeConcept & {
    children: AdminKnowledgeConcept[];
    linkedAssets: Array<{
      id: string;
      name: string;
      category: StemCategory;
      qaStatus: StemQaStatus;
      source: string;
      confidence: number;
      verified: boolean;
      releaseEligible: boolean;
      blockers: string[];
    }>;
  });
};

export type AdminDemandCoverage = {
  generatedAt: string;
  principles: string[];
  totals: {
    demandTypeCount: number;
    publishReadyCount: number;
    freeShortfall: number;
    paidShortfall: number;
    underfilledDemandTypes: number;
  };
  productionPlan: {
    batchId: string;
    generatedAt: string;
    policy: string;
    totals: {
      plannedItems: number;
      plannedUnits: number;
      materialUnits: number;
      finishedSoundscapeUnits: number;
      repairUnits: number;
    };
    items: Array<{
      id: string;
      demandTypeId: string;
      title: string;
      priority: 'p0_free_proof' | 'p1_paid_inventory' | 'p2_quality_repair';
      action: 'source_or_generate_material' | 'compose_reviewed_soundscape' | 'repair_existing_content';
      targetCount: number;
      reason: string;
      route: string;
      prompt: string;
      acceptanceCriteria: string[];
      requiredApprovals: string[];
      candidateSourceMixIds: string[];
      candidateMaterialIds: string[];
    }>;
  };
  coverage: Array<{
    demandType: {
      id: string;
      title: string;
      description: string;
      prompt: string;
      keywords: string[];
      goal: ProductGoal;
      scene: ProductScene;
      contentMode: 'pure_soundscape' | 'functional_music';
      freeTargetCount: number;
      paidTargetCount: number;
      variantTargetCount: number;
      acceptanceCriteria: string[];
      exclusions: string[];
    };
    summary: {
      publishReadyCount: number;
      sourceMaterialCount: number;
      demoOnlyCount: number;
      needsReworkCount: number;
      rejectedCount: number;
      freeTargetCount: number;
      paidTargetCount: number;
      freeShortfall: number;
      paidShortfall: number;
      readiness: 'paid_ready' | 'free_proven' | 'underfilled';
    };
    assignedMixes: Array<{
      id: string;
      title: string;
      state: 'publish_ready' | 'source_material' | 'demo_only' | 'needs_rework' | 'rejected';
      goal: string;
      scene: string;
      contentMode: string;
      trackCount: number;
      blockedTrackCount: number;
      categoryProfile: string;
      matchReason: 'intent_match' | 'keyword_match';
      contentModeMatch: boolean;
    }>;
    sourceMaterials: Array<{
      id: string;
      name: string;
      state: 'source_material';
      category: StemCategory;
    }>;
    gaps: string[];
    nextProductionRecommendation: string;
  }>;
};

export type AdminDemandProductionReview = {
  batchId: string;
  generatedAt: string;
  policy: string;
  summary: {
    total: number;
    machineReady: number;
    humanPassed: number;
    needsRework: number;
    rejected: number;
    releaseEligible: number;
    released: number;
  };
  items: Array<{
    mixId: string;
    title: string;
    description: string;
    status: MixStatus;
    renderStatus: RenderStatus;
    renderedAudioUrl: string;
    publishedVersionId: string | null;
    goal: string;
    scene: string;
    contentMode: string;
    durationSeconds: number;
    trackCount: number;
    approvalState: string;
    sourceMixId: string;
    materialStemId: string;
    planId: string;
    demandTypeId: string;
    releaseEligible: boolean;
    releaseBlockers: string[];
    releaseGovernance: null | {
      state: string;
      releasedAt: string;
      discoverBoundary: string;
    };
    machineQa: null | {
      durationSeconds: number;
      peakDb: number | null;
      integratedLufs: number | null;
      truePeakDb: number | null;
      abnormalSilenceCount: number;
      passed: boolean;
      createdAt: string;
    };
    humanReview: null | {
      decision: 'passed' | 'needs_rework' | 'rejected';
      notes: string;
      reviewedAt: string;
    };
  }>;
};

export type RecipeTrack = {
  stemId: string;
  volume: number;
  isMuted: boolean;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
  playbackRate?: number;
  sourceGainDb?: number;
  musicKitId?: string;
  musicKitVersion?: string;
  musicPart?: MusicKitStemRole;
  phaseIds?: string[];
  fade?: { inSeconds: number; outSeconds: number };
  loop?: { enabled: boolean; crossfadeSeconds: number };
  volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
};

export type MixRecipe = {
  schemaVersion?: 1 | 2;
  versionId?: string;
  versionState?: 'live' | 'frozen';
  randomSeed?: number;
  tracks: RecipeTrack[];
  durationSeconds: number;
  intent?: string;
  moodTags: string[];
  contentMode?: 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';
  audioIntent?: {
    schemaVersion: 2 | 3;
    goal: ProductGoal;
    scene: ProductScene;
    contentMode: 'pure_soundscape' | 'functional_music' | 'guided_meditation' | 'sound_journey';
    environmentPreferences: string[];
    excludedSounds: string[];
    intensity: { environment: number; music: number; voice: number };
    qualities: { warmth: number; spaciousness: number; variation: number };
    guidedVoice: { enabled: boolean; language: 'en' | 'zh'; density: 'light' | 'standard' | 'frequent' };
    sessionSubtype?: string;
    desiredOutcomes?: string[];
    currentState?: Record<string, string>;
    desiredTrajectory?: string;
    stimulationTolerance?: Record<string, string>;
    context?: Record<string, string>;
    narrativeArc?: Array<{ phase: string; change: string; relativeStart: number }>;
    confidence?: number;
    fieldConfidence?: Record<string, number>;
  };
  quickCreate?: {
    recipeId?: string;
    prompt?: string;
    guidedVoiceRequested?: boolean;
    guidedVoiceStatus?: 'queued_for_controlled_tts' | 'preview_ready' | 'off';
    languagePreference?: 'system' | 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi';
    resolvedLanguage?: 'zh' | 'en' | 'hi' | 'es' | 'ar' | 'bn' | 'pt' | 'ru' | 'ja' | 'id' | 'de' | 'fr' | 'ko' | 'it' | 'nl' | 'zh-Hant' | 'tr' | 'pl' | 'sv' | 'th' | 'vi' | 'ms' | 'he' | 'da' | 'no' | 'fi';
    soundProfileSnapshot?: {
      likedSounds: string[];
      excludedSounds: string[];
      defaultGoal: ProductGoal;
      defaultDurationSeconds: number;
    };
    internalBaselineMatch?: {
      seedId: string;
      title: string;
      goal: ProductGoal;
      scene: string;
      canonicalScene: ProductScene;
      matchedSignals: string[];
      matchReason: string;
      ownerListeningVerdict: 'save_and_replay_worthy';
    };
    supply?: {
      kind: GenerationDecisionKind;
      missing: Array<{ role: MissingStemRole; conceptIds: string[] }>;
      fullTrackProviderAllowed: false;
      reason: string;
      generationSpec: {
        role: MissingStemRole;
        targetConceptIds: string[];
        providerPolicy: 'local_musickit_factory_only' | 'approved_inventory_import_first_then_external_sfx_candidates';
        candidateCount: number;
        loopRequired: boolean;
      } | null;
    };
  };
  phases?: Array<{
    id: string;
    role: 'arrival' | 'core' | 'release';
    startTime: number;
    duration: number;
  }>;
  ducking?: Array<{
    triggerRole: 'voice';
    targetRoles: Array<'base' | 'environment' | 'music' | 'voice' | 'accent'>;
    reductionDb: number;
    attackSeconds: number;
    releaseSeconds: number;
  }>;
  events?: Array<{
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
    replacements?: Array<{
      fromStemId: string;
      fromName: string;
      toStemId: string;
      toName: string;
      reason: string;
      createdAt: string;
    }>;
    renders?: Array<{
      status: 'ready' | 'failed';
      renderedAudioUrl?: string;
      error?: string;
      createdAt: string;
    }>;
  };
  aiClassification?: {
    goal: string;
    environment: string;
    explanation: string;
    provider: 'deepseek' | 'openai' | 'rules';
    model: string | null;
  };
};

export type CatalogGoal = {
  id: ProductGoal;
  name: string;
  scenes: ProductScene[];
};

export type CatalogScene = {
  id: ProductScene;
  goal: ProductGoal;
  name: string;
  defaultDurationSeconds: number;
};

export type CatalogRecipe = {
  id: string;
  name: string;
  goal: ProductGoal;
  scene: ProductScene;
  durationSeconds: number;
  moodTags: string[];
  exportReady: boolean;
};

export type ExportCheck = {
  exportReady: boolean;
  audibleTrackCount: number;
  blockedStems: Array<{
    stemId: string;
    name: string;
    category: string;
    qaStatus: string;
    commercialUseAllowed: boolean;
    derivativeUseAllowed: boolean;
    reasons: string[];
    alternatives: Array<{
      id: string;
      name: string;
      category: string;
      audioUrl: string;
      defaultVolume: number;
      tags: string[];
      description: string;
    }>;
  }>;
};

export type Mix = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  coverImageUrl: string;
  status: MixStatus;
  recipeData: MixRecipe;
  renderStatus: RenderStatus;
  renderedAudioUrl: string;
  renderedAt: string | null;
  renderError: string;
  publishedVersionId: string | null;
  playsCount: number;
  likesCount: number;
  shareClicks: number;
  completion50Count: number;
  completion90Count: number;
  createdAt: string;
  updatedAt: string;
};

export type ShareLink = {
  id: string;
  slug: string;
  mixId: string;
  recipeVersionId: string;
  creatorId: string;
  intent: ShareIntent;
  visibility: ShareVisibility;
  title: string;
  description: string;
  coverImageUrl: string;
  creatorName: string;
  soundElements: string[];
  recipientLabel: string;
  recipientClaimed: boolean;
  personalMessage: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  creatorPreviewToken?: string;
};

export type AttributionCredit = {
  stemId: string;
  title: string;
  creator: string;
  sourcePlatform: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attributionText: string;
  adaptationNotice: string;
};

export type ShareEventType =
  | 'share_page_opened'
  | 'playback_requested'
  | 'playback_started'
  | 'meaningful_listen'
  | 'favorite_added'
  | 'create_from_share_started'
  | 'gift_response_sent'
  | 'reshared';

export type UserHistory = {
  id: string;
  userId: string;
  mixId: string;
  playedAt: string;
  durationListened: number;
};

export type AiSession = {
  id: string;
  userId: string;
  prompt: string;
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  generatedMixId: string;
  createdAt: string;
};

export type WorkAnalyticsSummary = {
  pageViews: number;
  playStarts: number;
  play50: number;
  play90: number;
  favorites: number;
  shareClicks: number;
  curation: {
    requiredPlays: number;
    requiredFavorites: number;
    requiredCompletionRate: number;
    missingPlays: number;
    missingFavorites: number;
    completionRate: number;
    eligible: boolean;
  };
};

export type AppDatabase = {
  users: User[];
  audioStems: AudioStem[];
  mixes: Mix[];
  userHistory: UserHistory[];
  aiSessions: AiSession[];
};
