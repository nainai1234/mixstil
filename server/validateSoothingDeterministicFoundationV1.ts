import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'soothing-deterministic-foundation-v1';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => {
  throw new Error(`Soothing deterministic foundation validation failed: ${message}`);
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  hardExclusions: string[];
  candidateCount: number;
  machinePassCount: number;
  reviewUrl: string;
  candidates: Array<any>;
};

if (manifest.batchId !== batchId) fail('batch id changed');
if (manifest.status !== 'candidate_pending_human_soothing_review') fail('status must remain pending human review');
if (manifest.productionAllowed !== false) fail('production must remain blocked');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('review URL changed');
if (manifest.candidateCount !== 18 || manifest.candidates.length !== 18) fail(`expected 18 deterministic candidates, got ${manifest.candidates.length}`);
if (manifest.machinePassCount < 16) fail(`machine pass count too low: ${manifest.machinePassCount}`);

for (const exclusion of ['drums', 'percussion', 'beat', 'rhythmic pulse', 'groove', 'human voice', 'human-like vocal texture', 'medical claims']) {
  if (!manifest.hardExclusions.includes(exclusion)) fail(`missing hard exclusion ${exclusion}`);
}

const categoryCounts = new Map<string, number>();
const ids = new Set<string>();

for (const candidate of manifest.candidates) {
  if (ids.has(candidate.candidateId)) fail(`${candidate.candidateId} duplicated`);
  ids.add(candidate.candidateId);
  categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1);
  if (candidate.source !== 'deterministic_dsp') fail(`${candidate.candidateId} is not deterministic DSP`);
  if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} was auto-approved`);
  if (!candidate.preparedAudioUrl?.startsWith(`/audio/music/local-review/${batchId}/prepared/`)) fail(`${candidate.candidateId} prepared URL invalid`);
  const audioFile = await stat(path.join(root, 'public', candidate.preparedAudioUrl.slice(1))).catch(() => null);
  if (!audioFile || audioFile.size < 100_000) fail(`${candidate.candidateId} prepared audio missing or too small`);
  if (!candidate.analysis) fail(`${candidate.candidateId} analysis missing`);
  if (candidate.analysis.durationSeconds !== 60) fail(`${candidate.candidateId} must be 60 seconds`);
  if (candidate.analysis.sampleRate !== 48000 || candidate.analysis.channels !== 2) fail(`${candidate.candidateId} must be 48k stereo`);
  if (candidate.analysis.samplePeakDbfs > -6) fail(`${candidate.candidateId} peak is unsafe`);
  if (candidate.analysis.humanVoiceProbability !== 'not_applicable_deterministic_no_voice_source') fail(`${candidate.candidateId} voice provenance changed`);
  if (candidate.analysis.drumProbability !== 'not_applicable_deterministic_no_percussion_source') fail(`${candidate.candidateId} drum provenance changed`);
  if (candidate.machineStatus === 'pass') {
    if (candidate.category === 'environment' && candidate.analysis.spectralCentroidHz > 1800) fail(`${candidate.candidateId} environment too bright`);
    if (candidate.category === 'texture' && candidate.analysis.spectralCentroidHz > 1500) fail(`${candidate.candidateId} texture too bright`);
    if (candidate.category === 'accent' && candidate.analysis.onsetCount > 2) fail(`${candidate.candidateId} accent has too many onsets`);
    if (candidate.category !== 'accent' && candidate.analysis.onsetDensityPerSecond > 0.75) fail(`${candidate.candidateId} event density too high`);
    if (candidate.category !== 'accent' && candidate.analysis.p99RmsJumpDb > 1.6) fail(`${candidate.candidateId} has large interior RMS jumps`);
  } else {
    if (!Array.isArray(candidate.failures) || candidate.failures.length === 0) fail(`${candidate.candidateId} failed without explicit failure reasons`);
  }
}

if (categoryCounts.get('environment') !== 8) fail('expected 8 environment candidates');
if (categoryCounts.get('texture') !== 8) fail('expected 8 texture candidates');
if (categoryCounts.get('accent') !== 2) fail('expected 2 accent candidates');

const review = await readFile(reviewPath, 'utf8');
if ((review.match(/<article>/g) ?? []).length !== 18) fail('review page must contain 18 cards');
if (!review.includes('无鼓点') || !review.includes('无节拍')) fail('review page must expose no-drum/no-beat intent');
if (!review.includes('不是成品曲，也不是 Lyria 混合音乐片段')) fail('review page must explain foundational identity');

console.log(JSON.stringify({
  passed: true,
  batchId,
  candidateCount: manifest.candidateCount,
  machinePassCount: manifest.machinePassCount,
  categoryCounts: Object.fromEntries(categoryCounts),
  reviewUrl: manifest.reviewUrl,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
