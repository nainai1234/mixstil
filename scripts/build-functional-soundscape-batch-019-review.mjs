import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'reports/functional-soundscape-foundation-batch-019-machine-qa.json');
const outputDir = path.join(root, 'public/review/functional-soundscape-batch-019');
const outputPath = path.join(outputDir, 'index.html');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

fs.mkdirSync(outputDir, { recursive: true });

const label = (item) => {
  if (item.goal === 'sleep' && item.scene === 'bedtime') return '睡眠 · 入睡';
  if (item.goal === 'sleep' && item.scene === 'return_to_sleep') return '睡眠 · 夜醒后回睡';
  if (item.scene === 'voice_free_meditation') return '冥想 · 无人声';
  if (item.scene === 'grounding_meditation') return '冥想 · 稳定落地';
  if (item.goal === 'focus') return `专注 · ${item.scene}`;
  return `${item.goal} · ${item.scene}`;
};

const cards = report.results.map((item, index) => {
  const src = `../../${item.previewUrl.replace(/^\//, '')}`;
  const status = item.machineStatus === 'pass' ? 'machine pass' : `machine ${item.machineStatus}`;
  return `
      <article class="card ${item.goal}">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${label(item)} · ${status}</div>
        <h2>${item.id}</h2>
        <audio controls preload="metadata" src="${src}"></audio>
        <dl>
          <div><dt>Use</dt><dd>${item.contentUse ?? `${item.goal}/${item.scene}`}</dd></div>
          <div><dt>LUFS</dt><dd>${item.analysis.integratedLufs}</dd></div>
          <div><dt>Peak</dt><dd>${item.analysis.samplePeakDbfs} dBFS</dd></div>
        </dl>
        <p class="listen"><strong>听审目标：</strong>不要判断它像不像音乐；只判断它能不能用于 ${label(item)}。任何假人声、唱腔、电影感、节拍、旋律 hook 都直接拒绝。</p>
        <textarea placeholder="听审记录：是否有假人声/电影感/节拍？是否适合冥想、睡眠或专注？"></textarea>
      </article>`;
}).join('\n');

fs.writeFileSync(outputPath, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Functional Soundscape Batch 019 Review</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #070908; color: #f7efe5; }
      main { max-width: 1040px; margin: 0 auto; padding: 28px 18px 64px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      .lead { margin: 0 0 20px; padding-left: 13px; border-left: 3px solid #bda56a; color: #d8cdbc; line-height: 1.6; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 16px; padding: 15px; background: rgba(255,255,255,.052); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { margin: 7px 0 12px; font-size: 17px; word-break: break-word; }
      audio { width: 100%; }
      dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
      dt { color: #9c9387; font-size: 11px; }
      dd { margin: 3px 0 0; color: #fff2cd; font-size: 12px; }
      .listen { color: #d8cdbc; line-height: 1.5; font-size: 13px; }
      textarea { width: 100%; min-height: 80px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.25); color: #fff; padding: 10px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Functional Soundscape Batch 019 Review</h1>
      <p class="lead">这一批按“冥想 / 睡眠 / 专注”的功能来听，不按音乐审美来听。硬拒绝：假人声、唱腔、电影感、节拍、强旋律、治疗承诺。通过也只是 candidate pass，不代表批准入库。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  candidates: report.results.length,
  reviewPage: '/review/functional-soundscape-batch-019/index.html',
  output: path.relative(root, outputPath),
}, null, 2));
