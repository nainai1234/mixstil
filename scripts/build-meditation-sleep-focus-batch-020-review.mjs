import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewDir = path.join(root, 'public/review/meditation-sleep-focus-batch-020');
const output = path.join(reviewDir, 'index.html');
const items = [
  {
    id: 'meditation_soft_felt_room_020_001',
    label: '冥想 · 无人声',
    question: '能不能安静坐着听，不被声音拉走？',
  },
  {
    id: 'sleep_soft_lullaby_pad_020_002',
    label: '睡眠 · 入睡',
    question: '能不能放在睡前，不焦躁、不像电影、不像假人声？',
  },
  {
    id: 'focus_soft_study_pulsefree_020_003',
    label: '专注 · 低干扰',
    question: '能不能作为阅读/工作背景，不抢注意力？',
  },
];

fs.mkdirSync(reviewDir, { recursive: true });

const cards = items.map((item, index) => {
  const src = `../../audio/music/local-review/batch-020-meditation-sleep-focus/${item.id}.mp3`;
  return `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.label}</div>
        <h2>${item.id}</h2>
        <audio controls preload="metadata" src="${src}"></audio>
        <p><strong>判断问题：</strong>${item.question}</p>
        <p><strong>硬拒绝：</strong>假人声、唱腔、电影感、焦躁蜂鸣、节拍、强旋律 hook。</p>
        <textarea placeholder="听审记录：可用 / 不可用；原因是什么？"></textarea>
      </article>`;
}).join('\n');

fs.writeFileSync(output, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Batch 020 · Meditation Sleep Focus Smoke Test</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080908; color: #f6efe5; }
      main { max-width: 880px; margin: 0 auto; padding: 28px 18px 60px; }
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
      <h1>Batch 020 · Meditation / Sleep / Focus Smoke Test</h1>
      <p class="lead">这是纠正 Batch 019“焦躁蜂鸣”的三条小样。不要按“音乐好不好听”泛泛判断，只判断它是否真的能用于冥想、睡眠或专注。通过也只是方向通过，不是批准入库。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/meditation-sleep-focus-batch-020/index.html',
  output: path.relative(root, output),
}, null, 2));
