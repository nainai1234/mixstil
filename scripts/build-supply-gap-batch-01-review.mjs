#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-15';
const indoorReportPath = resolve(ROOT, 'reports/authentic-indoor-source-review-2026-07-14.json');
const focusReportPath = resolve(ROOT, 'reports/supply-gap-batch-01-focus-machine-qa-2026-07-15.json');
const focusPreviewDir = resolve(ROOT, 'public/audio/music/local-review/2026-07-15');
const diversityAnalyzer = resolve(ROOT, 'scripts/analyze-collection-diversity.py');
const python = resolve(ROOT, '.venv-audio/bin/python');

const indoorReport = JSON.parse(readFileSync(indoorReportPath, 'utf8'));
const focusReport = JSON.parse(readFileSync(focusReportPath, 'utf8'));
const focusDiversity = JSON.parse(execFileSync(
  python,
  [diversityAnalyzer, focusPreviewDir],
  { cwd: ROOT, encoding: 'utf8' },
));

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const indoorCandidates = indoorReport.results.map((item) => ({
  id: `indoor_${item.id}`,
  sourceId: item.id,
  group: 'Authentic indoor and device recordings',
  category: 'Environment candidate',
  title: item.title,
  family: item.family,
  audioUrl: item.reviewUrl,
  machineStatus: item.machineStatus,
  failures: item.failures,
  license: item.licenseName,
  source: [item.sourcePlatform, item.sourceCreator].filter(Boolean).join(' · '),
  metrics: `${item.reviewAnalysis.durationSeconds.toFixed(1)}s · ${item.reviewAnalysis.integratedLufs.toFixed(2)} LUFS · ${item.reviewAnalysis.samplePeakDbfs.toFixed(2)} dBFS`,
  reviewPrompt: '确认声音确实属于标注场景；任何人声、谈话、儿童、广播或明显人类活动都直接拒绝。检查机械突变、疲劳感、循环可用性和低音量舒适度。',
}));

const focusCandidates = focusReport.results.map((item) => ({
  id: `focus_${item.id}`,
  sourceId: item.id,
  group: 'Locally synthesized focus music',
  category: 'Focus music candidate',
  title: item.id.replaceAll('procedural_', '').replaceAll('_', ' '),
  family: item.family,
  audioUrl: item.previewUrl,
  machineStatus: item.machineStatus,
  failures: item.failures,
  license: 'Deterministic project-owned synthesis',
  source: `Profile ${item.profile} · Seed ${item.seed}`,
  metrics: `${item.analysis.durationSeconds.toFixed(1)}s · ${item.analysis.integratedLufs.toFixed(2)} LUFS · ${item.analysis.samplePeakDbfs.toFixed(2)} dBFS`,
  reviewPrompt: '确认适合专注而不是催眠、阴森、电影化或过度悦耳；拒绝明显节拍、旋律钩子、突然变化、持续音高压力和一分钟内已经令人疲劳的声音。',
}));

const candidates = [...indoorCandidates, ...focusCandidates];
const machinePassCount = candidates.filter((item) => item.machineStatus === 'pass').length;
const report = {
  generatedAt: new Date().toISOString(),
  batchId: 'supply_gap_batch_01',
  candidateCount: candidates.length,
  machinePassCount,
  promotionAllowed: false,
  focusDiversity,
  remainingGates: [
    'human_listening',
    'no_human_voice_hard_gate',
    'semantic_identity',
    'scene_fit',
    'long_loop_fatigue',
    'license_snapshot_review',
    'recipe_v2_combination_qa',
  ],
  candidates,
};

mkdirSync(resolve(ROOT, 'reports'), { recursive: true });
mkdirSync(resolve(ROOT, 'public/review'), { recursive: true });
writeFileSync(
  resolve(ROOT, `reports/supply-gap-batch-01-review-${DATE}.json`),
  `${JSON.stringify(report, null, 2)}\n`,
);

const markdownRows = candidates.map((item, index) =>
  `| ${String(index + 1).padStart(2, '0')} | ${item.title} | ${item.family} | ${item.machineStatus} | [试听](http://localhost:5174${item.audioUrl}) |`);
writeFileSync(
  resolve(ROOT, `reports/supply-gap-batch-01-review-${DATE}.md`),
  `# Supply Gap Batch 01 Review\n\nDate: ${DATE}  \nStatus: candidate-only. Nothing is approved or available to Quick Create.\n\n- Candidates: ${candidates.length}\n- Machine pass: ${machinePassCount}\n- Focus collection diversity: ${focusDiversity.status}\n- Focus maximum spectral correlation: ${focusDiversity.maxSpectralCorrelation}\n\n| # | Candidate | Family | Machine | Review |\n| --- | --- | --- | --- | --- |\n${markdownRows.join('\n')}\n\nHuman listening, no-human-voice, semantic identity, loop-fatigue, rights, and Recipe V2 combination gates remain required.\n`,
);

const cards = candidates.map((item, index) => `
  <article class="candidate" data-id="${escapeHtml(item.id)}" data-group="${escapeHtml(item.group)}" data-status="pending">
    <header>
      <div>
        <p class="eyebrow">${String(index + 1).padStart(2, '0')} · ${escapeHtml(item.category)} · ${escapeHtml(item.family)}</p>
        <h2>${escapeHtml(item.title)}</h2>
        <p class="source">${escapeHtml(item.source)} · ${escapeHtml(item.license)}</p>
      </div>
      <span class="machine ${item.machineStatus === 'pass' ? 'pass' : 'fail'}">${escapeHtml(item.machineStatus)}</span>
    </header>
    <audio controls preload="metadata" src="${escapeHtml(item.audioUrl)}"></audio>
    <p class="metrics">${escapeHtml(item.metrics)}</p>
    ${item.failures.length ? `<p class="failure">Machine failures: ${escapeHtml(item.failures.join(', '))}</p>` : ''}
    <p class="prompt">${escapeHtml(item.reviewPrompt)}</p>
    <div class="actions">
      <button type="button" data-decision="pending">待定</button>
      <button type="button" data-decision="pass">听感通过</button>
      <button type="button" data-decision="needs_fix">需要修正</button>
      <button type="button" data-decision="reject">拒绝</button>
    </div>
    <textarea placeholder="记录人声、场景真实性、节拍、疲劳、突然变化、循环或组合问题……"></textarea>
    <span class="decision">待定</span>
  </article>`).join('\n');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Supply Gap Batch 01 Listening QA</title>
  <style>
    :root { color-scheme:dark; --bg:#0b100f; --panel:#151c19; --line:#2b3732; --text:#edf5f1; --muted:#9eafa7; --good:#7ee2a8; --warn:#ffd077; --bad:#ff9292; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif; }
    main { max-width:1120px; margin:auto; padding:28px 18px 64px; }
    h1 { margin:0 0 8px; font-size:28px; }
    .summary { color:var(--muted); line-height:1.6; max-width:850px; }
    .stats { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 24px; }
    .stats span, .machine, .decision { border:1px solid var(--line); border-radius:999px; padding:6px 10px; font-size:12px; }
    .group-title { margin:30px 0 12px; font-size:20px; }
    .grid { display:grid; gap:14px; }
    .candidate { position:relative; padding:16px; border:1px solid var(--line); border-radius:9px; background:var(--panel); }
    header { display:flex; justify-content:space-between; gap:14px; }
    h2 { margin:4px 0; font-size:18px; text-transform:capitalize; }
    .eyebrow,.source,.metrics { color:var(--muted); margin:0; font-size:13px; }
    audio { width:100%; margin:14px 0 8px; }
    .prompt { line-height:1.6; }
    .failure { color:var(--bad); }
    .machine.pass { color:var(--good); border-color:var(--good); }
    .machine.fail { color:var(--bad); border-color:var(--bad); }
    .actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
    button, #export { border:1px solid var(--line); background:#202a26; color:var(--text); border-radius:6px; padding:9px 11px; cursor:pointer; }
    textarea { width:100%; min-height:72px; border:1px solid var(--line); background:#0d1311; color:var(--text); border-radius:6px; padding:10px; resize:vertical; }
    .decision { display:inline-block; margin-top:10px; color:var(--muted); }
    .candidate[data-status="pass"] .decision { color:var(--good); border-color:var(--good); }
    .candidate[data-status="needs_fix"] .decision { color:var(--warn); border-color:var(--warn); }
    .candidate[data-status="reject"] .decision { color:var(--bad); border-color:var(--bad); }
    .toolbar { display:flex; justify-content:flex-end; margin:12px 0; }
    @media(max-width:700px) { header { display:block; } .machine { display:inline-block; margin-top:8px; } }
  </style>
</head>
<body>
  <main>
    <h1>Supply Gap Batch 01 · 试听审核</h1>
    <p class="summary">本页只包含候选素材。机器通过不等于正式可用；有任何可听人声直接拒绝。完成听感后导出决定，仍需循环、授权和 Recipe V2 组合审核。</p>
    <div class="stats">
      <span>${candidates.length} 个候选</span>
      <span>${machinePassCount} 个机器通过</span>
      <span>Focus 重复度：${escapeHtml(focusDiversity.status)}</span>
      <span>最高相关度：${escapeHtml(focusDiversity.maxSpectralCorrelation)}</span>
    </div>
    <div class="toolbar"><button type="button" id="export">导出试听决定 TSV</button></div>
    <h2 class="group-title">真实室内与设备录音</h2>
    <section class="grid">${cards.split('<article').slice(1, indoorCandidates.length + 1).map((card) => `<article${card}`).join('')}</section>
    <h2 class="group-title">本机生成的 Focus 音乐</h2>
    <section class="grid">${cards.split('<article').slice(indoorCandidates.length + 1).map((card) => `<article${card}`).join('')}</section>
  </main>
  <script>
    const storageKey = 'supply-gap-batch-01-listening-v1';
    const cards = [...document.querySelectorAll('.candidate')];
    const load = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
    const save = (state) => localStorage.setItem(storageKey, JSON.stringify(state));
    const render = () => {
      const state = load();
      for (const card of cards) {
        const value = state[card.dataset.id] || { decision:'pending', notes:'' };
        card.dataset.status = value.decision;
        card.querySelector('.decision').textContent = ({pending:'待定',pass:'听感通过',needs_fix:'需要修正',reject:'拒绝'})[value.decision] || value.decision;
        card.querySelector('textarea').value = value.notes || '';
      }
    };
    for (const card of cards) {
      card.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-decision]');
        if (!button) return;
        const state = load();
        state[card.dataset.id] = { ...(state[card.dataset.id] || {}), decision:button.dataset.decision, notes:card.querySelector('textarea').value };
        save(state); render();
      });
      card.querySelector('textarea').addEventListener('change', (event) => {
        const state = load();
        state[card.dataset.id] = { ...(state[card.dataset.id] || {decision:'pending'}), notes:event.target.value };
        save(state);
      });
    }
    document.querySelector('#export').addEventListener('click', () => {
      const state = load();
      const rows = [['candidate_id','decision','notes'], ...cards.map((card) => {
        const value = state[card.dataset.id] || {decision:'pending',notes:''};
        return [card.dataset.id,value.decision,value.notes];
      })];
      const tsv = rows.map((row) => row.map((cell) => String(cell).replaceAll('\\t',' ').replaceAll('\\n',' ')).join('\\t')).join('\\n') + '\\n';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([tsv], {type:'text/tab-separated-values'}));
      link.download = 'supply-gap-batch-01-listening-decisions.tsv';
      link.click();
      URL.revokeObjectURL(link.href);
    });
    render();
  </script>
</body>
</html>`;

writeFileSync(resolve(ROOT, 'public/review/supply-gap-batch-01.html'), html);
console.log(JSON.stringify({
  page: 'public/review/supply-gap-batch-01.html',
  report: `reports/supply-gap-batch-01-review-${DATE}.md`,
  candidateCount: candidates.length,
  machinePassCount,
  focusDiversity: focusDiversity.status,
  promotionAllowed: false,
}, null, 2));
