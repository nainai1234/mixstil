import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildRecipeFilterComplex } from './renderRecipeV2';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeTrackRole, type RecipeV2Track } from './recipeV2';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-14';
const outputDir = path.join(root, `public/audio/music/revised-collection-qa/${date}`);
const python = path.join(root, '.venv-audio/bin/python');
const analyzer = path.join(root, 'scripts/analyze-music-candidate.py');
const diversityAnalyzer = path.join(root, 'scripts/analyze-collection-diversity.py');

type Source = {
  stemId: string;
  file: string;
  role: RecipeTrackRole;
  sourceGainDb: number;
  volumes: [number, number, number, number, number];
};

const works: Array<{
  id: string;
  title: string;
  intent: string;
  contentMode: 'pure_soundscape' | 'functional_music' | 'sound_journey';
  families: string[];
  sources: Source[];
}> = [
  {
    id: 'dry_quiet_room', title: 'Dry Quiet Room', intent: 'bedtime', contentMode: 'pure_soundscape', families: ['room_tone', 'brown_noise'],
    sources: [
      { stemId: 'stem_internal_brown_soft', file: 'public/audio/noise/internal/brown_soft.mp3', role: 'base', sourceGainDb: 8, volumes: [42, 40, 36, 32, 28] },
      { stemId: 'stem_internal_quiet_room', file: 'public/audio/noise/internal/quiet_room.mp3', role: 'environment', sourceGainDb: 13.5, volumes: [100, 96, 92, 86, 78] },
    ],
  },
  {
    id: 'low_fan_night', title: 'Low Fan Night', intent: 'bedtime', contentMode: 'pure_soundscape', families: ['low_fan', 'pink_noise'],
    sources: [
      { stemId: 'stem_internal_fan_low', file: 'public/audio/noise/internal/fan_low.mp3', role: 'base', sourceGainDb: 11.5, volumes: [100, 98, 96, 92, 86] },
      { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', role: 'base', sourceGainDb: 6, volumes: [12, 12, 10, 10, 8] },
    ],
  },
  {
    id: 'warm_music_later', title: 'Warm Music, Later', intent: 'emotional_settling', contentMode: 'sound_journey', families: ['room_tone', 'calm_grounded_pad'],
    sources: [
      { stemId: 'stem_internal_quiet_room', file: 'public/audio/noise/internal/quiet_room.mp3', role: 'base', sourceGainDb: 13.5, volumes: [96, 90, 78, 72, 68] },
      { stemId: 'candidate_procedural_calm_grounded_a', file: `public/audio/music/local-candidates/${date}/procedural_calm_grounded_a.wav`, role: 'music', sourceGainDb: 1, volumes: [0, 18, 52, 38, 8] },
    ],
  },
  {
    id: 'forest_breathing', title: 'Tree Breeze Breathing', intent: 'breathing', contentMode: 'pure_soundscape', families: ['tree_breeze', 'soft_white_noise'],
    sources: [
      { stemId: 'stem_internal_white_soft', file: 'public/audio/noise/internal/white_soft.mp3', role: 'base', sourceGainDb: 5, volumes: [30, 30, 28, 26, 22] },
      { stemId: 'stem_wind', file: 'public/audio/wind.wav', role: 'environment', sourceGainDb: -4, volumes: [46, 54, 60, 52, 38] },
    ],
  },
  {
    id: 'quiet_train_focus', title: 'Quiet Train Focus', intent: 'deep_focus', contentMode: 'pure_soundscape', families: ['train_carriage', 'pink_noise'],
    sources: [
      { stemId: 'stem_internal_train_carriage', file: 'public/audio/noise/internal/train_carriage.mp3', role: 'base', sourceGainDb: 11.5, volumes: [100, 100, 98, 96, 92] },
      { stemId: 'stem_internal_pink_soft', file: 'public/audio/noise/internal/pink_soft.mp3', role: 'base', sourceGainDb: 5, volumes: [8, 8, 8, 6, 6] },
    ],
  },
  {
    id: 'night_insects_distant', title: 'Night Insects at a Distance', intent: 'bedtime', contentMode: 'pure_soundscape', families: ['night_insects', 'brown_noise'],
    sources: [
      { stemId: 'stem_internal_brown_soft', file: 'public/audio/noise/internal/brown_soft.mp3', role: 'base', sourceGainDb: 6, volumes: [30, 30, 26, 24, 20] },
      { stemId: 'stem_mixkit_1789', file: 'public/audio/nature/batch-02/summer_night_crickets.wav', role: 'environment', sourceGainDb: 0, volumes: [38, 50, 58, 48, 30] },
    ],
  },
];

const probe = (file: string) => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate', '-of', 'json', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  const parsed = JSON.parse(result.stdout);
  return { duration: Number(parsed.format.duration), sampleRate: Number(parsed.streams[0].sample_rate) };
};

const automation = (values: Source['volumes']) => [0, 45, 150, 240, 300].map((atSeconds, index) => ({ atSeconds, volume: values[index] }));

await mkdir(outputDir, { recursive: true });
const results = [];
for (const work of works) {
  const recipe = upgradeRecipeToV2({
    durationSeconds: 300,
    intent: work.intent,
    contentMode: work.contentMode,
    moodTags: ['Voice-free Beta', 'Collection Diversity QA', ...work.families],
    tracks: work.sources.map((source): RecipeV2Track => ({
      stemId: source.stemId,
      role: source.role,
      volume: source.volumes[0],
      startTime: 0,
      duration: 300,
      trimStart: 0,
      trimEnd: 300,
      isMuted: false,
      sourceGainDb: source.sourceGainDb,
      phaseIds: ['arrival', 'core', 'release'],
      fade: { inSeconds: source.role === 'music' ? 12 : 5, outSeconds: 10 },
      loop: { enabled: true, crossfadeSeconds: 2 },
      volumeAutomation: automation(source.volumes),
    })),
  }, work.id);
  const errors = validateRecipeV2(recipe);
  if (errors.length) throw new Error(`${work.id}: ${errors.join('; ')}`);
  const sources = work.sources.map((source) => ({ source, ...probe(source.file) }));
  const tracks = recipe.tracks.map((track, index) => ({ ...track, sourceDurationSeconds: sources[index].duration, sourceSampleRate: sources[index].sampleRate }));
  const filter = buildRecipeFilterComplex(tracks, recipe.durationSeconds, recipe.ducking);
  const output = path.join(outputDir, `${work.id}.mp3`);
  const ffmpeg = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...sources.flatMap(({ source }) => ['-i', path.join(root, source.file)]),
    '-filter_complex', filter, '-map', '[out]', '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '256k', output,
  ], { encoding: 'utf8' });
  if (ffmpeg.status !== 0) throw new Error(`${work.id}: ${ffmpeg.stderr}`);
  const analysisResult = spawnSync(python, [analyzer, output], { encoding: 'utf8' });
  if (analysisResult.status !== 0) throw new Error(analysisResult.stderr);
  const analysis = JSON.parse(analysisResult.stdout);
  const failures = [
    ...(analysis.integratedLufs < -34 || analysis.integratedLufs > -22 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(analysis.p99_100msRmsJumpDb > 4 ? ['abrupt_change'] : []),
  ];
  results.push({ ...work, recipe, analysis, machineStatus: failures.length ? 'fail' : 'pass', failures, output: `/audio/music/revised-collection-qa/${date}/${work.id}.mp3`, humanListeningStatus: 'pending' });
  console.log(`${work.title}: ${output}`);
}

const diversityResult = spawnSync(python, [diversityAnalyzer, outputDir], { encoding: 'utf8' });
if (diversityResult.status !== 0) throw new Error(diversityResult.stderr);
const collectionDiversity = JSON.parse(diversityResult.stdout);
const report = {
  generatedAt: new Date().toISOString(),
  promotionAllowed: false,
  collectionStatus: 'rejected_source_semantics',
  rejectionReason: 'The room, fan, train, and wind labels were synthetic colored-noise simulations without authentic scene events.',
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  collectionDiversity,
  results,
};
await writeFile(path.join(root, `reports/revised-foundational-collection-qa-${date}.json`), `${JSON.stringify(report, null, 2)}\n`);
const rows = results.map((item) => `| ${item.title} | ${item.contentMode} | ${item.families.join(' + ')} | ${item.analysis.integratedLufs} | ${item.machineStatus} | [试听](http://localhost:5174${item.output}) |`);
await writeFile(path.join(root, `reports/revised-foundational-collection-qa-${date}.md`), `# Revised Foundational Collection QA\n\nDate: ${date}  \nStatus: **${report.collectionStatus}**.  \nReason: ${report.rejectionReason}\n\n| Work | Mode | Claimed families | LUFS | Machine | Review |\n| --- | --- | --- | ---: | --- | --- |\n${rows.join('\n')}\n\nThis entire set is rejected and must not enter Home, Discover, or the approved pool. Technical validity and differing hashes did not establish authentic scene identity.\n`);
