import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sampleRate = 48000;
const durationSeconds = Number(process.env.ORIGINAL_FACTORY_SECONDS ?? 180);
const frameCount = sampleRate * durationSeconds;
const wavDir = path.join(root, 'public/audio/original-structured-sound-factory/batch-001/wav-masters');
const mp3Dir = path.join(root, 'public/audio/original-structured-sound-factory/batch-001');
const reviewDir = path.join(root, 'public/review/original-structured-sound-factory-batch-001');
const manifestPath = path.join(root, 'data/content-baseline/original-structured-sound-factory-batch-001-manifest.json');

fs.mkdirSync(wavDir, { recursive: true });
fs.mkdirSync(mp3Dir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, value));
const smooth = (x) => x * x * (3 - 2 * x);
const between = (t, points) => {
  if (t <= points[0][0]) return points[0][1];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ta, va] = points[index];
    const [tb, vb] = points[index + 1];
    if (t <= tb) {
      const ratio = smooth((t - ta) / (tb - ta));
      return va + (vb - va) * ratio;
    }
  }
  return points.at(-1)[1];
};

const pan = (mono, position) => {
  const angle = (position + 1) * Math.PI * 0.25;
  return [mono * Math.cos(angle), mono * Math.sin(angle)];
};

const writeWav = (filePath, left, right) => {
  const bytesPerSample = 2;
  const channelCount = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < frameCount; i += 1) {
    buffer.writeInt16LE(Math.round(clamp(left[i]) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(clamp(right[i]) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(filePath, buffer);
};

const synthesize = (spec) => {
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  const phases = spec.voices.map(() => 0);
  const driftPhases = spec.voices.map((voice, index) => index * 1.7 + 0.2);

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const master = between(t, spec.masterEnvelope);
    for (let voiceIndex = 0; voiceIndex < spec.voices.length; voiceIndex += 1) {
      const voice = spec.voices[voiceIndex];
      const drift = Math.sin(driftPhases[voiceIndex] + t * voice.driftRate) * voice.driftDepth;
      const frequency = voice.frequency * (1 + drift);
      phases[voiceIndex] += (Math.PI * 2 * frequency) / sampleRate;
      if (phases[voiceIndex] > Math.PI * 2) phases[voiceIndex] -= Math.PI * 2;
      const breath = 0.78 + 0.22 * Math.sin(t * voice.breathRate + voice.breathPhase);
      const slowPulse = voice.pulseDepth ? 1 - voice.pulseDepth + voice.pulseDepth * (0.5 + 0.5 * Math.sin(t * voice.pulseRate + voice.pulsePhase)) : 1;
      const harmonic = Math.sin(phases[voiceIndex]) + voice.overtone * Math.sin(phases[voiceIndex] * 2.005) + voice.air * Math.sin(phases[voiceIndex] * 3.01);
      const shaped = Math.tanh(harmonic * voice.drive) * voice.gain * breath * slowPulse * master;
      const [l, r] = pan(shaped, voice.pan + Math.sin(t * 0.018 + voiceIndex) * voice.panDrift);
      left[i] += l;
      right[i] += r;
    }
  }

  for (let i = 1; i < frameCount; i += 1) {
    left[i] = left[i] * (1 - spec.blur) + left[i - 1] * spec.blur;
    right[i] = right[i] * (1 - spec.blur) + right[i - 1] * spec.blur;
  }

  const peak = Math.max(0.001, ...left.reduce((acc, value, index) => {
    if (index % 480 === 0) acc.push(Math.abs(value), Math.abs(right[index]));
    return acc;
  }, []));
  const normalize = spec.targetPeak / peak;
  for (let i = 0; i < frameCount; i += 1) {
    left[i] *= normalize;
    right[i] *= normalize;
  }

  const wavPath = path.join(wavDir, `${spec.id}.wav`);
  const mp3Path = path.join(mp3Dir, `${spec.id}.mp3`);
  writeWav(wavPath, left, right);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3Path], { cwd: root, stdio: 'pipe' });
  return { wavPath, mp3Path };
};

const specs = [
  {
    id: 'sleep_dark_substrate_001',
    title: 'Sleep Dark Substrate 001',
    goal: 'sleep',
    role: 'foundational_harmonic_substrate',
    targetPeak: 0.18,
    blur: 0.18,
    masterEnvelope: [[0, 0.18], [24, 0.42], [82, 0.52], [138, 0.40], [180, 0.18]],
    designIntent: 'A dark, low, non-melodic sleep substrate that can sit underneath future sleep journeys without sounding cheerful or song-like.',
    structure: 'dim entry -> low-body settlement -> gradual descent -> stable night floor',
    voices: [
      { frequency: 55, gain: 0.34, pan: -0.22, panDrift: 0.08, overtone: 0.15, air: 0.02, drive: 1.8, driftDepth: 0.0012, driftRate: 0.031, breathRate: 0.055, breathPhase: 0.2 },
      { frequency: 82.5, gain: 0.22, pan: 0.24, panDrift: 0.06, overtone: 0.10, air: 0.02, drive: 1.5, driftDepth: 0.0010, driftRate: 0.024, breathRate: 0.043, breathPhase: 1.1 },
      { frequency: 110, gain: 0.12, pan: -0.05, panDrift: 0.04, overtone: 0.08, air: 0.01, drive: 1.3, driftDepth: 0.0008, driftRate: 0.018, breathRate: 0.037, breathPhase: 2.6 },
    ],
  },
  {
    id: 'calm_breathing_field_001',
    title: 'Calm Breathing Field 001',
    goal: 'calm',
    role: 'foundational_breathing_harmonic_field',
    targetPeak: 0.20,
    blur: 0.11,
    masterEnvelope: [[0, 0.24], [18, 0.42], [66, 0.56], [126, 0.48], [180, 0.20]],
    designIntent: 'A warm breath-like harmonic field where the sense of inhale/exhale comes from slow gain motion, not from hiss or white-noise texture.',
    structure: 'warm presence -> wider breathing field -> one gentle settling wave -> quiet release',
    voices: [
      { frequency: 146.83, gain: 0.20, pan: -0.34, panDrift: 0.12, overtone: 0.20, air: 0.04, drive: 1.4, driftDepth: 0.0016, driftRate: 0.028, breathRate: 0.145, breathPhase: 0.0 },
      { frequency: 220, gain: 0.16, pan: 0.28, panDrift: 0.11, overtone: 0.16, air: 0.035, drive: 1.25, driftDepth: 0.0014, driftRate: 0.022, breathRate: 0.143, breathPhase: 1.6 },
      { frequency: 293.66, gain: 0.09, pan: 0.02, panDrift: 0.08, overtone: 0.12, air: 0.025, drive: 1.15, driftDepth: 0.0012, driftRate: 0.019, breathRate: 0.072, breathPhase: 2.8 },
    ],
  },
  {
    id: 'focus_clean_engine_001',
    title: 'Focus Clean Engine 001',
    goal: 'focus',
    role: 'foundational_low_attention_engine',
    targetPeak: 0.18,
    blur: 0.08,
    masterEnvelope: [[0, 0.28], [16, 0.46], [60, 0.52], [150, 0.50], [180, 0.30]],
    designIntent: 'A clean, upright focus engine built from low harmonic repetition rather than white noise, traffic, fan, or room-tone masking.',
    structure: 'clean low pulse -> stable workbed -> restrained harmonic motion -> sustained attention floor',
    voices: [
      { frequency: 73.42, gain: 0.24, pan: -0.18, panDrift: 0.04, overtone: 0.20, air: 0.02, drive: 1.7, driftDepth: 0.0007, driftRate: 0.016, breathRate: 0.032, breathPhase: 0.1, pulseDepth: 0.18, pulseRate: 0.42, pulsePhase: 0 },
      { frequency: 110, gain: 0.17, pan: 0.20, panDrift: 0.05, overtone: 0.14, air: 0.02, drive: 1.55, driftDepth: 0.0005, driftRate: 0.014, breathRate: 0.028, breathPhase: 1.7, pulseDepth: 0.11, pulseRate: 0.21, pulsePhase: 1.2 },
      { frequency: 164.81, gain: 0.09, pan: 0.03, panDrift: 0.03, overtone: 0.10, air: 0.015, drive: 1.25, driftDepth: 0.0004, driftRate: 0.011, breathRate: 0.023, breathPhase: 2.4, pulseDepth: 0.08, pulseRate: 0.105, pulsePhase: 2.3 },
    ],
  },
];

const probe = (filePath) => {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' });
  const parsed = JSON.parse(raw).format;
  return { durationSeconds: Number(parsed.duration), sizeBytes: Number(parsed.size) };
};

const stems = specs.map((spec) => {
  const { wavPath, mp3Path } = synthesize(spec);
  const relativeMp3 = path.relative(root, mp3Path);
  const relativeWav = path.relative(root, wavPath);
  return {
    id: spec.id,
    title: spec.title,
    goal: spec.goal,
    role: spec.role,
    outputPath: relativeMp3,
    wavMasterPath: relativeWav,
    outputUrl: `/${relativeMp3.replace(/^public\//, '')}`,
    generationMethod: 'original_deterministic_js_synthesis_no_external_audio',
    designIntent: spec.designIntent,
    structure: spec.structure,
    sourceRights: 'project_original_generated_from_code',
    noHumanVoice: true,
    noWhitePinkBrownNoise: true,
    probe: probe(mp3Path),
  };
});

const manifest = {
  version: '2026-07-16.original-structured-sound-factory-batch-001',
  generatedAt: new Date().toISOString(),
  purpose: 'Start a project-owned original structured sound substrate factory after Batch 006 was acceptable but still not foundational enough.',
  factoryRule: 'Generate reusable low-level harmonic substrates from deterministic synthesis, then later arrange them into finished sound journeys.',
  stems,
  reviewPage: '/review/original-structured-sound-factory-batch-001/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = stems.map((stem, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${stem.goal.toUpperCase()} · ${stem.role}</div>
        <h2>${stem.title}</h2>
        <audio controls preload="metadata" src="../../${stem.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>定位：</strong>${stem.designIntent}</p>
        <p><strong>结构：</strong>${stem.structure}</p>
        <p><strong>注意：</strong>这是底层原创素材，不是最终成品曲。先判断它是否比现有素材更像“我们的声音底座”。</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Original Structured Sound Factory Batch 001</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #06080c; color: #f7efe6; }
      main { max-width: 960px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d6c8b9; line-height: 1.58; border-left: 3px solid #bfa56a; padding-left: 12px; margin-bottom: 20px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 16px; background: rgba(255,255,255,.052); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d6c8b9; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff0c2; }
    </style>
  </head>
  <body>
    <main>
      <h1>Original Structured Sound Factory · Batch 001</h1>
      <p class="lead">这不是成品内容页，而是原创底层声音素材页。Batch 006 方向 OK，但仍依赖现有音乐；这一批开始建立项目自己的 Sleep / Calm / Focus 声音底座：无外部音频、无人声、无白/粉/棕噪。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, stems: stems.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
