import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const durationSeconds = Number(process.env.ORGANIC_PLACEMENT_SECONDS ?? 180);
const outputDir = path.join(root, 'public/audio/content-baseline/batch-008');
const reviewDir = path.join(root, 'public/review/content-baseline-batch-008');
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-008-manifest.json');

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

const src = (role, relativePath, filter, note) => ({
  role,
  relativePath,
  path: path.join(root, relativePath),
  filter,
  note,
});

const specs = [
  {
    id: 'sleep_014_organic_night_placement',
    title: 'Organic Night Placement — Sleep Demo',
    goal: 'sleep',
    scene: 'bedtime_sleep',
    finalGain: 1.95,
    placementThesis: 'Organic substrate is a low bed under a gentle sleep journey, not a foreground mechanical drone.',
    sources: [
      src('accepted_organic_substrate_low', 'public/audio/organic-structured-sound-factory/batch-002/sleep_organic_night_floor_001.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=2600,volume='${envelope([[0, 0.34], [40, 0.40], [110, 0.34], [180, 0.18]])}':eval=frame`, 'Batch 002 accepted organic bed placed below the composition'),
      src('slow_sleep_descent', 'public/audio/music/reviewed-2026-07-11/silent_descent.mp3', `atrim=8:${durationSeconds + 8},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=2600,volume='${envelope([[0, 0.000], [26, 0.032], [82, 0.045], [140, 0.024], [180, 0.006]])}':eval=frame`, 'soft sleep movement; no cheerful lead'),
      src('tiny_organic_night_detail', 'public/audio/music/revised-collection-qa/2026-07-14/night_insects_distant.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=600,lowpass=f=2200,volume='${envelope([[0, 0.000], [88, 0.000], [126, 0.004], [160, 0.003], [180, 0.000]])}':eval=frame`, 'late tiny detail only'),
    ],
  },
  {
    id: 'calm_010_organic_resonance_placement',
    title: 'Organic Resonance Placement — Calm Demo',
    goal: 'calm',
    scene: 'quiet_relaxation',
    finalGain: 1.85,
    placementThesis: 'Calm organic resonance can act as a sparse space layer; the bowl cues must not become a performance.',
    sources: [
      src('accepted_organic_resonance_space', 'public/audio/organic-structured-sound-factory/batch-002/calm_organic_bowl_air_001.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,lowpass=f=3600,volume='${envelope([[0, 0.36], [34, 0.42], [100, 0.34], [150, 0.22], [180, 0.10]])}':eval=frame`, 'Batch 002 calm layer placed as warm space'),
      src('open_calm_pad', 'public/audio/music/local-review/2026-07-14/procedural_calm_grounded_b.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=120,lowpass=f=2600,volume='${envelope([[0, 0.020], [42, 0.036], [104, 0.030], [154, 0.014], [180, 0.004]])}':eval=frame`, 'gentle body, not a song lead'),
    ],
  },
  {
    id: 'focus_013_organic_music_bed_placement',
    title: 'Organic Music Bed Placement — Focus Demo',
    goal: 'focus',
    scene: 'deep_work',
    finalGain: 1.85,
    placementThesis: 'Focus Organic Clear Bed 001 is treated as a music bed, not as foundational noise or neutral substrate.',
    sources: [
      src('organic_focus_music_bed_low', 'public/audio/organic-structured-sound-factory/batch-002/focus_organic_clear_bed_001.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=110,lowpass=f=2600,volume='${envelope([[0, 0.30], [34, 0.34], [108, 0.30], [160, 0.22], [180, 0.14]])}':eval=frame`, 'classified as a music bed; intentionally below full-track presence'),
      src('low_attention_anchor', 'public/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3', `atrim=0:${durationSeconds},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=1600,volume='${envelope([[0, 0.018], [48, 0.032], [124, 0.028], [170, 0.012], [180, 0.004]])}':eval=frame`, 'small stable support; no noise wall'),
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
    `${inputs}amix=inputs=${spec.sources.length}:duration=longest:normalize=0,volume=${spec.finalGain},afade=t=in:st=0:d=2,afade=t=out:st=${durationSeconds - 8}:d=8,alimiter=limit=0.72[out]`,
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
    productionStatus: 'placement_demo_candidate',
    purpose: 'show where accepted organic factory batch 002 material belongs inside a finished soundscape',
    placementThesis: spec.placementThesis,
    sources: spec.sources.map((item) => ({ role: item.role, path: item.relativePath, note: item.note })),
    probe: probe(outputPath),
  };
});

const manifest = {
  version: '2026-07-16.batch-008-organic-placement-demo',
  generatedAt: new Date().toISOString(),
  purpose: 'After Batch 002 was accepted as non-uncomfortable but Focus sounded like music, demonstrate correct placement: organic music beds belong as music layers, not foundational noise.',
  hardGates: [
    'Reject if any candidate feels mechanical, electric, physically oppressive, or harmful.',
    'Reject if Focus Organic Clear Bed is presented as neutral foundational noise; it must be treated as a music bed.',
    'Reject if white noise, fan, traffic, or room noise becomes the main content.',
  ],
  candidates,
  reviewPage: '/review/content-baseline-batch-008/index.html',
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const cards = candidates.map((item, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.goal.toUpperCase()} · ${item.scene}</div>
        <h2>${item.title}</h2>
        <audio controls preload="metadata" src="../../${item.outputUrl.replace(/^\//, '')}"></audio>
        <p><strong>放置判断：</strong>${item.placementThesis}</p>
        <p><strong>这次听什么：</strong>它作为成品声景的一层是否合理？尤其 Focus 是否应该被当作音乐床，而不是基础底噪。</p>
      </article>`).join('\n');

fs.writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Content Baseline Batch 008 · Organic Placement Demo</title>
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
      <h1>Content Baseline Batch 008 · Organic Placement Demo</h1>
      <p class="lead">Batch 002 证明有机方向不难受，但 Focus 那条更像音乐。所以这批不再把它叫“基础底噪”，而是示范它作为成品声景里的音乐床该怎么放。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({ passed: true, candidates: candidates.length, manifest: path.relative(root, manifestPath), reviewPage: manifest.reviewPage }, null, 2));
