import { buildFoundationalCompositionBundle } from './foundationalCompositionRouterV1';

const fail = (message: string): never => { throw new Error(`Foundational composition router validation failed: ${message}`); };

const cases = [
  {
    id: 'sleep-piano-explicit',
    prompt: '睡前需要温暖、低变化、没有人声的声音，稍微有一点柔和钢琴感，不要鼓点。',
    goal: 'sleep' as const,
    scene: 'bedtime' as const,
    excludedSounds: ['voice', 'drums'],
    expectedInstrumentHint: 'piano',
  },
  {
    id: 'sleep-warm-no-voice',
    prompt: '睡前需要温暖、低变化、没有人声的声音，稍微有一点柔和音乐感。',
    goal: 'sleep' as const,
    scene: 'bedtime' as const,
    excludedSounds: ['voice'],
  },
  {
    id: 'calm-meditation-guitar',
    prompt: '十分钟冥想，想要一点柔和吉他质感，不能有人声，也不要突然变化。',
    goal: 'calm' as const,
    scene: 'breathing' as const,
    excludedSounds: ['voice'],
    expectedInstrumentHint: 'guitar',
  },
  {
    id: 'focus-rhodes-low-distraction',
    prompt: '白天深度工作，需要低干扰的 Rhodes 专注背景，没有人声，不要自然声抢注意力。',
    goal: 'focus' as const,
    scene: 'deep_focus' as const,
    excludedSounds: ['voice', 'natural'],
    expectedInstrumentHint: 'electric_piano',
    forbiddenIds: ['distant_ocean_wash', 'gentle_rain_canopy', 'night_forest_hush', 'quiet_fireplace_embers', 'soft_pine_wind'],
  },
  {
    id: 'sleep-no-music-no-water-no-road',
    prompt: '只要深一点的安静底层和柔和遮蔽，不要音乐、不要人声、不要鼓点、不要水声、不要公路感。',
    goal: 'sleep' as const,
    scene: 'bedtime' as const,
    excludedSounds: ['voice', 'music', 'water', 'road'],
    expectedMode: 'support_only',
    forbiddenIds: ['distant_ocean_wash', 'gentle_rain_canopy', 'steady_room_ventilation', 'open_fifth_harmonic_bed'],
  },
] as const;

const requiredBundleFields = [
  'instrumentSource',
  'compositionPlan',
  'harmony',
  'motif',
  'padDrone',
  'environmentBed',
  'organicTexture',
  'accentOneShot',
  'deterministicAcousticConfig',
] as const;

const bundleFingerprints = new Set<string>();
for (const item of cases) {
  const bundle = buildFoundationalCompositionBundle({
    prompt: item.prompt,
    goal: item.goal,
    scene: item.scene,
    excludedSounds: [...item.excludedSounds],
    selectionKey: item.id,
  });
  if (bundle.version !== 'composer_bundle_plan_v1') fail(`${item.id}: bundle plan version changed`);
  if (bundle.goal !== item.goal || bundle.scene !== item.scene) fail(`${item.id}: goal or scene changed`);
  if (bundle.runtimeExternalApiUsed !== false) fail(`${item.id}: runtime external API was used`);
  if (bundle.rationale.length < 4) fail(`${item.id}: rationale is not explanatory enough`);
  if (bundle.selectedMaterials.length < 4) fail(`${item.id}: selected material explanations are missing`);
  for (const field of requiredBundleFields) {
    const value = bundle.bundle[field];
    if (field === 'instrumentSource' || field === 'compositionPlan' || field === 'harmony' || field === 'motif') {
      if (bundle.mode === 'music_supported' && !value) fail(`${item.id}: missing ${field}`);
      if (bundle.mode === 'support_only' && value) fail(`${item.id}: support-only bundle still selected ${field}`);
    } else if (field === 'padDrone') {
      if (bundle.mode === 'music_supported' && !value) fail(`${item.id}: missing ${field}`);
      if (bundle.mode === 'support_only' && value) fail(`${item.id}: support-only bundle still selected pad/drone`);
    } else if (!value) {
      fail(`${item.id}: missing ${field}`);
    }
  }
  if ('expectedMode' in item && item.expectedMode && bundle.mode !== item.expectedMode) fail(`${item.id}: expected ${item.expectedMode}, received ${bundle.mode}`);
  if (bundle.bundle.instrumentSource && bundle.bundle.instrumentSource.status !== 'formal_candidate') fail(`${item.id}: instrument source is not a formal candidate`);
  if ('expectedInstrumentHint' in item && item.expectedInstrumentHint) {
    const instrumentType = bundle.bundle.instrumentSource?.instrumentType;
    const matchesExpected = item.expectedInstrumentHint === 'piano'
      ? instrumentType === 'piano'
      : instrumentType?.includes(item.expectedInstrumentHint);
    if (!matchesExpected) fail(`${item.id}: expected ${item.expectedInstrumentHint}, received ${instrumentType}`);
  }
  if (bundle.mode === 'music_supported' && bundle.bundle.compositionPlan) {
    if (bundle.bundle.harmony?.id !== bundle.bundle.compositionPlan.harmonyId) {
      fail(`${item.id}: harmony ${bundle.bundle.harmony?.id} does not match composition plan ${bundle.bundle.compositionPlan.id}`);
    }
    if (bundle.bundle.motif?.id !== bundle.bundle.compositionPlan.motifId) {
      fail(`${item.id}: motif ${bundle.bundle.motif?.id} does not match composition plan ${bundle.bundle.compositionPlan.id}`);
    }
  }
  if (bundle.bundle.padDrone && !bundle.bundle.padDrone.includes('pad') && !bundle.bundle.padDrone.includes('harmonic_bed')) fail(`${item.id}: pad/drone identity is unclear`);
  if (bundle.bundle.environmentBed === bundle.bundle.organicTexture) fail(`${item.id}: environment and texture collapsed into one element`);
  if ('forbiddenIds' in item && item.forbiddenIds) {
    const selectedText = JSON.stringify(bundle.bundle);
    for (const forbiddenId of item.forbiddenIds) {
      if (selectedText.includes(forbiddenId)) fail(`${item.id}: selected forbidden material ${forbiddenId}`);
    }
  }
  bundleFingerprints.add([
    bundle.mode,
    bundle.bundle.instrumentSource?.id ?? 'none',
    bundle.bundle.compositionPlan?.id ?? 'none',
    bundle.bundle.harmony?.id ?? 'none',
    bundle.bundle.motif?.id ?? 'none',
    bundle.bundle.padDrone,
    bundle.bundle.environmentBed,
    bundle.bundle.organicTexture,
    bundle.bundle.accentOneShot,
    bundle.bundle.deterministicAcousticConfig,
  ].join('|'));
}

if (bundleFingerprints.size !== cases.length) fail('Sleep, Calm, Focus, and support-only cases collapsed to duplicate foundational bundles');

const variants = new Set<string>();
for (let index = 0; index < 12; index += 1) {
  const bundle = buildFoundationalCompositionBundle({
    prompt: '我需要一个温暖、低变化、没有人声的睡前背景。',
    goal: 'sleep',
    scene: 'bedtime',
    excludedSounds: ['voice'],
    selectionKey: `variant-${index}`,
  });
  variants.add([
    bundle.bundle.compositionPlan?.id ?? 'none',
    bundle.bundle.harmony?.id ?? 'none',
    bundle.bundle.motif?.id ?? 'none',
    bundle.bundle.environmentBed,
    bundle.bundle.organicTexture,
    bundle.bundle.accentOneShot,
  ].join('|'));
}
if (variants.size < 3) fail(`equivalent sleep requests produced only ${variants.size} distinct bundles`);

const noMusic = buildFoundationalCompositionBundle({
  prompt: '只要雨声，不要音乐。',
  goal: 'sleep',
  scene: 'bedtime',
  excludedSounds: ['music'],
  selectionKey: 'no-music',
});
if (noMusic.mode !== 'support_only') fail('music-excluded request did not become support-only');
if (noMusic.bundle.instrumentSource || noMusic.bundle.harmony || noMusic.bundle.motif || noMusic.bundle.compositionPlan) fail('music-excluded request still selected music composition materials');

const focusMasking = buildFoundationalCompositionBundle({
  prompt: '我要专注工作，只要稳定遮蔽和低干扰质感，不要旋律、不要人声、不要水声。',
  goal: 'focus',
  scene: 'deep_focus',
  excludedSounds: ['voice', 'melody', 'water'],
  selectionKey: 'focus-masking-no-melody',
});
if (focusMasking.mode !== 'support_only') fail('focus masking/no melody request did not become support-only');
if (focusMasking.bundle.environmentBed !== 'env_procedural_soft_airflow_bed_v1') {
  fail(`focus masking should prefer procedural airflow, received ${focusMasking.bundle.environmentBed}`);
}

console.log(JSON.stringify({
  passed: true,
  cases: cases.length,
  distinctGoalBundles: bundleFingerprints.size,
  sleepVariantBundles: variants.size,
  runtimeExternalApiUsed: false,
}, null, 2));
