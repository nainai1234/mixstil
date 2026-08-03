import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-007-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-007/index.html');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const ffprobe = (filePath) => {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' });
  return JSON.parse(raw).format;
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

assert(manifest.version.includes('batch-007-original-structured-foundations'), 'Batch 007 must identify original structured foundation generation');
assert(manifest.purpose.includes('bottom-level') || manifest.purpose.includes('foundation'), 'Batch 007 purpose must document the bottom-level foundation correction');
assert(manifest.selection.stems === 6, 'Batch 007 must include exactly 6 foundation stems');
assert(manifest.selection.sleep === 2, 'Batch 007 must include 2 Sleep previews');
assert(manifest.selection.calm === 1, 'Batch 007 must include 1 Calm preview');
assert(manifest.selection.focus === 1, 'Batch 007 must include 1 Focus preview');
assert(fs.existsSync(reviewPath), 'Batch 007 review page must exist');
assert(!reviewHtml.includes('src="/audio/'), 'Review page must use file-open-safe relative audio paths');

const bannedPathTerms = /batch-07-cc|reviewed-2026|local-review|candidates|third-party|freesound|mixkit|commons/i;
const requiredRoles = new Set([
  'low_frequency_body',
  'dark_air_and_blanket_layer',
  'breathing_harmonic_body',
  'soft_spatial_color',
  'low_distraction_work_pulse',
  'steady_low_focus_anchor',
]);

const openingStats = {};

for (const stem of manifest.stems) {
  assert(stem.license === 'project_original_procedural_generation', `${stem.id} must be marked as original procedural generation`);
  assert(stem.humanVoice === false, `${stem.id} must explicitly mark no human voice`);
  assert(stem.commercialUseAllowed === true && stem.derivativeUseAllowed === true, `${stem.id} must be reusable by the product`);
  assert(requiredRoles.has(stem.role), `${stem.id} must expose a recognized structural role`);
  assert(stem.outputPath.startsWith('public/audio/content-foundation/batch-007/'), `${stem.id} must live under the Batch 007 foundation directory`);
  assert(!bannedPathTerms.test(stem.outputPath), `${stem.id} path must not point to third-party or old reviewed music`);
  const filePath = path.join(root, stem.outputPath);
  assert(fs.existsSync(filePath), `${stem.id} audio file must exist`);
  const probe = ffprobe(filePath);
  assert(Number(probe.duration) >= 179 && Number(probe.duration) <= 181, `${stem.id} must be a 180 second stem`);
  assert(Number(probe.size) > 900000, `${stem.id} must not be empty or tiny`);
}

for (const candidate of manifest.candidates) {
  assert(candidate.sourcePolicy === 'fully_original_structured_procedural_stems', `${candidate.id} must use the original structured source policy`);
  assert(candidate.layers.length === 2, `${candidate.id} must expose exactly 2 foundation layers`);
  assert(candidate.outputPath.startsWith('public/audio/content-baseline/batch-007/'), `${candidate.id} must live under Batch 007 preview output`);
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  const probe = ffprobe(filePath);
  assert(Number(probe.duration) >= 179 && Number(probe.duration) <= 181, `${candidate.id} must be a 180 second preview`);
  assert(Number(probe.size) > 900000, `${candidate.id} must not be empty or tiny`);
  const src = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${src}"`), `${candidate.id} review audio must use relative source`);
  const first30 = volumeStats(filePath, 30);
  openingStats[candidate.id] = first30;
  assert(first30.max >= -40, `${candidate.id} first 30 seconds are too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -6, `${candidate.id} first 30 seconds are too forceful (${first30.max} dB max)`);
  assert(first30.mean >= -48, `${candidate.id} first 30 seconds lack continuous presence (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 007 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  stems: manifest.selection.stems,
  byGoal: {
    sleep: manifest.selection.sleep,
    calm: manifest.selection.calm,
    focus: manifest.selection.focus,
  },
  openingStats,
  reviewPage: manifest.reviewPage,
}, null, 2));
