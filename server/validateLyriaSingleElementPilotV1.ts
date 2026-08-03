import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batchId = 'lyria-single-element-pilot-v1';
const batchRoot = path.join(root, 'public/audio/music/local-review', batchId);
const manifestPath = path.join(batchRoot, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => { throw new Error(`Lyria single-element pilot validation failed: ${message}`); };

if (!existsSync(manifestPath) || !existsSync(reviewPath)) fail('manifest or review page is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const html = readFileSync(reviewPath, 'utf8');
if (manifest.batchId !== batchId) fail('batch identity changed');
if (manifest.provider !== 'google-cloud-vertex-ai' || manifest.sourceModel !== 'lyria-3-clip-preview') fail('provider or model changed');
if (manifest.experiment !== 'direct_single_identity_generation_without_source_separation') fail('experiment identity changed');
if (manifest.productionAllowed !== false) fail('pilot must remain blocked from production');
if (manifest.expectedElementTypes !== 8 || manifest.expectedCandidatesPerType !== 3 || manifest.expectedCandidateCount !== 24) fail('expected matrix changed');
if (!Array.isArray(manifest.candidates) || manifest.candidates.length !== 24) fail(`expected 24 candidates, received ${manifest.candidates?.length ?? 0}`);

const typeCounts = new Map<string, number>();
for (const candidate of manifest.candidates) {
  typeCounts.set(candidate.id, (typeCounts.get(candidate.id) ?? 0) + 1);
  if (candidate.provider !== 'google-cloud-vertex-ai' || candidate.model !== 'lyria-3-clip-preview') fail(`${candidate.candidateId} has invalid source identity`);
  if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} is unexpectedly production-allowed`);
  if (![1, 2, 3].includes(candidate.variant)) fail(`${candidate.candidateId} has invalid variant`);
  const audioPath = path.join(root, 'public', String(candidate.audioUrl).replace(/^\//, ''));
  if (!existsSync(audioPath) || statSync(audioPath).size < 100_000) fail(`${candidate.candidateId} audio is missing or too small`);
  if (!(candidate.metrics?.durationSeconds > 20) || candidate.metrics?.codec !== 'mp3' || candidate.metrics?.sampleRate !== 44100) fail(`${candidate.candidateId} has invalid audio metrics`);
  if (!Array.isArray(candidate.machineFlags)) fail(`${candidate.candidateId} is missing machine flags`);
  if (candidate.metrics.durationSeconds < 25 && !candidate.machineFlags.includes('shorter_than_25_seconds')) fail(`${candidate.candidateId} did not flag its short duration`);
}
if (typeCounts.size !== 8 || [...typeCounts.values()].some((count) => count !== 3)) fail('each element type must have exactly three candidates');
for (const contract of ['data-key="warm_analog_pad_v1:identity"', ':other"', ':melody"', ':harmony"', ':beat"', ':voice"', ':loop"', ':usable"', ':decision"', 'productionAllowed=false', 'localStorage']) if (!html.includes(contract)) fail(`review contract missing ${contract}`);
if (/selected(?:=|\s)/.test(html)) fail('review page must not preselect human decisions');
console.log('PASS: 24 real Lyria candidates cover 8 single-identity requests; human review is required and production remains blocked.');
