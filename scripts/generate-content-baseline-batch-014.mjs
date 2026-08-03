import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-014');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-014');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-014-manifest.json');

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
    id: 'sleep_021_nap_soft_hold',
    title: 'Nap Soft Hold — Sleep',
    goal: 'sleep',
    scene: 'short_nap',
    finalGain: 1.08,
    thesis: 'A lighter nap variant: less downward pull than bedtime, still saveable and music-led.',
    sources: [
      src('batch_013_sleep_floor', 'public/audio/content-baseline/batch-013/sleep_020_return_sleep_soft_floor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.72],[42,0.78],[122,0.70],[168,0.50],[180,0.34]])}':eval=frame`, 'accepted return-sleep body, lighter for nap use', '94-97%'),
      src('tiny_soft_pad_lift', 'public/audio/music/procedural-approved-2026-07-13/procedural_return_to_sleep_soft.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=150,lowpass=f=1400,volume='${envelope([[0,0.000],[70,0.000],[110,0.006],[150,0.005],[180,0.000]])}':eval=frame`, 'barely-there lift, no noise', '1-3%'),
    ],
  },
  {
    id: 'sleep_022_late_night_blanket',
    title: 'Late Night Blanket — Sleep',
    goal: 'sleep',
    scene: 'late_night_reset',
    finalGain: 1.06,
    thesis: 'A darker late-night variant without mechanical low-end or noise bed.',
    sources: [
      src('batch_013_sleep_deeper', 'public/audio/content-baseline/batch-013/sleep_019_soft_descent_deeper.mp3', `atrim=16:${durationSeconds + 16},asetpts=PTS-STARTPTS,lowpass=f=2300,volume='${envelope([[0,0.70],[44,0.76],[118,0.66],[164,0.46],[180,0.30]])}':eval=frame`, 'accepted deeper sleep language, offset for variation', '94-97%'),
      src('tiny_rest_pad_release', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=1500,volume='${envelope([[0,0.000],[82,0.000],[124,0.006],[160,0.004],[180,0.000]])}':eval=frame`, 'small musical release only', '1-3%'),
    ],
  },
  {
    id: 'calm_017_morning_clear_room',
    title: 'Morning Clear Room — Calm',
    goal: 'calm',
    scene: 'morning_settle',
    finalGain: 1.10,
    thesis: 'A clearer calm variant for morning, warm but less sleepy.',
    sources: [
      src('batch_013_calm_warm', 'public/audio/content-baseline/batch-013/calm_015_warm_room_extended.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.70],[38,0.78],[116,0.70],[162,0.48],[180,0.30]])}':eval=frame`, 'accepted warm calm seed', '93-96%'),
      src('tiny_clear_pad_width', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=1600,volume='${envelope([[0,0.000],[58,0.000],[98,0.006],[142,0.005],[180,0.000]])}':eval=frame`, 'small clear width, no ritual resonance', '1-3%'),
    ],
  },
  {
    id: 'calm_018_evening_release',
    title: 'Evening Release — Calm',
    goal: 'calm',
    scene: 'evening_release',
    finalGain: 1.12,
    thesis: 'An evening reset sibling, safer and warmer than earlier resonance attempts.',
    sources: [
      src('batch_013_after_work', 'public/audio/content-baseline/batch-013/calm_016_after_work_settle.mp3', `atrim=8:${durationSeconds + 8},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.72],[42,0.80],[120,0.70],[164,0.48],[180,0.30]])}':eval=frame`, 'accepted after-work calm language', '93-96%'),
      src('tiny_sunset_release', 'public/audio/music/reviewed-2026-07-11/valley_sunset_pad.mp3', `atrim=30:${durationSeconds + 30},asetpts=PTS-STARTPTS,highpass=f=170,lowpass=f=1800,volume='${envelope([[0,0.000],[72,0.000],[110,0.007],[150,0.005],[180,0.000]])}':eval=frame`, 'small warm release, no dark resonance', '1-3%'),
    ],
  },
  {
    id: 'focus_020_reading_low_light',
    title: 'Reading Low Light — Focus',
    goal: 'focus',
    scene: 'reading_focus',
    finalGain: 1.14,
    thesis: 'A lighter focus variant for reading: music-led, low attention, no masking noise.',
    sources: [
      src('batch_013_open_focus', 'public/audio/content-baseline/batch-013/focus_019_open_low_attention.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.76],[54,0.84],[128,0.76],[170,0.54],[180,0.40]])}':eval=frame`, 'accepted open focus body', '94-97%'),
      src('tiny_low_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=900,volume='${envelope([[0,0.000],[84,0.000],[122,0.004],[160,0.003],[180,0.000]])}':eval=frame`, 'tiny anchor only, not a pulse engine', '1-3%'),
    ],
  },
  {
    id: 'focus_021_deep_work_stable',
    title: 'Deep Work Stable — Focus',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.15,
    thesis: 'A steadier deep-work sibling with the same save/replay formula.',
    sources: [
      src('batch_013_clear_focus', 'public/audio/content-baseline/batch-013/focus_018_low_workbed_clear.mp3', `atrim=12:${durationSeconds + 12},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.78],[58,0.86],[132,0.78],[170,0.58],[180,0.42]])}':eval=frame`, 'accepted clear focus language, offset for variation', '94-97%'),
      src('tiny_clean_support', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=130,lowpass=f=1100,volume='${envelope([[0,0.000],[76,0.000],[118,0.004],[156,0.003],[180,0.000]])}':eval=frame`, 'tiny clean support only', '1-3%'),
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
    correction: 'scale_batch_012_013_save_replay_formula',
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
  version: '2026-07-17.batch-014-scene-coverage-expansion',
  generatedAt: new Date().toISOString(),
  purpose: 'Expand the proven Batch 012/013 save-replay formula with scene coverage rather than near-duplicate count inflation.',
  inheritedPromotions: [
    'data/content-baseline/content-baseline-batch-012-promotion.json',
    'data/content-baseline/content-baseline-batch-013-promotion.json',
  ],
  hardGates: [
    'Reject if any candidate sounds like noise-bed content rather than music-led soundscape.',
    'Reject if support layers become foreground or exceed roughly 3 percent perceived share.',
    'Reject if candidates feel like title-only duplicates rather than useful scene variants.',
    'Reject if mechanical, hellish, horror-like, oppressive, or physically uncomfortable semantics return.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-014/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>场景目标：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>是否仍然愿意保存复听？场景差异是否成立？有没有重复灌水感？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 014 · Scene Coverage Expansion</title>
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
      <h1>Content Baseline Batch 014 · Scene Coverage Expansion</h1>
      <p class="lead">Batch 012/013 已证明公式可保存复听。Batch 014 不换方向，而是补场景：Nap、Late Night、Morning Calm、Evening Release、Reading Focus、Deep Work。目标是扩展覆盖，不做近似重复灌水。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
