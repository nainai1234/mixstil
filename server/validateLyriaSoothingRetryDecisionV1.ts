import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Lyria soothing retry decision validation failed: ${message}`);
};

const decisionPath = path.join(root, 'config/lyria-foundational-soothing-retry-v1-survivors.json');
const manifestPath = path.join(root, 'public/audio/music/local-review/lyria-foundational-soothing-retry-v1/manifest.json');
const reportPath = path.join(root, 'reports/lyria-foundational-soothing-retry-v1-decision.md');

const decision = JSON.parse(await readFile(decisionPath, 'utf8')) as {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  sourceManifest: string;
  survivors: Array<{
    candidateId: string;
    category: string;
    preparedAudioUrl: string;
    machineMetrics: { onsetDensityPerSecond: number; spectralCentroidHz: number; peakDbfs: number };
  }>;
  rejectedOrRetryOnlyPolicy: { count: number; allowedUse: string; nextSource: string };
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  batchId: string;
  productionAllowed: boolean;
  candidates: Array<any>;
};

if (decision.batchId !== 'lyria-foundational-soothing-retry-v1') fail('decision batch id changed');
if (decision.status !== 'machine_survivors_only_not_approved') fail('decision status must block approval');
if (decision.productionAllowed !== false) fail('decision cannot allow production');
if (decision.sourceManifest !== 'public/audio/music/local-review/lyria-foundational-soothing-retry-v1/manifest.json') fail('source manifest pointer changed');
if (manifest.batchId !== decision.batchId) fail('manifest batch id mismatch');
if (manifest.productionAllowed !== false) fail('manifest was promoted unexpectedly');
if (manifest.candidates.length !== 36) fail(`expected 36 generated candidates, got ${manifest.candidates.length}`);
if (decision.survivors.length !== 5) fail(`expected exactly 5 strict machine survivors, got ${decision.survivors.length}`);
if (decision.rejectedOrRetryOnlyPolicy.count !== 31) fail('rejected/retry-only count must be 31');
if (decision.rejectedOrRetryOnlyPolicy.allowedUse !== 'none_in_consumer_recipe') fail('rejected candidates must be blocked from consumer recipes');
if (decision.rejectedOrRetryOnlyPolicy.nextSource !== 'deterministic_synthesis_or_controlled_recording') fail('next source policy changed');

const thresholds: Record<string, { onset: number; centroid: number }> = {
  environment: { onset: 2.2, centroid: 1800 },
  texture: { onset: 2.0, centroid: 1500 },
  instrument: { onset: 1.2, centroid: 1200 },
  accent: { onset: 1.4, centroid: 1100 },
};

const candidatesById = new Map(manifest.candidates.map((candidate) => [candidate.candidateId, candidate]));
const survivorIds = new Set<string>();

for (const survivor of decision.survivors) {
  const candidate = candidatesById.get(survivor.candidateId);
  if (!candidate) fail(`${survivor.candidateId} is not in the source manifest`);
  if (survivorIds.has(survivor.candidateId)) fail(`${survivor.candidateId} appears twice`);
  survivorIds.add(survivor.candidateId);
  if (candidate.productionAllowed !== false) fail(`${survivor.candidateId} was auto-approved`);
  if (candidate.category !== survivor.category) fail(`${survivor.candidateId} category mismatch`);
  if (candidate.preparedAudioUrl !== survivor.preparedAudioUrl) fail(`${survivor.candidateId} prepared URL mismatch`);
  const threshold = thresholds[survivor.category];
  if (!threshold) fail(`${survivor.candidateId} has unknown category ${survivor.category}`);
  if (survivor.machineMetrics.onsetDensityPerSecond > threshold.onset) fail(`${survivor.candidateId} exceeds survivor onset threshold`);
  if (survivor.machineMetrics.spectralCentroidHz > threshold.centroid) fail(`${survivor.candidateId} exceeds survivor centroid threshold`);
  const preparedFile = path.join(root, 'public', survivor.preparedAudioUrl.slice(1));
  const file = await stat(preparedFile).catch(() => null);
  if (!file || file.size < 10_000) fail(`${survivor.candidateId} prepared audio missing`);
}

const computedStrictSurvivors = manifest.candidates.filter((candidate) => {
  const threshold = thresholds[candidate.category];
  const analysis = candidate.preparedAnalysis;
  return threshold
    && analysis
    && analysis.onsetDensityPerSecond <= threshold.onset
    && analysis.spectralCentroidHz <= threshold.centroid;
});

if (computedStrictSurvivors.length !== decision.survivors.length) {
  fail(`decision survivor count ${decision.survivors.length} does not match computed strict survivors ${computedStrictSurvivors.length}`);
}
for (const candidate of computedStrictSurvivors) {
  if (!survivorIds.has(candidate.candidateId)) fail(`${candidate.candidateId} is a computed survivor but missing from decision config`);
}

const report = await readFile(reportPath, 'utf8');
if (!report.includes('Rejected as a batch; 5 machine survivors only')) fail('decision report does not state the batch rejection');
if (!report.includes('Lyria is no longer the default source for environment beds or abstract textures')) fail('decision report does not capture source-routing correction');

console.log(JSON.stringify({
  passed: true,
  batchId: decision.batchId,
  generatedCandidates: manifest.candidates.length,
  strictMachineSurvivors: decision.survivors.length,
  rejectedOrRetryOnly: decision.rejectedOrRetryOnlyPolicy.count,
  productionAllowed: decision.productionAllowed,
}, null, 2));
