import fs from 'node:fs';
import { pool, query } from './db';
import { getUnifiedContentModelSummary, syncDiscoverPlacements } from './contentModel';
import { createSchema } from './schema';

const failures: string[] = [];
await createSchema();
const config = JSON.parse(fs.readFileSync('data/discover-feed-config.json', 'utf8'));
const expectedPlacements = config.sections
  .filter((section: { enabled: boolean }) => section.enabled)
  .reduce((sum: number, section: { mixIds: string[] }) => sum + section.mixIds.length, 0);
await syncDiscoverPlacements(config);

const model = await getUnifiedContentModelSummary();
const mixCount = Number((await query<{ count: number }>('select count(*)::int as count from mixes')).rows[0].count);
if (model.summary.orphanStems !== 0) failures.push(`${model.summary.orphanStems} stems are not linked to AudioAsset`);
if (model.summary.invalidPlacements !== 0) failures.push(`${model.summary.invalidPlacements} enabled placements bypass release gates`);
if (model.summary.contentItems !== mixCount) failures.push(`ContentItem count ${model.summary.contentItems} does not match mix count ${mixCount}`);
if (model.summary.enabledPlacements !== expectedPlacements) failures.push(`placement count ${model.summary.enabledPlacements} does not match config ${expectedPlacements}`);
if (model.summary.annotations === 0) failures.push('AssetAnnotation backfill is empty');

const client = await pool.connect();
try {
  await client.query('begin');
  const stemId = `contract_stem_${Date.now()}`;
  await client.query(
    `insert into audio_stems (
      id, name, category, audio_url, source_platform, license_name,
      commercial_use_allowed, derivative_use_allowed, attribution_required,
      raw_redistribution_allowed, qa_status, file_sha256
    ) values ($1, 'Contract stem', 'Noise', '/audio/contract.wav', 'internal', 'internal', true, true, false, false, 'approved', $2)`,
    [stemId, `contract_hash_${Date.now()}`],
  );
  const linked = await client.query(
    `select s.asset_id, a.production_allowed
     from audio_stems s join audio_assets a on a.id = s.asset_id
     where s.id = $1`,
    [stemId],
  );
  if (linked.rowCount !== 1 || linked.rows[0].production_allowed !== true) {
    failures.push('legacy AudioStem writes do not create a governed AudioAsset');
  }

  const governedPlacement = await client.query<{
    asset_id: string;
    content_item_id: string;
    placement_id: string;
  }>(
    `select distinct a.id as asset_id, ci.id as content_item_id, dp.id as placement_id
     from discover_placements dp
     join content_items ci on ci.id = dp.content_item_id
     join mixes m on m.id = ci.mix_id
     cross join lateral jsonb_array_elements(coalesce(m.recipe_data->'tracks', '[]'::jsonb)) track
     join audio_stems s on s.id = track->>'stemId'
     join audio_assets a on a.id = s.asset_id
     where dp.enabled = true
       and ci.release_eligible = true
       and a.production_allowed = true
       and coalesce(track->>'isMuted', 'false') <> 'true'
       and coalesce((track->>'volume')::numeric, 0) > 0
     limit 1`,
  );
  if (governedPlacement.rowCount !== 1) {
    failures.push('no enabled Discover placement is available for governance revocation validation');
  } else {
    const target = governedPlacement.rows[0];
    await client.query('update audio_assets set production_allowed = false where id = $1', [target.asset_id]);
    const revoked = await client.query<{ release_eligible: boolean; enabled: boolean }>(
      `select ci.release_eligible, dp.enabled
       from content_items ci
       join discover_placements dp on dp.content_item_id = ci.id
       where ci.id = $1 and dp.id = $2`,
      [target.content_item_id, target.placement_id],
    );
    if (revoked.rowCount !== 1 || revoked.rows[0].release_eligible !== false || revoked.rows[0].enabled !== false) {
      failures.push('asset governance revocation does not block content and disable its Discover placement');
    }
  }
  await client.query('rollback');
} finally {
  client.release();
  await pool.end();
}

if (failures.length) throw new Error(`Unified content model validation failed:\n- ${failures.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  summary: model.summary,
  contracts: [
    'asset_library_is_file_source_of_truth',
    'legacy_stem_writes_sync_to_audio_asset',
    'knowledge_links_use_asset_annotations',
    'mixes_are_wrapped_by_content_items',
    'discover_placements_require_release_eligible_content',
    'asset_governance_revocation_disables_downstream_release',
  ],
}, null, 2));
