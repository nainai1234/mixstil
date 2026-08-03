import { readFileSync } from 'node:fs';
import { coreStemIds, defaultRecipes } from './contentCatalog';
import { matchableStemMetadataV3 } from './audioKnowledgeV3';
import { pool, query } from './db';

const rejectedSemanticSimulationStemIds = [
  'stem_internal_quiet_room',
  'stem_internal_fan_low',
  'stem_internal_fan_medium',
  'stem_internal_fan_high',
  'stem_internal_airplane_cabin',
  'stem_internal_train_carriage',
  'stem_internal_air_conditioner',
  'stem_internal_humidifier',
  'stem_internal_distant_highway',
  'stem_wind',
  'stem_fire',
];

const rejected = new Set(rejectedSemanticSimulationStemIds);
const fail = (message: string): never => { throw new Error(`Semantic asset truth validation failed: ${message}`); };

const generator = readFileSync(new URL('../scripts/generate-internal-noise.sh', import.meta.url), 'utf8');
for (const token of ['fan_low', 'train_carriage', 'quiet_room']) {
  const line = generator.split('\n').find((candidate) => candidate.includes(`generate ${token} `));
  if (!line?.includes('anoisesrc=')) fail(`${token} provenance is no longer auditable as anoisesrc.`);
}
if (coreStemIds.some((stemId) => rejected.has(stemId))) fail('a rejected semantic simulation returned to coreStemIds.');
if (defaultRecipes.some((recipe) => recipe.tracks.some((track) => rejected.has(track.stemId)))) fail('a default Recipe uses a rejected semantic simulation.');
if (matchableStemMetadataV3.some((metadata) => rejected.has(metadata.stemId))) fail('a rejected semantic simulation has matchable V3 metadata.');

const run = async () => {
  const result = await query<{ id: string; qa_status: string }>(
    'select id, qa_status from audio_stems where id = any($1) order by id',
    [rejectedSemanticSimulationStemIds],
  );
  const byId = new Map(result.rows.map((row) => [row.id, row.qa_status]));
  const notRejected = rejectedSemanticSimulationStemIds.filter((stemId) => byId.get(stemId) !== 'rejected');
  if (notRejected.length) fail(`database status is not rejected for: ${notRejected.join(', ')}`);
  const conceptRows = await query<{ stem_id: string }>('select distinct stem_id from stem_concepts where stem_id = any($1)', [rejectedSemanticSimulationStemIds]);
  if (conceptRows.rows.length) fail(`rejected simulations still have concepts: ${conceptRows.rows.map((row) => row.stem_id).join(', ')}`);
  console.log(JSON.stringify({
    passed: true,
    rejectedCount: rejectedSemanticSimulationStemIds.length,
    approvedColoredNoiseIds: ['stem_internal_white_soft', 'stem_internal_white_deep', 'stem_internal_pink_soft', 'stem_internal_pink_balanced', 'stem_internal_brown_soft', 'stem_internal_brown_deep'],
  }, null, 2));
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
