import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/original-structured-sound-factory-batch-001-manifest.json');
const reviewPath = path.join(root, 'public/review/original-structured-sound-factory-batch-001/index.html');
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

assert(manifest.version.includes('original-structured-sound-factory-batch-001'), 'Manifest must identify original factory batch 001');
assert(manifest.stems.length === 3, 'Factory batch 001 must include exactly 3 foundational stems');
assert(new Set(manifest.stems.map((stem) => stem.goal)).size === 3, 'Factory batch 001 must cover sleep, calm, and focus');
assert(fs.existsSync(reviewPath), 'Review page must exist');
assert(!reviewHtml.includes('src="/audio/'), 'Review page must use file-open-safe relative audio URLs');

const stats = {};
for (const stem of manifest.stems) {
  const mp3Path = path.join(root, stem.outputPath);
  const wavPath = path.join(root, stem.wavMasterPath);
  assert(fs.existsSync(mp3Path), `${stem.id} MP3 must exist`);
  assert(fs.existsSync(wavPath), `${stem.id} WAV master must exist`);
  assert(stem.generationMethod === 'original_deterministic_js_synthesis_no_external_audio', `${stem.id} must be original generated audio`);
  assert(stem.sourceRights === 'project_original_generated_from_code', `${stem.id} must be marked as project-original`);
  assert(stem.noHumanVoice === true, `${stem.id} must be voice-free`);
  assert(stem.noWhitePinkBrownNoise === true, `${stem.id} must be no white/pink/brown noise`);
  assert(stem.outputPath.includes('/original-structured-sound-factory/batch-001/'), `${stem.id} must write to original factory batch path`);
  assert(reviewHtml.includes(`../../${stem.outputUrl.replace(/^\//, '')}`), `${stem.id} must be on the review page`);
  const info = probe(mp3Path);
  const duration = Number(info.duration);
  assert(duration >= 179 && duration <= 181, `${stem.id} must be a 180 second preview`);
  assert(Number(info.size) > 900000, `${stem.id} must not be tiny`);
  const first30 = volumeStats(mp3Path, 30);
  stats[stem.id] = first30;
  assert(first30.max >= -34, `${stem.id} first 30 seconds are too inaudible (${first30.max} dB max)`);
  assert(first30.max <= -10, `${stem.id} first 30 seconds are too forceful for a substrate (${first30.max} dB max)`);
  assert(first30.mean >= -46, `${stem.id} first 30 seconds lack enough continuous body (${first30.mean} dB mean)`);
  assert(first30.mean <= -22, `${stem.id} first 30 seconds are too forward for a substrate (${first30.mean} dB mean)`);
}

if (failures.length) {
  throw new Error(`Original structured sound factory batch 001 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({ passed: true, stems: manifest.stems.length, openingStats: stats, reviewPage: manifest.reviewPage }, null, 2));
