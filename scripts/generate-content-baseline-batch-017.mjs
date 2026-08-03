import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-017');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-017');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-017-manifest.json');

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const envelope = (points) => {
  const parts = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ta, va] = points[i];
    const [tb, vb] = points[i + 1];
    const slope = (vb - va) / (tb - ta);
    parts.push(`if(lt(t\\,${tb})\\,${va.toFixed(4)}+${slope.toFixed(7)}*(t-${ta})\\,`);
  }
  return `${parts.join('')}${points.at(-1)[1].toFixed(4)}${')'.repeat(points.length - 1)}`;
};

const src = (role, relativePath, filter, note, share) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  filter,
  note,
  intendedPerceivedShare: share,
});

const specs = [
  {
    id: 'sleep_027_phone_down_bedtime',
    title: 'Phone Down Bedtime — Sleep',
    goal: 'sleep',
    scene: 'phone_down_bedtime',
    finalGain: 1.02,
    thesis: 'A quiet end-of-day sleep variant for putting the phone down: soft entry, stable body, no bright or festive emotion.',
    sources: [
      src('batch_016_anxious_bedtime_body', 'public/audio/content-baseline/batch-016/sleep_025_anxious_bedtime_soften.mp3', `atrim=6:${durationSeconds + 6},asetpts=PTS-STARTPTS,lowpass=f=2450,volume='${envelope([[0,0.70],[46,0.78],[116,0.69],[164,0.47],[180,0.30]])}':eval=frame`, 'accepted anxious-bedtime body, softened for routine bedtime', '96-98%'),
      src('tiny_deep_sleep_shadow', 'public/audio/music/procedural-approved-2026-07-13/procedural_deep_sleep_low.mp3', `atrim=22:${durationSeconds + 22},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=1150,volume='${envelope([[0,0.000],[90,0.000],[126,0.003],[158,0.002],[180,0.000]])}':eval=frame`, 'tiny low warmth only, not a drone foreground', '1-2%'),
    ],
  },
  {
    id: 'calm_023_after_work_release',
    title: 'After Work Release — Calm',
    goal: 'calm',
    scene: 'after_work_release',
    finalGain: 1.05,
    thesis: 'A calm transition after work: warm, unforced, and repeatable without becoming a song to actively listen to.',
    sources: [
      src('batch_016_weekend_body', 'public/audio/content-baseline/batch-016/calm_022_weekend_unwind.mp3', `atrim=10:${durationSeconds + 10},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.71],[42,0.80],[118,0.70],[164,0.48],[180,0.30]])}':eval=frame`, 'accepted weekend-unwind body, narrowed for weekday decompression', '95-98%'),
      src('tiny_calm_grounded_b', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=190,lowpass=f=1320,volume='${envelope([[0,0.000],[78,0.000],[116,0.0035],[150,0.0025],[180,0.000]])}':eval=frame`, 'tiny grounded contour only', '1-3%'),
    ],
  },
  {
    id: 'focus_026_reading_low_distraction',
    title: 'Reading Low Distraction — Focus',
    goal: 'focus',
    scene: 'reading_focus',
    finalGain: 1.08,
    thesis: 'A reading-focused workbed: lower motion than coding, enough body to mask the room without becoming obvious noise.',
    sources: [
      src('batch_016_study_body', 'public/audio/content-baseline/batch-016/focus_025_study_long_arc.mp3', `atrim=14:${durationSeconds + 14},asetpts=PTS-STARTPTS,lowpass=f=2600,volume='${envelope([[0,0.74],[54,0.83],[130,0.76],[170,0.54],[180,0.38]])}':eval=frame`, 'accepted study body, lowered for reading', '96-98%'),
      src('tiny_focus_low_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=980,volume='${envelope([[0,0.000],[86,0.000],[122,0.003],[158,0.002],[180,0.000]])}':eval=frame`, 'tiny low focus anchor only', '1-2%'),
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
    `${inputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},afade=t=in:st=0:d=2.2,afade=t=out:st=${durationSeconds - 8}:d=8,alimiter=limit=0.70[out]`,
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
    correction: 'close_internal_audible_product_baseline_30',
    contentClass: spec.goal === 'focus' ? 'focus_finished_soundscape_candidate' : 'finished_soundscape_candidate',
    thesis: spec.thesis,
    sources: spec.sources.map((item) => ({
      role: item.role,
      path: item.relativePath,
      note: item.note,
      intendedPerceivedShare: item.intendedPerceivedShare,
    })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-17.batch-017-closing-30-seed-baseline',
  generatedAt: new Date().toISOString(),
  purpose: 'Close the Internal Audible Product Baseline from 27 to 30 seeds with one high-retention use case per goal.',
  inheritedPromotions: [
    'data/content-baseline/content-baseline-batch-012-promotion.json',
    'data/content-baseline/content-baseline-batch-013-promotion.json',
    'data/content-baseline/content-baseline-batch-014-promotion.json',
    'data/content-baseline/content-baseline-batch-015-promotion.json',
    'data/content-baseline/content-baseline-batch-016-promotion.json',
  ],
  hardGates: [
    'Reject if a candidate exists only to pad the 30-item count.',
    'Reject if the piece becomes white-noise-led, mechanical, dark, horror-like, or physically uncomfortable.',
    'Reject if the support layer becomes a foreground hook.',
    'Reject if the opening is inaudible for 20-30 seconds or arrives with a forceful wash.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-017/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>需求目标：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>这是 30 条内部基线的收口批。只判断：是否愿意保存复听，且不是为了凑数的重复款？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 017 · Closing 30 Seeds</title>
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
      <h1>Content Baseline Batch 017 · Closing 30 Seeds</h1>
      <p class="lead">Batch 017 是 30 条 Internal Audible Product Baseline 的收口批：Phone Down Bedtime、After Work Release、Reading Low Distraction。仍然坚持音乐主体 + 极低支持层，不把白噪音、机械音或暗黑共鸣拉回前景。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
