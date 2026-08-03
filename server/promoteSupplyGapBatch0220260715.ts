import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedDatabase } from './seed';
import { pool, query } from './db';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';

const sourceIds = [
  'aircraft_cabin_csnmedia_381174',
  'airbus_a330_cabin_fillsoko_456092',
  'train_taiwan_all_night_variant',
] as const;

const combinationIds = [
  'aircraft_steady_jet_soft_pink',
  'airbus_a330_soft_pink',
  'train_all_night_soft_brown',
] as const;

const promotedStemIds = [
  'stem_supply_gap_02_aircraft_cabin_csnmedia_381174',
  'stem_supply_gap_02_airbus_a330_cabin_fillsoko_456092',
  'stem_supply_gap_02_train_taiwan_all_night_variant',
] as const;

const stemIdBySourceId: Record<(typeof sourceIds)[number], (typeof promotedStemIds)[number]> = {
  aircraft_cabin_csnmedia_381174: 'stem_supply_gap_02_aircraft_cabin_csnmedia_381174',
  airbus_a330_cabin_fillsoko_456092: 'stem_supply_gap_02_airbus_a330_cabin_fillsoko_456092',
  train_taiwan_all_night_variant: 'stem_supply_gap_02_train_taiwan_all_night_variant',
};

const failedSourceIds = ['atr_cabin_stanestane_834221', 'turboplane_cabin_trp_573143'] as const;

const readJson = async (relativePath: string) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
const sameIds = (actual: unknown, expected: readonly string[]) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every((id) => actual.includes(id));

const sha256 = async (relativePath: string) => createHash('sha256')
  .update(await readFile(path.join(root, relativePath)))
  .digest('hex');

const requireFiles = async (relativePaths: string[]) => {
  for (const relativePath of relativePaths) await access(path.join(root, relativePath));
};

const run = async () => {
  const [source, loop, combination, finalDecision] = await Promise.all([
    readJson(`reports/supply-gap-batch-02-source-review-${date}.json`),
    readJson(`reports/supply-gap-batch-02-loop-qa-${date}.json`),
    readJson(`reports/supply-gap-batch-02-combination-qa-${date}.json`),
    readJson(`reports/supply-gap-batch-02-final-listening-decision-${date}.json`),
  ]);

  const eligibleSources = source.results?.filter((item: any) => sourceIds.includes(item.id));
  if (source.candidateCount !== 5 || source.machinePassCount !== 3
    || eligibleSources?.length !== 3 || eligibleSources.some((item: any) => item.machineStatus !== 'pass')
    || !sameIds(eligibleSources.map((item: any) => item.id), sourceIds)) {
    throw new Error('Supply Gap Batch 02 promotion blocked: source machine QA is incomplete or has drifted.');
  }
  for (const failedId of failedSourceIds) {
    const failed = source.results?.find((item: any) => item.id === failedId);
    if (failed?.machineStatus !== 'fail' || !failed.failures?.includes('sudden_rms_jump')) {
      throw new Error(`Supply Gap Batch 02 promotion blocked: ${failedId} is not explicitly excluded by sudden_rms_jump.`);
    }
  }
  if (loop.eligibleLoopCandidateCount !== 3 || loop.loopMachinePassCount !== 3
    || loop.results?.length !== 3 || loop.results.some((item: any) => item.machineStatus !== 'pass')
    || loop.results.some((item: any) => Number(item.seams?.digitalSilence100msFrames) !== 0)
    || !sameIds(loop.results.map((item: any) => item.id), sourceIds)) {
    throw new Error('Supply Gap Batch 02 promotion blocked: loop machine QA is incomplete or has drifted.');
  }
  if (combination.combinationCount !== 3 || combination.machinePassCount !== 3
    || combination.results?.length !== 3 || combination.results.some((item: any) => item.machineStatus !== 'pass')
    || combination.results.some((item: any) => Number(item.dropoutAnalysis?.digitalSilence100msFrames) !== 0)
    || !sameIds(combination.results.map((item: any) => item.id), combinationIds)) {
    throw new Error('Supply Gap Batch 02 promotion blocked: Recipe V2 combination QA is incomplete or has drifted.');
  }
  if (finalDecision.decision !== 'pass' || finalDecision.promotionAllowed !== true
    || finalDecision.sourceListeningPassCount !== 3
    || finalDecision.sourceSemanticIdentityPassCount !== 3
    || finalDecision.sourceNoHumanVoicePassCount !== 3
    || finalDecision.sourceLowStimulationPassCount !== 3
    || finalDecision.loopListeningPassCount !== 3
    || finalDecision.combinationListeningPassCount !== 3
    || !sameIds(finalDecision.sourceDecisions, sourceIds)
    || !sameIds(finalDecision.loopDecisions, sourceIds)
    || !sameIds(finalDecision.combinationDecisions, combinationIds)
    || !sameIds(finalDecision.excluded?.map((item: any) => item.id), failedSourceIds)) {
    throw new Error('Supply Gap Batch 02 promotion blocked: final human listening decision is incomplete.');
  }

  const normalizedPaths = sourceIds.map((id) => `public/audio/supply-gap-batch-02/review/${date}/${id}.mp3`);
  await requireFiles([
    'docs/license-snapshots/supply-gap-batch-02/cc0-1.0.license.html',
    'docs/license-snapshots/supply-gap-batch-02/freesound-381174.source.html',
    'docs/license-snapshots/supply-gap-batch-02/freesound-456092.source.html',
    'docs/license-snapshots/batch-09/train_taiwan_ep727.source.html',
    ...normalizedPaths,
    ...loop.results.map((item: any) => item.loopMasterPath),
    ...combination.results.map((item: any) => path.join('public', item.previewUrl)),
  ]);

  const expectedNormalizedHashes = new Map([
    ['aircraft_cabin_csnmedia_381174', 'bf833f605bec07e8e20d8f7b477c2cd5ffbaf0bcd1447184395d3ddc80977a61'],
    ['airbus_a330_cabin_fillsoko_456092', '3068f4fb4c87a9435f5ede014680efda78566708ccb42dde734239e536fdbabb'],
    ['train_taiwan_all_night_variant', '21af53d1323cbc9f3bf3db5da59968f02d50ae7a3ba62a32d34c06dc8c6a6d4e'],
  ]);
  for (const id of sourceIds) {
    const actual = await sha256(`public/audio/supply-gap-batch-02/review/${date}/${id}.mp3`);
    if (actual !== expectedNormalizedHashes.get(id)) {
      throw new Error(`Supply Gap Batch 02 promotion blocked: normalized file hash drifted for ${id}.`);
    }
  }

  await seedDatabase();

  const resolvedConcepts = [
    ['source.vehicle.aircraft.cabin', 'stem_supply_gap_02_airbus_a330_cabin_fillsoko_456092'],
    ['source.vehicle.rail.carriage', 'stem_supply_gap_02_train_taiwan_all_night_variant'],
  ] as const;
  for (const [conceptId, stemId] of resolvedConcepts) {
    await query(
      `update supply_gaps set status = 'resolved', resolved_stem_id = $2, updated_at = now()
       where concept_id = $1 and status in ('open', 'planned', 'sourcing')`,
      [conceptId, stemId],
    );
  }

  const promoted = await query(
    `select s.id, s.name, s.category, s.qa_status, s.audio_url, s.source_url,
       s.license_name, s.commercial_use_allowed, s.derivative_use_allowed,
       s.raw_redistribution_allowed, s.file_sha256, f.duration_seconds,
       f.integrated_lufs, f.true_peak_db, m.metadata_version, m.review
     from audio_stems s
     join stem_acoustic_features f on f.stem_id = s.id
     join stem_metadata_v3 m on m.stem_id = s.id and m.metadata_version = 3
     where s.id = any($1) order by s.name`,
    [[...promotedStemIds]],
  );
  if (promoted.rows.length !== promotedStemIds.length
    || promoted.rows.some((row: any) => row.qa_status !== 'approved'
      || row.commercial_use_allowed !== true || row.derivative_use_allowed !== true
      || row.raw_redistribution_allowed !== false || !row.file_sha256)) {
    throw new Error(`Supply Gap Batch 02 promotion verification failed: ${JSON.stringify(promoted.rows)}`);
  }

  const recipeV2Coverage = combination.results.map((item: any) => ({
    id: item.id,
    title: item.title,
    scene: item.scene,
    machineStatus: item.machineStatus,
    humanListeningStatus: 'pass',
    recipe: {
      ...item.recipe,
      moodTags: item.recipe.moodTags.map((tag: string) => tag === 'Internal QA' ? 'Listening Approved' : tag),
      tracks: item.recipe.tracks.map((track: any) => ({
        ...track,
        stemId: track.stemId.startsWith('candidate_')
          ? stemIdBySourceId[track.stemId.slice('candidate_'.length) as (typeof sourceIds)[number]]
          : track.stemId,
      })),
    },
  }));
  if (recipeV2Coverage.some((item: any) => item.recipe.tracks.some((track: any) => track.stemId?.startsWith('candidate_')))) {
    throw new Error('Supply Gap Batch 02 promotion blocked: an approved Recipe V2 definition still references a candidate stem.');
  }

  const inventory = await query(
    `select category, count(*)::int as count from audio_stems
     where qa_status = 'approved' and commercial_use_allowed is true and derivative_use_allowed is true
     group by category order by category`,
  );
  const report = {
    promotedAt: new Date().toISOString(),
    batchId: 'supply_gap_batch_02',
    promoted: promoted.rows,
    sourceEvidence: eligibleSources.map((item: any) => ({
      id: item.id,
      sourceUrl: item.sourceUrl,
      sourceCreator: item.sourceCreator,
      licenseName: item.licenseName,
      sourceSha256: item.sourceSha256,
      normalizedFileSha256: expectedNormalizedHashes.get(item.id),
    })),
    humanDecision: finalDecision,
    machineQa: {
      sourcePassCount: source.machinePassCount,
      loopPassCount: loop.loopMachinePassCount,
      combinationPassCount: combination.machinePassCount,
      loopDigitalDropoutFrames: loop.results.reduce((sum: number, item: any) => sum + Number(item.seams.digitalSilence100msFrames), 0),
      combinationDigitalDropoutFrames: combination.results.reduce((sum: number, item: any) => sum + Number(item.dropoutAnalysis.digitalSilence100msFrames), 0),
    },
    approvedRecipeV2Coverage: recipeV2Coverage,
    excluded: finalDecision.excluded,
    sourceScreenRejected: source.rejectedAtSourceScreen,
    resolvedConcepts: resolvedConcepts.map(([conceptId, stemId]) => ({ conceptId, stemId })),
    strictUsableInventory: inventory.rows,
    strictUsableTotal: inventory.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0),
  };
  await writeFile(path.join(root, `reports/supply-gap-batch-02-promotion-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, `reports/supply-gap-batch-02-promotion-${date}.md`),
    `# Supply Gap Batch 02 Promotion

Date: ${date}  
Status: **passed**.

Promoted: 3 atomic assets (2 authentic aircraft-cabin recordings and 1 processed low-stimulation rail-car variant).

Approved listening evidence: 3 source previews, 3 ten-minute loops, and 3 Recipe V2 combinations.

Explicitly excluded: \`${failedSourceIds[0]}\` and \`${failedSourceIds[1]}\` because machine QA detected \`sudden_rms_jump\`.

Strict usable inventory after promotion: ${report.strictUsableTotal}.
`);
  console.log(JSON.stringify(report, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
