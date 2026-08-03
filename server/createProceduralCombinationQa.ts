import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buildRecipeFilterComplex } from './renderRecipeV2';
import { upgradeRecipeToV2, validateRecipeV2, type RecipeV2Track } from './recipeV2';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'public/audio/music/local-combination-qa/2026-07-13');

const combinations = [
  {
    id: 'night_neutral_quiet_room',
    title: 'Night Neutral + Quiet Room',
    scene: 'bedtime',
    base: { stemId: 'stem_internal_quiet_room', file: 'public/audio/noise/internal/quiet_room.mp3', sourceGainDb: 13.5, volumes: [100, 90, 80, 70] },
    music: { stemId: 'candidate_procedural_night_neutral', file: 'public/audio/music/local-candidates/2026-07-13/procedural_night_neutral_drone.wav', sourceGainDb: 1.5, volumes: [25, 80, 70, 25] },
  },
  {
    id: 'deep_sleep_soft_brown',
    title: 'Deep Sleep Low + Soft Brown Noise',
    scene: 'bedtime',
    base: { stemId: 'stem_internal_brown_soft', file: 'public/audio/noise/internal/brown_soft.mp3', sourceGainDb: 9.5, volumes: [85, 80, 70, 60] },
    music: { stemId: 'candidate_procedural_deep_sleep_low', file: 'public/audio/music/local-candidates/2026-07-13/procedural_deep_sleep_low.wav', sourceGainDb: 1.5, volumes: [25, 75, 65, 20] },
  },
  {
    id: 'return_to_sleep_low_fan',
    title: 'Return to Sleep Soft + Low Fan',
    scene: 'return_to_sleep',
    base: { stemId: 'stem_internal_fan_low', file: 'public/audio/noise/internal/fan_low.mp3', sourceGainDb: 11.5, volumes: [90, 85, 75, 65] },
    music: { stemId: 'candidate_procedural_return_to_sleep_soft', file: 'public/audio/music/local-candidates/2026-07-13/procedural_return_to_sleep_soft.wav', sourceGainDb: 1.5, volumes: [25, 75, 65, 20] },
  },
] as const;

const probe = (file: string) => {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate', '-of', 'json', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  const parsed = JSON.parse(result.stdout);
  return { duration: Number(parsed.format.duration), sampleRate: Number(parsed.streams[0].sample_rate) };
};

const volumeArc = (values: readonly number[]) => [
  { atSeconds: 0, volume: values[0] },
  { atSeconds: 45, volume: values[1] },
  { atSeconds: 240, volume: values[2] },
  { atSeconds: 300, volume: values[3] },
];

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
    fade: { inSeconds: role === 'music' ? 8 : 4, outSeconds: 8 },
    loop: { enabled: true, crossfadeSeconds: 2 },
    volumeAutomation: volumeArc(source.volumes),
  });
  const recipe = upgradeRecipeToV2({
    durationSeconds: 300,
    intent: combination.scene,
    contentMode: 'functional_music',
    moodTags: ['Sleep', 'Procedural', 'Internal QA'],
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
  report.push({ ...combination, recipe, output: `/audio/music/local-combination-qa/2026-07-13/${combination.id}.mp3` });
  console.log(`${combination.title}: ${output}`);
}

await writeFile(path.join(root, 'reports/procedural-combination-recipes-2026-07-13.json'), `${JSON.stringify(report, null, 2)}\n`);
