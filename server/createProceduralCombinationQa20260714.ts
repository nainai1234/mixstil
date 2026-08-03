import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildRecipeFilterComplex } from './renderRecipeV2';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeV2Track } from './recipeV2';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-14';
const outputDir = path.join(root, `public/audio/music/local-combination-qa/${date}`);
const python = path.join(root, '.venv-audio/bin/python');
const analyzer = path.join(root, 'scripts/analyze-music-candidate.py');
const diversityAnalyzer = path.join(root, 'scripts/analyze-collection-diversity.py');

const combinations = [
  {
    id: 'calm_grounded_a_quiet_room', title: 'Calm Grounded A + Quiet Room', scene: 'emotional_settling',
    base: { stemId: 'stem_internal_quiet_room', file: 'public/audio/noise/internal/quiet_room.mp3', sourceGainDb: 13.5, volumes: [100, 94, 88, 82, 76] },
    music: { stemId: 'candidate_procedural_calm_grounded_a', file: `public/audio/music/local-candidates/${date}/procedural_calm_grounded_a.wav`, sourceGainDb: 1, volumes: [10, 32, 52, 42, 18] },
  },
  {
    id: 'calm_grounded_b_soft_pink', title: 'Calm Grounded B + Soft Pink Noise', scene: 'breathing',
    base: { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', sourceGainDb: 9.5, volumes: [96, 92, 86, 80, 74] },
    music: { stemId: 'candidate_procedural_calm_grounded_b', file: `public/audio/music/local-candidates/${date}/procedural_calm_grounded_b.wav`, sourceGainDb: 1, volumes: [10, 30, 50, 40, 16] },
  },
  {
    id: 'meditation_open_a_quiet_room', title: 'Meditation Open A + Quiet Room', scene: 'breathing',
    base: { stemId: 'stem_internal_quiet_room', file: 'public/audio/noise/internal/quiet_room.mp3', sourceGainDb: 13.5, volumes: [100, 94, 86, 80, 74] },
    music: { stemId: 'candidate_procedural_meditation_open_a', file: `public/audio/music/local-candidates/${date}/procedural_meditation_open_a.wav`, sourceGainDb: 1, volumes: [8, 28, 48, 38, 14] },
  },
  {
    id: 'meditation_open_b_soft_pink', title: 'Meditation Open B + Soft Pink Noise', scene: 'breathing',
    base: { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', sourceGainDb: 9.5, volumes: [96, 91, 85, 79, 72] },
    music: { stemId: 'candidate_procedural_meditation_open_b', file: `public/audio/music/local-candidates/${date}/procedural_meditation_open_b.wav`, sourceGainDb: 1, volumes: [8, 26, 46, 36, 12] },
  },
  {
    id: 'focus_neutral_a_train', title: 'Focus Neutral A + Quiet Train', scene: 'deep_focus',
    base: { stemId: 'stem_internal_train_carriage', file: 'public/audio/noise/internal/train_carriage.mp3', sourceGainDb: 11.5, volumes: [96, 92, 88, 84, 80] },
    music: { stemId: 'candidate_procedural_focus_neutral_a', file: `public/audio/music/local-candidates/${date}/procedural_focus_neutral_a.wav`, sourceGainDb: 0, volumes: [12, 34, 56, 50, 24] },
  },
  {
    id: 'focus_neutral_b_low_fan', title: 'Focus Neutral B + Low Fan', scene: 'deep_focus',
    base: { stemId: 'stem_internal_fan_low', file: 'public/audio/noise/internal/fan_low.mp3', sourceGainDb: 11.5, volumes: [96, 92, 88, 84, 80] },
    music: { stemId: 'candidate_procedural_focus_neutral_b', file: `public/audio/music/local-candidates/${date}/procedural_focus_neutral_b.wav`, sourceGainDb: 0, volumes: [12, 34, 56, 50, 24] },
  },
] as const;

const probe = (file: string) => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate', '-of', 'json', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  const parsed = JSON.parse(result.stdout);
  return { duration: Number(parsed.format.duration), sampleRate: Number(parsed.streams[0].sample_rate) };
};

const automation = (values: readonly number[]) => [0, 45, 150, 240, 300].map((atSeconds, index) => ({ atSeconds, volume: values[index] }));

await mkdir(outputDir, { recursive: true });
const report = [];
for (const combination of combinations) {
  const makeTrack = (source: typeof combination.base | typeof combination.music, role: 'base' | 'music'): RecipeV2Track => ({
    stemId: source.stemId,
    role,
    volume: source.volumes[0],
    startTime: 0,
    duration: 300,
    trimStart: 0,
    trimEnd: 300,
    isMuted: false,
    sourceGainDb: source.sourceGainDb,
    phaseIds: ['arrival', 'core', 'release'],
    fade: { inSeconds: role === 'music' ? 10 : 4, outSeconds: 10 },
    loop: { enabled: true, crossfadeSeconds: 2 },
    volumeAutomation: automation(source.volumes),
  });
  const recipe = upgradeRecipeToV2({
    durationSeconds: 300,
    intent: combination.scene,
    contentMode: 'functional_music',
    moodTags: ['Voice-free Beta', 'Procedural', 'Internal QA'],
    tracks: [makeTrack(combination.base, 'base'), makeTrack(combination.music, 'music')],
  }, combination.id);
  const errors = validateRecipeV2(recipe);
  if (errors.length) throw new Error(`${combination.id}: ${errors.join('; ')}`);
  const sources = [combination.base, combination.music].map((source) => ({ source, ...probe(source.file) }));
  const tracks = recipe.tracks.map((track, index) => ({
    ...track,
    sourceDurationSeconds: sources[index].duration,
    sourceSampleRate: sources[index].sampleRate,
  }));
  const filter = buildRecipeFilterComplex(tracks, recipe.durationSeconds, recipe.ducking);
  const output = path.join(outputDir, `${combination.id}.mp3`);
  const ffmpeg = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...sources.flatMap(({ source }) => ['-i', path.join(root, source.file)]),
    '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '256k', output,
  ], { encoding: 'utf8' });
  if (ffmpeg.status !== 0) throw new Error(`${combination.id}: ${ffmpeg.stderr}`);
  const analysisResult = spawnSync(python, [analyzer, output], { encoding: 'utf8' });
  if (analysisResult.status !== 0) throw new Error(`${combination.id}: ${analysisResult.stderr}`);
  const analysis = JSON.parse(analysisResult.stdout);
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 300) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.integratedLufs < -34 || analysis.integratedLufs > -22 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(analysis.p99_100msRmsJumpDb > 3 ? ['abrupt_change'] : []),
  ];
  report.push({
    ...combination,
    recipe,
    output: `/audio/music/local-combination-qa/${date}/${combination.id}.mp3`,
    analysis,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    humanListeningStatus: 'pending',
  });
  console.log(`${combination.title}: ${output}`);
}

const diversityResult = spawnSync(python, [diversityAnalyzer, outputDir], { encoding: 'utf8' });
if (diversityResult.status !== 0) throw new Error(diversityResult.stderr);
const collectionDiversity = JSON.parse(diversityResult.stdout);
const reportDocument = {
  generatedAt: new Date().toISOString(),
  promotionAllowed: false,
  candidateStatus: 'candidate',
  machinePassCount: report.filter((item) => item.machineStatus === 'pass').length,
  collectionDiversity,
  remainingGate: collectionDiversity.status === 'pass' ? 'combination_human_listening' : 'redesign_collection',
  combinations: report,
};
await writeFile(path.join(root, `reports/procedural-combination-recipes-${date}.json`), `${JSON.stringify(reportDocument, null, 2)}\n`);

const loopReport = JSON.parse(await readFile(path.join(root, `reports/local-procedural-content-post-listening-qa-${date}.json`), 'utf8'));
const loopRows = loopReport.results.map((item: any) =>
  `| ${item.id} | ${item.loop.analysis.integratedLufs} | ${item.loop.analysis.samplePeakDbfs} | ${item.loop.machineStatus} | [10 分钟试听](http://localhost:5174${item.loop.previewUrl}) | pending |`);
const combinationRows = report.map((item) =>
  `| ${item.title} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.machineStatus} | [5 分钟试听](http://localhost:5174${item.output}) | pending |`);
await writeFile(path.join(root, `reports/local-procedural-content-listening-review-${date}.md`), `# Local Procedural Content Listening Review\n\nDate: ${date}  \nScope: internal QA only; these candidates are not in the consumer product or approved asset pool.  \nBasic 60-second listening: 6/6 passed by project owner.  \nCollection diversity: **${collectionDiversity.status}** (${collectionDiversity.nearDuplicatePairCount} near-duplicate pairs; max correlation ${collectionDiversity.maxSpectralCorrelation}).\n\n## 10-minute loop gate\n\n| Candidate | LUFS | Peak dBFS | Machine | Review | Human |\n| --- | ---: | ---: | --- | --- | --- |\n${loopRows.join('\n')}\n\nListen for audible seams, periodic volume dips, fatigue, fright, pulse, or tonal pressure.\n\n## Recipe V2 combination gate\n\n| Combination | LUFS | Peak dBFS | Machine | Review | Human |\n| --- | ---: | ---: | --- | --- | --- |\n${combinationRows.join('\n')}\n\n## Collection decision\n\nStatus: **rejected as a release collection**. The individual candidates remain candidates, but this set cannot populate Home or Discover because its spectral families and Recipe structures are too similar. A/B variants must be treated as within-family alternatives rather than separate works.\n`);
