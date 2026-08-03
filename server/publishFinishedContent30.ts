import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';
import { internalBaselineSeeds } from './internalBaselineCatalog';
import { upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';

const root = process.cwd();
const release = JSON.parse(fs.readFileSync(path.join(root, 'reports/content-baseline-30-longform-release.json'), 'utf8')) as {
  status: string;
  items: Array<{ id: string; goal: 'sleep' | 'calm' | 'focus'; scene: string; releaseUrl: string; releaseDurationSeconds: number; releaseSha256: string; rightsStatus: string }>;
};
const releaseById = new Map(release.items.map((item) => [item.id, item]));
const coverFor = (goal: string) => `/share-visuals/scene-${goal}.jpg`;

const run = async () => {
  if (release.status !== 'ready_to_publish' || release.items.length !== 30) throw new Error('Long-form release manifest is incomplete.');
  for (const seed of internalBaselineSeeds) {
    const item = releaseById.get(seed.id);
    if (!item || item.rightsStatus !== 'verified_derivative_release') throw new Error(`Release gate failed for ${seed.id}`);
    const mixId = `mix_finished_${seed.id}`;
    const versionId = `recipev_finished_${seed.id}`;
    const durationSeconds = Math.round(item.releaseDurationSeconds);
    const recipe = upgradeRecipeToV2({
      catalogRecipeId: seed.catalogRecipeId,
      versionId,
      versionState: 'frozen',
      versionNumber: 1,
      frozenAt: new Date().toISOString(),
      randomSeed: 20260720,
      durationSeconds,
      intent: seed.canonicalScene,
      moodTags: ['Finished Content', 'Save Replay Worthy', seed.goal, seed.scene],
      contentMode: 'functional_music',
      audioIntent: { goal: seed.goal, scene: seed.canonicalScene, contentMode: 'functional_music' },
      tracks: [{
        stemId: seed.stemId,
        role: 'music',
        volume: seed.goal === 'focus' ? 64 : 54,
        startTime: 0,
        duration: durationSeconds,
        trimStart: 0,
        trimEnd: seed.durationSeconds,
        isMuted: false,
        phaseIds: ['arrival', 'core', 'release'],
        fade: { inSeconds: 4, outSeconds: 12 },
        loop: { enabled: true, crossfadeSeconds: 8 },
      }],
      phases: [
        { id: 'arrival', role: 'arrival', startTime: 0, duration: Math.round(durationSeconds * 0.08) },
        { id: 'core', role: 'core', startTime: Math.round(durationSeconds * 0.08), duration: Math.round(durationSeconds * 0.84) },
        { id: 'release', role: 'release', startTime: Math.round(durationSeconds * 0.92), duration: durationSeconds - Math.round(durationSeconds * 0.92) },
      ],
      ducking: [],
      events: [],
      release: { rightsStatus: item.rightsStatus, masterSha256: item.releaseSha256, sourceSeedId: seed.id },
    });
    const errors = validateRecipeV2(recipe);
    if (errors.length) throw new Error(`${seed.id}: ${errors.join('; ')}`);
    await query(
      `insert into mixes (id, creator_id, title, description, cover_image_url, status, recipe_data, render_status, rendered_audio_url, rendered_at, render_error, published_version_id)
       values ($1, 'user_serenity', $2, $3, $4, 'published', $5::jsonb, 'ready', $6, now(), '', $7)
       on conflict (id) do update set title=excluded.title, description=excluded.description, cover_image_url=excluded.cover_image_url,
         status='published', recipe_data=excluded.recipe_data, render_status='ready', rendered_audio_url=excluded.rendered_audio_url,
         rendered_at=now(), render_error='', published_version_id=excluded.published_version_id, updated_at=now()`,
      [mixId, seed.title.replace(/\s+[—-]\s+(Sleep|Calm|Focus)$/i, ''), `A ${Math.round(durationSeconds / 60)} minute owner-approved ${seed.goal} soundscape.`, coverFor(seed.goal), JSON.stringify(recipe), item.releaseUrl, versionId],
    );
    await query(
      `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data) values ($1,$2,1,$3::jsonb)
       on conflict (id) do update set recipe_data=excluded.recipe_data`,
      [versionId, mixId, JSON.stringify(recipe)],
    );
  }
  console.log('PASS: published 30 long-form finished soundscapes with frozen Recipe V2 versions.');
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
