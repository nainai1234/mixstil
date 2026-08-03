import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 120);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-002');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-002');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-002-manifest.json');
const briefsPath = path.join(root, 'data/content-baseline/finished-content-briefs-v1.json');
const briefs = JSON.parse(fs.readFileSync(briefsPath, 'utf8')).briefs;

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const byId = new Map(briefs.map((brief) => [brief.id, brief]));

const audio = (relativePath, filter, role) => ({
  path: path.join(root, relativePath),
  relativePath,
  filter,
  role,
});

const music = (relativePath, volume, extra = '') => audio(
  relativePath,
  `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume=${volume}${extra},afade=t=in:st=0:d=4,afade=t=out:st=${durationSeconds - 8}:d=8`,
  'music_main',
);

const bed = (relativePath, volume, extra = '') => audio(
  relativePath,
  `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume=${volume}${extra},afade=t=in:st=0:d=8,afade=t=out:st=${durationSeconds - 8}:d=8`,
  'environment_support',
);

const specs = [
  {
    id: 'sleep_007_no_water_bedtime_pad',
    targetLufs: -25,
    intent: 'Replace the old noise-bed idea with a slow, clearly musical bedtime identity.',
    musicalGate: 'Piano phrases must be audible in the first 30 seconds; no white/pink/brown noise source is used.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/possible_dreams_piano.mp3', 0.52, ',lowpass=f=7200'),
      bed('public/audio/nature/batch-04/night_forest_insects.wav', 0.045, ',lowpass=f=2600'),
    ],
  },
  {
    id: 'sleep_009_gentle_train_night',
    targetLufs: -25,
    intent: 'Make the train feel like a low sleeping carriage while piano carries the emotional contour.',
    musicalGate: 'A repeating piano motif must remain identifiable above the carriage bed.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/dreaming_soft_piano.mp3', 0.50, ',lowpass=f=6800'),
      bed('public/audio/music/revised-collection-qa/2026-07-14/quiet_train_focus.mp3', 0.075, ',highpass=f=90,lowpass=f=1800'),
    ],
  },
  {
    id: 'sleep_006_return_to_sleep_cabin',
    targetLufs: -26,
    intent: 'A low-arousal return-to-sleep piece with melody present but softened.',
    musicalGate: 'Soft guitar movement must be hearable; fire texture is only a quiet spatial cue.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/soft_evening_guitar.mp3', 0.46, ',lowpass=f=6200'),
      bed('public/audio/nature/batch-04/campfire_night_wind.wav', 0.035, ',lowpass=f=1600'),
    ],
  },
  {
    id: 'calm_004_soft_bell_exhale',
    targetLufs: -23,
    intent: 'Use resonant musical bell movement as the exhale cue instead of a static pad.',
    musicalGate: 'Bowl/bell pitch events must be the foreground identity.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/crystal_meditation.mp3', 0.55, ',lowpass=f=8200'),
    ],
  },
  {
    id: 'calm_006_gentle_guitar_horizon',
    targetLufs: -23,
    intent: 'Human warmth through guitar phrasing, with nature only widening the room.',
    musicalGate: 'Guitar line must read as a real piece, not ambience.',
    sources: [
      music('public/audio/music/batch-03/relaxing_nature_guitar.mp3', 0.43, ',lowpass=f=7600'),
      bed('public/audio/nature/batch-04/forest_river_birds.wav', 0.035, ',lowpass=f=2200'),
    ],
  },
  {
    id: 'calm_007_low_piano_reflection',
    targetLufs: -24,
    intent: 'Reflective piano with clear harmonic changes and no masking-noise bed.',
    musicalGate: 'Chord changes must be clear enough to remember after the clip stops.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/piano_reflections.mp3', 0.48, ',lowpass=f=7200'),
    ],
  },
  {
    id: 'focus_004_low_anchor_pad',
    targetLufs: -24,
    intent: 'A stable focus bed that still has harmonic movement rather than clean pink noise.',
    musicalGate: 'Pad harmony must move over time; there is no noise generator in the render graph.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/vastness_ambient_pad.mp3', 0.48, ',highpass=f=80,lowpass=f=6400'),
      music('public/audio/music/batch-03/opalescent_pad.mp3', 0.18, ',highpass=f=140,lowpass=f=5200'),
    ],
  },
  {
    id: 'focus_001_quiet_train_focus',
    targetLufs: -23,
    intent: 'Keep the productive-travel identity but let light music, not noise, hold attention.',
    musicalGate: 'The musical layer must stay audible at low volume and not disappear into the train texture.',
    sources: [
      music('public/audio/production-remediated-2026-07-13/music/nap_time_pad.mp3', 0.44, ',highpass=f=100,lowpass=f=6200'),
      bed('public/audio/music/revised-collection-qa/2026-07-14/quiet_train_focus.mp3', 0.085, ',highpass=f=120,lowpass=f=1900'),
    ],
  },
  {
    id: 'focus_010_open_air_concentration',
    targetLufs: -23,
    intent: 'A brighter open-air concentration cue with repeating guitar contour instead of static masking.',
    musicalGate: 'Plucked guitar motion must be the main perceived layer.',
    sources: [
      music('public/audio/music/batch-03/relaxing_nature_guitar.mp3', 0.32, ',highpass=f=120,lowpass=f=6800'),
      bed('public/audio/nature/batch-04/river_shore_crickets.wav', 0.030, ',lowpass=f=1800'),
    ],
  },
];

const assertInputs = (spec) => {
  for (const source of spec.sources) {
    if (!fs.existsSync(source.path)) {
      throw new Error(`Missing source for ${spec.id}: ${source.relativePath}`);
    }
  }
};

const render = (spec) => {
  assertInputs(spec);
  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const source of spec.sources) args.push('-stream_loop', '-1', '-i', source.path);
  const filtered = spec.sources.map((source, index) => `[${index}:a]${source.filter}[a${index}]`);
  const mixInputs = spec.sources.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${mixInputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,alimiter=limit=0.82,loudnorm=I=${spec.targetLufs}:LRA=9:TP=-2[out]`,
  ].join(';');
  args.push('-filter_complex', filterComplex, '-map', '[out]', '-t', String(durationSeconds), '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath);
  execFileSync('ffmpeg', args, { cwd: root, stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
  return outputPath;
};

const probe = (filePath) => {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(raw);
  return {
    durationSeconds: Number(parsed.format.duration),
    sizeBytes: Number(parsed.format.size),
  };
};

const rendered = specs.map((spec) => {
  const brief = byId.get(spec.id);
  if (!brief) throw new Error(`Missing brief ${spec.id}`);
  const outputPath = render(spec);
  const relativePath = path.relative(root, outputPath);
  return {
    id: spec.id,
    title: brief.title,
    goal: brief.goal,
    scene: brief.scene,
    sourceBriefDurationMinutes: brief.durationMinutes,
    previewDurationSeconds: durationSeconds,
    targetLufs: spec.targetLufs,
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    productionCorrection: 'batch_001_noise_bed_rejected_batch_002_music_forward',
    intent: spec.intent,
    musicalGate: spec.musicalGate,
    sources: spec.sources.map((source) => ({
      role: source.role,
      path: source.relativePath,
    })),
    limitations: [
      'Music-forward correction preview; not a final commercial master.',
      'No generated white, pink, or brown noise source is used in this batch.',
      'Requires human listening for melody fit, fatigue, scene differentiation, and Content ID/licensing readiness before promotion.',
    ],
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-002-music-forward',
  generatedAt: new Date().toISOString(),
  purpose: 'Replacement candidate set after Batch 001 failed for white-noise/noise-bed feel.',
  hardGates: [
    'Reject if it primarily feels like white/pink/brown noise.',
    'Reject if no melody, chord change, or resonant musical event is audible within the first 30 seconds.',
    'Environment layers may support space only; they must not become the identity.',
  ],
  selection: {
    sleep: rendered.filter((item) => item.goal === 'sleep').length,
    calm: rendered.filter((item) => item.goal === 'calm').length,
    focus: rendered.filter((item) => item.goal === 'focus').length,
  },
  candidates: rendered,
  reviewPage: '/review/content-baseline-batch-002/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const reviewAudioSrc = (item) => `../../${item.outputUrl.replace(/^\//, '')}`;

const cards = rendered.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="${reviewAudioSrc(item)}"></audio>
        <p class="intent">${item.intent}</p>
        <p><strong>硬听审：</strong>${item.musicalGate}</p>
        <p class="sources">${item.sources.map((source) => `${source.role}: ${source.path}`).join('<br />')}</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 002</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1117; color: #f5efe7; }
      main { max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d0c4b8; line-height: 1.55; margin-bottom: 22px; }
      .warning { border-left: 3px solid #ff8a63; padding-left: 12px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 16px; background: rgba(255,255,255,.055); }
      .meta { color: #9dc6ff; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d0c4b8; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff1c7; }
      .intent { color: #f3dbc2; }
      .sources { color: #9ea7b7; font-size: 12px; word-break: break-word; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 002</h1>
      <p class="lead warning">Batch 001 的“噪声床/白噪音感”方向作废。本批次改为音乐主导：必须在前 30 秒听见旋律、和声变化或清晰的共鸣音乐事件；环境声只能做空间，不允许成为主身份。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  candidates: rendered.length,
  manifest: path.relative(root, manifestPath),
  reviewPage: manifest.reviewPage,
}, null, 2));
