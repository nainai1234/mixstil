import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-016');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-016');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-016-manifest.json');

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
    id: 'sleep_025_anxious_bedtime_soften',
    title: 'Anxious Bedtime Soften — Sleep',
    goal: 'sleep',
    scene: 'anxious_bedtime',
    finalGain: 1.03,
    thesis: 'A sleep variant for anxious bedtime: steady, soft, and non-dramatic, without dark resonance.',
    sources: [
      src('batch_015_restless_mind_body', 'public/audio/content-baseline/batch-015/sleep_024_restless_mind_downshift.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.72],[42,0.78],[116,0.68],[164,0.46],[180,0.28]])}':eval=frame`, 'accepted restless-mind sleep body', '94-97%'),
      src('tiny_rest_now_safety', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=170,lowpass=f=1400,volume='${envelope([[0,0.000],[82,0.000],[122,0.004],[158,0.003],[180,0.000]])}':eval=frame`, 'tiny warm safety layer only', '1-3%'),
    ],
  },
  {
    id: 'sleep_026_early_morning_return',
    title: 'Early Morning Return — Sleep',
    goal: 'sleep',
    scene: 'early_morning_return',
    finalGain: 1.02,
    thesis: 'A very low-arousal early-morning return-to-sleep variant: familiar, slow, and not attention-grabbing.',
    sources: [
      src('batch_015_travel_rest_body', 'public/audio/content-baseline/batch-015/sleep_023_travel_rest_shell.mp3', `atrim=20:${durationSeconds + 20},asetpts=PTS-STARTPTS,lowpass=f=2300,volume='${envelope([[0,0.68],[44,0.74],[118,0.64],[166,0.44],[180,0.28]])}':eval=frame`, 'accepted travel-rest body, softened for early morning', '95-98%'),
      src('tiny_return_sleep_shadow', 'public/audio/music/procedural-approved-2026-07-13/procedural_return_to_sleep_soft.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=170,lowpass=f=1250,volume='${envelope([[0,0.000],[92,0.000],[128,0.0035],[160,0.0025],[180,0.000]])}':eval=frame`, 'tiny musical return cue only', '1-2%'),
    ],
  },
  {
    id: 'calm_021_emotional_buffer',
    title: 'Emotional Buffer — Calm',
    goal: 'calm',
    scene: 'emotional_buffer',
    finalGain: 1.06,
    thesis: 'A calm buffer for emotional overload: warm, contained, and safe without becoming sleepy or ritual-like.',
    sources: [
      src('batch_015_midday_body', 'public/audio/content-baseline/batch-015/calm_019_midday_recenter.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.72],[38,0.80],[112,0.70],[160,0.48],[180,0.30]])}':eval=frame`, 'accepted midday recenter body', '94-97%'),
      src('tiny_grounded_calm_support', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_a.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=190,lowpass=f=1400,volume='${envelope([[0,0.000],[72,0.000],[110,0.0035],[148,0.0025],[180,0.000]])}':eval=frame`, 'tiny grounded support, no dark resonance', '1-3%'),
    ],
  },
  {
    id: 'calm_022_weekend_unwind',
    title: 'Weekend Unwind — Calm',
    goal: 'calm',
    scene: 'weekend_unwind',
    finalGain: 1.07,
    thesis: 'A slightly wider calm variant for unstructured downtime, still quiet enough to save and repeat.',
    sources: [
      src('batch_015_before_meeting_body', 'public/audio/content-baseline/batch-015/calm_020_before_meeting_settle.mp3', `atrim=18:${durationSeconds + 18},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.70],[42,0.78],[118,0.68],[164,0.46],[180,0.28]])}':eval=frame`, 'accepted pre-meeting calm language, loosened for weekend', '94-97%'),
      src('tiny_sunset_width', 'public/audio/music/reviewed-2026-07-11/valley_sunset_pad.mp3', `atrim=36:${durationSeconds + 36},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=1500,volume='${envelope([[0,0.000],[76,0.000],[114,0.004],[154,0.003],[180,0.000]])}':eval=frame`, 'tiny safe width, no bowl or ritual feel', '1-3%'),
    ],
  },
  {
    id: 'focus_024_coding_low_loop',
    title: 'Coding Low Loop — Focus',
    goal: 'focus',
    scene: 'coding_focus',
    finalGain: 1.09,
    thesis: 'A coding-focused workbed: stable, low attention, and less song-like than general focus.',
    sources: [
      src('batch_015_writing_body', 'public/audio/content-baseline/batch-015/focus_022_writing_flow_low.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.78],[56,0.86],[128,0.78],[170,0.56],[180,0.40]])}':eval=frame`, 'accepted writing focus body', '95-98%'),
      src('tiny_clean_code_support', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=150,lowpass=f=1000,volume='${envelope([[0,0.000],[86,0.000],[124,0.003],[158,0.002],[180,0.000]])}':eval=frame`, 'tiny clean support only', '1-2%'),
    ],
  },
  {
    id: 'focus_025_study_long_arc',
    title: 'Study Long Arc — Focus',
    goal: 'focus',
    scene: 'study_focus',
    finalGain: 1.10,
    thesis: 'A longer-study variant: gentle enough for extended listening, with low musical motion and no noise mask.',
    sources: [
      src('batch_015_low_energy_body', 'public/audio/content-baseline/batch-015/focus_023_low_energy_admin.mp3', `atrim=12:${durationSeconds + 12},asetpts=PTS-STARTPTS,volume='${envelope([[0,0.76],[58,0.84],[132,0.76],[170,0.54],[180,0.38]])}':eval=frame`, 'accepted low-energy focus body, offset for study', '95-98%'),
      src('tiny_focus_warmth', 'public/audio/music/local-review/2026-07-15/procedural_focus_warm_mid.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=190,lowpass=f=1200,volume='${envelope([[0,0.000],[82,0.000],[120,0.003],[156,0.002],[180,0.000]])}':eval=frame`, 'tiny warmth, not a melody', '1-2%'),
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
    correction: 'scale_batch_012_015_save_replay_formula',
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
  version: '2026-07-17.batch-016-specific-need-expansion',
  generatedAt: new Date().toISOString(),
  purpose: 'Continue expanding the proven save-replay formula from 21 to 27 seeds with specific user-need scenarios.',
  inheritedPromotions: [
    'data/content-baseline/content-baseline-batch-012-promotion.json',
    'data/content-baseline/content-baseline-batch-013-promotion.json',
    'data/content-baseline/content-baseline-batch-014-promotion.json',
    'data/content-baseline/content-baseline-batch-015-promotion.json',
  ],
  hardGates: [
    'Reject if any candidate sounds like noise-bed content rather than music-led soundscape.',
    'Reject if support layers become foreground or exceed roughly 3 percent perceived share.',
    'Reject if candidates feel like title-only duplicates rather than useful user-need variants.',
    'Reject if mechanical, hellish, horror-like, oppressive, or physically uncomfortable semantics return.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-016/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>需求目标：</strong>${item.thesis}</p>
        <p><strong>听审重点：</strong>是否仍然愿意保存复听？这个具体需求场景是否成立，而不是标题变化？</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 016 · Specific Need Expansion</title>
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
      <h1>Content Baseline Batch 016 · Specific Need Expansion</h1>
      <p class="lead">Batch 015 已到 21 条 seed。Batch 016 继续补更具体的需求：Anxious Bedtime、Early Morning Return、Emotional Buffer、Weekend Unwind、Coding Focus、Study Focus。仍然只沿用音乐床主体 + 极低支持层公式。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
