#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const INPUT_TSV = 'docs/no-human-audio-listening-qa-queue.tsv';
const OUTPUT_HTML = 'public/review/no-human-audio-listening-qa.html';

const parseTsv = (content) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const assetUrl = (localPath) => `/${localPath.replace(/^public\//, '')}`;

const main = async () => {
  const rows = parseTsv(await readFile(INPUT_TSV, 'utf8'));
  await mkdir(dirname(OUTPUT_HTML), { recursive: true });

  const cards = rows.map((row) => `
    <article class="candidate" data-category="${escapeHtml(row.category)}" data-status="pending" data-id="${escapeHtml(row.candidate_id)}">
      <header>
        <div>
          <span class="order">${escapeHtml(row.listen_order)}</span>
          <h2>${escapeHtml(row.source_title)}</h2>
          <p>${escapeHtml(row.candidate_id)} · ${escapeHtml(row.category)} / ${escapeHtml(row.scene_family)} · ${escapeHtml(row.duration_seconds)}s · ${escapeHtml(row.machine_status)}</p>
        </div>
        <span class="status-pill">pending</span>
      </header>
      <audio controls preload="metadata" src="${escapeHtml(assetUrl(row.local_path))}"></audio>
      <div class="focus">${escapeHtml(row.review_focus)}</div>
      <div class="controls" role="group" aria-label="Review status">
        <button type="button" data-set-status="approved">No Voice</button>
        <button type="button" data-set-status="rejected">Reject</button>
        <button type="button" data-set-status="needs_edit">Needs Edit</button>
        <button type="button" data-set-status="pending">Clear</button>
      </div>
      <label>
        Listening notes
        <textarea placeholder="Example: no human voice; soft loop; peak is sharp near 0:12"></textarea>
      </label>
    </article>
  `).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>No-Human Audio Listening QA</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17201b;
      --muted: #5d6a62;
      --line: #d8ded8;
      --surface: #f6f7f4;
      --panel: #ffffff;
      --accent: #256f68;
      --reject: #9b2c2c;
      --warn: #8a5a00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--surface);
      color: var(--ink);
    }
    .shell {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 24px 0 48px;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(246, 247, 244, 0.96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(10px);
    }
    .topbar-inner {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 14px 0;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 760;
      letter-spacing: 0;
    }
    .summary {
      color: var(--muted);
      font-size: 13px;
      margin-top: 4px;
    }
    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    button, select {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      border-radius: 6px;
      min-height: 36px;
      padding: 0 12px;
      font: inherit;
      cursor: pointer;
    }
    button:hover, select:hover { border-color: var(--accent); }
    .grid {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }
    .candidate {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    .candidate header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: start;
    }
    .order {
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 28px;
      margin-right: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--muted);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    h2 {
      display: inline;
      margin: 0;
      font-size: 16px;
      font-weight: 720;
      letter-spacing: 0;
    }
    p {
      margin: 6px 0 0 44px;
      color: var(--muted);
      font-size: 13px;
    }
    audio {
      width: 100%;
      margin: 14px 0 10px;
    }
    .focus {
      border-left: 3px solid var(--accent);
      padding: 8px 10px;
      background: #edf3ef;
      color: #27342f;
      font-size: 13px;
      line-height: 1.45;
    }
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 12px 0;
    }
    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    textarea {
      width: 100%;
      min-height: 72px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      font: inherit;
      color: var(--ink);
      background: #fff;
    }
    .status-pill {
      min-width: 86px;
      text-align: center;
      border-radius: 999px;
      padding: 5px 10px;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      font-weight: 680;
    }
    .candidate[data-status="approved"] .status-pill { color: var(--accent); border-color: var(--accent); }
    .candidate[data-status="rejected"] .status-pill { color: var(--reject); border-color: var(--reject); }
    .candidate[data-status="needs_edit"] .status-pill { color: var(--warn); border-color: var(--warn); }
    .candidate[data-status="approved"] button[data-set-status="approved"],
    .candidate[data-status="rejected"] button[data-set-status="rejected"],
    .candidate[data-status="needs_edit"] button[data-set-status="needs_edit"] {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
    }
    .candidate[data-status="rejected"] button[data-set-status="rejected"] {
      background: var(--reject);
      border-color: var(--reject);
    }
    .export {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    @media (max-width: 760px) {
      .topbar-inner { grid-template-columns: 1fr; }
      .filters { justify-content: flex-start; }
      .candidate header { grid-template-columns: 1fr; }
      p { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div>
        <h1>No-Human Audio Listening QA</h1>
        <div class="summary">${rows.length} candidates · reject any audible human voice · local notes stay in this browser</div>
      </div>
      <div class="filters">
        <select id="categoryFilter" aria-label="Category filter">
          <option value="all">All categories</option>
          <option value="Nature">Nature</option>
          <option value="Accent">Accent</option>
        </select>
        <select id="statusFilter" aria-label="Status filter">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">No Voice</option>
          <option value="rejected">Rejected</option>
          <option value="needs_edit">Needs Edit</option>
        </select>
        <button class="export" type="button" id="exportButton">Export TSV</button>
      </div>
    </div>
  </div>
  <main class="shell">
    <div class="grid" id="candidateGrid">
      ${cards}
    </div>
  </main>
  <script>
    const storageKey = 'snooze.noHumanAudioListeningQa.v1';
    const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const candidates = [...document.querySelectorAll('.candidate')];
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
    const setCardStatus = (card, status) => {
      card.dataset.status = status;
      card.querySelector('.status-pill').textContent = status;
      const id = card.dataset.id;
      state[id] = state[id] || {};
      state[id].status = status;
      save();
      applyFilters();
    };
    const applyFilters = () => {
      const category = categoryFilter.value;
      const status = statusFilter.value;
      candidates.forEach((card) => {
        const categoryMatch = category === 'all' || card.dataset.category === category;
        const statusMatch = status === 'all' || card.dataset.status === status;
        card.hidden = !(categoryMatch && statusMatch);
      });
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
    categoryFilter.addEventListener('change', applyFilters);
    statusFilter.addEventListener('change', applyFilters);
    document.getElementById('exportButton').addEventListener('click', async () => {
      const rows = [['candidate_id', 'listening_status', 'listening_notes']];
      candidates.forEach((card) => {
        const id = card.dataset.id;
        const saved = state[id] || {};
        rows.push([id, saved.status || 'pending', saved.notes || '']);
      });
      const text = rows.map((row) => row.map((cell) => String(cell).replaceAll('\\t', ' ').replaceAll('\\n', ' ')).join('\\t')).join('\\n');
      await navigator.clipboard.writeText(text);
      alert('TSV copied to clipboard.');
    });
    applyFilters();
  </script>
</body>
</html>`;

  await writeFile(OUTPUT_HTML, html, 'utf8');
  console.log(`wrote ${OUTPUT_HTML}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
