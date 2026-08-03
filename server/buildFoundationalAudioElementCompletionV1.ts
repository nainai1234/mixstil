import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'foundational-audio-element-completion-v1';

type Goal = 'sleep' | 'calm' | 'focus';

type CompletionItem = {
  id: string;
  sourceKind: 'recipe_integrated_audio' | 'instrument_composition_candidate' | 'lyria_single_element_reserve';
  sourceBatchId: string;
  role: string;
  goals: Goal[];
  audioUrl: string;
  routeTier: 'router_integrated' | 'reserve_candidate';
  machineStatus: string;
  humanListeningStatus: 'pending';
  productionAllowed: false;
  formalUsable: false;
  reason: string;
  riskTags: string[];
};

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;

const eligibilityMap = readJson<{
  mapId: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  eligibilities: Array<{
    id: string;
    sourceKind: string;
    sourceBatchId: string;
    recipeRole: string;
    goalSuitability: Record<Goal, string>;
    routeStatus: string;
    productionAllowed: false;
    formalUsable: false;
    audioUrl?: string;
    riskTags: string[];
  }>;
}>('config/foundational-recipe-eligibility-map-v1.json');

const compositionExpansion = readJson<{
  batchId: string;
  productionAllowed: false;
  candidateCount: number;
  machinePassCount: number;
  candidates: Array<{
    candidateId: string;
    goal: Goal;
    scene: string;
    instrument: string;
    preparedAudioUrl: string;
    machineStatus: string;
    humanListeningStatus: 'pending';
    formalUsable: false;
    productionAllowed: false;
  }>;
}>('public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json');

const lyriaExpansion = readJson<{
  batchId: string;
  productionAllowed: false;
  candidates: Array<{
    candidateId: string;
    category: string;
    role: string;
    goals: Goal[];
    preparedAudioUrl: string;
    productionAllowed: false;
    preparedAnalysis: {
      technicalStatus: string;
      technicalFlags: string[];
      humanIdentityStatus: 'pending';
      humanVoiceStatus: 'pending';
      onsetDensityPerSecond: number;
      spectralCentroidHz: number;
    };
  }>;
}>('public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json');

const goalsForEligibility = (item: typeof eligibilityMap.eligibilities[number]): Goal[] =>
  (['sleep', 'calm', 'focus'] as const).filter((goal) => ['primary', 'secondary'].includes(item.goalSuitability[goal]));

const integratedItems: CompletionItem[] = eligibilityMap.eligibilities
  .filter((item) => item.audioUrl)
  .map((item): CompletionItem => ({
    id: item.id,
    sourceKind: 'recipe_integrated_audio',
    sourceBatchId: item.sourceBatchId,
    role: item.recipeRole,
    goals: goalsForEligibility(item),
    audioUrl: item.audioUrl!,
    routeTier: 'router_integrated',
    machineStatus: item.routeStatus,
    humanListeningStatus: 'pending',
    productionAllowed: false,
    formalUsable: false,
    reason: 'Already mapped into foundational_recipe_eligibility_map_v1 and callable by the controlled composer router.',
    riskTags: item.riskTags,
  }));

const compositionReserve: CompletionItem[] = compositionExpansion.candidates
  .filter((item) => item.machineStatus === 'pass')
  .map((item): CompletionItem => ({
    id: item.candidateId,
    sourceKind: 'instrument_composition_candidate',
    sourceBatchId: compositionExpansion.batchId,
    role: `composition_phrase_${item.instrument}`,
    goals: [item.goal],
    audioUrl: item.preparedAudioUrl,
    routeTier: 'reserve_candidate',
    machineStatus: item.machineStatus,
    humanListeningStatus: 'pending',
    productionAllowed: false,
    formalUsable: false,
    reason: 'Machine-passed local instrument composition candidate; reserve pool for future composer expansion, not current production routing.',
    riskTags: ['human_listening_required', 'reserve_not_router_integrated'],
  }));

const preferredLyriaReserveIds = new Set([
  'granular_mist_v1',
  'steady_room_ventilation_v2',
  'soft_harp_phrase_v1',
  'low_wood_resonance_v1',
  'single_low_temple_bell_v2',
]);

const lyriaReserve: CompletionItem[] = lyriaExpansion.candidates
  .filter((item) => preferredLyriaReserveIds.has(item.candidateId))
  .filter((item) => item.preparedAnalysis.technicalStatus === 'pass' && item.preparedAnalysis.technicalFlags.length === 0)
  .map((item): CompletionItem => ({
    id: item.candidateId,
    sourceKind: 'lyria_single_element_reserve',
    sourceBatchId: lyriaExpansion.batchId,
    role: item.role,
    goals: item.goals,
    audioUrl: item.preparedAudioUrl,
    routeTier: 'reserve_candidate',
    machineStatus: item.preparedAnalysis.technicalStatus,
    humanListeningStatus: 'pending',
    productionAllowed: false,
    formalUsable: false,
    reason: 'Low-risk machine-passed Lyria single-element candidate selected to fill the internal 80-audio-element reserve baseline.',
    riskTags: ['human_identity_review_required', 'voice_gate_review_required', 'reserve_not_router_integrated'],
  }));

const items = [...integratedItems, ...compositionReserve, ...lyriaReserve];

const audioFileExists = (audioUrl: string) => existsSync(path.join(root, 'public', audioUrl.replace(/^\//, '')));
for (const item of items) {
  if (!audioFileExists(item.audioUrl)) throw new Error(`Missing audio file for ${item.id}: ${item.audioUrl}`);
}
if (items.length !== 80) throw new Error(`Expected 80 foundational audio completion items, got ${items.length}`);
if (integratedItems.length !== 45) throw new Error(`Expected 45 router integrated audio items, got ${integratedItems.length}`);
if (compositionReserve.length !== 30) throw new Error(`Expected 30 composition reserve items, got ${compositionReserve.length}`);
if (lyriaReserve.length !== 5) throw new Error(`Expected 5 Lyria reserve items, got ${lyriaReserve.length}`);

const counts = {
  totalAudioItems: items.length,
  routerIntegrated: integratedItems.length,
  reserveCandidates: compositionReserve.length + lyriaReserve.length,
  instrumentCompositionReserve: compositionReserve.length,
  lyriaSingleElementReserve: lyriaReserve.length,
  productionAllowed: items.filter((item) => item.productionAllowed).length,
  formalUsable: items.filter((item) => item.formalUsable).length,
  sleep: items.filter((item) => item.goals.includes('sleep')).length,
  calm: items.filter((item) => item.goals.includes('calm')).length,
  focus: items.filter((item) => item.goals.includes('focus')).length,
};

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: 'internal_foundational_audio_elements_filled_to_80_candidate_baseline',
  productionAllowed: false,
  publicReleaseAllowed: false,
  formalUsablePromotionAllowed: false,
  purpose: 'Fill the internal 80-audio-element foundation baseline without promoting reserve candidates to production or asking the product owner to choose materials.',
  hardRules: [
    'Router proof renders are excluded.',
    'Finished content and long-form seeds are excluded.',
    'Reserve candidates require later human identity, fatigue, and voice-free review before router integration.',
    'The current Quick Create router may use the 45 router-integrated items only.',
    'No item is production allowed or formal usable in this completion report.',
  ],
  sourceInputs: {
    routerIntegratedMap: 'config/foundational-recipe-eligibility-map-v1.json',
    instrumentCompositionReserve: 'public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json',
    lyriaReserve: 'public/audio/music/local-review/lyria-foundational-expansion-v2/manifest.json',
  },
  counts,
  items,
};

await mkdir(path.join(root, 'reports'), { recursive: true });
await mkdir(path.join(root, 'public/review', batchId), { recursive: true });
await writeFile(path.join(root, 'reports', `${batchId}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

const itemRows = items.map((item) =>
  `| ${item.id} | ${item.routeTier} | ${item.role} | ${item.goals.join(', ')} | ${item.sourceKind} | ${item.machineStatus} |`).join('\n');

await writeFile(path.join(root, 'reports', `${batchId}.md`), `# Foundational Audio Element Completion V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Verdict

The internal foundational audio pool is now filled to the 80-item candidate
baseline: 45 items are already router-integrated, and 35 are held as reserve
candidates for the next composer expansion pass.

This is not a production or formal-usable promotion.

## Counts

| Metric | Count |
| --- | ---: |
| Total audio items | ${counts.totalAudioItems} |
| Router integrated | ${counts.routerIntegrated} |
| Reserve candidates | ${counts.reserveCandidates} |
| Instrument composition reserve | ${counts.instrumentCompositionReserve} |
| Lyria single-element reserve | ${counts.lyriaSingleElementReserve} |
| Sleep-capable | ${counts.sleep} |
| Calm-capable | ${counts.calm} |
| Focus-capable | ${counts.focus} |
| Production allowed | ${counts.productionAllowed} |
| Formal usable | ${counts.formalUsable} |

## Boundary

The 45 router-integrated items remain the only items available to current Quick
Create composer routing. The 35 reserve items fill the foundation inventory and
must pass later human identity/fatigue/voice-free review before router
integration.

## Items

| ID | Tier | Role | Goals | Source | Machine status |
| --- | --- | --- | --- | --- | --- |
${itemRows}
`);

const cards = items.map((item) => `
  <article class="card ${item.routeTier === 'reserve_candidate' ? 'reserve' : ''}">
    <p class="eyebrow">${item.routeTier} · ${item.sourceKind}</p>
    <h3>${item.id}</h3>
    <audio controls preload="metadata" src="../../${item.audioUrl.replace(/^\//, '')}"></audio>
    <p>${item.role} · ${item.goals.join(', ')} · ${item.machineStatus}</p>
    <p>${item.reason}</p>
  </article>`).join('');

await writeFile(path.join(root, 'public/review', batchId, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Audio Element Completion V1</title>
  <style>
    body{margin:0;background:#101210;color:#eff5ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1240px;margin:0 auto;padding:32px 18px 72px}
    .hero,.card{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:16px;background:rgba(255,255,255,.045);margin:12px 0}
    .hero{background:rgba(113,132,92,.16)}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .reserve{background:rgba(89,95,115,.18)}
    .eyebrow{color:#dec987;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}
    audio{width:100%;margin:8px 0}
    @media(max-width:900px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">MixStil · foundational audio completion</p>
      <h1>80 Internal Foundational Audio Elements</h1>
      <p>45 router-integrated items plus 35 reserve candidates. Production remains blocked; reserve candidates are not current Quick Create routing material.</p>
    </section>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`);

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts,
  productionAllowed: manifest.productionAllowed,
  reportPath: `reports/${batchId}.md`,
  jsonReportPath: `reports/${batchId}.json`,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
