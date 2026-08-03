import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-010-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-010/index.html');
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

assert(manifest.version.includes('batch-010-quieter-safe-music-beds'), 'Manifest must identify batch 010');
assert(manifest.purpose.includes('too loud') && manifest.purpose.includes('hellish'), 'Manifest must document Batch 009 failures');
assert(manifest.candidates.length === 3, 'Batch 010 must include 3 candidates');
assert(fs.existsSync(reviewPath), 'Review page must exist');
assert(!reviewHtml.includes('src="/audio/'), 'Review page must use file-open-safe relative paths');

const bannedPaths = /singingbowl|procedural_meditation_open|night_insects|forest_breathing|authentic|room|fan|traffic|white_noise|pink|brown/i;
const openingStats = {};

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio must exist`);
  assert(candidate.contentClass.includes('music_bed'), `${candidate.id} must be classified as a music bed candidate`);
  assert(candidate.sources.every((source) => !bannedPaths.test(source.path)), `${candidate.id} must not use banned resonance/noise/environment sources`);
  if (candidate.goal === 'calm') {
    assert(candidate.correction === 'batch_009_calm_resonance_hellish_uncomfortable', 'Calm must carry the hellish-resonance correction');
    assert(candidate.rejectedFromPreviousBatch.length >= 2, 'Calm must record rejected previous patterns');
  }
  const info = probe(filePath);
  assert(Number(info.duration) >= 179 && Number(info.duration) <= 181, `${candidate.id} must be 180 seconds`);
  assert(Number(info.size) > 900000, `${candidate.id} must not be tiny`);
  const src = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${src}"`), `${candidate.id} must appear on review page`);
  const first30 = stats(filePath, 30);
  openingStats[candidate.id] = first30;
  assert(first30.max >= -42, `${candidate.id} opening is too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -14, `${candidate.id} opening is still too forceful for this quieter batch (${first30.max} dB max)`);
  assert(first30.mean >= -52, `${candidate.id} opening lacks continuous body (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 010 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({ passed: true, candidates: manifest.candidates.length, openingStats, reviewPage: manifest.reviewPage }, null, 2));
