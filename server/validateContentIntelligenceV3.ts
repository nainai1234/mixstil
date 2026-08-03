import { coreStemIds } from './contentCatalog';
import { audioConcepts, AUDIO_ONTOLOGY_VERSION, coreStemMetadataV3, matchableStemMetadataV3, STEM_METADATA_VERSION } from './audioKnowledgeV3';
import { audioIntentGoldCases, AUDIO_INTENT_GOLD_SET_VERSION } from './audioIntentGoldSetV3';
import { pool, query } from './db';

const fail = (message: string): never => { throw new Error(`Content intelligence V3 validation failed: ${message}`); };
const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) fail(`${label} contains duplicates.`); };

unique([...coreStemIds], 'coreStemIds');
unique(coreStemMetadataV3.map((item) => item.stemId), 'coreStemMetadataV3');
unique(matchableStemMetadataV3.map((item) => item.stemId), 'matchableStemMetadataV3');
if (coreStemMetadataV3.length !== coreStemIds.length) fail(`expected metadata for ${coreStemIds.length} core stems, received ${coreStemMetadataV3.length}.`);
const coreStemIdSet = new Set<string>(coreStemIds);
if (coreStemMetadataV3.some((item) => !coreStemIdSet.has(item.stemId))) fail('coreStemMetadataV3 contains an item outside coreStemIds.');
if (audioConcepts.length < 40) fail(`expected a meaningful ontology, received ${audioConcepts.length} concepts.`);
if (audioIntentGoldCases.length !== 210) fail(`expected 210 Gold Set cases, received ${audioIntentGoldCases.length}.`);
if (new Set(audioIntentGoldCases.map((item) => item.semanticGroup)).size !== 42) fail('Gold Set should contain 42 semantic groups.');

const conceptIds = new Set(audioConcepts.map((item) => item.id));
for (const item of matchableStemMetadataV3) {
  for (const conceptId of [...item.sourceConcepts, ...item.acousticConcepts, ...item.affectConcepts, ...item.risks.map((risk) => risk.riskId)]) {
    if (!conceptIds.has(conceptId)) fail(`${item.stemId} references unknown concept ${conceptId}.`);
  }
  if (!item.roles.length) fail(`${item.stemId} has no role.`);
  if (item.mix.recommendedGainDb[0] > item.mix.recommendedGainDb[1]) fail(`${item.stemId} has invalid gain range.`);
}
for (const item of audioIntentGoldCases) {
  const expected = item.expectedIntent as { include: string[]; exclude: string[] };
  for (const conceptId of [...expected.include, ...expected.exclude]) {
    if (!conceptIds.has(conceptId) && !conceptId.startsWith('role.')) fail(`${item.id} references unknown concept ${conceptId}.`);
  }
}

const run = async () => {
  const matchableStemIds = matchableStemMetadataV3.map((item) => item.stemId);
  const metadataRows = await query<{ count: string }>('select count(*)::text from stem_metadata_v3 where metadata_version = $1 and stem_id = any($2)', [STEM_METADATA_VERSION, matchableStemIds]);
  const conceptRows = await query<{ count: string }>('select count(*)::text from audio_concepts where ontology_version = $1 and active = true', [AUDIO_ONTOLOGY_VERSION]);
  const goldRows = await query<{ count: string; groups: string }>('select count(*)::text as count, count(distinct semantic_group)::text as groups from audio_intent_gold_cases where set_version = $1', [AUDIO_INTENT_GOLD_SET_VERSION]);
  const missingAudio = await query<{ id: string; audio_url: string }>(
    `select s.id, s.audio_url from audio_stems s
     left join stem_acoustic_features f on f.stem_id = s.id
     where s.id = any($1) and (f.stem_id is null or s.qa_status <> 'approved')`,
    [matchableStemIds],
  );
  const approvedWithoutMetadata = await query<{ id: string }>(
    `select s.id from audio_stems s
     left join stem_metadata_v3 m on m.stem_id = s.id and m.metadata_version = $1
     where s.qa_status = 'approved' and s.commercial_use_allowed and s.derivative_use_allowed and m.stem_id is null
     order by s.id`,
    [STEM_METADATA_VERSION],
  );
  if (Number(metadataRows.rows[0]?.count ?? 0) !== matchableStemIds.length) fail('database metadata rows do not cover all matchable stems.');
  if (Number(conceptRows.rows[0]?.count ?? 0) < audioConcepts.length) fail('database ontology is missing seeded concepts.');
  if (Number(goldRows.rows[0]?.count ?? 0) !== 210 || Number(goldRows.rows[0]?.groups ?? 0) !== 42) fail('database Gold Set is incomplete.');
  if (missingAudio.rows.length) fail(`matchable stems missing acoustic analysis or approval: ${missingAudio.rows.map((row) => row.id).join(', ')}`);
  if (approvedWithoutMetadata.rows.length) fail(`approved exportable stems missing V3 metadata: ${approvedWithoutMetadata.rows.map((row) => row.id).join(', ')}`);
  console.log(JSON.stringify({
    passed: true,
    ontologyVersion: AUDIO_ONTOLOGY_VERSION,
    conceptCount: Number(conceptRows.rows[0]?.count ?? 0),
    coreStemCount: coreStemIds.length,
    matchableStemCount: matchableStemIds.length,
    metadataCount: Number(metadataRows.rows[0]?.count ?? 0),
    goldCaseCount: Number(goldRows.rows[0]?.count ?? 0),
    semanticGroupCount: Number(goldRows.rows[0]?.groups ?? 0),
  }, null, 2));
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
