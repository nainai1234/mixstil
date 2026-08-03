import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public/audio/content-baseline/organic-musical-v1');
const reviewDir = path.join(root, 'public/review/organic-musical-soundscape-v1');
mkdirSync(outputDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });

const specs = [
  {
    id: 'sleep_phone_down_organic_v1',
    title: 'Sleep · Phone Down Organic',
    goal: 'sleep',
    source: 'public/audio/content-baseline/batch-017/sleep_027_phone_down_bedtime.mp3',
    support: 'public/audio/noise/internal/quiet_room.mp3',
    supportVolume: 0.012,
    targetLufs: -24,
    question: '是否保留了 Batch 017 的可保存复听感，同时入口更柔和、不蜂鸣、不酒吧？',
  },
  {
    id: 'calm_after_work_organic_v1',
    title: 'Calm · After Work Organic',
    goal: 'calm',
    source: 'public/audio/content-baseline/batch-017/calm_023_after_work_release.mp3',
    support: 'public/audio/noise/internal/quiet_room.mp3',
    supportVolume: 0.010,
    targetLufs: -20,
    question: '是否像一个有审美的放松内容，而不是机械底噪或表演音乐？',
  },
  {
    id: 'focus_reading_organic_v1',
    title: 'Focus · Reading Organic',
    goal: 'focus',
    source: 'public/audio/content-baseline/batch-017/focus_026_reading_low_distraction.mp3',
    support: 'public/audio/noise/internal/quiet_room.mp3',
    supportVolume: 0.008,
    targetLufs: -19,
    question: '是否能放在阅读/工作背后，不抢注意力、不像酒吧，也不是蜂鸣？',
  },
];

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  }
};

const envelope = "if(lt(t,12),0.18+0.82*t/12,if(gt(t,168),1-(t-168)/12*0.28,1))";

for (const spec of specs) {
  const output = path.join(outputDir, `${spec.id}.mp3`);
  const filter = [
    `[0:a]atrim=0:180,asetpts=PTS-STARTPTS,volume='${envelope}':eval=frame[main]`,
    `[1:a]atrim=0:180,asetpts=PTS-STARTPTS,volume=${spec.supportVolume}[room]`,
    `[main][room]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.86,loudnorm=I=${spec.targetLufs}:LRA=9:TP=-2[out]`,
  ].join(';');
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    spec.source,
    '-stream_loop',
    '-1',
    '-i',
    spec.support,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
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
        <audio controls preload="metadata" src="../../audio/content-baseline/organic-musical-v1/${spec.id}.mp3"></audio>
        <p><strong>主体来源：</strong>${spec.source}</p>
        <p><strong>处理：</strong>保留原成品主体；只加 ${Math.round(spec.supportVolume * 1000) / 10}% quiet room 连续性、轻微入口/释放曲线、响度整理。没有 AI 生成、没有蜂鸣合成器。</p>
        <p><strong>判断问题：</strong>${spec.question}</p>
        <p><strong>硬拒绝：</strong>蜂鸣、机械感、酒吧感、克罗地亚狂想曲式强旋律、白噪主体、突兀开头、过度混响、表演感。</p>
        <textarea placeholder="听审记录：是否比直接原版更适合作为结构化声景？有没有被处理坏？"></textarea>
      </article>`).join('\n');

writeFileSync(path.join(reviewDir, 'index.html'), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Organic Musical Soundscape v1</title>
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
      <h1>Organic Musical Soundscape v1</h1>
      <p class="lead">这版纠正方向：不再用 AI 小模型作曲，也不再用程序合成蜂鸣。主体直接来自你已经判定“愿意保存复听”的 Batch 017 成品；引擎只做结构化入口、释放、极低比例 room air 和响度整理。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({ batchId: 'organic_musical_soundscape_v1', specs }, null, 2)}\n`);

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/organic-musical-soundscape-v1/index.html',
  outputDir: path.relative(root, outputDir),
  count: specs.length,
}, null, 2));
