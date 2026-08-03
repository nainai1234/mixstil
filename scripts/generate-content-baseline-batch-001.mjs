import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.CONTENT_BASELINE_PREVIEW_SECONDS ?? 120);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-001');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-001');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-001-manifest.json');
const briefsPath = path.join(root, 'data/content-baseline/finished-content-briefs-v1.json');
const briefs = JSON.parse(fs.readFileSync(briefsPath, 'utf8')).briefs;

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(reviewDir, { recursive: true });

const byId = new Map(briefs.map((brief) => [brief.id, brief]));
const tone = (frequency) => `sine=frequency=${frequency}:duration=${durationSeconds}:sample_rate=48000`;
const shortTone = (frequency, seconds) => `sine=frequency=${frequency}:duration=${seconds}:sample_rate=48000`;
const noise = (color, amplitude, seed) => `anoisesrc=color=${color}:amplitude=${amplitude}:duration=${durationSeconds}:sample_rate=48000:seed=${seed}`;

const specs = [
  {
    id: 'sleep_001_quiet_room_cocoon',
    targetLufs: -27,
    sources: [
      noise('brown', 0.12, 1101),
      noise('pink', 0.035, 1102),
      tone(82.41),
    ],
    filters: [
      'lowpass=f=850,volume=0.34',
      'lowpass=f=1800,highpass=f=120,volume=0.10',
      'lowpass=f=260,volume=0.018,afade=t=in:st=0:d=12',
    ],
  },
  {
    id: 'sleep_002_soft_brown_night',
    targetLufs: -27,
    sources: [
      noise('brown', 0.18, 1201),
      tone(65.41),
      tone(98.0),
    ],
    filters: [
      'lowpass=f=720,volume=0.40',
      'lowpass=f=180,volume=0.012',
      'lowpass=f=240,volume=0.010,afade=t=in:st=0:d=20',
    ],
  },
  {
    id: 'sleep_003_warm_fan_sleep',
    targetLufs: -26,
    sources: [
      noise('brown', 0.12, 1301),
      tone(118),
      tone(236),
      noise('pink', 0.05, 1302),
    ],
    filters: [
      'lowpass=f=950,volume=0.22',
      'lowpass=f=180,volume=0.030,tremolo=f=0.45:d=0.12',
      'lowpass=f=360,volume=0.012,tremolo=f=0.45:d=0.08',
      'highpass=f=200,lowpass=f=1400,volume=0.12',
    ],
  },
  {
    id: 'sleep_007_no_water_bedtime_pad',
    targetLufs: -26,
    sources: [
      noise('brown', 0.11, 1701),
      tone(110),
      tone(164.81),
      tone(220),
    ],
    filters: [
      'lowpass=f=800,volume=0.22',
      'lowpass=f=420,volume=0.024,afade=t=in:st=0:d=18',
      'lowpass=f=620,volume=0.014,afade=t=in:st=12:d=20',
      'lowpass=f=720,volume=0.010,afade=t=in:st=24:d=24',
    ],
  },
  {
    id: 'calm_001_warm_breathing_space',
    targetLufs: -24,
    sources: [
      noise('pink', 0.035, 2101),
      tone(196),
      tone(246.94),
      tone(329.63),
      shortTone(660, 4),
      shortTone(660, 4),
    ],
    filters: [
      'lowpass=f=2200,volume=0.10',
      'lowpass=f=800,volume=0.035,tremolo=f=0.12:d=0.18,afade=t=in:st=0:d=10',
      'lowpass=f=900,volume=0.024,tremolo=f=0.12:d=0.18,afade=t=in:st=12:d=14',
      'lowpass=f=1100,volume=0.014,tremolo=f=0.12:d=0.12,afade=t=in:st=28:d=14',
      'volume=0.030,afade=t=out:st=0:d=4,adelay=38000|38000',
      'volume=0.024,afade=t=out:st=0:d=4,adelay=82000|82000',
    ],
  },
  {
    id: 'calm_002_grounded_ambient_pad',
    targetLufs: -24,
    sources: [
      noise('pink', 0.025, 2201),
      tone(98),
      tone(146.83),
      tone(196),
      tone(293.66),
    ],
    filters: [
      'lowpass=f=1800,volume=0.07',
      'lowpass=f=420,volume=0.040',
      'lowpass=f=650,volume=0.027,afade=t=in:st=6:d=12',
      'lowpass=f=850,volume=0.021,afade=t=in:st=18:d=16',
      'lowpass=f=1000,volume=0.012,afade=t=in:st=45:d=20',
    ],
  },
  {
    id: 'calm_004_soft_bell_exhale',
    targetLufs: -24,
    sources: [
      noise('pink', 0.02, 2401),
      tone(174.61),
      tone(261.63),
      shortTone(523.25, 5),
      shortTone(392, 5),
      shortTone(523.25, 5),
    ],
    filters: [
      'lowpass=f=2000,volume=0.075',
      'lowpass=f=620,volume=0.030,afade=t=in:st=0:d=8',
      'lowpass=f=900,volume=0.020,afade=t=in:st=18:d=10',
      'volume=0.030,afade=t=out:st=0:d=5,adelay=12000|12000',
      'volume=0.022,afade=t=out:st=0:d=5,adelay=52000|52000',
      'volume=0.025,afade=t=out:st=0:d=5,adelay=92000|92000',
    ],
  },
  {
    id: 'focus_001_quiet_train_focus',
    targetLufs: -24,
    sources: [
      noise('pink', 0.08, 3101),
      tone(91),
      tone(182),
      noise('brown', 0.05, 3102),
    ],
    filters: [
      'highpass=f=120,lowpass=f=2600,volume=0.20',
      'lowpass=f=180,volume=0.025,tremolo=f=0.82:d=0.16',
      'lowpass=f=360,volume=0.011,tremolo=f=0.82:d=0.12',
      'lowpass=f=600,volume=0.12,tremolo=f=0.41:d=0.08',
    ],
  },
  {
    id: 'focus_004_low_anchor_pad',
    targetLufs: -23,
    sources: [
      noise('pink', 0.04, 3401),
      tone(130.81),
      tone(196),
      tone(261.63),
    ],
    filters: [
      'highpass=f=180,lowpass=f=2400,volume=0.10',
      'lowpass=f=520,volume=0.038',
      'lowpass=f=760,volume=0.026,afade=t=in:st=4:d=10',
      'lowpass=f=980,volume=0.016,afade=t=in:st=28:d=14',
    ],
  },
  {
    id: 'focus_007_clean_pink_focus',
    targetLufs: -24,
    sources: [
      noise('pink', 0.13, 3701),
      tone(220),
      tone(330),
    ],
    filters: [
      'highpass=f=150,lowpass=f=4200,volume=0.28',
      'lowpass=f=700,volume=0.012,tremolo=f=0.12:d=0.08',
      'lowpass=f=1000,volume=0.007,tremolo=f=0.12:d=0.06',
    ],
  },
];

const render = (spec) => {
  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const source of spec.sources) args.push('-f', 'lavfi', '-i', source);
  const filtered = spec.filters.map((filter, index) => `[${index}:a]${filter}[a${index}]`);
  const mixInputs = spec.filters.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${mixInputs}amix=inputs=${spec.filters.length}:duration=longest:normalize=0,alimiter=limit=0.85,loudnorm=I=${spec.targetLufs}:LRA=8:TP=-2[out]`,
  ].join(';');
  args.push('-filter_complex', filterComplex, '-map', '[out]', '-t', String(durationSeconds), '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '192k', outputPath);
  execFileSync('ffmpeg', args, { cwd: root, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
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
    title: brief.title,
    goal: brief.goal,
    scene: brief.scene,
    sourceBriefDurationMinutes: brief.durationMinutes,
    previewDurationSeconds: durationSeconds,
    targetLufs: spec.targetLufs,
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'candidate_preview',
    limitations: [
      'Procedural preview only; not a final commercial master.',
      'Requires human listening for save-worthiness, fatigue, and scene differentiation.',
      'Requires replacement or enrichment with approved high-quality recorded/generated assets before release.',
    ],
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-001',
  generatedAt: new Date().toISOString(),
  purpose: 'First audible candidates for the content baseline reset.',
  selection: {
    sleep: rendered.filter((item) => item.goal === 'sleep').length,
    calm: rendered.filter((item) => item.goal === 'calm').length,
    focus: rendered.filter((item) => item.goal === 'focus').length,
  },
  candidates: rendered,
  reviewPage: '/review/content-baseline-batch-001/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = rendered.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="${item.outputUrl}"></audio>
        <p>${item.limitations[0]}</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 001</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101014; color: #f4f0ea; }
      main { max-width: 920px; margin: 0 auto; padding: 28px 18px 48px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      .lead { color: #c8c1b8; line-height: 1.55; margin-bottom: 24px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 16px; background: rgba(255,255,255,.055); }
      .meta { color: #a89fff; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 18px; margin: 6px 0 12px; }
      audio { width: 100%; }
      p { color: #c8c1b8; line-height: 1.5; }
      .warning { border-left: 3px solid #f0b35a; padding-left: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 001</h1>
      <p class="lead warning">这是第一批程序化方向样片，不是最终商用品质母带。用途是快速判断 Sleep / Calm / Focus 是否开始有可听差异，以及哪些方向值得继续用高质量素材重做。</p>
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
