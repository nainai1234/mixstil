import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStemDurationEligible, matchableStemMetadataV3, type GoalFit, type StemMetadataSeed } from './audioKnowledgeV3';
import { pool, query } from './db';

type CoverageCell = {
  id: string;
  goal: GoalFit['goal'];
  scene: GoalFit['scene'];
  contentMode: 'pure_soundscape' | 'functional_music' | 'sound_journey' | 'guided_meditation';
  requiredRoles: Array<StemMetadataSeed['roles'][number] | 'voice.guide'>;
};

const cells: CoverageCell[] = [
  { id: 'sleep_bedtime_pure', goal: 'sleep', scene: 'bedtime', contentMode: 'pure_soundscape', requiredRoles: ['base.masking'] },
  { id: 'sleep_bedtime_music', goal: 'sleep', scene: 'bedtime', contentMode: 'functional_music', requiredRoles: ['music.bed'] },
  { id: 'sleep_bedtime_journey', goal: 'sleep', scene: 'bedtime', contentMode: 'sound_journey', requiredRoles: ['base.masking', 'music.bed'] },
  { id: 'sleep_bedtime_guided', goal: 'sleep', scene: 'bedtime', contentMode: 'guided_meditation', requiredRoles: ['base.masking', 'voice.guide'] },
  { id: 'sleep_return_pure', goal: 'sleep', scene: 'return_to_sleep', contentMode: 'pure_soundscape', requiredRoles: ['base.masking'] },
  { id: 'sleep_return_music', goal: 'sleep', scene: 'return_to_sleep', contentMode: 'functional_music', requiredRoles: ['music.bed'] },
  { id: 'sleep_return_guided', goal: 'sleep', scene: 'return_to_sleep', contentMode: 'guided_meditation', requiredRoles: ['base.masking', 'voice.guide'] },
  { id: 'calm_breathing_pure', goal: 'calm', scene: 'breathing', contentMode: 'pure_soundscape', requiredRoles: ['base.masking', 'accent.event'] },
  { id: 'calm_breathing_guided', goal: 'calm', scene: 'breathing', contentMode: 'guided_meditation', requiredRoles: ['base.masking', 'voice.guide'] },
  { id: 'calm_settling_pure', goal: 'calm', scene: 'emotional_settling', contentMode: 'pure_soundscape', requiredRoles: ['base.masking'] },
  { id: 'calm_settling_music', goal: 'calm', scene: 'emotional_settling', contentMode: 'functional_music', requiredRoles: ['music.bed'] },
  { id: 'calm_settling_journey', goal: 'calm', scene: 'emotional_settling', contentMode: 'sound_journey', requiredRoles: ['base.masking', 'music.bed'] },
  { id: 'focus_pure', goal: 'focus', scene: 'deep_focus', contentMode: 'pure_soundscape', requiredRoles: ['base.masking'] },
  { id: 'focus_music', goal: 'focus', scene: 'deep_focus', contentMode: 'functional_music', requiredRoles: ['music.bed'] },
  { id: 'focus_journey', goal: 'focus', scene: 'deep_focus', contentMode: 'sound_journey', requiredRoles: ['base.masking', 'music.bed'] },
];

const fits = (metadata: StemMetadataSeed, cell: CoverageCell) => metadata.goalFit.some((item) => item.goal === cell.goal && item.scene === cell.scene && item.score >= 0.65);
const isWater = (metadata: StemMetadataSeed) => metadata.sourceConcepts.some((id) => id === 'source.natural.water' || id.startsWith('source.natural.water.'));
const matchesConcept = (candidateConcept: string, requestedConcept: string) => candidateConcept === requestedConcept || candidateConcept.startsWith(`${requestedConcept}.`);

const run = async () => {
  const inventory = await query<{ category: string; qa_status: string; count: string }>(
    'select category, qa_status, count(*)::text from audio_stems group by category, qa_status order by category, qa_status',
  );
  const acousticRows = await query<{ stem_id: string; duration_seconds: number }>(
    'select stem_id, duration_seconds from stem_acoustic_features where stem_id = any($1)',
    [[...matchableStemMetadataV3.map((item) => item.stemId)]],
  );
  const durationByStemId = new Map(acousticRows.rows.map((row) => [row.stem_id, Number(row.duration_seconds)]));
  const eligibleMetadata = matchableStemMetadataV3.filter((item) => isStemDurationEligible(item.roles, durationByStemId.get(item.stemId) ?? null));
  const coverage = cells.map((cell) => {
    const roleCoverage = cell.requiredRoles.map((role) => {
      const candidates = role === 'voice.guide' ? [] : eligibleMetadata.filter((item) => fits(item, cell) && item.roles.includes(role));
      return {
        role,
        candidateCount: candidates.length,
        editorialCandidateCount: candidates.filter((item) => item.goalFit.some((fit) => fit.goal === cell.goal && fit.scene === cell.scene && fit.score >= 0.65 && fit.verified)).length,
        candidateStemIds: candidates.map((item) => item.stemId),
        noWaterCandidateCount: candidates.filter((item) => !isWater(item)).length,
        threshold: 3,
        passed: candidates.length >= 3,
      };
    });
    const combinationEstimate = roleCoverage.reduce((count, role) => count * Math.max(1, role.candidateCount), 1);
    const gaps = roleCoverage.filter((role) => !role.passed).map((role) => ({
      role: role.role,
      missingCandidates: Math.max(0, role.threshold - role.candidateCount),
      reason: role.role === 'voice.guide' ? 'Production voice remains intentionally deferred.' : 'Fewer than three approved matchable candidates satisfy this role and scene.',
    }));
    return {
      ...cell,
      roleCoverage,
      combinationEstimate,
      hasTwoCombinations: combinationEstimate >= 2 && gaps.length === 0,
      hasNoWaterFallback: roleCoverage.every((role) => role.role === 'voice.guide' || role.noWaterCandidateCount >= 1),
      gaps,
      status: gaps.length === 0 && combinationEstimate >= 2 ? 'covered' : 'gap',
    };
  });

  const currentCoverageGapIds: string[] = [];
  for (const cell of coverage) {
    for (const gap of cell.gaps) {
      const gapId = `gap_${cell.id}_${gap.role.replace(/\W+/g, '_')}`;
      currentCoverageGapIds.push(gapId);
      await query(
        `insert into supply_gaps (id, concept_id, role, goal, scene, content_mode, phase, request_count, estimated_reuse_score, acoustic_target, example_prompts, status)
         values ($1, null, $2, $3, $4, $5, 'core', 1, $6, $7, $8, 'open')
         on conflict (id) do update set role = excluded.role, goal = excluded.goal, scene = excluded.scene,
           content_mode = excluded.content_mode,
           estimated_reuse_score = excluded.estimated_reuse_score, acoustic_target = excluded.acoustic_target,
           example_prompts = excluded.example_prompts, status = 'open', resolved_stem_id = null, updated_at = now()`,
        [gapId, gap.role, cell.goal, cell.scene, cell.contentMode, gap.missingCandidates,
          JSON.stringify({ lowEventDensity: true, lowSuddenPeakRisk: true }),
          [`Coverage gap for ${cell.goal}/${cell.scene}/${cell.contentMode}`]],
      );
    }
  }
  await query(
    `update supply_gaps set status = 'resolved', updated_at = now()
     where concept_id is null and status in ('open', 'planned', 'sourcing') and not (id = any($1))`,
    [currentCoverageGapIds],
  );
  const requestedGaps = await query<{ id: string; concept_id: string; goal: GoalFit['goal']; scene: GoalFit['scene'] }>(
    `select id, concept_id, goal, scene from supply_gaps
     where concept_id is not null and status in ('open', 'planned', 'sourcing')`,
  );
  for (const gap of requestedGaps.rows) {
    const resolvedBy = eligibleMetadata.find((item) => item.goalFit.some((goalFit) => goalFit.goal === gap.goal && goalFit.scene === gap.scene && goalFit.score >= 0.65)
      && item.sourceConcepts.some((conceptId) => matchesConcept(conceptId, gap.concept_id)));
    if (resolvedBy) {
      await query("update supply_gaps set status = 'resolved', resolved_stem_id = $2, updated_at = now() where id = $1", [gap.id, resolvedBy.stemId]);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ontologyVersion: 3,
    metadataVersion: 3,
    matchableStemCount: matchableStemMetadataV3.length,
    acousticallyEligibleStemCount: eligibleMetadata.length,
    acousticAnalyzedCount: acousticRows.rows.length,
    inventory: inventory.rows.map((row) => ({ category: row.category, qaStatus: row.qa_status, count: Number(row.count) })),
    summary: {
      cellCount: coverage.length,
      coveredCells: coverage.filter((cell) => cell.status === 'covered').length,
      gapCells: coverage.filter((cell) => cell.status === 'gap').length,
      cellsWithNoWaterFallback: coverage.filter((cell) => cell.hasNoWaterFallback).length,
      openGapCount: coverage.reduce((count, cell) => count + cell.gaps.length, 0),
    },
    coverage,
  };

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const reportsDir = path.join(root, 'reports');
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, 'content-coverage-v3.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const lines = [
    '# Content Coverage V3', '',
    `Generated: ${report.generatedAt}`, '',
    `- Matchable Stem metadata: ${report.matchableStemCount}`,
    `- Acoustically eligible Stems: ${report.acousticallyEligibleStemCount}`,
    `- Acoustic analyses: ${report.acousticAnalyzedCount}`,
    `- Covered cells: ${report.summary.coveredCells}/${report.summary.cellCount}`,
    `- Cells with gaps: ${report.summary.gapCells}`,
    `- Cells with a non-water fallback: ${report.summary.cellsWithNoWaterFallback}/${report.summary.cellCount}`,
    '', '| Cell | Mode | Status | Candidate coverage | Gaps |', '| --- | --- | --- | --- | --- |',
    ...coverage.map((cell) => `| ${cell.goal}/${cell.scene} | ${cell.contentMode} | ${cell.status} | ${cell.roleCoverage.map((role) => `${role.role}: ${role.candidateCount} (${role.editorialCandidateCount} editorial)`).join('<br>')} | ${cell.gaps.map((gap) => `${gap.role}: +${gap.missingCandidates}`).join('<br>') || 'None'} |`),
    '', 'A playable result is not counted as covered unless every required role has at least three approved candidates and the cell has at least two estimated combinations.', '',
  ];
  await writeFile(path.join(reportsDir, 'content-coverage-v3.md'), lines.join('\n'), 'utf8');
  console.log(JSON.stringify(report.summary, null, 2));
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
