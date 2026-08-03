import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'foundational-reserve-admission-queue-v1';
const sourceCompletionPath = 'reports/foundational-audio-element-completion-v1.json';

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

type CompletionManifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  counts: Record<string, number>;
  items: CompletionItem[];
};

type AdmissionStatus = 'ready_for_composer_admission_review' | 'requires_identity_voice_review';

type AdmissionItem = {
  id: string;
  sourceKind: 'instrument_composition_candidate' | 'lyria_single_element_reserve';
  sourceBatchId: string;
  role: string;
  goals: Goal[];
  audioUrl: string;
  routeTier: 'reserve_candidate';
  admissionStatus: AdmissionStatus;
  composerAdmissionCandidate: boolean;
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  formalUsable: false;
  machineStatus: string;
  humanListeningStatus: 'pending';
  requiredGates: string[];
  routeCandidateRole: string;
  admissionNotes: string;
  riskTags: string[];
};

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;

const audioFileExists = (audioUrl: string) =>
  existsSync(path.join(root, 'public', audioUrl.replace(/^\//, '')));

const roleFor = (item: CompletionItem): string => {
  if (item.sourceKind === 'instrument_composition_candidate') return item.role;
  if (item.role === 'masking_bed') return 'reserve_masking_bed';
  if (item.role === 'one_shot_accent') return 'reserve_accent_one_shot';
  if (item.role === 'melodic_phrase') return 'reserve_melodic_phrase';
  if (item.role === 'low_texture') return 'reserve_low_texture';
  return 'reserve_tonal_texture';
};

const requiredGatesFor = (item: CompletionItem): string[] => {
  const shared = ['item_level_human_listening', 'fatigue_review', 'recipe_combination_qa', 'explicit_exclusion_mapping'];
  if (item.sourceKind === 'lyria_single_element_reserve') {
    return ['human_identity_review', 'human_voice_free_review', ...shared, 'loop_or_one_shot_review'];
  }
  return [...shared, 'no_public_release'];
};

const admissionStatusFor = (item: CompletionItem): AdmissionStatus =>
  item.sourceKind === 'lyria_single_element_reserve'
    ? 'requires_identity_voice_review'
    : 'ready_for_composer_admission_review';

const completion = readJson<CompletionManifest>(sourceCompletionPath);
if (completion.batchId !== 'foundational-audio-element-completion-v1') {
  throw new Error(`Unexpected completion source batch: ${completion.batchId}`);
}
if (completion.counts.reserveCandidates !== 35) {
  throw new Error(`Expected 35 reserve candidates in completion source, got ${completion.counts.reserveCandidates}`);
}

const reserveItems = completion.items.filter((item) => item.routeTier === 'reserve_candidate');
if (reserveItems.length !== 35) throw new Error(`Expected 35 reserve items, got ${reserveItems.length}`);

const items: AdmissionItem[] = reserveItems.map((item): AdmissionItem => {
  if (!audioFileExists(item.audioUrl)) throw new Error(`Missing audio file for ${item.id}: ${item.audioUrl}`);
  if (item.sourceKind === 'recipe_integrated_audio') throw new Error(`Router-integrated item cannot enter reserve queue: ${item.id}`);
  const isLyria = item.sourceKind === 'lyria_single_element_reserve';
  return {
    id: item.id,
    sourceKind: item.sourceKind,
    sourceBatchId: item.sourceBatchId,
    role: item.role,
    goals: item.goals,
    audioUrl: item.audioUrl,
    routeTier: 'reserve_candidate',
    admissionStatus: admissionStatusFor(item),
    composerAdmissionCandidate: !isLyria,
    quickCreateRouterAllowed: false,
    productionAllowed: false,
    publicReleaseAllowed: false,
    formalUsable: false,
    machineStatus: item.machineStatus,
    humanListeningStatus: 'pending',
    requiredGates: requiredGatesFor(item),
    routeCandidateRole: roleFor(item),
    admissionNotes: isLyria
      ? 'Machine-passed reserve audio, but model-generated single elements require identity and voice-free human review before composer admission.'
      : 'Machine-passed local instrument composition reserve; ready for item-level listening and combination QA before any controlled composer admission.',
    riskTags: [...new Set([...item.riskTags, 'reserve_admission_queue_only'])],
  };
});

const counts = {
  reserveCandidates: items.length,
  instrumentCompositionCandidates: items.filter((item) => item.sourceKind === 'instrument_composition_candidate').length,
  lyriaSingleElementCandidates: items.filter((item) => item.sourceKind === 'lyria_single_element_reserve').length,
  readyForComposerAdmissionReview: items.filter((item) => item.admissionStatus === 'ready_for_composer_admission_review').length,
  requiresIdentityVoiceReview: items.filter((item) => item.admissionStatus === 'requires_identity_voice_review').length,
  composerAdmissionCandidates: items.filter((item) => item.composerAdmissionCandidate).length,
  quickCreateRouterAllowed: items.filter((item) => item.quickCreateRouterAllowed).length,
  productionAllowed: items.filter((item) => item.productionAllowed).length,
  publicReleaseAllowed: items.filter((item) => item.publicReleaseAllowed).length,
  formalUsable: items.filter((item) => item.formalUsable).length,
  sleep: items.filter((item) => item.goals.includes('sleep')).length,
  calm: items.filter((item) => item.goals.includes('calm')).length,
  focus: items.filter((item) => item.goals.includes('focus')).length,
};

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: 'reserve_candidates_triaged_for_composer_admission',
  productionAllowed: false,
  publicReleaseAllowed: false,
  quickCreateRouterAllowed: false,
  formalUsablePromotionAllowed: false,
  sourceCompletion: sourceCompletionPath,
  purpose: 'Turn the 35 foundational reserve audio candidates into an explicit admission queue without promoting them into Quick Create routing.',
  hardRules: [
    'No reserve candidate is added to foundational_recipe_eligibility_map_v1 by this step.',
    'No reserve candidate is allowed in Quick Create routing until all listed gates pass.',
    'Lyria single-element reserves require explicit identity and voice-free human review before composer admission.',
    'Instrument composition reserves may enter composer admission review, but still require item-level listening and combination QA.',
    'This queue is not a production, public release, or formal-usable promotion.',
  ],
  counts,
  items,
};

await mkdir(path.join(root, 'reports'), { recursive: true });
await mkdir(path.join(root, 'public/review', batchId), { recursive: true });
await writeFile(path.join(root, 'reports', `${batchId}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

const itemRows = items.map((item) =>
  `| ${item.id} | ${item.admissionStatus} | ${item.routeCandidateRole} | ${item.goals.join(', ')} | ${item.requiredGates.join(', ')} |`).join('\n');

await writeFile(path.join(root, 'reports', `${batchId}.md`), `# Foundational Reserve Admission Queue V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Verdict

The 35 foundational reserve audio candidates are now triaged into a controlled
admission queue. 30 local instrument-composition candidates are ready for
composer admission review, while 5 Lyria single-element candidates are held
behind identity and voice-free review.

No reserve candidate is promoted to Quick Create routing, production, public
release, or formal usable status by this step.

## Counts

| Metric | Count |
| --- | ---: |
| Reserve candidates | ${counts.reserveCandidates} |
| Instrument composition candidates | ${counts.instrumentCompositionCandidates} |
| Lyria single-element candidates | ${counts.lyriaSingleElementCandidates} |
| Ready for composer admission review | ${counts.readyForComposerAdmissionReview} |
| Requires identity/voice review | ${counts.requiresIdentityVoiceReview} |
| Composer admission candidates | ${counts.composerAdmissionCandidates} |
| Quick Create router allowed | ${counts.quickCreateRouterAllowed} |
| Production allowed | ${counts.productionAllowed} |
| Public release allowed | ${counts.publicReleaseAllowed} |
| Formal usable | ${counts.formalUsable} |
| Sleep-capable | ${counts.sleep} |
| Calm-capable | ${counts.calm} |
| Focus-capable | ${counts.focus} |

## Boundary

This queue is the bridge between inventory completion and future composer
expansion. It keeps the product boundary honest: machine-passed reserve audio is
reviewable, but not yet callable by the consumer Quick Create router.

## Items

| ID | Admission status | Candidate role | Goals | Required gates |
| --- | --- | --- | --- | --- |
${itemRows}
`);

const cards = items.map((item) => `
  <article class="card ${item.sourceKind === 'lyria_single_element_reserve' ? 'hold' : ''}">
    <p class="eyebrow">${item.sourceKind} · ${item.admissionStatus}</p>
    <h3>${item.id}</h3>
    <audio controls preload="metadata" src="../../${item.audioUrl.replace(/^\//, '')}"></audio>
    <dl>
      <div><dt>Role</dt><dd>${item.routeCandidateRole}</dd></div>
      <div><dt>Goals</dt><dd>${item.goals.join(', ')}</dd></div>
      <div><dt>Router</dt><dd>${item.quickCreateRouterAllowed ? 'allowed' : 'blocked'}</dd></div>
      <div><dt>Gates</dt><dd>${item.requiredGates.join(', ')}</dd></div>
    </dl>
    <p>${item.admissionNotes}</p>
  </article>`).join('');

await writeFile(path.join(root, 'public/review', batchId, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Reserve Admission Queue V1</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #101114;
      color: #f3f0e8;
    }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: grid; gap: 14px; margin-bottom: 26px; }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 4rem); line-height: 1; letter-spacing: 0; }
    p { color: #c9c3b7; line-height: 1.55; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 10px; margin: 20px 0 28px; }
    .metric { border: 1px solid #383633; border-radius: 8px; padding: 12px; background: #18191c; }
    .metric strong { display: block; font-size: 1.55rem; color: #fff6dc; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .card { border: 1px solid #3e4148; border-radius: 8px; background: #171a1d; padding: 16px; }
    .card.hold { border-color: #7f6039; background: #1c1a17; }
    .eyebrow { margin: 0 0 8px; color: #9fc4ff; font-size: 0.78rem; text-transform: uppercase; }
    h3 { margin: 0 0 12px; font-size: 1rem; overflow-wrap: anywhere; }
    audio { width: 100%; height: 36px; }
    dl { display: grid; gap: 7px; margin: 12px 0; }
    dt { color: #8f938f; font-size: 0.72rem; text-transform: uppercase; }
    dd { margin: 2px 0 0; color: #f0ece3; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Reserve Admission Queue</h1>
      <p>35 foundational reserve candidates are triaged for later composer admission review. Quick Create routing remains blocked for every reserve item.</p>
    </header>
    <section class="metrics" aria-label="Queue metrics">
      <div class="metric"><strong>${counts.reserveCandidates}</strong><span>reserve candidates</span></div>
      <div class="metric"><strong>${counts.readyForComposerAdmissionReview}</strong><span>ready for review</span></div>
      <div class="metric"><strong>${counts.requiresIdentityVoiceReview}</strong><span>identity/voice holds</span></div>
      <div class="metric"><strong>${counts.quickCreateRouterAllowed}</strong><span>router allowed</span></div>
    </section>
    <section class="grid" aria-label="Reserve candidate listening queue">
      ${cards}
    </section>
  </main>
</body>
</html>
`);

console.log(JSON.stringify({
  batchId,
  status: manifest.status,
  counts,
  report: `reports/${batchId}.md`,
  review: `/review/${batchId}/index.html`,
}, null, 2));
