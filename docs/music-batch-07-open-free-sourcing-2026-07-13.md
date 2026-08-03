# Open and Free Music Sourcing - Batch 07

Date: 2026-07-13  
Status: source and license research complete; no candidate is production-approved

## Purpose

Expand the Music candidate pool for Sleep, Calm/meditation, hypnosis-style guided sessions, and Focus without treating "free to listen" or "no copyright" as product permission.

This batch supports the current mainline only as a production-content input. It does not change Recipe V2, seed new stems, or expose raw third-party files.

The machine-readable queue is in `docs/asset-batch-07-music-candidates.tsv`.

## Result

The strongest new sources are:

1. **Free Music Archive / HoliznaCC0**: one 16-track, long-form ambient album marked CC0 at album level. This is the best first download batch for Sleep and meditation, but every track page must still be checked because FMA explicitly says individual-track licenses may differ.
2. **Wikimedia Commons / Kid Pochoclo**: one 3:46:12 ambient improvisation compilation under CC BY 3.0, with 16 chapter timestamps. It is valuable for Calm and Focus after chapter splitting and full listening QA.
3. **Incompetech / Kevin MacLeod**: three piano pieces written for hypnosis and meditation backgrounds, each explicitly CC BY 4.0 and commercially usable with attribution.
4. **Scott Buckley**: a high-quality ambient catalog under CC BY 4.0. `Solace` was directly verified; four adjacent tracks remain item-page recheck candidates. These are best for Calm and Focus, not default deep sleep until dynamics are reviewed.
5. **OpenGameArt**: a large CC0 calm/relaxing collection. `Calm Ambient 1` was directly verified as CC0. Four adjacent entries remain item-page recheck candidates. Production quality varies, so this is a secondary source.

The queue contains **30 concrete source items**: 16 FMA tracks, one 16-chapter Wikimedia source, three Incompetech pieces, five Scott Buckley pieces, and five OpenGameArt pieces.

## Verified Source Matrix

| Source | License signal verified | Commercial derivatives | Attribution | Product fit | Decision |
| --- | --- | --- | --- | --- | --- |
| FMA: HoliznaCC0, `Space - Sleep - Meditation` | Album page says CC0 1.0 and lists 16 tracks | Yes | No | Long-form Sleep and meditation | P0 download review; recheck every track page |
| Wikimedia Commons: Kid Pochoclo ambient compilation | File page says CC BY 3.0, names creator, gives original file and 16 timestamps | Yes | Yes | Calm, low-stimulation Focus, possible sleep chapters | P0 source; split only after full audition |
| Incompetech: Meditation Impromptu 01-03 | Each track page says CC BY 4.0 and provides attribution code | Yes | Yes | Hypnosis/meditation piano, Calm | P0 source; attribution pipeline required |
| Scott Buckley library | Item page says free for any project including commercial under CC BY 4.0 | Yes | Yes | Higher-production ambient Calm/Focus | P1; dynamics and Content ID review required |
| OpenGameArt calm/relaxing collection | Collection says CC0; one item page directly verified CC0 | Yes when item page remains CC0 | No legally; creator credit preferred on some items | Focus and light Calm | P1; variable quality, verify item license |
| Pixabay | Official summary allows free use, no attribution, and modification; standalone distribution is prohibited | Yes inside a new work | No | Existing candidate source for all three goals | Keep as fallback; not an open license |
| Mixkit | Official page assigns a specific Stock Music Free License | Yes within licensed projects | No | Existing 19-track source | Keep; not open source and raw redistribution remains blocked |
| Wikimedia/Openverse/FMA general search | Licenses vary per item | Only when the item license permits | Varies | Discovery only | Never approve from search results alone |

## Sources Rejected or Held

| Source | Decision | Reason |
| --- | --- | --- |
| YouTube videos labeled "no copyright" | Reject as a source | A video title or description is not reliable chain-of-title evidence, and downloading may violate platform terms |
| Internet Archive `Calm Pills` mixes | Hold | The collection is useful for listening research, but the search result did not establish rights for every embedded track |
| FreePD | Reject as current source | The official site states it permanently closed in 2025; mirrors are not accepted as provenance |
| myNoise | Reject for import | The project plan already records personal-use-only rights for its audio |
| SoundCloud CC BY-NC or CC BY-NC-ND tracks | Reject | Non-commercial and no-derivatives terms conflict with paid rendered mixes and editing |
| Musopen classical recordings | Discovery only | Composition and recording rights are separate; approve only when the individual recording has a clear reusable license |
| Openverse | Discovery only | It is an aggregator; the original source page and current license must be captured |

## Goal Coverage

### Sleep

- First choice: FMA long-form CC0 tracks after low-frequency, transient, and full-duration review.
- Secondary: Wikimedia chapters with steady dynamics and no live-performance artifacts.
- Avoid defaulting Scott Buckley cinematic tracks to Sleep; several descriptions mention builds or climaxes.

### Calm, Meditation, and Hypnosis-Style Sessions

- First choice: Incompetech Meditation Impromptu 01-03 and selected FMA meditation tracks.
- Use "hypnosis-style background" only as a content role. Do not claim that a track induces hypnosis or treats a condition.
- Piano needs voice-ducking tests so guided speech stays intelligible and the melody does not compete with narration.

### Focus

- First choice: stable Wikimedia chapters, `Solace`, and selected OpenGameArt ambient synth tracks.
- Focus suitability is an editorial hypothesis, not a scientifically established efficacy claim.
- Reject candidates with drum-and-bass drive, cinematic crescendos, distracting melody, or repetition fatigue.

## Admission Gates

No row in Batch 07 can be seeded until all of these are complete:

1. Save the item page and license page as dated snapshots.
2. Confirm author, exact title, source URL, license, attribution text, and whether changes must be disclosed.
3. Download from the source page or its declared original file, then store SHA-256 and import time.
4. Decode with `ffprobe`; record duration, codec, sample rate, channels, loudness, true peak, and silence.
5. Listen to the entire source, not only the opening. Check speech, vocals, sudden peaks, frightening tone, watermarks, and abrupt endings.
6. Test 30- and 60-minute repetition or chapter edits for fatigue and seams.
7. Run Content ID/platform claim checks before publication.
8. Assign at least two compatible scenes, one Recipe role, a volume range, and voice-ducking behavior.
9. Keep raw third-party download disabled even when the license permits redistribution; expose only rendered mixes.
10. Set `qa_status=approved` only after rights, machine QA, and human listening QA all pass.

## Recommended Import Order

1. Review and download four FMA tracks first: `20 Minute Meditation 1`, `DreamScape`, `Rain / Sleep / Meditation`, and `Cosmic Waves`.
2. Download Incompetech Meditation Impromptu 01-03 and validate the attribution display path in Published Work.
3. Download the Wikimedia compilation once, cut three representative chapters, and compare Calm vs Focus fit before processing all 16 chapters.
4. Review `Solace` and `Calm Ambient 1` as higher-texture Focus candidates.
5. Stop after the first 8-10 approved additions and measure Recipe coverage; do not import all 30 simply to increase the count.

## Authoritative URLs Checked

- https://freemusicarchive.org/music/holiznacc0/space-sleep-meditation
- https://commons.wikimedia.org/wiki/File:Compilation_of_ambient_music_improvisations_-_Kid_Pochoclo.opus
- https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100163
- https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100162
- https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100161
- https://www.scottbuckley.com.au/library/solace/
- https://opengameart.org/content/cc0-calm-relaxing-music
- https://opengameart.org/content/calm-ambient-1-synthwave-4k
- https://pixabay.com/service/license-summary/
- https://mixkit.co/license/
- https://freepd.com/
