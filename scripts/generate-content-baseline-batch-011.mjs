import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-011');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-011');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-011-manifest.json');

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
    id: 'sleep_017_music_bed_with_soft_air',
    title: 'Music Bed with Soft Air — Sleep',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 1.35,
    contentClass: 'finished_soundscape_candidate',
    thesis: 'Batch 010 was a good quiet music bed; this adds only a barely-there natural air layer so it stops feeling like pure music.',
    sources: [
      src('primary_quiet_music_bed', 'public/audio/content-baseline/batch-010/sleep_016_quieter_music_bed.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.58], [54, 0.62], [128, 0.52], [180, 0.34]])}':eval=frame`, 'accepted Batch 010 music bed remains the main content', '85-92%'),
      src('micro_soft_rain_air', 'public/audio/nature/batch-02/soft_rain_loop.wav', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=520,lowpass=f=1700,volume='${envelope([[0, 0.000], [42, 0.000], [78, 0.0026], [132, 0.0022], [170, 0.0008], [180, 0.0000]])}':eval=frame`, 'late micro texture; should be felt more than heard', '3-5%'),
    ],
  },
  {
    id: 'calm_013_warm_music_with_open_air',
    title: 'Warm Music with Open Air — Calm',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 1.40,
    contentClass: 'finished_soundscape_candidate',
    thesis: 'Batch 010 calm was safe but pure music; this adds a tiny open-air space layer, avoiding bowls and dark resonance.',
    sources: [
      src('primary_safe_warm_music_bed', 'public/audio/content-baseline/batch-010/calm_012_safe_warm_music_bed.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.60], [52, 0.64], [130, 0.54], [180, 0.32]])}':eval=frame`, 'accepted safe warm music bed remains the main content', '85-92%'),
      src('micro_open_air_space', 'public/audio/authentic-scene-review/2026-07-14/authentic_open_wind.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=420,lowpass=f=1500,volume='${envelope([[0, 0.000], [38, 0.000], [82, 0.0020], [144, 0.0018], [180, 0.0000]])}':eval=frame`, 'tiny spatial lift only; not wind as content', '2-4%'),
    ],
  },
  {
    id: 'focus_016_music_bed_with_room_air',
    title: 'Music Bed with Room Air — Focus',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.32,
    contentClass: 'focus_finished_soundscape_candidate',
    thesis: 'Focus remains mostly music because that was the strongest direction; the added space layer must be almost invisible.',
    sources: [
      src('primary_quiet_focus_music_bed', 'public/audio/content-baseline/batch-010/focus_015_quieter_music_bed.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.64], [62, 0.68], [132, 0.58], [180, 0.40]])}':eval=frame`, 'accepted focus music bed remains the main content', '90-95%'),
      src('micro_room_air', 'public/audio/authentic-scene-review/2026-07-14/authentic_pine_forest_wind.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=500,lowpass=f=1350,volume='${envelope([[0, 0.000], [70, 0.000], [112, 0.0013], [158, 0.0010], [180, 0.0000]])}':eval=frame`, 'nearly invisible space cue, not a nature layer', '1-3%'),
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
    correction: 'batch_010_good_music_beds_but_too_pure_music',
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
  version: '2026-07-16.batch-011-micro-organic-texture',
  generatedAt: new Date().toISOString(),
  purpose: 'Correct Batch 010 feedback: the pieces were good, likely because the music was good, but they sounded like only music. Batch 011 keeps music as the main content and adds micro organic texture below attention.',
  hardGates: [
    'Reject if Sleep, Calm, or Focus again sounds like obvious noise/air texture rather than music-led soundscape.',
    'Reject if the non-music layer is clearly foreground or exceeds roughly 5 percent perceived share.',
    'Reject if the added natural layer makes Sleep/Calm less natural or Focus distracting.',
    'These remain finished soundscape candidates, not basic foundational sounds.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-011/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.contentClass}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>这次纠正：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>它是否不再只是纯音乐？但非音乐层是否仍然低到不抢戏？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 011 · Micro Organic Texture</title>
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
      <h1>Content Baseline Batch 011 · Micro Organic Texture</h1>
      <p class="lead">Batch 010 听起来不错，但几乎只有音乐。Batch 011 保留音乐床作为主体，只加 1–5% 的自然/空间微纹理：目标是更完整，但不能让噪声重新变成主角。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
