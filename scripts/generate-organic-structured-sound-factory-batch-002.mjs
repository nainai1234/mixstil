import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.ORGANIC_FACTORY_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/organic-structured-sound-factory/batch-002');
const reviewDir = path.join(root, 'public/review/organic-structured-sound-factory-batch-002');
const manifestPath = path.join(root, 'data/content-baseline/organic-structured-sound-factory-batch-002-manifest.json');

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

const loopSource = (role, relativePath, filter, note) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  loop: true,
  filter,
  note,
});

const oneShot = (role, relativePath, filter, note) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  loop: false,
  filter,
  note,
});

const specs = [
  {
    id: 'sleep_organic_night_floor_001',
    title: 'Sleep Organic Night Floor 001',
    goal: 'sleep',
    role: 'organic_foundational_bed',
    finalGain: 4.0,
    designRule: 'sleep substrate must not contain mechanical pulse, electric hum, aggressive low vibration, or cheerful melody',
    intendedPlacement: 'beneath future sleep journeys at a low level; not a standalone meditation track',
    sources: [
      loopSource('soft_organic_music_floor', 'public/audio/music/revised-collection-qa/2026-07-14/warm_music_later.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=2600,volume='${envelope([[0, 0.095], [28, 0.110], [92, 0.080], [150, 0.044], [180, 0.016]])}':eval=frame`, 'organic musical warmth only; no bright lead'),
      loopSource('forest_breath_hint', 'public/audio/music/revised-collection-qa/2026-07-14/forest_breathing.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=1800,volume='${envelope([[0, 0.028], [44, 0.030], [116, 0.020], [180, 0.006]])}':eval=frame`, 'very low organic air, deliberately below attention'),
      loopSource('distant_night_life_detail', 'public/audio/music/revised-collection-qa/2026-07-14/night_insects_distant.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=450,lowpass=f=2200,volume='${envelope([[0, 0.000], [68, 0.000], [112, 0.006], [158, 0.005], [180, 0.000]])}':eval=frame`, 'late tiny organic detail, not a bed'),
    ],
  },
  {
    id: 'calm_organic_bowl_air_001',
    title: 'Calm Organic Bowl Air 001',
    goal: 'calm',
    role: 'organic_resonance_space',
    finalGain: 3.2,
    designRule: 'calm substrate may use soft acoustic resonance, but no machine drone, no pulse engine, and no hiss-as-breath',
    intendedPlacement: 'as a calm/meditation space layer under a future composition; bowls must stay sparse',
    sources: [
      loopSource('warm_still_music_floor', 'public/audio/music/revised-collection-qa/2026-07-14/warm_music_later.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=3000,volume='${envelope([[0, 0.090], [24, 0.102], [90, 0.068], [146, 0.034], [180, 0.010]])}':eval=frame`, 'soft organic floor, not a lead'),
      oneShot('opening_bowl_resonance', 'public/audio/accent/batch-05/singingbowl1.ogg', `adelay=9000|9000,apad,atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=4200,volume='${envelope([[0, 0.000], [8, 0.000], [14, 0.050], [38, 0.014], [58, 0.000], [180, 0.000]])}':eval=frame`, 'one sparse acoustic cue after entry'),
      oneShot('return_bowl_resonance', 'public/audio/accent/batch-05/singingbowl2.ogg', `adelay=82000|82000,apad,atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=180,lowpass=f=3600,volume='${envelope([[0, 0.000], [80, 0.000], [88, 0.032], [114, 0.008], [132, 0.000], [180, 0.000]])}':eval=frame`, 'one later return cue, not rhythmic'),
    ],
  },
  {
    id: 'focus_organic_clear_bed_001',
    title: 'Focus Organic Clear Bed 001',
    goal: 'focus',
    role: 'organic_low_distraction_bed',
    finalGain: 1.50,
    designRule: 'focus substrate must stay clear and non-mechanical; no white noise wall, fan, traffic, pulse engine, or alarm-like repetition',
    intendedPlacement: 'quiet under-work layer for users who dislike mechanical focus sounds',
    sources: [
      loopSource('neutral_ambient_floor', 'public/audio/music/reviewed-2026-07-11/ambient_low_bed.mp3', `atrim=20:${durationSeconds + 20},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=2400,volume='${envelope([[0, 0.026], [22, 0.040], [92, 0.038], [154, 0.030], [180, 0.016]])}':eval=frame`, 'steady ambient body without pulse'),
      loopSource('soft_open_pad', 'public/audio/music/reviewed-2026-07-11/valley_sunset_pad.mp3', `atrim=36:${durationSeconds + 36},asetpts=PTS-STARTPTS,highpass=f=160,lowpass=f=2800,volume='${envelope([[0, 0.000], [42, 0.000], [78, 0.026], [132, 0.022], [180, 0.008]])}':eval=frame`, 'late clarity and width, not a foreground melody'),
      loopSource('organic_air_micro_layer', 'public/audio/authentic-scene-review/2026-07-14/authentic_pine_forest_wind.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=360,lowpass=f=1500,volume='${envelope([[0, 0.003], [56, 0.005], [132, 0.004], [180, 0.001]])}':eval=frame`, 'sub-10-percent organic air decoration only'),
    ],
  },
];

const render = (spec) => {
  for (const item of spec.sources) {
    if (!fs.existsSync(item.path)) throw new Error(`Missing source: ${item.relativePath}`);
  }
  const outputPath = path.join(outputDir, `${spec.id}.mp3`);
  const args = ['-y', '-hide_banner'];
  for (const item of spec.sources) {
    if (item.loop) args.push('-stream_loop', '-1');
    args.push('-i', item.path);
  }
  const filtered = spec.sources.map((item, index) => `[${index}:a]${item.filter}[a${index}]`);
  const mixInputs = spec.sources.map((_, index) => `[a${index}]`).join('');
  const filterComplex = [
    ...filtered,
    `${mixInputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},afade=t=in:st=0:d=2,afade=t=out:st=${durationSeconds - 8}:d=8,alimiter=limit=0.70[out]`,
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
    role: spec.role,
    outputPath: relativePath,
    outputUrl: `/${relativePath.replace(/^public\//, '')}`,
    productionStatus: 'organic_reference_candidate',
    correction: 'reject_mechanical_synthetic_substrate_direction',
    designRule: spec.designRule,
    intendedPlacement: spec.intendedPlacement,
    sourcePolicy: 'source-based organic arrangement; no deterministic synth pulse, no machine engine, no white/pink/brown noise file',
    sources: spec.sources.map((item) => ({ role: item.role, path: item.relativePath, note: item.note })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.organic-structured-sound-factory-batch-002',
  generatedAt: new Date().toISOString(),
  purpose: 'Replace the rejected mechanical-sounding original synthetic substrate experiment with organic, low-stimulation reference substrates.',
  rejectedPreviousDirection: {
    batch: 'original-structured-sound-factory-batch-001',
    reason: 'mechanical/electric/pulse-like tones are inappropriate for sleep and meditation and should not be used as a wellness substrate',
  },
  hardGates: [
    'Reject anything that sounds mechanical, electric, alarm-like, vibrator-like, or physically oppressive.',
    'Reject any white/pink/brown noise, fan, traffic, or room-tone layer that becomes the perceived main content.',
    'Noise-like air decoration must remain below attention, roughly under 10 percent perceived share.',
    'These candidates are substrate references, not finished meditation or sleep tracks.',
  ],
  candidates,
  reviewPage: '/review/organic-structured-sound-factory-batch-002/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.role}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>规则：</strong>${item.designRule}</p>
        <p><strong>放置位置：</strong>${item.intendedPlacement}</p>
        <p><strong>听审重点：</strong>有没有机械、电流、压迫、伤害感？如果有，直接淘汰。</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Organic Structured Sound Factory Batch 002</title>
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
      <h1>Organic Structured Sound Factory · Batch 002</h1>
      <p class="lead">Batch 001 的机械/电流/脉冲感直接判失败。这一批改成有机参考底座：不做机器 drone，不做脉冲 engine，不用白噪当主体。请只判断它是否更接近冥想/睡眠可接受的底层材料。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
