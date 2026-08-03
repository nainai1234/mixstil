import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 150);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-003');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-003');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-003-manifest.json');
const briefsPath = path.join(root, 'data/content-baseline/finished-content-briefs-v1.json');
const briefs = JSON.parse(fs.readFileSync(briefsPath, 'utf8')).briefs;

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const byId = new Map(briefs.map((brief) => [brief.id, brief]));

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
    id: 'sleep_007_no_water_bedtime_pad',
    titleSuffix: 'Arrangement Arc',
    targetLufs: -26,
    stateArc: 'room protection -> low masking settles body -> music appears briefly -> environment and pad recede',
    listeningQuestion: 'Does this feel like being guided toward bedtime, or does the piano still simply become a song?',
    sources: [
      noiseSource('structured_masking_transition', 'brown', 0.10, 3001, `lowpass=f=650,volume='${envelope([[0, 0.12], [28, 0.09], [78, 0.052], [118, 0.070], [150, 0.035]])}':eval=frame`, 'brown tone opens the room and later returns as a soft landing'),
      fileSource('warm_pad_state_layer', 'public/audio/production-remediated-2026-07-13/music/vastness_ambient_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=4200,volume='${envelope([[0, 0.00], [18, 0.08], [60, 0.18], [112, 0.13], [150, 0.03]])}':eval=frame`, 'pad enters before music to make the piano feel held'),
      fileSource('brief_music_memory', 'public/audio/production-remediated-2026-07-13/music/possible_dreams_piano.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=5200,volume='${envelope([[0, 0.00], [35, 0.00], [55, 0.20], [88, 0.17], [120, 0.04], [150, 0.00]])}':eval=frame`, 'music becomes a middle-section cue, not the whole point'),
      fileSource('distant_night_edge', 'public/audio/nature/batch-04/night_forest_insects.wav', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=2300,volume='${envelope([[0, 0.00], [70, 0.00], [102, 0.025], [135, 0.018], [150, 0.00]])}':eval=frame`, 'barely present late-night edge after the music drops'),
    ],
  },
  {
    id: 'sleep_009_gentle_train_night',
    titleSuffix: 'Carriage Descent',
    targetLufs: -26,
    stateArc: 'carriage rhythm first -> music breathes in -> rail texture becomes sleep mask -> music leaves',
    listeningQuestion: 'Does the train/music relationship feel composed enough to become sleep, not travel ambience plus piano?',
    sources: [
      fileSource('carriage_identity', 'public/audio/music/revised-collection-qa/2026-07-14/quiet_train_focus.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=1700,volume='${envelope([[0, 0.10], [24, 0.13], [75, 0.10], [122, 0.14], [150, 0.07]])}':eval=frame`, 'rail bed is the stable body rhythm'),
      noiseSource('soft_brown_suspension', 'brown', 0.08, 3002, `lowpass=f=520,volume='${envelope([[0, 0.02], [35, 0.055], [90, 0.07], [130, 0.05], [150, 0.02]])}':eval=frame`, 'masking rises only after the rhythm is established'),
      fileSource('low_piano_breath', 'public/audio/production-remediated-2026-07-13/music/dreaming_soft_piano.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=4700,volume='${envelope([[0, 0.00], [26, 0.00], [50, 0.16], [84, 0.13], [112, 0.045], [150, 0.00]])}':eval=frame`, 'piano is a descent cue rather than the foreground'),
    ],
  },
  {
    id: 'calm_004_soft_bell_exhale',
    titleSuffix: 'Exhale Cycle',
    targetLufs: -24,
    stateArc: 'quiet air -> resonant cue -> long tail -> open space -> second cue lower in attention',
    listeningQuestion: 'Do the bell events feel like breath/exhale guidance without becoming a repeated meditation cliché?',
    sources: [
      noiseSource('soft_air_opening', 'pink', 0.045, 3003, `highpass=f=180,lowpass=f=2300,volume='${envelope([[0, 0.055], [24, 0.04], [62, 0.028], [104, 0.038], [150, 0.018]])}':eval=frame`, 'soft air gives breath space and changes level across cycles'),
      fileSource('resonant_bell_cycle', 'public/audio/production-remediated-2026-07-13/music/crystal_meditation.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=7600,volume='${envelope([[0, 0.00], [12, 0.03], [32, 0.28], [60, 0.12], [92, 0.06], [122, 0.18], [150, 0.045]])}':eval=frame`, 'bell/bowl comes in waves, not as constant music'),
      toneSource('low_body_anchor', 110, `lowpass=f=260,volume='${envelope([[0, 0.00], [18, 0.018], [75, 0.025], [118, 0.018], [150, 0.00]])}':eval=frame`, 'subtle low anchor for body settling'),
    ],
  },
  {
    id: 'calm_006_gentle_guitar_horizon',
    titleSuffix: 'Unwind Mix',
    targetLufs: -24,
    stateArc: 'room tone and soft air first -> guitar arrives as warmth -> forest opens after the body settles -> guitar steps back',
    listeningQuestion: 'Does the guitar become part of unwinding, or does it still read as an ordinary song?',
    sources: [
      fileSource('soft_room_base', 'public/audio/music/revised-collection-qa/2026-07-14/dry_quiet_room.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=2000,volume='${envelope([[0, 0.06], [35, 0.052], [86, 0.035], [126, 0.05], [150, 0.025]])}':eval=frame`, 'room tone makes the guitar feel placed in a body-safe space'),
      fileSource('guitar_warmth', 'public/audio/music/batch-03/relaxing_nature_guitar.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=6800,volume='${envelope([[0, 0.00], [20, 0.00], [44, 0.23], [82, 0.19], [112, 0.10], [150, 0.02]])}':eval=frame`, 'guitar arrives after the room, then yields'),
      fileSource('forest_afterimage', 'public/audio/nature/batch-04/forest_river_birds.wav', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=2500,volume='${envelope([[0, 0.00], [64, 0.00], [92, 0.034], [128, 0.028], [150, 0.00]])}':eval=frame`, 'environment appears as afterimage, not constant wallpaper'),
    ],
  },
  {
    id: 'focus_010_open_air_concentration',
    titleSuffix: 'Attention Arc',
    targetLufs: -23,
    stateArc: 'clean masking establishes attention -> guitar contour enters lightly -> air opens -> music reduces into steady work bed',
    listeningQuestion: 'Does it make you start working, or does it pull you into listening to the track?',
    sources: [
      noiseSource('light_focus_mask', 'pink', 0.055, 3005, `highpass=f=220,lowpass=f=3400,volume='${envelope([[0, 0.050], [22, 0.065], [72, 0.052], [118, 0.058], [150, 0.042]])}':eval=frame`, 'functional masking with small movement, not static noise'),
      fileSource('restrained_guitar_contour', 'public/audio/music/batch-03/relaxing_nature_guitar.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=150,lowpass=f=5600,volume='${envelope([[0, 0.00], [18, 0.00], [38, 0.13], [72, 0.11], [102, 0.06], [150, 0.025]])}':eval=frame`, 'music is a starting contour, then moves behind attention'),
      fileSource('open_air_edge', 'public/audio/nature/batch-04/river_shore_crickets.wav', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=220,lowpass=f=2200,volume='${envelope([[0, 0.00], [55, 0.00], [86, 0.024], [125, 0.02], [150, 0.00]])}':eval=frame`, 'open air appears after attention has stabilized'),
      toneSource('low_focus_anchor', 130.81, `lowpass=f=320,volume='${envelope([[0, 0.010], [28, 0.018], [94, 0.014], [150, 0.006]])}':eval=frame`, 'very low tonal anchor for continuity'),
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
    `${mixInputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,alimiter=limit=0.82,loudnorm=I=${spec.targetLufs}:LRA=10:TP=-2[out]`,
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
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    productionCorrection: 'batch_002_music_source_attractive_but_mix_not_stateful',
    stateArc: spec.stateArc,
    listeningQuestion: spec.listeningQuestion,
    sources: spec.sources.map((source) => ({
      role: source.role,
      path: source.relativePath,
      note: source.note,
    })),
    limitations: [
      'Arrangement-level state-transition preview; not a final commercial master.',
      'Generated noise/tone layers are allowed only as automated transitions, anchors, or masking support.',
      'Requires human listening for state change, layer harmony, fatigue, and save-worthiness before promotion.',
    ],
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-003-arrangement-state-transition',
  generatedAt: new Date().toISOString(),
  purpose: 'Arrangement correction after Batch 002 proved the music source can attract saving, but the whole mix did not create therapeutic, meditation, focus, or personalized soundscape value.',
  hardGates: [
    'Reject if the value comes only from the music source rather than the full mix.',
    'Reject if noise or environment remains a static bed instead of a structured transition or support layer.',
    'Reject if the candidate feels like ordinary listening instead of helping enter sleep, calm, or focus.',
  ],
  selection: {
    sleep: rendered.filter((item) => item.goal === 'sleep').length,
    calm: rendered.filter((item) => item.goal === 'calm').length,
    focus: rendered.filter((item) => item.goal === 'focus').length,
  },
  candidates: rendered,
  reviewPage: '/review/content-baseline-batch-003/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const reviewAudioSrc = (item) => `../../${item.outputUrl.replace(/^\//, '')}`;

const cards = rendered.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="${reviewAudioSrc(item)}"></audio>
        <p class="intent">${item.stateArc}</p>
        <p><strong>听审问题：</strong>${item.listeningQuestion}</p>
        <p class="sources">${item.sources.map((source) => `${source.role}: ${source.note}`).join('<br />')}</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 003</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d1016; color: #f6efe6; }
      main { max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d5c8bb; line-height: 1.58; margin-bottom: 22px; }
      .warning { border-left: 3px solid #91d6a4; padding-left: 12px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 16px; background: rgba(255,255,255,.055); }
      .meta { color: #91d6a4; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d5c8bb; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff1c7; }
      .intent { color: #f3dbc2; }
      .sources { color: #9ea7b7; font-size: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 003</h1>
      <p class="lead warning">Batch 002 证明音乐素材会吸引人保存，但混合体没有形成疗愈/冥想/专注状态。Batch 003 改测“安排型声景”：音乐、环境、遮蔽、空白和音量起伏必须共同完成一个进入状态的过程。</p>
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
