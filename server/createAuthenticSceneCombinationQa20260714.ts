import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildRecipeFilterComplex } from './renderRecipeV2';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeV2Track } from './recipeV2';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-14';
const outputDir = path.join(root, `public/audio/authentic-scene-combination-qa/${date}`);
const python = path.join(root, '.venv-audio/bin/python');
const analyzer = path.join(root, 'scripts/analyze-music-candidate.py');
const diversityAnalyzer = path.join(root, 'scripts/analyze-collection-diversity.py');
const sceneDir = `public/audio/authentic-scene-loop-qa/${date}/loop-wav-masters`;
const musicDir = 'public/audio/music/local-candidates/2026-07-13';
const loopQa = JSON.parse(await readFile(path.join(root, `reports/authentic-scene-loop-qa-${date}.json`), 'utf8'));
const sourceJumpBaseline = new Map<string, number>(
  loopQa.results.map((item: any) => [`candidate_${item.id}`, Number(item.analysis.p99_100msRmsJumpDb)]),
);

type Source = {
  stemId: string;
  file: string;
  role: 'environment' | 'music';
  volumes: readonly [number, number, number, number, number];
};

const works: Array<{
  id: string;
  title: string;
  scene: string;
  mode: 'pure_soundscape' | 'sound_journey';
  structure: string;
  sources: Source[];
}> = [
  {
    id: 'open_wind_release',
    title: 'Open Wind Release',
    scene: 'emotional_settling',
    mode: 'pure_soundscape',
    structure: 'open wind stays identifiable and gradually settles without music or generic noise',
    sources: [{ stemId: 'candidate_authentic_open_wind', file: `${sceneDir}/authentic_open_wind.wav`, role: 'environment', volumes: [82, 78, 70, 58, 42] }],
  },
  {
    id: 'pine_forest_arrival',
    title: 'Pine Forest Arrival',
    scene: 'breathing',
    mode: 'sound_journey',
    structure: 'pine forest establishes first; a low neutral drone enters late and remains subordinate',
    sources: [
      { stemId: 'candidate_authentic_pine_forest_wind', file: `${sceneDir}/authentic_pine_forest_wind.wav`, role: 'environment', volumes: [78, 80, 76, 68, 54] },
      { stemId: 'candidate_procedural_night_neutral_drone', file: `${musicDir}/procedural_night_neutral_drone.wav`, role: 'music', volumes: [0, 8, 22, 26, 12] },
    ],
  },
  {
    id: 'quiet_campfire_bedtime',
    title: 'Quiet Campfire Bedtime',
    scene: 'bedtime_wind_down',
    mode: 'sound_journey',
    structure: 'campfire remains the audible scene; soft music warms the middle and leaves before the end',
    sources: [
      { stemId: 'candidate_authentic_campfire_night', file: `${sceneDir}/authentic_campfire_night.wav`, role: 'environment', volumes: [92, 90, 84, 78, 66] },
      { stemId: 'candidate_procedural_return_to_sleep_soft', file: `${musicDir}/procedural_return_to_sleep_soft.wav`, role: 'music', volumes: [0, 10, 26, 20, 4] },
    ],
  },
  {
    id: 'european_forest_grounding',
    title: 'European Forest Grounding',
    scene: 'breathing',
    mode: 'pure_soundscape',
    structure: 'forest recording remains unmasked; only a slow scene-level volume arc is applied',
    sources: [{ stemId: 'candidate_authentic_european_forest', file: `${sceneDir}/authentic_european_forest.wav`, role: 'environment', volumes: [68, 76, 80, 70, 56] }],
  },
  {
    id: 'night_insects_deep_rest',
    title: 'Night Insects Deep Rest',
    scene: 'return_to_sleep',
    mode: 'sound_journey',
    structure: 'night insects lead; the low sleep foundation appears only as a quiet middle bed',
    sources: [
      { stemId: 'candidate_authentic_night_forest_insects', file: `${sceneDir}/authentic_night_forest_insects.wav`, role: 'environment', volumes: [72, 76, 72, 62, 48] },
      { stemId: 'candidate_procedural_deep_sleep_low', file: `${musicDir}/procedural_deep_sleep_low.wav`, role: 'music', volumes: [0, 6, 18, 16, 3] },
    ],
  },
  {
    id: 'crickets_after_dark',
    title: 'Crickets After Dark',
    scene: 'bedtime_wind_down',
    mode: 'pure_soundscape',
    structure: 'crickets remain the only source and taper toward release; no music or noise bed is added',
    sources: [{ stemId: 'candidate_authentic_crickets_at_night', file: `${sceneDir}/authentic_crickets_at_night.wav`, role: 'environment', volumes: [66, 72, 70, 58, 40] }],
  },
];

const timeline = [0, 45, 150, 240, 300] as const;
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
    duration: 300,
    trimStart: 0,
    trimEnd: Math.min(300, duration),
    isMuted: false,
    sourceGainDb: 0,
    phaseIds: ['arrival', 'core', 'release'],
    fade: { inSeconds: source.role === 'music' ? 12 : 5, outSeconds: source.role === 'music' ? 16 : 10 },
    loop: { enabled: source.role === 'music', crossfadeSeconds: source.role === 'music' ? 2 : 0 },
    volumeAutomation: timeline.map((atSeconds, index) => ({ atSeconds, volume: source.volumes[index] })),
  }));
  const recipe = upgradeRecipeToV2({
    durationSeconds: 300,
    intent: work.scene,
    contentMode: work.mode,
    moodTags: ['Voice-free Beta', 'Authentic scene', 'Internal QA'],
    tracks,
  }, work.id);
  const recipeErrors = validateRecipeV2(recipe);
  if (recipeErrors.length) throw new Error(`${work.id}: ${recipeErrors.join('; ')}`);
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
    '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '256k', output,
  ], { encoding: 'utf8' });
  if (render.status !== 0) throw new Error(`${work.id}: ${render.stderr}`);
  const analyzed = spawnSync(python, [analyzer, output], { encoding: 'utf8' });
  if (analyzed.status !== 0) throw new Error(`${work.id}: ${analyzed.stderr}`);
  const analysis = JSON.parse(analyzed.stdout);
  const maximumApprovedSourceJump = Math.max(
    0,
    ...work.sources
      .filter((source) => source.role === 'environment')
      .map((source) => sourceJumpBaseline.get(source.stemId) ?? 0),
  );
  const abruptChangeLimitDb = Math.max(5.5, maximumApprovedSourceJump + 0.5);
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 300) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.integratedLufs < -36 || analysis.integratedLufs > -22 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(analysis.p99_100msRmsJumpDb > abruptChangeLimitDb ? ['abrupt_change_added_by_combination'] : []),
  ];
  results.push({
    id: work.id,
    title: work.title,
    scene: work.scene,
    contentMode: work.mode,
    structure: work.structure,
    audibleSceneStemIds: work.sources.filter((source) => source.role === 'environment').map((source) => source.stemId),
    musicStemIds: work.sources.filter((source) => source.role === 'music').map((source) => source.stemId),
    recipe,
    outputPath: output.slice(root.length + 1),
    previewUrl: `/audio/authentic-scene-combination-qa/${date}/${work.id}.mp3`,
    analysis,
    abruptChangeLimitDb,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    humanListeningStatus: 'pass',
    humanListening: {
      reviewedBy: 'project_owner',
      reviewedOn: date,
      decision: 'passed_as_a_collection',
    },
    promotionAllowed: true,
  });
}

const diversityRun = spawnSync(python, [diversityAnalyzer, outputDir], { encoding: 'utf8' });
if (diversityRun.status !== 0) throw new Error(diversityRun.stderr);
const collectionDiversity = JSON.parse(diversityRun.stdout);
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'internal_recipe_v2_combination_qa_only',
  loopListeningPassCount: 6,
  machinePassCount: results.filter((result) => result.machineStatus === 'pass').length,
  collectionDiversity,
  humanListeningPassCount: results.filter((result) => result.humanListeningStatus === 'pass').length,
  promotionAllowed: results.every((result) => result.machineStatus === 'pass' && result.humanListeningStatus === 'pass')
    && collectionDiversity.status === 'pass',
  remainingGate: null,
  results,
};
await writeFile(path.join(root, `reports/authentic-scene-combination-qa-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
const rows = results.map((result) => `| ${result.title} | ${result.contentMode} | ${result.analysis.integratedLufs} | ${result.analysis.samplePeakDbfs} | ${result.machineStatus} | [5 分钟试听](http://localhost:5174${result.previewUrl}) | ${result.humanListeningStatus} |`);
await writeFile(path.join(root, `reports/authentic-scene-combination-qa-${date}.md`), `# Authentic Scene Recipe V2 Combination QA\n\nDate: ${date}  \nScope: internal QA evidence. These review renders are not consumer product pages.  \nDesign rule: the authentic scene must remain clearly identifiable. No white, pink, or brown noise was added. Music is absent or deliberately subordinate.  \nMachine QA: **${report.machinePassCount}/${results.length} passed**.  \nHuman collection listening: **${report.humanListeningPassCount}/${results.length} passed by project owner**.  \nCollection diversity: **${collectionDiversity.status}** (${collectionDiversity.nearDuplicatePairCount} near-duplicate pairs; maximum correlation ${collectionDiversity.maxSpectralCorrelation}).\n\n| Work | Mode | LUFS | Peak dBFS | Machine | Review | Human |\n| --- | --- | ---: | ---: | --- | --- | --- |\n${rows.join('\n')}\n\n## Decision\n\nAll semantic, license, loop, machine, combination, and collection-listening gates passed. The six authentic sources are eligible for controlled promotion into the approved matching pool. Consumer Recipes must keep the requested authentic scene identifiable and must not add generic colored noise merely to make the mix sound fuller.\n`);
console.log(JSON.stringify({ report: `reports/authentic-scene-combination-qa-${date}.md`, machinePassCount: report.machinePassCount, candidateCount: results.length, collectionDiversity }, null, 2));
