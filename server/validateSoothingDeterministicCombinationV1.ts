import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'soothing-deterministic-combination-v1';
const sourceBatch = 'soothing-deterministic-foundation-v1';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const sourceManifestPath = path.join(root, 'public/audio/music/local-review', sourceBatch, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => {
  throw new Error(`Soothing deterministic combination validation failed: ${message}`);
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  batchId: string;
  sourceBatch: string;
  status: string;
  productionAllowed: boolean;
  candidateCount: number;
  machinePassCount: number;
  reviewUrl: string;
  hardExclusions: string[];
  combinations: Array<any>;
};
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, 'utf8')) as {
  batchId: string;
  candidates: Array<any>;
};

if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.sourceBatch !== sourceBatch || sourceManifest.batchId !== sourceBatch) fail('source batch mismatch');
if (manifest.status !== 'candidate_pending_human_combination_review') fail('status must stay pending human review');
if (manifest.productionAllowed !== false) fail('combination batch cannot be production allowed');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('review URL changed');
if (manifest.candidateCount !== 6 || manifest.combinations.length !== 6) fail('expected 6 combinations');
if (manifest.machinePassCount < 5) fail(`machine pass count too low: ${manifest.machinePassCount}`);
for (const exclusion of ['drums', 'percussion', 'beat', 'rhythmic pulse', 'groove', 'human voice', 'medical claims']) {
  if (!manifest.hardExclusions.includes(exclusion)) fail(`missing hard exclusion ${exclusion}`);
}

const sourceById = new Map(sourceManifest.candidates.map((item) => [item.candidateId, item]));
const goals = new Set<string>();
const ids = new Set<string>();

for (const combo of manifest.combinations) {
  if (ids.has(combo.comboId)) fail(`${combo.comboId} duplicated`);
  ids.add(combo.comboId);
  goals.add(combo.goal);
  if (combo.productionAllowed !== false) fail(`${combo.comboId} was auto-approved`);
  if (!['sleep', 'calm', 'focus'].includes(combo.goal)) fail(`${combo.comboId} has unknown goal`);
  if (!Array.isArray(combo.layers) || combo.layers.length < 2 || combo.layers.length > 3) fail(`${combo.comboId} must use 2-3 layers`);
  for (const layer of combo.layers) {
    const source = sourceById.get(layer.candidateId);
    if (!source) fail(`${combo.comboId} uses unknown source ${layer.candidateId}`);
    if (source.machineStatus !== 'pass') fail(`${combo.comboId} uses failed source ${layer.candidateId}`);
  }
  if (!combo.preparedAudioUrl?.startsWith(`/audio/music/local-review/${batchId}/prepared/`)) fail(`${combo.comboId} prepared URL invalid`);
  const audioFile = await stat(path.join(root, 'public', combo.preparedAudioUrl.slice(1))).catch(() => null);
  if (!audioFile || audioFile.size < 100_000) fail(`${combo.comboId} prepared audio missing or too small`);
  if (!combo.analysis) fail(`${combo.comboId} analysis missing`);
  if (combo.analysis.durationSeconds !== 60) fail(`${combo.comboId} must be 60 seconds`);
  if (combo.analysis.samplePeakDbfs > -6) fail(`${combo.comboId} peak is unsafe`);
  if (combo.machineStatus === 'pass') {
    if (combo.analysis.macroEventDensityPerSecond > 0.35) fail(`${combo.comboId} macro event density too high`);
    if (combo.analysis.p99InteriorRmsJumpDb > 1.8) fail(`${combo.comboId} interior RMS jump too high`);
    if (['sleep', 'calm'].includes(combo.goal) && combo.analysis.spectralCentroidHz > 1600) fail(`${combo.comboId} too bright for ${combo.goal}`);
  } else if (!Array.isArray(combo.failures) || combo.failures.length === 0) {
    fail(`${combo.comboId} failed without explicit failures`);
  }
}

for (const goal of ['sleep', 'calm', 'focus']) {
  if (!goals.has(goal)) fail(`missing ${goal} combination`);
}

const review = await readFile(reviewPath, 'utf8');
if ((review.match(/<article>/g) ?? []).length !== 6) fail('review page must contain 6 cards');
if (!review.includes('Sleep / Calm / Focus')) fail('review page must expose goal coverage');
if (!review.includes('鼓点/脉冲感')) fail('review page must ask for pulse listening');

console.log(JSON.stringify({
  passed: true,
  batchId,
  sourceBatch,
  candidateCount: manifest.candidateCount,
  machinePassCount: manifest.machinePassCount,
  goals: [...goals].sort(),
  reviewUrl: manifest.reviewUrl,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
