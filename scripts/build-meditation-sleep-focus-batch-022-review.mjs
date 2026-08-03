import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewDir = path.join(root, 'public/review/meditation-sleep-focus-batch-022');
const output = path.join(reviewDir, 'index.html');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/meditation-sleep-focus-music-batch-022.json'), 'utf8'));
const items = manifest.candidates.map((candidate) => ({
  id: candidate.id,
  label: `${candidate.goal} · ${candidate.family}`,
  question:
    candidate.goal === 'sleep'
      ? '能不能睡前听，不兴奋、不像一首歌、不想跟着旋律走？'
      : candidate.goal === 'focus'
        ? '有没有保留低刺激质感，同时没有 beat、没有空间洗澡感？'
        : '能不能用于呼吸/静坐，不假人声、不电影、不大混响？',
  prompt: candidate.prompt,
}));

fs.mkdirSync(reviewDir, { recursive: true });

const cards = items.map((item, index) => {
  const src = `../../audio/music/local-review/batch-022-meditation-sleep-focus/${item.id}.mp3`;
  return `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${item.label}</div>
        <h2>${item.id}</h2>
        <audio controls preload="metadata" src="${src}"></audio>
        <pre class="prompt">${item.prompt}</pre>
        <p><strong>判断问题：</strong>${item.question}</p>
        <p><strong>硬拒绝：</strong>兴奋、情绪上扬、强曲调、能记住的旋律、大混响、长尾巴、空间洗澡感、节拍/隐性节拍、假人声/哼唱/合唱、电影感。</p>
        <textarea placeholder="听审记录：可用 / 不可用；原因是什么？"></textarea>
      </article>`;
}).join('\n');

fs.writeFileSync(output, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Batch 022 · Prompt-library Functional Music Smoke Test</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080908; color: #f6efe5; }
      main { max-width: 940px; margin: 0 auto; padding: 28px 18px 60px; }
      h1 { margin: 0 0 8px; font-size: 27px; }
      .lead { color: #d9cdbc; line-height: 1.6; border-left: 3px solid #c8ab6c; padding-left: 12px; margin-bottom: 18px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 15px; padding: 16px; background: rgba(255,255,255,.055); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 18px; margin: 7px 0 12px; }
      audio { width: 100%; }
      .prompt { white-space: pre-wrap; background: rgba(0,0,0,.22); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 10px; margin: 12px 0 0; color: #f2e6d2; line-height: 1.5; }
      p { color: #d9cdbc; line-height: 1.5; margin: 10px 0 0; }
      strong { color: #fff0c2; }
      textarea { margin-top: 12px; width: 100%; min-height: 76px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.25); color: white; padding: 10px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Batch 022 · Prompt-library Functional Music Smoke Test</h1>
      <p class="lead">这批基于公开 AI 音乐 prompt 资料整理后的功能音乐 prompt library。不要按“好不好听”判断；只判断它是否真的适合睡眠、冥想、专注。通过也只是方向通过，不是入库批准。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/meditation-sleep-focus-batch-022/index.html',
  output: path.relative(root, output),
}, null, 2));
