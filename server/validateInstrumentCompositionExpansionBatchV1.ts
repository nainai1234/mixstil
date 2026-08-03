import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Candidate = {
  candidateId: string;
  goal: string;
  instrumentSourceId: string;
  productionAllowed: boolean;
  humanListeningStatus: string;
  formalUsable: boolean;
  masterAudioPath: string;
  preparedAudioUrl: string;
  reviewAudioSrc: string;
  machineStatus: string;
  eventCount: number;
  analysis: {
    durationSeconds: number;
    peakDbfs: number;
    humanVoiceProbability: string;
    drumProbability: string;
  };
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  ownerDirectionSource: string;
  productionAllowed: boolean;
  formalUsableCount: number;
  humanPassCount: number;
  candidateCount: number;
  machinePassCount: number;
  byGoal: Record<string, number>;
  byInstrumentSource: Record<string, number>;
  reviewUrl: string;
  candidates: Candidate[];
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Instrument composition expansion batch v1 validation failed: ${message}`);
};

const manifestPath = path.join(root, 'public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json');
const reviewPath = path.join(root, 'public/review/instrument-composition-expansion-batch-v1/index.html');
const reportPath = path.join(root, 'reports/instrument-composition-expansion-batch-v1.md');
const ownerDecisionPath = path.join(root, 'config/instrument-runtime-render-proof-v1-owner-decision.json');

for (const file of [manifestPath, reviewPath, reportPath, ownerDecisionPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const ownerDecision = JSON.parse(readFileSync(ownerDecisionPath, 'utf8')) as { decision: string; productionAllowed: boolean };

if (ownerDecision.decision !== 'direction_accepted_item_review_pending') fail('owner direction has not been accepted');
if (ownerDecision.productionAllowed !== false) fail('owner direction must not permit production');
if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.batchId !== 'instrument-composition-expansion-batch-v1') fail('unexpected batch id');
if (manifest.status !== 'candidate_expansion_pending_human_listening') fail(`unexpected status ${manifest.status}`);
if (manifest.ownerDirectionSource !== 'config/instrument-runtime-render-proof-v1-owner-decision.json') fail('owner direction source mismatch');
if (manifest.productionAllowed !== false) fail('batch must remain productionAllowed=false');
if (manifest.formalUsableCount !== 0) fail('formal usable count must remain 0');
if (manifest.humanPassCount !== 0) fail('human pass count must remain 0');
if (manifest.reviewUrl !== '/review/instrument-composition-expansion-batch-v1/index.html') fail('review url mismatch');
if (manifest.candidateCount !== manifest.candidates.length) fail('candidate count mismatch');
if (manifest.candidateCount !== 30) fail(`expected 30 candidates, received ${manifest.candidateCount}`);
if (manifest.machinePassCount !== manifest.candidates.filter((item) => item.machineStatus === 'pass').length) fail('machine pass count mismatch');
if (manifest.machinePassCount < 24) fail('expected at least 24 machine-passed candidates');

for (const goal of ['sleep', 'calm', 'focus']) {
  const count = manifest.candidates.filter((item) => item.goal === goal).length;
  if (manifest.byGoal[goal] !== count) fail(`goal count mismatch for ${goal}`);
  if (count < 6) fail(`not enough ${goal} candidates`);
}

for (const sourceId of ['vcsl_kawai_soft_piano', 'discord_cc0_rhodes', 'discord_cc0_guitar', 'discord_cc0_bass']) {
  const count = manifest.candidates.filter((item) => item.instrumentSourceId === sourceId).length;
  if (manifest.byInstrumentSource[sourceId] !== count) fail(`instrument count mismatch for ${sourceId}`);
  if (count < 2) fail(`not enough candidates for ${sourceId}`);
}

const ids = new Set<string>();
for (const candidate of manifest.candidates) {
  if (ids.has(candidate.candidateId)) fail(`duplicate candidate ${candidate.candidateId}`);
  ids.add(candidate.candidateId);
  if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} must remain candidate-only`);
  if (candidate.humanListeningStatus !== 'pending') fail(`${candidate.candidateId} must await human listening`);
  if (candidate.formalUsable !== false) fail(`${candidate.candidateId} must not be formal usable`);
  if (candidate.eventCount < 3) fail(`${candidate.candidateId} has too few note events`);
  if (candidate.analysis.durationSeconds < 80) fail(`${candidate.candidateId} too short`);
  if (candidate.analysis.peakDbfs > -3) fail(`${candidate.candidateId} peak too hot`);
  if (!candidate.analysis.humanVoiceProbability.includes('not_applicable')) fail(`${candidate.candidateId} voice gate not deterministic`);
  if (!candidate.analysis.drumProbability.includes('not_applicable')) fail(`${candidate.candidateId} drum gate not deterministic`);
  if (!candidate.reviewAudioSrc.startsWith('../../audio/')) fail(`${candidate.candidateId} review path must work from file://`);
  if (!existsSync(path.join(root, candidate.masterAudioPath))) fail(`${candidate.candidateId} missing master wav`);
  if (!existsSync(path.join(root, 'public', candidate.preparedAudioUrl.replace(/^\//, '')))) fail(`${candidate.candidateId} missing mp3`);
}

const review = readFileSync(reviewPath, 'utf8');
if (review.includes('src="/audio/')) fail('review page contains absolute audio src; file:// playback would fail');
if ((review.match(/<audio /g) ?? []).length !== manifest.candidateCount) fail('review audio count mismatch');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('candidate_expansion_generated_human_review_required')) fail('report missing verdict');

console.log(JSON.stringify({
  passed: true,
  batchId: manifest.batchId,
  candidateCount: manifest.candidateCount,
  machinePassCount: manifest.machinePassCount,
  byGoal: manifest.byGoal,
  byInstrumentSource: manifest.byInstrumentSource,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: manifest.reviewUrl,
}, null, 2));
