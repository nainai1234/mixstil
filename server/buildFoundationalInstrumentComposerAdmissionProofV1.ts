import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchId = 'foundational-instrument-composer-admission-proof-v1';
const sourceAdmissionPath = 'reports/foundational-instrument-composition-admission-v1.json';
const sourceEligibilityPath = 'reports/foundational-recipe-eligibility-map-v1.json';

type Goal = 'sleep' | 'calm' | 'focus';
type Instrument = 'piano' | 'guitar' | 'rhodes' | 'bass';

type AdmissionItem = {
  id: string;
  title: string;
  goal: Goal;
  scene: string;
  instrument: Instrument;
  instrumentSourceId: string;
  compositionPlanId: string;
  role: string;
  tempo: number;
  audioUrl: string;
  routeTier: 'reserve_candidate';
  admissionStatus: 'controlled_composer_admission_review';
  controlledComposerProofAllowed: true;
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  formalUsable: false;
  humanListeningStatus: 'pending';
  requiredAdmissionGates: string[];
};

type AdmissionManifest = {
  batchId: string;
  counts: { candidates: number };
  items: AdmissionItem[];
};

type Eligibility = {
  id: string;
  sourceKind: string;
  sourceBatchId?: string;
  recipeRole: string;
  goalSuitability: Record<Goal, 'primary' | 'secondary' | 'avoid'>;
  foregroundAllowed: boolean;
  supportOnly: boolean;
  routeStatus: string;
  hardExclusions: string[];
  riskTags: string[];
  audioUrl?: string;
  formalUsable: false;
  productionAllowed: false;
};

type EligibilityManifest = {
  mapId: string;
  eligibilities: Eligibility[];
};

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as T;

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const audioFileExists = (audioUrl: string) =>
  existsSync(path.join(root, 'public', audioUrl.replace(/^\//, '')));

const admission = readJson<AdmissionManifest>(sourceAdmissionPath);
const eligibility = readJson<EligibilityManifest>(sourceEligibilityPath);

if (admission.batchId !== 'foundational-instrument-composition-admission-v1') {
  throw new Error(`Unexpected admission source: ${admission.batchId}`);
}
if (admission.counts.candidates !== 30 || admission.items.length !== 30) {
  throw new Error(`Expected 30 admitted instrument candidates, got ${admission.items.length}`);
}
if (eligibility.mapId !== 'foundational_recipe_eligibility_map_v1') {
  throw new Error(`Unexpected eligibility map: ${eligibility.mapId}`);
}

const admissionById = new Map(admission.items.map((item) => [item.id, item]));
const eligibilityById = new Map(eligibility.eligibilities.map((item) => [item.id, item]));

const caseSpecs = [
  {
    id: 'sleep_piano_low_air_admission',
    label: 'Sleep · low piano with room air',
    prompt: '睡前要柔和低密度钢琴感，空气感要稳，不要人声、鼓点或明显自然声。',
    goal: 'sleep' as const,
    instrumentId: 'sleep_low_piano_a_soft_a_vcsl_kawai_soft_piano',
    supportIds: ['proc_velvet_room_air_b', 'proc_brown_velvet_hush_b', 'proc_soft_bowl_tail_a'],
    composerQuestion: '候选钢琴短语能否和低身份空气/柔软遮蔽层共存，而不是变成注意力很强的成品曲？',
  },
  {
    id: 'sleep_bass_deep_hush_admission',
    label: 'Sleep · bass support depth',
    prompt: '需要更深一点的睡眠底层，低频支撑可以有，但不能有旋律、人声或突发事件。',
    goal: 'sleep' as const,
    instrumentId: 'sleep_bass_support_1_discord_cc0_bass',
    supportIds: ['proc_velvet_room_air_b', 'proc_low_felt_resonance_b', 'proc_soft_bowl_tail_a'],
    composerQuestion: '低频候选是否只补重量和稳定感，而不抢占前景或造成疲劳？',
  },
  {
    id: 'calm_guitar_breathing_admission',
    label: 'Calm · guitar meditation support',
    prompt: '十分钟冥想需要一点柔和吉他质感，背景要轻，不要人声或突然变化。',
    goal: 'calm' as const,
    instrumentId: 'calm_guitar_a_soft_a_discord_cc0_guitar',
    supportIds: ['proc_velvet_room_air_a', 'proc_warm_pink_haze_a', 'proc_soft_bowl_tail_a'],
    composerQuestion: '吉他候选是否能提供冥想质感，同时仍让空气和粉噪支撑承担连续性？',
  },
  {
    id: 'calm_piano_settling_admission',
    label: 'Calm · piano emotional settling',
    prompt: '情绪安放需要柔和钢琴和一点空间感，不要治疗承诺、不要人声。',
    goal: 'calm' as const,
    instrumentId: 'calm_lyrical_piano_a_soft_a_vcsl_kawai_soft_piano',
    supportIds: ['proc_pine_air_haze_a', 'proc_low_felt_resonance_a', 'proc_soft_bowl_tail_b'],
    composerQuestion: '钢琴候选是否能支撑安静情绪场景，同时不触发疗效/频率类文案风险？',
  },
  {
    id: 'focus_rhodes_room_mask_admission',
    label: 'Focus · Rhodes low-interruption',
    prompt: '深度工作需要低干扰 Rhodes 质感，不要人声，不要自然声抢注意力。',
    goal: 'focus' as const,
    instrumentId: 'focus_rhodes_a_soft_a_discord_cc0_rhodes',
    supportIds: ['proc_velvet_room_air_a', 'proc_warm_pink_haze_b', 'proc_soft_bowl_tail_b'],
    composerQuestion: 'Rhodes 候选是否能维持工作背景的稳定脉络，并避开自然身份前景？',
  },
  {
    id: 'focus_bass_masking_admission',
    label: 'Focus · bass masking support',
    prompt: '专注时只需要稳定遮蔽和一点低频支撑，不要旋律、人声或水声。',
    goal: 'focus' as const,
    instrumentId: 'focus_bass_support_5_discord_cc0_bass',
    supportIds: ['proc_velvet_room_air_a', 'proc_warm_pink_haze_a', 'proc_soft_bowl_tail_b'],
    composerQuestion: 'Bass 候选是否可以作为遮蔽骨架，而不是被误升格为旋律/音乐主线？',
  },
];

const requiredProofGates = [
  'ingredient_level_audio_check',
  'composer_combination_listening',
  'fatigue_review',
  'explicit_exclusion_mapping',
  'no_quick_create_router_promotion',
] as const;

const cases = caseSpecs.map((spec) => {
  const instrument = admissionById.get(spec.instrumentId);
  if (!instrument) throw new Error(`Missing instrument admission candidate ${spec.instrumentId}`);
  if (instrument.goal !== spec.goal) throw new Error(`${spec.id}: instrument goal mismatch`);
  if (!instrument.controlledComposerProofAllowed || instrument.quickCreateRouterAllowed || instrument.productionAllowed || instrument.publicReleaseAllowed || instrument.formalUsable) {
    throw new Error(`${spec.id}: instrument candidate has an invalid promotion flag`);
  }
  if (!audioFileExists(instrument.audioUrl)) throw new Error(`${spec.id}: missing instrument audio ${instrument.audioUrl}`);

  const supportLayers = spec.supportIds.map((supportId) => {
    const support = eligibilityById.get(supportId);
    if (!support) throw new Error(`${spec.id}: missing support eligibility ${supportId}`);
    if (!support.audioUrl) throw new Error(`${spec.id}: support ${supportId} has no audio URL`);
    if (!audioFileExists(support.audioUrl)) throw new Error(`${spec.id}: missing support audio ${support.audioUrl}`);
    if (support.goalSuitability[spec.goal] === 'avoid') throw new Error(`${spec.id}: support ${supportId} avoids ${spec.goal}`);
    if (support.productionAllowed || support.formalUsable) throw new Error(`${spec.id}: support ${supportId} was incorrectly promoted`);
    return {
      id: support.id,
      recipeRole: support.recipeRole,
      sourceKind: support.sourceKind,
      sourceBatchId: support.sourceBatchId ?? 'deterministic_support',
      goalSuitability: support.goalSuitability[spec.goal],
      foregroundAllowed: support.foregroundAllowed,
      supportOnly: support.supportOnly,
      routeStatus: support.routeStatus,
      audioUrl: support.audioUrl,
      productionAllowed: false as const,
      formalUsable: false as const,
    };
  });

  return {
    id: spec.id,
    label: spec.label,
    prompt: spec.prompt,
    goal: spec.goal,
    scene: instrument.scene,
    composerQuestion: spec.composerQuestion,
    admissionStatus: 'controlled_composer_combination_proof' as const,
    proofAllowed: true,
    quickCreateRouterAllowed: false,
    productionAllowed: false,
    publicReleaseAllowed: false,
    formalUsable: false,
    renderedMixAllowed: false,
    instrumentLayer: {
      id: instrument.id,
      title: instrument.title,
      instrument: instrument.instrument,
      instrumentSourceId: instrument.instrumentSourceId,
      compositionPlanId: instrument.compositionPlanId,
      role: instrument.role,
      tempo: instrument.tempo,
      audioUrl: instrument.audioUrl,
      routeTier: instrument.routeTier,
      humanListeningStatus: instrument.humanListeningStatus,
      requiredAdmissionGates: instrument.requiredAdmissionGates,
      productionAllowed: false as const,
      formalUsable: false as const,
    },
    supportLayers,
    requiredProofGates: [...requiredProofGates],
    blockedUse: [
      'consumer_quick_create_router',
      'production_playback',
      'public_release',
      'offline_release',
      'formal_usable_promotion',
      'finished_render_counting',
    ],
    reviewNotes: [
      'This proof combines one reserve instrument phrase with already mapped support ingredients for listening review.',
      'It is not a rendered user result and it does not change foundational_recipe_eligibility_map_v1.',
      'The owner/professional reviewer judges combination fit; the consumer is not asked to select materials.',
    ],
  };
});

const countBy = <T extends string>(values: T[]) =>
  values.reduce<Record<T, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);

const counts = {
  cases: cases.length,
  instrumentLayers: cases.length,
  supportLayers: cases.reduce((sum, item) => sum + item.supportLayers.length, 0),
  audioControls: cases.reduce((sum, item) => sum + 1 + item.supportLayers.length, 0),
  quickCreateRouterAllowed: cases.filter((item) => item.quickCreateRouterAllowed).length,
  productionAllowed: cases.filter((item) => item.productionAllowed).length,
  publicReleaseAllowed: cases.filter((item) => item.publicReleaseAllowed).length,
  formalUsable: cases.filter((item) => item.formalUsable).length,
  renderedMixAllowed: cases.filter((item) => item.renderedMixAllowed).length,
  byGoal: countBy(cases.map((item) => item.goal)),
  byInstrument: countBy(cases.map((item) => item.instrumentLayer.instrument)),
};

const manifest = {
  schemaVersion: '1.0.0',
  batchId,
  generatedAt: new Date().toISOString(),
  status: 'controlled_instrument_composer_admission_proof_ready',
  sourceAdmission: sourceAdmissionPath,
  sourceEligibilityMap: sourceEligibilityPath,
  productionAllowed: false,
  publicReleaseAllowed: false,
  quickCreateRouterAllowed: false,
  formalUsablePromotionAllowed: false,
  renderedMixesProduced: false,
  purpose:
    'Build six controlled composer-admission combination proofs from reserve instrument phrases plus mapped support ingredients, without promoting them to consumer routing.',
  hardRules: [
    'This proof does not promote reserve instrument candidates to consumer Quick Create.',
    'This proof does not promote any ingredient to production, public release, offline release, or formal usable.',
    'This proof is combination QA, not finished-render evidence.',
    'Every case uses exactly one admitted instrument candidate and three already mapped support ingredients.',
    'No Lyria single-element reserve item may be used.',
    'The consumer is never asked to choose these materials.',
  ],
  counts,
  cases,
  reviewUrl: `/review/${batchId}/index.html`,
};

await mkdir(path.join(root, 'reports'), { recursive: true });
await mkdir(path.join(root, 'public/review', batchId), { recursive: true });
await writeFile(path.join(root, 'reports', `${batchId}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

const caseRows = cases.map((item) =>
  `| ${item.id} | ${item.goal} | ${item.instrumentLayer.instrument} | ${item.supportLayers.map((layer) => layer.id).join(', ')} | ${item.quickCreateRouterAllowed ? 'yes' : 'no'} | ${item.productionAllowed ? 'yes' : 'no'} |`,
).join('\n');

await writeFile(path.join(root, 'reports', `${batchId}.md`), `# Foundational Instrument Composer Admission Proof V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Verdict

Six controlled composer-admission combinations are ready for internal listening
review. Each case joins one reserve instrument phrase with three mapped support
ingredients. This is the next layer after instrument admission, but it still
does not modify Quick Create routing or production/public/formal release state.

## Counts

| Metric | Count |
| --- | ---: |
| Cases | ${counts.cases} |
| Instrument layers | ${counts.instrumentLayers} |
| Support layers | ${counts.supportLayers} |
| Audio controls | ${counts.audioControls} |
| Quick Create router allowed | ${counts.quickCreateRouterAllowed} |
| Production allowed | ${counts.productionAllowed} |
| Public release allowed | ${counts.publicReleaseAllowed} |
| Formal usable | ${counts.formalUsable} |
| Rendered mixes produced | ${counts.renderedMixAllowed} |
| Sleep / Calm / Focus | ${counts.byGoal.sleep ?? 0} / ${counts.byGoal.calm ?? 0} / ${counts.byGoal.focus ?? 0} |

## Boundary

This page is proof-only combination QA. It allows the team to hear whether the
new reserve instrument phrases can behave as composer ingredients alongside the
already mapped support bed, texture, and accent layers. It does not count as a
finished rendered user result, and it does not promote any candidate into
consumer Quick Create.

## Cases

| ID | Goal | Instrument | Support layers | Quick Create | Production |
| --- | --- | --- | --- | --- | --- |
${caseRows}
`);

const audioBlock = (label: string, audioUrl: string, meta: string) => `
      <div class="audio-row">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(meta)}</span>
        </div>
        <audio controls preload="metadata" src="../../${escapeHtml(audioUrl.replace(/^\//, ''))}"></audio>
      </div>`;

const cards = cases.map((item) => `
  <article class="card" data-goal="${escapeHtml(item.goal)}" data-instrument="${escapeHtml(item.instrumentLayer.instrument)}">
    <p class="eyebrow">${escapeHtml(item.goal)} · ${escapeHtml(item.instrumentLayer.instrument)} · proof only</p>
    <h2>${escapeHtml(item.label)}</h2>
    <p class="prompt">${escapeHtml(item.prompt)}</p>
    <p class="question">${escapeHtml(item.composerQuestion)}</p>
    <section class="layer-list">
      ${audioBlock(`Instrument · ${item.instrumentLayer.instrument}`, item.instrumentLayer.audioUrl, `${item.instrumentLayer.compositionPlanId} · ${item.instrumentLayer.tempo} bpm`)}
      ${item.supportLayers.map((layer) => audioBlock(layer.recipeRole, layer.audioUrl, `${layer.id} · ${layer.goalSuitability} · ${layer.routeStatus}`)).join('')}
    </section>
    <dl>
      <div><dt>Admission</dt><dd>${escapeHtml(item.admissionStatus)}</dd></div>
      <div><dt>Router</dt><dd>blocked</dd></div>
      <div><dt>Rendered mix</dt><dd>not produced</dd></div>
      <div><dt>Required proof gates</dt><dd>${escapeHtml(item.requiredProofGates.join(', '))}</dd></div>
    </dl>
  </article>`).join('');

await writeFile(path.join(root, 'public/review', batchId, 'index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Instrument Composer Admission Proof V1</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #101214;
      color: #f4f0e7;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 56px; }
    header { display: grid; gap: 12px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.7rem); line-height: 1; letter-spacing: 0; }
    h2 { margin: 0; font-size: 1.1rem; letter-spacing: 0; }
    p { color: #cbc3b7; line-height: 1.55; margin: 0; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 10px; margin: 22px 0 26px; }
    .metric { border: 1px solid #3e4144; border-radius: 8px; padding: 12px; background: #171a1d; min-height: 82px; }
    .metric strong { display: block; font-size: 1.48rem; color: #f7e3aa; }
    .metric span { color: #aeb6ba; font-size: 0.9rem; }
    .notice { border: 1px solid #5a5848; border-radius: 8px; background: #1b1a16; padding: 14px; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; }
    .card { display: grid; gap: 12px; border: 1px solid #3d4248; border-radius: 8px; background: #171a1d; padding: 16px; }
    .eyebrow { color: #9fd3bc; font-size: 0.78rem; text-transform: uppercase; }
    .prompt, .question { color: #d8d1c5; }
    .layer-list { display: grid; gap: 10px; }
    .audio-row { display: grid; gap: 8px; border-top: 1px solid #30353b; padding-top: 10px; }
    .audio-row strong { display: block; color: #fff4dd; }
    .audio-row span { display: block; color: #9da6ad; font-size: 0.84rem; overflow-wrap: anywhere; }
    audio { width: 100%; min-height: 38px; }
    dl { display: grid; gap: 8px; margin: 0; }
    dl div { display: grid; gap: 2px; }
    dt { color: #8e979f; font-size: 0.76rem; text-transform: uppercase; }
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
      <h1>Instrument Composer Admission Proof</h1>
      <p>Six proof-only composer combinations pair reserve instrument phrases with mapped support ingredients. Quick Create routing remains blocked; the consumer is never asked to choose these materials.</p>
    </header>
    <section class="metrics" aria-label="Proof counts">
      <div class="metric"><strong>${counts.cases}</strong><span>Composer proof cases</span></div>
      <div class="metric"><strong>${counts.audioControls}</strong><span>Ingredient audio controls</span></div>
      <div class="metric"><strong>${counts.supportLayers}</strong><span>Mapped support layers</span></div>
      <div class="metric"><strong>${counts.quickCreateRouterAllowed}</strong><span>Quick Create allowed</span></div>
      <div class="metric"><strong>${counts.productionAllowed}</strong><span>Production allowed</span></div>
      <div class="metric"><strong>${counts.renderedMixAllowed}</strong><span>Rendered mixes produced</span></div>
    </section>
    <section class="notice">
      <p>Boundary: this page is combination QA for controlled composer admission only. It is not a finished render page, not a production catalog, and not a route-promotion step.</p>
    </section>
    <section class="grid" aria-label="Composer admission proof cases">
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
  review: manifest.reviewUrl,
  counts,
}, null, 2));
