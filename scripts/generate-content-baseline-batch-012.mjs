import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-012');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-012');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-012-manifest.json');

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

const src = (role, relativePath, filter, note, perceivedShare) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  filter,
  note,
  perceivedShare,
});

const specs = [
  {
    id: 'sleep_018_saveable_soft_descent',
    title: 'Saveable Soft Descent — Sleep',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 1.18,
    contentClass: 'finished_soundscape_candidate',
    thesis: 'Batch 011 was much stronger; this version makes it more saveable by keeping the music-led body and adding only a gentle descent arc.',
    sources: [
      src('batch_011_music_led_soundscape', 'public/audio/content-baseline/batch-011/sleep_017_music_bed_with_soft_air.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.74], [38, 0.80], [108, 0.74], [154, 0.54], [180, 0.32]])}':eval=frame`, 'accepted Batch 011 sleep direction remains the main body', '90-95%'),
      src('late_soft_pad_release', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=1800,volume='${envelope([[0, 0.000], [62, 0.000], [100, 0.010], [144, 0.014], [180, 0.004]])}':eval=frame`, 'barely-there musical release, no noise layer', '3-5%'),
    ],
  },
  {
    id: 'calm_014_saveable_warm_room',
    title: 'Saveable Warm Room — Calm',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 1.20,
    contentClass: 'finished_soundscape_candidate',
    thesis: 'Batch 011 was much stronger; this keeps the safe warm music and adds a small non-dark expansion in the middle.',
    sources: [
      src('batch_011_warm_soundscape', 'public/audio/content-baseline/batch-011/calm_013_warm_music_with_open_air.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.72], [42, 0.78], [112, 0.72], [158, 0.52], [180, 0.30]])}':eval=frame`, 'accepted Batch 011 calm direction remains the main body', '90-95%'),
      src('safe_middle_width', 'public/audio/music/reviewed-2026-07-11/valley_sunset_pad.mp3', `atrim=22:${durationSeconds + 22},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=2200,volume='${envelope([[0, 0.000], [48, 0.000], [84, 0.010], [126, 0.012], [162, 0.002], [180, 0.000]])}':eval=frame`, 'small warm width, no bowl or dark resonance', '3-5%'),
    ],
  },
  {
    id: 'focus_017_saveable_low_workbed',
    title: 'Saveable Low Workbed — Focus',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.22,
    contentClass: 'focus_finished_soundscape_candidate',
    thesis: 'Batch 011 focus was safer but very far back; this makes it a little more usable while keeping music-led calmness.',
    sources: [
      src('batch_011_focus_soundscape', 'public/audio/content-baseline/batch-011/focus_016_music_bed_with_room_air.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.82], [56, 0.92], [128, 0.86], [170, 0.62], [180, 0.46]])}':eval=frame`, 'accepted Batch 011 focus direction remains the main body', '92-97%'),
      src('tiny_clean_focus_support', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=1300,volume='${envelope([[0, 0.000], [70, 0.000], [112, 0.008], [156, 0.006], [180, 0.000]])}':eval=frame`, 'tiny musical support, not noise or room tone', '2-4%'),
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
    `${inputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},afade=t=in:st=0:d=2,afade=t=out:st=${durationSeconds - 8}:d=8,alimiter=limit=0.70[out]`,
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
    correction: 'batch_011_direction_much_stronger_make_saveable',
    contentClass: spec.contentClass,
    thesis: spec.thesis,
    sources: spec.sources.map((item) => ({
      role: item.role,
      path: item.relativePath,
      note: item.note,
      intendedPerceivedShare: item.perceivedShare,
    })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-17.batch-012-saveable-music-led-soundscapes',
  generatedAt: new Date().toISOString(),
  purpose: 'Owner listening found Batch 011 much stronger. Batch 012 keeps the winning music-led plus micro-texture direction and turns it into more saveable finished soundscape candidates.',
  hardGates: [
    'Reject if any candidate reintroduces obvious noise, wind, rain, room tone, or texture as foreground content.',
    'Reject if Calm feels hellish, horror-like, ominous, or oppressive.',
    'Reject if Sleep or Focus becomes too loud or busy.',
    'These are candidate finished soundscapes, not foundational basic sounds.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-012/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.contentClass}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>这次目标：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>它是否比 Batch 011 更像“愿意保存复听”的成品？有没有把噪声、恐怖感或吵闹感带回来？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 012 · Saveable Music-Led Soundscapes</title>
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
      <h1>Content Baseline Batch 012 · Saveable Music-Led Soundscapes</h1>
      <p class="lead">Batch 011 明显更强，说明音乐床 + 极低微纹理成立。Batch 012 不换方向，只把它推进成更像可保存、可复听的成品声景：更清楚的进入、中段稳定和末段放下。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
