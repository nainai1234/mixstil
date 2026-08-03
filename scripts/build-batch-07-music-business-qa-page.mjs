#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const CLIPS_TSV = 'docs/asset-batch-07-review-clips.tsv';
const CANDIDATES_TSV = 'docs/asset-batch-07-downloaded-music.tsv';
const OUTPUT_QUEUE = 'docs/batch-07-music-business-qa-queue.tsv';
const OUTPUT_HTML = 'public/review/batch-07-music-business-qa.html';
const OUTPUT_REPORT = 'reports/batch-07-music-business-qa-queue-2026-07-13.md';

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

const assetUrl = (localPath) => `/${localPath.replace(/^public\//, '')}`;

const sceneFit = (candidate) => {
  const goals = candidate.target_goals.split(',').map((goal) => goal.trim());
  const items = [];
  if (goals.includes('sleep')) items.push('sleep');
  if (goals.includes('calm')) items.push('meditation/calm');
  if (goals.includes('focus')) items.push('focus');
  return items.join(', ');
};

const reviewPrompt = (candidate) => {
  const prompts = [
    'Does this sound like a real meditation/sleep/focus music bed, not a random sound effect or noisy recording?',
    'Can a user become quieter within the first 10-20 seconds?',
    'Reject if it feels cinematic, dramatic, cheerful, eerie, too melodic, too bright, too busy, or emotionally pushy.',
  ];
  if (candidate.attribution_required === 'true') prompts.push('CC-BY: only promote after attribution is visible in published works and share pages.');
  if (candidate.machine_qa === 'warn') prompts.push(`Technical warning: ${candidate.machine_qa_notes}`);
  return prompts.join(' ');
};

const candidates = parseTsv(await readFile(CANDIDATES_TSV, 'utf8'));
const clips = parseTsv(await readFile(CLIPS_TSV, 'utf8'));
const clipsByCandidate = new Map();
for (const clip of clips) {
  const list = clipsByCandidate.get(clip.candidate_id) ?? [];
  list.push(clip);
  clipsByCandidate.set(clip.candidate_id, list);
}

const queueRows = candidates.map((candidate, index) => ({
  listen_order: String(index + 1).padStart(2, '0'),
  candidate_id: candidate.candidate_id,
  title: candidate.title,
  creator: candidate.creator,
  source_platform: candidate.source_platform,
  license_name: candidate.license_name,
  target_goals: candidate.target_goals,
  scene_fit: sceneFit(candidate),
  duration_seconds: candidate.duration_seconds,
  source_path: candidate.local_path,
  intro_clip: clipsByCandidate.get(candidate.candidate_id)?.find((clip) => clip.clip_label === 'intro')?.clip_path ?? '',
  middle_clip: clipsByCandidate.get(candidate.candidate_id)?.find((clip) => clip.clip_label === 'middle')?.clip_path ?? '',
  outro_clip: clipsByCandidate.get(candidate.candidate_id)?.find((clip) => clip.clip_label === 'outro')?.clip_path ?? '',
  machine_qa: candidate.machine_qa,
  machine_qa_notes: candidate.machine_qa_notes,
  listening_status: 'pending',
  review_focus: reviewPrompt(candidate),
  listening_notes: '',
}));

await mkdir(dirname(OUTPUT_QUEUE), { recursive: true });
await mkdir(dirname(OUTPUT_HTML), { recursive: true });
await mkdir(dirname(OUTPUT_REPORT), { recursive: true });

const headers = [
  'listen_order', 'candidate_id', 'title', 'creator', 'source_platform',
  'license_name', 'target_goals', 'scene_fit', 'duration_seconds', 'source_path',
  'intro_clip', 'middle_clip', 'outro_clip', 'machine_qa', 'machine_qa_notes',
  'listening_status', 'review_focus', 'listening_notes',
];
await writeFile(OUTPUT_QUEUE, `${toTsv(queueRows, headers)}\n`, 'utf8');

const clipPlayer = (label, path) => `
  <div class="clip">
    <span>${escapeHtml(label)}</span>
    <audio controls preload="metadata" src="${escapeHtml(assetUrl(path))}"></audio>
  </div>`;

const cards = queueRows.map((row) => `
  <article class="candidate" data-status="pending" data-id="${escapeHtml(row.candidate_id)}">
    <header>
      <div>
        <span class="order">${escapeHtml(row.listen_order)}</span>
        <h2>${escapeHtml(row.title)}</h2>
        <p>${escapeHtml(row.creator)} · ${escapeHtml(row.source_platform)} · ${escapeHtml(row.scene_fit)} · ${Math.round(Number(row.duration_seconds) / 60)} min</p>
      </div>
      <span class="status-pill">pending</span>
    </header>
    <div class="clips">
      ${clipPlayer('Intro', row.intro_clip)}
      ${clipPlayer('Middle', row.middle_clip)}
      ${clipPlayer('Outro', row.outro_clip)}
    </div>
    <dl class="metadata">
      <div><dt>License</dt><dd>${escapeHtml(row.license_name)}</dd></div>
      <div><dt>Machine QA</dt><dd>${escapeHtml(row.machine_qa)} · ${escapeHtml(row.machine_qa_notes)}</dd></div>
    </dl>
    <div class="focus">${escapeHtml(row.review_focus)}</div>
    <div class="controls" role="group" aria-label="Review status">
      <button type="button" data-set-status="approve_business_fit">Approve Fit</button>
      <button type="button" data-set-status="sleep_only">Sleep Only</button>
      <button type="button" data-set-status="meditation_only">Meditation Only</button>
      <button type="button" data-set-status="focus_only">Focus Only</button>
      <button type="button" data-set-status="reject_business_fit">Reject</button>
      <button type="button" data-set-status="pending">Clear</button>
    </div>
    <label>
      Listening notes
      <textarea placeholder="Example: usable for calm but too melodic for sleep; intro is strong, middle becomes dramatic"></textarea>
    </label>
  </article>
`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Batch 07 Music Business QA</title>
  <style>
    :root { color-scheme: light; --ink:#17201b; --muted:#5d6a62; --line:#d7ddd8; --surface:#f5f6f3; --panel:#fff; --accent:#246b5f; --reject:#9b2c2c; --warn:#865b00; --review:#475569; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--surface); color:var(--ink); }
    .shell { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:20px 0 48px; }
    .topbar { position:sticky; top:0; z-index:10; background:rgba(245,246,243,.96); border-bottom:1px solid var(--line); backdrop-filter:blur(10px); }
    .topbar-inner { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:14px 0; display:grid; grid-template-columns:1fr auto; gap:16px; align-items:center; }
    h1 { margin:0; font-size:20px; font-weight:760; letter-spacing:0; }
    .summary { color:var(--muted); font-size:13px; margin-top:4px; line-height:1.45; }
    button { border:1px solid var(--line); background:var(--panel); color:var(--ink); border-radius:6px; min-height:36px; padding:0 12px; font:inherit; cursor:pointer; }
    button:hover { border-color:var(--accent); }
    .grid { display:grid; gap:12px; }
    .candidate { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
    .candidate header { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:start; }
    .order { display:inline-grid; place-items:center; width:34px; height:28px; margin-right:8px; border:1px solid var(--line); border-radius:6px; color:var(--muted); font-size:13px; font-variant-numeric:tabular-nums; }
    h2 { display:inline; margin:0; font-size:16px; font-weight:720; letter-spacing:0; }
    p { margin:6px 0 0 44px; color:var(--muted); font-size:13px; }
    .clips { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:14px 0 10px; }
    .clip { border:1px solid var(--line); border-radius:6px; padding:8px; min-width:0; }
    .clip span { display:block; color:var(--muted); font-size:12px; font-weight:700; margin-bottom:6px; text-transform:uppercase; letter-spacing:.04em; }
    audio { width:100%; }
    .metadata { display:grid; grid-template-columns:1fr 2fr; gap:8px; margin:0 0 10px; }
    .metadata div { border:1px solid var(--line); border-radius:6px; padding:8px 10px; min-width:0; }
    dt { color:var(--muted); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    dd { margin:3px 0 0; font-size:13px; overflow-wrap:anywhere; }
    .focus { border-left:3px solid var(--accent); background:#edf3ef; color:#27342f; padding:8px 10px; font-size:13px; line-height:1.45; }
    .controls { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
    label { display:grid; gap:6px; color:var(--muted); font-size:13px; }
    textarea { width:100%; min-height:72px; resize:vertical; border:1px solid var(--line); border-radius:6px; padding:10px; font:inherit; color:var(--ink); background:#fff; }
    .status-pill { min-width:112px; text-align:center; border-radius:999px; padding:5px 10px; border:1px solid var(--line); color:var(--muted); font-size:12px; font-weight:680; overflow-wrap:anywhere; }
    .candidate[data-status="approve_business_fit"] .status-pill { color:var(--accent); border-color:var(--accent); }
    .candidate[data-status="reject_business_fit"] .status-pill { color:var(--reject); border-color:var(--reject); }
    .candidate[data-status="sleep_only"] .status-pill,
    .candidate[data-status="meditation_only"] .status-pill,
    .candidate[data-status="focus_only"] .status-pill { color:var(--review); border-color:var(--review); }
    .candidate[data-status="approve_business_fit"] button[data-set-status="approve_business_fit"],
    .candidate[data-status="sleep_only"] button[data-set-status="sleep_only"],
    .candidate[data-status="meditation_only"] button[data-set-status="meditation_only"],
    .candidate[data-status="focus_only"] button[data-set-status="focus_only"],
    .candidate[data-status="reject_business_fit"] button[data-set-status="reject_business_fit"] { color:#fff; background:var(--accent); border-color:var(--accent); }
    .candidate[data-status="reject_business_fit"] button[data-set-status="reject_business_fit"] { background:var(--reject); border-color:var(--reject); }
    .export { background:var(--accent); border-color:var(--accent); color:#fff; }
    @media (max-width:860px) { .topbar-inner,.candidate header,.metadata{grid-template-columns:1fr;} .clips{grid-template-columns:1fr;} p{margin-left:0;} }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div>
        <h1>Batch 07 Music Business QA</h1>
        <div class="summary">${queueRows.length} music candidates · intro/middle/outro clips · judge by sleep, meditation, focus, and quieting value, not by filename or source label</div>
      </div>
      <button class="export" type="button" id="exportButton">Export TSV</button>
    </div>
  </div>
  <main class="shell"><div class="grid">${cards}</div></main>
  <script>
    const storageKey = 'snooze.batch07MusicBusinessQa.v1';
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
      const output = [['candidate_id', 'business_fit_status', 'business_fit_notes']];
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
await writeFile(OUTPUT_REPORT, [
  '# Batch 07 Music Business QA Queue',
  '',
  'Date: 2026-07-13',
  'Status: business-fit listening page only; no item is approved, seeded, or routable.',
  '',
  `Candidates: ${queueRows.length}`,
  'Review unit: intro/middle/outro 30-second clips per candidate.',
  '',
  `Queue: ${OUTPUT_QUEUE}`,
  `Page: ${OUTPUT_HTML}`,
  '',
].join('\n'), 'utf8');

console.log(`wrote ${OUTPUT_QUEUE}`);
console.log(`wrote ${OUTPUT_HTML}`);
console.log(`wrote ${OUTPUT_REPORT}`);
