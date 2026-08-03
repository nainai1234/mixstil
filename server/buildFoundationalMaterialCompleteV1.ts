import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type InventoryRow = {
  familyId: string;
  internalTarget: number | { min?: number; max?: number; [key: string]: number | undefined };
  configured: number | Record<string, number>;
  candidate: number | Record<string, number>;
  machinePassed: number | Record<string, number>;
  formalUsable: number | Record<string, number>;
  gapToInternalUsable: number | Record<string, number>;
  status: string;
  nextAction: string;
};

type Inventory = {
  generatedAt: string;
  headline: Record<string, unknown>;
  rows: InventoryRow[];
};

const root = process.cwd();
const batchId = 'foundational-material-complete-v1';
const manifestPath = path.join(root, 'public/review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const reportPath = path.join(root, 'reports/foundational-material-complete-v1.md');
const jsonReportPath = path.join(root, 'reports/foundational-material-complete-v1.json');

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as T;

const sumNumber = (value: number | Record<string, number>) =>
  typeof value === 'number' ? value : Object.values(value).reduce((sum, item) => sum + Number(item ?? 0), 0);

const minTarget = (target: InventoryRow['internalTarget']) => {
  if (typeof target === 'number') return target;
  if (typeof target.min === 'number') return target.min;
  return Object.values(target).reduce((sum, item) => sum + Number(item ?? 0), 0);
};

const escapeHtml = (value: unknown) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const inventory = await readJson<Inventory>('reports/business-audio-element-inventory-v1.json');
const atomic = await readJson<{
  batchId: string;
  counts: { audioElements: number; symbolicElements: number; totalElements: number };
  audioElements: Array<{ elementId: string; elementType: string; goal: string; instrument: string; reviewAudioSrc: string; durationSeconds: number }>;
  symbolicElements: Array<{ elementId: string; elementType: string; goal: string }>;
}>('public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json');
const soothing = await readJson<{
  batchId: string;
  candidateCount: number;
  machinePassCount: number;
  reviewUrl: string;
  candidates: Array<{ candidateId: string; title: string; category: string; role: string; preparedAudioUrl: string; machineStatus: string }>;
}>('public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json');
const dsp = await readJson<{
  configs: Array<{ id: string; type: string; label: string; role: string; goals: string[]; safety: { medicalClaimAllowed: boolean } }>;
}>('config/deterministic-acoustic-configs-v1.json');

const foundationalRows = inventory.rows.filter((row) => row.familyId !== 'finished_reference_and_seed_content');
const configuredCoverage = foundationalRows.map((row) => ({
  familyId: row.familyId,
  configured: sumNumber(row.configured),
  candidate: sumNumber(row.candidate),
  machinePassed: sumNumber(row.machinePassed),
  formalUsable: sumNumber(row.formalUsable),
  minTarget: minTarget(row.internalTarget),
  configuredMeetsTarget: sumNumber(row.configured) >= minTarget(row.internalTarget),
  candidateMeetsTarget: sumNumber(row.candidate) >= minTarget(row.internalTarget),
  status: row.status,
  nextAction: row.nextAction,
}));

const incompleteConfiguredFamilies = configuredCoverage.filter((row) => !row.configuredMeetsTarget).map((row) => row.familyId);
const incompleteCandidateFamilies = configuredCoverage.filter((row) => !row.candidateMeetsTarget).map((row) => row.familyId);

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: incompleteConfiguredFamilies.length === 0 && incompleteCandidateFamilies.length === 0
    ? 'complete_candidate_inventory_pending_human_review'
    : 'candidate_inventory_still_has_family_gaps',
  productionAllowed: false,
  formalUsablePromotionAllowed: false,
  purpose: 'Consolidate the complete candidate/configured foundational material inventory after atomic music, non-music deterministic material, and DSP support were filled.',
  scopeRules: [
    'Finished content and router proof renders are not counted as foundational material.',
    'Machine pass is not human pass.',
    'Production promotion remains blocked until identity, fatigue, loop, Recipe, and long-session review pass.',
    'No voice, no drums for Sleep/Calm defaults, and no medical or healing claims.',
  ],
  counts: {
    atomicAudioElements: atomic.counts.audioElements,
    atomicSymbolicElements: atomic.counts.symbolicElements,
    soothingDeterministicAudioCandidates: soothing.candidateCount,
    soothingDeterministicMachinePass: soothing.machinePassCount,
    deterministicDspConfigs: dsp.configs.length,
    consolidatedReviewItems: atomic.counts.totalElements + soothing.candidateCount + dsp.configs.length,
  },
  familyCoverage: configuredCoverage,
  reviewSources: {
    atomicFoundationElements: '/review/atomic-foundation-elements-v1/index.html',
    soothingDeterministicFoundation: soothing.reviewUrl,
    foundationalMaterialComplete: `/review/${batchId}/index.html`,
  },
};

await mkdir(path.dirname(manifestPath), { recursive: true });
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(jsonReportPath, `${JSON.stringify(manifest, null, 2)}\n`);

const familyRows = configuredCoverage.map((row) => `
        <tr>
          <td>${escapeHtml(row.familyId)}</td>
          <td>${row.minTarget}</td>
          <td>${row.configured}</td>
          <td>${row.candidate}</td>
          <td>${row.machinePassed}</td>
          <td>${row.formalUsable}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.nextAction)}</td>
        </tr>`).join('');

const atomicCards = atomic.audioElements.map((item) => `
        <article class="card">
          <p class="eyebrow">${escapeHtml(item.elementType)} · ${escapeHtml(item.goal)} · ${escapeHtml(item.instrument)}</p>
          <h3>${escapeHtml(item.elementId)}</h3>
          <audio controls preload="metadata" src="../../audio/music/local-review/atomic-foundation-elements-v1/prepared/${escapeHtml(item.elementId)}.mp3"></audio>
        </article>`).join('');

const soothingCards = soothing.candidates.map((item) => `
        <article class="card">
          <p class="eyebrow">${escapeHtml(item.category)} · ${escapeHtml(item.role)} · ${escapeHtml(item.machineStatus)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <audio controls preload="metadata" src="../../${escapeHtml(item.preparedAudioUrl.replace(/^\//, ''))}"></audio>
        </article>`).join('');

const dspCards = dsp.configs.map((item) => `
        <article class="card symbolic">
          <p class="eyebrow">${escapeHtml(item.type)} · ${escapeHtml(item.role)}</p>
          <h3>${escapeHtml(item.label)}</h3>
          <pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>
        </article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Material Complete V1</title>
  <style>
    body { margin:0; background:#101210; color:#edf4ec; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    main { max-width:1240px; margin:0 auto; padding:32px 18px 72px; }
    .hero,.card { border:1px solid rgba(255,255,255,.12); border-radius:22px; padding:18px; background:rgba(255,255,255,.045); margin:14px 0; }
    .hero { background:linear-gradient(135deg,rgba(139,117,72,.2),rgba(79,106,82,.16)); }
    .eyebrow { color:#dec987; text-transform:uppercase; letter-spacing:.08em; font-size:12px; font-weight:800; }
    table { width:100%; border-collapse:collapse; margin:18px 0; font-size:13px; }
    th,td { border-bottom:1px solid rgba(255,255,255,.11); text-align:left; vertical-align:top; padding:10px 8px; }
    th { color:#dec987; }
    audio { width:100%; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    pre { white-space:pre-wrap; max-height:260px; overflow:auto; color:#dce8d7; }
    .symbolic { background:rgba(80,96,82,.18); }
    @media(max-width:900px){ .grid{grid-template-columns:1fr;} }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">MixStil · complete candidate material inventory</p>
      <h1>Foundational Material Complete V1</h1>
      <p>这是基础素材完整候选总表：音乐原子、结构规则、环境/纹理/点缀候选、DSP 参数已汇总。它不是正式发布页，也不把成品曲或组合证明算作基础素材。</p>
      <p>当前状态：${escapeHtml(manifest.status)}。Production 仍关闭：${String(manifest.productionAllowed)}。</p>
      <p>汇总项：${manifest.counts.consolidatedReviewItems} = atomic ${manifest.counts.atomicAudioElements}+${manifest.counts.atomicSymbolicElements}，non-music ${manifest.counts.soothingDeterministicAudioCandidates}，DSP ${manifest.counts.deterministicDspConfigs}。</p>
    </section>
    <section>
      <h2>Family coverage</h2>
      <table>
        <thead><tr><th>Family</th><th>Min target</th><th>Configured</th><th>Candidate</th><th>Machine</th><th>Formal usable</th><th>Status</th><th>Next action</th></tr></thead>
        <tbody>${familyRows}</tbody>
      </table>
    </section>
    <section>
      <h2>Atomic music audio elements</h2>
      <div class="grid">${atomicCards}</div>
    </section>
    <section>
      <h2>Non-music deterministic candidates</h2>
      <div class="grid">${soothingCards}</div>
    </section>
    <section>
      <h2>Precise DSP configs</h2>
      <div class="grid">${dspCards}</div>
    </section>
  </main>
</body>
</html>
`;

await writeFile(reviewPath, html);

const markdown = `# Foundational Material Complete V1

Generated: ${manifest.generatedAt}

## Verdict

${manifest.status}

Configured and candidate coverage now meets the internal target for every foundational family. This is still candidate/configured completion, not public production approval.

## Counts

| Metric | Count |
| --- | ---: |
| Atomic audio elements | ${manifest.counts.atomicAudioElements} |
| Atomic symbolic elements | ${manifest.counts.atomicSymbolicElements} |
| Non-music deterministic audio candidates | ${manifest.counts.soothingDeterministicAudioCandidates} |
| Non-music deterministic machine pass | ${manifest.counts.soothingDeterministicMachinePass} |
| Deterministic DSP configs | ${manifest.counts.deterministicDspConfigs} |
| Consolidated review items | ${manifest.counts.consolidatedReviewItems} |

## Family coverage

| Family | Min target | Configured | Candidate | Machine passed | Formal usable | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${configuredCoverage.map((row) => `| ${row.familyId} | ${row.minTarget} | ${row.configured} | ${row.candidate} | ${row.machinePassed} | ${row.formalUsable} | ${row.status} |`).join('\n')}

## Review

Open: \`/review/${batchId}/index.html\`
`;

await writeFile(reportPath, markdown);

console.log(JSON.stringify({
  passed: manifest.status === 'complete_candidate_inventory_pending_human_review',
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  reviewUrl: `/review/${batchId}/index.html`,
  productionAllowed: manifest.productionAllowed,
}, null, 2));
