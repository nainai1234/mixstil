import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildRecipeFilterComplex } from './renderRecipeV2';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeV2Track } from './recipeV2';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';
const outputDir = path.join(root, `public/audio/supply-gap-batch-02-combination-qa/${date}`);
const loopReport = JSON.parse(await readFile(path.join(root, `reports/supply-gap-batch-02-loop-qa-${date}.json`), 'utf8'));
const python = path.join(root, '.venv-audio/bin/python');
const analyzer = path.join(root, 'scripts/analyze-music-candidate.py');
const dropoutAnalyzer = path.join(root, 'scripts/analyze-loop-seams.py');

type Source = {
  stemId: string;
  file: string;
  role: 'base' | 'environment';
  volumes: readonly [number, number, number, number, number];
};

const loopById = new Map<string, any>(loopReport.results.map((item: any) => [item.id, item]));
const sourceJumpBaseline = new Map<string, number>(
  loopReport.results.map((item: any) => [`candidate_${item.id}`, Number(item.analysis.p99_100msRmsJumpDb ?? 0)]),
);
const loopSource = (id: string, volumes: Source['volumes']): Source => {
  const item = loopById.get(id);
  if (!item || item.machineStatus !== 'pass') throw new Error(`Missing loop-qualified candidate ${id}`);
  return { stemId: `candidate_${id}`, file: item.loopMasterPath, role: 'environment', volumes };
};

const works: Array<{ id: string; title: string; scene: string; structure: string; sources: Source[] }> = [
  {
    id: 'aircraft_steady_jet_soft_pink',
    title: 'Steady Jet Cabin + Soft Pink Masking',
    scene: 'focus_distraction_masking',
    structure: 'aircraft cabin remains dominant; soft pink noise fills gaps below the attention threshold',
    sources: [
      loopSource('aircraft_cabin_csnmedia_381174', [84, 84, 82, 80, 76]),
      { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', role: 'base', volumes: [12, 14, 16, 15, 12] },
    ],
  },
  {
    id: 'airbus_a330_soft_pink',
    title: 'Airbus A330 Cabin + Soft Pink Masking',
    scene: 'focus_distraction_masking',
    structure: 'A330 cabin texture remains clear; soft pink noise provides restrained broadband masking',
    sources: [
      loopSource('airbus_a330_cabin_fillsoko_456092', [86, 86, 84, 82, 78]),
      { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', role: 'base', volumes: [10, 12, 15, 14, 10] },
    ],
  },
  {
    id: 'train_all_night_soft_brown',
    title: 'Taiwan Rail Car + Soft Brown Masking',
    scene: 'sleep_all_night_masking',
    structure: 'low-stimulation rail movement remains recognizable; soft brown noise gently stabilizes the bed for all-night use',
    sources: [
      loopSource('train_taiwan_all_night_variant', [82, 82, 80, 76, 70]),
      { stemId: 'stem_internal_brown_soft', file: 'public/audio/noise/internal/brown_soft.mp3', role: 'base', volumes: [10, 12, 14, 13, 9] },
    ],
  },
];

const timeline = [0, 90, 300, 510, 600] as const;
const probe = (file: string) => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate', '-of', 'json', path.join(root, file)], { encoding: 'utf8' });
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
    duration: 600,
    trimStart: 0,
    trimEnd: Math.min(600, duration),
    isMuted: false,
    sourceGainDb: 0,
    phaseIds: ['arrival', 'core', 'release'],
    fade: { inSeconds: source.role === 'environment' ? 5 : 12, outSeconds: source.role === 'environment' ? 10 : 18 },
    loop: { enabled: duration < 600, crossfadeSeconds: duration < 600 ? 2 : 0 },
    volumeAutomation: timeline.map((atSeconds, index) => ({ atSeconds, volume: source.volumes[index] })),
  }));
  const recipe = upgradeRecipeToV2({
    durationSeconds: 600,
    intent: work.scene,
    contentMode: 'soundscape',
    moodTags: ['Voice-free Beta', 'Supply Gap Batch 02', 'Internal QA'],
    tracks,
  }, work.id);
  const errors = validateRecipeV2(recipe);
  if (errors.length) throw new Error(`${work.id}: ${errors.join('; ')}`);
  const renderTracks = recipe.tracks.map((track, index) => ({ ...track, sourceDurationSeconds: probed[index].duration, sourceSampleRate: probed[index].sampleRate }));
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
  const dropoutCheck = spawnSync(python, [
    dropoutAnalyzer, output, '--source-duration', '601', '--crossfade', '0',
  ], { encoding: 'utf8' });
  if (dropoutCheck.status !== 0) throw new Error(`${work.id}: ${dropoutCheck.stderr}`);
  const dropoutAnalysis = JSON.parse(dropoutCheck.stdout);
  const maximumSourceJump = Math.max(0, ...work.sources.map((source) => sourceJumpBaseline.get(source.stemId) ?? 0));
  const abruptChangeLimitDb = Math.max(5.5, maximumSourceJump + 0.5);
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 600) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.integratedLufs < -38 || analysis.integratedLufs > -20 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(dropoutAnalysis.digitalSilence100msFrames > 0 ? ['digital_dropout'] : []),
    ...(analysis.p99_100msRmsJumpDb > abruptChangeLimitDb ? ['abrupt_change_added_by_combination'] : []),
  ];
  results.push({
    ...work,
    recipe,
    previewUrl: `/audio/supply-gap-batch-02-combination-qa/${date}/${work.id}.mp3`,
    analysis,
    dropoutAnalysis,
    abruptChangeLimitDb,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    humanListeningStatus: 'pending',
    promotionAllowed: false,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  batchId: 'supply_gap_batch_02',
  combinationCount: results.length,
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  promotionAllowed: false,
  remainingGates: ['source_human_listening', 'no_human_voice_hard_gate', 'loop_human_listening', 'combination_human_listening', 'final_promotion_review'],
  results,
};
await writeFile(path.join(root, `reports/supply-gap-batch-02-combination-qa-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, `reports/supply-gap-batch-02-combination-qa-${date}.md`), `# Supply Gap Batch 02 Recipe V2 Combination QA

Date: ${date}  
Machine QA: **${report.machinePassCount}/${results.length} passed**.  
Promotion remains blocked until project-owner source, loop, and combination listening.

| Combination | Scene | LUFS | Peak | Machine | Review |
| --- | --- | ---: | ---: | --- | --- |
${results.map((item) => `| ${item.title} | ${item.scene} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.machineStatus} | [10 分钟试听](http://localhost:5174${item.previewUrl}) |`).join('\n')}
`);
console.log(JSON.stringify({ combinationCount: results.length, machinePassCount: report.machinePassCount, report: `reports/supply-gap-batch-02-combination-qa-${date}.md` }, null, 2));
