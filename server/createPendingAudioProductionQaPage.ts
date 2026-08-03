import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

type PendingStem = {
  id: string;
  name: string;
  category: 'Music' | 'Nature';
  audio_url: string;
  tags: string[];
  qa_notes: string;
  license_name: string | null;
  source_platform: string | null;
  source_creator: string | null;
  attribution_required: boolean;
  duration_seconds: number | null;
  integrated_lufs: number | null;
  true_peak_db: number | null;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const reportsDir = path.join(root, 'reports');
const reviewDir = path.join(root, 'public/review');

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatNumber = (value: number | null, digits = 1) => value === null ? 'n/a' : Number(value).toFixed(digits);

const reviewFocus = (row: PendingStem) => {
  const focus: string[] = [];
  if (row.category === 'Music') {
    focus.push('Confirm this is calm, sleep, focus, or meditation music rather than dramatic, eerie, busy, or emotionally pushy audio.');
    focus.push('Check melody density, loop fatigue, sudden transitions, and whether it can sit under optional guided voice.');
    if (row.attribution_required) focus.push('CC-BY attribution must remain visible in published works and share pages before approval.');
    if (/Content ID|platform claim/i.test(row.qa_notes)) focus.push('Confirm platform claim / Content ID risk before approval.');
  } else {
    focus.push('Confirm no speech, singing, crowd, conversation, children, applause, or background human voice.');
    focus.push('Check loop comfort, peak safety, thunder/startle risk, and whether this actually helps sleep/calm/focus.');
    focus.push('Reject if the sound feels too sharp, wet, busy, dramatic, or attention-grabbing for quiet-state use.');
  }
  return focus.join(' ');
};

const statusOptions = ['pending', 'approve_candidate', 'needs_fix', 'reject'] as const;

const run = async () => {
  const result = await query<PendingStem>(
    `select s.id, s.name, s.category, s.audio_url, s.tags, s.qa_notes,
            s.license_name, s.source_platform, s.source_creator, s.attribution_required,
            f.duration_seconds, f.integrated_lufs, f.true_peak_db
       from audio_stems s
       left join stem_acoustic_features f on f.stem_id = s.id
      where s.qa_status = 'needs_review'
        and s.category in ('Music', 'Nature')
      order by case when s.category = 'Music' then 0 else 1 end, s.name`,
  );
  const rows = result.rows;

  await mkdir(docsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await mkdir(reviewDir, { recursive: true });

  const queueHeaders = [
    'listen_order',
    'stem_id',
    'category',
    'name',
    'audio_url',
    'duration_seconds',
    'integrated_lufs',
    'true_peak_db',
    'license_name',
    'attribution_required',
    'qa_status',
    'review_focus',
    'review_decision',
    'review_notes',
  ];
  const queueRows = rows.map((row, index) => [
    String(index + 1).padStart(2, '0'),
    row.id,
    row.category,
    row.name,
    row.audio_url,
    formatNumber(row.duration_seconds, 3),
    formatNumber(row.integrated_lufs, 2),
    formatNumber(row.true_peak_db, 2),
    row.license_name ?? '',
    String(row.attribution_required),
    'needs_review',
    reviewFocus(row),
    'pending',
    '',
  ]);

  await writeFile(
    path.join(docsDir, 'pending-audio-production-qa-queue.tsv'),
    `${[queueHeaders, ...queueRows].map((row) => row.map((cell) => String(cell).replaceAll('\t', ' ').replaceAll('\n', ' ')).join('\t')).join('\n')}\n`,
    'utf8',
  );

  const cards = rows.map((row, index) => {
    const technical = [
      `${formatNumber(row.duration_seconds)}s`,
      `${formatNumber(row.integrated_lufs, 2)} LUFS`,
      `${formatNumber(row.true_peak_db, 2)} dBTP`,
    ].join(' · ');
    const source = [row.source_creator, row.source_platform, row.license_name].filter(Boolean).join(' · ');
    return `
      <article class="candidate" data-id="${escapeHtml(row.id)}" data-category="${escapeHtml(row.category)}" data-status="pending">
        <header>
          <div>
            <p class="eyebrow">${String(index + 1).padStart(2, '0')} · ${escapeHtml(row.category)} · ${escapeHtml(technical)}</p>
            <h2>${escapeHtml(row.name)}</h2>
            <p class="source">${escapeHtml(source || 'Source metadata pending')}</p>
          </div>
          <span class="status-pill">pending</span>
        </header>
        <audio controls preload="metadata" src="${escapeHtml(row.audio_url)}"></audio>
        <div class="tags">${row.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        <p class="focus">${escapeHtml(reviewFocus(row))}</p>
        <details>
          <summary>QA notes</summary>
          <p>${escapeHtml(row.qa_notes)}</p>
        </details>
        <div class="actions">
          ${statusOptions.map((status) => `<button type="button" data-set-status="${status}">${escapeHtml(status.replaceAll('_', ' '))}</button>`).join('')}
        </div>
        <textarea placeholder="Notes: scene fit, loop, fatigue, peak/startle, rights, attribution, Content ID..."></textarea>
      </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pending Audio Production QA</title>
  <style>
    :root { color-scheme: dark; --bg:#101413; --panel:#181d1b; --text:#eef4f0; --muted:#a8b5af; --line:#2a332f; --accent:#8ee6b3; --warn:#ffd37a; --bad:#ff9a9a; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width:1120px; margin:0 auto; padding:28px 18px 56px; }
    .topbar { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:28px; line-height:1.15; letter-spacing:0; }
    p { line-height:1.55; }
    .summary { margin:0; color:var(--muted); font-size:14px; max-width:760px; }
    .toolbar { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    button, select { border:1px solid var(--line); background:#202723; color:var(--text); border-radius:6px; padding:9px 11px; font:inherit; cursor:pointer; }
    button:hover { border-color:var(--accent); }
    .grid { display:grid; gap:14px; }
    .candidate { border:1px solid var(--line); background:var(--panel); border-radius:8px; padding:16px; }
    .candidate header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:12px; }
    .eyebrow, .source { margin:0; color:var(--muted); font-size:13px; }
    h2 { margin:4px 0; font-size:18px; letter-spacing:0; }
    audio { width:100%; margin:10px 0 12px; }
    .tags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
    .tags span { border:1px solid var(--line); color:var(--muted); border-radius:999px; padding:3px 8px; font-size:12px; }
    .focus { margin:8px 0; color:#dce7e1; }
    details { color:var(--muted); margin:10px 0; }
    summary { cursor:pointer; }
    .status-pill { border:1px solid var(--line); color:var(--muted); border-radius:999px; padding:5px 10px; white-space:nowrap; font-size:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
    textarea { width:100%; min-height:74px; resize:vertical; border-radius:6px; border:1px solid var(--line); background:#111614; color:var(--text); padding:10px; font:inherit; }
    .candidate[data-status="approve_candidate"] .status-pill { color:var(--accent); border-color:var(--accent); }
    .candidate[data-status="needs_fix"] .status-pill { color:var(--warn); border-color:var(--warn); }
    .candidate[data-status="reject"] .status-pill { color:var(--bad); border-color:var(--bad); }
    .candidate[data-status="approve_candidate"] button[data-set-status="approve_candidate"],
    .candidate[data-status="needs_fix"] button[data-set-status="needs_fix"],
    .candidate[data-status="reject"] button[data-set-status="reject"],
    .candidate[data-status="pending"] button[data-set-status="pending"] { border-color:currentColor; }
    @media (max-width:760px) { .topbar, .candidate header { display:block; } .toolbar { justify-content:flex-start; margin-top:14px; } }
  </style>
</head>
<body>
  <main>
    <section class="topbar">
      <div>
        <h1>Pending Audio Production QA</h1>
        <p class="summary">${rows.length} pending Music/Nature assets. Approve only after listening, technical comfort, rights, and product fit are all acceptable.</p>
      </div>
      <div class="toolbar">
        <select id="filter">
          <option value="all">All</option>
          <option value="Music">Music</option>
          <option value="Nature">Nature</option>
          <option value="pending">Pending</option>
          <option value="approve_candidate">Approve candidate</option>
          <option value="needs_fix">Needs fix</option>
          <option value="reject">Reject</option>
        </select>
        <button type="button" id="export">Export TSV</button>
        <button type="button" id="reset">Reset local decisions</button>
      </div>
    </section>
    <section class="grid">${cards}</section>
  </main>
  <script>
    const storageKey = 'pending-audio-production-qa-v1';
    const cards = [...document.querySelectorAll('.candidate')];
    const load = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
    const save = (state) => localStorage.setItem(storageKey, JSON.stringify(state));
    const apply = () => {
      const state = load();
      for (const card of cards) {
        const saved = state[card.dataset.id] || {};
        const status = saved.status || 'pending';
        card.dataset.status = status;
        card.querySelector('.status-pill').textContent = status.replaceAll('_', ' ');
        card.querySelector('textarea').value = saved.notes || '';
      }
      filterCards();
    };
    const update = (card, patch) => {
      const state = load();
      state[card.dataset.id] = { ...(state[card.dataset.id] || {}), ...patch };
      save(state);
      apply();
    };
    const filterCards = () => {
      const value = document.querySelector('#filter').value;
      for (const card of cards) {
        const show = value === 'all' || card.dataset.category === value || card.dataset.status === value;
        card.style.display = show ? '' : 'none';
      }
    };
    for (const card of cards) {
      card.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-set-status]');
        if (!button) return;
        update(card, { status: button.dataset.setStatus });
      });
      card.querySelector('textarea').addEventListener('input', (event) => update(card, { notes: event.target.value }));
    }
    document.querySelector('#filter').addEventListener('change', filterCards);
    document.querySelector('#reset').addEventListener('click', () => {
      if (!confirm('Reset local QA decisions?')) return;
      localStorage.removeItem(storageKey);
      apply();
    });
    document.querySelector('#export').addEventListener('click', () => {
      const state = load();
      const header = ['stem_id', 'category', 'review_decision', 'review_notes'];
      const rows = cards.map((card) => {
        const saved = state[card.dataset.id] || {};
        return [card.dataset.id, card.dataset.category, saved.status || 'pending', saved.notes || ''];
      });
      const tsv = [header, ...rows].map((row) => row.map((cell) => String(cell).replaceAll('\\t', ' ').replaceAll('\\n', ' ')).join('\\t')).join('\\n');
      const blob = new Blob([tsv + '\\n'], { type: 'text/tab-separated-values' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pending-audio-production-qa-decisions.tsv';
      link.click();
      URL.revokeObjectURL(url);
    });
    apply();
  </script>
</body>
</html>`;

  await writeFile(path.join(reviewDir, 'pending-audio-production-qa.html'), html, 'utf8');

  const report = [
    '# Pending Audio Production QA Queue',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total pending Music/Nature assets: ${rows.length}`,
    `Music: ${rows.filter((row) => row.category === 'Music').length}`,
    `Nature: ${rows.filter((row) => row.category === 'Nature').length}`,
    '',
    'Review page: http://localhost:5173/review/pending-audio-production-qa.html',
    '',
    'Promotion remains blocked until an exported decision TSV is reviewed and converted into explicit promotion records.',
  ].join('\n');
  await writeFile(path.join(reportsDir, 'pending-audio-production-qa-queue-2026-07-13.md'), `${report}\n`, 'utf8');

  console.log(JSON.stringify({
    total: rows.length,
    music: rows.filter((row) => row.category === 'Music').length,
    nature: rows.filter((row) => row.category === 'Nature').length,
    queue: 'docs/pending-audio-production-qa-queue.tsv',
    page: 'public/review/pending-audio-production-qa.html',
    report: 'reports/pending-audio-production-qa-queue-2026-07-13.md',
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
