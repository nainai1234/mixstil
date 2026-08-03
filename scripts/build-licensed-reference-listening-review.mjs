import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'config/licensed-reference-audio-analysis-v1.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const outputDir = path.join(root, 'public/review/licensed-reference-listening-v1');
const audioDir = path.join(outputDir, 'audio');

const sourceFiles = {
  licensed_ambient_architextures2: 'legal_ambient_architextures2.mp3',
  licensed_ambient_bing_show17: 'legal_ambient_bing_show17.mp3',
  licensed_ambient_bing_show18: 'legal_ambient_bing_show18.mp3',
  licensed_ambient_idmix06: 'legal_ambient_idmix06.mp3',
  licensed_focus_fingers_noise: 'legal_focus_fingers_noise.mp3',
  licensed_focus_titfos: 'legal_focus_titfos.mp3',
  licensed_meditation_danutz: 'legal_meditation_danutz.mp3',
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const formatDuration = (seconds) => {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(rest).padStart(2, '0')}`;
};
const round = (value, digits = 1) => Number(value).toFixed(digits);

fs.mkdirSync(audioDir, { recursive: true });
for (const record of manifest.records) {
  const fileName = sourceFiles[record.referenceId];
  if (!fileName) throw new Error(`No local audio mapping for ${record.referenceId}`);
  const source = path.join(root, 'imports/reference-licensed', fileName);
  const destination = path.join(audioDir, fileName);
  if (!fs.existsSync(source)) throw new Error(`Missing local audio: ${source}`);
  if (!fs.existsSync(destination)) {
    try {
      fs.linkSync(source, destination);
    } catch {
      fs.copyFileSync(source, destination);
    }
  }
}

const reviewRecords = manifest.records.map((record) => ({
  id: record.referenceId,
  title: record.source.title,
  creator: record.source.creator,
  license: record.source.licenseEvidence,
  audioUrl: `./audio/${sourceFiles[record.referenceId]}`,
  durationSeconds: record.audio.durationSeconds,
  durationLabel: formatDuration(record.audio.durationSeconds),
  integratedLufs: record.audio.integratedLufs,
  loudnessRangeLu: record.audio.loudnessRangeLu,
  tempoBpm: record.music.tempoBpm,
  onsetRatePerMinute: record.audio.onsetRatePerMinute,
  spectralCentroidHz: record.audio.spectralCentroidHz,
  highFrequencyEnergyRatio: record.audio.highFrequencyEnergyRatio,
  instrumentRoles: record.music.instrumentRoles,
}));

const rows = reviewRecords.map((record, index) => `
<article class="track" data-id="${escapeHtml(record.id)}">
  <header class="track-head">
    <div><span class="number">${String(index + 1).padStart(2, '0')}</span><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.creator)} · ${record.durationLabel}</p></div>
    <button class="load" type="button">载入试听</button>
  </header>
  <div class="metrics" aria-label="机器分析摘要">
    <span><b>${round(record.integratedLufs)}</b> LUFS</span><span><b>${round(record.loudnessRangeLu)}</b> LU 动态</span>
    <span><b>${round(record.tempoBpm.min)}</b> BPM 候选</span><span><b>${round(record.onsetRatePerMinute)}</b> 起音/分钟</span>
    <span><b>${Math.round(record.spectralCentroidHz)}</b> Hz 频谱重心</span><span><b>${round(record.highFrequencyEnergyRatio * 100)}</b>% 高频能量</span>
  </div>
  <p class="machine-note">机器标签：${record.instrumentRoles.map(escapeHtml).join(' / ')}。BPM、乐器和起音结果仅是检测候选，必须以试听判断为准。</p>
  <div class="review-grid">
    <label>主要适用场景<select data-field="primaryFit"><option value="">未判断</option><option value="meditation">冥想</option><option value="sleep">睡眠</option><option value="focus">专注</option><option value="ambient_contrast">环境对照</option><option value="reject">不适合</option></select></label>
    <label>人声<select data-field="voice"><option value="">未判断</option><option value="none">无人声</option><option value="present">有人声</option><option value="uncertain">不确定</option></select></label>
    <label>强节拍<select data-field="strongBeat"><option value="">未判断</option><option value="no">没有</option><option value="yes">有</option><option value="varies">局部存在</option></select></label>
    <label>惊扰风险<select data-field="startleRisk"><option value="">未判断</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
    <label>长时循环疲劳<select data-field="loopFatigue"><option value="">未判断</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
    <label>最终结论<select data-field="decision"><option value="">待审核</option><option value="keep">保留为参考</option><option value="contrast_only">仅作反例/对照</option><option value="reject">淘汰</option></select></label>
  </div>
  <label class="notes">试听记录<textarea data-field="notes" rows="3" placeholder="记录开头、中段、结尾的结构、音色、变化和风险"></textarea></label>
</article>`).join('');

const payload = JSON.stringify(reviewRecords).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>长音频人工审核</title><style>
:root{color-scheme:dark;--bg:#111311;--panel:#191d1a;--panel2:#202621;--line:#39443c;--text:#f0f3ef;--muted:#aab4ac;--accent:#e0c47b;--green:#9cc5a1}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}button,select,textarea{font:inherit}main{max-width:1060px;margin:auto;padding:24px 18px 80px}.intro{border-bottom:1px solid var(--line);padding-bottom:22px}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;margin:0}h1{font-size:30px;margin:8px 0 10px}.intro>p{max-width:780px;color:var(--muted);line-height:1.55}.summary{display:flex;gap:22px;flex-wrap:wrap;margin-top:18px}.summary strong{display:block;font-size:22px}.summary span{color:var(--muted);font-size:12px}.actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}button{min-height:40px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);padding:0 14px;cursor:pointer}.primary,.load{background:var(--accent);color:#171811;border-color:var(--accent);font-weight:700}.player{position:sticky;top:0;z-index:5;background:rgba(17,19,17,.97);border-bottom:1px solid var(--line);padding:13px 0}.now{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:8px}.now p{margin:3px 0 0;color:var(--muted);font-size:12px}audio{width:100%;height:42px}.seek{display:flex;gap:8px;margin-top:8px}.seek button{min-width:80px}.track{padding:25px 0;border-bottom:1px solid var(--line)}.track-head{display:flex;justify-content:space-between;gap:18px;align-items:start}.track-head>div{display:grid;grid-template-columns:36px 1fr;column-gap:8px}.number{grid-row:1/3;color:var(--accent);font-variant-numeric:tabular-nums}.track h2{font-size:19px;margin:0}.track-head p{color:var(--muted);font-size:13px;margin:5px 0}.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin:15px 0 9px}.metrics span{background:var(--panel);padding:10px;color:var(--muted);font-size:12px}.metrics b{color:var(--text);font-size:14px}.machine-note{color:var(--muted);font-size:12px;line-height:1.45;margin:0 0 14px}.review-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}label{display:grid;gap:5px;color:var(--muted);font-size:12px}select,textarea{width:100%;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--text);padding:9px}textarea{resize:vertical}.notes{margin-top:10px}.complete{color:var(--green)}@media(max-width:720px){main{padding:16px 12px 60px}.player{position:relative}.review-grid,.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.track-head{align-items:start}}@media(max-width:480px){h1{font-size:25px}.review-grid,.metrics{grid-template-columns:1fr}.now{display:block}.load{padding:0 10px}.seek button{flex:1;min-width:0}}
</style></head><body><main><section class="intro"><p class="eyebrow">EXACT AUDIO · HUMAN LISTENING GATE</p><h1>7 条长音频人工审核</h1><p>所有录音均超过 30 分钟并已完成整轨机器分析。请分别检查开头、中段和结尾，再判断它更适合冥想、睡眠、专注、仅作环境对照，或应淘汰。这里不预设通过结论。</p><div class="summary"><div><strong>7</strong><span>待审核录音</span></div><div><strong>30+ min</strong><span>每条最低时长</span></div><div><strong id="progress">0 / 7</strong><span>已完成结论</span></div></div><div class="actions"><button class="primary" id="export" type="button">导出审核 JSON</button><button id="clear" type="button">清空本页记录</button></div></section><section class="player"><div class="now"><div><strong id="nowTitle">请选择一条录音</strong><p id="nowMeta">载入后可跳转到开头、中段和结尾</p></div><span id="position"></span></div><audio id="audio" controls preload="metadata"></audio><div class="seek"><button data-seek="beginning" type="button">开头</button><button data-seek="middle" type="button">中段</button><button data-seek="end" type="button">结尾</button></div></section>${rows}</main><script>
const records=${payload};const storageKey='snooze-licensed-reference-listening-v1';const state=JSON.parse(localStorage.getItem(storageKey)||'{}');const audio=document.getElementById('audio');let current=null;const formatTime=(seconds)=>{const s=Math.max(0,Math.round(seconds||0)),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),r=s%60;return (h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(r).padStart(2,'0')};const save=()=>{localStorage.setItem(storageKey,JSON.stringify(state));updateProgress()};const updateProgress=()=>{const count=records.filter(record=>state[record.id]?.decision).length;const node=document.getElementById('progress');node.textContent=count+' / '+records.length;node.classList.toggle('complete',count===records.length)};const load=(id)=>{current=records.find(record=>record.id===id);audio.src=current.audioUrl;audio.play().catch(()=>{});document.getElementById('nowTitle').textContent=current.title;document.getElementById('nowMeta').textContent=current.creator+' · '+current.durationLabel;window.scrollTo({top:document.querySelector('.player').offsetTop,behavior:'smooth'})};document.querySelectorAll('.track').forEach(card=>{const id=card.dataset.id,stored=state[id]||{};card.querySelectorAll('[data-field]').forEach(input=>{input.value=stored[input.dataset.field]||'';const persist=()=>{state[id]={...(state[id]||{}),[input.dataset.field]:input.value};save()};input.addEventListener('change',persist);input.addEventListener('input',persist)});card.querySelector('.load').addEventListener('click',()=>load(id))});document.querySelectorAll('[data-seek]').forEach(button=>button.addEventListener('click',()=>{if(!current)return;const target=button.dataset.seek==='beginning'?0:button.dataset.seek==='middle'?current.durationSeconds/2:Math.max(0,current.durationSeconds-120);audio.currentTime=target;audio.play().catch(()=>{})}));audio.addEventListener('timeupdate',()=>{document.getElementById('position').textContent=current?formatTime(audio.currentTime)+' / '+current.durationLabel:''});document.getElementById('export').addEventListener('click',()=>{const output={schemaVersion:'1.0.0',reviewedOn:new Date().toISOString(),reviewGate:'human_listening_pending_owner_approval',reviews:records.map(record=>({referenceId:record.id,title:record.title,creator:record.creator,...(state[record.id]||{})}))};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='licensed-reference-listening-results-v1.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});document.getElementById('clear').addEventListener('click',()=>{if(confirm('确定清空 7 条录音的本地审核记录？')){localStorage.removeItem(storageKey);location.reload()}});updateProgress();
</script></body></html>`;

fs.writeFileSync(path.join(outputDir, 'index.html'), html);
console.log(`PASS: built ${path.join(outputDir, 'index.html')} with ${reviewRecords.length} playable long-form records`);
