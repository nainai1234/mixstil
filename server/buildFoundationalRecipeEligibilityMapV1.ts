import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const mapId = 'foundational_recipe_eligibility_map_v1';

const readJson = async <T>(relativePath: string): Promise<T> =>
  JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as T;

const escapeHtml = (value: unknown) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

type Goal = 'sleep' | 'calm' | 'focus';
type RecipeRole =
  | 'playable_note_source'
  | 'harmony_cell'
  | 'melodic_motif'
  | 'bass_support'
  | 'environment_identity_bed'
  | 'organic_texture'
  | 'accent_transition'
  | 'masking_support'
  | 'technical_reference_signal'
  | 'symbolic_harmony_template'
  | 'symbolic_motif_template'
  | 'symbolic_form_rule'
  | 'symbolic_arrangement_grammar';

type Eligibility = {
  id: string;
  sourceKind: 'atomic_audio' | 'deterministic_audio' | 'dsp_config' | 'symbolic_rule';
  sourceBatchId: string;
  recipeRole: RecipeRole;
  goalSuitability: Record<Goal, 'primary' | 'secondary' | 'avoid' | 'not_applicable'>;
  foregroundAllowed: boolean;
  supportOnly: boolean;
  defaultGainDb: number | null;
  minGainDb: number | null;
  maxGainDb: number | null;
  maxSimultaneousInstances: number;
  loopPolicy: 'one_shot' | 'short_atom_retriggered_by_composer' | 'crossfade_loop' | 'symbolic_not_audio';
  routeStatus: 'eligible_for_recipe_mapping' | 'support_only' | 'symbolic_eligible' | 'blocked_from_foreground' | 'review_only';
  hardExclusions: string[];
  riskTags: string[];
  notes: string;
  audioUrl?: string;
  formalUsable: false;
  productionAllowed: false;
};

const atomic = await readJson<{
  batchId: string;
  counts: { audioElements: number; symbolicElements: number; totalElements: number };
  audioElements: Array<{
    elementId: string;
    elementType: string;
    goal: Goal;
    instrument: string;
    preparedAudioUrl: string;
    analysis: { spectralCentroidHz: number; onsetDensityPerSecond: number; peakDbfs: number };
  }>;
  symbolicElements: Array<{ elementId: string; elementType: string; goal: Goal; family?: string }>;
}>('public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json');

const soothing = await readJson<{
  batchId: string;
  candidates: Array<{
    candidateId: string;
    title: string;
    category: string;
    role: string;
    goals: Goal[];
    preparedAudioUrl: string;
    machineStatus: string;
    analysis: { spectralCentroidHz: number; onsetDensityPerSecond: number; p99RmsJumpDb: number };
    notes: string;
  }>;
}>('public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json');

const dsp = await readJson<{
  registryId: string;
  configs: Array<{
    id: string;
    type: string;
    label: string;
    role: string;
    goals: Goal[];
    parameters: { defaultGainDb?: number; maxGainDb?: number };
    notes: string;
  }>;
}>('config/deterministic-acoustic-configs-v1.json');

const ownerDecision = await readJson<{
  ownerDecision: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  nextAllowedStage: string;
}>('config/foundational-material-complete-v1-owner-decision.json');

const goals = ['sleep', 'calm', 'focus'] as const;
const suitability = (primaryGoals: Goal[], secondaryGoals: Goal[] = []): Record<Goal, 'primary' | 'secondary' | 'avoid' | 'not_applicable'> =>
  Object.fromEntries(goals.map((goal) => [
    goal,
    primaryGoals.includes(goal) ? 'primary' : secondaryGoals.includes(goal) ? 'secondary' : 'avoid',
  ])) as Record<Goal, 'primary' | 'secondary' | 'avoid' | 'not_applicable'>;

const baseExclusions = ['voice', 'choir', 'singing', 'chanting', 'human_like_vocal_texture', 'medical_or_healing_claim'];
const lowArousalExclusions = [...baseExclusions, 'drums', 'percussion', 'beat_forward_groove'];

const audioRiskTags = (centroid: number, onsetDensity: number, p99Jump = 0): string[] => {
  const risks: string[] = [];
  if (centroid > 1200) risks.push('brightness_attention_risk');
  if (onsetDensity > 0.5) risks.push('event_density_attention_risk');
  if (p99Jump > 1.35) risks.push('rms_jump_review_risk');
  return risks;
};

const atomicRole = (type: string): RecipeRole => {
  if (type === 'single_note') return 'playable_note_source';
  if (type === 'harmony_cell') return 'harmony_cell';
  if (type === 'short_motif') return 'melodic_motif';
  if (type === 'bass_support') return 'bass_support';
  throw new Error(`Unsupported atomic type ${type}`);
};

const symbolicRole = (type: string): RecipeRole => {
  if (type === 'symbolic_harmony_template') return 'symbolic_harmony_template';
  if (type === 'symbolic_motif_template') return 'symbolic_motif_template';
  if (type === 'symbolic_form_rule') return 'symbolic_form_rule';
  if (type === 'symbolic_arrangement_grammar') return 'symbolic_arrangement_grammar';
  throw new Error(`Unsupported symbolic type ${type}`);
};

const deterministicRole = (category: string, role: string): RecipeRole => {
  if (category === 'environment') return 'environment_identity_bed';
  if (category === 'texture') return 'organic_texture';
  if (category === 'accent' || role.includes('accent')) return 'accent_transition';
  throw new Error(`Unsupported deterministic category ${category}/${role}`);
};

const dspRole = (type: string): RecipeRole =>
  type === 'noise' ? 'masking_support' : 'technical_reference_signal';

const eligibilities: Eligibility[] = [
  ...atomic.audioElements.map((item): Eligibility => {
    const role = atomicRole(item.elementType);
    const secondary = item.goal === 'sleep' ? ['calm'] as Goal[] : item.goal === 'calm' ? ['sleep', 'focus'] as Goal[] : ['calm'] as Goal[];
    const supportOnly = role === 'bass_support';
    return {
      id: item.elementId,
      sourceKind: 'atomic_audio',
      sourceBatchId: atomic.batchId,
      recipeRole: role,
      goalSuitability: suitability([item.goal], secondary),
      foregroundAllowed: !supportOnly,
      supportOnly,
      defaultGainDb: role === 'playable_note_source' ? -24 : role === 'bass_support' ? -31 : -27,
      minGainDb: role === 'playable_note_source' ? -34 : -38,
      maxGainDb: role === 'playable_note_source' ? -16 : role === 'bass_support' ? -24 : -19,
      maxSimultaneousInstances: role === 'playable_note_source' ? 4 : role === 'bass_support' ? 1 : 2,
      loopPolicy: 'short_atom_retriggered_by_composer',
      routeStatus: supportOnly ? 'support_only' : 'eligible_for_recipe_mapping',
      hardExclusions: lowArousalExclusions,
      riskTags: audioRiskTags(item.analysis.spectralCentroidHz, item.analysis.onsetDensityPerSecond),
      notes: `${item.instrument} ${item.elementType}; composer must schedule sparsely for Sleep/Calm.`,
      audioUrl: item.preparedAudioUrl,
      formalUsable: false,
      productionAllowed: false,
    };
  }),
  ...soothing.candidates.map((item): Eligibility => {
    const role = deterministicRole(item.category, item.role);
    const isAccent = role === 'accent_transition';
    const isTexture = role === 'organic_texture';
    const supportOnly = isTexture || item.role.includes('support') || /hush|haze|resonance|granular/i.test(item.candidateId);
    const risks = audioRiskTags(item.analysis.spectralCentroidHz, item.analysis.onsetDensityPerSecond, item.analysis.p99RmsJumpDb);
    if (/ocean|rain/i.test(item.candidateId)) risks.push('water_association_review');
    if (/room|air|hush/i.test(item.candidateId)) risks.push('road_like_or_hvac_like_review');
    return {
      id: item.candidateId,
      sourceKind: 'deterministic_audio',
      sourceBatchId: soothing.batchId,
      recipeRole: role,
      goalSuitability: suitability(item.goals, item.goals.includes('focus') ? [] : ['focus']),
      foregroundAllowed: role === 'environment_identity_bed' && !supportOnly,
      supportOnly,
      defaultGainDb: isAccent ? -34 : isTexture ? -32 : -29,
      minGainDb: isAccent ? -42 : -40,
      maxGainDb: isAccent ? -25 : isTexture ? -24 : -20,
      maxSimultaneousInstances: isAccent ? 2 : 1,
      loopPolicy: isAccent ? 'one_shot' : 'crossfade_loop',
      routeStatus: supportOnly ? 'support_only' : 'eligible_for_recipe_mapping',
      hardExclusions: lowArousalExclusions,
      riskTags: risks,
      notes: `${item.title}; ${item.notes}; route below foreground if road-like or mechanical association appears.`,
      audioUrl: item.preparedAudioUrl,
      formalUsable: false,
      productionAllowed: false,
    };
  }),
  ...dsp.configs.map((item): Eligibility => {
    const isNoise = item.type === 'noise';
    return {
      id: item.id,
      sourceKind: 'dsp_config',
      sourceBatchId: dsp.registryId,
      recipeRole: dspRole(item.type),
      goalSuitability: suitability(item.goals, []),
      foregroundAllowed: false,
      supportOnly: true,
      defaultGainDb: Number(item.parameters.defaultGainDb ?? (isNoise ? -30 : -44)),
      minGainDb: isNoise ? -44 : -54,
      maxGainDb: Number(item.parameters.maxGainDb ?? (isNoise ? -20 : -36)),
      maxSimultaneousInstances: 1,
      loopPolicy: 'crossfade_loop',
      routeStatus: isNoise ? 'support_only' : 'blocked_from_foreground',
      hardExclusions: [...lowArousalExclusions, 'therapeutic_frequency_claim', 'brainwave_or_heart_rate_claim'],
      riskTags: isNoise ? ['foreground_noise_fatigue_risk'] : ['technical_signal_attention_risk', 'claim_compliance_risk'],
      notes: `${item.label}; ${item.notes}; use as a quiet technical/support layer only.`,
      formalUsable: false,
      productionAllowed: false,
    };
  }),
  ...atomic.symbolicElements.map((item): Eligibility => ({
    id: item.elementId,
    sourceKind: 'symbolic_rule',
    sourceBatchId: atomic.batchId,
    recipeRole: symbolicRole(item.elementType),
    goalSuitability: suitability([item.goal], item.goal === 'calm' ? ['sleep', 'focus'] : ['calm']),
    foregroundAllowed: false,
    supportOnly: false,
    defaultGainDb: null,
    minGainDb: null,
    maxGainDb: null,
    maxSimultaneousInstances: item.elementType === 'symbolic_arrangement_grammar' ? 1 : 3,
    loopPolicy: 'symbolic_not_audio',
    routeStatus: 'symbolic_eligible',
    hardExclusions: lowArousalExclusions,
    riskTags: [],
    notes: `${item.elementType}${item.family ? ` / ${item.family}` : ''}; symbolic composer material, not an audio asset.`,
    formalUsable: false,
    productionAllowed: false,
  })),
];

const counts = {
  totalMappings: eligibilities.length,
  atomicAudio: eligibilities.filter((item) => item.sourceKind === 'atomic_audio').length,
  deterministicAudio: eligibilities.filter((item) => item.sourceKind === 'deterministic_audio').length,
  dspConfigs: eligibilities.filter((item) => item.sourceKind === 'dsp_config').length,
  symbolicRules: eligibilities.filter((item) => item.sourceKind === 'symbolic_rule').length,
  foregroundAllowed: eligibilities.filter((item) => item.foregroundAllowed).length,
  supportOnly: eligibilities.filter((item) => item.supportOnly).length,
  productionAllowed: eligibilities.filter((item) => item.productionAllowed).length,
  formalUsable: eligibilities.filter((item) => item.formalUsable).length,
};

const byRole = eligibilities.reduce<Record<string, number>>((acc, item) => {
  acc[item.recipeRole] = (acc[item.recipeRole] ?? 0) + 1;
  return acc;
}, {});

const manifest = {
  schemaVersion: '1.0.0',
  mapId,
  generatedAt: new Date().toISOString(),
  status: 'recipe_eligibility_mapping_ready_for_router_integration',
  ownerDecisionSource: 'config/foundational-material-complete-v1-owner-decision.json',
  ownerDecision: ownerDecision.ownerDecision,
  productionAllowed: false,
  formalUsablePromotionAllowed: false,
  purpose: 'Translate the complete foundational material baseline into Recipe roles, gain limits, scene fit, foreground/support policy, and routing risks.',
  hardRules: [
    'This map does not promote any item to production.',
    'Finished content and router proof renders are not foundational inputs.',
    'Noise, air, technical tone, and binaural-offset layers are support-only by default.',
    'Sleep and Calm defaults must avoid drums, percussion, beat-forward groove, voice, choir, singing, chanting, and human-like vocal texture.',
    'Medical, healing, brainwave, frequency-effect, and guaranteed-outcome claims remain forbidden.',
  ],
  counts,
  byRole,
  eligibilities,
};

await mkdir(path.join(root, 'config'), { recursive: true });
await mkdir(path.join(root, 'reports'), { recursive: true });
await mkdir(path.join(root, 'public/review/foundational-recipe-eligibility-map-v1'), { recursive: true });
await writeFile(path.join(root, 'config/foundational-recipe-eligibility-map-v1.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(root, 'reports/foundational-recipe-eligibility-map-v1.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const roleRows = Object.entries(byRole).sort(([a], [b]) => a.localeCompare(b)).map(([role, count]) =>
  `| ${role} | ${count} |`).join('\n');
const statusRows = eligibilities.slice(0, 80).map((item) =>
  `| ${item.id} | ${item.recipeRole} | ${item.routeStatus} | ${item.foregroundAllowed ? 'yes' : 'no'} | ${item.supportOnly ? 'yes' : 'no'} | ${item.defaultGainDb ?? '-'} | ${item.riskTags.join(', ') || '-'} |`).join('\n');

const report = `# Foundational Recipe Eligibility Map V1

Generated: ${manifest.generatedAt}

Status: \`${manifest.status}\`

## Verdict

The 103 accepted foundational material items have been translated into Recipe eligibility metadata. This is the bridge from "素材都不错" to "AI can choose the right material safely."

Production remains blocked:

- \`productionAllowed=false\`
- \`formalUsablePromotionAllowed=false\`

## Counts

| Metric | Count |
| --- | ---: |
| Total mappings | ${counts.totalMappings} |
| Atomic audio | ${counts.atomicAudio} |
| Deterministic audio | ${counts.deterministicAudio} |
| DSP configs | ${counts.dspConfigs} |
| Symbolic rules | ${counts.symbolicRules} |
| Foreground allowed | ${counts.foregroundAllowed} |
| Support-only | ${counts.supportOnly} |

## Role coverage

| Recipe role | Count |
| --- | ---: |
${roleRows}

## First 80 mappings

| ID | Role | Route status | Foreground | Support-only | Default gain dB | Risks |
| --- | --- | --- | --- | --- | ---: | --- |
${statusRows}
`;

await writeFile(path.join(root, 'reports/foundational-recipe-eligibility-map-v1.md'), report);

const cards = eligibilities.map((item) => `
  <article class="card ${item.supportOnly ? 'support' : ''}">
    <p class="eyebrow">${escapeHtml(item.sourceKind)} · ${escapeHtml(item.recipeRole)} · ${escapeHtml(item.routeStatus)}</p>
    <h3>${escapeHtml(item.id)}</h3>
    <p>Foreground: ${item.foregroundAllowed ? 'yes' : 'no'} · Support-only: ${item.supportOnly ? 'yes' : 'no'} · Gain: ${item.defaultGainDb ?? '-'} dB (${item.minGainDb ?? '-'} to ${item.maxGainDb ?? '-'})</p>
    <p>Sleep ${item.goalSuitability.sleep} · Calm ${item.goalSuitability.calm} · Focus ${item.goalSuitability.focus}</p>
    <p class="risk">${escapeHtml(item.riskTags.join(', ') || 'no extra risk tags')}</p>
    ${item.audioUrl ? `<audio controls preload="metadata" src="../../${escapeHtml(item.audioUrl.replace(/^\//, ''))}"></audio>` : ''}
    <p>${escapeHtml(item.notes)}</p>
  </article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Recipe Eligibility Map V1</title>
  <style>
    body{margin:0;background:#101210;color:#eef4ed;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{max-width:1240px;margin:0 auto;padding:32px 18px 72px}
    .hero,.card{border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:18px;background:rgba(255,255,255,.045);margin:14px 0}
    .hero{background:linear-gradient(135deg,rgba(139,117,72,.22),rgba(72,99,90,.16))}
    .eyebrow{color:#dec987;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}
    .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .support{background:rgba(80,96,82,.18)}
    .risk{color:#e9c79f}
    audio{width:100%}
    @media(max-width:900px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">MixStil · recipe eligibility</p>
      <h1>Foundational Recipe Eligibility Map V1</h1>
      <p>把已试听通过的基础素材转成 Recipe 可用映射：角色、音量、场景适配、主层/支撑层、风险与硬排除。它不是生产批准。</p>
      <p>Total ${counts.totalMappings}; foreground ${counts.foregroundAllowed}; support-only ${counts.supportOnly}; productionAllowed=false.</p>
    </section>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;

await writeFile(path.join(root, 'public/review/foundational-recipe-eligibility-map-v1/index.html'), html);

console.log(JSON.stringify({
  passed: true,
  mapId,
  status: manifest.status,
  counts,
  productionAllowed: manifest.productionAllowed,
  report: 'reports/foundational-recipe-eligibility-map-v1.md',
  config: 'config/foundational-recipe-eligibility-map-v1.json',
  reviewUrl: '/review/foundational-recipe-eligibility-map-v1/index.html',
}, null, 2));
