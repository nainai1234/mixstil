# Unified Content Model V1

Status: implemented compatibility migration

The asset library remains the only audio file intake surface. The normalized
governance flow is:

```text
AudioAsset -> AudioStem -> Recipe V2 -> ContentItem -> DiscoverPlacement
     |                                      ^
     +-> AssetAnnotation -> AudioConcept ---+
```

- `audio_assets` owns file identity, source, rights, technical QA, listening QA,
  lifecycle, and production eligibility.
- `audio_stems` remains the Recipe V2 runtime identifier and references its
  parent asset. Existing upload/import code is synchronized by a database
  trigger during migration.
- `asset_annotations` is the normalized asset-to-knowledge relationship. The
  legacy `stem_concepts` table remains synchronized for current readers.
- `content_items` wraps each Mix and its frozen version, storing the release
  gate result rather than treating a Mix label as proof of readiness.
- `discover_placements` is editorial placement only. Enabled placements require
  a release-eligible ContentItem and are disabled automatically if asset rights
  or QA later invalidate the content.

This migration does not change Recipe V2 track IDs or playback behavior. It
creates a governed path for moving admin APIs to the normalized objects without
breaking saved sounds, rendering, offline replay, or existing content.
