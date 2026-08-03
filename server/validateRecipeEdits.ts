import { defaultRecipes } from './contentCatalog';
import { applyDeterministicRecipeEdit } from './recipeEdits';
import { createCatalogRecipeV2 } from './recipeV2';

const environmentCatalogRecipe = defaultRecipes.find((item) => item.tracks.some((track) => track.role === 'environment'));
if (!environmentCatalogRecipe) throw new Error('catalog is missing an environment recipe for edit validation');

const recipe = createCatalogRecipeV2({
  recipe: environmentCatalogRecipe,
  tracks: environmentCatalogRecipe.tracks,
  durationSeconds: 600,
  prompt: 'recipe edit validation',
  guidedVoice: true,
});

recipe.tracks.push({
  ...recipe.tracks[0],
  stemId: 'stem_voice_preview_validation',
  role: 'voice',
  volume: 55,
  startTime: 5,
  duration: 20,
  trimStart: 0,
  trimEnd: 20,
  phaseIds: ['arrival', 'core'],
  fade: { inSeconds: 0.4, outSeconds: 1.2 },
  loop: { enabled: false, crossfadeSeconds: 0 },
});

const quieterRain = applyDeterministicRecipeEdit(recipe, '雨声小一点');
const originalBase = recipe.tracks.find((track) => track.role === 'base');
const editedBase = quieterRain.recipe.tracks.find((track) => track.role === 'base');
const originalEnvironment = recipe.tracks.find((track) => track.role === 'environment');
const editedEnvironment = quieterRain.recipe.tracks.find((track) => track.role === 'environment');

if (!originalBase || !editedBase || !originalEnvironment || !editedEnvironment) {
  throw new Error('validation recipe is missing base or environment track');
}
if (editedBase.volume !== originalBase.volume) {
  throw new Error('role-scoped edit changed an unrelated base track');
}
if (editedEnvironment.volume !== Math.max(0, originalEnvironment.volume - 12)) {
  throw new Error('environment quieter edit did not reduce environment volume deterministically');
}
if (quieterRain.edit.changedTrackStemIds.includes(originalBase.stemId)) {
  throw new Error('changedTrackStemIds included an unrelated base track');
}

const mixedEnvironmentRecipe = structuredClone(recipe);
mixedEnvironmentRecipe.tracks.push({
  ...originalEnvironment,
  stemId: 'stem_wind',
  volume: 24,
});
const noWater = applyDeterministicRecipeEdit(mixedEnvironmentRecipe, '去掉水声', {
  approvedEnvironmentStemIds: { rain: originalEnvironment.stemId },
});
const removedWaterTrack = noWater.recipe.tracks.find((track) => track.stemId === originalEnvironment.stemId);
const preservedWindTrack = noWater.recipe.tracks.find((track) => track.stemId === 'stem_wind');
if (!removedWaterTrack?.isMuted || removedWaterTrack.volume !== 0) {
  throw new Error('specific water removal did not mute the water-family track');
}
if (!preservedWindTrack || preservedWindTrack.isMuted || preservedWindTrack.volume !== 24) {
  throw new Error('specific water removal changed an unrelated wind track');
}

const noVoice = applyDeterministicRecipeEdit(recipe, '去掉人声');
const editedVoice = noVoice.recipe.tracks.find((track) => track.role === 'voice');
if (!editedVoice?.isMuted || editedVoice.volume !== 0) {
  throw new Error('remove voice edit did not mute the voice track');
}
if (noVoice.recipe.tracks.filter((track) => track.role !== 'voice').some((track, index) => (
  JSON.stringify(track) !== JSON.stringify(recipe.tracks.filter((candidate) => candidate.role !== 'voice')[index])
))) {
  throw new Error('remove voice edit changed non-voice tracks');
}

const accentRecipe = createCatalogRecipeV2({
  recipe: defaultRecipes.find((item) => item.tracks.some((track) => track.role === 'accent')) ?? defaultRecipes[4],
  tracks: (defaultRecipes.find((item) => item.tracks.some((track) => track.role === 'accent')) ?? defaultRecipes[4]).tracks,
  durationSeconds: 600,
  prompt: 'accent edit validation',
  guidedVoice: false,
});
const lessVariation = applyDeterministicRecipeEdit(accentRecipe, '更稳定，少变化');
if (lessVariation.recipe.events.length !== 0 || lessVariation.recipe.tracks.some((track) => track.role === 'accent' && !track.isMuted)) {
  throw new Error('less variation edit did not remove accent events');
}

const longer = applyDeterministicRecipeEdit(recipe, '延长一点');
if (longer.recipe.durationSeconds !== recipe.durationSeconds + 300) {
  throw new Error('extend edit did not add five minutes deterministically');
}

const slowerVoice = applyDeterministicRecipeEdit(recipe, '人声更慢');
const slowerVoiceTrack = slowerVoice.recipe.tracks.find((track) => track.role === 'voice');
const originalVoiceTrack = recipe.tracks.find((track) => track.role === 'voice');
if (!slowerVoiceTrack || !originalVoiceTrack) {
  throw new Error('voice slower validation recipe is missing a voice track');
}
if (slowerVoice.edit.operation !== 'voice_slower' || slowerVoiceTrack.playbackRate !== 0.9) {
  throw new Error('voice slower edit did not set deterministic playbackRate');
}
if (slowerVoiceTrack.duration <= originalVoiceTrack.duration) {
  throw new Error('voice slower edit did not extend voice output duration');
}
if (slowerVoice.recipe.tracks.some((track) => track.role !== 'voice' && JSON.stringify(track) !== JSON.stringify(recipe.tracks.find((candidate) => candidate.stemId === track.stemId && candidate.role === track.role)))) {
  throw new Error('voice slower edit changed non-voice tracks');
}

const replacedEnvironment = applyDeterministicRecipeEdit(recipe, '把雨声换成海浪', {
  approvedEnvironmentStemIds: { ocean: 'stem_mixkit_ocean_1195' },
});
const replacedTrack = replacedEnvironment.recipe.tracks.find((track) => track.role === 'environment');
const replacedBase = replacedEnvironment.recipe.tracks.find((track) => track.role === 'base');
const originalBaseAfterReplace = recipe.tracks.find((track) => track.role === 'base');
if (replacedEnvironment.edit.operation !== 'replace_environment') {
  throw new Error('environment replacement did not use the replace_environment operation');
}
if (replacedTrack?.stemId !== 'stem_mixkit_ocean_1195') {
  throw new Error('environment replacement did not switch to the approved ocean stem');
}
if (JSON.stringify(replacedBase) !== JSON.stringify(originalBaseAfterReplace)) {
  throw new Error('environment replacement changed an unrelated base track');
}
if (replacedEnvironment.recipe.tracks.find((track) => track.role === 'voice')?.stemId !== 'stem_voice_preview_validation') {
  throw new Error('environment replacement regenerated or changed the voice track');
}

const curveRecipe = structuredClone(recipe);
curveRecipe.tracks.push({
  ...originalBase,
  stemId: 'stem_music_curve_validation',
  role: 'music',
  volume: 60,
  isMuted: false,
  duration: 600,
  trimEnd: 600,
});
const risingMusic = applyDeterministicRecipeEdit(curveRecipe, '音乐慢慢变大');
const risingMusicTrack = risingMusic.recipe.tracks.find((track) => track.stemId === 'stem_music_curve_validation');
if (risingMusic.edit.operation !== 'volume_rise_music' || risingMusicTrack?.volumeAutomation?.length !== 5) {
  throw new Error('music rise edit did not create a five-point volume curve');
}
if (!risingMusicTrack.volumeAutomation.every((point, index, points) => index === 0 || point.volume > points[index - 1].volume)) {
  throw new Error('music rise edit is not monotonically increasing');
}
if (risingMusic.edit.changedTrackStemIds.some((stemId) => stemId !== 'stem_music_curve_validation')) {
  throw new Error('music rise edit changed an unrelated track');
}

const middleDipMusic = applyDeterministicRecipeEdit(curveRecipe, '音乐中间小一点');
const middleDipTrack = middleDipMusic.recipe.tracks.find((track) => track.stemId === 'stem_music_curve_validation');
if (middleDipMusic.edit.operation !== 'volume_dip_music' || !middleDipTrack?.volumeAutomation || middleDipTrack.volumeAutomation[2].volume >= middleDipTrack.volumeAutomation[0].volume) {
  throw new Error('music center dip edit did not lower the middle point');
}

const fallingRain = applyDeterministicRecipeEdit(recipe, '雨声慢慢变小', {
  approvedEnvironmentStemIds: { rain: originalEnvironment.stemId },
});
const fallingRainTrack = fallingRain.recipe.tracks.find((track) => track.stemId === originalEnvironment.stemId);
if (fallingRain.edit.operation !== 'volume_fall_environment' || !fallingRainTrack?.volumeAutomation || fallingRainTrack.volumeAutomation[0].volume <= fallingRainTrack.volumeAutomation.at(-1)!.volume) {
  throw new Error('specific rain fall edit did not create a decreasing curve');
}
if (fallingRain.edit.changedTrackStemIds.some((stemId) => stemId !== originalEnvironment.stemId)) {
  throw new Error('specific rain fall edit changed an unrelated track');
}

const brownOnlyRecipe = structuredClone(recipe);
brownOnlyRecipe.tracks = brownOnlyRecipe.tracks.filter((track) => track.role === 'base');
brownOnlyRecipe.audioIntent = {
  excludedSounds: ['forest', 'water', 'voice', 'music'],
  excludedConceptIds: ['source.natural.forest', 'source.natural.water', 'source.music', 'source.human.voice'],
  preferredConceptIds: ['source.natural.wind'],
  environmentPreferences: ['noise'],
};
const addedForestWind = applyDeterministicRecipeEdit(
  brownOnlyRecipe,
  'Add a quiet dry pine forest wind layer. Keep no water, no music, no voices, and no birds.',
  { approvedEnvironmentStemIds: { forest: 'stem_commons_pine_forest_wind', wind: 'stem_commons_pine_forest_wind' } },
);
const addedForestWindTracks = addedForestWind.recipe.tracks.filter((track) => track.stemId === 'stem_commons_pine_forest_wind');
if (addedForestWind.edit.operation !== 'add_environment' || addedForestWindTracks.length !== 1) {
  throw new Error('environment addition did not add exactly one approved forest-wind layer');
}
if (addedForestWind.recipe.tracks.find((track) => track.role === 'base')?.stemId !== brownOnlyRecipe.tracks[0].stemId) {
  throw new Error('environment addition changed the existing base layer');
}
const addedIntent = addedForestWind.recipe.audioIntent as any;
if (addedIntent.excludedConceptIds.includes('source.natural.forest') || !addedIntent.excludedConceptIds.includes('source.animal.bird')) {
  throw new Error('environment addition did not reconcile the forest request with the bird exclusion');
}
if (!['source.natural.water', 'source.music', 'source.human.voice'].every((concept) => addedIntent.excludedConceptIds.includes(concept))) {
  throw new Error('environment addition did not preserve explicit exclusions');
}

const laterMusic = applyDeterministicRecipeEdit(risingMusic.recipe, '音乐晚一点进入');
const laterMusicTrack = laterMusic.recipe.tracks.find((track) => track.stemId === 'stem_music_curve_validation');
if (laterMusic.edit.operation !== 'start_later_music' || laterMusicTrack?.startTime !== 60 || laterMusicTrack.duration !== 540) {
  throw new Error('music later-entry edit did not shift the track while preserving its end time');
}
if (laterMusicTrack.volumeAutomation?.at(-1)?.atSeconds !== 540) {
  throw new Error('music later-entry edit did not rescale the volume curve to the new duration');
}
if (laterMusic.edit.changedTrackStemIds.some((stemId) => stemId !== 'stem_music_curve_validation')) {
  throw new Error('music later-entry edit changed an unrelated track');
}

const earlierMusic = applyDeterministicRecipeEdit(laterMusic.recipe, '音乐早点进入');
const earlierMusicTrack = earlierMusic.recipe.tracks.find((track) => track.stemId === 'stem_music_curve_validation');
if (earlierMusic.edit.operation !== 'start_earlier_music' || earlierMusicTrack?.startTime !== 0 || earlierMusicTrack.duration !== 600) {
  throw new Error('music earlier-entry edit did not restore the original track window');
}
if (earlierMusicTrack.volumeAutomation?.at(-1)?.atSeconds !== 600) {
  throw new Error('music earlier-entry edit did not restore the curve duration');
}

let unapprovedReplacementFailed = false;
try {
  applyDeterministicRecipeEdit(recipe, '把雨声换成海浪', { approvedEnvironmentStemIds: {} });
} catch {
  unapprovedReplacementFailed = true;
}
if (!unapprovedReplacementFailed) {
  throw new Error('environment replacement should fail when the target stem is not approved');
}

let unsupportedFailed = false;
try {
  applyDeterministicRecipeEdit(recipe, 'make it like a famous song');
} catch {
  unsupportedFailed = true;
}
if (!unsupportedFailed) {
  throw new Error('unsupported edit should fail instead of changing the recipe');
}

console.log('Deterministic recipe edit validation passed.');
