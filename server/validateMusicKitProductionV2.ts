import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { productionMusicKits, productionMusicKitStems } from './musicKitProduction';
import { defaultRecipes, selectMusicKitCatalogRecipe } from './contentCatalog';
import { upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';

const fail = (message: string): never => { throw new Error(`MusicKit production V2 validation failed: ${message}`); };
if (productionMusicKits.length !== 18) fail(`expected 18 kits, received ${productionMusicKits.length}`);
if (productionMusicKitStems.length !== 90) fail(`expected 90 stems, received ${productionMusicKitStems.length}`);
const ids = new Set<string>();
for (const { kit, stem } of productionMusicKitStems) {
  if (ids.has(stem.id)) fail(`duplicate stem ${stem.id}`);
  ids.add(stem.id);
  const bytes = readFileSync(new URL(`../public${stem.audioUrl}`, import.meta.url));
  if (createHash('sha256').update(bytes).digest('hex') !== stem.fileSha256) fail(`${stem.id} hash mismatch`);
  if (!stem.id.startsWith(`${kit.id}__`)) fail(`${stem.id} detached from ${kit.id}`);
}
const recipes = defaultRecipes.filter((recipe) => recipe.id.startsWith('music-kit-'));
if (recipes.length !== 18) fail(`expected 18 Quick Create recipes, received ${recipes.length}`);
for (const recipe of recipes) {
  if (recipe.tracks.length !== 5) fail(`${recipe.id} should have five synchronized stems`);
  const frozen = upgradeRecipeToV2({ ...recipe, versionState: 'frozen', versionId: `frozen-${recipe.id}`, randomSeed: 20260721 });
  const errors = validateRecipeV2(frozen);
  if (errors.length) fail(`${recipe.id}: ${errors.join('; ')}`);
}
for (const item of [
  { prompt: '轻柔低音钢琴睡眠音乐', goal: 'sleep' as const, scene: 'bedtime' as const },
  { prompt: '温暖抒情钢琴放松音乐', goal: 'calm' as const, scene: 'emotional_settling' as const },
  { prompt: 'calm guitar meditation music', goal: 'calm' as const, scene: 'emotional_settling' as const },
  { prompt: 'dry Rhodes instrumental focus music', goal: 'focus' as const, scene: 'deep_focus' as const },
]) {
  if (!selectMusicKitCatalogRecipe({ ...item, contentMode: 'functional_music', excludedSounds: [] })) fail(`no route for ${item.prompt}`);
}
const rotations = new Set(Array.from({ length: 12 }, (_, index) => selectMusicKitCatalogRecipe({
  prompt: '轻柔低音钢琴睡眠音乐',
  goal: 'sleep',
  scene: 'bedtime',
  contentMode: 'functional_music',
  excludedSounds: [],
  selectionKey: `request-${index}`,
})?.id));
if (rotations.size < 3) fail(`request rotation reached only ${rotations.size} sleep piano compositions`);
if (selectMusicKitCatalogRecipe({ prompt: '不要音乐，只要雨声', goal: 'sleep', scene: 'bedtime', contentMode: 'pure_soundscape', excludedSounds: ['music'] })) {
  fail('explicit music exclusion was ignored');
}
console.log('PASS: V2 has 18 independent/approved MusicKits, 90 hashed stems, 18 Quick Create recipes, frozen Recipe V2 replay, and goal/style routing.');
