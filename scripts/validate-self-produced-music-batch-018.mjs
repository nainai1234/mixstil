import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowPartial = process.argv.includes('--allow-partial');
const manifestPath = path.join(root, 'docs/self-produced-music-bed-batch-018.json');
const outputDir = path.join(root, 'public/audio/music/local-candidates/batch-018-self-produced');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const probe = (filePath) => {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,sample_rate,channels,bits_per_sample',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  return JSON.parse(raw);
};

const volumeStats = (filePath) => {
  const result = spawnSync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i', filePath,
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return {
    mean: Number(output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? Number.NEGATIVE_INFINITY),
    max: Number(output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? Number.NEGATIVE_INFINITY),
  };
};

assert(manifest.batchId === 'self_produced_music_bed_batch_018_2026_07_17', 'Unexpected Batch 018 id');
assert(manifest.model?.provider === 'ACE-Step', 'Batch 018 must identify ACE-Step as provider');
assert(manifest.model?.productBoundary?.includes('candidate-only'), 'Batch 018 must remain candidate-only');
assert(manifest.candidates.length === 30, 'Batch 018 manifest must contain 30 candidates');

const byGoal = manifest.candidates.reduce((acc, item) => {
  acc[item.goal] = (acc[item.goal] ?? 0) + 1;
  return acc;
}, {});
assert(byGoal.calm === 15, 'Batch 018 must contain 15 Calm candidates');
assert(byGoal.focus === 15, 'Batch 018 must contain 15 Focus candidates');
assert(!byGoal.sleep, 'Batch 018 must not use ACE-Step as the Sleep route');
assert(new Set(manifest.candidates.map((item) => item.id)).size === manifest.candidates.length, 'Candidate ids must be unique');
assert(new Set(manifest.candidates.map((item) => item.seed)).size === manifest.candidates.length, 'Candidate seeds must be unique');

const generated = [];
for (const candidate of manifest.candidates) {
  const filePath = path.join(outputDir, `${candidate.id}.wav`);
  if (!fs.existsSync(filePath)) {
    if (!allowPartial) failures.push(`Missing generated candidate: ${candidate.id}`);
    continue;
  }
  const probed = probe(filePath);
  const stream = probed.streams?.[0] ?? {};
  const format = probed.format ?? {};
  const durationSeconds = Number(format.duration);
  const sizeBytes = Number(format.size);
  const volume = volumeStats(filePath);

  assert(stream.codec_name === 'pcm_s16le', `${candidate.id} must be a PCM WAV candidate`);
  assert(Number(stream.sample_rate) === 48000, `${candidate.id} must be 48kHz`);
  assert(Number(stream.channels) === 2, `${candidate.id} must be stereo`);
  assert(durationSeconds >= 58 && durationSeconds <= 62, `${candidate.id} must be about 60 seconds`);
  assert(sizeBytes > 8_000_000, `${candidate.id} file is unexpectedly small`);
  assert(volume.max <= -0.1, `${candidate.id} clips or peaks too hot (${volume.max} dB)`);
  assert(volume.max >= -30, `${candidate.id} peak is too low (${volume.max} dB)`);
  assert(volume.mean >= -45, `${candidate.id} mean volume is too low (${volume.mean} dB)`);

  generated.push({
    id: candidate.id,
    goal: candidate.goal,
    durationSeconds,
    sizeBytes,
    meanVolumeDb: volume.mean,
    maxVolumeDb: volume.max,
  });
}

if (allowPartial) {
  assert(generated.length > 0, 'Partial validation requires at least one generated candidate');
} else {
  assert(generated.length === manifest.candidates.length, 'Full validation requires all 30 generated candidates');
}

if (failures.length) {
  throw new Error(`Self-produced music Batch 018 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  mode: allowPartial ? 'partial' : 'full',
  generated: generated.length,
  expected: manifest.candidates.length,
  byGoal,
  outputDir: path.relative(root, outputDir),
  candidates: generated,
}, null, 2));
