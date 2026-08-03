import { pool, query } from './db';

export type DiscoverPlacementConfig = {
  sections: Array<{
    id: string;
    enabled: boolean;
    mixIds: string[];
  }>;
};

export const syncDiscoverPlacements = async (config: DiscoverPlacementConfig) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('update discover_placements set enabled = false, updated_at = now() where enabled = true');
    let enabled = 0;
    for (const section of config.sections.filter((item) => item.enabled)) {
      for (const [position, mixId] of section.mixIds.entries()) {
        const result = await client.query(
          `insert into discover_placements (id, section_id, content_item_id, position, enabled, editorial_metadata)
           select $1, $2, ci.id, $3, true, jsonb_build_object('source', 'discover-feed-config', 'mixId', $4::text)
           from content_items ci
           where ci.mix_id = $4 and ci.release_eligible = true
           on conflict (section_id, content_item_id) do update set
             position = excluded.position,
             enabled = true,
             editorial_metadata = excluded.editorial_metadata,
             updated_at = now()
           returning id`,
          [`placement_${section.id}_${mixId}`, section.id, position, mixId],
        );
        if (result.rowCount !== 1) throw new Error(`Discover placement is not release eligible: ${section.id} -> ${mixId}`);
        enabled += 1;
      }
    }
    await client.query('commit');
    return { enabled };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

export const getUnifiedContentModelSummary = async () => {
  const result = await query<{
    audio_assets: number;
    audio_stems: number;
    orphan_stems: number;
    annotations: number;
    content_items: number;
    release_eligible_content: number;
    enabled_placements: number;
    invalid_placements: number;
  }>(
    `select
      (select count(*)::int from audio_assets) as audio_assets,
      (select count(*)::int from audio_stems) as audio_stems,
      (select count(*)::int from audio_stems s left join audio_assets a on a.id = s.asset_id where a.id is null) as orphan_stems,
      (select count(*)::int from asset_annotations) as annotations,
      (select count(*)::int from content_items) as content_items,
      (select count(*)::int from content_items where release_eligible = true) as release_eligible_content,
      (select count(*)::int from discover_placements where enabled = true) as enabled_placements,
      (select count(*)::int from discover_placements dp join content_items ci on ci.id = dp.content_item_id where dp.enabled = true and ci.release_eligible = false) as invalid_placements`,
  );
  const row = result.rows[0];
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      audioAssets: Number(row.audio_assets),
      audioStems: Number(row.audio_stems),
      orphanStems: Number(row.orphan_stems),
      annotations: Number(row.annotations),
      contentItems: Number(row.content_items),
      releaseEligibleContent: Number(row.release_eligible_content),
      enabledPlacements: Number(row.enabled_placements),
      invalidPlacements: Number(row.invalid_placements),
    },
    relationships: [
      'AudioAsset 1 -> n AudioStem',
      'AudioAsset n -> n AudioConcept through AssetAnnotation',
      'ContentItem 1 -> 1 Mix and optional frozen Recipe version',
      'DiscoverPlacement n -> 1 release-eligible ContentItem',
    ],
    migration: {
      runtimeSource: 'Recipe V2 continues to reference AudioStem IDs',
      governanceSource: 'AudioAsset, AssetAnnotation, ContentItem, and DiscoverPlacement',
      compatibility: 'Database triggers synchronize legacy stem, concept, and mix writes',
    },
  };
};
