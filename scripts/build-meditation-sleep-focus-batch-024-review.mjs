import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/meditation-sleep-focus-music-batch-024.json'), 'utf8'));
const reviewDir = path.join(root, 'public/review/meditation-sleep-focus-batch-024');
const output = path.join(reviewDir, 'index.html');

const labels = new Map([
  ['sleep_apg_dry_ep_024_001', '睡眠 · APG 高 guidance · 干声低电钢'],
  ['sleep_cfg_instrumental_hold_024_002', '睡眠 · CFG text guidance · 回睡低保持'],
  ['meditation_apg_grounded_024_003', '冥想 · APG 高 guidance · 稳定支撑'],
  ['focus_cfg_close_keys_024_004', '专注 · CFG text guidance · 近场键盘'],
]);

const questions = new Map([
  ['sleep_apg_dry_ep_024_001', '是否从开头就低刺激、无酒吧感、无歌曲段落、无旋律可跟？'],
  ['sleep_cfg_instrumental_hold_024_002', '和 #01 相比，CFG/text guidance 是否更能压住节奏和歌感？'],
  ['meditation_apg_grounded_024_003', '是否能托住呼吸注意力，而不是 new age / 电影配乐 / 合唱感？'],
  ['focus_cfg_close_keys_024_004', '是否适合放在阅读/深度工作背后，不抢注意力、不空间洗澡？'],
]);

fs.mkdirSync(reviewDir, { recursive: true });

const cards = manifest.candidates.map((item, index) => {
  const src = `../../audio/music/local-review/batch-024-meditation-sleep-focus/${item.id}.mp3`;
  const reviewFile = path.join(root, 'public/audio/music/local-review/batch-024-meditation-sleep-focus', `${item.id}.mp3`);
  const audioMarkup = fs.existsSync(reviewFile)
    ? `<audio controls preload="metadata" src="${src}"></audio>`
    : '<p class="missing"><strong>未生成：</strong>这条还没有跑本地模型，所以暂不显示播放器。</p>';
  const params = [
    `lyrics=${JSON.stringify(item.lyrics ?? manifest.defaults.lyrics)}`,
    `steps=${item.inferenceSteps ?? manifest.defaults.inferenceSteps}`,
    `guidance=${item.guidanceScale ?? manifest.defaults.guidanceScale}`,
    `cfg=${item.cfgType ?? manifest.defaults.cfgType}`,
    `scheduler=${item.schedulerType ?? manifest.defaults.schedulerType}`,
    `textGuidance=${item.guidanceScaleText ?? manifest.defaults.guidanceScaleText}`,
    `lyricGuidance=${item.guidanceScaleLyric ?? manifest.defaults.guidanceScaleLyric}`,
  ].join(' · ');
  return `
      <article class="card">
        <div class="meta">#${String(index + 1).padStart(2, '0')} · ${labels.get(item.id) ?? item.id}</div>
        <h2>${item.id}</h2>
        ${audioMarkup}
        <p><strong>参数：</strong>${escapeHtml(params)}</p>
        <p><strong>Prompt：</strong>${escapeHtml(item.prompt)}</p>
        <p><strong>判断问题：</strong>${questions.get(item.id) ?? '是否进入睡眠/冥想/专注的低刺激状态？'}</p>
        <p><strong>硬拒绝：</strong>酒吧感、chillhop/lofi 伴奏感、兴奋、强曲调、大混响、长尾巴、空间洗澡感、节拍/暗拍、强 hook、电影配乐感、假人声/合唱感。</p>
        <textarea placeholder="听审记录：可用 / 不可用；原因是什么？"></textarea>
      </article>`;
}).join('\n');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

fs.writeFileSync(output, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Batch 024 · ACE-Step Instrumental Control Test</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080908; color: #f6efe5; }
      main { max-width: 960px; margin: 0 auto; padding: 28px 18px 60px; }
      h1 { margin: 0 0 8px; font-size: 27px; }
      .lead { color: #d9cdbc; line-height: 1.6; border-left: 3px solid #c8ab6c; padding-left: 12px; margin-bottom: 18px; }
      .grid { display: grid; gap: 14px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 15px; padding: 16px; background: rgba(255,255,255,.055); }
      .meta { color: #d8b46a; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 18px; margin: 7px 0 12px; }
      audio { width: 100%; }
      p { color: #d9cdbc; line-height: 1.5; margin: 10px 0 0; }
      .missing { border: 1px dashed rgba(255,255,255,.2); border-radius: 10px; padding: 10px; background: rgba(0,0,0,.18); }
      strong { color: #fff0c2; }
      textarea { margin-top: 12px; width: 100%; min-height: 76px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.25); color: white; padding: 10px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Batch 024 · ACE-Step Instrumental Control Test</h1>
      <p class="lead">这批只验证生成逻辑修复：显式 lyrics=[instrumental]、提高 inference steps、提高 guidance、对比 APG 与 CFG/text guidance。目标不是多生成，而是看能否把模型从酒吧感/歌曲感拉回低刺激的冥想、睡眠、专注支撑。</p>
      <div class="grid">
${cards}
      </div>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/meditation-sleep-focus-batch-024/index.html',
  output: path.relative(root, output),
}, null, 2));
