#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const INPUT_TSV = 'docs/asset-batch-06-asmr-download-candidates.tsv';
const QUEUE_TSV = 'docs/asmr-batch-06-listening-qa-queue.tsv';
const REPORT_MD = 'reports/asmr-batch-06-listening-qa-queue-2026-07-13.md';
const OUTPUT_HTML = 'public/review/asmr-batch-06-listening-qa.html';

const parseTsv = (content) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows
    .filter(Boolean)
    .map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
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

const riskFromPeak = (row) => {
  const peak = Number(row.max_volume_db);
  if (!Number.isFinite(peak)) return 'unknown';
  if (peak >= -0.5) return 'high';
  if (peak >= -4) return 'medium';
  return 'low';
};

const loudnessNote = (row) => {
  const mean = Number(row.mean_volume_db);
  const peak = Number(row.max_volume_db);
  const notes = [];
  if (Number.isFinite(peak) && peak >= -0.5) notes.push('peak is near 0 dB; check for harsh clicks or startle');
  if (Number.isFinite(peak) && peak >= -4 && peak < -0.5) notes.push('moderate peak; check transient comfort');
  if (Number.isFinite(mean) && mean <= -45) notes.push('very quiet average; check whether it is usable without over-gain');
  if (Number(row.duration_seconds) <= 3) notes.push('very short loop; check repetition fatigue');
  return notes.join('; ') || 'check loop comfort, texture stability, and whether the sound fits ASMR use';
};

const requiredDecision = (row) => {
  if (row.license_url?.includes('/by/4.0')) return 'qa_only_attribution_required';
  return 'qa_only';
};

const reviewFocus = (row) => [
  'Reject sudden loud or random speech, background conversation, classroom/people noise, sexualized/roleplay content, medical claims, distress, or confusing voice.',
  row.voice_presence === 'none'
    ? 'This candidate is labeled no-voice ASMR; confirm there is no audible speech, whisper, breath, laughter, or background human sound.'
    : 'Voice-like content is acceptable only if intentional, gentle, regular, non-startling, and understandable enough for safety review.',
  loudnessNote(row),
  row.license_url?.includes('/by/4.0')
    ? 'CC-BY 4.0: do not promote until attribution is supported end to end.'
    : 'CC0: still requires source snapshot, technical QA, and listening approval before promotion.',
].join(' ');

const main = async () => {
  const inputRows = parseTsv(await readFile(INPUT_TSV, 'utf8'));
  const queueRows = inputRows.map((row, index) => ({
    listen_order: String(index + 1).padStart(2, '0'),
    candidate_id: row.candidate_id,
    source_platform: row.source_platform,
    source_title: row.source_title,
    source_url: row.source_url,
    license_name: row.license_name,
    license_url: row.license_url,
    content_type: row.content_type,
    voice_presence: row.voice_presence,
    voice_language: row.voice_presence === 'none' ? 'nonverbal' : 'review_needed',
    recommended_scene: row.recommended_scene,
    local_path: row.local_path,
    duration_seconds: row.duration_seconds,
    mean_volume_db: row.mean_volume_db,
    max_volume_db: row.max_volume_db,
    startle_risk: riskFromPeak(row),
    sudden_speech_risk: row.voice_presence === 'none' ? 'low' : 'review',
    medical_claim_risk: 'none',
    sexualized_risk: 'none',
    license_gate: row.license_url?.includes('/by/4.0') ? 'attribution_required_before_promotion' : 'cc0_candidate',
    listening_status: 'pending',
    promotion_status: requiredDecision(row),
    review_focus: reviewFocus(row),
    listening_notes: '',
  }));

  const queueHeaders = [
    'listen_order', 'candidate_id', 'source_platform', 'source_title', 'source_url',
    'license_name', 'license_url', 'content_type', 'voice_presence', 'voice_language',
    'recommended_scene', 'local_path', 'duration_seconds', 'mean_volume_db', 'max_volume_db',
    'startle_risk', 'sudden_speech_risk', 'medical_claim_risk', 'sexualized_risk',
    'license_gate', 'listening_status', 'promotion_status', 'review_focus', 'listening_notes',
  ];

  await mkdir(dirname(QUEUE_TSV), { recursive: true });
  await mkdir(dirname(REPORT_MD), { recursive: true });
  await mkdir(dirname(OUTPUT_HTML), { recursive: true });
  await writeFile(QUEUE_TSV, `${toTsv(queueRows, queueHeaders)}\n`, 'utf8');

  const cards = queueRows.map((row) => `
    <article class="candidate" data-content-type="${escapeHtml(row.content_type)}" data-license-gate="${escapeHtml(row.license_gate)}" data-startle-risk="${escapeHtml(row.startle_risk)}" data-status="pending" data-id="${escapeHtml(row.candidate_id)}">
      <header>
        <div>
          <span class="order">${escapeHtml(row.listen_order)}</span>
          <h2>${escapeHtml(row.source_title)}</h2>
          <p>${escapeHtml(row.candidate_id)} · ${escapeHtml(row.content_type)} · ${escapeHtml(row.duration_seconds)}s · mean ${escapeHtml(row.mean_volume_db)} dB · peak ${escapeHtml(row.max_volume_db)} dB</p>
        </div>
        <span class="status-pill">pending</span>
      </header>
      <audio controls preload="metadata" src="${escapeHtml(assetUrl(row.local_path))}"></audio>
      <dl class="metadata">
        <div><dt>License</dt><dd>${escapeHtml(row.license_name)} · ${escapeHtml(row.license_gate)}</dd></div>
        <div><dt>Voice</dt><dd>${escapeHtml(row.voice_presence)} · sudden speech risk ${escapeHtml(row.sudden_speech_risk)}</dd></div>
        <div><dt>Startle</dt><dd>${escapeHtml(row.startle_risk)}</dd></div>
        <div><dt>Scene</dt><dd>${escapeHtml(row.recommended_scene)}</dd></div>
      </dl>
      <div class="focus">${escapeHtml(row.review_focus)}</div>
      <div class="controls" role="group" aria-label="Review status">
        <button type="button" data-set-status="approved_asmr">Approve ASMR</button>
        <button type="button" data-set-status="needs_edit">Needs Edit</button>
        <button type="button" data-set-status="script_review">Script Review</button>
        <button type="button" data-set-status="rejected">Reject</button>
        <button type="button" data-set-status="pending">Clear</button>
      </div>
      <label>
        Listening notes
        <textarea placeholder="Example: no random speech; click is sharp at 0:02; OK only at low volume; CC-BY attribution needed"></textarea>
      </label>
    </article>
  `).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ASMR Batch 06 Listening QA</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17201b;
      --muted: #5d6a62;
      --line: #d7ddd8;
      --surface: #f5f6f3;
      --panel: #ffffff;
      --accent: #246b5f;
      --reject: #9b2c2c;
      --warn: #865b00;
      --review: #475569;
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
      padding: 20px 0 48px;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(245, 246, 243, 0.96);
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
      line-height: 1.45;
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
    .metadata {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin: 0 0 10px;
    }
    .metadata div {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 10px;
      min-width: 0;
    }
    dt {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    dd {
      margin: 3px 0 0;
      font-size: 13px;
      overflow-wrap: anywhere;
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
      min-width: 104px;
      text-align: center;
      border-radius: 999px;
      padding: 5px 10px;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      font-weight: 680;
      overflow-wrap: anywhere;
    }
    .candidate[data-status="approved_asmr"] .status-pill { color: var(--accent); border-color: var(--accent); }
    .candidate[data-status="rejected"] .status-pill { color: var(--reject); border-color: var(--reject); }
    .candidate[data-status="needs_edit"] .status-pill { color: var(--warn); border-color: var(--warn); }
    .candidate[data-status="script_review"] .status-pill { color: var(--review); border-color: var(--review); }
    .candidate[data-status="approved_asmr"] button[data-set-status="approved_asmr"],
    .candidate[data-status="needs_edit"] button[data-set-status="needs_edit"],
    .candidate[data-status="script_review"] button[data-set-status="script_review"],
    .candidate[data-status="rejected"] button[data-set-status="rejected"] {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
    }
    .candidate[data-status="needs_edit"] button[data-set-status="needs_edit"] {
      background: var(--warn);
      border-color: var(--warn);
    }
    .candidate[data-status="script_review"] button[data-set-status="script_review"] {
      background: var(--review);
      border-color: var(--review);
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
    @media (max-width: 860px) {
      .topbar-inner { grid-template-columns: 1fr; }
      .filters { justify-content: flex-start; }
      .metadata { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .candidate header { grid-template-columns: 1fr; }
      p { margin-left: 0; }
      .metadata { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div>
        <h1>ASMR Batch 06 Listening QA</h1>
        <div class="summary">${queueRows.length} candidates · ASMR can include gentle regular voice, but reject sudden/random speech, background people, harsh peaks, sexualized roleplay, and medical claims · local notes stay in this browser</div>
      </div>
      <div class="filters">
        <select id="typeFilter" aria-label="Content type filter">
          <option value="all">All types</option>
          <option value="asmr_foley">ASMR foley</option>
          <option value="asmr_environmental">ASMR environmental</option>
        </select>
        <select id="licenseFilter" aria-label="License gate filter">
          <option value="all">All licenses</option>
          <option value="cc0_candidate">CC0 candidates</option>
          <option value="attribution_required_before_promotion">Attribution required</option>
        </select>
        <select id="statusFilter" aria-label="Status filter">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved_asmr">Approved ASMR</option>
          <option value="needs_edit">Needs Edit</option>
          <option value="script_review">Script Review</option>
          <option value="rejected">Rejected</option>
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
    const storageKey = 'snooze.asmrBatch06ListeningQa.v1';
    const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const candidates = [...document.querySelectorAll('.candidate')];
    const typeFilter = document.getElementById('typeFilter');
    const licenseFilter = document.getElementById('licenseFilter');
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
      const type = typeFilter.value;
      const license = licenseFilter.value;
      const status = statusFilter.value;
      candidates.forEach((card) => {
        const typeMatch = type === 'all' || card.dataset.contentType === type;
        const licenseMatch = license === 'all' || card.dataset.licenseGate === license;
        const statusMatch = status === 'all' || card.dataset.status === status;
        card.hidden = !(typeMatch && licenseMatch && statusMatch);
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
    typeFilter.addEventListener('change', applyFilters);
    licenseFilter.addEventListener('change', applyFilters);
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

  const ccByCount = queueRows.filter((row) => row.license_gate === 'attribution_required_before_promotion').length;
  const highStartleCount = queueRows.filter((row) => row.startle_risk === 'high').length;
  const report = [
    '# ASMR Batch 06 Listening QA Queue',
    '',
    'Date: 2026-07-13',
    'Status: candidate listening queue only; no ASMR item is seeded or routable.',
    '',
    `Candidates: ${queueRows.length}`,
    `CC-BY attribution required before promotion: ${ccByCount}`,
    `High startle-risk candidates: ${highStartleCount}`,
    '',
    '| Candidate | Type | License gate | Duration | Mean dB | Max dB | Review focus |',
    '|---|---|---|---:|---:|---:|---|',
    ...queueRows.map((row) => `| ${row.candidate_id} ${row.source_title} | ${row.content_type} | ${row.license_gate} | ${row.duration_seconds}s | ${row.mean_volume_db} | ${row.max_volume_db} | ${row.review_focus.replaceAll('|', '/')} |`),
    '',
    '## Listening Rule',
    '',
    'Approve only if the asset has no sudden or random speech, no background conversation, no harsh/startling peaks at intended listening volume, no sexualized roleplay, no medical claims, and no confusing human content.',
    '',
    'Voice or breathing can be accepted only when it is intentional, gentle, regular, non-startling, and tagged as ASMR/Voice rather than Nature or Noise.',
    '',
    '## Generated Files',
    '',
    `- ${QUEUE_TSV}`,
    `- ${OUTPUT_HTML}`,
    '',
  ].join('\n');
  await writeFile(REPORT_MD, report, 'utf8');

  console.log(`wrote ${QUEUE_TSV}`);
  console.log(`wrote ${OUTPUT_HTML}`);
  console.log(`wrote ${REPORT_MD}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
