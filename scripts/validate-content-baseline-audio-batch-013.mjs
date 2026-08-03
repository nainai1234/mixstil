import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-013-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-013/index.html');
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

assert(manifest.version.includes('batch-013-scale-saveable-formula'), 'Manifest must identify batch 013');
assert(manifest.inheritedPromotion === 'data/content-baseline/content-baseline-batch-012-promotion.json', 'Batch 013 must inherit Batch 012 promotion');
assert(manifest.candidates.length === 6, 'Batch 013 must include 6 candidates');
assert(fs.existsSync(reviewPath), 'Review page must exist');
assert(!reviewHtml.includes('src="/audio/'), 'Review page must use file-open-safe relative paths');

const counts = manifest.candidates.reduce((acc, item) => {
  acc[item.goal] = (acc[item.goal] ?? 0) + 1;
  return acc;
}, {});
assert(counts.sleep === 2 && counts.calm === 2 && counts.focus === 2, 'Batch 013 must include 2 candidates per goal');

const rejectedSourcePattern = /singingbowl|night_insects|forest_breathing|white_noise|pink|brown|fan|traffic|room|authentic/i;
const openingStats = {};
for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio must exist`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain candidate preview`);
  assert(candidate.contentClass.includes('soundscape'), `${candidate.id} must be classified as soundscape candidate`);
  assert(candidate.sources.some((source) => source.path.includes('content-baseline/batch-012')), `${candidate.id} must build from promoted Batch 012 seeds`);
  const support = candidate.sources.filter((source) => !source.path.includes('content-baseline/batch-012'));
  assert(support.every((source) => !rejectedSourcePattern.test(source.path)), `${candidate.id} support layers must avoid rejected source families`);
  assert(support.every((source) => /1-3%|2-4%/.test(source.intendedPerceivedShare)), `${candidate.id} support layers must stay under roughly 5 percent`);
  const info = probe(filePath);
  assert(Number(info.duration) >= 179 && Number(info.duration) <= 181, `${candidate.id} must be 180 seconds`);
  assert(Number(info.size) > 900000, `${candidate.id} must not be tiny`);
  const src = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${src}"`), `${candidate.id} must appear on review page`);
  const first30 = stats(filePath, 30);
  openingStats[candidate.id] = first30;
  assert(first30.max >= -42, `${candidate.id} opening is too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -13, `${candidate.id} opening is too forceful (${first30.max} dB max)`);
  assert(first30.mean >= -54, `${candidate.id} opening lacks continuous body (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 013 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({ passed: true, candidates: manifest.candidates.length, byGoal: counts, openingStats, reviewPage: manifest.reviewPage }, null, 2));
