import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-004-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-004/index.html');
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const openingMaxVolumeDb = (filePath) => {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-t',
    '12',
    '-i',
    filePath,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const match = output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
};

const ffprobe = (filePath) => {
  const raw = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size',
    '-of',
    'json',
    filePath,
  ], { encoding: 'utf8' });
  return JSON.parse(raw).format;
};

const countByGoal = manifest.candidates.reduce((counts, item) => {
  counts[item.goal] = (counts[item.goal] ?? 0) + 1;
  return counts;
}, {});

assert(manifest.candidates.length === 4, 'Batch 004 must include 4 tightly scoped quiet-entry candidates');
assert(countByGoal.sleep === 2, 'Batch 004 must include 2 sleep candidates');
assert(countByGoal.calm === 1, 'Batch 004 must include 1 calm candidate');
assert(countByGoal.focus === 1, 'Batch 004 must include 1 focus candidate');
assert(manifest.reviewPage === '/review/content-baseline-batch-004/index.html', 'Batch 004 review page path must be stable');
assert(fs.existsSync(reviewPath), 'Batch 004 review page must exist');
assert(!reviewHtml.includes('src="/audio/content-baseline/batch-004/'), 'Batch 004 review page must use file-open-safe relative audio paths');
assert(manifest.purpose.includes('Batch 003') && manifest.purpose.includes('opened too loudly'), 'Batch 004 must document the Batch 003 correction');
assert(manifest.hardGates.some((gate) => gate.includes('first 20-30 seconds')), 'Batch 004 must include a quiet-opening hard gate');
assert(manifest.hardGates.some((gate) => gate.includes('noise layer')), 'Batch 004 must include a noise-identity hard gate');

const openingPeaks = {};

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  assert(candidate.outputUrl.startsWith('/audio/content-baseline/batch-004/'), `${candidate.id} must use batch output URL`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain a candidate preview`);
  assert(candidate.productionCorrection === 'batch_003_process_better_but_opening_too_loud_and_not_state_inducing', `${candidate.id} must carry the correction marker`);
  const probe = ffprobe(filePath);
  const duration = Number(probe.duration);
  const size = Number(probe.size);
  assert(duration >= 179 && duration <= 181, `${candidate.id} must be a 180 second preview`);
  assert(size > 900000, `${candidate.id} must not be an empty or tiny MP3`);
  assert(candidate.openingMaxGain <= 0.035, `${candidate.id} must declare a low opening gain`);
  assert(candidate.stateArc.includes('->'), `${candidate.id} must define a state-transition arc`);
  assert(candidate.listeningQuestion.trim().length >= 40, `${candidate.id} must define a useful listening question`);
  assert(candidate.sources.length >= 4, `${candidate.id} must use at least four arranged layers`);
  assert(candidate.sources.some((source) => source.note.includes('first') || source.note.includes('opening') || source.note.includes('opens')), `${candidate.id} must explicitly describe the opening layer`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-001')), `${candidate.id} must not reuse Batch 001 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-002')), `${candidate.id} must not reuse Batch 002 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-003')), `${candidate.id} must not reuse Batch 003 render output`);
  const relativeReviewSrc = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${relativeReviewSrc}"`), `${candidate.id} review audio must use a relative file-open-safe src`);

  const peak = openingMaxVolumeDb(filePath);
  openingPeaks[candidate.id] = peak;
  assert(peak <= -18, `${candidate.id} first 12 seconds are too hot (${peak} dB max); quiet-entry gate is <= -18 dB`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 004 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  candidates: manifest.candidates.length,
  byGoal: countByGoal,
  openingPeaks,
  reviewPage: manifest.reviewPage,
}, null, 2));
