import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isStemDurationEligible,
  matchableStemMetadataV3,
  type GoalFit,
  type StemMetadataSeed,
} from './audioKnowledgeV3';
import type { SessionSubtype } from './audioIntentV3';
import { pool, query } from './db';

type Goal = GoalFit['goal'];
type Scene = GoalFit['scene'];
type Role = StemMetadataSeed['roles'][number];
type CoverageStatus = 'covered' | 'partial' | 'gap';

type RoleRequirement = {
  role: Role;
  minimumApproved: number;
  minimumEditorial: number;
};

type ConceptTarget = {
  conceptId: string;
  label: string;
  priority: 1 | 2 | 3;
  action: 'source' | 'generate' | 'review';
};

type SubtypeProfile = {
  subtype: SessionSubtype;
  goal: Goal;
  scene: Scene;
  label: string;
  requiredRoles: RoleRequirement[];
  thresholds: {
    candidateCount: number;
    editorialFamilyCount: number;
    lowEventCount: number;
    suddenPeakSafeCount: number;
    noWaterCount: number;
    combinationCount: number;
  };
  targetConcepts: ConceptTarget[];
};

const source = (conceptId: string, label: string, priority: 1 | 2 | 3 = 2): ConceptTarget => ({ conceptId, label, priority, action: 'source' });
const generate = (conceptId: string, label: string, priority: 1 | 2 | 3 = 2): ConceptTarget => ({ conceptId, label, priority, action: 'generate' });

const profiles: SubtypeProfile[] = [
  {
    subtype: 'bedtime_wind_down', goal: 'sleep', scene: 'bedtime', label: 'Bedtime wind-down',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'music.bed', minimumApproved: 4, minimumEditorial: 3 },
    ],
    thresholds: { candidateCount: 14, editorialFamilyCount: 7, lowEventCount: 8, suddenPeakSafeCount: 10, noWaterCount: 9, combinationCount: 48 },
    targetConcepts: [source('source.natural.wind', 'gentle wind', 1), source('source.natural.fire', 'quiet fire', 2), source('source.natural.forest', 'night forest', 2), generate('source.music.drone', 'neutral sleep drone', 1)],
  },
  {
    subtype: 'sleep_onset', goal: 'sleep', scene: 'bedtime', label: 'Sleep onset',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'music.bed', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 13, editorialFamilyCount: 7, lowEventCount: 9, suddenPeakSafeCount: 10, noWaterCount: 9, combinationCount: 36 },
    targetConcepts: [source('source.domestic.room_tone', 'quiet room tone', 1), source('source.domestic.fan', 'low fan', 1), source('source.natural.wind', 'gentle wind', 2), generate('source.music.drone', 'low-stimulation sleep drone', 1)],
  },
  {
    subtype: 'return_to_sleep', goal: 'sleep', scene: 'return_to_sleep', label: 'Return to sleep',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
      { role: 'music.bed', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 11, editorialFamilyCount: 6, lowEventCount: 8, suddenPeakSafeCount: 9, noWaterCount: 8, combinationCount: 27 },
    targetConcepts: [source('source.domestic.room_tone', 'quiet room tone', 1), source('source.domestic.fan', 'low fan', 1), source('source.vehicle.rail.carriage', 'quiet train carriage', 2), generate('source.music.drone', 'soft return-to-sleep drone', 1)],
  },
  {
    subtype: 'all_night_masking', goal: 'sleep', scene: 'bedtime', label: 'All-night masking',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'environment.scene', minimumApproved: 4, minimumEditorial: 3 },
    ],
    thresholds: { candidateCount: 10, editorialFamilyCount: 7, lowEventCount: 8, suddenPeakSafeCount: 9, noWaterCount: 8, combinationCount: 20 },
    targetConcepts: [source('source.domestic.room_tone', 'quiet room tone', 1), source('source.domestic.fan', 'steady fan', 1), source('source.domestic.air_conditioner', 'air-conditioner hum', 2), source('source.vehicle.rail.carriage', 'train carriage', 2)],
  },
  {
    subtype: 'nap', goal: 'sleep', scene: 'bedtime', label: 'Nap',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 3, minimumEditorial: 2 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
      { role: 'music.bed', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 10, editorialFamilyCount: 6, lowEventCount: 6, suddenPeakSafeCount: 8, noWaterCount: 7, combinationCount: 27 },
    targetConcepts: [source('source.domestic.room_tone', 'daytime room tone', 2), source('source.domestic.fan', 'soft fan', 2), generate('source.music.pad', 'short warm pad', 2)],
  },
  {
    subtype: 'breath_awareness', goal: 'calm', scene: 'breathing', label: 'Breath awareness',
    requiredRoles: [
      { role: 'environment.scene', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'accent.event', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 9, editorialFamilyCount: 6, lowEventCount: 6, suddenPeakSafeCount: 6, noWaterCount: 6, combinationCount: 12 },
    targetConcepts: [source('source.natural.wind', 'gentle wind', 2), source('source.natural.forest', 'open forest', 2), source('source.music.bell', 'soft bowl tone', 1), source('source.accent.chime', 'soft transition chime', 2)],
  },
  {
    subtype: 'grounding', goal: 'calm', scene: 'emotional_settling', label: 'Grounding',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 3, minimumEditorial: 2 },
      { role: 'environment.scene', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'music.bed', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 13, editorialFamilyCount: 8, lowEventCount: 7, suddenPeakSafeCount: 9, noWaterCount: 9, combinationCount: 45 },
    targetConcepts: [source('source.natural.fire', 'quiet fire', 1), source('source.natural.forest', 'forest ambience', 1), source('source.natural.wind', 'gentle wind', 2), generate('source.music.drone', 'grounded low drone', 2)],
  },
  {
    subtype: 'open_awareness', goal: 'calm', scene: 'breathing', label: 'Open awareness',
    requiredRoles: [
      { role: 'environment.scene', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'music.bed', minimumApproved: 3, minimumEditorial: 2 },
      { role: 'accent.event', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 12, editorialFamilyCount: 8, lowEventCount: 7, suddenPeakSafeCount: 8, noWaterCount: 8, combinationCount: 45 },
    targetConcepts: [source('source.natural.forest', 'forest ambience', 1), source('source.natural.wind', 'open wind', 2), source('source.music.bell', 'bowl tone', 2), generate('source.music.pad', 'spacious meditation pad', 1)],
  },
  {
    subtype: 'emotional_release', goal: 'calm', scene: 'emotional_settling', label: 'Emotional release',
    requiredRoles: [
      { role: 'environment.scene', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'music.bed', minimumApproved: 5, minimumEditorial: 4 },
    ],
    thresholds: { candidateCount: 12, editorialFamilyCount: 8, lowEventCount: 6, suddenPeakSafeCount: 8, noWaterCount: 8, combinationCount: 25 },
    targetConcepts: [source('source.natural.fire', 'quiet fire', 2), source('source.natural.forest', 'forest ambience', 2), generate('source.music.pad', 'warm release pad', 1), generate('source.music.drone', 'release-to-settle drone', 1)],
  },
  {
    subtype: 'sound_meditation', goal: 'calm', scene: 'breathing', label: 'Sound meditation',
    requiredRoles: [
      { role: 'music.bed', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'accent.event', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 13, editorialFamilyCount: 8, lowEventCount: 8, suddenPeakSafeCount: 8, noWaterCount: 9, combinationCount: 60 },
    targetConcepts: [source('source.music.bell', 'bowl and bell tones', 1), source('source.accent.chime', 'transition chimes', 2), generate('source.music.pad', 'meditation pad', 1), generate('source.music.drone', 'meditation drone', 1)],
  },
  {
    subtype: 'reading_writing', goal: 'focus', scene: 'deep_focus', label: 'Reading and writing',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'music.bed', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 12, editorialFamilyCount: 7, lowEventCount: 9, suddenPeakSafeCount: 10, noWaterCount: 9, combinationCount: 48 },
    targetConcepts: [source('source.domestic.room_tone', 'quiet room tone', 1), source('source.vehicle.rail.carriage', 'quiet train carriage', 1), source('source.domestic.fan', 'low fan', 1), generate('source.music.drone', 'neutral focus drone', 1)],
  },
  {
    subtype: 'deep_work', goal: 'focus', scene: 'deep_focus', label: 'Deep work',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'music.bed', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 14, editorialFamilyCount: 8, lowEventCount: 10, suddenPeakSafeCount: 11, noWaterCount: 10, combinationCount: 75 },
    targetConcepts: [source('source.domestic.room_tone', 'quiet room tone', 1), source('source.domestic.fan', 'steady fan', 1), source('source.vehicle.rail.carriage', 'train carriage', 2), generate('source.music.drone', 'deep-work drone', 1)],
  },
  {
    subtype: 'study', goal: 'focus', scene: 'deep_focus', label: 'Study',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'music.bed', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 12, editorialFamilyCount: 7, lowEventCount: 8, suddenPeakSafeCount: 9, noWaterCount: 9, combinationCount: 48 },
    targetConcepts: [source('source.domestic.room_tone', 'study room tone', 1), source('source.vehicle.rail.carriage', 'quiet train carriage', 2), source('source.domestic.fan', 'low fan', 1), generate('source.music.pad', 'neutral study pad', 2)],
  },
  {
    subtype: 'creative_work', goal: 'focus', scene: 'deep_focus', label: 'Creative work',
    requiredRoles: [
      { role: 'music.bed', minimumApproved: 6, minimumEditorial: 5 },
      { role: 'environment.scene', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'base.masking', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 14, editorialFamilyCount: 9, lowEventCount: 7, suddenPeakSafeCount: 9, noWaterCount: 10, combinationCount: 72 },
    targetConcepts: [generate('source.music.pad', 'spacious creative pad', 1), generate('source.music.drone', 'creative drone', 2), source('source.natural.forest', 'forest texture', 2), source('source.natural.wind', 'wind texture', 2)],
  },
  {
    subtype: 'repetitive_task', goal: 'focus', scene: 'deep_focus', label: 'Repetitive task',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'music.bed', minimumApproved: 4, minimumEditorial: 3 },
      { role: 'environment.scene', minimumApproved: 3, minimumEditorial: 2 },
    ],
    thresholds: { candidateCount: 13, editorialFamilyCount: 7, lowEventCount: 9, suddenPeakSafeCount: 10, noWaterCount: 10, combinationCount: 60 },
    targetConcepts: [source('source.domestic.fan', 'steady fan', 1), source('source.vehicle.rail.carriage', 'train carriage', 1), source('source.domestic.air_conditioner', 'air-conditioner hum', 2), generate('source.music.drone', 'steady task drone', 2)],
  },
  {
    subtype: 'distraction_masking', goal: 'focus', scene: 'deep_focus', label: 'Distraction masking',
    requiredRoles: [
      { role: 'base.masking', minimumApproved: 5, minimumEditorial: 4 },
      { role: 'environment.scene', minimumApproved: 4, minimumEditorial: 3 },
    ],
    thresholds: { candidateCount: 10, editorialFamilyCount: 7, lowEventCount: 8, suddenPeakSafeCount: 9, noWaterCount: 8, combinationCount: 20 },
    targetConcepts: [source('source.domestic.fan', 'steady fan', 1), source('source.domestic.air_conditioner', 'air-conditioner hum', 1), source('source.vehicle.rail.carriage', 'train carriage', 2), source('source.vehicle.aircraft.cabin', 'aircraft cabin', 3)],
  },
];

const matchesConcept = (candidate: string, target: string) => candidate === target || candidate.startsWith(`${target}.`);
const fits = (metadata: StemMetadataSeed, profile: SubtypeProfile) => metadata.goalFit.some((item) => item.goal === profile.goal && item.scene === profile.scene && item.score >= 0.65);
const isWater = (metadata: StemMetadataSeed) => metadata.sourceConcepts.some((conceptId) => matchesConcept(conceptId, 'source.natural.water'));
const isLowEvent = (metadata: StemMetadataSeed) => metadata.acousticConcepts.includes('acoustic.low_event_density');
const isSuddenPeakSafe = (metadata: StemMetadataSeed) => !metadata.risks.some((item) => item.riskId === 'risk.sudden_peak' && item.severity > 0.35);
const isEditorial = (metadata: StemMetadataSeed, profile: SubtypeProfile) => metadata.reviewStatus !== 'catalog_baseline'
  && metadata.goalFit.some((item) => item.goal === profile.goal && item.scene === profile.scene && item.score >= 0.65 && item.verified);

const semanticFamily = (conceptId: string) => {
  const parts = conceptId.split('.');
  if (conceptId.startsWith('source.natural.water.')) return parts.slice(0, 4).join('.');
  if (conceptId.startsWith('source.domestic.') || conceptId.startsWith('source.music.') || conceptId.startsWith('source.noise.')) return parts.slice(0, 3).join('.');
  if (conceptId.startsWith('source.vehicle.')) return parts.slice(0, 4).join('.');
  if (conceptId.startsWith('source.animal.insect.')) return parts.slice(0, 4).join('.');
  return parts.slice(0, 3).join('.');
};

const roleCombinationCount = (counts: number[]) => counts.reduce((total, count) => total * count, 1);

const run = async () => {
  const approvedRows = await query<{ id: string }>(
    `select id from audio_stems
     where qa_status = 'approved' and commercial_use_allowed = true and derivative_use_allowed = true`,
  );
  const approvedIds = new Set(approvedRows.rows.map((row) => row.id));
  const acousticRows = await query<{ stem_id: string; duration_seconds: number }>(
    'select stem_id, duration_seconds from stem_acoustic_features where stem_id = any($1)',
    [[...matchableStemMetadataV3.map((item) => item.stemId)]],
  );
  const durationByStemId = new Map(acousticRows.rows.map((row) => [row.stem_id, Number(row.duration_seconds)]));
  const eligibleMetadata = matchableStemMetadataV3.filter((item) => approvedIds.has(item.stemId)
    && isStemDurationEligible(item.roles, durationByStemId.get(item.stemId) ?? null));

  const coverage = profiles.map((profile) => {
    const candidates = eligibleMetadata.filter((item) => fits(item, profile));
    const editorialCandidates = candidates.filter((item) => isEditorial(item, profile));
    const roleCoverage = profile.requiredRoles.map((requirement) => {
      const roleCandidates = candidates.filter((item) => item.roles.includes(requirement.role));
      const editorialRoleCandidates = roleCandidates.filter((item) => isEditorial(item, profile));
      return {
        ...requirement,
        approvedCount: roleCandidates.length,
        editorialCount: editorialRoleCandidates.length,
        candidateStemIds: roleCandidates.map((item) => item.stemId),
        passed: roleCandidates.length >= requirement.minimumApproved && editorialRoleCandidates.length >= requirement.minimumEditorial,
      };
    });
    const families = new Set(candidates.flatMap((item) => item.sourceConcepts.map(semanticFamily)));
    const editorialFamilies = new Set(editorialCandidates.flatMap((item) => item.sourceConcepts.map(semanticFamily)));
    const lowEventCount = candidates.filter(isLowEvent).length;
    const suddenPeakSafeCount = candidates.filter(isSuddenPeakSafe).length;
    const noWaterCount = candidates.filter((item) => !isWater(item)).length;
    const combinationCount = roleCombinationCount(roleCoverage.map((item) => item.approvedCount));
    const targetCoverage = profile.targetConcepts.map((target) => {
      const matching = candidates.filter((item) => item.sourceConcepts.some((conceptId) => matchesConcept(conceptId, target.conceptId)));
      const editorialMatching = matching.filter((item) => isEditorial(item, profile));
      return {
        ...target,
        approvedCount: matching.length,
        editorialCount: editorialMatching.length,
        candidateStemIds: matching.map((item) => item.stemId),
        passed: editorialMatching.length > 0,
      };
    });
    const hardFailures = [
      ...roleCoverage.filter((item) => !item.passed).map((item) => `${item.role} needs ${item.minimumApproved} approved / ${item.minimumEditorial} editorial, has ${item.approvedCount} / ${item.editorialCount}`),
      ...(candidates.length < profile.thresholds.candidateCount ? [`candidate pool ${candidates.length}/${profile.thresholds.candidateCount}`] : []),
      ...(noWaterCount === 0 ? ['no non-water fallback'] : []),
    ];
    const qualityFailures = [
      ...(editorialFamilies.size < profile.thresholds.editorialFamilyCount ? [`editorial semantic families ${editorialFamilies.size}/${profile.thresholds.editorialFamilyCount}`] : []),
      ...(lowEventCount < profile.thresholds.lowEventCount ? [`low-event candidates ${lowEventCount}/${profile.thresholds.lowEventCount}`] : []),
      ...(suddenPeakSafeCount < profile.thresholds.suddenPeakSafeCount ? [`sudden-peak-safe candidates ${suddenPeakSafeCount}/${profile.thresholds.suddenPeakSafeCount}`] : []),
      ...(noWaterCount < profile.thresholds.noWaterCount ? [`non-water candidates ${noWaterCount}/${profile.thresholds.noWaterCount}`] : []),
      ...(combinationCount < profile.thresholds.combinationCount ? [`role combinations ${combinationCount}/${profile.thresholds.combinationCount}`] : []),
      ...targetCoverage.filter((item) => !item.passed).map((item) => `missing editorial ${item.label}`),
    ];
    const status: CoverageStatus = hardFailures.length > 0 ? 'gap' : qualityFailures.length > 0 ? 'partial' : 'covered';
    return {
      subtype: profile.subtype,
      goal: profile.goal,
      label: profile.label,
      status,
      voiceDependency: false,
      candidateCount: candidates.length,
      editorialCandidateCount: editorialCandidates.length,
      semanticFamilyCount: families.size,
      editorialSemanticFamilyCount: editorialFamilies.size,
      semanticFamilies: [...families].sort(),
      editorialSemanticFamilies: [...editorialFamilies].sort(),
      lowEventCount,
      suddenPeakSafeCount,
      noWaterCount,
      combinationCount,
      roleCoverage,
      targetCoverage,
      hardFailures,
      qualityFailures,
    };
  });

  const sourcing = new Map<string, ConceptTarget & { affectedSubtypes: SessionSubtype[]; score: number }>();
  for (const item of coverage) {
    for (const target of item.targetCoverage.filter((entry) => !entry.passed)) {
      const existing = sourcing.get(target.conceptId) ?? { ...target, affectedSubtypes: [], score: 0 };
      existing.affectedSubtypes.push(item.subtype);
      existing.score += (4 - target.priority) * (item.status === 'gap' ? 2 : 1);
      sourcing.set(target.conceptId, existing);
    }
  }
  const priorities = [...sourcing.values()].sort((left, right) => right.score - left.score || left.priority - right.priority);
  const byGoal = (goal: Goal) => {
    const rows = coverage.filter((item) => item.goal === goal);
    return {
      total: rows.length,
      covered: rows.filter((item) => item.status === 'covered').length,
      partial: rows.filter((item) => item.status === 'partial').length,
      gap: rows.filter((item) => item.status === 'gap').length,
    };
  };
  const reportDate = new Date().toISOString().slice(0, 10);
  const report = {
    generatedAt: new Date().toISOString(),
    reportDate,
    releaseChannel: 'voice-free-beta',
    definition: 'Coverage requires approved playable assets, editorially credible semantic variety, low-stimulation options, sudden-peak-safe options, non-water fallbacks, and enough role combinations.',
    mutationPolicy: 'Read-only strategic report. It does not create, resolve, or modify request-derived supply_gaps.',
    inventory: {
      approvedCommercialDerivativeStemCount: approvedIds.size,
      metadataStemCount: matchableStemMetadataV3.length,
      acousticallyEligibleMatchableStemCount: eligibleMetadata.length,
      acousticAnalyzedCount: acousticRows.rows.length,
    },
    summary: {
      subtypeCount: coverage.length,
      covered: coverage.filter((item) => item.status === 'covered').length,
      partial: coverage.filter((item) => item.status === 'partial').length,
      gap: coverage.filter((item) => item.status === 'gap').length,
      byGoal: { sleep: byGoal('sleep'), calm: byGoal('calm'), focus: byGoal('focus') },
    },
    guidedPracticeBoundary: {
      availableInVoiceFreeBeta: false,
      unavailablePractices: ['body scan', 'loving-kindness', 'guided imagery', 'progressive muscle relaxation', 'spoken breath counting'],
      reason: 'These practices depend on production-grade controlled voice and reviewed scripts. They must not be represented as covered by non-voice assets.',
    },
    coverage,
    prioritizedSourcingOrGeneration: priorities,
  };

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const reportsDir = path.join(root, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, `effective-content-coverage-v3-${reportDate}.json`);
  const markdownPath = path.join(reportsDir, `effective-content-coverage-v3-${reportDate}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const lines = [
    '# Effective Content Coverage V3',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This is a read-only strategic coverage report. It does not mutate request-derived supply gaps.',
    '',
    `- Approved commercial/derivative Stems: ${report.inventory.approvedCommercialDerivativeStemCount}`,
    `- Acoustically eligible matchable Stems: ${report.inventory.acousticallyEligibleMatchableStemCount}`,
    `- Effective coverage: ${report.summary.covered} covered / ${report.summary.partial} partial / ${report.summary.gap} gap`,
    `- Sleep: ${report.summary.byGoal.sleep.covered} covered / ${report.summary.byGoal.sleep.partial} partial / ${report.summary.byGoal.sleep.gap} gap`,
    `- Calm: ${report.summary.byGoal.calm.covered} covered / ${report.summary.byGoal.calm.partial} partial / ${report.summary.byGoal.calm.gap} gap`,
    `- Focus: ${report.summary.byGoal.focus.covered} covered / ${report.summary.byGoal.focus.partial} partial / ${report.summary.byGoal.focus.gap} gap`,
    '',
    '## Subtype Coverage',
    '',
    '| Goal | Subtype | Status | Approved/editorial | Editorial families | Low event | Peak safe | No water | Combinations | Main deficiencies |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...coverage.map((item) => `| ${item.goal} | ${item.label} | ${item.status} | ${item.candidateCount}/${item.editorialCandidateCount} | ${item.editorialSemanticFamilyCount} | ${item.lowEventCount} | ${item.suddenPeakSafeCount} | ${item.noWaterCount} | ${item.combinationCount} | ${[...item.hardFailures, ...item.qualityFailures].join('<br>') || 'None'} |`),
    '',
    '## Prioritized Sourcing And Generation',
    '',
    '| Priority | Concept | Action | Affected subtypes | Score |',
    '| ---: | --- | --- | --- | ---: |',
    ...priorities.map((item) => `| ${item.priority} | ${item.label} (\`${item.conceptId}\`) | ${item.action} | ${item.affectedSubtypes.join(', ')} | ${item.score} |`),
    '',
    '## Voice-free Boundary',
    '',
    'Body scan, loving-kindness, guided imagery, progressive muscle relaxation, and spoken breath counting remain unavailable in Voice-free Beta. Non-voice assets must not be used to claim those guided practices are covered.',
    '',
    'A playable file or a large raw candidate count is not sufficient evidence of effective coverage. Semantic identity, editorial verification, safety characteristics, exclusion-safe fallbacks, and distinct combinations all count.',
    '',
  ];
  await writeFile(markdownPath, lines.join('\n'), 'utf8');
  console.log(JSON.stringify({ summary: report.summary, topPriorities: priorities.slice(0, 8), jsonPath, markdownPath }, null, 2));
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
