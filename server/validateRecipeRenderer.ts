import { defaultRecipes } from './contentCatalog';
import { createCatalogRecipeV2 } from './recipeV2';
import { buildRecipeFilterComplex, getDuckingIntervalsForTrack, planRecipeRenderTracks, resolveTrimmedSourceDuration } from './renderRecipeV2';

if (resolveTrimmedSourceDuration(241.032, 1.2, 238.7) !== 237.5) {
  throw new Error('source trim validation: trimEnd is not applied to the loop source duration');
}
if (resolveTrimmedSourceDuration(90, 5, 900) !== 85) {
  throw new Error('source trim validation: trimEnd must be capped by the physical source duration');
}

for (const catalogRecipe of defaultRecipes) {
  const recipe = createCatalogRecipeV2({
    recipe: catalogRecipe,
    tracks: catalogRecipe.tracks,
    durationSeconds: catalogRecipe.durationSeconds,
    prompt: 'renderer validation',
    guidedVoice: false,
  });
  const tracks = planRecipeRenderTracks(recipe);
  const filter = buildRecipeFilterComplex(tracks, recipe.durationSeconds);
  const accentTrackCount = tracks.filter((track) => track.role === 'accent').length;
  if (accentTrackCount !== recipe.events.length) {
    throw new Error(`${catalogRecipe.id}: accent events were duplicated or dropped`);
  }
  if (tracks.some((track) => !track.loop || !track.fade)) {
    throw new Error(`${catalogRecipe.id}: renderer received incomplete V2 track semantics`);
  }
  if (!filter.includes('afade=t=in') || !filter.includes('afade=t=out')) {
    throw new Error(`${catalogRecipe.id}: per-track fade filters are missing`);
  }
  if (tracks.some((track) => (track.volumeAutomation?.length ?? 0) > 1) && !filter.includes("volume='if(lt(t,0),0,")) {
    throw new Error(`${catalogRecipe.id}: phase volume automation is missing from the renderer`);
  }
  if (!filter.endsWith(`[out]`)) throw new Error(`${catalogRecipe.id}: output filter is missing`);
}

const crossfadeRecipe = createCatalogRecipeV2({
  recipe: defaultRecipes[0],
  tracks: defaultRecipes[0].tracks,
  durationSeconds: 120,
  prompt: 'crossfade validation',
  guidedVoice: false,
});
const crossfadeTracks = planRecipeRenderTracks(crossfadeRecipe).map((track) => ({
  ...track,
  sourceDurationSeconds: 12,
  sourceSampleRate: 48000,
}));
const crossfadeFilter = buildRecipeFilterComplex(crossfadeTracks, 120);
if (!crossfadeFilter.includes('acrossfade=') || !crossfadeFilter.includes('aloop=loop=-1')) {
  throw new Error('crossfade loop filters are missing');
}

const duckingRecipe = createCatalogRecipeV2({
  recipe: defaultRecipes[0],
  tracks: defaultRecipes[0].tracks,
  durationSeconds: 120,
  prompt: 'ducking validation',
  guidedVoice: true,
});
duckingRecipe.tracks.push({
  ...duckingRecipe.tracks[0],
  stemId: 'stem_liaoyu_voice_zh_bedtime_release',
  role: 'voice',
  volume: 55,
  startTime: 10,
  duration: 12,
  trimStart: 0,
  trimEnd: 12,
  phaseIds: ['arrival'],
  fade: { inSeconds: 0.2, outSeconds: 0.8 },
  loop: { enabled: false, crossfadeSeconds: 0 },
});
duckingRecipe.ducking = [{
  triggerRole: 'voice',
  targetRoles: ['base', 'environment', 'music'],
  reductionDb: 6,
  attackSeconds: 0.3,
  releaseSeconds: 1.2,
}];
const duckingTracks = planRecipeRenderTracks(duckingRecipe);
const duckingFilter = buildRecipeFilterComplex(duckingTracks, duckingRecipe.durationSeconds, duckingRecipe.ducking);
const duckedTrack = duckingTracks.find((track) => track.role === 'base');
if (!duckedTrack) throw new Error('ducking validation: base track is missing');
const intervals = getDuckingIntervalsForTrack(duckedTrack, duckingTracks, duckingRecipe.ducking, duckingRecipe.durationSeconds);
if (intervals.length !== 1 || intervals[0].startSeconds !== 10 || intervals[0].endSeconds !== 22) {
  throw new Error('ducking validation: voice interval was not planned deterministically');
}
if (!duckingFilter.includes('0.5011872336272722') || !duckingFilter.includes('eval=frame')) {
  throw new Error('ducking validation: renderer filter is missing gain automation');
}

const slowerVoiceFilter = buildRecipeFilterComplex(duckingTracks.map((track) => track.role === 'voice'
  ? { ...track, playbackRate: 0.9, duration: 13.3333333333 }
  : track), duckingRecipe.durationSeconds, duckingRecipe.ducking);
if (!slowerVoiceFilter.includes('atempo=0.9')) {
  throw new Error('voice slower validation: renderer filter is missing atempo playbackRate automation');
}

console.log(`Recipe renderer validation passed for ${defaultRecipes.length} catalog recipes.`);
