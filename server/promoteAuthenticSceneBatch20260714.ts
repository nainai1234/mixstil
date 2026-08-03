import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedDatabase } from './seed';
import { pool, query } from './db';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-14';

const run = async () => {
  const loopReport = JSON.parse(await readFile(path.join(root, `reports/authentic-scene-loop-qa-${date}.json`), 'utf8'));
  const combinationReport = JSON.parse(await readFile(path.join(root, `reports/authentic-scene-combination-qa-${date}.json`), 'utf8'));
  if (loopReport.loopMachinePassCount !== 6 || loopReport.loopListeningPassCount !== 6) {
    throw new Error('Authentic scene promotion blocked: loop QA is incomplete.');
  }
  if (combinationReport.machinePassCount !== 6 || combinationReport.humanListeningPassCount !== 6
    || combinationReport.collectionDiversity?.status !== 'pass' || combinationReport.promotionAllowed !== true) {
    throw new Error('Authentic scene promotion blocked: combination or collection QA is incomplete.');
  }

  await seedDatabase();
  const resolutions = [
    ['source.natural.wind', 'stem_mixkit_2658'],
    ['source.natural.fire', 'stem_mixkit_1736'],
    ['source.natural.forest', 'stem_mixkit_1213'],
    ['source.animal.insect', 'stem_mixkit_2414'],
    ['source.animal.insect.cricket', 'stem_mixkit_2475'],
  ] as const;
  for (const [conceptId, stemId] of resolutions) {
    await query(
      `update supply_gaps set status = 'resolved', resolved_stem_id = $2, updated_at = now()
       where concept_id = $1 and status = 'open'`,
      [conceptId, stemId],
    );
  }
  const promotedIds = [
    'stem_mixkit_1213', 'stem_mixkit_1736', 'stem_mixkit_2414',
    'stem_mixkit_2475', 'stem_mixkit_2658', 'stem_commons_pine_forest_wind',
  ];
  const promoted = await query(
    `select s.id, s.name, s.qa_status, s.audio_url, s.attribution_required, m.review
     from audio_stems s join stem_metadata_v3 m on m.stem_id = s.id and m.metadata_version = 3
     where s.id = any($1) order by s.id`,
    [promotedIds],
  );
  if (promoted.rows.length !== promotedIds.length || promoted.rows.some((row: any) => row.qa_status !== 'approved')) {
    throw new Error(`Authentic scene promotion verification failed: ${JSON.stringify(promoted.rows)}`);
  }
  const remainingGaps = await query(
    `select concept_id, sum(request_count)::int as request_count from supply_gaps
     where status = 'open' group by concept_id order by request_count desc, concept_id`,
  );
  const report = { promotedAt: new Date().toISOString(), promoted: promoted.rows, resolvedConcepts: resolutions.map(([conceptId]) => conceptId), remainingOpenGaps: remainingGaps.rows };
  await writeFile(path.join(root, `reports/authentic-scene-promotion-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(root, `reports/authentic-scene-promotion-${date}.md`), `# Authentic Scene Promotion\n\nDate: ${date}  \nStatus: **passed**. Six authentic sources passed semantic, license, loop, combination, and collection listening gates and are now approved, matchable V3 assets.\n\nPromoted: ${promoted.rows.map((row: any) => `\`${row.id}\``).join(', ')}.\n\nResolved concepts: ${resolutions.map(([conceptId]) => `\`${conceptId}\``).join(', ')}.\n\nStill intentionally unresolved: authentic train carriage, fan, room tone, and other indoor appliance recordings.\n`);
  console.log(JSON.stringify(report, null, 2));
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
