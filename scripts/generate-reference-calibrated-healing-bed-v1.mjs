import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public/audio/content-baseline/reference-calibrated-healing-v1');
const reviewDir = path.join(root, 'public/review/reference-calibrated-healing-bed-v1');
mkdirSync(outputDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });

const specs = [
  {
    id: 'healing_warm_room_014_v1',
    title: 'Reference-Calibrated · Warm Room 014',
    source: 'public/audio/content-baseline/batch-014/calm_017_morning_clear_room.mp3',
    note: 'Closest existing baseline to Unlit_Corners band profile.',
  },
  {
    id: 'healing_warm_room_013_v1',
    title: 'Reference-Calibrated · Warm Room 013',
    source: 'public/audio/content-baseline/batch-013/calm_015_warm_room_extended.mp3',
    note: 'Second closest warm low-mid profile.',
  },
  {
    id: 'healing_midday_recenter_015_v1',
    title: 'Reference-Calibrated · Midday Recenter',
    source: 'public/audio/content-baseline/batch-015/calm_019_midday_recenter.mp3',
    note: 'Similar low-mid warmth with slightly different movement.',
  },
];

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
};

// Reference target learned from /Users/pang/Downloads/Unlit_Corners.mp3:
// low_80_250 ~= 25%, lowmid_250_800 ~= 69%, mid_800_2000 ~= 5%, high ~= 0%.
// Processing goal: keep musical body, warm the 120-260Hz area, soften 900-2200Hz,
// remove edge above 4kHz, and avoid added noise/drone.
const healingEq = [
  'highpass=f=70',
  'lowpass=f=1800',
  'equalizer=f=180:t=q:w=1.0:g=2.2',
  'equalizer=f=420:t=q:w=0.9:g=0.8',
  'equalizer=f=1150:t=q:w=1.1:g=-5.0',
  'equalizer=f=2200:t=q:w=1.0:g=-8.0',
].join(',');

const entrance = "if(lt(t,10),0.24+0.76*t/10,if(gt(t,170),1-(t-170)/10*0.18,1))";

for (const spec of specs) {
  const output = path.join(outputDir, `${spec.id}.mp3`);
  const filter = [
    `atrim=0:180`,
    `asetpts=PTS-STARTPTS`,
    healingEq,
    `volume='${entrance}':eval=frame`,
    'acompressor=threshold=-18dB:ratio=1.35:attack=80:release=650',
    'alimiter=limit=0.88',
    'loudnorm=I=-18:LRA=10:TP=-2',
  ].join(',');
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    spec.source,
    '-af',
    filter,
    '-t',
    '180',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    output,
  ]);
}

const cards = specs.map((spec, index) => `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${spec.title}</div>
        <h2>${spec.id}</h2>
        <audio controls preload="metadata" src="../../audio/content-baseline/reference-calibrated-healing-v1/${spec.id}.mp3"></audio>
        <p><strong>来源：</strong>${spec.source}</p>
        <p><strong>校准：</strong>${spec.note} 参考 Unlit_Corners 的频段目标：主能量在 250–800Hz，补 80–250Hz 温暖，压 900–2200Hz 存在感，不加白噪、不加蜂鸣、不用 AI 作曲。</p>
        <p><strong>听审问题：</strong>是否比前几版更接近“听上去就放松”的疗愈音乐？是否仍有酒吧/表演/蜂鸣/强旋律问题？</p>
        <textarea placeholder="听审记录：像不像疗愈内容？哪条最接近 Gemini 参考？"></textarea>
      </article>`).join('\n');

writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reference-Calibrated Healing Bed v1</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #090807; color: #f6efe5; }
      main { max-width: 980px; margin: 0 auto; padding: 28px 18px 64px; }
      h1 { margin: 0 0 8px; font-size: 27px; }
      .lead { color: #d9cdbc; line-height: 1.65; border-left: 3px solid #d2ad70; padding-left: 12px; margin-bottom: 18px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 15px; padding: 16px; background: rgba(255,255,255,.055); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 18px; margin: 7px 0 12px; }
      audio { width: 100%; }
      p { color: #d9cdbc; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff0c2; }
      textarea { margin-top: 12px; width: 100%; min-height: 76px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.25); color: white; padding: 10px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Reference-Calibrated Healing Bed v1</h1>
      <p class="lead">这版以你提供的 Unlit_Corners 作为疗愈感参考，只提取声学目标，不复制音频。候选主体来自已保存复听的内部基线中最接近参考频段的 warm-room/calm 内容，再做温暖低中频校准。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
  batchId: 'reference_calibrated_healing_bed_v1',
  reference: '/Users/pang/Downloads/Unlit_Corners.mp3',
  referenceSha256: '89e770ba736d169051bf4252c02937e43e3350b55aed7e9e8a1e63cd6d6f89cc',
  target: {
    low80To250: 0.255,
    lowMid250To800: 0.6932,
    mid800To2000: 0.0515,
    highAbove4000: 0
  },
  specs,
}, null, 2)}\n`);

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/reference-calibrated-healing-bed-v1/index.html',
  outputDir: path.relative(root, outputDir),
  count: specs.length,
}, null, 2));
