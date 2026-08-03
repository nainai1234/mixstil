export type DemandContentState = 'publish_ready' | 'source_material' | 'demo_only' | 'needs_rework' | 'rejected';
export type DemandProductionAction = 'source_or_generate_material' | 'compose_reviewed_soundscape' | 'repair_existing_content';
export type DemandProductionPriority = 'p0_free_proof' | 'p1_paid_inventory' | 'p2_quality_repair';

export type DemandType = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  keywords: string[];
  goal: 'sleep' | 'calm' | 'focus';
  scene: 'bedtime' | 'return_to_sleep' | 'breathing' | 'emotional_settling' | 'deep_focus';
  contentMode: 'pure_soundscape' | 'functional_music';
  freeTargetCount: number;
  paidTargetCount: number;
  variantTargetCount: number;
  acceptanceCriteria: string[];
  exclusions: string[];
};

type DiscoverConfig = {
  quickActions: Array<{ label: string; prompt: string }>;
  sections: Array<{
    id: string;
    enabled: boolean;
    title: string;
    description: string;
    prompt: string;
    keywords: string[];
  }>;
};

export type DemandCoverageMixRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  render_status: string;
  published_version_id: string | null;
  goal: string;
  scene: string;
  content_mode: string;
  track_count: number;
  eligible_track_count: number;
  blocked_track_count: number;
  track_categories: string[];
};

export type DemandCoverageStemRow = {
  id: string;
  name: string;
  category: string;
  qa_status: string;
  tags: string[];
  description: string | null;
  file_sha256: string;
  commercial_use_allowed: boolean;
  derivative_use_allowed: boolean;
};

const demandDefaults: Record<string, Partial<DemandType>> = {
  'sleep-ready': {
    goal: 'sleep',
    scene: 'bedtime',
    contentMode: 'pure_soundscape',
    freeTargetCount: 3,
    paidTargetCount: 15,
    exclusions: ['voice', 'sharp_events', 'obvious_loop', 'bright_melody'],
  },
  'return-to-sleep': {
    goal: 'sleep',
    scene: 'return_to_sleep',
    contentMode: 'pure_soundscape',
    freeTargetCount: 3,
    paidTargetCount: 12,
    exclusions: ['voice', 'long_intro', 'attention_grabbing_detail', 'bright_melody'],
  },
  'light-music': {
    goal: 'calm',
    scene: 'emotional_settling',
    contentMode: 'functional_music',
    freeTargetCount: 2,
    paidTargetCount: 12,
    exclusions: ['voice', 'strong_melody', 'dramatic_change', 'song_structure'],
  },
  'noise-masking': {
    goal: 'focus',
    scene: 'deep_focus',
    contentMode: 'pure_soundscape',
    freeTargetCount: 3,
    paidTargetCount: 12,
    exclusions: ['voice', 'foreground_events', 'thin_high_noise'],
  },
  'quiet-nature': {
    goal: 'sleep',
    scene: 'bedtime',
    contentMode: 'pure_soundscape',
    freeTargetCount: 3,
    paidTargetCount: 12,
    exclusions: ['voice', 'birds', 'insects', 'sharp_water', 'sudden_events'],
  },
  'asmr-texture': {
    goal: 'calm',
    scene: 'emotional_settling',
    contentMode: 'pure_soundscape',
    freeTargetCount: 2,
    paidTargetCount: 10,
    exclusions: ['voice', 'mouth_sounds', 'startle_events', 'harsh_transients'],
  },
  'calm-reset': {
    goal: 'calm',
    scene: 'emotional_settling',
    contentMode: 'pure_soundscape',
    freeTargetCount: 3,
    paidTargetCount: 12,
    exclusions: ['voice', 'abrupt_ending', 'busy_foreground'],
  },
  focus: {
    goal: 'focus',
    scene: 'deep_focus',
    contentMode: 'pure_soundscape',
    freeTargetCount: 3,
    paidTargetCount: 15,
    exclusions: ['voice', 'sharp_events', 'sleepy_heavy_swell', 'lead_melody'],
  },
  minimal: {
    goal: 'sleep',
    scene: 'bedtime',
    contentMode: 'pure_soundscape',
    freeTargetCount: 2,
    paidTargetCount: 10,
    exclusions: ['voice', 'foreground_events', 'melody', 'texture_spikes'],
  },
  exclusions: {
    goal: 'sleep',
    scene: 'bedtime',
    contentMode: 'pure_soundscape',
    freeTargetCount: 2,
    paidTargetCount: 10,
    exclusions: ['voice', 'birds', 'melody', 'bright_events', 'complexity'],
  },
};

const defaultAcceptanceCriteria = [
  'Voice-free Beta: no audible Voice stems.',
  'No sudden foreground events, obvious loop clicks, or harsh high-frequency spikes.',
  'At least three perceptually distinct release-ready starters before the demand is treated as proven.',
  'Plus inventory must include stable variants, not near-duplicates of the same noise texture.',
];

export const buildDemandTypesFromDiscoverConfig = (config: DiscoverConfig): DemandType[] => {
  const quickActionText = config.quickActions.map((action) => `${action.label} ${action.prompt}`).join(' ');
  return config.sections.filter((section) => section.enabled).map((section) => {
    const defaults = demandDefaults[section.id] ?? {};
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      prompt: section.prompt,
      keywords: Array.from(new Set([...section.keywords, ...section.title.split(/\s+/).filter(Boolean)])),
      goal: defaults.goal ?? 'sleep',
      scene: defaults.scene ?? 'bedtime',
      contentMode: defaults.contentMode ?? 'pure_soundscape',
      freeTargetCount: defaults.freeTargetCount ?? 2,
      paidTargetCount: defaults.paidTargetCount ?? 10,
      variantTargetCount: defaults.variantTargetCount ?? 4,
      acceptanceCriteria: defaultAcceptanceCriteria,
      exclusions: Array.from(new Set([...(defaults.exclusions ?? []), ...(quickActionText.includes('不要人声') ? ['voice'] : [])])),
    };
  });
};

const textOf = (...values: Array<unknown>) => values.flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).join(' ').toLowerCase();

const matchesDemand = (demand: DemandType, text: string) => {
  const lower = text.toLowerCase();
  return demand.keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
    || lower.includes(demand.id.toLowerCase())
    || lower.includes(demand.goal)
    || lower.includes(demand.scene);
};

const classifyMix = (row: DemandCoverageMixRow): DemandContentState => {
  if (row.status === 'published' && row.render_status === 'ready' && row.published_version_id && Number(row.blocked_track_count) === 0 && Number(row.track_count) > 0) return 'publish_ready';
  if (row.status === 'published' || row.render_status === 'ready') return 'demo_only';
  if (row.status === 'private' || row.status === 'draft' || row.render_status === 'rendering' || row.render_status === 'not_rendered' || Number(row.blocked_track_count) > 0) return 'needs_rework';
  return 'rejected';
};

const stemReleaseEligible = (row: DemandCoverageStemRow) => (
  row.qa_status === 'approved'
  && row.file_sha256 !== ''
  && row.commercial_use_allowed
  && row.derivative_use_allowed
  && row.category !== 'Voice'
);

const categoryNotes = (categories: string[]) => {
  const unique = Array.from(new Set(categories.filter(Boolean)));
  if (unique.length === 0) return '无可识别声部';
  return unique.join(' + ');
};

const productionRouteFor = (action: DemandProductionAction) => {
  if (action === 'source_or_generate_material') return '素材库入库 -> 授权/机器 QA/人工听感 -> 语义标注';
  if (action === 'repair_existing_content') return '内容生产/审核 -> 返工 Recipe 或替换阻塞素材 -> 重新渲染';
  return '内容生产/审核 -> Recipe V2 成品声景 -> 渲染 QA -> 发现页候选';
};

const productionApprovalsFor = (action: DemandProductionAction) => {
  if (action === 'source_or_generate_material') return ['商用/二创授权确认', 'SHA-256 文件指纹', '非 Voice', '机器 QA', '人工听感 QA', '知识库概念标注'];
  if (action === 'repair_existing_content') return ['阻塞素材替换', 'Recipe V2 等价性', '重新渲染', '人工听感 QA', '发现页发布门槛'];
  return ['只使用可调用素材', 'Recipe V2 冻结版本', '渲染 ready', '人工听感 QA', '发布后才能进入发现页配置'];
};

const buildProductionPlan = (coverage: Array<{
  demandType: DemandType;
  summary: {
    publishReadyCount: number;
    sourceMaterialCount: number;
    needsReworkCount: number;
    freeShortfall: number;
    paidShortfall: number;
  };
  assignedMixes: Array<{
    id: string;
    title: string;
    state: DemandContentState;
  }>;
  sourceMaterials: Array<{
    id: string;
    name: string;
    state: 'source_material';
    category: string;
  }>;
  gaps: string[];
}>) => {
  const items = coverage.flatMap((item) => {
    const planned: Array<{
      id: string;
      demandTypeId: string;
      title: string;
      priority: DemandProductionPriority;
      action: DemandProductionAction;
      targetCount: number;
      reason: string;
      route: string;
      prompt: string;
      acceptanceCriteria: string[];
      requiredApprovals: string[];
      candidateSourceMixIds: string[];
      candidateMaterialIds: string[];
    }> = [];
    if (item.summary.sourceMaterialCount === 0) {
      const action: DemandProductionAction = 'source_or_generate_material';
      planned.push({
        id: `plan_${item.demandType.id}_materials`,
        demandTypeId: item.demandType.id,
        title: `${item.demandType.title}：补素材库`,
        priority: 'p0_free_proof',
        action,
        targetCount: Math.max(2, Math.min(4, item.summary.freeShortfall || 2)),
        reason: '没有可调用素材时，不能直接生成成品上架；先补可审核、可复用的基础素材。',
        route: productionRouteFor(action),
        prompt: item.demandType.prompt,
        acceptanceCriteria: item.demandType.acceptanceCriteria,
        requiredApprovals: productionApprovalsFor(action),
        candidateSourceMixIds: item.assignedMixes.filter((mix) => mix.state === 'demo_only' || mix.state === 'needs_rework').map((mix) => mix.id).slice(0, 4),
        candidateMaterialIds: [],
      });
    }
    if (item.summary.freeShortfall > 0) {
      const action: DemandProductionAction = 'compose_reviewed_soundscape';
      planned.push({
        id: `plan_${item.demandType.id}_free`,
        demandTypeId: item.demandType.id,
        title: `${item.demandType.title}：补免费验证成品`,
        priority: 'p0_free_proof',
        action,
        targetCount: item.summary.freeShortfall,
        reason: '每个核心需求至少要有可直接试听的高质量 starter，才能证明用户愿意继续使用。',
        route: productionRouteFor(action),
        prompt: item.demandType.prompt,
        acceptanceCriteria: item.demandType.acceptanceCriteria,
        requiredApprovals: productionApprovalsFor(action),
        candidateSourceMixIds: item.assignedMixes.filter((mix) => mix.state === 'demo_only' || mix.state === 'needs_rework').map((mix) => mix.id).slice(0, 4),
        candidateMaterialIds: item.sourceMaterials.map((material) => material.id).slice(0, 6),
      });
    } else if (item.summary.paidShortfall > 0) {
      const action: DemandProductionAction = 'compose_reviewed_soundscape';
      planned.push({
        id: `plan_${item.demandType.id}_plus`,
        demandTypeId: item.demandType.id,
        title: `${item.demandType.title}：补 Plus 稳定变体`,
        priority: 'p1_paid_inventory',
        action,
        targetCount: Math.min(item.demandType.variantTargetCount, item.summary.paidShortfall),
        reason: '免费验证已够，但付费用户需要足够多的稳定变体，避免每天听到近似同一条声音。',
        route: productionRouteFor(action),
        prompt: item.demandType.prompt,
        acceptanceCriteria: item.demandType.acceptanceCriteria,
        requiredApprovals: productionApprovalsFor(action),
        candidateSourceMixIds: item.assignedMixes.filter((mix) => mix.state === 'publish_ready').map((mix) => mix.id).slice(0, 4),
        candidateMaterialIds: item.sourceMaterials.map((material) => material.id).slice(0, 6),
      });
    }
    if (item.summary.needsReworkCount > 0) {
      const action: DemandProductionAction = 'repair_existing_content';
      planned.push({
        id: `plan_${item.demandType.id}_repair`,
        demandTypeId: item.demandType.id,
        title: `${item.demandType.title}：返工已生成内容`,
        priority: 'p2_quality_repair',
        action,
        targetCount: Math.min(3, item.summary.needsReworkCount),
        reason: '已生成内容优先归档和返工，避免重复生成相同需求导致库存虚胖。',
        route: productionRouteFor(action),
        prompt: item.demandType.prompt,
        acceptanceCriteria: item.demandType.acceptanceCriteria,
        requiredApprovals: productionApprovalsFor(action),
        candidateSourceMixIds: item.assignedMixes.filter((mix) => mix.state === 'needs_rework' || mix.state === 'demo_only').map((mix) => mix.id).slice(0, 6),
        candidateMaterialIds: item.sourceMaterials.map((material) => material.id).slice(0, 4),
      });
    }
    return planned;
  }).sort((left, right) => {
    const priorityOrder: Record<DemandProductionPriority, number> = { p0_free_proof: 0, p1_paid_inventory: 1, p2_quality_repair: 2 };
    return priorityOrder[left.priority] - priorityOrder[right.priority] || right.targetCount - left.targetCount;
  });

  return {
    batchId: `demand-production-${new Date().toISOString().slice(0, 10)}`,
    generatedAt: new Date().toISOString(),
    policy: 'Plan only. Audio generation candidates must enter asset library or content review before any Discover placement.',
    totals: {
      plannedItems: items.length,
      plannedUnits: items.reduce((sum, item) => sum + item.targetCount, 0),
      materialUnits: items.filter((item) => item.action === 'source_or_generate_material').reduce((sum, item) => sum + item.targetCount, 0),
      finishedSoundscapeUnits: items.filter((item) => item.action === 'compose_reviewed_soundscape').reduce((sum, item) => sum + item.targetCount, 0),
      repairUnits: items.filter((item) => item.action === 'repair_existing_content').reduce((sum, item) => sum + item.targetCount, 0),
    },
    items,
  };
};

export const buildDemandCoverage = (
  config: DiscoverConfig,
  mixes: DemandCoverageMixRow[],
  stems: DemandCoverageStemRow[],
) => {
  const demandTypes = buildDemandTypesFromDiscoverConfig(config);
  const coverage = demandTypes.map((demand) => {
    const assignedMixes = mixes
      .map((mix) => {
        const haystack = textOf(mix.id, mix.title, mix.description, mix.goal, mix.scene, mix.content_mode, mix.track_categories);
        const directIntentMatch = mix.goal === demand.goal && mix.scene === demand.scene;
        const contentModeMatch = demand.contentMode === 'functional_music'
          ? mix.content_mode === 'functional_music' || mix.track_categories.includes('Music')
          : mix.content_mode !== 'functional_music';
        if (!directIntentMatch && !matchesDemand(demand, haystack)) return null;
        const state = classifyMix(mix);
        return {
          id: mix.id,
          title: mix.title,
          state,
          goal: mix.goal,
          scene: mix.scene,
          contentMode: mix.content_mode,
          trackCount: Number(mix.track_count ?? 0),
          blockedTrackCount: Number(mix.blocked_track_count ?? 0),
          categoryProfile: categoryNotes(mix.track_categories),
          matchReason: directIntentMatch ? 'intent_match' : 'keyword_match',
          contentModeMatch,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => {
        const stateOrder = { publish_ready: 0, source_material: 1, demo_only: 2, needs_rework: 3, rejected: 4 };
        return stateOrder[left.state] - stateOrder[right.state] || Number(right.contentModeMatch) - Number(left.contentModeMatch);
      })
      .slice(0, 12);

    const sourceMaterials = stems
      .filter((stem) => stemReleaseEligible(stem))
      .filter((stem) => matchesDemand(demand, textOf(stem.id, stem.name, stem.category, stem.tags, stem.description)))
      .map((stem) => ({
        id: stem.id,
        name: stem.name,
        state: 'source_material' as const,
        category: stem.category,
      }))
      .slice(0, 8);

    const publishReadyCount = assignedMixes.filter((item) => item.state === 'publish_ready').length;
    const musicReadyCount = assignedMixes.filter((item) => item.state === 'publish_ready' && item.categoryProfile.includes('Music')).length;
    const natureReadyCount = assignedMixes.filter((item) => item.state === 'publish_ready' && item.categoryProfile.includes('Nature')).length;
    const noiseReadyCount = assignedMixes.filter((item) => item.state === 'publish_ready' && item.categoryProfile.includes('Noise')).length;
    const freeShortfall = Math.max(0, demand.freeTargetCount - publishReadyCount);
    const paidShortfall = Math.max(0, demand.paidTargetCount - publishReadyCount);
    const duplicateNoiseRisk = noiseReadyCount > 0 && musicReadyCount === 0 && natureReadyCount === 0 && publishReadyCount < demand.freeTargetCount;

    const gaps = [
      ...(freeShortfall > 0 ? [`免费证明还差 ${freeShortfall} 条可发布成品`] : []),
      ...(paidShortfall > 0 ? [`Plus 付费库存还差 ${paidShortfall} 条经过审核的稳定变体`] : []),
      ...(duplicateNoiseRisk ? ['当前容易变成单一噪声供给，需要补自然层、音乐层或结构差异'] : []),
      ...(sourceMaterials.length === 0 ? ['素材库中缺少可直接调用的匹配素材'] : []),
    ];

    return {
      demandType: demand,
      summary: {
        publishReadyCount,
        sourceMaterialCount: sourceMaterials.length,
        demoOnlyCount: assignedMixes.filter((item) => item.state === 'demo_only').length,
        needsReworkCount: assignedMixes.filter((item) => item.state === 'needs_rework').length,
        rejectedCount: assignedMixes.filter((item) => item.state === 'rejected').length,
        freeTargetCount: demand.freeTargetCount,
        paidTargetCount: demand.paidTargetCount,
        freeShortfall,
        paidShortfall,
        readiness: publishReadyCount >= demand.paidTargetCount ? 'paid_ready' : publishReadyCount >= demand.freeTargetCount ? 'free_proven' : 'underfilled',
      },
      assignedMixes,
      sourceMaterials,
      gaps,
      nextProductionRecommendation: gaps.length === 0
        ? '维持复听与接受率观察，优先做用户偏好变体。'
        : `先补 ${demand.contentMode === 'functional_music' ? '功能音乐' : '无人声声景'}：${gaps[0]}。候选进入素材库/内容审核，不直接上架发现页。`,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    principles: [
      '先归类现有库存，再决定生成。',
      '已生成不等于可售；只有发布、渲染、素材合规、可复播才算可发布覆盖。',
      '每个核心需求先满足免费证明，再扩展到 Plus 付费库存。',
      '新增生成只补缺口，并进入素材库和内容审核链路。',
    ],
    totals: {
      demandTypeCount: coverage.length,
      publishReadyCount: coverage.reduce((sum, item) => sum + item.summary.publishReadyCount, 0),
      freeShortfall: coverage.reduce((sum, item) => sum + item.summary.freeShortfall, 0),
      paidShortfall: coverage.reduce((sum, item) => sum + item.summary.paidShortfall, 0),
      underfilledDemandTypes: coverage.filter((item) => item.summary.readiness === 'underfilled').length,
    },
    coverage,
    productionPlan: buildProductionPlan(coverage),
  };
};
