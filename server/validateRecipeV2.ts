import { defaultRecipes } from './contentCatalog';
import { createCatalogRecipeV2, upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';
import { parseAudioIntentV2 } from './audioIntentV2';

for (const catalogRecipe of defaultRecipes) {
  const recipe = createCatalogRecipeV2({
    recipe: catalogRecipe,
    tracks: catalogRecipe.tracks,
    durationSeconds: catalogRecipe.durationSeconds,
    prompt: 'deterministic validation',
    guidedVoice: false,
  });
  const repeated = createCatalogRecipeV2({
    recipe: catalogRecipe,
    tracks: catalogRecipe.tracks,
    durationSeconds: catalogRecipe.durationSeconds,
    prompt: 'deterministic validation',
    guidedVoice: false,
  });
  const errors = validateRecipeV2(recipe);
  if (errors.length > 0) throw new Error(`${catalogRecipe.id}: ${errors.join(', ')}`);
  if (recipe.randomSeed !== repeated.randomSeed) throw new Error(`${catalogRecipe.id}: random seed is not reproducible`);
}

const legacy = upgradeRecipeToV2({
  tracks: [{ stemId: 'legacy', volume: 10, isMuted: false, startTime: 0, duration: 60, trimStart: 0, trimEnd: 60 }],
  durationSeconds: 60,
  moodTags: ['Legacy'],
}, 'legacy-test');
const legacyErrors = validateRecipeV2(legacy);
if (legacyErrors.length > 0) throw new Error(`legacy upgrade: ${legacyErrors.join(', ')}`);

const noVoiceIntent = parseAudioIntentV2({
  prompt: 'Gentle rain for sleep, no voice and no sudden sounds',
  guidedVoice: true,
  voiceIntensity: 80,
});
if (!noVoiceIntent.excludedSounds.includes('voice')) throw new Error('AudioIntent did not preserve an explicit voice exclusion');
if (noVoiceIntent.guidedVoice.enabled || noVoiceIntent.intensity.voice !== 0) throw new Error('Explicit voice exclusion did not override guided voice output');

const noMusicIntent = parseAudioIntentV2({ prompt: '安静入睡，不要音乐，只要雨声' });
if (!noMusicIntent.excludedSounds.includes('music')) throw new Error('AudioIntent did not preserve a Chinese music exclusion');
if (!noMusicIntent.environmentPreferences.includes('rain')) throw new Error('AudioIntent lost the requested rain preference');
if (noMusicIntent.contentMode !== 'pure_soundscape') throw new Error('AudioIntent did not classify a sound-only request as pure soundscape');

const forestWithoutBirdsIntent = parseAudioIntentV2({ prompt: 'Help me settle with a quiet forest, but no birds, water, or music.' });
if (!forestWithoutBirdsIntent.environmentPreferences.includes('forest')) throw new Error('AudioIntent lost a requested forest when birds were excluded');
if (forestWithoutBirdsIntent.excludedSounds.includes('forest')) throw new Error('AudioIntent treated a bird exclusion as a forest exclusion');
if (!forestWithoutBirdsIntent.excludedSounds.includes('birds')) throw new Error('AudioIntent did not preserve the explicit bird exclusion');

const ordinaryNeedIntent = parseAudioIntentV2({ prompt: '晚上睡不好觉，但是又不想听音乐，白噪音也不能声音太大' });
if (ordinaryNeedIntent.goal !== 'sleep' || ordinaryNeedIntent.scene !== 'bedtime') throw new Error('AudioIntent did not infer bedtime from an ordinary sleep difficulty description');
if (!ordinaryNeedIntent.excludedSounds.includes('music')) throw new Error('AudioIntent did not interpret “不想听音乐” as a hard exclusion');
if (!ordinaryNeedIntent.environmentPreferences.includes('noise')) throw new Error('AudioIntent did not preserve the requested white noise family');
if (ordinaryNeedIntent.intensity.environment >= 50) throw new Error('AudioIntent did not lower environment intensity for “不能声音太大”');
if (ordinaryNeedIntent.contentMode !== 'pure_soundscape') throw new Error('AudioIntent did not classify an ordinary no-music noise request as pure soundscape');

const goalOnlySleepIntent = parseAudioIntentV2({ prompt: '晚上总是睡不好，也有点焦虑，希望能更容易安静下来' });
if (goalOnlySleepIntent.goal !== 'sleep') throw new Error('AudioIntent let an accompanying anxious state override the primary sleep goal');
if (goalOnlySleepIntent.contentMode !== 'pure_soundscape') throw new Error('AudioIntent added music or a journey to a goal-only sleep request');

const journeyIntent = parseAudioIntentV2({ prompt: '从森林慢慢进入音乐的疗愈声音旅程' });
if (journeyIntent.contentMode !== 'sound_journey') throw new Error('AudioIntent did not classify a staged sound journey');

const ordinaryNoBeatMusicIntent = parseAudioIntentV2({ prompt: '睡前不要水声，希望先安静下来，再慢慢进入柔和、没有节拍的低沉音乐，20分钟，不要人声' });
if (ordinaryNoBeatMusicIntent.excludedSounds.includes('music')) throw new Error('AudioIntent treated “没有节拍的音乐” as a music exclusion');
if (ordinaryNoBeatMusicIntent.excludedSounds.includes('chime')) throw new Error('AudioIntent treated the duration word “分钟” as a chime preference');
if (ordinaryNoBeatMusicIntent.contentMode !== 'sound_journey') throw new Error('AudioIntent did not preserve a no-beat music journey request');

const musicIntent = parseAudioIntentV2({ prompt: '用于专注工作的氛围音乐，不要人声' });
if (musicIntent.contentMode !== 'functional_music') throw new Error('AudioIntent did not classify functional music');

const guidedIntent = parseAudioIntentV2({ prompt: '带中文引导的呼吸冥想', guidedVoice: true });
if (guidedIntent.contentMode !== 'guided_meditation') throw new Error('AudioIntent did not classify guided meditation');

console.log(`Recipe V2 validation passed for ${defaultRecipes.length} catalog recipes and one legacy recipe.`);
