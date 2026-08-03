import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-004');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-004');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-004-manifest.json');
const briefsPath = path.join(root, 'data/content-baseline/finished-content-briefs-v1.json');
const briefs = JSON.parse(fs.readFileSync(briefsPath, 'utf8')).briefs;
const byId = new Map(briefs.map((brief) => [brief.id, brief]));

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

const fileSource = (role, relativePath, filter, note) => ({
  kind: 'file',
  role,
  relativePath,
  path: path.join(root, relativePath),
  filter,
  note,
});

const noiseSource = (role, color, amplitude, seed, filter, note) => ({
  kind: 'lavfi',
  role,
  relativePath: `generated://${color}-noise-${seed}`,
  input: `anoisesrc=color=${color}:amplitude=${amplitude}:duration=${durationSeconds}:sample_rate=48000:seed=${seed}`,
  filter,
  note,
});

const toneSource = (role, frequency, filter, note) => ({
  kind: 'lavfi',
  role,
  relativePath: `generated://sine-${frequency}`,
  input: `sine=frequency=${frequency}:duration=${durationSeconds}:sample_rate=48000`,
  filter,
  note,
});

const specs = [
  {
    id: 'sleep_001_quiet_room_cocoon',
    titleSuffix: 'Slow Entry',
    targetLufs: -29,
    openingMaxGain: 0.026,
    stateArc: 'near-silence room -> low shelter appears -> pad warms the space -> small music memory -> everything lowers again',
    listeningQuestion: 'First judge only the first 30 seconds: does it invite you in quietly, or does it still announce itself too loudly?',
    sources: [
      fileSource('barely_there_bedroom_air', 'public/audio/supply-gap-batch-01-loop-qa/2026-07-15/room_bedroom_night.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1450,volume='${envelope([[0, 0.010], [30, 0.022], [85, 0.030], [145, 0.024], [180, 0.014]])}':eval=frame`, 'the first layer is room air, not noise'),
      noiseSource('low_shelter_only_after_entry', 'brown', 0.030, 4001, `lowpass=f=260,volume='${envelope([[0, 0.000], [28, 0.000], [62, 0.026], [126, 0.020], [180, 0.009]])}':eval=frame`, 'brown support waits until the room is established'),
      fileSource('warm_pad_below_attention', 'public/audio/production-remediated-2026-07-13/music/nap_time_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=3000,volume='${envelope([[0, 0.000], [40, 0.000], [82, 0.070], [135, 0.052], [180, 0.012]])}':eval=frame`, 'pad rises slowly and never becomes a foreground song'),
      fileSource('short_piano_memory', 'public/audio/production-remediated-2026-07-13/music/dreaming_soft_piano.mp3', `atrim=18:${durationSeconds + 18},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=4200,volume='${envelope([[0, 0.000], [76, 0.000], [112, 0.045], [144, 0.028], [180, 0.000]])}':eval=frame`, 'the piano appears late as a memory, then leaves'),
    ],
  },
  {
    id: 'sleep_006_return_to_sleep_cabin',
    titleSuffix: 'No-Startle Return',
    targetLufs: -29,
    openingMaxGain: 0.024,
    stateArc: 'dark room first -> fan-like warmth enters under hearing -> one soft harmonic lift -> stable low room for returning to sleep',
    listeningQuestion: 'Does this feel safe enough for waking at night, when any sudden brightness would make you stop listening?',
    sources: [
      fileSource('dark_room_floor', 'public/audio/music/revised-collection-qa/2026-07-14/dry_quiet_room.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1300,volume='${envelope([[0, 0.012], [34, 0.024], [96, 0.026], [150, 0.022], [180, 0.014]])}':eval=frame`, 'dry room keeps the opening soft and non-scenic'),
      fileSource('low_fan_warmth', 'public/audio/music/revised-collection-qa/2026-07-14/low_fan_night.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=620,volume='${envelope([[0, 0.000], [36, 0.000], [74, 0.042], [138, 0.036], [180, 0.020]])}':eval=frame`, 'fan warmth replaces obvious white noise'),
      fileSource('distant_soft_pad', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=2800,volume='${envelope([[0, 0.000], [58, 0.000], [98, 0.050], [132, 0.034], [180, 0.006]])}':eval=frame`, 'one slow harmonic lift, then it drops behind the room'),
      toneSource('subtle_body_anchor', 82.41, `lowpass=f=190,volume='${envelope([[0, 0.000], [70, 0.000], [112, 0.012], [154, 0.010], [180, 0.000]])}':eval=frame`, 'barely audible low anchor for continuity'),
    ],
  },
  {
    id: 'calm_005_open_room_meditation',
    titleSuffix: 'Quiet Breath Space',
    targetLufs: -31,
    openingMaxGain: 0.030,
    stateArc: 'empty room -> breath-space air -> warm harmonic floor -> one resonant cue -> long quiet tail',
    listeningQuestion: 'Without any voice, does the timing still suggest a slower breath instead of just ambient music with effects?',
    sources: [
      fileSource('open_room_start', 'public/audio/authentic-indoor-review/2026-07-14/room_apartment_small.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1600,volume='${envelope([[0, 0.007], [28, 0.019], [86, 0.020], [138, 0.022], [180, 0.010]])}':eval=frame`, 'room opens gently before any musical signal'),
      noiseSource('soft_exhale_air', 'pink', 0.020, 4003, `highpass=f=220,lowpass=f=1800,volume='${envelope([[0, 0.000], [34, 0.000], [72, 0.020], [118, 0.014], [180, 0.006]])}':eval=frame`, 'air is used as exhale texture, not a blanket hiss'),
      fileSource('meditation_floor', 'public/audio/music/local-review/2026-07-14/procedural_meditation_open_a.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=3600,volume='${envelope([[0, 0.000], [48, 0.000], [92, 0.065], [142, 0.044], [180, 0.010]])}':eval=frame`, 'warm floor enters only after the room feels settled'),
      fileSource('single_resonant_cue', 'public/audio/production-remediated-2026-07-13/music/crystal_meditation.mp3', `atrim=28:${durationSeconds + 28},asetpts=PTS-STARTPTS,lowpass=f=5200,volume='${envelope([[0, 0.000], [92, 0.000], [122, 0.050], [154, 0.018], [180, 0.000]])}':eval=frame`, 'one late cue, not repeated bell decoration'),
    ],
  },
  {
    id: 'focus_002_neutral_office_flow',
    titleSuffix: 'Soft Start Work Bed',
    targetLufs: -29,
    openingMaxGain: 0.035,
    stateArc: 'quiet office distance -> low focus anchor -> light harmonic contour -> stable work bed without foreground events',
    listeningQuestion: 'Does it make starting work easier without making you listen to the composition itself?',
    sources: [
      fileSource('quiet_office_distance', 'public/audio/supply-gap-batch-01-loop-qa/2026-07-15/room_office_distant_traffic.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=85,lowpass=f=1900,volume='${envelope([[0, 0.008], [26, 0.024], [78, 0.040], [138, 0.038], [180, 0.024]])}':eval=frame`, 'opening layer: real distant room/traffic texture replaces synthetic hiss'),
      fileSource('low_focus_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=900,volume='${envelope([[0, 0.000], [24, 0.000], [60, 0.040], [130, 0.034], [180, 0.018]])}':eval=frame`, 'anchor rises after the office texture, not at play start'),
      fileSource('restrained_work_contour', 'public/audio/music/local-review/2026-07-15/procedural_focus_warm_mid.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=3000,volume='${envelope([[0, 0.000], [54, 0.000], [94, 0.050], [138, 0.038], [180, 0.014]])}':eval=frame`, 'small harmonic contour gives identity without melody attention'),
      noiseSource('almost_invisible_masking', 'pink', 0.016, 4004, `highpass=f=280,lowpass=f=2200,volume='${envelope([[0, 0.000], [70, 0.000], [108, 0.016], [150, 0.012], [180, 0.004]])}':eval=frame`, 'masking comes late and low, never as the content identity'),
    ],
  },
];

const assertInputs = (spec) => {
  for (const source of spec.sources) {
    if (source.kind === 'file' && !fs.existsSync(source.path)) {
      throw new Error(`Missing source for ${spec.id}: ${source.relativePath}`);
    }
  }
};

const inputArgsFor = (source) => {
  if (source.kind === 'lavfi') return ['-f', 'lavfi', '-i', source.input];
  return ['-stream_loop', '-1', '-i', source.path];
};

const render = (spec) => {
  assertInputs(spec);
  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const source of spec.sources) args.push(...inputArgsFor(source));
  const filtered = spec.sources.map((source, index) => `[${index}:a]${source.filter}[a${index}]`);
  const mixInputs = spec.sources.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${mixInputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,alimiter=limit=0.72,loudnorm=I=${spec.targetLufs}:LRA=11:TP=-3[out]`,
  ].join(';');
  args.push('-filter_complex', filterComplex, '-map', '[out]', '-t', String(durationSeconds), '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath);
  execFileSync('ffmpeg', args, { cwd: root, stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
  return outputPath;
};

const probe = (filePath) => {
  const raw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  const parsed = JSON.parse(raw);
  return {
    durationSeconds: Number(parsed.format.duration),
    sizeBytes: Number(parsed.format.size),
  };
};

const rendered = specs.map((spec) => {
  const brief = byId.get(spec.id);
  if (!brief) throw new Error(`Missing brief ${spec.id}`);
  const outputPath = render(spec);
  const relativePath = path.relative(root, outputPath);
  return {
    id: spec.id,
    title: `${brief.title} — ${spec.titleSuffix}`,
    goal: brief.goal,
    scene: brief.scene,
    sourceBriefDurationMinutes: brief.durationMinutes,
    previewDurationSeconds: durationSeconds,
    targetLufs: spec.targetLufs,
    openingMaxGain: spec.openingMaxGain,
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    productionCorrection: 'batch_003_process_better_but_opening_too_loud_and_not_state_inducing',
    stateArc: spec.stateArc,
    listeningQuestion: spec.listeningQuestion,
    sources: spec.sources.map((source) => ({
      role: source.role,
      path: source.relativePath,
      note: source.note,
    })),
    limitations: [
      'Quiet-entry arrangement preview; not a final commercial master.',
      'Noise layers are intentionally delayed and low; reject if they still feel like the main content.',
      'Human listening must confirm state entry, softness, fatigue, and replay value before promotion.',
    ],
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-004-quiet-entry-state-entry',
  generatedAt: new Date().toISOString(),
  purpose: 'Correct Batch 003 feedback: it had a process, but opened too loudly, felt forced, and did not help the listener enter sleep, meditation, calm, or focus.',
  hardGates: [
    'Reject if the first 20-30 seconds feel like a loud arrival instead of a quiet invitation.',
    'Reject if the noise layer becomes the content identity.',
    'Reject if music and environment feel glued together rather than slowly revealed.',
    'Reject if the result is merely listenable music and not a state-entry soundscape.',
  ],
  selection: {
    sleep: rendered.filter((item) => item.goal === 'sleep').length,
    calm: rendered.filter((item) => item.goal === 'calm').length,
    focus: rendered.filter((item) => item.goal === 'focus').length,
  },
  candidates: rendered,
  reviewPage: '/review/content-baseline-batch-004/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const reviewAudioSrc = (item) => `../../${item.outputUrl.replace(/^\//, '')}`;

const cards = rendered.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="${reviewAudioSrc(item)}"></audio>
        <p class="intent">${item.stateArc}</p>
        <p><strong>这次只听三件事：</strong>① 开头有没有安静地邀请你进入；② 噪音有没有退到后面；③ 90 秒后是否更接近睡眠/冥想/专注，而不是“在听一首歌”。</p>
        <p><strong>听审问题：</strong>${item.listeningQuestion}</p>
        <p class="sources">${item.sources.map((source) => `${source.role}: ${source.note}`).join('<br />')}</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 004</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #090c12; color: #f7efe6; }
      main { max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d7c9ba; line-height: 1.58; margin-bottom: 22px; }
      .warning { border-left: 3px solid #a9dcb4; padding-left: 12px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.052); }
      .meta { color: #a9dcb4; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d7c9ba; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff1c7; }
      .intent { color: #f2d9bd; }
      .sources { color: #9fa9b8; font-size: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 004</h1>
      <p class="lead warning">Batch 003 的有效学习是“过程感”成立，但失败点也清楚：开头太响、白噪存在感过强、音乐/环境像被硬塞在一起，最终没有进入睡眠/冥想/放松。Batch 004 改成“极安静进入”：前 20–30 秒不抢人，音乐和支撑层慢慢显影。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  candidates: rendered.length,
  manifest: path.relative(root, manifestPath),
  reviewPage: manifest.reviewPage,
}, null, 2));
