import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';
import { syncDiscoverPlacements } from './contentModel';
import { createSchema } from './schema';
import { getInternalBaselineStems, internalBaselineSeeds } from './internalBaselineCatalog';
import { upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';

const root = process.cwd();
const release = JSON.parse(fs.readFileSync(path.join(root, 'reports/content-baseline-30-longform-release.json'), 'utf8')) as {
  status: string;
  items: Array<{ id: string; goal: 'sleep' | 'calm' | 'focus'; scene: string; releaseUrl: string; releaseDurationSeconds: number; releaseSha256: string; rightsStatus: string }>;
};
const discoverConfig = JSON.parse(fs.readFileSync(path.join(root, 'data/discover-feed-config.json'), 'utf8')) as {
  sections: Array<{ id: string; enabled: boolean; mixIds: string[] }>;
};
const releaseById = new Map(release.items.map((item) => [item.id, item]));
const stemById = new Map(getInternalBaselineStems().map((stem) => [stem.id, stem]));

const coverFor = (goal: string, scene: string) => {
  if (/return|early_morning/.test(scene)) return '/share-visuals/scene-return-to-sleep.png';
  if (/phone|anxious|restless|late_night/.test(scene)) return '/share-visuals/scene-low-stimulation.png';
  if (goal === 'sleep') return '/share-visuals/scene-bedtime.png';
  if (goal === 'focus') return '/share-visuals/scene-deep-focus.png';
  if (/after_work|evening|emotional|weekend/.test(scene)) return '/share-visuals/scene-short-reset.png';
  return '/share-visuals/scene-calm.jpg';
};

const run = async () => {
  if (release.status !== 'ready_to_publish' || release.items.length !== 30) throw new Error('Long-form release manifest is incomplete.');
  if (internalBaselineSeeds.length !== 30 || stemById.size !== 30) throw new Error('Approved finished-content catalog is incomplete.');

  await createSchema();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into users (id, username, email, avatar_url, role, subscription_tier)
       values ('user_serenity', 'MixStil', 'serenity@snooze.local', '', 'creator', 'pro')
       on conflict (id) do update set username=excluded.username, role=excluded.role,
         subscription_tier=excluded.subscription_tier, updated_at=now()`,
    );

    for (const seed of internalBaselineSeeds) {
      const item = releaseById.get(seed.id);
      const stem = stemById.get(seed.stemId);
      if (!item || item.rightsStatus !== 'verified_derivative_release' || !stem) throw new Error(`Release gate failed for ${seed.id}`);

      await client.query(
        `insert into audio_stems (
           id, name, category, audio_url, is_premium, tags, default_volume, description,
           source_platform, source_url, source_item_id, source_creator, license_name, license_url,
           commercial_use_allowed, derivative_use_allowed, attribution_required, raw_redistribution_allowed,
           qa_status, qa_notes, file_sha256, imported_at
         ) values ($1,$2,$3,$4,false,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now())
         on conflict (id) do update set name=excluded.name, category=excluded.category,
           audio_url=excluded.audio_url, tags=excluded.tags, default_volume=excluded.default_volume,
           description=excluded.description, source_platform=excluded.source_platform,
           source_url=excluded.source_url, source_item_id=excluded.source_item_id,
           source_creator=excluded.source_creator, license_name=excluded.license_name,
           license_url=excluded.license_url, commercial_use_allowed=excluded.commercial_use_allowed,
           derivative_use_allowed=excluded.derivative_use_allowed,
           attribution_required=excluded.attribution_required,
           raw_redistribution_allowed=excluded.raw_redistribution_allowed,
           qa_status=excluded.qa_status, qa_notes=excluded.qa_notes,
           file_sha256=excluded.file_sha256, imported_at=excluded.imported_at`,
        [stem.id, stem.name, stem.category, stem.audioUrl, stem.tags, stem.defaultVolume, stem.description,
          stem.sourcePlatform, stem.sourceUrl, stem.sourceItemId, stem.sourceCreator, stem.licenseName,
          stem.licenseUrl, stem.commercialUseAllowed, stem.derivativeUseAllowed,
          stem.attributionRequired, stem.rawRedistributionAllowed, stem.qaStatus, stem.qaNotes, stem.fileSha256],
      );

      const mixId = `mix_finished_${seed.id}`;
      const versionId = `recipev_finished_${seed.id}`;
      const durationSeconds = Math.round(item.releaseDurationSeconds);
      const recipe = upgradeRecipeToV2({
        catalogRecipeId: seed.catalogRecipeId,
        versionId,
        versionState: 'frozen',
        versionNumber: 1,
        frozenAt: '2026-07-20T00:00:00.000Z',
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

      await client.query(
        `insert into mixes (id, creator_id, title, description, cover_image_url, status, recipe_data,
           render_status, rendered_audio_url, rendered_at, render_error, published_version_id)
         values ($1, 'user_serenity', $2, $3, $4, 'published', $5::jsonb, 'ready', $6, now(), '', null)
         on conflict (id) do update set title=excluded.title, description=excluded.description,
           cover_image_url=excluded.cover_image_url, status='published', recipe_data=excluded.recipe_data,
           render_status='ready', rendered_audio_url=excluded.rendered_audio_url, rendered_at=now(),
           render_error='', published_version_id=null, updated_at=now()`,
        [mixId, seed.title.replace(/\s+[—-]\s+(Sleep|Calm|Focus)$/i, ''),
          `A ${Math.round(durationSeconds / 60)} minute owner-approved ${seed.goal} soundscape.`,
          coverFor(seed.goal, seed.scene), JSON.stringify(recipe), seed.outputUrl],
      );
      await client.query(
        `insert into mix_recipe_versions (id, mix_id, version_number, recipe_data)
         values ($1,$2,1,$3::jsonb)
         on conflict (id) do update set recipe_data=excluded.recipe_data`,
        [versionId, mixId, JSON.stringify(recipe)],
      );
      await client.query(
        `update mixes set published_version_id=$2, recipe_data=$3::jsonb, updated_at=now() where id=$1`,
        [mixId, versionId, JSON.stringify(recipe)],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  const placements = await syncDiscoverPlacements(discoverConfig);
  const verification = await pool.query<{ finished: number; eligible: number }>(
    `select count(*)::int as finished,
       count(*) filter (where ci.release_eligible)::int as eligible
     from mixes m left join content_items ci on ci.mix_id=m.id
     where m.id like 'mix_finished_%'`,
  );
  const { finished, eligible } = verification.rows[0];
  if (Number(finished) !== 30 || Number(eligible) !== 30) {
    throw new Error(`Finished-content verification failed: finished=${finished}, eligible=${eligible}`);
  }
  console.log(`PASS: published ${finished} finished soundscapes; ${eligible} release eligible; ${placements.enabled} Discover placements enabled.`);
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
