import fs from 'node:fs';
import path from 'node:path';
import { upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';

const root = process.cwd();
const batch = process.env.MUSIC_KIT_BATCH ?? 'music-kit-batch-002';
const manifestPath = path.join(root, 'public/audio/music/local-review', batch, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  kits: Array<{
    id: string;
    version: string;
    profileId: string;
    goal: 'sleep' | 'calm' | 'focus';
    form: string;
    sourceRights: string;
    durationSeconds: number;
    loopCrossfadeSeconds: number;
    stems: Array<{ role: 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition'; defaultVolume: number; publicPath: string }>;
  }>; 
};

const scenes = (goal: 'sleep' | 'calm' | 'focus') => goal === 'sleep'
  ? ['bedtime']
  : goal === 'focus' ? ['deep_focus'] : ['emotional_settling'];
const candidates = manifest.kits.map((kit) => {
  const tracks = kit.stems.map((stem) => ({
    stemId: `${kit.id}__${stem.role}`,
    role: 'music' as const,
    volume: stem.defaultVolume,
    startTime: 0,
    duration: kit.durationSeconds,
    trimStart: 0,
    trimEnd: kit.durationSeconds,
    isMuted: false,
    musicKitId: kit.id,
    musicKitVersion: kit.version,
    musicPart: stem.role,
    audioUrl: stem.publicPath,
    phaseIds: ['arrival', 'core', 'release'],
    fade: { inSeconds: 2, outSeconds: 5 },
    loop: { enabled: true, crossfadeSeconds: kit.loopCrossfadeSeconds },
  }));
  const recipe = upgradeRecipeToV2({
    catalogRecipeId: `candidate-${kit.id}`,
    versionId: `candidate-${kit.id}-${kit.version}`,
    versionState: 'frozen',
    randomSeed: 20260720,
    durationSeconds: kit.durationSeconds,
    intent: scenes(kit.goal)[0],
    moodTags: [kit.goal === 'focus' ? 'Focus' : 'Calm', kit.form, 'MusicKit Candidate'],
    contentMode: 'functional_music',
    tracks,
    phases: [
      { id: 'arrival', role: 'arrival', startTime: 0, duration: 10 },
      { id: 'core', role: 'core', startTime: 10, duration: kit.durationSeconds - 20 },
      { id: 'release', role: 'release', startTime: kit.durationSeconds - 10, duration: 10 },
    ],
    ducking: [],
    events: [],
  });
  const errors = validateRecipeV2(recipe);
  if (errors.length) throw new Error(`${kit.id}: ${errors.join('; ')}`);
  return {
    id: recipe.catalogRecipeId,
    kitId: kit.id,
    kitVersion: kit.version,
    profileId: kit.profileId,
    sourceRights: kit.sourceRights,
    goal: kit.goal,
    sceneCandidates: scenes(kit.goal),
    status: 'candidate_pending_catalog_and_long_session_qa',
    recipe,
  };
});

const output = {
  batch,
  generatedAt: new Date().toISOString(),
  status: 'candidate_only_not_seeded',
  candidates,
};
const target = path.join(root, 'reports', `${batch}-recipe-catalog-candidates.json`);
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`PASS: built ${candidates.length} candidate Recipe V2 catalog entries`);
console.log(target);
