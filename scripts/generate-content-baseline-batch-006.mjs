import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-006');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-006');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-006-manifest.json');

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

const source = (role, relativePath, filter, note) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  filter,
  note,
});

const specs = [
  {
    id: 'sleep_010_dark_descent_no_melody',
    title: 'Dark Descent — No Festive Melody',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 2.15,
    designRule: 'sleep music must feel dim, slow, and non-celebratory; no piano/guitar lead, no white-noise support',
    stateArc: 'low drone is already present -> darker pad slowly opens -> high detail disappears -> one stable night body remains',
    listeningQuestion: 'Does this feel like a quiet descent instead of pleasant/cheerful music?',
    sources: [
      source('dark_low_sleep_body', 'public/audio/music/local-review/2026-07-13/procedural_deep_sleep_low.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1450,volume='${envelope([[0, 0.060], [28, 0.070], [82, 0.060], [140, 0.044], [180, 0.026]])}':eval=frame`, 'low sustained body; carries sleep identity without melody'),
      source('slow_descent_pad', 'public/audio/music/reviewed-2026-07-11/silent_descent.mp3', `atrim=10:${durationSeconds + 10},asetpts=PTS-STARTPTS,highpass=f=80,lowpass=f=2400,volume='${envelope([[0, 0.000], [24, 0.030], [72, 0.058], [122, 0.044], [168, 0.020], [180, 0.010]])}':eval=frame`, 'slow harmonic descent; no bright theme'),
      source('distant_meditation_drone', 'public/audio/music/reviewed-2026-07-11/deep_meditation_drone.mp3', `atrim=36:${durationSeconds + 36},asetpts=PTS-STARTPTS,lowpass=f=1100,volume='${envelope([[0, 0.000], [54, 0.000], [98, 0.026], [148, 0.030], [180, 0.014]])}':eval=frame`, 'late depth only, not an event layer'),
    ],
  },
  {
    id: 'calm_008_warm_stillness_no_hiss',
    title: 'Warm Stillness — Breath Without Noise',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 2.05,
    designRule: 'calm must be warm and intentional, with breathing-like phrasing from harmony rather than hiss or noise',
    stateArc: 'warm grounded pad appears immediately -> open meditation tone widens -> soft resonance returns once -> settles without drama',
    listeningQuestion: 'Does this create a calmer room around you, rather than simply playing pretty music?',
    sources: [
      source('grounded_warm_pad', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=2600,volume='${envelope([[0, 0.052], [30, 0.064], [92, 0.054], [144, 0.038], [180, 0.018]])}':eval=frame`, 'warm body from the start; avoids empty opening'),
      source('open_meditation_width', 'public/audio/music/local-review/2026-07-14/procedural_meditation_open_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=3400,volume='${envelope([[0, 0.000], [34, 0.000], [70, 0.046], [122, 0.040], [166, 0.018], [180, 0.006]])}':eval=frame`, 'opens the space without becoming a lead track'),
      source('single_resonant_color', 'public/audio/music/reviewed-2026-07-11/meditation_tones.mp3', `atrim=22:${durationSeconds + 22},asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=4200,volume='${envelope([[0, 0.010], [22, 0.024], [58, 0.014], [110, 0.026], [142, 0.012], [180, 0.000]])}':eval=frame`, 'subtle tonal color; no foreground bell show'),
    ],
  },
  {
    id: 'focus_011_clean_harmonic_workbed',
    title: 'Clean Harmonic Workbed — No Noise Mask',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 2.25,
    designRule: 'focus must be upright and clean; no white/pink/brown noise, no room-tone masking, no traffic bed',
    stateArc: 'neutral pulse is audible immediately -> low anchor stabilizes -> restrained mid motion adds work energy -> remains non-performative',
    listeningQuestion: 'Can this sit under work without feeling like white noise or like a song asking for attention?',
    sources: [
      source('neutral_clean_focus_core', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=80,lowpass=f=2300,volume='${envelope([[0, 0.050], [24, 0.064], [88, 0.060], [146, 0.050], [180, 0.034]])}':eval=frame`, 'clear focus identity; not a noise layer'),
      source('low_harmonic_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1250,volume='${envelope([[0, 0.026], [42, 0.038], [106, 0.040], [160, 0.032], [180, 0.020]])}':eval=frame`, 'low stability under the core'),
      source('restrained_work_motion', 'public/audio/music/local-review/2026-07-15/procedural_focus_warm_mid.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=2800,volume='${envelope([[0, 0.000], [50, 0.000], [82, 0.030], [132, 0.026], [166, 0.016], [180, 0.006]])}':eval=frame`, 'small amount of motion, late and restrained'),
    ],
  },
];

const render = (spec) => {
  for (const item of spec.sources) {
    if (!fs.existsSync(item.path)) throw new Error(`Missing source for ${spec.id}: ${item.relativePath}`);
  }

  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const item of spec.sources) args.push('-stream_loop', '-1', '-i', item.path);
  const filtered = spec.sources.map((item, index) => `[${index}:a]${item.filter}[a${index}]`);
  const inputs = spec.sources.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${inputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},afade=t=in:st=0:d=2,afade=t=out:st=${durationSeconds - 8}:d=8,alimiter=limit=0.74[out]`,
  ].join(';');
  args.push('-filter_complex', filterComplex, '-map', '[out]', '-t', String(durationSeconds), '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath);
  execFileSync('ffmpeg', args, { cwd: root, stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
  return outputPath;
};

const probe = (filePath) => {
  const raw = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', filePath], { encoding: 'utf8' });
  const parsed = JSON.parse(raw);
  return {
    durationSeconds: Number(parsed.format.duration),
    sizeBytes: Number(parsed.format.size),
  };
};

const candidates = specs.map((spec) => {
  const outputPath = render(spec);
  const relativePath = path.relative(root, outputPath);
  return {
    id: spec.id,
    title: spec.title,
    goal: spec.goal,
    scene: spec.scene,
    previewDurationSeconds: durationSeconds,
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    productionCorrection: 'batch_005_music_semantics_failed_sleep_and_focus',
    designRule: spec.designRule,
    stateArc: spec.stateArc,
    listeningQuestion: spec.listeningQuestion,
    rejectedPatterns: [
      'sleep content with cheerful, festive, bright, or narrative lead melody',
      'focus content that is perceived as white noise or uncomfortable masking',
      'noise, room tone, traffic, or fan used as the primary perceived content',
    ],
    sources: spec.sources.map((item) => ({ role: item.role, path: item.relativePath, note: item.note })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-006-semantic-music-filter',
  generatedAt: new Date().toISOString(),
  purpose: 'Correct Batch 005 feedback: the first sleep candidate used music that felt cheerful/festive, and the focus candidate collapsed back into uncomfortable white-noise perception. Batch 006 tests music semantics before mix polish.',
  hardGates: [
    'Reject any Sleep item whose main music feels cheerful, festive, bright, cute, cinematic, romantic, or performance-like.',
    'Reject any Focus item that is perceived as white noise, pink noise, traffic mask, fan mask, or uncomfortable hiss.',
    'Reject any item where environment/noise-like support occupies the main perceived attention.',
    'Keep the first 20-30 seconds audible but calm; do not solve quietness by adding a noise bed.',
  ],
  selection: {
    sleep: candidates.filter((item) => item.goal === 'sleep').length,
    calm: candidates.filter((item) => item.goal === 'calm').length,
    focus: candidates.filter((item) => item.goal === 'focus').length,
  },
  candidates,
  reviewPage: '/review/content-baseline-batch-006/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const reviewAudioSrc = (item) => `../../${item.outputUrl.replace(/^\//, '')}`;
const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="${reviewAudioSrc(item)}"></audio>
        <p><strong>这条要验证：</strong>${item.listeningQuestion}</p>
        <p><strong>设计规则：</strong>${item.designRule}</p>
        <p><strong>过程：</strong>${item.stateArc}</p>
        <p class="sources">${item.sources.map((entry) => `${entry.role}: ${entry.note}`).join('<br />')}</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 006</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #07090d; color: #f7eee4; }
      main { max-width: 960px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d7c8b9; line-height: 1.58; margin-bottom: 20px; border-left: 3px solid #d8b46a; padding-left: 12px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 16px; background: rgba(255,255,255,.052); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d7c8b9; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff0c2; }
      .sources { color: #9fa9b8; font-size: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 006</h1>
      <p class="lead">这批不再测试“白噪和音乐怎么混”。它只测试音乐语义是否先对：Sleep 不能喜庆，Focus 不能像白噪，Calm 要有安静的空间感。每类只保留 1 条，避免无效样本消耗。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  candidates: candidates.length,
  manifest: path.relative(root, manifestPath),
  reviewPage: manifest.reviewPage,
}, null, 2));
