import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-009');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-009');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-009-manifest.json');

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const envelope = (points) => {
  const parts = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [startTime, startVolume] = points[index];
    const [endTime, endVolume] = points[index + 1];
    const slope = (endVolume - startVolume) / (endTime - startTime);
    parts.push(`if(lt(t\\,${endTime})\\,${startVolume.toFixed(4)}+${slope.toFixed(7)}*(t-${startTime})\\,`);
  }
  return `${parts.join('')}${points.at(-1)[1].toFixed(4)}${')'.repeat(points.length - 1)}`;
};

const src = (role, relativePath, filter, note) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  filter,
  note,
});

const specs = [
  {
    id: 'sleep_015_music_first_natural_bed',
    title: 'Music-First Natural Bed — Sleep',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 2.15,
    correction: 'batch_008_sleep_noise_too_loud_and_not_natural',
    contentClass: 'finished_music_bed_candidate',
    thesis: 'Sleep should be carried by dim, natural music movement; no noise bed is needed unless it is almost invisible.',
    sources: [
      src('dim_sleep_music_body', 'public/audio/music/reviewed-2026-07-11/silent_descent.mp3', `atrim=12:${durationSeconds + 12},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=3000,volume='${envelope([[0, 0.052], [30, 0.070], [88, 0.060], [142, 0.034], [180, 0.010]])}':eval=frame`, 'primary sleep music bed, not cheerful and not noisy'),
      src('soft_deep_pad_underlay', 'public/audio/music/procedural-approved-2026-07-13/procedural_deep_sleep_low.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1400,volume='${envelope([[0, 0.018], [50, 0.030], [118, 0.026], [164, 0.014], [180, 0.004]])}':eval=frame`, 'low musical underlay, not mechanical and not a noise wall'),
    ],
  },
  {
    id: 'calm_011_music_first_resonance',
    title: 'Music-First Resonance — Calm',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 2.0,
    correction: 'batch_008_calm_noise_too_loud_and_not_natural',
    contentClass: 'finished_music_bed_candidate',
    thesis: 'Calm can use sparse resonance, but the continuous body must feel musical and natural, not noisy.',
    sources: [
      src('warm_calm_music_body', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=110,lowpass=f=3000,volume='${envelope([[0, 0.046], [28, 0.064], [92, 0.054], [142, 0.026], [180, 0.008]])}':eval=frame`, 'warm calm music body'),
      src('soft_open_resonance', 'public/audio/music/local-review/2026-07-14/procedural_meditation_open_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=130,lowpass=f=3200,volume='${envelope([[0, 0.000], [44, 0.000], [78, 0.030], [124, 0.024], [168, 0.008], [180, 0.000]])}':eval=frame`, 'late open resonance, no hiss layer'),
      src('single_sparse_bowl_color', 'public/audio/accent/batch-05/singingbowl1.ogg', `adelay=68000|68000,apad,atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=4200,volume='${envelope([[0, 0.000], [66, 0.000], [74, 0.014], [94, 0.004], [112, 0.000], [180, 0.000]])}':eval=frame`, 'one tiny acoustic color only; not a performance'),
    ],
  },
  {
    id: 'focus_014_music_bed_confirmed',
    title: 'Music Bed Confirmed — Focus',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.95,
    correction: 'batch_008_focus_good_but_all_music',
    contentClass: 'focus_music_bed_candidate',
    thesis: 'This keeps the successful Batch 008 direction but labels it honestly as music, not foundational sound.',
    sources: [
      src('organic_focus_music_bed', 'public/audio/organic-structured-sound-factory/batch-002/focus_organic_clear_bed_001.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=3000,volume='${envelope([[0, 0.38], [34, 0.42], [108, 0.36], [160, 0.26], [180, 0.16]])}':eval=frame`, 'the accepted focus material, explicitly treated as music'),
      src('small_stability_layer', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=1500,volume='${envelope([[0, 0.012], [56, 0.022], [126, 0.018], [170, 0.006], [180, 0.000]])}':eval=frame`, 'very small musical stability layer'),
    ],
  },
];

const render = (spec) => {
  for (const item of spec.sources) {
    if (!fs.existsSync(item.path)) throw new Error(`Missing source: ${item.relativePath}`);
  }
  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const item of spec.sources) args.push('-stream_loop', '-1', '-i', item.path);
  const filtered = spec.sources.map((item, index) => `[${index}:a]${item.filter}[a${index}]`);
  const inputs = spec.sources.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${inputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},afade=t=in:st=0:d=2,afade=t=out:st=${durationSeconds - 8}:d=8,alimiter=limit=0.72[out]`,
  ].join(';');
  args.push('-filter_complex', filterComplex, '-map', '[out]', '-t', String(durationSeconds), '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath);
  execFileSync('ffmpeg', args, { cwd: root, stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
  return outputPath;
};

const probe = (filePath) => {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' });
  const parsed = JSON.parse(raw).format;
  return { durationSeconds: Number(parsed.duration), sizeBytes: Number(parsed.size) };
};

const candidates = specs.map((spec) => {
  const outputPath = render(spec);
  const relativePath = path.relative(root, outputPath);
  return {
    id: spec.id,
    title: spec.title,
    goal: spec.goal,
    scene: spec.scene,
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    correction: spec.correction,
    contentClass: spec.contentClass,
    thesis: spec.thesis,
    sources: spec.sources.map((item) => ({ role: item.role, path: item.relativePath, note: item.note })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-009-music-first-natural-placement',
  generatedAt: new Date().toISOString(),
  purpose: 'Correct Batch 008 feedback: Sleep and Calm were not natural enough and had too much perceived noise; Focus was good but is clearly music. Batch 009 uses music-first placement and honest music-bed classification.',
  hardGates: [
    'Reject Sleep or Calm if noise, air, insects, room tone, or texture becomes louder than the musical body.',
    'Reject any candidate that feels mechanical, electric, physically oppressive, or harmful.',
    'Focus candidate must be judged as a music bed, not as foundational sound.',
    'Do not promote these as basic sounds if they are clearly music.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-009/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.contentClass}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>这次纠正：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>Sleep/Calm 是否还觉得噪声太响、不自然？Focus 作为音乐床是否仍然成立？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 009 · Music First Natural Placement</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #070908; color: #f5efe8; }
      main { max-width: 960px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d5c8ba; line-height: 1.58; border-left: 3px solid #c7ad74; padding-left: 12px; margin-bottom: 20px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 16px; background: rgba(255,255,255,.052); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d5c8ba; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff0c2; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 009 · Music First Natural Placement</h1>
      <p class="lead">Batch 008 的 1/2 号噪声太响、不够自然；3 号舒服但基本是音乐。Batch 009 改成音乐主导，并诚实把这批归为 music bed / finished-content ingredient，而不是基础底噪。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
