import { upgradeRecipeToV2, validateRecipeV2, type MusicKitStemRole } from './recipeV2';

const roles: MusicKitStemRole[] = ['harmony', 'melody', 'accompaniment', 'low_support', 'transition'];
const recipe = upgradeRecipeToV2({
  durationSeconds: 96,
  moodTags: ['calm', 'music-kit-contract'],
  tracks: roles.map((musicPart, index) => ({
    stemId: 'candidate_music_kit_' + musicPart,
    role: 'music',
    volume: 60 - index * 5,
    isMuted: false,
    startTime: 0,
    duration: 96,
    trimStart: 0,
    trimEnd: 96,
    musicKitId: 'kit_contract_fixture',
    musicKitVersion: '0.1.0',
    musicPart,
  })),
}, 'music-kit-contract');

const errors = validateRecipeV2(recipe);
if (errors.length > 0) throw new Error('Valid MusicKit recipe was rejected: ' + errors.join('; '));
if (recipe.tracks.some((track) => !track.musicKitId || !track.musicKitVersion || !track.musicPart)) {
  throw new Error('MusicKit metadata was not preserved through Recipe V2 upgrade.');
}

const invalidRole = structuredClone(recipe);
invalidRole.tracks[0].role = 'environment';
if (!validateRecipeV2(invalidRole).some((error) => error.includes('not a music track'))) {
  throw new Error('Recipe V2 accepted MusicKit metadata on a non-music track.');
}

const incomplete = structuredClone(recipe);
delete incomplete.tracks[0].musicKitVersion;
if (!validateRecipeV2(incomplete).some((error) => error.includes('incomplete MusicKit metadata'))) {
  throw new Error('Recipe V2 accepted incomplete MusicKit metadata.');
}

console.log('PASS: Recipe V2 preserves complete MusicKit metadata and rejects invalid placement.');
