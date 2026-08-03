import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-013');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-013');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-013-manifest.json');

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
    id: 'sleep_019_soft_descent_deeper',
    title: 'Soft Descent Deeper — Sleep',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 1.12,
    thesis: 'A slightly deeper variant of the promoted Sleep seed, keeping the same saveable formula.',
    sources: [
      src('promoted_sleep_seed', 'public/audio/content-baseline/batch-012/sleep_018_saveable_soft_descent.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.78], [44, 0.82], [118, 0.72], [164, 0.50], [180, 0.34]])}':eval=frame`, 'Batch 012 promoted sleep seed remains the body', '92-96%'),
      src('deeper_sleep_shadow', 'public/audio/music/procedural-approved-2026-07-13/procedural_return_to_sleep_soft.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=1500,volume='${envelope([[0, 0.000], [58, 0.000], [96, 0.010], [146, 0.012], [180, 0.004]])}':eval=frame`, 'late soft musical shadow only', '2-4%'),
    ],
  },
  {
    id: 'sleep_020_return_sleep_soft_floor',
    title: 'Return Sleep Soft Floor — Sleep',
    goal: 'sleep',
    scene: 'return_to_sleep',
    finalGain: 1.10,
    thesis: 'A lower-arousal return-to-sleep sibling: less movement, still music-led and saveable.',
    sources: [
      src('promoted_sleep_seed_lower', 'public/audio/content-baseline/batch-012/sleep_018_saveable_soft_descent.mp3', `atrim=18:${durationSeconds + 18},asetpts=PTS-STARTPTS,lowpass=f=2400,volume='${envelope([[0, 0.66], [40, 0.70], [122, 0.62], [170, 0.44], [180, 0.30]])}':eval=frame`, 'same accepted sleep language, lower and slower', '94-97%'),
      src('minimal_rest_release', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=150,lowpass=f=1600,volume='${envelope([[0, 0.000], [84, 0.000], [122, 0.007], [160, 0.006], [180, 0.000]])}':eval=frame`, 'tiny release, no noise', '1-3%'),
    ],
  },
  {
    id: 'calm_015_warm_room_extended',
    title: 'Warm Room Extended — Calm',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 1.12,
    thesis: 'A warmer continuation of the promoted Calm seed without bowl, dark resonance, or ritual feel.',
    sources: [
      src('promoted_calm_seed', 'public/audio/content-baseline/batch-012/calm_014_saveable_warm_room.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.74], [44, 0.80], [126, 0.70], [164, 0.48], [180, 0.32]])}':eval=frame`, 'Batch 012 promoted calm seed remains the body', '92-96%'),
      src('warm_width_only', 'public/audio/music/reviewed-2026-07-11/valley_sunset_pad.mp3', `atrim=40:${durationSeconds + 40},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=2100,volume='${envelope([[0, 0.000], [64, 0.000], [100, 0.008], [142, 0.010], [180, 0.002]])}':eval=frame`, 'small safe width, no dark resonance', '2-4%'),
    ],
  },
  {
    id: 'calm_016_after_work_settle',
    title: 'After Work Settle — Calm',
    goal: 'calm',
    scene: 'after_work_settling',
    finalGain: 1.14,
    thesis: 'A calmer day-to-evening variant: still music-led, safe, and non-dramatic.',
    sources: [
      src('promoted_calm_seed_softer', 'public/audio/content-baseline/batch-012/calm_014_saveable_warm_room.mp3', `atrim=10:${durationSeconds + 10},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.70], [38, 0.76], [116, 0.68], [158, 0.46], [180, 0.28]])}':eval=frame`, 'accepted calm language, slightly softer entry', '92-96%'),
      src('grounded_calm_body', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_a.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=1700,volume='${envelope([[0, 0.000], [52, 0.000], [92, 0.007], [138, 0.008], [180, 0.002]])}':eval=frame`, 'tiny grounded musical support', '2-4%'),
    ],
  },
  {
    id: 'focus_018_low_workbed_clear',
    title: 'Low Workbed Clear — Focus',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.16,
    thesis: 'A clearer focus sibling of the promoted Focus seed, still low and non-distracting.',
    sources: [
      src('promoted_focus_seed', 'public/audio/content-baseline/batch-012/focus_017_saveable_low_workbed.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.82], [56, 0.88], [132, 0.78], [172, 0.58], [180, 0.44]])}':eval=frame`, 'Batch 012 promoted focus seed remains the body', '94-97%'),
      src('clean_focus_hint', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=130,lowpass=f=1200,volume='${envelope([[0, 0.000], [76, 0.000], [116, 0.006], [154, 0.004], [180, 0.000]])}':eval=frame`, 'barely-there clean support, not a lead', '1-3%'),
    ],
  },
  {
    id: 'focus_019_open_low_attention',
    title: 'Open Low Attention — Focus',
    goal: 'focus',
    scene: 'light_focus',
    finalGain: 1.15,
    thesis: 'A slightly more open focus version for lighter work, avoiding noise masks and busy music.',
    sources: [
      src('promoted_focus_seed_open', 'public/audio/content-baseline/batch-012/focus_017_saveable_low_workbed.mp3', `atrim=24:${durationSeconds + 24},asetpts=PTS-STARTPTS,volume='${envelope([[0, 0.76], [56, 0.84], [128, 0.76], [170, 0.52], [180, 0.38]])}':eval=frame`, 'accepted focus language with a more open offset', '94-97%'),
      src('tiny_warm_mid_support', 'public/audio/music/local-review/2026-07-15/procedural_focus_warm_mid.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=1500,volume='${envelope([[0, 0.000], [68, 0.000], [110, 0.006], [148, 0.004], [180, 0.000]])}':eval=frame`, 'tiny musical warmth, not a melody', '1-3%'),
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
    correction: 'scale_batch_012_save_replay_formula',
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
  version: '2026-07-17.batch-013-scale-saveable-formula',
  generatedAt: new Date().toISOString(),
  purpose: 'Scale the promoted Batch 012 save/replay formula from 3 seeds to 6 nearby finished soundscape candidates.',
  inheritedPromotion: 'data/content-baseline/content-baseline-batch-012-promotion.json',
  hardGates: [
    'Reject if any candidate sounds like noise-bed content rather than music-led soundscape.',
    'Reject if any candidate reintroduces mechanical, hellish, horror-like, oppressive, or physically uncomfortable semantics.',
    'Reject if added support layers become foreground or exceed roughly 5 percent perceived share.',
    'Reject if candidates feel like trivial duplicates rather than useful nearby variants.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-013/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>扩展目标：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>是否延续 Batch 012 的“愿意保存复听”感觉？是否没有噪声、机械、恐怖、太吵的问题？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 013 · Scale Saveable Formula</title>
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
      <h1>Content Baseline Batch 013 · Scale Saveable Formula</h1>
      <p class="lead">Batch 012 已经作为第一组可保存复听的 seed。Batch 013 不换方向，只验证这条公式能否稳定扩展到 6 条：音乐床主体，极低支持层，不回到噪声、机械或恐怖共振。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
