import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'soothing-harmonic-no-road-combination-v2';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const rejectionReportPath = path.join(root, 'reports/soothing-deterministic-combination-v1-owner-rejection.md');
const fail = (message: string): never => {
  throw new Error(`Soothing harmonic no-road combination validation failed: ${message}`);
};

const rejectionReport = await readFile(rejectionReportPath, 'utf8');
if (!rejectionReport.includes('cars on a highway')) fail('owner rejection report must capture highway feedback');
if (!rejectionReport.includes('Rejected by owner listening')) fail('prior batch must be explicitly rejected');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  batchId: string;
  status: string;
  replacesRejectedBatch: string;
  rejectionReasonAddressed: string;
  productionAllowed: boolean;
  candidateCount: number;
  machinePassCount: number;
  reviewUrl: string;
  hardExclusions: string[];
  combinations: Array<any>;
};

if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.status !== 'candidate_pending_owner_no_road_review') fail('status must remain owner no-road review');
if (manifest.replacesRejectedBatch !== 'soothing-deterministic-combination-v1') fail('replacement link changed');
if (!manifest.rejectionReasonAddressed.includes('highway')) fail('manifest must address highway rejection');
if (manifest.productionAllowed !== false) fail('production must remain blocked');
if (manifest.candidateCount !== 6 || manifest.combinations.length !== 6) fail('expected 6 combinations');
if (manifest.machinePassCount < 5) fail(`machine pass count too low: ${manifest.machinePassCount}`);
for (const exclusion of ['highway-like broadband wash', 'traffic rumble', 'rain/ocean/air noise foreground', 'drums', 'percussion', 'human voice']) {
  if (!manifest.hardExclusions.includes(exclusion)) fail(`missing hard exclusion ${exclusion}`);
}

const goals = new Set<string>();
const ids = new Set<string>();
for (const combo of manifest.combinations) {
  if (ids.has(combo.comboId)) fail(`${combo.comboId} duplicated`);
  ids.add(combo.comboId);
  goals.add(combo.goal);
  if (combo.source !== 'deterministic_harmonic_synthesis') fail(`${combo.comboId} must be harmonic deterministic synthesis`);
  if (combo.productionAllowed !== false) fail(`${combo.comboId} was auto-approved`);
  if (!combo.preparedAudioUrl?.startsWith(`/audio/music/local-review/${batchId}/prepared/`)) fail(`${combo.comboId} prepared URL invalid`);
  const audioFile = await stat(path.join(root, 'public', combo.preparedAudioUrl.slice(1))).catch(() => null);
  if (!audioFile || audioFile.size < 100_000) fail(`${combo.comboId} audio missing`);
  if (!combo.analysis) fail(`${combo.comboId} analysis missing`);
  if (combo.analysis.durationSeconds !== 90) fail(`${combo.comboId} must be 90 seconds`);
  if (combo.analysis.samplePeakDbfs > -6) fail(`${combo.comboId} peak unsafe`);
  if (combo.machineStatus === 'pass') {
    if (combo.analysis.spectralFlatnessMean > 0.12) fail(`${combo.comboId} is too broadband / road-like`);
    if (combo.analysis.onsetDensityPerSecond > 0.45) fail(`${combo.comboId} has too many note events`);
    if (combo.analysis.p99InteriorRmsJumpDb > 2.5) fail(`${combo.comboId} has large RMS jumps`);
    if (['sleep', 'calm'].includes(combo.goal) && combo.analysis.spectralCentroidHz > 1400) fail(`${combo.comboId} too bright for ${combo.goal}`);
  } else if (!Array.isArray(combo.failures) || combo.failures.length === 0) {
    fail(`${combo.comboId} failed without explicit failures`);
  }
}

for (const goal of ['sleep', 'calm', 'focus']) {
  if (!goals.has(goal)) fail(`missing ${goal} candidate`);
}

const review = await readFile(reviewPath, 'utf8');
if ((review.match(/<article>/g) ?? []).length !== 6) fail('review page must contain 6 cards');
if (!review.includes('还像不像车流')) fail('review page must ask road-like question');
if (!review.includes('上一批被判定像高速公路')) fail('review page must explain correction');

console.log(JSON.stringify({
  passed: true,
  batchId,
  replacesRejectedBatch: manifest.replacesRejectedBatch,
  candidateCount: manifest.candidateCount,
  machinePassCount: manifest.machinePassCount,
  goals: [...goals].sort(),
  reviewUrl: manifest.reviewUrl,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
