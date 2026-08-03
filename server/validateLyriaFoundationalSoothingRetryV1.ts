import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'lyria-foundational-soothing-retry-v1';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => { throw new Error(`Lyria foundational soothing retry validation failed: ${message}`); };

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  batchId: string;
  provider: string;
  model: string;
  productionAllowed: boolean;
  expectedFamilyCount: number;
  expectedVariantsPerFamily: number;
  expectedCandidateCount: number;
  completedCandidateCount: number;
  analysisVersion?: string;
  analysisStatus?: string;
  preparationVersion?: string;
  candidates: Array<any>;
};

if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.provider !== 'google-cloud-vertex-ai' || manifest.model !== 'lyria-3-clip-preview') fail('provider/model lineage changed');
if (manifest.productionAllowed !== false) fail('candidate manifest was promoted automatically');
if (manifest.expectedFamilyCount !== 12 || manifest.expectedVariantsPerFamily !== 3 || manifest.expectedCandidateCount !== 36) fail('soothing retry target changed');
if (manifest.completedCandidateCount !== 36 || manifest.candidates.length !== 36) fail(`expected 36 candidates, got ${manifest.candidates.length}`);
if (manifest.analysisVersion !== 'foundational-expansion-acoustic-v1' || manifest.analysisStatus !== 'candidate_pending_human_identity_and_voice_review') fail('acoustic analysis is incomplete');
if (manifest.preparationVersion !== 'foundational-expansion-preparation-v1') fail('production preparation is incomplete');

const thresholds: Record<string, { onset: number; centroid: number }> = {
  environment: { onset: 2.2, centroid: 1800 },
  texture: { onset: 2.0, centroid: 1500 },
  instrument: { onset: 1.2, centroid: 1200 },
  accent: { onset: 1.4, centroid: 1100 },
};
const hardExclusions = ['no drums', 'no percussion', 'no beat', 'no rhythmic pulse', 'no groove', 'no kick', 'no snare', 'no hi-hat', 'no tabla'];
const counts = new Map<string, number>();
const categoryCounts = new Map<string, number>();
const softFailures: Array<{ candidateId: string; reason: string }> = [];

for (const candidate of manifest.candidates) {
  counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
  categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1);
  if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} was auto-approved`);
  if (candidate.provider !== 'google-cloud-vertex-ai') fail(`${candidate.candidateId} provider lineage missing`);
  const prompt = String(candidate.prompt ?? '').toLowerCase();
  for (const exclusion of hardExclusions) if (!prompt.includes(exclusion)) fail(`${candidate.candidateId} prompt missing ${exclusion}`);
  if (!prompt.includes('intensity 0.5/10')) fail(`${candidate.candidateId} prompt is not pinned to low intensity`);
  if (!/low brightness|dark|warm/.test(prompt)) fail(`${candidate.candidateId} prompt lacks low-brightness/dark/warm direction`);
  const rawPath = path.join(root, 'public', String(candidate.audioUrl).replace(/^\//, ''));
  const rawFile = await stat(rawPath).catch(() => null);
  if (!rawFile || rawFile.size < 100_000) fail(`${candidate.candidateId} raw audio missing or too small`);
  if (!candidate.preparedAudioUrl?.startsWith(`/audio/music/local-review/${batchId}/prepared/`)) fail(`${candidate.candidateId} prepared audio path missing`);
  const preparedPath = path.join(root, 'public', candidate.preparedAudioUrl.slice(1));
  const preparedFile = await stat(preparedPath).catch(() => null);
  if (!preparedFile || preparedFile.size < 10_000) fail(`${candidate.candidateId} prepared file missing or too small`);
  if (!candidate.preparedAnalysis) fail(`${candidate.candidateId} prepared analysis missing`);
  if (candidate.preparedAnalysis.peakDbfs > -3.5) fail(`${candidate.candidateId} prepared peak is unsafe`);
  if (candidate.preparedAnalysis.humanIdentityStatus !== 'pending' || candidate.preparedAnalysis.humanVoiceStatus !== 'pending') fail(`${candidate.candidateId} human gates were bypassed`);
  const threshold = thresholds[candidate.category];
  if (!threshold) fail(`${candidate.candidateId} unknown category ${candidate.category}`);
  if (candidate.preparedAnalysis.onsetDensityPerSecond > threshold.onset) {
    softFailures.push({ candidateId: candidate.candidateId, reason: `onset ${candidate.preparedAnalysis.onsetDensityPerSecond} > ${threshold.onset}` });
  }
  if (candidate.preparedAnalysis.spectralCentroidHz > threshold.centroid) {
    softFailures.push({ candidateId: candidate.candidateId, reason: `centroid ${candidate.preparedAnalysis.spectralCentroidHz} > ${threshold.centroid}` });
  }
}

if ([...counts.values()].some((count) => count !== 3)) fail('a family does not have exactly three variants');
if (categoryCounts.get('environment') !== 15 || categoryCounts.get('texture') !== 12 || categoryCounts.get('instrument') !== 6 || categoryCounts.get('accent') !== 3) {
  fail(`category counts are ${JSON.stringify(Object.fromEntries(categoryCounts))}`);
}
const passRate = (manifest.candidates.length - new Set(softFailures.map((item) => item.candidateId)).size) / manifest.candidates.length;
if (passRate < 0.55) fail(`low-arousal machine pass rate too low: ${Math.round(passRate * 100)}% (${JSON.stringify(softFailures.slice(0, 8))})`);

const reviewHtml = await readFile(reviewPath, 'utf8');
if ((reviewHtml.match(/<article>/g) ?? []).length !== 36) fail('review page does not contain 36 candidate cards');
if ((reviewHtml.match(/<audio controls/g) ?? []).length !== 72) fail('review page must expose prepared and raw audio for every candidate');

console.log(JSON.stringify({
  passed: true,
  batchId,
  candidateCount: manifest.candidates.length,
  categoryCounts: Object.fromEntries(categoryCounts),
  lowArousalMachinePassRate: Number(passRate.toFixed(3)),
  softFailureCount: softFailures.length,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
