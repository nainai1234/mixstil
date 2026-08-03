import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type FamilyCoverage = {
  familyId: string;
  configured: number;
  candidate: number;
  machinePassed: number;
  formalUsable: number;
  minTarget: number;
  configuredMeetsTarget: boolean;
  candidateMeetsTarget: boolean;
  status: string;
  nextAction: string;
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  purpose: string;
  scopeRules: string[];
  counts: {
    atomicAudioElements: number;
    atomicSymbolicElements: number;
    soothingDeterministicAudioCandidates: number;
    soothingDeterministicMachinePass: number;
    deterministicDspConfigs: number;
    consolidatedReviewItems: number;
  };
  familyCoverage: FamilyCoverage[];
  reviewSources: Record<string, string>;
};

const root = process.cwd();
const batchId = 'foundational-material-complete-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational material complete v1 validation failed: ${message}`);
};

const manifestPath = path.join(root, 'public/review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const reportPath = path.join(root, 'reports/foundational-material-complete-v1.md');
const jsonReportPath = path.join(root, 'reports/foundational-material-complete-v1.json');

for (const file of [manifestPath, reviewPath, reportPath, jsonReportPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const reportJson = JSON.parse(readFileSync(jsonReportPath, 'utf8')) as Manifest;

if (manifest.schemaVersion !== '1.0.0') fail(`unexpected schema ${manifest.schemaVersion}`);
if (manifest.batchId !== batchId) fail(`unexpected batch ${manifest.batchId}`);
if (manifest.status !== 'complete_candidate_inventory_pending_human_review') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed !== false) fail('productionAllowed must remain false');
if (manifest.formalUsablePromotionAllowed !== false) fail('formal usable promotion must remain blocked');
if (JSON.stringify(manifest.counts) !== JSON.stringify(reportJson.counts)) fail('report json counts drift from manifest counts');

if (!manifest.purpose.includes('foundational material inventory')) fail('purpose must describe foundational material inventory');
for (const requiredRule of [
  'Finished content and router proof renders are not counted as foundational material.',
  'Machine pass is not human pass.',
  'No voice, no drums for Sleep/Calm defaults, and no medical or healing claims.',
]) {
  if (!manifest.scopeRules.includes(requiredRule)) fail(`missing scope rule: ${requiredRule}`);
}

if (manifest.counts.atomicAudioElements !== 27) fail(`expected 27 atomic audio elements, got ${manifest.counts.atomicAudioElements}`);
if (manifest.counts.atomicSymbolicElements !== 50) fail(`expected 50 atomic symbolic elements, got ${manifest.counts.atomicSymbolicElements}`);
if (manifest.counts.soothingDeterministicAudioCandidates !== 18) {
  fail(`expected 18 soothing deterministic candidates, got ${manifest.counts.soothingDeterministicAudioCandidates}`);
}
if (manifest.counts.soothingDeterministicMachinePass < 16) fail('soothing deterministic machine pass count too low');
if (manifest.counts.deterministicDspConfigs !== 8) fail(`expected 8 DSP configs, got ${manifest.counts.deterministicDspConfigs}`);
if (manifest.counts.consolidatedReviewItems !== 103) fail(`expected 103 consolidated review items, got ${manifest.counts.consolidatedReviewItems}`);

const expectedFamilies = [
  'playable_instrument_sources',
  'structured_composition_material',
  'music_beds_and_phrases',
  'environment_identity_beds',
  'masking_and_noise_support',
  'organic_textures',
  'accent_and_transition_events',
  'precise_dsp_configs',
];
const familyIds = manifest.familyCoverage.map((row) => row.familyId);
for (const familyId of expectedFamilies) {
  if (!familyIds.includes(familyId)) fail(`missing family ${familyId}`);
}
if (familyIds.includes('finished_reference_and_seed_content')) fail('finished seed content must not be counted as foundational coverage');

for (const row of manifest.familyCoverage) {
  if (!expectedFamilies.includes(row.familyId)) fail(`unexpected family ${row.familyId}`);
  if (row.configured < row.minTarget) fail(`${row.familyId} configured coverage below target: ${row.configured}/${row.minTarget}`);
  if (row.candidate < row.minTarget) fail(`${row.familyId} candidate coverage below target: ${row.candidate}/${row.minTarget}`);
  if (!row.configuredMeetsTarget) fail(`${row.familyId} configuredMeetsTarget false`);
  if (!row.candidateMeetsTarget) fail(`${row.familyId} candidateMeetsTarget false`);
  if (!row.nextAction) fail(`${row.familyId} missing next action`);
}

const masking = manifest.familyCoverage.find((row) => row.familyId === 'masking_and_noise_support');
if (!masking) fail('masking family missing');
if (masking.formalUsable < 6) fail(`masking/noise formal usable support should be filled by 6 DSP noise configs, got ${masking.formalUsable}`);

const review = readFileSync(reviewPath, 'utf8');
if (!review.includes('不是正式发布页，也不把成品曲或组合证明算作基础素材')) {
  fail('review page must explicitly reject finished/combination-as-foundation framing');
}
if (review.includes('soothing-deterministic-combination-v1/prepared')) fail('rejected combination batch must not appear in review page');
if (review.includes('atomic-composer-router-proof-v1/prepared')) fail('router proof renders must not be counted in review page');
if ((review.match(/<audio /g) ?? []).length !== 45) fail('review page must expose 45 audio review controls');
if ((review.match(/technical_reference_tone|technical_stereo_tone|masking_bed|low_masking_bed|dark_air_masking_support|low_distraction_masking_support/g) ?? []).length < 8) {
  fail('review page must list all 8 DSP configs');
}

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('Configured and candidate coverage now meets the internal target')) fail('report missing candidate/configured completion verdict');
if (!report.includes('not public production approval')) fail('report must keep production boundary honest');

console.log(JSON.stringify({
  passed: true,
  batchId: manifest.batchId,
  status: manifest.status,
  counts: manifest.counts,
  familyCount: manifest.familyCoverage.length,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
