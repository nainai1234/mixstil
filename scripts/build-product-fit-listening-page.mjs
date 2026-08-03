#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const INPUT_TSV = 'docs/asset-batch-06-product-fit-asmr-download-candidates.tsv';
const QUEUE_TSV = 'docs/asmr-product-fit-listening-qa-queue.tsv';
const OUTPUT_HTML = 'public/review/asmr-product-fit-listening-qa.html';
const REPORT_MD = 'reports/asmr-product-fit-listening-qa-queue-2026-07-13.md';

const parseTsv = (content) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows.filter(Boolean).map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const toTsv = (rows, headers) => [
  headers.join('\t'),
  ...rows.map((row) => headers.map((header) => String(row[header] ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ')).join('\t')),
].join('\n');

const assetUrl = (localPath) => `/${localPath.replace(/^public\//, '')}`;

const riskFromPeak = (row) => {
  const peak = Number(row.max_volume_db);
  if (!Number.isFinite(peak)) return 'unknown';
  if (peak >= -1) return 'high';
  if (peak >= -4) return 'medium';
  return 'low';
};

const sceneLabel = (scene) => scene
  .replaceAll('sleep_onset', 'Sleep onset')
  .replaceAll('return_to_sleep', 'Return to sleep')
  .replaceAll('meditative_breathing', 'Meditative breathing')
  .replaceAll('emotional_calming', 'Emotional calming')
  .replaceAll('focus', 'Focus')
  .replaceAll(',', ' / ');

const reviewFocus = (row) => {
  const notes = [
    `Product-fit question: does this actually feel useful for ${sceneLabel(row.product_scene)}, or does it still feel arbitrary?`,
    row.voice_presence === 'none'
      ? 'Confirm no speech, conversation, laughter, crowd, or other human interruption.'
      : 'Voice-like content must be intentional, gentle, understandable, non-medical, and non-random.',
  ];
  if (row.content_type.includes('thunder')) notes.push('Thunder/startle risk: approve only for explicit calming users, not default sleep routing.');
  if (Number(row.max_volume_db) >= -1) notes.push('Peak is high; likely needs normalization or rejection if it feels foreground/startling.');
  if (row.content_type === 'calm_music') notes.push('Music foreground risk: approve only if it can sit quietly under the scene without pulling attention.');
  return notes.join(' ');
};

const rows = parseTsv(await readFile(INPUT_TSV, 'utf8')).map((row, index) => ({
  listen_order: String(index + 1).padStart(2, '0'),
  candidate_id: row.candidate_id,
  source_platform: row.source_platform,
  source_title: row.source_title,
  source_url: row.source_url,
  license_name: row.license_name,
  license_url: row.license_url,
  content_type: row.content_type,
  voice_presence: row.voice_presence,
  product_scene: row.product_scene,
  product_fit_hypothesis: row.product_fit_hypothesis,
  local_path: row.local_path,
  duration_seconds: row.duration_seconds,
  mean_volume_db: row.mean_volume_db,
  max_volume_db: row.max_volume_db,
  startle_risk: riskFromPeak(row),
  listening_status: 'pending',
  promotion_status: 'qa_only',
  review_focus: reviewFocus(row),
  listening_notes: '',
}));

const headers = [
  'listen_order', 'candidate_id', 'source_platform', 'source_title', 'source_url',
  'license_name', 'license_url', 'content_type', 'voice_presence', 'product_scene',
  'product_fit_hypothesis', 'local_path', 'duration_seconds', 'mean_volume_db',
  'max_volume_db', 'startle_risk', 'listening_status', 'promotion_status',
  'review_focus', 'listening_notes',
];

await mkdir(dirname(QUEUE_TSV), { recursive: true });
await mkdir(dirname(OUTPUT_HTML), { recursive: true });
await mkdir(dirname(REPORT_MD), { recursive: true });
await writeFile(QUEUE_TSV, `${toTsv(rows, headers)}\n`, 'utf8');

const cards = rows.map((row) => `
  <article class="candidate" data-type="${escapeHtml(row.content_type)}" data-status="pending" data-id="${escapeHtml(row.candidate_id)}">
    <header>
      <div>
        <span class="order">${escapeHtml(row.listen_order)}</span>
        <h2>${escapeHtml(row.source_title)}</h2>
        <p>${escapeHtml(row.candidate_id)} · ${escapeHtml(row.source_platform)} · ${escapeHtml(row.content_type)} · ${escapeHtml(row.duration_seconds)}s · peak ${escapeHtml(row.max_volume_db)} dB</p>
      </div>
      <span class="status-pill">pending</span>
    </header>
    <audio controls preload="metadata" src="${escapeHtml(assetUrl(row.local_path))}"></audio>
    <dl class="metadata">
      <div><dt>Scene</dt><dd>${escapeHtml(sceneLabel(row.product_scene))}</dd></div>
      <div><dt>License</dt><dd>${escapeHtml(row.license_name)}</dd></div>
      <div><dt>Voice</dt><dd>${escapeHtml(row.voice_presence)}</dd></div>
      <div><dt>Startle</dt><dd>${escapeHtml(row.startle_risk)}</dd></div>
    </dl>
    <div class="hypothesis">${escapeHtml(row.product_fit_hypothesis)}</div>
    <div class="focus">${escapeHtml(row.review_focus)}</div>
    <div class="controls" role="group" aria-label="Review status">
      <button type="button" data-set-status="approve_product_fit">Approve Fit</button>
      <button type="button" data-set-status="scene_limited">Scene Limited</button>
      <button type="button" data-set-status="needs_edit">Needs Edit</button>
      <button type="button" data-set-status="reject_product_fit">Reject Fit</button>
      <button type="button" data-set-status="pending">Clear</button>
    </div>
    <label>
      Listening notes
      <textarea placeholder="Example: feels like sleep bed; thunder too sharp; music too foreground; no people heard"></textarea>
    </label>
  </article>
`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product-Fit Audio Listening QA</title>
  <style>
    :root { color-scheme: light; --ink:#17201b; --muted:#5d6a62; --line:#d7ddd8; --surface:#f5f6f3; --panel:#fff; --accent:#246b5f; --reject:#9b2c2c; --warn:#865b00; --review:#475569; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--surface); color:var(--ink); }
    .shell { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:20px 0 48px; }
    .topbar { position:sticky; top:0; z-index:10; background:rgba(245,246,243,.96); border-bottom:1px solid var(--line); backdrop-filter:blur(10px); }
    .topbar-inner { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:14px 0; display:grid; grid-template-columns:1fr auto; gap:16px; align-items:center; }
    h1 { margin:0; font-size:20px; font-weight:760; letter-spacing:0; }
    .summary { color:var(--muted); font-size:13px; margin-top:4px; line-height:1.45; }
    .filters { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    button, select { border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:6px; min-height:36px; padding:0 12px; font:inherit; cursor:pointer; }
    button:hover, select:hover { border-color:var(--accent); }
    .grid { display:grid; gap:12px; }
    .candidate { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
    .candidate header { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:start; }
    .order { display:inline-grid; place-items:center; width:34px; height:28px; margin-right:8px; border:1px solid var(--line); border-radius:6px; color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
    h2 { display:inline; margin:0; font-size:16px; font-weight:720; letter-spacing:0; }
    p { margin:6px 0 0 44px; color:var(--muted); font-size:13px; }
    audio { width:100%; margin:14px 0 10px; }
    .metadata { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; margin:0 0 10px; }
    .metadata div { border:1px solid var(--line); border-radius:6px; padding:8px 10px; min-width:0; }
    dt { color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:3px 0 0; font-size:13px; overflow-wrap:anywhere; }
    .hypothesis, .focus { padding:8px 10px; font-size:13px; line-height:1.45; }
    .hypothesis { background:#f8faf8; border:1px solid var(--line); border-radius:6px; margin-bottom:8px; }
    .focus { border-left:3px solid var(--accent); background:#edf3ef; color:#27342f; }
    .controls { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
    label { display:grid; gap:6px; color:var(--muted); font-size:13px; }
    textarea { width:100%; min-height:72px; resize:vertical; border:1px solid var(--line); border-radius:6px; padding:10px; font:inherit; color:var(--ink); background:#fff; }
    .status-pill { min-width:112px; text-align:center; border-radius:999px; padding:5px 10px; border:1px solid var(--line); color:var(--muted); font-size:12px; font-weight:680; overflow-wrap:anywhere; }
    .candidate[data-status="approve_product_fit"] .status-pill { color:var(--accent); border-color:var(--accent); }
    .candidate[data-status="reject_product_fit"] .status-pill { color:var(--reject); border-color:var(--reject); }
    .candidate[data-status="needs_edit"] .status-pill { color:var(--warn); border-color:var(--warn); }
    .candidate[data-status="scene_limited"] .status-pill { color:var(--review); border-color:var(--review); }
    .candidate[data-status="approve_product_fit"] button[data-set-status="approve_product_fit"],
    .candidate[data-status="scene_limited"] button[data-set-status="scene_limited"],
    .candidate[data-status="needs_edit"] button[data-set-status="needs_edit"],
    .candidate[data-status="reject_product_fit"] button[data-set-status="reject_product_fit"] { color:#fff; background:var(--accent); border-color:var(--accent); }
    .candidate[data-status="reject_product_fit"] button[data-set-status="reject_product_fit"] { background:var(--reject); border-color:var(--reject); }
    .candidate[data-status="needs_edit"] button[data-set-status="needs_edit"] { background:var(--warn); border-color:var(--warn); }
    .candidate[data-status="scene_limited"] button[data-set-status="scene_limited"] { background:var(--review); border-color:var(--review); }
    .export { background:var(--accent); border-color:var(--accent); color:#fff; }
    @media (max-width:860px) { .topbar-inner{grid-template-columns:1fr;} .filters{justify-content:flex-start;} .metadata{grid-template-columns:repeat(2,minmax(0,1fr));} }
    @media (max-width:620px) { .candidate header{grid-template-columns:1fr;} p{margin-left:0;} .metadata{grid-template-columns:1fr;} }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div>
        <h1>Product-Fit Audio Listening QA</h1>
        <div class="summary">${rows.length} candidates · approve only if the sound clearly helps sleep, meditation, calming, or focus · this is not an ASMR novelty queue</div>
      </div>
      <div class="filters">
        <select id="statusFilter" aria-label="Status filter">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approve_product_fit">Approve Fit</option>
          <option value="scene_limited">Scene Limited</option>
          <option value="needs_edit">Needs Edit</option>
          <option value="reject_product_fit">Reject Fit</option>
        </select>
        <button class="export" type="button" id="exportButton">Export TSV</button>
      </div>
    </div>
  </div>
  <main class="shell"><div class="grid">${cards}</div></main>
  <script>
    const storageKey = 'snooze.productFitListeningQa.v1';
    const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const candidates = [...document.querySelectorAll('.candidate')];
    const statusFilter = document.getElementById('statusFilter');
    const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
    const applyFilters = () => {
      const status = statusFilter.value;
      candidates.forEach((card) => { card.hidden = !(status === 'all' || card.dataset.status === status); });
    };
    const setCardStatus = (card, status) => {
      card.dataset.status = status;
      card.querySelector('.status-pill').textContent = status;
      const id = card.dataset.id;
      state[id] = state[id] || {};
      state[id].status = status;
      save();
      applyFilters();
    };
    candidates.forEach((card) => {
      const id = card.dataset.id;
      const saved = state[id] || {};
      if (saved.status) setCardStatus(card, saved.status);
      const textarea = card.querySelector('textarea');
      textarea.value = saved.notes || '';
      textarea.addEventListener('input', () => {
        state[id] = state[id] || {};
        state[id].notes = textarea.value;
        save();
      });
      card.querySelectorAll('button[data-set-status]').forEach((button) => {
        button.addEventListener('click', () => setCardStatus(card, button.dataset.setStatus));
      });
    });
    statusFilter.addEventListener('change', applyFilters);
    document.getElementById('exportButton').addEventListener('click', async () => {
      const output = [['candidate_id', 'listening_status', 'listening_notes']];
      candidates.forEach((card) => {
        const saved = state[card.dataset.id] || {};
        output.push([card.dataset.id, saved.status || 'pending', saved.notes || '']);
      });
      const text = output.map((row) => row.map((cell) => String(cell).replaceAll('\\t', ' ').replaceAll('\\n', ' ')).join('\\t')).join('\\n');
      await navigator.clipboard.writeText(text);
      alert('TSV copied to clipboard.');
    });
    applyFilters();
  </script>
</body>
</html>`;

await writeFile(OUTPUT_HTML, html, 'utf8');
await writeFile(REPORT_MD, [
  '# Product-Fit Listening QA Queue',
  '',
  'Date: 2026-07-13',
  'Status: listening queue only; no item is seeded or routable.',
  '',
  `Candidates: ${rows.length}`,
  '',
  ...rows.map((row) => `- ${row.candidate_id}: ${row.source_title} (${sceneLabel(row.product_scene)})`),
  '',
  `Page: ${OUTPUT_HTML}`,
  `Queue: ${QUEUE_TSV}`,
  '',
].join('\n'), 'utf8');

console.log(`wrote ${QUEUE_TSV}`);
console.log(`wrote ${OUTPUT_HTML}`);
console.log(`wrote ${REPORT_MD}`);
