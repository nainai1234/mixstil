#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INPUT_DIR = process.env.STABILITY_AUDIO_OUTPUT_DIR
  || path.join(ROOT, 'experiments/audio-model-lab/outputs/stability-audio-sleep-spike-001');
const REVIEW_DIR = path.join(ROOT, 'public/review/stability-audio-sleep-spike-001');
const REVIEW_AUDIO_DIR = path.join(REVIEW_DIR, 'audio');
const MANIFEST_PATH = path.join(INPUT_DIR, 'manifest.json');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);

  await fs.mkdir(REVIEW_AUDIO_DIR, { recursive: true });

  const cards = [];
  for (const candidate of manifest.candidates ?? []) {
    const outputFile = candidate.outputFile;
    let audioMarkup = '';
    if (candidate.status === 'generated' && outputFile && await exists(outputFile)) {
      const filename = path.basename(outputFile);
      await fs.copyFile(outputFile, path.join(REVIEW_AUDIO_DIR, filename));
      audioMarkup = `<audio controls preload="metadata" src="./audio/${esc(filename)}"></audio>`;
    } else {
      audioMarkup = `<p class="blocked">No playable audio: ${esc(candidate.error?.message || candidate.status || 'not generated')}</p>`;
    }

    cards.push(`
      <section class="card">
        <h2>${esc(candidate.id)}</h2>
        ${audioMarkup}
        <div class="tags">
          <span>${esc(candidate.goal)}</span>
          <span>${esc(candidate.duration)}s</span>
          <span>${esc(candidate.status)}</span>
        </div>
        <h3>Prompt</h3>
        <pre>${esc(candidate.prompt)}</pre>
        <h3>Negative prompt</h3>
        <pre>${esc(candidate.negative_prompt)}</pre>
      </section>`);
  }

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stability Audio Sleep Spike 001</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080a0f; color: #edf4ff; }
      body { margin: 0; padding: 32px; }
      main { max-width: 980px; margin: 0 auto; }
      h1 { margin: 0 0 10px; font-size: 28px; }
      h2 { margin: 0 0 14px; font-size: 19px; }
      h3 { margin: 16px 0 8px; font-size: 14px; color: #c9d7ef; }
      p { color: #b8c3d9; line-height: 1.65; }
      audio { width: 100%; margin: 12px 0; }
      pre { white-space: pre-wrap; word-break: break-word; padding: 14px; color: #dce7ff; background: rgba(0,0,0,.28); border-radius: 14px; }
      .card { border: 1px solid rgba(255,255,255,.12); border-radius: 22px; padding: 24px; margin: 18px 0; background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04)); box-shadow: 0 24px 80px rgba(0,0,0,.28); }
      .tags span { display: inline-block; border: 1px solid rgba(255,255,255,.16); border-radius: 999px; padding: 4px 10px; margin: 3px 6px 3px 0; color: #cfe0ff; background: rgba(120,150,255,.12); font-size: 13px; }
      .blocked { color: #ffd9a8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Stability Audio Sleep Spike 001</h1>
      <p>目标：替换失败的本地 MusicGen-Style 路线，验证商用云端音乐生成是否能更接近 Gemini 那种“真正放松”的睡眠/冥想内容。</p>
      <section class="card">
        <h2>Run status</h2>
        <div class="tags">
          <span>provider: ${esc(manifest.provider)}</span>
          <span>route: ${esc(manifest.modelRoute)}</span>
          <span>status: ${esc(manifest.status)}</span>
        </div>
        <p>${esc(manifest.blockedReason || manifest.error?.message || manifest.licenseBoundary || '')}</p>
      </section>
      ${cards.join('\n')}
    </main>
  </body>
</html>`;

  await fs.writeFile(path.join(REVIEW_DIR, 'index.html'), html);
  console.log(path.join(REVIEW_DIR, 'index.html'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
