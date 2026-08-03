#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-15';
const loopReport = JSON.parse(readFileSync(resolve(ROOT, `reports/supply-gap-batch-01-loop-qa-${DATE}.json`), 'utf8'));
const combinationReport = JSON.parse(readFileSync(resolve(ROOT, `reports/supply-gap-batch-01-combination-qa-${DATE}.json`), 'utf8'));

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const loopCards = loopReport.results.map((item, index) => `
  <article class="card" data-id="loop_${escapeHtml(item.id)}" data-status="pending">
    <header><div><p>${String(index + 1).padStart(2, '0')} · 10 分钟循环 · ${escapeHtml(item.family)}</p><h2>${escapeHtml(item.title)}</h2></div><span class="${item.machineStatus}">${escapeHtml(item.machineStatus)}</span></header>
    <audio controls preload="metadata" src="${escapeHtml(item.previewUrl)}"></audio>
    <p class="metrics">${item.analysis.integratedLufs} LUFS · ${item.analysis.samplePeakDbfs} dBFS · 接缝 RMS ${item.seams.maxJoinRmsDeltaDb} dB</p>
    <p>重点听：是否有明显接缝、周期性起伏、疲劳、突然事件、低频压力或十分钟后开始烦躁。</p>
    <div class="actions"><button data-decision="pass">通过</button><button data-decision="needs_fix">需修正</button><button data-decision="reject">拒绝</button></div>
    <textarea placeholder="记录循环、疲劳、突然变化或舒适度问题……"></textarea><b class="decision">待定</b>
  </article>`).join('');

const combinationCards = combinationReport.results.map((item, index) => `
  <article class="card" data-id="combo_${escapeHtml(item.id)}" data-status="pending">
    <header><div><p>${String(index + 1).padStart(2, '0')} · 5 分钟组合 · ${escapeHtml(item.scene)}</p><h2>${escapeHtml(item.title)}</h2></div><span class="${item.machineStatus}">${escapeHtml(item.machineStatus)}</span></header>
    <audio controls preload="metadata" src="${escapeHtml(item.previewUrl)}"></audio>
    <p class="metrics">${item.analysis.integratedLufs} LUFS · ${item.analysis.samplePeakDbfs} dBFS</p>
    <p>${escapeHtml(item.structure)}。重点听：环境身份是否仍清楚、音乐是否抢注意力、整体音量比例是否自然。</p>
    <div class="actions"><button data-decision="pass">通过</button><button data-decision="needs_fix">需修正</button><button data-decision="reject">拒绝</button></div>
    <textarea placeholder="记录场景真实性、音乐比例、专注适配或突然变化问题……"></textarea><b class="decision">待定</b>
  </article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Supply Gap Batch 01 Final Listening QA</title>
<style>
:root{color-scheme:dark;--bg:#0b100f;--panel:#151c19;--line:#2b3732;--text:#edf5f1;--muted:#9eafa7;--good:#7ee2a8;--warn:#ffd077;--bad:#ff9292}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:28px 18px 64px}h1{margin:0 0 8px}.summary,p{line-height:1.55}.summary,.metrics,header p{color:var(--muted)}.stats{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.stats span,.card header span,.decision{border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12px}.grid{display:grid;gap:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:16px}.card header{display:flex;justify-content:space-between;gap:12px}.card h2{font-size:18px;margin:3px 0}.card header p{margin:0;font-size:13px}.pass{color:var(--good);border-color:var(--good)!important}.fail,.card[data-status=reject] .decision{color:var(--bad);border-color:var(--bad)!important}.card[data-status=pass] .decision{color:var(--good);border-color:var(--good)}.card[data-status=needs_fix] .decision{color:var(--warn);border-color:var(--warn)}audio{width:100%;margin:12px 0}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button{border:1px solid var(--line);background:#202a26;color:var(--text);border-radius:6px;padding:9px 12px;cursor:pointer}textarea{width:100%;min-height:65px;background:#0d1311;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:9px}.decision{display:inline-block;margin-top:9px}section>h2{margin-top:30px}.toolbar{display:flex;justify-content:flex-end}@media(max-width:700px){.card header{display:block}}
</style></head><body><main>
<h1>Supply Gap Batch 01 · 最终试听</h1>
<p class="summary">原始候选 13/13 已通过。Ceiling Fan 因机器突变问题留在修正队列，不出现在这里。本页检查其余 12 个候选的十分钟循环，以及 12 个 Recipe V2 多轨组合。</p>
<div class="stats"><span>12 个循环</span><span>12 个组合</span><span>${loopReport.loopMachinePassCount}/12 循环机器通过</span><span>${combinationReport.machinePassCount}/12 组合机器通过</span><span>组合重复度 ${escapeHtml(combinationReport.collectionDiversity.status)}</span></div>
<div class="toolbar"><button id="export">导出决定 TSV</button></div>
<section><h2>第一部分：10 分钟循环</h2><div class="grid">${loopCards}</div></section>
<section><h2>第二部分：5 分钟 Recipe V2 组合</h2><div class="grid">${combinationCards}</div></section>
</main><script>
const key='supply-gap-batch-01-final-listening-v1',cards=[...document.querySelectorAll('.card')],load=()=>JSON.parse(localStorage.getItem(key)||'{}'),save=s=>localStorage.setItem(key,JSON.stringify(s));
function render(){const s=load();for(const c of cards){const v=s[c.dataset.id]||{decision:'pending',notes:''};c.dataset.status=v.decision;c.querySelector('.decision').textContent=({pending:'待定',pass:'通过',needs_fix:'需修正',reject:'拒绝'})[v.decision];c.querySelector('textarea').value=v.notes||''}}
for(const c of cards){c.onclick=e=>{const b=e.target.closest('button[data-decision]');if(!b)return;const s=load();s[c.dataset.id]={...(s[c.dataset.id]||{}),decision:b.dataset.decision,notes:c.querySelector('textarea').value};save(s);render()};c.querySelector('textarea').onchange=e=>{const s=load();s[c.dataset.id]={...(s[c.dataset.id]||{decision:'pending'}),notes:e.target.value};save(s)}}
document.querySelector('#export').onclick=()=>{const s=load(),rows=[['item_id','decision','notes'],...cards.map(c=>{const v=s[c.dataset.id]||{decision:'pending',notes:''};return[c.dataset.id,v.decision,v.notes]})],tsv=rows.map(r=>r.map(x=>String(x).replaceAll('\\t',' ').replaceAll('\\n',' ')).join('\\t')).join('\\n')+'\\n',a=document.createElement('a');a.href=URL.createObjectURL(new Blob([tsv],{type:'text/tab-separated-values'}));a.download='supply-gap-batch-01-final-listening-decisions.tsv';a.click();URL.revokeObjectURL(a.href)};render();
</script></body></html>`;

mkdirSync(resolve(ROOT, 'public/review'), { recursive: true });
writeFileSync(resolve(ROOT, 'public/review/supply-gap-batch-01-final.html'), html);
console.log(JSON.stringify({
  page: 'public/review/supply-gap-batch-01-final.html',
  loopCount: loopReport.results.length,
  combinationCount: combinationReport.results.length,
  loopMachinePassCount: loopReport.loopMachinePassCount,
  combinationMachinePassCount: combinationReport.machinePassCount,
  promotionAllowed: false,
}, null, 2));
