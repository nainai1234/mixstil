import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-006-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-006/index.html');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const volumeStats = (filePath, seconds) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-t', String(seconds), '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const max = output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  const mean = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  return {
    max: max ? Number(max[1]) : Number.NEGATIVE_INFINITY,
    mean: mean ? Number(mean[1]) : Number.NEGATIVE_INFINITY,
  };
};

const ffprobe = (filePath) => {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' });
  return JSON.parse(raw).format;
};

assert(manifest.version.includes('batch-006-semantic-music-filter'), 'Batch 006 must identify the semantic music filter correction');
assert(manifest.candidates.length === 3, 'Batch 006 must stay small: exactly 3 candidates');
assert(manifest.selection.sleep === 1, 'Batch 006 must include 1 Sleep candidate');
assert(manifest.selection.calm === 1, 'Batch 006 must include 1 Calm candidate');
assert(manifest.selection.focus === 1, 'Batch 006 must include 1 Focus candidate');
assert(manifest.purpose.includes('cheerful') && manifest.purpose.includes('white-noise'), 'Batch 006 must document the actual Batch 005 failure');
assert(fs.existsSync(reviewPath), 'Batch 006 review page must exist');
assert(!reviewHtml.includes('src="/audio/content-baseline/batch-006/'), 'Review page must use file-open-safe relative audio paths');

const openingStats = {};
const bannedPathTerms = /noise|white|pink|brown|fan|traffic|room/i;
const bannedSleepTerms = /piano|guitar|romantic|dreaming_soft|beautiful_dream/i;

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  assert(candidate.outputUrl.startsWith('/audio/content-baseline/batch-006/'), `${candidate.id} must use batch 006 output URL`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain a candidate preview`);
  assert(candidate.productionCorrection === 'batch_005_music_semantics_failed_sleep_and_focus', `${candidate.id} must carry the Batch 005 correction marker`);
  assert(candidate.sources.length === 3, `${candidate.id} must use 3 intentional music/harmonic sources`);
  assert(candidate.sources.every((source) => !bannedPathTerms.test(source.path)), `${candidate.id} must not use explicit noise/room/fan/traffic source paths`);
  assert(candidate.sources.every((source) => source.path.includes('/music/')), `${candidate.id} must use music/harmonic sources only in this semantic-filter batch`);
  if (candidate.goal === 'sleep') {
    assert(candidate.sources.every((source) => !bannedSleepTerms.test(source.path)), `${candidate.id} sleep source must avoid bright piano/guitar/festive-risk music`);
  }
  const probe = ffprobe(filePath);
  const duration = Number(probe.duration);
  const size = Number(probe.size);
  assert(duration >= 179 && duration <= 181, `${candidate.id} must be a 180 second preview`);
  assert(size > 900000, `${candidate.id} must not be empty or tiny`);
  const src = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${src}"`), `${candidate.id} review audio must use relative source`);

  const first30 = volumeStats(filePath, 30);
  openingStats[candidate.id] = first30;
  assert(first30.max >= -38, `${candidate.id} first 30 seconds are too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -7, `${candidate.id} first 30 seconds are too forceful (${first30.max} dB max)`);
  assert(first30.mean >= -46, `${candidate.id} first 30 seconds lack continuous presence (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 006 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  candidates: manifest.candidates.length,
  byGoal: manifest.selection,
  openingStats,
  reviewPage: manifest.reviewPage,
}, null, 2));
