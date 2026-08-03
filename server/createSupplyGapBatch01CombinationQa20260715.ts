import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildRecipeFilterComplex } from './renderRecipeV2';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeV2Track } from './recipeV2';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';
const outputDir = path.join(root, `public/audio/supply-gap-batch-01-combination-qa/${date}`);
const loopReport = JSON.parse(await readFile(path.join(root, `reports/supply-gap-batch-01-loop-qa-${date}.json`), 'utf8'));
const python = path.join(root, '.venv-audio/bin/python');
const analyzer = path.join(root, 'scripts/analyze-music-candidate.py');
const diversityAnalyzer = path.join(root, 'scripts/analyze-collection-diversity.py');

type Source = {
  stemId: string;
  file: string;
  role: 'base' | 'environment' | 'music';
  volumes: readonly [number, number, number, number, number];
  sourceGainDb?: number;
};

const loopById = new Map<string, any>(loopReport.results.map((item: any) => [item.id, item]));
const sourceJumpBaseline = new Map<string, number>(
  loopReport.results.map((item: any) => [`candidate_${item.id}`, Number(item.analysis.p99_100msRmsJumpDb ?? 0)]),
);
const loopSource = (id: string, role: Source['role'], volumes: Source['volumes']): Source => {
  const item = loopById.get(id);
  if (!item || item.machineStatus !== 'pass') throw new Error(`Missing loop-qualified candidate ${id}`);
  return { stemId: `candidate_${id}`, file: item.loopMasterPath, role, volumes };
};

const focusIds = [
  'procedural_focus_neutral_clean',
  'procedural_focus_warm_mid',
  'procedural_focus_low_anchor',
  'procedural_focus_open_air',
] as const;

const works: Array<{
  id: string;
  title: string;
  scene: string;
  structure: string;
  sources: Source[];
}> = [
  {
    id: 'small_apartment_neutral_focus',
    title: 'Small Apartment + Neutral Focus',
    scene: 'deep_focus',
    structure: 'authentic small-room tone stays audible; neutral focus music enters gradually and remains subordinate',
    sources: [
      loopSource('room_apartment_small', 'environment', [82, 82, 78, 72, 64]),
      loopSource(focusIds[0], 'music', [0, 16, 30, 26, 8]),
    ],
  },
  {
    id: 'bedroom_night_warm_focus',
    title: 'Bedroom Night + Warm Focus',
    scene: 'quiet_reading',
    structure: 'night room tone remains identifiable with a restrained warm midrange focus layer',
    sources: [
      loopSource('room_bedroom_night', 'environment', [84, 82, 78, 72, 62]),
      loopSource(focusIds[1], 'music', [0, 14, 28, 24, 6]),
    ],
  },
  {
    id: 'office_distant_traffic_low_anchor',
    title: 'Office Distant Traffic + Low Anchor',
    scene: 'deep_focus',
    structure: 'distant traffic and office identity remain clear; low anchor music only fills the middle',
    sources: [
      loopSource('room_office_distant_traffic', 'environment', [86, 84, 80, 76, 68]),
      loopSource(focusIds[2], 'music', [0, 14, 26, 22, 6]),
    ],
  },
  {
    id: 'deep_ventilation_open_air',
    title: 'Deep Ventilation + Open Air Focus',
    scene: 'deep_focus',
    structure: 'ventilation remains the stable masking layer; open-air pad stays quiet and non-cinematic',
    sources: [
      loopSource('fan_deep_ventilation', 'environment', [88, 86, 82, 78, 70]),
      loopSource(focusIds[3], 'music', [0, 12, 24, 20, 5]),
    ],
  },
  {
    id: 'mine_ventilation_neutral_focus',
    title: 'Mine Ventilation + Neutral Focus',
    scene: 'deep_focus',
    structure: 'mechanical fan identity remains unmistakable; music never masks its texture',
    sources: [
      loopSource('fan_mine_ventilation', 'environment', [78, 78, 74, 68, 58]),
      loopSource(focusIds[0], 'music', [0, 12, 22, 18, 4]),
    ],
  },
  {
    id: 'train_carriage_warm_focus',
    title: 'Train Carriage + Warm Focus',
    scene: 'deep_focus',
    structure: 'train carriage movement remains identifiable; warm focus music supports without creating drama',
    sources: [
      loopSource('train_taiwan_ep727', 'environment', [82, 82, 78, 72, 64]),
      loopSource(focusIds[1], 'music', [0, 12, 24, 20, 5]),
    ],
  },
  {
    id: 'air_conditioner_1_low_anchor',
    title: 'Air Conditioner 1 + Low Anchor',
    scene: 'deep_focus',
    structure: 'air-conditioner hum remains dominant; low anchor pad stays below attention threshold',
    sources: [
      loopSource('air_conditioner_hum_1', 'environment', [88, 86, 84, 80, 72]),
      loopSource(focusIds[2], 'music', [0, 10, 20, 17, 4]),
    ],
  },
  {
    id: 'air_conditioner_2_open_air',
    title: 'Air Conditioner 2 + Open Air Focus',
    scene: 'deep_focus',
    structure: 'second air-conditioner recording remains distinct; high pad is kept conservative',
    sources: [
      loopSource('air_conditioner_hum_2', 'environment', [88, 86, 84, 80, 72]),
      loopSource(focusIds[3], 'music', [0, 10, 19, 16, 4]),
    ],
  },
  {
    id: 'neutral_focus_soft_pink',
    title: 'Neutral Focus + Soft Pink Noise',
    scene: 'deep_focus',
    structure: 'neutral music is the identity; pink noise remains a quiet masking base',
    sources: [
      { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', role: 'base', sourceGainDb: 0, volumes: [20, 20, 18, 16, 14] },
      loopSource(focusIds[0], 'music', [44, 48, 52, 48, 38]),
    ],
  },
  {
    id: 'warm_focus_soft_brown',
    title: 'Warm Focus + Soft Brown Noise',
    scene: 'deep_focus',
    structure: 'warm mid pad stays musical but unobtrusive; brown noise remains low',
    sources: [
      { stemId: 'stem_internal_brown_soft', file: 'public/audio/noise/internal/brown_soft.mp3', role: 'base', sourceGainDb: 0, volumes: [18, 18, 16, 14, 12] },
      loopSource(focusIds[1], 'music', [42, 47, 51, 47, 36]),
    ],
  },
  {
    id: 'low_anchor_deep_brown',
    title: 'Low Anchor + Deep Brown Noise',
    scene: 'deep_focus',
    structure: 'low tonal anchor remains comfortable without excessive bass pressure',
    sources: [
      { stemId: 'stem_internal_brown_deep', file: 'public/audio/noise/internal/brown_deep.mp3', role: 'base', sourceGainDb: 0, volumes: [14, 14, 13, 12, 10] },
      loopSource(focusIds[2], 'music', [42, 46, 50, 46, 35]),
    ],
  },
  {
    id: 'open_air_balanced_pink',
    title: 'Open Air Focus + Balanced Pink Noise',
    scene: 'deep_focus',
    structure: 'open-air pad stays soft and spacious without bright fatigue or cinematic lift',
    sources: [
      { stemId: 'stem_internal_pink_balanced', file: 'public/audio/noise/internal/pink_balanced.mp3', role: 'base', sourceGainDb: 0, volumes: [16, 16, 15, 13, 11] },
      loopSource(focusIds[3], 'music', [40, 45, 49, 45, 34]),
    ],
  },
];

const timeline = [0, 45, 150, 240, 300] as const;
const probe = (file: string) => {
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate', '-of', 'json', path.join(root, file),
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  const parsed = JSON.parse(result.stdout);
  return { duration: Number(parsed.format.duration), sampleRate: Number(parsed.streams[0].sample_rate) };
};

await mkdir(outputDir, { recursive: true });
const results = [];
for (const work of works) {
  const probed = work.sources.map((source) => ({ source, ...probe(source.file) }));
  const tracks: RecipeV2Track[] = probed.map(({ source, duration }) => ({
    stemId: source.stemId,
    role: source.role,
    volume: source.volumes[0],
    startTime: 0,
    duration: 300,
    trimStart: 0,
    trimEnd: Math.min(300, duration),
    isMuted: false,
    sourceGainDb: source.sourceGainDb ?? 0,
    phaseIds: ['arrival', 'core', 'release'],
    fade: { inSeconds: source.role === 'music' ? 12 : 5, outSeconds: source.role === 'music' ? 16 : 10 },
    loop: { enabled: duration < 300, crossfadeSeconds: duration < 300 ? 2 : 0 },
    volumeAutomation: timeline.map((atSeconds, index) => ({ atSeconds, volume: source.volumes[index] })),
  }));
  const recipe = upgradeRecipeToV2({
    durationSeconds: 300,
    intent: work.scene,
    contentMode: 'functional_music',
    moodTags: ['Voice-free Beta', 'Supply Gap Batch 01', 'Internal QA'],
    tracks,
  }, work.id);
  const errors = validateRecipeV2(recipe);
  if (errors.length) throw new Error(`${work.id}: ${errors.join('; ')}`);
  const renderTracks = recipe.tracks.map((track, index) => ({
    ...track,
    sourceDurationSeconds: probed[index].duration,
    sourceSampleRate: probed[index].sampleRate,
  }));
  const filter = buildRecipeFilterComplex(renderTracks, recipe.durationSeconds, recipe.ducking);
  const output = path.join(outputDir, `${work.id}.mp3`);
  const render = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...work.sources.flatMap((source) => ['-i', path.join(root, source.file)]),
    '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-ac', '2',
    '-codec:a', 'libmp3lame', '-b:a', '256k', output,
  ], { encoding: 'utf8' });
  if (render.status !== 0) throw new Error(`${work.id}: ${render.stderr}`);
  const analyzed = spawnSync(python, [analyzer, output], { encoding: 'utf8' });
  if (analyzed.status !== 0) throw new Error(`${work.id}: ${analyzed.stderr}`);
  const analysis = JSON.parse(analyzed.stdout);
  const maximumSourceJump = Math.max(
    0,
    ...work.sources.map((source) => sourceJumpBaseline.get(source.stemId) ?? 0),
  );
  const abruptChangeLimitDb = Math.max(5.5, maximumSourceJump + 0.5);
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 300) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.integratedLufs < -38 || analysis.integratedLufs > -20 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(analysis.p99_100msRmsJumpDb > abruptChangeLimitDb ? ['abrupt_change_added_by_combination'] : []),
  ];
  results.push({
    ...work,
    recipe,
    previewUrl: `/audio/supply-gap-batch-01-combination-qa/${date}/${work.id}.mp3`,
    analysis,
    abruptChangeLimitDb,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    humanListeningStatus: 'pending',
    promotionAllowed: false,
  });
}

const diversity = spawnSync(python, [diversityAnalyzer, outputDir], { encoding: 'utf8' });
if (diversity.status !== 0) throw new Error(diversity.stderr);
const collectionDiversity = JSON.parse(diversity.stdout);
const report = {
  generatedAt: new Date().toISOString(),
  batchId: 'supply_gap_batch_01',
  combinationCount: results.length,
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  collectionDiversity,
  promotionAllowed: false,
  remainingGates: ['loop_human_listening', 'combination_human_listening', 'final_promotion_review'],
  results,
};
await writeFile(path.join(root, `reports/supply-gap-batch-01-combination-qa-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, `reports/supply-gap-batch-01-combination-qa-${date}.md`), `# Supply Gap Batch 01 Recipe V2 Combination QA

Date: ${date}  
Machine QA: **${report.machinePassCount}/${results.length} passed**.  
Collection diversity: **${collectionDiversity.status}**; maximum correlation ${collectionDiversity.maxSpectralCorrelation}.  
Promotion remains blocked until project-owner combination listening.

| Combination | Scene | LUFS | Peak | Machine | Review |
| --- | --- | ---: | ---: | --- | --- |
${results.map((item) => `| ${item.title} | ${item.scene} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.machineStatus} | [5 分钟试听](http://localhost:5174${item.previewUrl}) |`).join('\n')}
`);
console.log(JSON.stringify({
  combinationCount: results.length,
  machinePassCount: report.machinePassCount,
  collectionDiversity,
  report: `reports/supply-gap-batch-01-combination-qa-${date}.md`,
}, null, 2));
