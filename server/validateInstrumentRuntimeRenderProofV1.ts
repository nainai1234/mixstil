import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type RenderedCandidate = {
  candidateId: string;
  goal: string;
  instrumentSourceId: string;
  compositionPlanId: string;
  harmonyId: string;
  motifId: string;
  formId: string;
  grammarId: string;
  productionAllowed: boolean;
  masterAudioPath: string;
  preparedAudioUrl: string;
  eventCount: number;
  analysis: {
    durationSeconds: number;
    peakDbfs: number;
    onsetDensityPerSecond: number;
    humanVoiceProbability: string;
    drumProbability: string;
  };
  machineStatus: string;
  failures: string[];
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  productionAllowed: boolean;
  purpose: string;
  sourceResults: Array<{
    sourceId: string;
    runtimeProofStatus: string;
    renderedCandidateCount: number;
    productionAllowed: boolean;
  }>;
  renderedCandidateCount: number;
  machinePassCount: number;
  humanPassCount: number;
  formalUsableCount: number;
  reviewUrl: string;
  renderedCandidates: RenderedCandidate[];
  blockedSources: Array<{ sourceId: string; status: string; reason: string }>;
};

type SourceResult = Manifest['sourceResults'][number];

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Instrument runtime render proof validation failed: ${message}`);
};

const requireSourceResult = (sourceId: string): SourceResult => {
  const source = manifest.sourceResults.find((item) => item.sourceId === sourceId);
  if (!source) fail(`missing source result ${sourceId}`);
  return source as SourceResult;
};

const requireBlockedSourceResult = (sourceId: string): SourceResult => {
  const source = manifest.sourceResults.find((item) => item.sourceId === sourceId);
  if (!source) fail(`missing SoundFont source result ${sourceId}`);
  return source as SourceResult;
};

const manifestPath = path.join(root, 'public/audio/music/local-review/instrument-runtime-render-proof-v1/manifest.json');
const reportPath = path.join(root, 'reports/instrument-runtime-render-proof-v1.md');
const reviewPath = path.join(root, 'public/review/instrument-runtime-render-proof-v1/index.html');

if (!existsSync(manifestPath)) fail('manifest missing; run pnpm generate:instrument-runtime-render-proof-v1');
if (!existsSync(reportPath)) fail('report missing');
if (!existsSync(reviewPath)) fail('review page missing');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.batchId !== 'instrument-runtime-render-proof-v1') fail('unexpected batch id');
if (manifest.status !== 'candidate_runtime_render_proof_pending_human_review') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed !== false) fail('runtime proof must remain productionAllowed=false');
if (manifest.humanPassCount !== 0) fail('human pass must be 0 before owner listening review');
if (manifest.formalUsableCount !== 0) fail('formal usable count must remain 0');
if (manifest.reviewUrl !== '/review/instrument-runtime-render-proof-v1/index.html') fail('review url mismatch');

if (manifest.renderedCandidateCount !== manifest.renderedCandidates.length) fail('rendered candidate count mismatch');
if (manifest.renderedCandidates.length < 12) fail('expected at least 12 rendered candidates from composition plans');
if (manifest.machinePassCount !== manifest.renderedCandidates.filter((item) => item.machineStatus === 'pass').length) fail('machine pass count mismatch');

const requiredGoals = ['sleep', 'calm', 'focus'];
for (const goal of requiredGoals) {
  if (!manifest.renderedCandidates.some((item) => item.goal === goal)) fail(`missing rendered goal ${goal}`);
}

const requiredRenderedSources = ['vcsl_kawai_soft_piano', 'discord_cc0_rhodes', 'discord_cc0_guitar', 'discord_cc0_bass'];
for (const sourceId of requiredRenderedSources) {
  const source = requireSourceResult(sourceId);
  if (source.renderedCandidateCount < 1) fail(`${sourceId} must render at least one candidate`);
  if (source.runtimeProofStatus !== 'machine_passed_candidate') fail(`${sourceId} must be machine_passed_candidate`);
}

for (const sourceId of ['fluidr3_gm_soundfont', 'fluidr3_woodwinds_fallback']) {
  const source = requireBlockedSourceResult(sourceId);
  if (source.renderedCandidateCount !== 0) fail(`${sourceId} must not be counted as rendered without a verified loader`);
  if (source.runtimeProofStatus !== 'runtime_loader_blocked') fail(`${sourceId} must be runtime_loader_blocked`);
  if (!manifest.blockedSources.some((item) => item.sourceId === sourceId && item.status === 'runtime_loader_blocked')) fail(`${sourceId} missing blocked-source record`);
}

const candidateIds = new Set<string>();
for (const candidate of manifest.renderedCandidates) {
  if (candidateIds.has(candidate.candidateId)) fail(`duplicate candidate ${candidate.candidateId}`);
  candidateIds.add(candidate.candidateId);
  if (!requiredGoals.includes(candidate.goal)) fail(`${candidate.candidateId} has unsupported goal ${candidate.goal}`);
  if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} must remain candidate-only`);
  if (!candidate.harmonyId || !candidate.formId || !candidate.grammarId) fail(`${candidate.candidateId} missing composition metadata`);
  if (candidate.eventCount < 3) fail(`${candidate.candidateId} has too few note events`);
  if (candidate.analysis.durationSeconds < 80) fail(`${candidate.candidateId} too short for form proof`);
  if (candidate.analysis.peakDbfs > -3) fail(`${candidate.candidateId} peak too hot`);
  if (!candidate.analysis.humanVoiceProbability.includes('not_applicable')) fail(`${candidate.candidateId} voice status must be deterministic non-voice`);
  if (!candidate.analysis.drumProbability.includes('not_applicable')) fail(`${candidate.candidateId} drum status must be deterministic no-percussion`);
  const wavPath = path.join(root, candidate.masterAudioPath);
  if (!existsSync(wavPath)) fail(`${candidate.candidateId} missing master wav`);
  const mp3Path = path.join(root, 'public', candidate.preparedAudioUrl.replace(/^\//, ''));
  if (!existsSync(mp3Path)) fail(`${candidate.candidateId} missing prepared mp3`);
}

const report = readFileSync(reportPath, 'utf8');
for (const required of [
  'runtime_proof_partial_pass_human_review_required',
  'notes, harmonies, motifs, forms, tempo, and instrument choice are now separate controllable inputs',
  'FluidR3 SoundFont sources remain blocked',
]) {
  if (!report.includes(required)) fail(`report missing required text: ${required}`);
}

console.log(JSON.stringify({
  passed: true,
  batchId: manifest.batchId,
  renderedCandidateCount: manifest.renderedCandidateCount,
  machinePassCount: manifest.machinePassCount,
  renderedSources: requiredRenderedSources,
  blockedSources: manifest.blockedSources.map((item) => item.sourceId),
  productionAllowed: manifest.productionAllowed,
  reviewUrl: manifest.reviewUrl,
}, null, 2));
