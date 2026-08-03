import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewDir = path.join(root, 'public/review/meditation-sleep-focus-batch-021');
const output = path.join(reviewDir, 'index.html');
const items = [
  {
    id: 'sleep_matte_low_motion_021_001',
    label: '睡眠 · 去兴奋',
    question: '有没有比 020_002 更困、更平、更不想跟着听？',
  },
  {
    id: 'sleep_plain_warm_blanket_021_002',
    label: '睡眠 · 回睡',
    question: '半夜醒来能不能放，不会被曲调或情绪抬起来？',
  },
  {
    id: 'focus_dry_close_keys_021_003',
    label: '专注 · 干声近场',
    question: '混响是否明显下降，能不能贴近地放在阅读/工作背后？',
  },
  {
    id: 'focus_matte_near_room_021_004',
    label: '专注 · 低空间感',
    question: '有没有去掉大空间/大尾巴，不抢注意力？',
  },
];

fs.mkdirSync(reviewDir, { recursive: true });

const cards = items.map((item, index) => {
  const src = `../../audio/music/local-review/batch-021-meditation-sleep-focus/${item.id}.mp3`;
  return `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.label}</div>
        <h2>${item.id}</h2>
        <audio controls preload="metadata" src="${src}"></audio>
        <p><strong>判断问题：</strong>${item.question}</p>
        <p><strong>硬拒绝：</strong>兴奋、情绪上扬、强曲调、大混响、长尾巴、空间洗澡感、节拍、强旋律 hook、假人声。</p>
        <textarea placeholder="听审记录：可用 / 不可用；原因是什么？"></textarea>
      </article>`;
}).join('\n');

fs.writeFileSync(output, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Batch 021 · Low-arousal Dry Mix Smoke Test</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080908; color: #f6efe5; }
      main { max-width: 900px; margin: 0 auto; padding: 28px 18px 60px; }
      h1 { margin: 0 0 8px; font-size: 27px; }
      .lead { color: #d9cdbc; line-height: 1.6; border-left: 3px solid #c8ab6c; padding-left: 12px; margin-bottom: 18px; }
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
      <h1>Batch 021 · Sleep / Focus Correction</h1>
      <p class="lead">这批只修 Batch 020 的两个问题：睡眠不能兴奋，专注不能大混响。不要按“好不好听”判断；只判断是否低唤醒、干、近、不抢注意力。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/meditation-sleep-focus-batch-021/index.html',
  output: path.relative(root, output),
}, null, 2));
