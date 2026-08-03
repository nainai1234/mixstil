import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-010');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-010');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-010-manifest.json');

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
    id: 'sleep_016_quieter_music_bed',
    title: 'Quieter Music Bed — Sleep',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 1.35,
    correction: 'batch_009_sleep_music_bed_too_forward_and_noisy',
    contentClass: 'quiet_finished_music_bed_candidate',
    thesis: 'Keep the music-bed direction, but lower the intensity and remove the sense of loud foreground music.',
    sources: [
      src('quiet_sleep_descent', 'public/audio/music/reviewed-2026-07-11/silent_descent.mp3', `atrim=18:${durationSeconds + 18},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=2400,volume='${envelope([[0, 0.030], [34, 0.044], [92, 0.036], [146, 0.020], [180, 0.006]])}':eval=frame`, 'same sleep direction, quieter and less forward'),
      src('soft_rest_pad_shadow', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=1800,volume='${envelope([[0, 0.008], [58, 0.018], [128, 0.014], [172, 0.004], [180, 0.000]])}':eval=frame`, 'barely-there musical shadow, not a drone or noise bed'),
    ],
  },
  {
    id: 'calm_012_safe_warm_music_bed',
    title: 'Safe Warm Music Bed — Calm',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 1.55,
    correction: 'batch_009_calm_resonance_hellish_uncomfortable',
    contentClass: 'safe_finished_music_bed_candidate',
    thesis: 'Replace hellish resonance with a warmer, simpler, non-ritual calm music bed; no bowls, no dark resonance, no horror-like pad.',
    sources: [
      src('safe_warm_calm_body', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=8:${durationSeconds + 8},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=2600,volume='${envelope([[0, 0.032], [30, 0.050], [92, 0.044], [146, 0.022], [180, 0.006]])}':eval=frame`, 'warm safe pad, no dark ritual resonance'),
      src('soft_open_warmth', 'public/audio/music/reviewed-2026-07-11/valley_sunset_pad.mp3', `atrim=24:${durationSeconds + 24},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=2800,volume='${envelope([[0, 0.000], [42, 0.000], [82, 0.024], [132, 0.018], [170, 0.004], [180, 0.000]])}':eval=frame`, 'late gentle width, still safe and musical'),
    ],
  },
  {
    id: 'focus_015_quieter_music_bed',
    title: 'Quieter Music Bed — Focus',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.25,
    correction: 'batch_009_focus_music_bed_good_but_too_loud',
    contentClass: 'quiet_focus_music_bed_candidate',
    thesis: 'Keep the accepted Focus music-bed direction, but make it sit further back so it supports work instead of becoming noisy music.',
    sources: [
      src('quiet_organic_focus_music_bed', 'public/audio/organic-structured-sound-factory/batch-002/focus_organic_clear_bed_001.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=2400,volume='${envelope([[0, 0.220], [36, 0.250], [110, 0.220], [160, 0.150], [180, 0.080]])}':eval=frame`, 'same liked focus music bed, lowered and softened'),
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
    correction: spec.correction,
    contentClass: spec.contentClass,
    thesis: spec.thesis,
    rejectedFromPreviousBatch: spec.goal === 'calm' ? [
      'dark/open resonance that feels hellish or horror-like',
      'singing bowl cue used before the core emotional safety is established',
      'procedural meditation resonance if it creates oppressive semantics',
    ] : [],
    sources: spec.sources.map((item) => ({ role: item.role, path: item.relativePath, note: item.note })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-010-quieter-safe-music-beds',
  generatedAt: new Date().toISOString(),
  purpose: 'Correct Batch 009 feedback: Sleep and Focus were music beds but too loud/noisy; Calm resonance felt hellish and uncomfortable. Batch 010 lowers music-bed intensity and replaces Calm with a safe warm bed.',
  hardGates: [
    'Reject if Sleep or Focus still feels too loud, busy, or noisy as music.',
    'Reject Calm immediately if it feels hellish, horror-like, ritualistic, ominous, oppressive, or physically uncomfortable.',
    'No singing bowl, dark resonance, insect, room, fan, traffic, or white/pink/brown noise is used in this batch.',
    'All candidates are music-bed candidates, not foundational basic sounds.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-010/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.contentClass}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>这次纠正：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>1/3 是否不再太响、太吵？2 是否彻底去掉“地狱/恐怖/压迫”的感觉？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 010 · Quieter Safe Music Beds</title>
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
      <h1>Content Baseline Batch 010 · Quieter Safe Music Beds</h1>
      <p class="lead">Batch 009 的 1/3 号方向像音乐床但太响、太吵；2 号直接淘汰，因为有地狱/恐怖/压迫感。Batch 010 只做更安静的 music bed，并把 Calm 换成安全、温暖、非仪式感的版本。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
