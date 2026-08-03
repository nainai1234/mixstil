#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const EXTERNAL_QUEUE = 'docs/asmr-product-fit-listening-qa-queue.tsv';
const REJECT_TSV = 'docs/product-fit-external-rejected-quiet-state-2026-07-13.tsv';
const QUIET_QUEUE = 'docs/quiet-state-listening-qa-queue.tsv';
const OUTPUT_HTML = 'public/review/quiet-state-listening-qa.html';
const REPORT_MD = 'reports/quiet-state-listening-qa-queue-2026-07-13.md';

const parseTsv = (content) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows.filter(Boolean).map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const toTsv = (rows, headers) => [
  headers.join('\t'),
  ...rows.map((row) => headers.map((header) => String(row[header] ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ')).join('\t')),
].join('\n');

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const assetUrl = (localPath) => localPath.startsWith('/audio/') ? localPath : `/${localPath.replace(/^public\//, '')}`;

const external = parseTsv(await readFile(EXTERNAL_QUEUE, 'utf8'));
const rejectRows = external.map((row) => ({
  candidate_id: row.candidate_id,
  source_title: row.source_title,
  previous_type: row.content_type,
  previous_scene: row.product_scene,
  decision: 'rejected_quiet_state_fit',
  reason: 'Project-owner review: the sound does not create a fast quiet state for sleep, meditation, or focus; it feels like noise or an odd recording rather than a calming experience.',
  next_action: 'Do not promote or route. Retain only as negative sourcing evidence.',
}));

await mkdir(dirname(REJECT_TSV), { recursive: true });
await writeFile(REJECT_TSV, `${toTsv(rejectRows, ['candidate_id', 'source_title', 'previous_type', 'previous_scene', 'decision', 'reason', 'next_action'])}\n`, 'utf8');

const rows = [
  {
    listen_order: '01',
    candidate_id: 'quiet_state_night_neutral_quiet_room',
    title: 'Night Neutral + Quiet Room',
    local_path: '/audio/music/local-combination-qa/2026-07-13/night_neutral_quiet_room.mp3',
    duration_seconds: '300',
    scene: 'sleep_onset,meditative_breathing',
    composition: 'quiet_room + low_neutral_drone',
    review_focus: 'Does this help the body become quiet quickly without feeling musical, noisy, eerie, or distracting?',
  },
  {
    listen_order: '02',
    candidate_id: 'quiet_state_deep_sleep_soft_brown',
    title: 'Deep Sleep Low + Soft Brown Noise',
    local_path: '/audio/music/local-combination-qa/2026-07-13/deep_sleep_soft_brown.mp3',
    duration_seconds: '300',
    scene: 'sleep_onset,return_to_sleep',
    composition: 'soft_brown_noise + deep_low_drone',
    review_focus: 'Does this feel like a soft pressure blanket for sleep, or is the low end too present?',
  },
  {
    listen_order: '03',
    candidate_id: 'quiet_state_return_to_sleep_low_fan',
    title: 'Return to Sleep Soft + Low Fan',
    local_path: '/audio/music/local-combination-qa/2026-07-13/return_to_sleep_low_fan.mp3',
    duration_seconds: '300',
    scene: 'return_to_sleep',
    composition: 'low_fan + soft_return_to_sleep_drone',
    review_focus: 'Does this reduce attention after waking, or does the fan texture feel mechanical?',
  },
  {
    listen_order: '04',
    candidate_id: 'quiet_state_procedural_night_neutral_only',
    title: 'Night Neutral Drone Only',
    local_path: '/audio/music/local-review/2026-07-13/procedural_night_neutral_drone.mp3',
    duration_seconds: '60',
    scene: 'sleep_onset,meditative_breathing',
    composition: 'low_neutral_drone',
    review_focus: 'Does the pure drone feel peaceful and grounding, or ominous/too physical?',
  },
  {
    listen_order: '05',
    candidate_id: 'quiet_state_procedural_deep_sleep_only',
    title: 'Deep Sleep Low Only',
    local_path: '/audio/music/local-review/2026-07-13/procedural_deep_sleep_low.mp3',
    duration_seconds: '60',
    scene: 'sleep_onset,return_to_sleep',
    composition: 'deep_low_drone',
    review_focus: 'Does the low bed create quietness without pressure, rumble, or unease?',
  },
  {
    listen_order: '06',
    candidate_id: 'quiet_state_return_to_sleep_soft_only',
    title: 'Return to Sleep Soft Only',
    local_path: '/audio/music/local-review/2026-07-13/procedural_return_to_sleep_soft.mp3',
    duration_seconds: '60',
    scene: 'return_to_sleep',
    composition: 'soft_low_attention_drone',
    review_focus: 'Does this feel like the simplest path back to sleep, or is it too empty?',
  },
  {
    listen_order: '07',
    candidate_id: 'quiet_state_quiet_room_only',
    title: 'Quiet Room Only',
    local_path: '/audio/noise/internal/quiet_room.mp3',
    duration_seconds: '60',
    scene: 'sleep_onset,focus,meditative_breathing',
    composition: 'quiet_room_tone',
    review_focus: 'Does this feel like quiet presence, or is it too close to silence / not enough?',
  },
  {
    listen_order: '08',
    candidate_id: 'quiet_state_brown_soft_only',
    title: 'Soft Brown Noise Only',
    local_path: '/audio/noise/internal/brown_soft.mp3',
    duration_seconds: '60',
    scene: 'sleep_onset,return_to_sleep,focus',
    composition: 'soft_brown_noise',
    review_focus: 'Does this mask thought/noise gently, or is it still noise?',
  },
];

const queueHeaders = ['listen_order', 'candidate_id', 'title', 'local_path', 'duration_seconds', 'scene', 'composition', 'listening_status', 'review_focus', 'listening_notes'];
const queueRows = rows.map((row) => ({ ...row, listening_status: 'pending', listening_notes: '' }));
await writeFile(QUIET_QUEUE, `${toTsv(queueRows, queueHeaders)}\n`, 'utf8');

const cards = queueRows.map((row) => `
  <article class="candidate" data-status="pending" data-id="${escapeHtml(row.candidate_id)}">
    <header>
      <div>
        <span class="order">${escapeHtml(row.listen_order)}</span>
        <h2>${escapeHtml(row.title)}</h2>
        <p>${escapeHtml(row.candidate_id)} · ${escapeHtml(row.scene)} · ${escapeHtml(row.duration_seconds)}s</p>
      </div>
      <span class="status-pill">pending</span>
    </header>
    <audio controls preload="metadata" src="${escapeHtml(assetUrl(row.local_path))}"></audio>
    <dl class="metadata">
      <div><dt>Composition</dt><dd>${escapeHtml(row.composition)}</dd></div>
      <div><dt>Goal</dt><dd>fast quiet state</dd></div>
    </dl>
    <div class="focus">${escapeHtml(row.review_focus)}</div>
    <div class="controls" role="group" aria-label="Review status">
      <button type="button" data-set-status="approve_quiet_state">Approve Quiet</button>
      <button type="button" data-set-status="too_noisy">Too Noisy</button>
      <button type="button" data-set-status="too_weird">Too Weird</button>
      <button type="button" data-set-status="needs_mix_edit">Needs Mix Edit</button>
      <button type="button" data-set-status="pending">Clear</button>
    </div>
    <label>
      Listening notes
      <textarea placeholder="Example: quiet within 10 seconds; low rumble too strong; feels empty but acceptable"></textarea>
    </label>
  </article>
`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quiet State Listening QA</title>
  <style>
    :root { color-scheme: light; --ink:#17201b; --muted:#5d6a62; --line:#d7ddd8; --surface:#f5f6f3; --panel:#fff; --accent:#246b5f; --reject:#9b2c2c; --warn:#865b00; --review:#475569; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--surface); color:var(--ink); }
    .shell { width:min(1080px, calc(100% - 32px)); margin:0 auto; padding:20px 0 48px; }
    .topbar { position:sticky; top:0; z-index:10; background:rgba(245,246,243,.96); border-bottom:1px solid var(--line); backdrop-filter:blur(10px); }
    .topbar-inner { width:min(1080px, calc(100% - 32px)); margin:0 auto; padding:14px 0; display:grid; grid-template-columns:1fr auto; gap:16px; align-items:center; }
    h1 { margin:0; font-size:20px; font-weight:760; letter-spacing:0; }
    .summary { color:var(--muted); font-size:13px; margin-top:4px; line-height:1.45; }
    button, select { border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:6px; min-height:36px; padding:0 12px; font:inherit; cursor:pointer; }
    button:hover, select:hover { border-color:var(--accent); }
    .grid { display:grid; gap:12px; }
    .candidate { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
    .candidate header { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:start; }
    .order { display:inline-grid; place-items:center; width:34px; height:28px; margin-right:8px; border:1px solid var(--line); border-radius:6px; color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
    h2 { display:inline; margin:0; font-size:16px; font-weight:720; letter-spacing:0; }
    p { margin:6px 0 0 44px; color:var(--muted); font-size:13px; }
    audio { width:100%; margin:14px 0 10px; }
    .metadata { display:grid; grid-template-columns:2fr 1fr; gap:8px; margin:0 0 10px; }
    .metadata div { border:1px solid var(--line); border-radius:6px; padding:8px 10px; min-width:0; }
    dt { color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:3px 0 0; font-size:13px; overflow-wrap:anywhere; }
    .focus { border-left:3px solid var(--accent); background:#edf3ef; color:#27342f; padding:8px 10px; font-size:13px; line-height:1.45; }
    .controls { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
    label { display:grid; gap:6px; color:var(--muted); font-size:13px; }
    textarea { width:100%; min-height:72px; resize:vertical; border:1px solid var(--line); border-radius:6px; padding:10px; font:inherit; color:var(--ink); background:#fff; }
    .status-pill { min-width:112px; text-align:center; border-radius:999px; padding:5px 10px; border:1px solid var(--line); color:var(--muted); font-size:12px; font-weight:680; overflow-wrap:anywhere; }
    .candidate[data-status="approve_quiet_state"] .status-pill { color:var(--accent); border-color:var(--accent); }
    .candidate[data-status="too_noisy"] .status-pill,
    .candidate[data-status="too_weird"] .status-pill { color:var(--reject); border-color:var(--reject); }
    .candidate[data-status="needs_mix_edit"] .status-pill { color:var(--warn); border-color:var(--warn); }
    .candidate[data-status="approve_quiet_state"] button[data-set-status="approve_quiet_state"],
    .candidate[data-status="too_noisy"] button[data-set-status="too_noisy"],
    .candidate[data-status="too_weird"] button[data-set-status="too_weird"],
    .candidate[data-status="needs_mix_edit"] button[data-set-status="needs_mix_edit"] { color:#fff; background:var(--accent); border-color:var(--accent); }
    .candidate[data-status="too_noisy"] button[data-set-status="too_noisy"],
    .candidate[data-status="too_weird"] button[data-set-status="too_weird"] { background:var(--reject); border-color:var(--reject); }
    .candidate[data-status="needs_mix_edit"] button[data-set-status="needs_mix_edit"] { background:var(--warn); border-color:var(--warn); }
    .export { background:var(--accent); border-color:var(--accent); color:#fff; }
    @media (max-width:720px) { .topbar-inner,.candidate header,.metadata{grid-template-columns:1fr;} p{margin-left:0;} }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div>
        <h1>Quiet State Listening QA</h1>
        <div class="summary">${rows.length} candidates · approve only if it helps you become quiet quickly · reject anything that sounds like noise, scenery, music, or a weird recording</div>
      </div>
      <button class="export" type="button" id="exportButton">Export TSV</button>
    </div>
  </div>
  <main class="shell"><div class="grid">${cards}</div></main>
  <script>
    const storageKey = 'snooze.quietStateListeningQa.v1';
    const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const candidates = [...document.querySelectorAll('.candidate')];
    const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
    const setCardStatus = (card, status) => {
      card.dataset.status = status;
      card.querySelector('.status-pill').textContent = status;
      const id = card.dataset.id;
      state[id] = state[id] || {};
      state[id].status = status;
      save();
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
  </script>
</body>
</html>`;

await mkdir(dirname(OUTPUT_HTML), { recursive: true });
await writeFile(OUTPUT_HTML, html, 'utf8');
await writeFile(REPORT_MD, [
  '# Quiet State Listening QA Queue',
  '',
  'Date: 2026-07-13',
  'Status: internal quiet-state QA only; no new item is seeded or routable by this page.',
  '',
  `External product-fit candidates rejected: ${rejectRows.length}`,
  `Quiet-state candidates: ${rows.length}`,
  '',
  '## Intent',
  '',
  'The target is fast entry into a quiet state, not nature realism, ASMR novelty, or generic ambience.',
  '',
  `Rejected external decisions: ${REJECT_TSV}`,
  `Queue: ${QUIET_QUEUE}`,
  `Page: ${OUTPUT_HTML}`,
  '',
].join('\n'), 'utf8');

console.log(`wrote ${REJECT_TSV}`);
console.log(`wrote ${QUIET_QUEUE}`);
console.log(`wrote ${OUTPUT_HTML}`);
console.log(`wrote ${REPORT_MD}`);
