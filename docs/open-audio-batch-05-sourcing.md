# Open Audio Batch 05 Sourcing Plan

Date: 2026-07-13
Status: candidate discovery plan only

Batch 05 expands the meditation and sleep audio library through open or reusable audio sources without weakening the Recipe V2 release gates. Nothing in this batch should be downloaded, seeded, routed, rendered, or counted as production inventory until source metadata, license evidence, file hash, technical QA, and listening QA are all captured.

## Goal

Find 100-150 candidate audio sources that can later become approved SNOOZE ingredients:

| Category | Candidate target | Primary use |
|---|---:|---|
| Nature | 60 | long environmental beds for sleep, calm, focus |
| Accent | 30 | bowls, bells, chimes, drops, soft markers |
| Noise | 10-20 | mostly internal synthesis, external only for reference |
| Music | up to 20 | low-stimulation pads, drones, sparse tonal beds |

These are candidate counts, not production counts. A candidate becomes a usable stem only after the normal asset gates pass.

## Source Priority

### P0 - safest discovery routes

| Source | Best fit | Batch 05 rule |
|---|---|---|
| Freesound | nature recordings, bowls, bells, chimes, room tone, subtle accents | Prefer CC0 first. Use CC-BY only after attribution handling is confirmed. Do not use NC or ND. Confirm API/commercial-use terms before automated commercial-scale downloads. |
| Wikimedia Commons | public-domain and Creative Commons audio, bells, nature, cultural instruments | Use only items with clear PD, CC0, or commercial-friendly CC license pages. Capture file page and license page. |
| Internet Archive | public domain or clearly licensed long recordings | Use only records with explicit public domain, CC0, or commercial-friendly CC metadata. Treat vague metadata as blocked. |
| Internal synthesis | white/pink/brown noise, low drones, tonal markers | Preferred for noise and simple low-risk foundation layers. Record generator commit/settings/seed. |

### P1 - good but needs stronger restrictions

| Source | Best fit | Batch 05 rule |
|---|---|---|
| Openverse | cross-source candidate discovery | Use as search only. Always verify on the original source before import. |
| Pixabay | music and nature candidates | May be used inside rendered mixes, not as standalone downloadable stems. Snapshot source and license. Run Content ID checks for music. |
| Mixkit | nature, music, accents | Existing route. Use inside rendered mixes, not raw redistribution. Keep new Mixkit imports in needs_review until listening QA. |
| Sonniss GDC bundles | SFX and accent candidates | Royalty-free SFX candidate source, but not meditation-specific. Screen for startling or cinematic content. Keep internal-only raw files. |

### Blocked for current batch

| Source | Reason |
|---|---|
| BBC Sound Effects | Free usage is not suitable for normal commercial product use without additional licensing. |
| Jamendo, ccMixter, Free Music Archive | Useful for later hand-picked music, but license/API/attribution chains are too variable for first bulk import. |
| Any NC, ND, unknown, or "personal use only" source | Cannot satisfy derivative commercial soundscape publishing. |

## Candidate Metadata

Each accepted candidate row must record:

| Field | Required value |
|---|---|
| `batch_id` | `batch-05` |
| `source_platform` | Freesound, Wikimedia Commons, Internet Archive, Openverse referral, Pixabay, Mixkit, Sonniss, Internal |
| `source_url` | canonical item page, not only a search result |
| `license_url` | canonical license or terms page |
| `license_name` | exact license string from the source |
| `source_creator` | creator/uploader when available |
| `category` | Nature, Music, Noise, Accent |
| `scene_family` | rain, ocean, river, forest, fire, wind, night, bowl, bell, chime, drone, pad, noise |
| `recommended_scene` | sleep, return-to-sleep, meditation, emotional-settling, focus |
| `raw_redistribution_allowed` | true only when explicitly allowed |
| `commercial_use_allowed` | true only when the source/license allows product use |
| `derivative_use_allowed` | true only when remix/rendered derivative use is allowed |
| `attribution_required` | true for CC-BY or similar |
| `qa_status` | `candidate` during discovery, then `needs_review`, `approved`, or `rejected` |

## Search Queue

Use `docs/asset-batch-05-open-audio-searches.tsv` as the working queue. Each row is a search job, not a stem. A search job should produce zero or more candidate item rows in a later candidate TSV.

Recommended search filters:

- First pass: CC0/public domain only.
- Second pass: CC-BY only for sources where the app can preserve attribution through recipe, render, work page, and download metadata.
- Exclude: NC, ND, SA if share-alike obligations are not reviewed, unknown, personal-use-only.
- Exclude high-risk terms in user-facing names: healing frequency, cure, therapy, hypnotic, medical, binaural treatment.
- Exclude any candidate with audible human voice, including speech, singing, laughter, crowd noise, children, classroom/school ambience, applause, or conversation. Human voice can only enter the product through the controlled voice pipeline.

## Admission Gates

1. Source page captured.
2. License page captured.
3. Commercial derivative use allowed.
4. Raw redistribution policy recorded.
5. File downloaded to a candidate-only path.
6. SHA-256 recorded.
7. `ffprobe` decode, duration, codec, sample rate, and channel count captured.
8. Loudness, peak, silence, clipping, and sudden-transient checks pass.
9. Human listening QA confirms there is no audible human voice, then assigns safe scenes, loop notes, and default volume.
10. Content ID or platform-claim check completed for music.
11. Only then may the stem be seeded as `approved`.

## Implementation Boundaries

- Do not seed Batch 05 discoveries directly into `audio_stems`.
- Do not use third-party raw stems as standalone downloads or public asset packs unless explicitly allowed.
- Do not use Openverse metadata as legal proof; it is only a discovery layer.
- Do not treat a technically playable file as approved.
- Do not expand into generic AI music generation or large asset scraping before the Recipe V2 product loop needs a specific supply gap.

## Next Work Items

1. Run the search queue and collect the first 100-150 candidate item URLs.
2. Save candidate item rows in a new TSV with license and source metadata.
3. Download only the safest 30-50 files to a candidate-only folder.
4. Generate hash and technical QA reports.
5. Promote a small, scene-balanced subset to listening QA.
