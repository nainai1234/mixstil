import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedDatabase } from './seed';
import { pool, query } from './db';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';

const promotedIds = [
  'stem_batch09_room_apartment_small',
  'stem_batch09_room_bedroom_night',
  'stem_batch09_room_office_distant_traffic',
  'stem_batch09_fan_deep_ventilation',
  'stem_batch09_fan_mine_ventilation',
  'stem_batch09_train_taiwan_ep727',
  'stem_batch09_air_conditioner_hum_1',
  'stem_batch09_air_conditioner_hum_2',
  'stem_local_procedural_focus_neutral_clean',
  'stem_local_procedural_focus_warm_mid',
  'stem_local_procedural_focus_low_anchor',
  'stem_local_procedural_focus_open_air',
] as const;

const expectedLoopIds = [
  'room_apartment_small', 'room_bedroom_night', 'room_office_distant_traffic',
  'fan_deep_ventilation', 'fan_mine_ventilation', 'train_taiwan_ep727',
  'air_conditioner_hum_1', 'air_conditioner_hum_2',
  'procedural_focus_neutral_clean', 'procedural_focus_warm_mid',
  'procedural_focus_low_anchor', 'procedural_focus_open_air',
] as const;

const expectedCombinationIds = [
  'small_apartment_neutral_focus', 'bedroom_night_warm_focus',
  'office_distant_traffic_low_anchor', 'deep_ventilation_open_air',
  'mine_ventilation_neutral_focus', 'train_carriage_warm_focus',
  'air_conditioner_1_low_anchor', 'air_conditioner_2_open_air',
  'neutral_focus_soft_pink', 'warm_focus_soft_brown',
  'low_anchor_deep_brown', 'open_air_balanced_pink',
] as const;

const readJson = async (relativePath: string) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
const sameIds = (actual: unknown, expected: readonly string[]) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every((id) => actual.includes(id));

const requireFiles = async (relativePaths: string[]) => {
  for (const relativePath of relativePaths) await access(path.join(root, relativePath));
};

const run = async () => {
  const [basic, loop, combination, finalDecision, focusMachine] = await Promise.all([
    readJson(`reports/supply-gap-batch-01-basic-listening-decision-${date}.json`),
    readJson(`reports/supply-gap-batch-01-loop-qa-${date}.json`),
    readJson(`reports/supply-gap-batch-01-combination-qa-${date}.json`),
    readJson(`reports/supply-gap-batch-01-final-listening-decision-${date}.json`),
    readJson(`reports/supply-gap-batch-01-focus-machine-qa-${date}.json`),
  ]);

  if (basic.decision !== 'pass' || basic.basicListeningPassCount !== 13 || basic.noHumanVoicePassCount !== 13) {
    throw new Error('Supply Gap Batch 01 promotion blocked: basic listening or no-human-voice gate is incomplete.');
  }
  if (loop.eligibleLoopCandidateCount !== 12 || loop.loopMachinePassCount !== 12
    || loop.results?.length !== 12 || loop.results.some((item: any) => item.machineStatus !== 'pass')
    || !sameIds(loop.results.map((item: any) => item.id), expectedLoopIds)) {
    throw new Error('Supply Gap Batch 01 promotion blocked: loop machine QA is incomplete or has drifted.');
  }
  if (combination.combinationCount !== 12 || combination.machinePassCount !== 12
    || combination.results?.length !== 12 || combination.results.some((item: any) => item.machineStatus !== 'pass')
    || combination.collectionDiversity?.status !== 'pass'
    || combination.collectionDiversity?.nearDuplicatePairCount !== 0
    || Number(combination.collectionDiversity?.maxSpectralCorrelation) >= Number(combination.collectionDiversity?.threshold)
    || !sameIds(combination.results.map((item: any) => item.id), expectedCombinationIds)) {
    throw new Error('Supply Gap Batch 01 promotion blocked: combination or diversity machine QA is incomplete.');
  }
  if (focusMachine.candidateCount !== 4 || focusMachine.machinePassCount !== 4
    || focusMachine.results?.some((item: any) => item.machineStatus !== 'pass')) {
    throw new Error('Supply Gap Batch 01 promotion blocked: focus source machine QA is incomplete.');
  }
  if (finalDecision.decision !== 'pass' || finalDecision.promotionAllowed !== true
    || finalDecision.loopListeningPassCount !== 12 || finalDecision.combinationListeningPassCount !== 12
    || finalDecision.noHumanVoicePassCount !== 12
    || !sameIds(finalDecision.loopDecisions, expectedLoopIds)
    || !sameIds(finalDecision.combinationDecisions, expectedCombinationIds)) {
    throw new Error('Supply Gap Batch 01 promotion blocked: final human listening decision is incomplete.');
  }
  const ceilingFan = loop.excluded?.find((item: any) => item.id === 'fan_ceiling_roomtone');
  const finalCeilingFan = finalDecision.excluded?.find((item: any) => item.id === 'fan_ceiling_roomtone');
  if (!ceilingFan?.failures?.includes('sudden_rms_jump') || !finalCeilingFan) {
    throw new Error('Supply Gap Batch 01 promotion blocked: ceiling-fan technical exclusion is not explicit.');
  }

  await requireFiles([
    'docs/asset-batch-09-authentic-indoor-candidates.tsv',
    'docs/license-snapshots/batch-09/cc0-1.0.license.html',
    'docs/license-snapshots/batch-09/cc-by-4.0.license.html',
    ...expectedLoopIds.slice(0, 8).map((id) => `docs/license-snapshots/batch-09/${id}.source.html`),
    'docs/supply-gap-batch-01-focus-2026-07-15.json',
    'scripts/generate-procedural-foundation-pads.py',
    ...expectedLoopIds.map((id) => loop.results.find((item: any) => item.id === id)?.sourcePath)
      .filter(Boolean)
      .map((filePath: string) => path.relative(root, filePath)),
  ]);

  await seedDatabase();

  const resolvedConcepts = [
    ['source.domestic.room_tone', 'stem_batch09_room_apartment_small'],
    ['source.domestic.fan', 'stem_batch09_fan_deep_ventilation'],
    ['source.vehicle.rail.carriage', 'stem_batch09_train_taiwan_ep727'],
    ['source.domestic.air_conditioner', 'stem_batch09_air_conditioner_hum_1'],
    ['source.music.pad', 'stem_local_procedural_focus_neutral_clean'],
  ] as const;
  for (const [conceptId, stemId] of resolvedConcepts) {
    await query(
      `update supply_gaps set status = 'resolved', resolved_stem_id = $2, updated_at = now()
       where concept_id = $1 and status in ('open', 'planned', 'sourcing')`,
      [conceptId, stemId],
    );
  }

  const promoted = await query(
    `select s.id, s.name, s.category, s.qa_status, s.audio_url, s.commercial_use_allowed,
       s.derivative_use_allowed, s.raw_redistribution_allowed, s.file_sha256,
       f.duration_seconds, m.metadata_version, m.review
     from audio_stems s
     join stem_acoustic_features f on f.stem_id = s.id
     join stem_metadata_v3 m on m.stem_id = s.id and m.metadata_version = 3
     where s.id = any($1) order by s.category, s.name`,
    [[...promotedIds]],
  );
  if (promoted.rows.length !== promotedIds.length
    || promoted.rows.some((row: any) => row.qa_status !== 'approved'
      || row.commercial_use_allowed !== true || row.derivative_use_allowed !== true
      || row.raw_redistribution_allowed !== false || !row.file_sha256)) {
    throw new Error(`Supply Gap Batch 01 promotion verification failed: ${JSON.stringify(promoted.rows)}`);
  }

  const inventory = await query(
    `select category, count(*)::int as count from audio_stems
     where qa_status = 'approved' and commercial_use_allowed is true and derivative_use_allowed is true
     group by category order by category`,
  );
  const report = {
    promotedAt: new Date().toISOString(),
    batchId: 'supply_gap_batch_01',
    promoted: promoted.rows,
    excluded: finalDecision.excluded,
    resolvedConcepts: resolvedConcepts.map(([conceptId, stemId]) => ({ conceptId, stemId })),
    strictUsableInventory: inventory.rows,
    strictUsableTotal: inventory.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
  };
  await writeFile(path.join(root, `reports/supply-gap-batch-01-promotion-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, `reports/supply-gap-batch-01-promotion-${date}.md`),
    `# Supply Gap Batch 01 Promotion\n\nDate: ${date}  \nStatus: **passed**.\n\nPromoted: 12 atomic assets (8 authentic indoor/environment recordings and 4 deterministic focus-music pads).\n\nExplicitly excluded: \`fan_ceiling_roomtone\` because machine QA detected \`sudden_rms_jump\`.\n\nStrict usable inventory after promotion: ${report.strictUsableTotal}.\n`);
  console.log(JSON.stringify(report, null, 2));
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
