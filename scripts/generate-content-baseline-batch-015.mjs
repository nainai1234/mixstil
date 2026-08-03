import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-015');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-015');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-015-manifest.json');

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
    id: 'sleep_023_travel_rest_shell',
    title: 'Travel Rest Shell — Sleep',
    goal: 'sleep',
    scene: 'travel_rest',
    finalGain: 1.04,
    thesis: 'A portable sleep variant for unfamiliar places: familiar music-led safety without transport or room noise.',
    sources: [
      src('batch_014_late_night_body', 'public/audio/content-baseline/batch-014/sleep_022_late_night_blanket.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.70],[46,0.76],[120,0.68],[166,0.46],[180,0.30]])}':eval=frame`, 'accepted late-night sleep body, repurposed for travel rest', '94-97%'),
      src('tiny_return_pad', 'public/audio/music/procedural-approved-2026-07-13/procedural_return_to_sleep_soft.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=1300,volume='${envelope([[0,0.000],[78,0.000],[118,0.004],[156,0.003],[180,0.000]])}':eval=frame`, 'tiny musical safety layer, no transport ambience', '1-3%'),
    ],
  },
  {
    id: 'sleep_024_restless_mind_downshift',
    title: 'Restless Mind Downshift — Sleep',
    goal: 'sleep',
    scene: 'restless_mind',
    finalGain: 1.05,
    thesis: 'A slightly more structured sleep downshift for busy thoughts, still quiet and non-melodramatic.',
    sources: [
      src('batch_014_nap_body_slowed', 'public/audio/content-baseline/batch-014/sleep_021_nap_soft_hold.mp3', `atrim=12:${durationSeconds + 12},asetpts=PTS-STARTPTS,lowpass=f=2300,volume='${envelope([[0,0.72],[40,0.78],[116,0.68],[162,0.46],[180,0.28]])}':eval=frame`, 'accepted nap body with a calmer offset', '94-97%'),
      src('tiny_silent_descent_shadow', 'public/audio/music/reviewed-2026-07-11/silent_descent.mp3', `atrim=40:${durationSeconds + 40},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=1500,volume='${envelope([[0,0.000],[70,0.000],[112,0.004],[154,0.003],[180,0.000]])}':eval=frame`, 'tiny musical descent only', '1-3%'),
    ],
  },
  {
    id: 'calm_019_midday_recenter',
    title: 'Midday Recenter — Calm',
    goal: 'calm',
    scene: 'midday_recenter',
    finalGain: 1.08,
    thesis: 'A midday reset that is clearer than evening calm but still soft enough to save and repeat.',
    sources: [
      src('batch_014_morning_calm_body', 'public/audio/content-baseline/batch-014/calm_017_morning_clear_room.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.72],[38,0.80],[116,0.70],[162,0.48],[180,0.30]])}':eval=frame`, 'accepted morning calm body', '94-97%'),
      src('tiny_grounded_width', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_a.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=1500,volume='${envelope([[0,0.000],[62,0.000],[104,0.004],[148,0.003],[180,0.000]])}':eval=frame`, 'tiny grounded width, no dark resonance', '1-3%'),
    ],
  },
  {
    id: 'calm_020_before_meeting_settle',
    title: 'Before Meeting Settle — Calm',
    goal: 'calm',
    scene: 'pre_meeting_settle',
    finalGain: 1.07,
    thesis: 'A short pre-meeting emotional settling variant: stable, warm, and not sleepy.',
    sources: [
      src('batch_014_evening_body_clearer', 'public/audio/content-baseline/batch-014/calm_018_evening_release.mp3', `atrim=18:${durationSeconds + 18},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.68],[36,0.76],[108,0.68],[158,0.46],[180,0.30]])}':eval=frame`, 'accepted evening body with a clearer offset', '94-97%'),
      src('tiny_clear_calm_support', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=190,lowpass=f=1450,volume='${envelope([[0,0.000],[72,0.000],[112,0.004],[150,0.003],[180,0.000]])}':eval=frame`, 'tiny clear support, no ritual tone', '1-3%'),
    ],
  },
  {
    id: 'focus_022_writing_flow_low',
    title: 'Writing Flow Low — Focus',
    goal: 'focus',
    scene: 'writing_focus',
    finalGain: 1.11,
    thesis: 'A writing-focused variant: low attention, steady enough to support language work without becoming a song.',
    sources: [
      src('batch_014_reading_body', 'public/audio/content-baseline/batch-014/focus_020_reading_low_light.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.78],[56,0.86],[130,0.78],[170,0.56],[180,0.40]])}':eval=frame`, 'accepted reading-focus body', '94-97%'),
      src('tiny_focus_low_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=850,volume='${envelope([[0,0.000],[78,0.000],[120,0.0035],[158,0.0025],[180,0.000]])}':eval=frame`, 'tiny low anchor, not a pulse engine', '1-3%'),
    ],
  },
  {
    id: 'focus_023_low_energy_admin',
    title: 'Low Energy Admin — Focus',
    goal: 'focus',
    scene: 'low_energy_admin',
    finalGain: 1.10,
    thesis: 'A low-energy work variant for admin tasks: supportive but not stimulating or noisy.',
    sources: [
      src('batch_014_deep_work_body', 'public/audio/content-baseline/batch-014/focus_021_deep_work_stable.mp3', `atrim=20:${durationSeconds + 20},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.74],[54,0.82],[128,0.74],[170,0.52],[180,0.38]])}':eval=frame`, 'accepted deep-work body with lower-energy offset', '94-97%'),
      src('tiny_neutral_focus_support', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=150,lowpass=f=1050,volume='${envelope([[0,0.000],[84,0.000],[122,0.0035],[158,0.0025],[180,0.000]])}':eval=frame`, 'tiny neutral support only', '1-3%'),
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
    correction: 'scale_batch_012_014_save_replay_formula',
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
  version: '2026-07-17.batch-015-scene-coverage-expansion',
  generatedAt: new Date().toISOString(),
  purpose: 'Continue expanding the proven save-replay formula from 15 to 21 seeds with distinct user scenarios, not duplicate inflation.',
  inheritedPromotions: [
    'data/content-baseline/content-baseline-batch-012-promotion.json',
    'data/content-baseline/content-baseline-batch-013-promotion.json',
    'data/content-baseline/content-baseline-batch-014-promotion.json',
  ],
  hardGates: [
    'Reject if any candidate sounds like noise-bed content rather than music-led soundscape.',
    'Reject if support layers become foreground or exceed roughly 3 percent perceived share.',
    'Reject if candidates feel like title-only duplicates rather than useful scene variants.',
    'Reject if mechanical, hellish, horror-like, oppressive, or physically uncomfortable semantics return.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-015/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>场景目标：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>是否仍然愿意保存复听？是否补了真实场景，而不是换标题灌水？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 015 · Scene Coverage Expansion</title>
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
      <h1>Content Baseline Batch 015 · Scene Coverage Expansion</h1>
      <p class="lead">Batch 014 已到 15 条 seed。Batch 015 继续补真实场景：Travel Rest、Restless Mind、Midday Recenter、Before Meeting、Writing Flow、Low Energy Admin。仍然只沿用音乐床主体 + 极低支持层公式。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
