import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-005-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-005/index.html');
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const maxVolumeDb = (filePath, seconds) => {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-t',
    String(seconds),
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

const meanVolumeDb = (filePath, seconds) => {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-t',
    String(seconds),
    '-i',
    filePath,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const match = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/);
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

assert(manifest.candidates.length === 4, 'Batch 005 must include 4 tightly scoped music-led candidates');
assert(countByGoal.sleep === 2, 'Batch 005 must include 2 sleep candidates');
assert(countByGoal.calm === 1, 'Batch 005 must include 1 calm candidate');
assert(countByGoal.focus === 1, 'Batch 005 must include 1 focus candidate');
assert(manifest.reviewPage === '/review/content-baseline-batch-005/index.html', 'Batch 005 review page path must be stable');
assert(fs.existsSync(reviewPath), 'Batch 005 review page must exist');
assert(!reviewHtml.includes('src="/audio/content-baseline/batch-005/'), 'Batch 005 review page must use file-open-safe relative audio paths');
assert(manifest.purpose.includes('Batch 004') && manifest.purpose.includes('nearly inaudible'), 'Batch 005 must document the Batch 004 correction');
assert(manifest.hardGates.some((gate) => gate.includes('almost inaudible')), 'Batch 005 must include an audible-opening hard gate');
assert(manifest.hardGates.some((gate) => gate.includes('roughly half')), 'Batch 005 must include a perceived-noise-share hard gate');

const openingStats = {};

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  assert(candidate.outputUrl.startsWith('/audio/content-baseline/batch-005/'), `${candidate.id} must use batch output URL`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain a candidate preview`);
  assert(candidate.productionCorrection === 'batch_004_quiet_but_empty_opening_and_noise_support_too_dominant', `${candidate.id} must carry the correction marker`);
  assert(candidate.designRule.includes('no') || candidate.designRule.includes('No'), `${candidate.id} must state the no-noise-lead design rule`);
  const probe = ffprobe(filePath);
  const duration = Number(probe.duration);
  const size = Number(probe.size);
  assert(duration >= 179 && duration <= 181, `${candidate.id} must be a 180 second preview`);
  assert(size > 900000, `${candidate.id} must not be an empty or tiny MP3`);
  assert(candidate.stateArc.includes('->'), `${candidate.id} must define a state-transition arc`);
  assert(candidate.listeningQuestion.trim().length >= 40, `${candidate.id} must define a useful listening question`);
  assert(candidate.sources.length >= 3, `${candidate.id} must use at least three arranged layers`);
  assert(candidate.sources.every((source) => !source.path.includes('generated://')), `${candidate.id} must not use generated noise/tone layers`);
  assert(candidate.sources.every((source) => !source.path.toLowerCase().includes('noise')), `${candidate.id} must not use explicit noise source files`);
  assert(candidate.sources.filter((source) => /music|harmonic|piano|pad|resonance|anchor|motion/i.test(`${source.role} ${source.note}`)).length >= 2, `${candidate.id} must have at least two musical/harmonic roles`);
  assert(candidate.sources.filter((source) => /room|fan|traffic/i.test(`${source.role} ${source.note}`)).length <= 1, `${candidate.id} must keep room/noise-like support to at most one layer`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-001')), `${candidate.id} must not reuse Batch 001 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-002')), `${candidate.id} must not reuse Batch 002 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-003')), `${candidate.id} must not reuse Batch 003 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-004')), `${candidate.id} must not reuse Batch 004 render output`);
  const relativeReviewSrc = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${relativeReviewSrc}"`), `${candidate.id} review audio must use a relative file-open-safe src`);

  const openingMax = maxVolumeDb(filePath, 30);
  const openingMean = meanVolumeDb(filePath, 30);
  openingStats[candidate.id] = { openingMax, openingMean };
  assert(openingMax >= -36, `${candidate.id} first 30 seconds are still too inaudible (${openingMax} dB max); gate is >= -36 dB`);
  assert(openingMax <= -8, `${candidate.id} first 30 seconds are too forceful (${openingMax} dB max); gate is <= -8 dB`);
  assert(openingMean >= -44, `${candidate.id} first 30 seconds have too little continuous presence (${openingMean} dB mean); gate is >= -44 dB`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 005 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  candidates: manifest.candidates.length,
  byGoal: countByGoal,
  openingStats,
  reviewPage: manifest.reviewPage,
}, null, 2));
