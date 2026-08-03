import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/music-kit-production-v2.json'), 'utf8'));
const roleNames = {
  harmony: '和声层',
  melody: '旋律层',
  accompaniment: '伴奏层',
  low_support: '低音支撑层',
  transition: '过渡层',
};
const goalNames = { sleep: '睡眠', calm: '放松 / 冥想', focus: '专注' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const sections = manifest.kits.map((kit) => `
<article class="kit">
  <div class="kit-heading"><span class="eyebrow">${escapeHtml(goalNames[kit.goal])} · ${escapeHtml(kit.profileId)}</span><h2>${escapeHtml(kit.compositionId ?? kit.profileId)}</h2><p>${escapeHtml(kit.form)} · ${kit.durationSeconds} 秒 · ${escapeHtml(kit.id)}</p></div>
  <div class="stems">${kit.stems.map((stem) => `<div class="stem"><div class="stem-label"><strong>${escapeHtml(roleNames[stem.role] ?? stem.role)}</strong><span>${stem.defaultVolume}% 默认音量</span></div><audio controls preload="metadata" src="../../${escapeHtml(stem.audioUrl.replace(/^\//, ''))}"></audio></div>`).join('')}</div>
</article>`).join('\n');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MusicKit V2 元素试听</title><style>
:root{color-scheme:dark}body{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:980px;margin:auto;padding:28px 18px 70px}header{padding:10px 0 22px;border-bottom:1px solid #344139}.eyebrow{font-size:12px;letter-spacing:.04em;color:#aebeb2;text-transform:uppercase}h1{font-size:28px;margin:8px 0 12px}h2{font-size:20px;margin:4px 0 8px}p{color:#b8c5ba;line-height:1.5}.kit{padding:25px 0;border-bottom:1px solid #344139}.kit-heading p{font-size:13px;margin:5px 0 16px}.stem{padding:10px 0 14px;border-top:1px solid #253229}.stem-label{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.stem-label span{font-size:12px;color:#90a095}audio{width:100%;margin-top:7px;height:38px}@media(max-width:560px){main{padding:20px 14px 50px}h1{font-size:24px}.stem-label{display:block}.stem-label span{display:block;margin-top:3px}}
</style></head><body><main><header><div class="eyebrow">SNOOZE · APPROVED MUSIC INVENTORY V2</div><h1>18 套 MusicKit 的元素试听</h1><p>下面是正式基础素材中的 90 个独立 Stem。每套作品包含和声、旋律、伴奏、低音支撑、过渡五层。这里试听的是单独元素，不是完整混音；点击每个播放器即可试听。</p><p>${manifest.kits.length} 套作品 · ${manifest.kits.flatMap((kit) => kit.stems).length} 个元素 · 无付费 API · CC0 素材与 SNOOZE 自有编排</p></header>${sections}</main></body></html>`;
const output = path.join(root, 'public/review/music-kit-production-v2-elements/index.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`PASS: built ${output} with ${manifest.kits.flatMap((kit) => kit.stems).length} element players`);
