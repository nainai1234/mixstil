import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/organic-structured-sound-factory-batch-002-manifest.json');
const reviewPath = path.join(root, 'public/review/organic-structured-sound-factory-batch-002/index.html');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const volumeStats = (filePath, seconds) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-t', String(seconds), '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    max: Number(output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? Number.NEGATIVE_INFINITY),
    mean: Number(output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? Number.NEGATIVE_INFINITY),
  };
};

const probe = (filePath) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' })).format;

assert(manifest.version.includes('organic-structured-sound-factory-batch-002'), 'Manifest must identify organic factory batch 002');
assert(manifest.rejectedPreviousDirection.reason.includes('mechanical'), 'Manifest must explicitly reject the mechanical previous direction');
assert(manifest.candidates.length === 3, 'Batch 002 must include 3 candidates only');
assert(new Set(manifest.candidates.map((item) => item.goal)).size === 3, 'Batch 002 must cover sleep, calm, and focus');
assert(fs.existsSync(reviewPath), 'Review page must exist');
assert(!reviewHtml.includes('src="/audio/'), 'Review page must use file-open-safe relative audio paths');

const banned = /content-foundation|original-structured-sound-factory|white_noise|pink|brown|fan|traffic|engine|pulse/i;
const stats = {};

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio must exist`);
  assert(candidate.productionStatus === 'organic_reference_candidate', `${candidate.id} must remain an organic reference candidate`);
  assert(candidate.correction === 'reject_mechanical_synthetic_substrate_direction', `${candidate.id} must carry the mechanical rejection correction`);
  assert(candidate.sources.every((source) => !banned.test(source.path)), `${candidate.id} must not use mechanical/noise/fan/traffic source paths`);
  assert(candidate.sources.every((source) => !source.role.includes('pulse') && !source.role.includes('engine')), `${candidate.id} must not define pulse/engine roles`);
  const info = probe(filePath);
  assert(Number(info.duration) >= 179 && Number(info.duration) <= 181, `${candidate.id} must be 180 seconds`);
  assert(Number(info.size) > 900000, `${candidate.id} must not be tiny`);
  const src = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${src}"`), `${candidate.id} must be on the review page`);
  const first30 = volumeStats(filePath, 30);
  stats[candidate.id] = first30;
  assert(first30.max >= -38, `${candidate.id} opening is too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -8, `${candidate.id} opening is too forceful (${first30.max} dB max)`);
  assert(first30.mean >= -46, `${candidate.id} opening lacks continuous body (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Organic structured sound factory batch 002 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({ passed: true, candidates: manifest.candidates.length, openingStats: stats, reviewPage: manifest.reviewPage }, null, 2));
