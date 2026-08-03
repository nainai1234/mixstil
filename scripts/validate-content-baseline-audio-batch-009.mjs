import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-009-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-009/index.html');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const stats = (filePath, seconds) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-t', String(seconds), '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    max: Number(output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? Number.NEGATIVE_INFINITY),
    mean: Number(output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? Number.NEGATIVE_INFINITY),
  };
};

const probe = (filePath) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' })).format;

assert(manifest.version.includes('batch-009-music-first-natural-placement'), 'Manifest must identify batch 009');
assert(manifest.purpose.includes('too much perceived noise'), 'Manifest must document Batch 008 noise failure');
assert(manifest.purpose.includes('clearly music'), 'Manifest must document Focus music classification');
assert(manifest.candidates.length === 3, 'Batch 009 must include 3 candidates');
assert(fs.existsSync(reviewPath), 'Review page must exist');
assert(!reviewHtml.includes('src="/audio/'), 'Review page must use file-open-safe relative paths');

const bannedForSleepCalm = /night_insects|forest_breathing|authentic|room|fan|traffic|noise/i;
const openingStats = {};

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio must exist`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must be a candidate preview`);
  assert(candidate.contentClass.includes('music') || candidate.contentClass.includes('finished'), `${candidate.id} must be classified as music/finished ingredient, not basic sound`);
  if (candidate.goal === 'sleep' || candidate.goal === 'calm') {
    assert(candidate.sources.every((source) => !bannedForSleepCalm.test(source.path)), `${candidate.id} must not use noise/air/insect/room source paths after Batch 008 feedback`);
  }
  if (candidate.goal === 'focus') {
    assert(candidate.contentClass === 'focus_music_bed_candidate', 'Focus candidate must be explicitly classified as a music bed');
  }
  const info = probe(filePath);
  assert(Number(info.duration) >= 179 && Number(info.duration) <= 181, `${candidate.id} must be 180 seconds`);
  assert(Number(info.size) > 900000, `${candidate.id} must not be tiny`);
  const src = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${src}"`), `${candidate.id} must appear on review page`);
  const first30 = stats(filePath, 30);
  openingStats[candidate.id] = first30;
  assert(first30.max >= -38, `${candidate.id} opening is too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -8, `${candidate.id} opening is too forceful (${first30.max} dB max)`);
  assert(first30.mean >= -48, `${candidate.id} opening lacks continuous body (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 009 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({ passed: true, candidates: manifest.candidates.length, openingStats, reviewPage: manifest.reviewPage }, null, 2));
