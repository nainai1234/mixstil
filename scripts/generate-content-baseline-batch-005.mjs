import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-005');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-005');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-005-manifest.json');
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

const specs = [
  {
    id: 'sleep_007_no_water_bedtime_pad',
    titleSuffix: 'Music-Led Descent',
    finalGain: 2.4,
    designRule: 'no white/pink/brown noise; music carries the descent; room is only spatial glue',
    stateArc: 'soft piano already present -> pad arrives underneath -> piano thins out -> room shadow remains',
    listeningQuestion: 'Does the first 30 seconds give you a gentle musical handrail without becoming a normal piano track?',
    sources: [
      fileSource('primary_music_handrail', 'public/audio/production-remediated-2026-07-13/music/dreaming_soft_piano.mp3', `atrim=14:${durationSeconds + 14},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=4600,volume='${envelope([[0, 0.050], [24, 0.080], [70, 0.070], [112, 0.040], [152, 0.020], [180, 0.006]])}':eval=frame`, 'audible from the start; this replaces the silent opening'),
      fileSource('warm_harmonic_bed', 'public/audio/production-remediated-2026-07-13/music/nap_time_pad.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=3000,volume='${envelope([[0, 0.000], [22, 0.000], [58, 0.052], [112, 0.060], [154, 0.036], [180, 0.014]])}':eval=frame`, 'pad follows the music instead of announcing itself first'),
      fileSource('room_shadow', 'public/audio/music/revised-collection-qa/2026-07-14/dry_quiet_room.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1200,volume='${envelope([[0, 0.006], [55, 0.010], [112, 0.014], [180, 0.008]])}':eval=frame`, 'spatial glue only; not a noise bed'),
    ],
  },
  {
    id: 'sleep_006_return_to_sleep_cabin',
    titleSuffix: 'Harmonic Shelter',
    finalGain: 2.2,
    designRule: 'return-to-sleep should be audible but non-startling; no synthetic noise support',
    stateArc: 'low pad breathes in -> one soft piano contour -> fan-like room warmth stays below music -> music dissolves',
    listeningQuestion: 'Would this be safe to restart at 3 a.m., or does any layer still pull attention forward?',
    sources: [
      fileSource('low_harmonic_shelter', 'public/audio/music/reviewed-2026-07-11/rest_now_pad.mp3', `atrim=8:${durationSeconds + 8},asetpts=PTS-STARTPTS,lowpass=f=2500,volume='${envelope([[0, 0.045], [28, 0.064], [82, 0.052], [132, 0.038], [180, 0.012]])}':eval=frame`, 'audible harmonic shelter starts immediately, softly'),
      fileSource('brief_piano_contour', 'public/audio/production-remediated-2026-07-13/music/piano_reflections.mp3', `atrim=28:${durationSeconds + 28},asetpts=PTS-STARTPTS,highpass=f=130,lowpass=f=3900,volume='${envelope([[0, 0.000], [30, 0.000], [62, 0.052], [100, 0.040], [138, 0.016], [180, 0.000]])}':eval=frame`, 'short contour, then it steps away'),
      fileSource('low_room_warmth', 'public/audio/music/revised-collection-qa/2026-07-14/low_fan_night.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=520,volume='${envelope([[0, 0.000], [52, 0.000], [94, 0.018], [146, 0.020], [180, 0.010]])}':eval=frame`, 'late low warmth below the harmonic layers; not a white-noise lead'),
    ],
  },
  {
    id: 'calm_005_open_room_meditation',
    titleSuffix: 'Breath Without Hiss',
    finalGain: 2.1,
    designRule: 'breath-like timing must come from harmonic phrasing and resonant tail, not pink-noise exhale',
    stateArc: 'small bell color -> warm open drone -> room becomes wider -> second resonance falls away into space',
    listeningQuestion: 'Does the timing imply exhale/settling without using a hiss layer as the breath?',
    sources: [
      fileSource('opening_resonance', 'public/audio/production-remediated-2026-07-13/music/crystal_meditation.mp3', `atrim=18:${durationSeconds + 18},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=5600,volume='${envelope([[0, 0.035], [24, 0.060], [58, 0.038], [98, 0.026], [132, 0.050], [166, 0.020], [180, 0.006]])}':eval=frame`, 'resonance is audible immediately, but controlled'),
      fileSource('open_harmonic_floor', 'public/audio/music/local-review/2026-07-14/procedural_meditation_open_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=3200,volume='${envelope([[0, 0.000], [24, 0.000], [68, 0.060], [118, 0.050], [160, 0.026], [180, 0.010]])}':eval=frame`, 'floor rises under the resonance and gives the meditation body'),
      fileSource('real_room_width', 'public/audio/authentic-indoor-review/2026-07-14/room_apartment_small.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1200,volume='${envelope([[0, 0.003], [66, 0.006], [124, 0.009], [180, 0.004]])}':eval=frame`, 'barely-there room width only'),
    ],
  },
  {
    id: 'focus_004_low_anchor_pad',
    titleSuffix: 'Music-First Attention',
    finalGain: 2.3,
    designRule: 'focus uses low harmonic repetition and distant room movement; no noise blanket',
    stateArc: 'low anchor audible at start -> restrained harmonic motion -> distant room line enters below -> stable attention bed',
    listeningQuestion: 'Does the repeated low music help you begin working without turning into background hiss?',
    sources: [
      fileSource('primary_low_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=1200,volume='${envelope([[0, 0.055], [28, 0.072], [92, 0.062], [145, 0.050], [180, 0.030]])}':eval=frame`, 'audible focus identity from the start'),
      fileSource('restrained_mid_motion', 'public/audio/music/local-review/2026-07-15/procedural_focus_warm_mid.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=2600,volume='${envelope([[0, 0.000], [36, 0.000], [72, 0.040], [118, 0.034], [156, 0.022], [180, 0.010]])}':eval=frame`, 'small harmonic movement, not a lead melody'),
      fileSource('distant_work_room', 'public/audio/supply-gap-batch-01-loop-qa/2026-07-15/room_office_distant_traffic.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=1350,volume='${envelope([[0, 0.000], [58, 0.000], [96, 0.018], [144, 0.016], [180, 0.008]])}':eval=frame`, 'distant room enters late as context, not a noise layer'),
    ],
  },
];

const assertInputs = (spec) => {
  for (const source of spec.sources) {
    if (!fs.existsSync(source.path)) {
      throw new Error(`Missing source for ${spec.id}: ${source.relativePath}`);
    }
  }
};

const render = (spec) => {
  assertInputs(spec);
  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const source of spec.sources) args.push('-stream_loop', '-1', '-i', source.path);
  const filtered = spec.sources.map((source, index) => `[${index}:a]${source.filter}[a${index}]`);
  const mixInputs = spec.sources.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${mixInputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},alimiter=limit=0.78[out]`,
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
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    productionCorrection: 'batch_004_quiet_but_empty_opening_and_noise_support_too_dominant',
    designRule: spec.designRule,
    stateArc: spec.stateArc,
    listeningQuestion: spec.listeningQuestion,
    sources: spec.sources.map((source) => ({
      role: source.role,
      path: source.relativePath,
      note: source.note,
    })),
    limitations: [
      'Music-led state-entry preview; not a final commercial master.',
      'No generated white, pink, or brown noise is used in this batch.',
      'Reject if the result still feels like elements placed together without a state-entry soul.',
    ],
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-005-music-led-no-noise-lead',
  generatedAt: new Date().toISOString(),
  purpose: 'Correct Batch 004 feedback: most openings were nearly inaudible, later support/noise became too dominant, and the pieces had form without state-entry soul.',
  hardGates: [
    'Reject if the first 20-30 seconds are almost inaudible.',
    'Reject if any white/pink/brown noise or noise-like room layer becomes the main melody or occupies roughly half the perceived attention.',
    'Reject if the content feels like assembled elements instead of a state-entry piece.',
    'Reject if music is pleasant but does not support sleep, meditation, calm, or focus.',
  ],
  selection: {
    sleep: rendered.filter((item) => item.goal === 'sleep').length,
    calm: rendered.filter((item) => item.goal === 'calm').length,
    focus: rendered.filter((item) => item.goal === 'focus').length,
  },
  candidates: rendered,
  reviewPage: '/review/content-baseline-batch-005/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const reviewAudioSrc = (item) => `../../${item.outputUrl.replace(/^\//, '')}`;
const cards = rendered.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="${reviewAudioSrc(item)}"></audio>
        <p class="rule"><strong>设计规则：</strong>${item.designRule}</p>
        <p class="intent">${item.stateArc}</p>
        <p><strong>这次只听三件事：</strong>① 前 30 秒是否听得到一个温和入口；② 白噪/房间底噪是否已经退成装饰；③ 它有没有一点“神”，而不是元素拼贴。</p>
        <p><strong>听审问题：</strong>${item.listeningQuestion}</p>
        <p class="sources">${item.sources.map((source) => `${source.role}: ${source.note}`).join('<br />')}</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 005</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080b10; color: #f8efe5; }
      main { max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #d8c8b9; line-height: 1.58; margin-bottom: 22px; }
      .warning { border-left: 3px solid #f0c987; padding-left: 12px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 16px; background: rgba(255,255,255,.052); }
      .meta { color: #f0c987; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 19px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #d8c8b9; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff1c7; }
      .intent { color: #f2d9bd; }
      .rule { color: #ead7c2; }
      .sources { color: #9fa9b8; font-size: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 005</h1>
      <p class="lead warning">Batch 004 失败点：前 20–30 秒太空，后面支撑/噪音又变成主角，有形无神。Batch 005 改成音乐主导的状态入口：不用生成白/粉/棕噪，房间和环境只做极低空间胶水。</p>
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
