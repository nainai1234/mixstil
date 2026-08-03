# Candidate Audio Assets

This is a pre-download review list for expanding the SNOOZE stem library. Nothing here should be seeded or downloaded until the source page, license page, file hash, and listening QA have been captured.

## Admission Rules

- Prefer sources with clear commercial-use and derivative/remix permission.
- Do not expose raw third-party stems as a public download or standalone asset pack.
- Rendered user mixes may be downloadable only when every source stem in the recipe allows that usage.
- Save source URL, license URL, author/creator if available, downloaded-at timestamp, and file hash before importing.
- For Freesound, use CC0 only unless we build attribution and commercial restriction handling.
- Avoid medical claims in names, tags, descriptions, and generated templates.

## License Pages To Snapshot

- Pixabay Content License Summary: https://pixabay.com/service/license-summary/
- Pixabay Terms of Service: https://pixabay.com/service/terms/
- Mixkit License: https://mixkit.co/license/
- Mixkit Free Sound Effects: https://mixkit.co/free-sound-effects/
- Mixkit Free Stock Music: https://mixkit.co/free-stock-music/
- Freesound licenses overview: https://freesound.org/help/faq/#licenses

## Open Audio Batch 05

The next expansion pass is defined in `docs/open-audio-batch-05-sourcing.md` with a discovery queue in `docs/asset-batch-05-open-audio-searches.tsv`.

Batch 05 is not a seed manifest. It is a source-discovery and rights-review queue for Freesound, Openverse, Wikimedia Commons, Internet Archive, internal synthesis, and tightly screened fallback sources. Do not download, seed, route, render, or count these items as production assets until candidate item URLs, source snapshots, license snapshots, hashes, technical QA, and listening QA are complete.

First Commons candidate download artifacts:

- Candidate TSV: `docs/asset-batch-05-open-audio-candidates.tsv`
- Download/report: `reports/batch-05-open-audio-download-report.md`
- Local candidate files: `public/audio/candidates/batch-05/open-audio/`
- Collection script: `scripts/collect-batch-05-open-audio.mjs`

The first downloaded set contains public-domain or CC0 Accent candidates only. Human-voice-risk candidates were removed from the local folder and TSV. The remaining files remain `candidate` and must not be seeded until source/license snapshots, loudness/transient QA, and human listening QA confirm no audible human voice.

The current no-human review pool combines Batch 04 nature candidates with the cleaned Batch 05 Commons accent candidates:

- Candidate pool TSV: `docs/no-human-audio-candidate-pool.tsv`
- Candidate pool report: `reports/no-human-audio-candidate-pool.md`
- Machine QA TSV: `docs/no-human-audio-candidate-machine-qa.tsv`
- Machine QA report: `reports/no-human-audio-candidate-machine-qa.md`
- Listening QA queue: `docs/no-human-audio-listening-qa-queue.tsv`
- Listening QA queue report: `reports/no-human-audio-listening-qa-queue.md`
- Listening QA result: `reports/no-human-audio-listening-qa-results-2026-07-13.md`
- Promotion review: `reports/no-human-audio-promotion-review-2026-07-13.md`
- Current size: 34 candidates, including 30 Nature and 4 Accent files.
- Machine QA result: 24 pass, 9 warn, 1 fail. The listening queue excludes the failed item and contains 33 candidates.
- Human no-voice listening result: 33 passed the no-human-voice gate on 2026-07-13. Of these, 24 are machine-pass candidates ready for final source/license promotion review; 9 still require technical handling before promotion.
- Promotion result: 24 approved and seeded, 9 still blocked for technical handling, 1 rejected.

## ASMR Batch 06

ASMR sourcing is governed by `docs/asmr-batch-06-sourcing-policy.md`, with the first free-source search queue in `docs/asset-batch-06-asmr-searches.tsv`.

ASMR has a different voice rule than environmental ambience. Nature, Noise, and environment beds still fail if they contain audible human voice. ASMR candidates may contain gentle breathing, whispering, or regular hypnosis-style speech when the voice is intentional, quiet, predictable, non-startling, non-medical, and content-reviewed. Startup sourcing should avoid paid libraries and prioritize Freesound CC0, Pixabay, Mixkit, ZapSplat free/CC0, Wikimedia Commons, and Internet Archive.

First source scan artifacts:

- Source candidate TSV: `docs/asset-batch-06-asmr-candidates.tsv`
- Source scan report: `reports/asmr-batch-06-source-scan-2026-07-13.md`
- Downloaded candidate TSV: `docs/asset-batch-06-asmr-download-candidates.tsv`
- Listening QA queue: `docs/asmr-batch-06-listening-qa-queue.tsv`
- Listening QA page: `public/review/asmr-batch-06-listening-qa.html`
- Download report: `reports/asmr-batch-06-download-candidates-2026-07-13.md`
- Listening queue report: `reports/asmr-batch-06-listening-qa-queue-2026-07-13.md`
- Product fit review: `reports/asmr-batch-06-product-fit-review-2026-07-13.md`
- Product fit decisions: `docs/asmr-batch-06-product-fit-review.tsv`
- Status: 8 ASMR preview candidates downloaded and then rejected for product fit; no ASMR audio is seeded, routable, or available to generation.

Product-fit replacement queue:

- Downloaded candidate TSV: `docs/asset-batch-06-product-fit-asmr-download-candidates.tsv`
- Listening QA queue: `docs/asmr-product-fit-listening-qa-queue.tsv`
- Listening QA page: `public/review/asmr-product-fit-listening-qa.html`
- Download report: `reports/asmr-product-fit-replacement-downloads-2026-07-13.md`
- Direct Commons download report: `reports/asmr-product-fit-replacement-direct-commons-2026-07-13.md`
- Commons noise/water/wind download report: `reports/asmr-product-fit-replacement-commons-noise-water-wind-2026-07-13.md`
- Listening queue report: `reports/asmr-product-fit-listening-qa-queue-2026-07-13.md`
- Quiet-state rejection decisions: `docs/product-fit-external-rejected-quiet-state-2026-07-13.tsv`
- Quiet-state internal QA queue: `docs/quiet-state-listening-qa-queue.tsv`
- Quiet-state internal QA page: `public/review/quiet-state-listening-qa.html`
- Quiet-state report: `reports/quiet-state-listening-qa-queue-2026-07-13.md`
- Status: 15 product-fit replacement candidates downloaded and then rejected for failing the fast quiet-state product bar. 8 internal quiet-state candidates are available for listening QA only; no new item is seeded, routable, or available to generation because of this page.

## Open and Free Music Batch 07

The 2026-07-13 worldwide source scan for Sleep, Calm/meditation, hypnosis-style background, and Focus music is documented in `docs/music-batch-07-open-free-sourcing-2026-07-13.md`.

- Candidate TSV: `docs/asset-batch-07-music-candidates.tsv`
- Downloaded candidate TSV: `docs/asset-batch-07-downloaded-music.tsv`
- Machine QA report: `reports/batch-07-music-machine-qa.md`
- Review clip TSV: `docs/asset-batch-07-review-clips.tsv`
- Review clip report: `reports/batch-07-review-clips.md`
- Business QA queue: `docs/batch-07-music-business-qa-queue.tsv`
- Business QA page: `public/review/batch-07-music-business-qa.html`
- Business QA report: `reports/batch-07-music-business-qa-queue-2026-07-13.md`
- Business QA result: `reports/batch-07-music-business-qa-result-2026-07-13.md`
- Listening review TSV: `docs/asset-batch-07-listening-review.tsv`
- Listening review result: `reports/batch-07-music-listening-review-result.md`
- Rights and attribution gate: `reports/batch-07-rights-and-attribution-gate-2026-07-13.md`
- Remediated machine QA report: `reports/batch-07-remediated-music-machine-qa.md`
- Production promotion TSV: `docs/asset-batch-07-production-promotion.tsv`
- Manual review queue: `reports/batch-07-music-review-queue.md`
- Local listening page: `public/review/batch-07-music-listening-qa.html`
- Local candidate audio: `public/audio/candidates/batch-07/music/`
- Current queue: 30 concrete source items across Free Music Archive, Wikimedia Commons, Incompetech, Scott Buckley, and OpenGameArt.
- Strongest first-pass pool: 16 long-form HoliznaCC0 tracks, three CC BY 4.0 Meditation Impromptu piano pieces, and one 16-chapter CC BY 3.0 Wikimedia ambient compilation.
- Download status: 8 first-pass candidates downloaded on 2026-07-13 with source and license snapshots captured: four HoliznaCC0/FMA long-form ambient tracks, three Incompetech `Meditation Impromptu` tracks, and Scott Buckley's `Solace`.
- Machine QA status: 0 pass, 8 warn, 0 fail, and 0 duplicate hashes against the existing audio library. Warnings are mainly clipping/near-0 dBFS peaks, 100ms RMS jumps, or interior silence frames.
- Technical remediation status: normalized review copies were generated for all eight. Remediation removed clipping and near-peak risk, but all eight still need editorial acceptance or manual edit decisions for remaining 100ms RMS jump or interior silence warnings.
- Human listening status: 8/8 downloaded candidates passed user listening triage on 2026-07-13.
- Business-fit status: 8/8 downloaded candidates passed user business-fit review on 2026-07-13.
- Rights and attribution status: individual-page rights evidence is captured for all eight; the product share page now supports required CC BY audio credits.
- Production status: four FMA/CC0 normalized copies are promoted as approved music stems. The four CC BY candidates remain `needs_review` until their attribution path is exercised in a published-work QA and platform claim risk is checked.
- Attribution-bearing candidates require a verified Published Work credit path before promotion.

## Candidate List

Status meanings:

- `Ready for manual download review`: source and license look suitable, but still needs source-page snapshot, file hash, and listening QA.
- `Needs browser verification`: candidate URL is specific, but command-line verification was blocked or incomplete.
- `Do not import yet`: interesting, but needs extra legal/product support first.

| # | Name | Category | Source | Source URL | License status | Commercial use | Derivative/remix | Attribution | Raw redistribution / download note | Tags | Default volume | Recommended scenes | Status | Risk notes |
|---:|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|
| 1 | Frequency of Sleep Meditation | Music | Pixabay | https://pixabay.com/music/meditationspiritual-frequency-of-sleep-meditation-113050/ | Pixabay Content License | Yes | Yes | No | Use only inside rendered mixes; do not resell or publish as raw stem pack. | sleep, meditation, calm | 28 | sleep, meditation, emotional settling | Needs browser verification | Title mentions frequency; avoid efficacy claims. |
| 2 | Calming and Relaxing Meditation Music | Music | Pixabay | https://pixabay.com/music/meditationspiritual-calming-and-relaxing-meditation-music-110208/ | Pixabay Content License | Yes | Yes | No | Suitable as a low-volume music bed after source snapshot. | spa, meditation, drone | 24 | breathing, relaxation, bedtime | Needs browser verification | Listen for bright highs or religious tone. |
| 3 | Sleep Meditation Background Music | Music | Pixabay | https://pixabay.com/music/meditationspiritual-sleep-meditation-background-music-437696/ | Pixabay Content License | Yes | Yes | No | Use in rendered mixes only; preserve source metadata. | sleep, background, ambient | 25 | return-to-sleep, bedtime | Needs browser verification | Check loop point and high-frequency transients. |
| 4 | Relaxing Meditation | Music | Pixabay | https://pixabay.com/music/meditationspiritual-relaxing-meditation-231762/ | Pixabay Content License | Yes | Yes | No | Good candidate for background layer, not raw redistribution. | relaxing, meditation, background | 24 | breathing, emotional settling | Needs browser verification | Popular tracks may create platform sameness or Content ID noise. |
| 5 | Sleep Meditation | Music | Pixabay | https://pixabay.com/music/electronic-sleep-meditation-254767/ | Pixabay Content License | Yes | Yes | No | Can support electronic ambient templates after QA. | electronic, long, quiet | 22 | return-to-sleep, pure ambience | Needs browser verification | Electronic feel may be too active for sleep. |
| 6 | Deep Meditation | Music | Pixabay | https://pixabay.com/music/ambient-deep-meditation-375362/ | Pixabay Content License | Yes | Yes | No | Use as subtle pad layer; keep source record. | ambient, atmospheric, binaural | 20 | meditation, deep relaxation | Needs browser verification | Binaural-style tags must not imply treatment. |
| 7 | Theta Sleep Meditation - Dreamy Stars | Music | Pixabay | https://pixabay.com/music/meditationspiritual-theta-sleep-meditation-dreamy-stars-294576/ | Pixabay Content License | Yes | Yes | No | Candidate for gentle sleep ambience. | theta, dreamy, bells | 20 | bedtime, soft sleep ambience | Needs browser verification | Treat theta as style label only. |
| 8 | Spiritual Meditation 30 mins | Music | Pixabay | https://pixabay.com/music/meditationspiritual-spiritual-meditation-30-mins-201945/ | Pixabay Content License | Yes | Yes | No | Long-form source could support extended templates. | longform, spiritual, ambient | 21 | long bedtime, meditation | Needs browser verification | Spiritual positioning may narrow user appeal. |
| 9 | 15 Minutes of Rain Sound for Relaxation and Sleep Study | Nature | Pixabay | https://pixabay.com/sound-effects/nature-15-minutes-of-rain-sound-for-relaxation-and-sleep-study-312863/ | Pixabay Content License | Yes | Yes | No | Strong candidate for long rain bed; do not expose raw. | rain, sleep, study, white noise | 18 | return-to-sleep, nature, focus | Needs browser verification | Check head/tail loop and peaks. |
| 10 | Gentle Rain for Relaxation and Sleep | Nature | Pixabay | https://pixabay.com/sound-effects/nature-gentle-rain-for-relaxation-and-sleep-337279/ | Pixabay Content License | Yes | Yes | No | Good soft rain layer after QA. | gentle rain, soft rain, sleep | 16 | bedtime, emotional settling | Needs browser verification | May need EQ to soften high rain ticks. |
| 11 | Soothing Ocean Waves | Nature | Pixabay | https://pixabay.com/sound-effects/nature-soothing-ocean-waves-372489/ | Pixabay Content License | Yes | Yes | No | Use as ocean stem in rendered mixes. | ocean, waves, shore | 18 | nature, breathing, bedtime | Needs browser verification | Avoid sudden wave crashes. |
| 12 | Ocean Beach Waves | Nature | Pixabay | https://pixabay.com/sound-effects/nature-ocean-beach-waves-332383/ | Pixabay Content License | Yes | Yes | No | Candidate for ocean base layer. | ocean, beach, waves | 17 | nature, night background | Needs browser verification | Popular ocean sounds may need differentiated mixing. |
| 13 | Sea waves with birds loop | Nature | Mixkit | https://mixkit.co/free-sound-effects/ocean/ item 1185 | Mixkit Sound Effects Free License | Yes | Yes | No | Mixkit says SFX are free to download and use in audio/video projects; do not redistribute raw SFX. | sea, birds, water, loop | 15 | morning meditation, light relaxation | Ready for manual download review | Birds are not ideal for deep sleep defaults. |
| 14 | Heavy rain ambience | Nature | Mixkit | https://mixkit.co/free-sound-effects/ambience/ | Mixkit Sound Effects Free License | Yes | Yes | No | Use in rendered mixes; keep raw internal only. | ambience, rain, heavy rain | 14 | return-to-sleep, noise masking | Ready for manual download review | Heavy rain can feel intense; default low. |
| 15 | Morning birds | Nature | Mixkit | https://mixkit.co/free-sound-effects/bird/ | Mixkit Sound Effects Free License | Yes | Yes | No | Use as accent layer, not raw redistribution. | morning, bird, forest | 10 | morning calm, emotional settling | Ready for manual download review | Not for deep sleep default templates. |
| 16 | Small waves harbor rocks | Nature | Mixkit | https://mixkit.co/free-sound-effects/ocean/ item 1208 | Mixkit Sound Effects Free License | Yes | Yes | No | Candidate ocean stem, internal raw only. | sea, waves, rocks | 16 | ocean sleep, breathing | Ready for manual download review | Check for harbor/boat artifacts. |
| 17 | Close sea waves loop | Nature | Mixkit | https://mixkit.co/free-sound-effects/ocean/ item 1195 | Mixkit Sound Effects Free License | Yes | Yes | No | Imported internally; available only through rendered mixes. | waves, sea, loop | 16 | pure nature, sleep | Imported and technically approved | Valid 29.00s WAV; editorial repetition QA still recommended. |
| 18 | Sea coast breaking waves | Nature | Mixkit | https://mixkit.co/free-sound-effects/ocean/ item 1206 | Mixkit Sound Effects Free License | Yes | Yes | No | Longer wave stem; use after peak QA. | coast, waves, ocean | 16 | ocean bedtime, relaxation | Ready for manual download review | Breaking waves may have startling peaks. |
| 19 | Forest birds ambience | Nature | Mixkit | https://mixkit.co/free-sound-effects/forest/ item 1210 | Mixkit Sound Effects Free License | Yes | Yes | No | Imported internally; available only through rendered mixes. | forest, birds, ambience | 12 | morning calm, light meditation | Imported and technically approved | Valid 151.56s WAV; keep out of default night templates. |
| 20 | Night forest with insects | Nature | Mixkit | https://mixkit.co/free-sound-effects/forest/ item 2414 | Mixkit Sound Effects Free License | Yes | Yes | No | Good nocturnal nature layer after loop QA. | night, insects, forest | 14 | bedtime, nature ambience | Ready for manual download review | Insect highs may need EQ. |
| 21 | River in the forest with birds | Nature | Mixkit | https://mixkit.co/free-sound-effects/forest/ item 1216 | Mixkit Sound Effects Free License | Yes | Yes | No | Candidate water and forest hybrid stem. | river, forest, birds | 15 | relaxation, nature, breathing | Ready for manual download review | Birds may limit night use. |
| 22 | Wildlife environment in a river | Nature | Mixkit | https://mixkit.co/free-sound-effects/forest/ item 2456 | Mixkit Sound Effects Free License | Yes | Yes | No | Longer river ambience candidate. | river, wildlife, water | 15 | nature, long relaxation | Ready for manual download review | Listen for animal calls or sudden movement. |
| 23 | Crickets and insects in the wild ambience | Nature | Mixkit | https://mixkit.co/free-sound-effects/crickets/ item 39 | Mixkit Sound Effects Free License | Yes | Yes | No | Use as low-volume night ambience. | crickets, insects, wild | 11 | bedtime, rural night | Ready for manual download review | May be too sharp without EQ. |
| 24 | Night crickets near the swamp | Nature | Mixkit | https://mixkit.co/free-sound-effects/crickets/ item 1782 | Mixkit Sound Effects Free License | Yes | Yes | No | Night ambience candidate. | crickets, night, swamp | 11 | night ambience, nature | Ready for manual download review | Swamp texture may feel wet/dense. |
| 25 | Summer night crickets loop | Nature | Mixkit | https://mixkit.co/free-sound-effects/crickets/ item 1789 | Mixkit Sound Effects Free License | Yes | Yes | No | Loop candidate for sleep mixes. | summer, crickets, loop | 10 | bedtime, rural night | Ready for manual download review | Short loops require repetition QA. |
| 26 | Pond ambience with crickets | Nature | Mixkit | https://mixkit.co/free-sound-effects/crickets/ item 1783 | Mixkit Sound Effects Free License | Yes | Yes | No | Imported internally; available only through rendered mixes. | pond, crickets, night | 12 | nature, bedtime | Imported and technically approved | Valid 148.06s WAV; editorial transient QA still recommended. |
| 27 | Waterfall in the woods | Nature | Mixkit | https://mixkit.co/free-sound-effects/waterfall/ item 2517 | Mixkit Sound Effects Free License | Yes | Yes | No | Imported internally; available only through rendered mixes. | waterfall, woods, water | 13 | focus, relaxation | Imported and technically approved | Valid 82.76s WAV; keep default volume low. |
| 28 | Large waterfall loop | Nature | Mixkit | https://mixkit.co/free-sound-effects/waterfall/ item 3030 | Mixkit Sound Effects Free License | Yes | Yes | No | Loop candidate for masking/focus templates. | waterfall, loop, water | 12 | focus, sound masking | Ready for manual download review | Not ideal for deep sleep unless softened. |
| 29 | Light rain loop | Nature | Mixkit | https://mixkit.co/free-sound-effects/rain/ item 2393 | Mixkit Sound Effects Free License | Yes | Yes | No | Short rain loop candidate. | light rain, loop, nature | 14 | bedtime, focus | Ready for manual download review | Very short loop; check repetition fatigue. |
| 30 | Rain long loop | Nature | Mixkit | https://mixkit.co/free-sound-effects/rain/ item 2394 | Mixkit Sound Effects Free License | Yes | Yes | No | Imported internally; available only through rendered mixes. | rain, long loop, ambience | 15 | bedtime, focus, return-to-sleep | Imported and technically approved | Valid 57.07s WAV; editorial transient QA still recommended. |

## Music Review Addendum - 2026-07-11

Pixabay's current Content License summary permits free use, use without attribution, and modification into new works. It prohibits selling or distributing a track on a standalone basis. The following search results did not display Pixabay's Content ID shield during this review, but every downloaded file still requires a fresh source-page snapshot, hash, listening QA, and a Content ID test before publication.

| Name | Source | Source URL | Creator | Duration | License | Intended use | Status | Risk notes |
|---|---|---|---|---:|---|---|---|---|
| Sleep Music Vol.16 | Pixabay | https://pixabay.com/music/ambient-sleep-music-vol16-195422/ | RelaxingTime | 20:07 | Pixabay Content License | Long ambient sleep bed | Ready for manual download review | Very long source; inspect dynamics and loop/edit points. |
| Sleep Music Vol.14 | Pixabay | https://pixabay.com/music/meditationspiritual-sleep-music-vol14-195424/ | RelaxingTime | 21:04 | Pixabay Content License | Bedtime and return-to-sleep | Ready for manual download review | Check for bright bells, vocals, and spiritual tone. |
| Sleep Music Vol.15 | Pixabay | https://pixabay.com/music/meditationspiritual-sleep-music-vol15-195425/ | RelaxingTime | 22:06 | Pixabay Content License | Long-form meditation bed | Ready for manual download review | Content similarity across the same creator's series. |
| Sleep Music Vol.2 | Pixabay | https://pixabay.com/music/meditationspiritual-sleep-music-vol2-172817/ | RelaxingTime | 20:54 | Pixabay Content License | Dream and bedtime scenes | Ready for manual download review | Verify no abrupt section changes over the full track. |
| Sleep Music Vol.17 | Pixabay | https://pixabay.com/music/meditationspiritual-sleep-music-vol17-195423/ | RelaxingTime | 20:07 | Pixabay Content License | Deep relaxation background | Ready for manual download review | Run platform Content ID checks despite no shield shown. |
| Sleep | Pixabay | https://pixabay.com/music/solo-piano-sleep-141321/ | Armonicamente | 12:45 | Pixabay Content License | Sparse piano sleep layer | Ready for manual download review | Confirm piano transients remain gentle at low volume. |

The 19 tracks in `asset-batch-03-music.tsv` are downloaded from Mixkit's free stock music library and are now seeded as Music stems. They may be used in commercial and non-commercial projects under the Mixkit Stock Music Free License, but remain internal ingredients rather than standalone downloadable files. Publication still requires listening and Content ID QA.

### Additional Light Music Candidates - 2026-07-11

These results add creator diversity and cover piano, acoustic guitar, and ambient textures. None displayed Pixabay's Content ID shield in the reviewed search result. That is a useful screening signal, not a legal or platform guarantee.

| Name | Family | Source URL | Creator | Duration | Intended use | Status | Listening focus |
|---|---|---|---|---:|---|---|---|
| Reverie - Calm Piano Music | piano | https://pixabay.com/music/modern-classical-reverie-calm-piano-music-280263/ | Clavier-Music | 1:54 | Short reflective piano layer | Detail page and free download verified | Check key strikes, ending decay, and short-loop repetition. Creator prohibits uploading the source track to Spotify, Apple Music, or other streaming services. |
| Just Relax | guitar | https://pixabay.com/music/beautiful-plays-just-relax-11157/ | music_for_video | 2:40 | Gentle acoustic relaxation | Ready for manual download review | Confirm the arrangement has no upbeat percussion or sudden lift. |
| Sedative | guitar | https://pixabay.com/music/acoustic-group-sedative-110241/ | music_for_video | 3:01 | Low-stimulation acoustic bed | Ready for manual download review | Check guitar transients and whether the title is suitable for consumer display. |
| Stardust Meditation | ambient | https://pixabay.com/music/meditationspiritual-stardust-meditation-12702/ | NaturesEye | 18:00 | Long meditation and bedtime bed | Ready for manual download review | Listen through the full track for bells, peaks, vocals, or section changes. |
| Flatten (Emotional Soul Meditation) | ambient | https://pixabay.com/music/meditationspiritual-flatten-emotional-soul-meditation-559848/ | Rockot | 9:06 | Emotional settling background | Ready for manual download review | Check melody intensity and rename before consumer use if approved. |
| The 4 Elements Water | ambient | https://pixabay.com/music/ambient-the-4-elements-water-211115/ | OnlineAIElements | 5:27 | Water-themed tranquil ambience | Ready for manual download review | Verify it is musical enough and does not duplicate the Nature layer. |

Rejected during this pass: tracks showing Pixabay's Content ID shield, tracks led by drums or obvious cinematic rises, and AI-labelled results whose musical provenance or consistency was unclear. Pixabay assets must remain non-downloadable as standalone stems in the product.

## Import Metadata Shape

When approved, each imported stem should carry at least:

```ts
type AudioStemLicenseMetadata = {
  sourcePlatform: 'Pixabay' | 'Mixkit' | 'Freesound' | 'Internal';
  sourceUrl: string;
  sourceItemId?: string;
  sourceCreator?: string;
  licenseName: string;
  licenseUrl: string;
  commercialUseAllowed: boolean;
  derivativeUseAllowed: boolean;
  attributionRequired: boolean;
  rawRedistributionAllowed: boolean;
  importedAt: string;
  sourceSnapshotPath?: string;
  fileSha256?: string;
  qaStatus: 'candidate' | 'approved' | 'rejected';
  qaNotes: string;
};
```

## Recommended Next Step

1. Browser-open and snapshot the 30 source pages plus the license pages.
2. Download only the approved files into `public/audio/nature`, `public/audio/music`, or `public/audio/noise`.
3. Compute `sha256` for every file.
4. Add copyright/license fields to `audio_stems`.
5. Update `server/seed.ts` only after the above is complete.
