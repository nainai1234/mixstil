import { coreStemIds, defaultRecipes, goals, pendingMusicCoreCandidates, scenes } from './contentCatalog';
import { pool, query } from './db';

const fail = (message: string): never => {
  throw new Error(`Content catalog validation failed: ${message}`);
};

const unique = (values: readonly string[], label: string) => {
  if (new Set(values).size !== values.length) fail(`${label} contains duplicate ids.`);
};

unique(coreStemIds, 'coreStemIds');
unique(pendingMusicCoreCandidates, 'pendingMusicCoreCandidates');
unique(defaultRecipes.map((recipe) => recipe.id), 'defaultRecipes');

if (goals.length !== 3) fail(`expected 3 goals, received ${goals.length}.`);
if (scenes.length !== 5) fail(`expected 5 scenes, received ${scenes.length}.`);
if (defaultRecipes.length !== 35) fail(`expected 35 recipes (17 baseline + 18 MusicKits), received ${defaultRecipes.length}.`);

const coreIds = new Set<string>(coreStemIds);
const sceneIds = new Set<string>(scenes.map((scene) => scene.id));
for (const recipe of defaultRecipes) {
  if (recipe.contentMode === 'pure_soundscape' && recipe.tracks.some((track) => track.role === 'music' || track.role === 'accent')) {
    fail(`${recipe.id} pure soundscape contains music or accents.`);
  }
  if (recipe.contentMode === 'functional_music' && !recipe.tracks.some((track) => track.role === 'music')) {
    fail(`${recipe.id} functional music recipe is missing music.`);
  }
  if (recipe.contentMode === 'sound_journey' && recipe.tracks.filter((track) => (track.volumeAutomation?.length ?? 0) >= 3).length < 2) {
    fail(`${recipe.id} sound journey needs at least two automated layers.`);
  }
  for (const dominantRole of Object.values(recipe.mixProfile.phaseBalance)) {
    if (!recipe.tracks.some((track) => track.role === dominantRole)) fail(`${recipe.id} is missing phase role ${dominantRole}.`);
  }
  if (!sceneIds.has(recipe.scene)) fail(`${recipe.id} references unknown scene ${recipe.scene}.`);
  if (recipe.tracks.length < 1) fail(`${recipe.id} must contain at least one track.`);
  for (const recipeTrack of recipe.tracks) {
    if (!coreIds.has(recipeTrack.stemId)) fail(`${recipe.id} references non-core stem ${recipeTrack.stemId}.`);
    if (recipeTrack.volume < 0 || recipeTrack.volume > 100) fail(`${recipe.id} has invalid volume.`);
    for (const point of recipeTrack.volumeAutomation ?? []) {
      if (point.atSeconds < 0 || point.atSeconds > recipe.durationSeconds || point.volume < 0 || point.volume > 100) {
        fail(`${recipe.id} has invalid volume automation for ${recipeTrack.stemId}.`);
      }
    }
    if (recipeTrack.startTime + recipeTrack.duration > recipe.durationSeconds) fail(`${recipe.id} has a track outside its timeline.`);
  }
}

const validateDatabase = async () => {
  const requiredIds = [...coreStemIds, ...pendingMusicCoreCandidates];
  const result = await query<{
    id: string;
    qa_status: string;
    commercial_use_allowed: boolean;
    derivative_use_allowed: boolean;
  }>('select id, qa_status, commercial_use_allowed, derivative_use_allowed from audio_stems where id = any($1)', [requiredIds]);
  const byId = new Map(result.rows.map((stem) => [stem.id, stem]));

  for (const stemId of coreStemIds) {
    const stem = byId.get(stemId);
    if (!stem) throw new Error(`Content catalog validation failed: approved core stem ${stemId} is missing from the database.`);
    if (stem.qa_status !== 'approved' || !stem.commercial_use_allowed || !stem.derivative_use_allowed) {
      fail(`approved core stem ${stemId} does not pass the render gate.`);
    }
  }
  for (const stemId of pendingMusicCoreCandidates) {
    const stem = byId.get(stemId);
    if (!stem) throw new Error(`Content catalog validation failed: pending music candidate ${stemId} is missing from the database.`);
    if (stem.qa_status !== 'needs_review') fail(`pending music candidate ${stemId} must remain needs_review.`);
  }

  console.log(`Validated ${goals.length} goals, ${scenes.length} scenes, ${coreStemIds.length} approved core stems, ${pendingMusicCoreCandidates.length} pending music candidates, and ${defaultRecipes.length} recipes.`);
};

validateDatabase()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
