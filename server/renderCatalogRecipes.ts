import { pool, query } from './db';
import { defaultRecipes } from './contentCatalog';

const API_BASE = process.env.SNOOZE_API_BASE ?? 'http://localhost:8788';
const CREATOR_ID = 'user_alex';
const COVER = '/share-visuals/scene-sleep.jpg';
const sourceGainDbForStem = (stemId: string) => /stem_internal_(fan|quiet_room|train|pink|brown|white)/.test(stemId) ? 18 : 0;

const run = async () => {
  const requestedIds = new Set((process.env.CATALOG_RECIPE_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean));
  const recipes = requestedIds.size > 0 ? defaultRecipes.filter((recipe) => requestedIds.has(recipe.id)) : defaultRecipes;
  for (const recipe of recipes) {
    const mixId = `mix_catalog_${recipe.id.replace(/-/g, '_')}`;
    const recipeData = {
      schemaVersion: 1,
      tracks: recipe.tracks.map((track) => ({ ...track, sourceGainDb: sourceGainDbForStem(track.stemId) })),
      durationSeconds: recipe.durationSeconds,
      intent: recipe.scene,
      moodTags: recipe.moodTags,
      catalogRecipeId: recipe.id,
    };
    await query(
      `insert into mixes (
         id, creator_id, title, description, cover_image_url, status, recipe_data,
         render_status, rendered_audio_url, rendered_at, render_error
       ) values ($1, $2, $3, $4, $5, 'draft', $6::jsonb, 'not_rendered', '', null, '')
       on conflict (id) do update set
         title = excluded.title,
         description = excluded.description,
         recipe_data = excluded.recipe_data,
         render_status = 'not_rendered',
         rendered_audio_url = '',
         rendered_at = null,
         render_error = '',
         updated_at = now()`,
      [mixId, CREATOR_ID, recipe.name, `Catalog verification render for ${recipe.scene}.`, COVER, JSON.stringify(recipeData)],
    );

    const response = await fetch(`${API_BASE}/api/mixes/${mixId}/render`, { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) throw new Error(`${recipe.id} render failed: ${payload.error ?? response.statusText}`);
    console.log(`${recipe.id}: ${payload.renderedAudioUrl}`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
