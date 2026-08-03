import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reviewDir = path.join(root, 'public/review/functional-soundscape-engine-v1');
const output = path.join(reviewDir, 'index.html');
const metadataPath = path.join(root, 'public/audio/music/functional-engine-v1/sleep_arrival_settle_stable_release_025.json');
const qaPath = path.join(root, 'reports/functional-soundscape-engine-v1-qa.json');
const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : null;
const qa = fs.existsSync(qaPath) ? JSON.parse(fs.readFileSync(qaPath, 'utf8')) : null;

fs.mkdirSync(reviewDir, { recursive: true });

const qaRows = qa?.results
  ? qa.results.map((item) => `<tr><td>${escapeHtml(item.file)}</td><td>${escapeHtml(item.machineStatus)}</td><td>${escapeHtml(item.failures.join(', ') || 'none')}</td><td>${item.integratedLufs}</td><td>${item.onsetsPerMinute}</td><td>${item.highFrequencyEnergyRatio}</td><td>${item.pulseStrength}</td></tr>`).join('\n')
  : '';

fs.writeFileSync(output, `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Functional Soundscape Engine v1 · Sleep Foundation</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #070908; color: #f6efe5; }
      main { max-width: 980px; margin: 0 auto; padding: 28px 18px 64px; }
      h1 { margin: 0 0 8px; font-size: 27px; }
      .lead { color: #d9cdbc; line-height: 1.65; border-left: 3px solid #90b68f; padding-left: 12px; margin-bottom: 18px; }
      .card { border: 1px solid rgba(255,255,255,.14); border-radius: 15px; padding: 16px; background: rgba(255,255,255,.055); margin-top: 14px; }
      .meta { color: #9ed39b; font-size: 12px; letter-spacing: .04em; }
      h2 { font-size: 18px; margin: 7px 0 12px; }
      audio { width: 100%; }
      p, li { color: #d9cdbc; line-height: 1.55; }
      strong { color: #fff0c2; }
      code { color: #d7f6d3; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
      th, td { border-bottom: 1px solid rgba(255,255,255,.12); text-align: left; padding: 8px; vertical-align: top; }
      th { color: #fff0c2; }
      textarea { margin-top: 12px; width: 100%; min-height: 82px; box-sizing: border-box; border-radius: 10px; border: 1px solid rgba(255,255,255,.16); background: rgba(0,0,0,.25); color: white; padding: 10px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Functional Soundscape Engine v1 · Sleep Foundation</h1>
      <p class="lead">这不是 AI 歌曲生成测试，而是确定性睡眠底盘测试：60 秒 stable core 支持无缝循环，5 分钟试听由 arrival → settle → stable → release 组装。目标是彻底避开酒吧感、表演感、强旋律和强节奏。</p>

      <article class="card">
        <div class="meta">#01 · Sleep deterministic foundation</div>
        <h2>sleep_arrival_settle_stable_release_025</h2>
        <audio controls preload="metadata" src="../../audio/music/local-review/functional-engine-v1/sleep_arrival_settle_stable_release_025.mp3"></audio>
        <p><strong>结构：</strong>0-30s very quiet arrival；30-120s slow settle；stable core 可循环；最后 30s release。</p>
        <p><strong>生成方式：</strong>Python / NumPy / SciPy / SoundFile / pyloudnorm；无 AI 模型；固定 seed；stable core loop = ${metadata?.stableCoreLoopSeconds ?? 60}s。</p>
        <p><strong>判断问题：</strong>是否没有酒吧感、没有克罗地亚狂想曲式旋律、没有歌感/表演感？是否像一个可长时间循环的睡眠底层？</p>
        <textarea placeholder="听审记录：能否作为 sleep foundation；前 30 秒是否太空/太弱；stable core 是否可长时间循环；是否有机械/蜂鸣/刺耳/旋律感？"></textarea>
      </article>

      <article class="card">
        <div class="meta">Dynamic playback design</div>
        <h2>动态无限流准备</h2>
        <ul>
          <li>正式播放时不需要只播 5 分钟文件。</li>
          <li>可按用户时长：arrival + settle + repeat stable core + release。</li>
          <li>stable core 是独立 WAV：<code>${escapeHtml(metadata?.files?.stableCoreLoopWav ?? '')}</code></li>
        </ul>
      </article>

      <article class="card">
        <div class="meta">Machine QA</div>
        <h2>自动化 QA 初始校准</h2>
        ${qaRows ? `<table><thead><tr><th>File</th><th>Status</th><th>Failures</th><th>LUFS</th><th>Onsets/min</th><th>High freq</th><th>Pulse</th></tr></thead><tbody>${qaRows}</tbody></table>` : '<p>QA report not generated yet.</p>'}
      </article>
    </main>
  </body>
</html>
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  reviewPage: '/review/functional-soundscape-engine-v1/index.html',
  output: path.relative(root, output),
}, null, 2));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
