import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'foundational-instrument-composition-admission-v1';
const sourceQueuePath = 'reports/foundational-reserve-admission-queue-v1.json';
const sourceManifestPath = 'public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json';

type Goal = 'sleep' | 'calm' | 'focus';

type QueueItem = {
  id: string;
  sourceKind: 'instrument_composition_candidate' | 'lyria_single_element_reserve';
  sourceBatchId: string;
  role: string;
  goals: Goal[];
  audioUrl: string;
  routeTier: 'reserve_candidate';
  admissionStatus: 'ready_for_composer_admission_review' | 'requires_identity_voice_review';
  composerAdmissionCandidate: boolean;
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  formalUsable: false;
  machineStatus: string;
  humanListeningStatus: 'pending';
  requiredGates: string[];
  routeCandidateRole: string;
  riskTags: string[];
};

type ReserveQueue = {
  batchId: string;
  counts: Record<string, number>;
  items: QueueItem[];
};

type SourceCandidate = {
  candidateId: string;
  title: string;
  goal: Goal;
  scene: string;
  instrument: 'piano' | 'guitar' | 'rhodes' | 'bass';
  instrumentSourceId: string;
  compositionPlanId: string;
  tempo: number;
  seed: number;
  preparedAudioUrl: string;
  productionAllowed: false;
  humanListeningStatus: 'pending';
  formalUsable: false;
  machineStatus: string;
};

type SourceManifest = {
  batchId: string;
  candidateCount: number;
  machinePassCount: number;
  byGoal: Record<Goal, number>;
  byInstrumentSource: Record<string, number>;
  candidates: SourceCandidate[];
};

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;

const audioFileExists = (audioUrl: string) =>
  existsSync(path.join(root, 'public', audioUrl.replace(/^\//, '')));

const queue = readJson<ReserveQueue>(sourceQueuePath);
const sourceManifest = readJson<SourceManifest>(sourceManifestPath);

if (queue.batchId !== 'foundational-reserve-admission-queue-v1') {
  throw new Error(`Unexpected reserve queue batch: ${queue.batchId}`);
}
if (sourceManifest.batchId !== 'instrument-composition-expansion-batch-v1') {
  throw new Error(`Unexpected source manifest batch: ${sourceManifest.batchId}`);
}

const sourceById = new Map(sourceManifest.candidates.map((candidate) => [candidate.candidateId, candidate]));
const queueItems = queue.items.filter((item) => item.sourceKind === 'instrument_composition_candidate');

if (queueItems.length !== 30) throw new Error(`Expected 30 instrument composition queue items, got ${queueItems.length}`);

const requiredAdmissionGates = [
  'item_level_human_listening',
  'fatigue_review',
  'recipe_combination_qa',
  'explicit_exclusion_mapping',
  'no_public_release',
] as const;

const items = queueItems.map((item) => {
  const source = sourceById.get(item.id);
  if (!source) throw new Error(`Missing source manifest candidate for ${item.id}`);
  if (source.preparedAudioUrl !== item.audioUrl) {
    throw new Error(`Audio URL mismatch for ${item.id}: ${source.preparedAudioUrl} != ${item.audioUrl}`);
  }
  if (!audioFileExists(item.audioUrl)) throw new Error(`Missing audio file for ${item.id}: ${item.audioUrl}`);
  if (item.admissionStatus !== 'ready_for_composer_admission_review') {
    throw new Error(`Instrument candidate is not ready for composer admission review: ${item.id}`);
  }
  if (!item.composerAdmissionCandidate) throw new Error(`Instrument candidate is not marked composer-admission candidate: ${item.id}`);
  if (item.quickCreateRouterAllowed || item.productionAllowed || item.publicReleaseAllowed || item.formalUsable) {
    throw new Error(`Instrument candidate is incorrectly promoted: ${item.id}`);
  }

  return {
    id: item.id,
    title: source.title,
    sourceBatchId: item.sourceBatchId,
    sourceKind: item.sourceKind,
    goal: source.goal,
    scene: source.scene,
    goals: item.goals,
    instrument: source.instrument,
    instrumentSourceId: source.instrumentSourceId,
    compositionPlanId: source.compositionPlanId,
    role: item.routeCandidateRole,
    tempo: source.tempo,
    seed: source.seed,
    audioUrl: item.audioUrl,
    routeTier: 'reserve_candidate' as const,
    admissionStatus: 'controlled_composer_admission_review' as const,
    controlledComposerProofAllowed: true,
    quickCreateRouterAllowed: false,
    productionAllowed: false,
    publicReleaseAllowed: false,
    formalUsable: false,
    machineStatus: item.machineStatus,
    humanListeningStatus: 'pending' as const,
    requiredAdmissionGates: [...requiredAdmissionGates],
    allowedUse: 'controlled_composer_admission_proof_only' as const,
    blockedUse: [
      'consumer_quick_create_router',
      'production_playback',
      'public_release',
      'offline_release',
      'formal_usable_promotion',
    ],
    admissionNotes:
      'Machine-passed local instrument phrase. It may be used only in controlled composer admission proofs until listening, fatigue, exclusion, and combination QA gates pass.',
    riskTags: [...new Set([...item.riskTags, 'controlled_proof_only', 'not_quick_create_router_allowed'])],
  };
});

const countBy = <T extends string>(values: T[]) =>
  values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);

const counts = {
  candidates: items.length,
  controlledComposerProofAllowed: items.filter((item) => item.controlledComposerProofAllowed).length,
  quickCreateRouterAllowed: items.filter((item) => item.quickCreateRouterAllowed).length,
  productionAllowed: items.filter((item) => item.productionAllowed).length,
  publicReleaseAllowed: items.filter((item) => item.publicReleaseAllowed).length,
  formalUsable: items.filter((item) => item.formalUsable).length,
  sleep: items.filter((item) => item.goal === 'sleep').length,
  calm: items.filter((item) => item.goal === 'calm').length,
  focus: items.filter((item) => item.goal === 'focus').length,
  byInstrument: countBy(items.map((item) => item.instrument)),
  byInstrumentSource: countBy(items.map((item) => item.instrumentSourceId)),
};

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: 'instrument_composition_candidates_ready_for_controlled_composer_admission_review',
  sourceQueue: sourceQueuePath,
  sourceManifest: sourceManifestPath,
  productionAllowed: false,
  publicReleaseAllowed: false,
  quickCreateRouterAllowed: false,
  formalUsablePromotionAllowed: false,
  purpose:
    'Define the minimum admission layer for 30 local instrument-composition reserve candidates before any Quick Create router promotion.',
  hardRules: [
    'Controlled composer proof is allowed only inside review/admission artifacts.',
    'No item in this manifest is allowed in consumer Quick Create routing.',
    'No item in this manifest is production, public-release, offline-release, or formal-usable approved.',
    'Every item still requires human listening, fatigue review, recipe combination QA, and explicit exclusion mapping.',
    'This step admits candidates to review; it does not modify foundational_recipe_eligibility_map_v1.',
  ],
  counts,
  items,
};

await mkdir(path.join(root, 'reports'), { recursive: true });
await mkdir(path.join(root, 'public/review', batchId), { recursive: true });
await writeFile(path.join(root, 'reports', `${batchId}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

const itemRows = items.map((item) =>
  `| ${item.id} | ${item.goal} | ${item.instrument} | ${item.instrumentSourceId} | ${item.controlledComposerProofAllowed ? 'yes' : 'no'} | ${item.quickCreateRouterAllowed ? 'yes' : 'no'} | ${item.requiredAdmissionGates.join(', ')} |`,
).join('\n');

await writeFile(path.join(root, 'reports', `${batchId}.md`), `# Foundational Instrument Composition Admission V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Verdict

30 local instrument-composition reserve candidates are now isolated for
controlled composer admission review. They may be used to build proof-only
composer combinations, but they remain blocked from consumer Quick Create,
production playback, public release, offline release, and formal-usable
promotion.

## Counts

| Metric | Count |
| --- | ---: |
| Candidates | ${counts.candidates} |
| Controlled composer proof allowed | ${counts.controlledComposerProofAllowed} |
| Quick Create router allowed | ${counts.quickCreateRouterAllowed} |
| Production allowed | ${counts.productionAllowed} |
| Public release allowed | ${counts.publicReleaseAllowed} |
| Formal usable | ${counts.formalUsable} |
| Sleep | ${counts.sleep} |
| Calm | ${counts.calm} |
| Focus | ${counts.focus} |
| Piano | ${counts.byInstrument.piano ?? 0} |
| Guitar | ${counts.byInstrument.guitar ?? 0} |
| Rhodes | ${counts.byInstrument.rhodes ?? 0} |
| Bass | ${counts.byInstrument.bass ?? 0} |

## Boundary

This is the minimum admission layer after the reserve queue. It makes the 30
local instrument phrases reviewable for controlled composer proofs while keeping
the consumer router unchanged. A later promotion must be explicit and must pass
item-level listening, fatigue review, combination QA, and exclusion mapping.

## Items

| ID | Goal | Instrument | Source | Controlled proof | Quick Create | Required gates |
| --- | --- | --- | --- | --- | --- | --- |
${itemRows}
`);

const cards = items.map((item) => `
  <article class="card" data-goal="${item.goal}" data-instrument="${item.instrument}">
    <p class="eyebrow">${item.goal} · ${item.instrument} · controlled proof only</p>
    <h3>${item.title}</h3>
    <audio controls preload="metadata" src="../../${item.audioUrl.replace(/^\//, '')}"></audio>
    <dl>
      <div><dt>ID</dt><dd>${item.id}</dd></div>
      <div><dt>Scene</dt><dd>${item.scene}</dd></div>
      <div><dt>Tempo</dt><dd>${item.tempo} bpm</dd></div>
      <div><dt>Router</dt><dd>blocked</dd></div>
      <div><dt>Allowed</dt><dd>${item.allowedUse}</dd></div>
      <div><dt>Gates</dt><dd>${item.requiredAdmissionGates.join(', ')}</dd></div>
    </dl>
  </article>`).join('');

await writeFile(path.join(root, 'public/review', batchId, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Instrument Composition Admission V1</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111315;
      color: #f4f1e9;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: grid; gap: 14px; margin-bottom: 26px; }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.8rem); line-height: 1; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; letter-spacing: 0; }
    p { color: #c9c1b5; line-height: 1.55; margin: 0; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 22px 0 28px; }
    .metric { border: 1px solid #3d3f42; border-radius: 8px; padding: 12px; background: #181b1e; min-height: 82px; }
    .metric strong { display: block; font-size: 1.55rem; color: #fff3d1; }
    .metric span { color: #b9b2a8; font-size: 0.9rem; }
    .notice { border: 1px solid #5b5645; border-radius: 8px; padding: 14px; background: #1b1a16; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 14px; }
    .card { border: 1px solid #3e4148; border-radius: 8px; background: #171a1d; padding: 16px; display: grid; gap: 12px; }
    .eyebrow { color: #a8d4c2; font-size: 0.78rem; text-transform: uppercase; }
    h3 { margin: 0; font-size: 1rem; line-height: 1.28; letter-spacing: 0; }
    audio { width: 100%; min-height: 38px; }
    dl { display: grid; gap: 8px; margin: 0; }
    div { display: grid; gap: 2px; }
    dt { color: #8f969e; font-size: 0.76rem; text-transform: uppercase; }
    dd { margin: 0; color: #eee8dc; overflow-wrap: anywhere; }
    @media (max-width: 640px) {
      main { padding: 24px 14px 44px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">MixStil internal review</p>
      <h1>Instrument Composition Admission V1</h1>
      <p>30 local instrument-composition reserve candidates are isolated for controlled composer proof review. Quick Create routing remains blocked.</p>
    </header>
    <section class="metrics" aria-label="Admission counts">
      <div class="metric"><strong>${counts.candidates}</strong><span>Candidates</span></div>
      <div class="metric"><strong>${counts.controlledComposerProofAllowed}</strong><span>Controlled proof allowed</span></div>
      <div class="metric"><strong>${counts.quickCreateRouterAllowed}</strong><span>Quick Create allowed</span></div>
      <div class="metric"><strong>${counts.productionAllowed}</strong><span>Production allowed</span></div>
      <div class="metric"><strong>${counts.sleep}/${counts.calm}/${counts.focus}</strong><span>Sleep / Calm / Focus</span></div>
      <div class="metric"><strong>${counts.byInstrument.piano ?? 0}/${counts.byInstrument.guitar ?? 0}/${counts.byInstrument.rhodes ?? 0}/${counts.byInstrument.bass ?? 0}</strong><span>Piano / Guitar / Rhodes / Bass</span></div>
    </section>
    <section class="notice">
      <p>Admission boundary: proof-only composer experiments may use these local phrases, but consumer Quick Create, public release, offline release, and formal usable promotion all remain blocked until the listed gates pass.</p>
    </section>
    <h2>Review Items</h2>
    <section class="grid" aria-label="Instrument composition admission candidates">
${cards}
    </section>
  </main>
</body>
</html>
`);

console.log(JSON.stringify({
  batchId,
  status: manifest.status,
  report: `reports/${batchId}.md`,
  review: `/review/${batchId}/index.html`,
  counts,
}, null, 2));
