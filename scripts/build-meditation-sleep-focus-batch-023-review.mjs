import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewDir = path.join(root, 'public/review/meditation-sleep-focus-batch-023');
const output = path.join(reviewDir, 'index.html');
const items = [
  {
    id: 'sleep_dry_low_ep_023_001',
    label: '睡眠 · 干声低电钢',
    question: '是否足够困、平、无旋律可跟、无大空间？',
  },
  {
    id: 'sleep_plain_organ_hold_023_002',
    label: '睡眠 · 回睡低保持',
    question: '半夜醒来听是否不会被情绪、曲调或空间感抬起来？',
  },
  {
    id: 'meditation_grounded_organ_023_003',
    label: '冥想 · 稳定支撑',
    question: '是否能托住呼吸注意力，而不是变成 new age / 电影配乐？',
  },
  {
    id: 'meditation_muted_low_keys_023_004',
    label: '冥想 · 低键近场',
    question: '是否低刺激、无吟唱感、无大混响、无明显段落推进？',
  },
  {
    id: 'focus_dry_muted_rhodes_023_005',
    label: '专注 · 干声 Rhodes',
    question: '是否能放在阅读/深度工作背后，不抢注意力、不空间洗澡？',
  },
  {
    id: 'focus_close_tape_keys_023_006',
    label: '专注 · 近场磁带键',
    question: '是否干、近、低干扰，无 beat、无 hook、无情绪上扬？',
  },
];

fs.mkdirSync(reviewDir, { recursive: true });

const cards = items.map((item, index) => {
  const src = `../../audio/music/local-review/batch-023-meditation-sleep-focus/${item.id}.mp3`;
  return `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.label}</div>
        <h2>${item.id}</h2>
        <audio controls preload="metadata" src="${src}"></audio>
        <p><strong>判断问题：</strong>${item.question}</p>
        <p><strong>硬拒绝：</strong>兴奋、情绪上扬、强曲调、大混响、长尾巴、空间洗澡感、节拍/暗拍、强旋律 hook、电影配乐感、假人声/合唱感。</p>
        <textarea placeholder="听审记录：可用 / 不可用；原因是什么？"></textarea>
      </article>`;
}).join('\n');

fs.writeFileSync(output, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Batch 023 · Functional Prompt Pack V1 Smoke Test</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080908; color: #f6efe5; }
      main { max-width: 930px; margin: 0 auto; padding: 28px 18px 60px; }
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
      <h1>Batch 023 · Functional Prompt Pack V1</h1>
      <p class="lead">这批不是测试“好听”，而是测试完整参数化提示词是否能压住 020/021 的问题：兴奋、情绪上扬、强曲调、大混响、空间洗澡感。只要出现这些问题，直接判不可用。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/meditation-sleep-focus-batch-023/index.html',
  output: path.relative(root, output),
}, null, 2));
