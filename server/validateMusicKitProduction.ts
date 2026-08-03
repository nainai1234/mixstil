import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defaultRecipes, selectMusicKitCatalogRecipe } from './contentCatalog';
import { pool, query } from './db';
import { productionMusicKits, productionMusicKitStems } from './musicKitProduction';
import { upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';

const fail = (message: string): never => { throw new Error(`MusicKit production validation failed: ${message}`); };
const expectedRoles = ['accompaniment', 'harmony', 'low_support', 'melody', 'transition'];

if (productionMusicKits.length !== 6) fail(`expected 6 kits, received ${productionMusicKits.length}`);
if (productionMusicKitStems.length !== 30) fail(`expected 30 stems, received ${productionMusicKitStems.length}`);

for (const { kit, stem } of productionMusicKitStems) {
  const bytes = readFileSync(new URL(`../public${stem.audioUrl}`, import.meta.url));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== stem.fileSha256) fail(`${stem.id} hash mismatch`);
  if (!stem.id.startsWith(`${kit.id}__`)) fail(`${stem.id} is detached from ${kit.id}`);
}

const kitRecipes = defaultRecipes.filter((recipe) => recipe.id.startsWith('music-kit-'));
if (kitRecipes.length !== 6) fail(`expected 6 catalog recipes, received ${kitRecipes.length}`);
for (const recipe of kitRecipes) {
  if (recipe.tracks.length !== 5) fail(`${recipe.id} does not contain five tracks`);
  const roles = recipe.tracks.map((track) => track.musicPart).sort();
  if (JSON.stringify(roles) !== JSON.stringify(expectedRoles)) fail(`${recipe.id} has incomplete MusicKit roles`);
  const frozen = upgradeRecipeToV2({ ...recipe, versionState: 'frozen', versionId: `frozen-${recipe.id}`, randomSeed: 20260720 });
  const errors = validateRecipeV2(frozen);
  if (errors.length) fail(`${recipe.id}: ${errors.join('; ')}`);
  const replay = JSON.parse(JSON.stringify(frozen));
  if (replay.tracks.some((track: any) => !track.musicKitId || !track.musicKitVersion || !track.musicPart)) {
    fail(`${recipe.id} lost MusicKit metadata after frozen replay round-trip`);
  }
}

const routeCases = [
  { prompt: '轻柔低音钢琴睡眠音乐', goal: 'sleep' as const, scene: 'bedtime' as const, expected: 'low_register_piano_sleep' },
  { prompt: '开放五度吉他冥想音乐', goal: 'calm' as const, scene: 'emotional_settling' as const, expected: 'open_fifth_guitar_meditation' },
  { prompt: 'dry Rhodes instrumental focus music', goal: 'focus' as const, scene: 'deep_focus' as const, expected: 'dry_rhodes_brushless_focus' },
];
for (const item of routeCases) {
  const recipe = selectMusicKitCatalogRecipe({ ...item, contentMode: 'functional_music', excludedSounds: [] });
  if (!recipe?.id.includes(item.expected)) fail(`Quick Create route missed ${item.expected}`);
}
if (selectMusicKitCatalogRecipe({ prompt: '不要音乐，只要雨声', goal: 'sleep', scene: 'bedtime', contentMode: 'pure_soundscape', excludedSounds: ['music'] })) {
  fail('Quick Create ignored explicit music exclusion');
}

const validateDatabase = async () => {
  const ids = productionMusicKitStems.map(({ stem }) => stem.id);
  const stems = await query<any>(`select id, qa_status, commercial_use_allowed, derivative_use_allowed, file_sha256 from audio_stems where id = any($1)`, [ids]);
  if (stems.rows.length !== 30) fail(`database contains ${stems.rows.length}/30 stems`);
  if (stems.rows.some((row) => row.qa_status !== 'approved' || !row.commercial_use_allowed || !row.derivative_use_allowed || !row.file_sha256)) {
    fail('database rights or QA gate is incomplete');
  }
  const metadata = await query<any>(`select count(*)::int as count from stem_metadata_v3 where stem_id = any($1) and roles @> array['music.bed']::text[]`, [ids]);
  if (metadata.rows[0].count !== 30) fail(`semantic catalog contains ${metadata.rows[0].count}/30 stems`);
  console.log('PASS: 6 approved MusicKits, 30 production stems, 6 Quick Create recipes, rights, semantic catalog, routing, and frozen replay validated.');
};

validateDatabase().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
