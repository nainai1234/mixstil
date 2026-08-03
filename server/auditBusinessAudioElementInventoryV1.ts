import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Target = number | { min?: number; max?: number; [key: string]: number | undefined };

type BusinessContract = {
  schemaVersion: string;
  planId: string;
  elementFamilies: Array<{ id: string; internalTarget: Target }>;
  milestoneTargets: {
    internalAudibleBaseline: { finishedContent: number; foundationalElements: { min: number; max: number } };
  };
  immediateCorrectionFromRecentQa: {
    rejectedBatch: string;
    ownerFeedback: string;
    businessInterpretation: string;
  };
};

type InventoryRow = {
  familyId: string;
  internalTarget: Target;
  configured: number | Record<string, number>;
  candidate: number | Record<string, number>;
  machinePassed: number | Record<string, number>;
  humanPassed: number | Record<string, number>;
  formalUsable: number | Record<string, number>;
  rejectedOrBlocked: number | Record<string, number>;
  gapToInternalUsable: number | Record<string, number>;
  status: 'blocked' | 'gap' | 'candidate_ready_for_review' | 'configured_not_integrated' | 'meets_internal_gate';
  nextAction: string;
  evidence: string[];
};

const root = process.cwd();

const readJson = async <T>(relativePath: string): Promise<T> => {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as T;
};

const readOptionalJson = async <T>(relativePath: string): Promise<T | null> => {
  try {
    return await readJson<T>(relativePath);
  } catch {
    return null;
  }
};

const countBy = <T>(items: T[], predicate: (item: T) => boolean): number => items.filter(predicate).length;

const targetMin = (target: Target): number => {
  if (typeof target === 'number') return target;
  if (typeof target.min === 'number') return target.min;
  return Object.values(target).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
};

const numericGap = (target: Target, usable: number): number => Math.max(0, targetMin(target) - usable);

const objectGap = (target: Record<string, number>, usable: Record<string, number>): Record<string, number> => {
  return Object.fromEntries(Object.entries(target).map(([key, value]) => [key, Math.max(0, value - (usable[key] ?? 0))]));
};

const formatTarget = (target: Target): string => {
  if (typeof target === 'number') return `${target}`;
  if (typeof target.min === 'number' && typeof target.max === 'number') return `${target.min}-${target.max}`;
  return Object.entries(target)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
};

const formatCount = (value: number | Record<string, number>): string => {
  if (typeof value === 'number') return `${value}`;
  return Object.entries(value)
    .map(([key, count]) => `${key}: ${count}`)
    .join(', ');
};

const business = await readJson<BusinessContract>('config/business-required-audio-elements-v1.json');
const familyTarget = new Map(business.elementFamilies.map((family) => [family.id, family.internalTarget]));
const targetFor = (familyId: string): Target => {
  const target = familyTarget.get(familyId);
  if (!target) throw new Error(`Missing target for family ${familyId}`);
  return target;
};

const instrumentRegistry = await readJson<{
  sources: Array<{ id: string; status: string; runtimeLoader: string; license?: { name: string } }>;
}>('config/instrument-source-registry-v1.json');

const compositionLibrary = await readJson<{
  harmonyPool: unknown[];
  motifPool: unknown[];
  formPool: unknown[];
  grammarPool: unknown[];
  compositionPlans: unknown[];
}>('config/composition-material-library-v1.json');

const nonMusicRegistry = await readJson<{
  targetsFilledByRegistry: Record<string, number>;
  lyriaCandidateFamilies: Array<{ id: string; countAs: string; expectedVariants: number; includedVariants?: number[]; status: string; humanGate: string }>;
  deterministicEnvironmentConfigs: unknown[];
  deterministicAccentConfigs: unknown[];
}>('config/formal-foundational-non-music-elements-v1.json');

const dspRegistry = await readJson<{ productionAllowed: boolean; configs: Array<{ id: string; type: string }> }>(
  'config/deterministic-acoustic-configs-v1.json',
);

const soothingRetry = await readJson<{
  productionAllowed: boolean;
  survivors: Array<{ candidateId: string; category: string; role: string }>;
}>('config/lyria-foundational-soothing-retry-v1-survivors.json');

const deterministicFoundation = await readJson<{
  productionAllowed: boolean;
  candidateCount: number;
  machinePassCount: number;
  candidates: Array<{ candidateId: string; category: string; role: string; machineStatus: string; productionAllowed: boolean }>;
}>('public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json');

const rejectedCombination = await readJson<{
  candidateCount: number;
  machinePassCount: number;
  productionAllowed: boolean;
}>('public/audio/music/local-review/soothing-deterministic-combination-v1/manifest.json');

await readJson<{
  candidateCount: number;
  machinePassCount: number;
  productionAllowed: boolean;
}>('public/audio/music/local-review/soothing-harmonic-no-road-combination-v2/manifest.json');

const lyriaExpansion = await readJson<{
  productionAllowed: boolean;
  completedCandidateCount: number;
  candidates: Array<{ id: string; category: string; role: string; productionAllowed: boolean; preparedAnalysis?: { technicalStatus?: string; humanIdentityStatus?: string; humanVoiceStatus?: string } }>;
}>('public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json');

const finishedRelease = await readJson<{ status: string; count: number; byGoal: Record<string, number>; items: unknown[] }>(
  'reports/content-baseline-30-longform-release.json',
);

const instrumentRuntimeProof = await readOptionalJson<{
  productionAllowed: boolean;
  renderedCandidateCount: number;
  machinePassCount: number;
  sourceResults: Array<{ sourceId: string; runtimeProofStatus: string; renderedCandidateCount: number }>;
  renderedCandidates: Array<{ machineStatus: string; productionAllowed: boolean }>;
  blockedSources: Array<{ sourceId: string; status: string }>;
}>('public/audio/music/local-review/instrument-runtime-render-proof-v1/manifest.json');

const instrumentCompositionExpansion = await readOptionalJson<{
  productionAllowed: boolean;
  candidateCount: number;
  machinePassCount: number;
  humanPassCount: number;
  formalUsableCount: number;
  byGoal: Record<string, number>;
  byInstrumentSource: Record<string, number>;
}>('public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json');

const atomicFoundationElements = await readOptionalJson<{
  batchId: string;
  status: string;
  productionAllowed: boolean;
  formalUsableCount: number;
  humanPassCount: number;
  counts: {
    audioElements: number;
    symbolicElements: number;
    totalElements: number;
    singleNotes: number;
    harmonyCells: number;
    shortMotifs: number;
    bassSupport: number;
  };
  audioElements: Array<{ elementType: string; machineStatus: string; productionAllowed: boolean }>;
  symbolicElements: Array<{ elementType: string; productionAllowed: boolean }>;
}>('public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json');

const lyriaTechnicalPass = countBy(
  lyriaExpansion.candidates,
  (candidate) => candidate.preparedAnalysis?.technicalStatus === 'pass',
);
const lyriaHumanPassed = countBy(
  lyriaExpansion.candidates,
  (candidate) => candidate.preparedAnalysis?.humanIdentityStatus === 'pass' && candidate.preparedAnalysis?.humanVoiceStatus === 'pass',
);
const lyriaMusicCandidates = lyriaExpansion.candidates.filter(
  (candidate) =>
    (candidate.category === 'instrument' && candidate.role !== 'rhythmic_phrase') ||
    candidate.role === 'harmonic_texture' ||
    candidate.role === 'tonal_texture',
);
const lyriaEnvironmentCandidates = lyriaExpansion.candidates.filter(
  (candidate) => candidate.category === 'environment' && candidate.role === 'environment_bed',
);
const lyriaMaskingCandidates = lyriaExpansion.candidates.filter(
  (candidate) => candidate.category === 'environment' && candidate.role === 'masking_bed',
);
const lyriaTextureCandidates = lyriaExpansion.candidates.filter((candidate) => candidate.category === 'texture');
const lyriaAccentCandidates = lyriaExpansion.candidates.filter((candidate) => candidate.category === 'accent');

const deterministicByRole = (role: string) =>
  deterministicFoundation.candidates.filter((candidate) => candidate.role === role || candidate.category === role);
const deterministicMachineByRole = (role: string) =>
  deterministicByRole(role).filter((candidate) => candidate.machineStatus === 'pass');

const structuredTarget = targetFor('structured_composition_material') as Record<string, number>;
const structuredConfigured = {
  harmonyTemplates: compositionLibrary.harmonyPool.length,
  motifs: compositionLibrary.motifPool.length,
  forms: compositionLibrary.formPool.length,
  arrangementGrammars: compositionLibrary.grammarPool.length,
};

const preciseDspFormalUsable = dspRegistry.configs.length;
const dspNoiseConfigCount = dspRegistry.configs.filter((config) => config.type === 'noise').length;
const runtimeRenderedSourceCount =
  instrumentRuntimeProof?.sourceResults.filter((source) => source.runtimeProofStatus === 'machine_passed_candidate').length ?? 0;
const runtimeBlockedSourceCount =
  instrumentRuntimeProof?.sourceResults.filter((source) => source.runtimeProofStatus === 'runtime_loader_blocked').length ?? 0;
const runtimeRenderedCandidateCount = instrumentRuntimeProof?.renderedCandidateCount ?? 0;
const runtimeMachinePassCount = instrumentRuntimeProof?.machinePassCount ?? 0;
const expansionCandidateCount = instrumentCompositionExpansion?.candidateCount ?? 0;
const expansionMachinePassCount = instrumentCompositionExpansion?.machinePassCount ?? 0;
const atomicAudioElementCount = atomicFoundationElements?.counts.audioElements ?? 0;
const atomicSymbolicElementCount = atomicFoundationElements?.counts.symbolicElements ?? 0;
const atomicAudioMachinePassCount =
  atomicFoundationElements?.audioElements.filter((element) => element.machineStatus === 'pass').length ?? 0;
const atomicAudioReviewRequiredCount =
  atomicFoundationElements?.audioElements.filter((element) => element.machineStatus === 'review_required').length ?? 0;
const rows: InventoryRow[] = [
  {
    familyId: 'playable_instrument_sources',
    internalTarget: targetFor('playable_instrument_sources'),
    configured: instrumentRegistry.sources.length,
    candidate: countBy(instrumentRegistry.sources, (source) => source.status === 'formal_candidate'),
    machinePassed: runtimeRenderedSourceCount,
    humanPassed: 0,
    formalUsable: 0,
    rejectedOrBlocked: runtimeBlockedSourceCount,
    gapToInternalUsable: numericGap(targetFor('playable_instrument_sources'), 0),
    status: runtimeRenderedSourceCount > 0 ? 'candidate_ready_for_review' : 'configured_not_integrated',
    nextAction: runtimeRenderedSourceCount > 0
      ? '已完成部分 runtime proof：4 个本地多采样乐器源机器通过，2 个 SoundFont 源因缺少 loader blocked。下一步做人听身份/舒缓度，并补 SoundFont loader 或替换木管多采样。'
      : '优先做 6 个乐器源的 runtime render smoke test：用同一组和声/动机实际渲染钢琴、Rhodes、吉他、低音、木管，并记录可用音域、增益和听感。',
    evidence: ['config/instrument-source-registry-v1.json', 'public/audio/music/local-review/instrument-runtime-render-proof-v1/manifest.json'],
  },
  {
    familyId: 'structured_composition_material',
    internalTarget: structuredTarget,
    configured: {
      ...structuredConfigured,
      atomicReviewPageSymbolicElements: atomicSymbolicElementCount,
    },
    candidate: {
      ...structuredConfigured,
      atomicReviewPageSymbolicElements: atomicSymbolicElementCount,
    },
    machinePassed: {
      ...structuredConfigured,
      atomicReviewPageSymbolicElements: atomicSymbolicElementCount,
    },
    humanPassed: { harmonyTemplates: 0, motifs: 0, forms: 0, arrangementGrammars: 0 },
    formalUsable: structuredConfigured,
    rejectedOrBlocked: { harmonyTemplates: 0, motifs: 0, forms: 0, arrangementGrammars: 0 },
    gapToInternalUsable: objectGap(structuredTarget, structuredConfigured),
    status: 'meets_internal_gate',
    nextAction: '不要再扩大符号素材；下一步要把已列出的原子音频元素和符号规则接入 composer/router，证明“用户需求 -> 元素选择 -> 可听结果”成立。',
    evidence: ['config/composition-material-library-v1.json', 'public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json'],
  },
  {
    familyId: 'music_beds_and_phrases',
    internalTarget: targetFor('music_beds_and_phrases'),
    configured: {
      mixedLyriaAndCompositionCandidates: lyriaMusicCandidates.length + runtimeRenderedCandidateCount + expansionCandidateCount,
      trueAtomicAudioElements: atomicAudioElementCount,
    },
    candidate: {
      mixedLyriaAndCompositionCandidates: lyriaMusicCandidates.length + runtimeRenderedCandidateCount + expansionCandidateCount,
      trueAtomicAudioElements: atomicAudioElementCount,
    },
    machinePassed: {
      mixedLyriaAndCompositionCandidates:
        lyriaMusicCandidates.filter((candidate) => candidate.preparedAnalysis?.technicalStatus === 'pass').length +
        runtimeMachinePassCount +
        expansionMachinePassCount,
      trueAtomicAudioElements: atomicAudioMachinePassCount,
      trueAtomicReviewRequired: atomicAudioReviewRequiredCount,
    },
    humanPassed: 0,
    formalUsable: 0,
    rejectedOrBlocked: 0,
    gapToInternalUsable: numericGap(targetFor('music_beds_and_phrases'), 0),
    status: 'candidate_ready_for_review',
    nextAction: '把 trueAtomicAudioElements 当作下一步验收对象；mixedLyriaAndCompositionCandidates 只能保留为参考/能力证明，不能冒充基础元素。',
    evidence: [
      'public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json',
      'public/audio/music/local-review/instrument-runtime-render-proof-v1/manifest.json',
      'public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json',
      'public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json',
    ],
  },
  {
    familyId: 'environment_identity_beds',
    internalTarget: targetFor('environment_identity_beds'),
    configured: nonMusicRegistry.targetsFilledByRegistry.environment_bed + deterministicByRole('environment_bed').length,
    candidate: lyriaEnvironmentCandidates.length + deterministicByRole('environment_bed').length,
    machinePassed: lyriaEnvironmentCandidates.filter((candidate) => candidate.preparedAnalysis?.technicalStatus === 'pass').length + deterministicMachineByRole('environment_bed').length,
    humanPassed: 0,
    formalUsable: 0,
    rejectedOrBlocked: rejectedCombination.candidateCount,
    gapToInternalUsable: numericGap(targetFor('environment_identity_beds'), 0),
    status: 'blocked',
    nextAction: '环境层不能再默认用连续宽频噪声。先按业务场景定义“房间、风、雨、夜、远水、机械掩蔽”等身份，再逐个做人听疲劳/道路感排除。',
    evidence: [
      'config/formal-foundational-non-music-elements-v1.json',
      'public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json',
      'reports/soothing-deterministic-combination-v1-owner-rejection.md',
    ],
  },
  {
    familyId: 'masking_and_noise_support',
    internalTarget: targetFor('masking_and_noise_support'),
    configured: dspNoiseConfigCount + lyriaMaskingCandidates.length,
    candidate: dspNoiseConfigCount + lyriaMaskingCandidates.length,
    machinePassed: dspNoiseConfigCount + lyriaMaskingCandidates.filter((candidate) => candidate.preparedAnalysis?.technicalStatus === 'pass').length,
    humanPassed: 0,
    formalUsable: dspNoiseConfigCount,
    rejectedOrBlocked: rejectedCombination.candidateCount,
    gapToInternalUsable: numericGap(targetFor('masking_and_noise_support'), dspNoiseConfigCount),
    status: numericGap(targetFor('masking_and_noise_support'), dspNoiseConfigCount) === 0 ? 'meets_internal_gate' : 'gap',
    nextAction: numericGap(targetFor('masking_and_noise_support'), dspNoiseConfigCount) === 0
      ? '掩蔽/噪声支撑配置数量达标；下一步只允许作为低音量支撑层进入 Recipe，不能成为默认主声音，否则会再次变成“高速公路”。'
      : '补 2 个可控掩蔽配置即可；但它们必须是支撑层，不能成为默认主声音，否则会再次变成“高速公路”。',
    evidence: ['config/deterministic-acoustic-configs-v1.json', 'public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json'],
  },
  {
    familyId: 'organic_textures',
    internalTarget: targetFor('organic_textures'),
    configured: nonMusicRegistry.targetsFilledByRegistry.organic_texture + deterministicByRole('texture').length,
    candidate: lyriaTextureCandidates.length + deterministicByRole('texture').length,
    machinePassed: lyriaTextureCandidates.filter((candidate) => candidate.preparedAnalysis?.technicalStatus === 'pass').length + deterministicMachineByRole('texture').length,
    humanPassed: 0,
    formalUsable: 0,
    rejectedOrBlocked: 0,
    gapToInternalUsable: numericGap(targetFor('organic_textures'), 0),
    status: 'candidate_ready_for_review',
    nextAction: '保留为背景细节池，但需要人听判断：不能像电流、机器、道路、虫鸣，也不能形成固定旋律。',
    evidence: [
      'config/formal-foundational-non-music-elements-v1.json',
      'public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json',
      'public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json',
    ],
  },
  {
    familyId: 'accent_and_transition_events',
    internalTarget: targetFor('accent_and_transition_events'),
    configured: nonMusicRegistry.targetsFilledByRegistry.accent_one_shot + nonMusicRegistry.deterministicAccentConfigs.length,
    candidate: lyriaAccentCandidates.length + deterministicByRole('accent').length + soothingRetry.survivors.filter((item) => item.category === 'accent').length,
    machinePassed: lyriaAccentCandidates.filter((candidate) => candidate.preparedAnalysis?.technicalStatus === 'pass').length + deterministicMachineByRole('accent').length + soothingRetry.survivors.filter((item) => item.category === 'accent').length,
    humanPassed: 0,
    formalUsable: 0,
    rejectedOrBlocked: 0,
    gapToInternalUsable: numericGap(targetFor('accent_and_transition_events'), 0),
    status: 'candidate_ready_for_review',
    nextAction: '做短事件专门试听页：只验证 bell/bowl/chime 的起音是否吓人、尾音是否干净、是否可用于段落边界。',
    evidence: [
      'config/formal-foundational-non-music-elements-v1.json',
      'config/lyria-foundational-soothing-retry-v1-survivors.json',
      'public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json',
    ],
  },
  {
    familyId: 'precise_dsp_configs',
    internalTarget: targetFor('precise_dsp_configs'),
    configured: dspRegistry.configs.length,
    candidate: dspRegistry.configs.length,
    machinePassed: dspRegistry.configs.length,
    humanPassed: 0,
    formalUsable: preciseDspFormalUsable,
    rejectedOrBlocked: 0,
    gapToInternalUsable: numericGap(targetFor('precise_dsp_configs'), preciseDspFormalUsable),
    status: 'meets_internal_gate',
    nextAction: '配置数量达标；下一步只需要接入 Recipe，不要用“疗效频率”文案承诺效果。',
    evidence: ['config/deterministic-acoustic-configs-v1.json'],
  },
  {
    familyId: 'finished_reference_and_seed_content',
    internalTarget: targetFor('finished_reference_and_seed_content'),
    configured: finishedRelease.count,
    candidate: finishedRelease.count,
    machinePassed: finishedRelease.status === 'ready_to_publish' ? finishedRelease.count : 0,
    humanPassed: 0,
    formalUsable: finishedRelease.status === 'ready_to_publish' ? finishedRelease.count : 0,
    rejectedOrBlocked: rejectedCombination.candidateCount,
    gapToInternalUsable: numericGap(targetFor('finished_reference_and_seed_content'), finishedRelease.status === 'ready_to_publish' ? finishedRelease.count : 0),
    status: 'meets_internal_gate',
    nextAction: '这些是 finished content / seed，不是基础元素。可用于证明内容线，但不能拿来冒充可组合元素。',
    evidence: ['reports/content-baseline-30-longform-release.json'],
  },
];

const foundationalAudioRows = rows.filter(
  (row) => !['structured_composition_material', 'finished_reference_and_seed_content'].includes(row.familyId),
);
const sumNumber = (value: number | Record<string, number>): number =>
  typeof value === 'number' ? value : Object.values(value).reduce((sum, count) => sum + count, 0);

const summary = {
  auditId: 'business-audio-element-inventory-v1',
  generatedAt: new Date().toISOString(),
  internalAudibleBaseline: business.milestoneTargets.internalAudibleBaseline,
  correctionApplied: {
    rejectedBatch: business.immediateCorrectionFromRecentQa.rejectedBatch,
    ownerFeedback: business.immediateCorrectionFromRecentQa.ownerFeedback,
    interpretation: business.immediateCorrectionFromRecentQa.businessInterpretation,
  },
  headline: {
    configuredFoundationalAudioCount: foundationalAudioRows.reduce((sum, row) => sum + sumNumber(row.configured), 0),
    candidateFoundationalAudioCount: foundationalAudioRows.reduce((sum, row) => sum + sumNumber(row.candidate), 0),
    machinePassedFoundationalAudioCount: foundationalAudioRows.reduce((sum, row) => sum + sumNumber(row.machinePassed), 0),
    humanPassedFoundationalAudioCount: foundationalAudioRows.reduce((sum, row) => sum + sumNumber(row.humanPassed), 0),
    formalUsableFoundationalAudioCount: foundationalAudioRows.reduce((sum, row) => sum + sumNumber(row.formalUsable), 0),
    internalFoundationalAudioMinTarget: business.milestoneTargets.internalAudibleBaseline.foundationalElements.min,
    formalUsableFoundationalAudioGap: Math.max(
      0,
      business.milestoneTargets.internalAudibleBaseline.foundationalElements.min -
        foundationalAudioRows.reduce((sum, row) => sum + sumNumber(row.formalUsable), 0),
    ),
    structuredCompositionMaterialConfigured: structuredConfigured,
    finishedContentFormalUsable: finishedRelease.status === 'ready_to_publish' ? finishedRelease.count : 0,
    lyriaExpansion: {
      completedCandidateCount: lyriaExpansion.completedCandidateCount,
      technicalPassCount: lyriaTechnicalPass,
      humanPassedCount: lyriaHumanPassed,
      productionAllowed: lyriaExpansion.productionAllowed,
    },
    instrumentRuntimeProof: instrumentRuntimeProof
      ? {
          renderedCandidateCount: instrumentRuntimeProof.renderedCandidateCount,
          machinePassCount: instrumentRuntimeProof.machinePassCount,
          renderedSourceCount: runtimeRenderedSourceCount,
          blockedSourceCount: runtimeBlockedSourceCount,
          productionAllowed: instrumentRuntimeProof.productionAllowed,
        }
      : null,
    instrumentCompositionExpansion: instrumentCompositionExpansion
      ? {
          candidateCount: instrumentCompositionExpansion.candidateCount,
          machinePassCount: instrumentCompositionExpansion.machinePassCount,
          humanPassCount: instrumentCompositionExpansion.humanPassCount,
          formalUsableCount: instrumentCompositionExpansion.formalUsableCount,
          productionAllowed: instrumentCompositionExpansion.productionAllowed,
        }
      : null,
    atomicFoundationElements: atomicFoundationElements
      ? {
          audioElements: atomicFoundationElements.counts.audioElements,
          symbolicElements: atomicFoundationElements.counts.symbolicElements,
          totalElements: atomicFoundationElements.counts.totalElements,
          singleNotes: atomicFoundationElements.counts.singleNotes,
          harmonyCells: atomicFoundationElements.counts.harmonyCells,
          shortMotifs: atomicFoundationElements.counts.shortMotifs,
          bassSupport: atomicFoundationElements.counts.bassSupport,
          audioMachinePassCount: atomicAudioMachinePassCount,
          audioReviewRequiredCount: atomicAudioReviewRequiredCount,
          humanPassCount: atomicFoundationElements.humanPassCount,
          formalUsableCount: atomicFoundationElements.formalUsableCount,
          productionAllowed: atomicFoundationElements.productionAllowed,
        }
      : null,
    deterministicFoundation: {
      candidateCount: deterministicFoundation.candidateCount,
      machinePassCount: deterministicFoundation.machinePassCount,
      productionAllowed: deterministicFoundation.productionAllowed,
    },
  },
  rows,
  decision: {
    verdict: 'not_ready_for_internal_audible_foundational_baseline',
    reason:
      'The project has enough configured/candidate material to continue, but only deterministic DSP/noise configuration buckets are formal usable foundational audio today. Playable instrument sources are configured but not runtime-proven; environment/textures/accents need human identity and fatigue review; rejected or mixed combinations cannot count as foundational elements.',
    nextHighestLeverageWork:
      'Use Atomic Foundation Elements V1 as the approval surface: screen single notes, harmony cells, short motifs, bass support, and symbolic rules first; only then wire approved atoms into the composer/router for Sleep, Calm, and Focus.',
  },
};

const markdown = `# Business Audio Element Inventory V1

Generated: ${summary.generatedAt}

## Verdict

${summary.decision.verdict}

${summary.decision.reason}

## Headline counts

| Metric | Count |
| --- | ---: |
| Configured foundational audio items | ${summary.headline.configuredFoundationalAudioCount} |
| Candidate foundational audio items | ${summary.headline.candidateFoundationalAudioCount} |
| Machine-passed foundational audio items | ${summary.headline.machinePassedFoundationalAudioCount} |
| Human-passed foundational audio items | ${summary.headline.humanPassedFoundationalAudioCount} |
| Formal usable foundational audio items | ${summary.headline.formalUsableFoundationalAudioCount} |
| Internal foundational target minimum | ${summary.headline.internalFoundationalAudioMinTarget} |
| Formal usable gap to internal target | ${summary.headline.formalUsableFoundationalAudioGap} |
| Finished seed content formal usable | ${summary.headline.finishedContentFormalUsable} |

### True atomic foundation elements

| Metric | Count |
| --- | ---: |
| Atomic audio elements awaiting review | ${summary.headline.atomicFoundationElements?.audioElements ?? 0} |
| Atomic symbolic/rule elements awaiting review | ${summary.headline.atomicFoundationElements?.symbolicElements ?? 0} |
| Atomic total elements awaiting review | ${summary.headline.atomicFoundationElements?.totalElements ?? 0} |
| Atomic audio machine pass | ${summary.headline.atomicFoundationElements?.audioMachinePassCount ?? 0} |
| Atomic audio review required | ${summary.headline.atomicFoundationElements?.audioReviewRequiredCount ?? 0} |
| Atomic formal usable | ${summary.headline.atomicFoundationElements?.formalUsableCount ?? 0} |

Important: finished content and mixed combinations are not counted as foundational elements. The formal usable foundational count is a family-bucket count, not a claim that enough product-facing sounds are ready.

## Family audit

| Family | Internal target | Configured | Candidate | Machine passed | Human passed | Formal usable | Blocked/rejected | Gap | Status | Next action |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
${rows
  .map(
    (row) =>
      `| ${row.familyId} | ${formatTarget(row.internalTarget)} | ${formatCount(row.configured)} | ${formatCount(row.candidate)} | ${formatCount(row.machinePassed)} | ${formatCount(row.humanPassed)} | ${formatCount(row.formalUsable)} | ${formatCount(row.rejectedOrBlocked)} | ${formatCount(row.gapToInternalUsable)} | ${row.status} | ${row.nextAction} |`,
  )
  .join('\n')}

## Applied correction from latest owner QA

- Rejected batch: \`${summary.correctionApplied.rejectedBatch}\`
- Owner feedback: ${summary.correctionApplied.ownerFeedback}
- Business interpretation: ${summary.correctionApplied.interpretation}

This means generic continuous noise must not be promoted as the product's default identity, even if a machine QA script passes it.

## Next highest-leverage work

${summary.decision.nextHighestLeverageWork}

## Evidence inputs

${[...new Set(rows.flatMap((row) => row.evidence))]
  .map((item) => `- \`${item}\``)
  .join('\n')}
`;

await mkdir(path.join(root, 'reports'), { recursive: true });
await writeFile(path.join(root, 'reports/business-audio-element-inventory-v1.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(root, 'reports/business-audio-element-inventory-v1.md'), markdown);

console.log(
  JSON.stringify(
    {
      passed: true,
      auditId: summary.auditId,
      verdict: summary.decision.verdict,
      configuredFoundationalAudioCount: summary.headline.configuredFoundationalAudioCount,
      candidateFoundationalAudioCount: summary.headline.candidateFoundationalAudioCount,
      machinePassedFoundationalAudioCount: summary.headline.machinePassedFoundationalAudioCount,
      formalUsableFoundationalAudioCount: summary.headline.formalUsableFoundationalAudioCount,
      formalUsableFoundationalAudioGap: summary.headline.formalUsableFoundationalAudioGap,
      report: 'reports/business-audio-element-inventory-v1.md',
      json: 'reports/business-audio-element-inventory-v1.json',
    },
    null,
    2,
  ),
);
