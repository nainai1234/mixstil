import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'lyria-foundational-expansion-v2';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
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

const fail = (message: string): never => { throw new Error(`Lyria foundational expansion validation failed: ${message}`); };
if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.provider !== 'google-cloud-vertex-ai' || manifest.model !== 'lyria-3-clip-preview') fail('provider/model lineage changed');
if (manifest.productionAllowed !== false) fail('candidate manifest was promoted automatically');
if (manifest.expectedFamilyCount !== 20 || manifest.expectedVariantsPerFamily !== 3 || manifest.expectedCandidateCount !== 60) fail('expansion target changed');
if (manifest.completedCandidateCount !== 60 || manifest.candidates.length !== 60) fail(`expected 60 candidates, got ${manifest.candidates.length}`);
if (manifest.analysisVersion !== 'foundational-expansion-acoustic-v1' || manifest.analysisStatus !== 'candidate_pending_human_identity_and_voice_review') fail('acoustic analysis is incomplete');
if (manifest.preparationVersion !== 'foundational-expansion-preparation-v1') fail('production preparation is incomplete');

const counts = new Map<string, number>();
const categories = new Map<string, number>();
for (const candidate of manifest.candidates) {
  counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
  categories.set(candidate.category, (categories.get(candidate.category) ?? 0) + 1);
  if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} was auto-approved`);
  if (candidate.provider !== 'google-cloud-vertex-ai') fail(`${candidate.candidateId} provider lineage missing`);
  if (!candidate.prompt || !/(?:no singing|human voice|no voice)/i.test(candidate.prompt)) fail(`${candidate.candidateId} prompt lacks voice exclusion`);
  if (!candidate.audioUrl.startsWith(`/audio/music/local-review/${batchId}/audio/`)) fail(`${candidate.candidateId} audio path escaped batch`);
  const filePath = path.join(root, 'public', candidate.audioUrl.slice(1));
  const file = await stat(filePath).catch(() => null);
  if (!file || file.size < 1024) fail(`${candidate.candidateId} file missing or empty`);
  if (!Array.isArray(candidate.machineFlags) || !candidate.machineFlags.includes('human_identity_requires_listening')) fail(`${candidate.candidateId} missing human identity gate`);
  if (!candidate.analysis || !Number.isFinite(candidate.analysis.onsetDensityPerSecond) || !Number.isFinite(candidate.analysis.spectralCentroidHz) || !Number.isFinite(candidate.analysis.loopTonalSimilarity)) fail(`${candidate.candidateId} acoustic analysis missing`);
  if (candidate.analysis.humanVoiceProbability !== 'manual_listening_required' || candidate.analysis.identityProbability !== 'manual_listening_required') fail(`${candidate.candidateId} bypassed a human listening gate`);
  if (!candidate.preparedAudioUrl?.startsWith(`/audio/music/local-review/${batchId}/prepared/`)) fail(`${candidate.candidateId} prepared audio path missing`);
  const preparedPath = path.join(root, 'public', candidate.preparedAudioUrl.slice(1));
  const preparedFile = await stat(preparedPath).catch(() => null);
  if (!preparedFile || preparedFile.size < 1024) fail(`${candidate.candidateId} prepared file missing or empty`);
  if (!candidate.preparedAnalysis || candidate.preparedAnalysis.peakDbfs > -3.5) fail(`${candidate.candidateId} prepared peak is unsafe`);
  if (candidate.preparedAnalysis.humanIdentityStatus !== 'pending' || candidate.preparedAnalysis.humanVoiceStatus !== 'pending') fail(`${candidate.candidateId} human gates were bypassed`);
}
if ([...counts.values()].some((value) => value !== 3)) fail('a family does not have exactly three variants');
if (categories.get('environment') !== 18 || categories.get('texture') !== 15 || categories.get('instrument') !== 18 || categories.get('accent') !== 9) fail(`category counts are ${JSON.stringify(Object.fromEntries(categories))}`);

const reviewHtml = await readFile(reviewPath, 'utf8');
if ((reviewHtml.match(/<article>/g) ?? []).length !== 60) fail('review page does not contain 60 candidate cards');
if ((reviewHtml.match(/<audio controls/g) ?? []).length !== 120) fail('review page must expose prepared and raw audio for every candidate');
for (const category of ['environment', 'texture', 'instrument', 'accent']) if (!reviewHtml.includes(`<p class="eyebrow">${category}</p>`)) fail(`review page is missing ${category}`);

console.log(`PASS: 60 Lyria candidates across 20 families (18 environment, 15 texture, 18 instrument, 9 accent); all files, lineage, machine QA flags, and human listening gates are present; production remains blocked.`);
