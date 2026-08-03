# ASMR Batch 06 Sourcing Policy

Date: 2026-07-13
Status: sourcing policy and search queue only

ASMR is a separate content type from environmental ambience. The no-human-voice rule still applies to Nature, Noise, and ordinary environment beds. ASMR may contain human voice or breathing only when that voice is intentional, gentle, regular, and safe for the requested experience.

## Product Fit Gate

Do not download or review ASMR only because it is tagged `ASMR`.

Before source download, every ASMR candidate must clearly support at least one product scene:

- Sleep onset.
- Return to sleep.
- Meditative breathing.
- Emotional calming.
- Low-friction focus.

Reject isolated novelty foley and raw human sounds unless they are embedded in an intentional scene structure. Finger tapping, random clicks, object scratches, raw keyboard typing, raw breath, sighs, mouth sounds, and contact-mic experiments are not enough by themselves. They usually feel arbitrary rather than meditative, sleep-supportive, or focus-supportive.

Prefer ASMR-adjacent assets that already sound like a usable experience:

- Soft rain on window with no people.
- Gentle room tone or air texture.
- Slow, scripted breathing guidance.
- Quiet body scan or relaxation guidance.
- Warm low pad plus subtle non-startling texture.
- Calm focus ambience with very low event density.

## Startup Source Rule

Do not prioritize paid sound libraries during the startup phase.

Use these first:

| Source | Startup use |
|---|---|
| Freesound | Prefer CC0. Use CC-BY only after attribution is supported end to end. Reject NC/ND. |
| Pixabay Sound Effects | Free candidate discovery for ASMR-style foley and soft voice/breath candidates. Do not redistribute raw assets as a standalone pack. |
| Mixkit Sound Effects | Free foley and small-object effects; no attribution required under the Mixkit license. |
| ZapSplat | Use only free sources where attribution and license requirements can be recorded. Prefer CC0 items if available. |
| Wikimedia Commons / Internet Archive | Use only explicit public domain, CC0, or commercial-friendly Creative Commons items with source/license snapshots. |

Defer paid or subscription libraries such as Soundsnap, Soundly, Epidemic Sound, Artlist, Soundstripe, and premium ZapSplat Gold until the product has clearer revenue and rights-tracking needs.

## Content Policy

### Allowed ASMR Voice

The following can enter an ASMR candidate queue:

- Soft whispering or quiet speech.
- Slow, regular, predictable speech such as hypnosis-style counting or guided relaxation.
- Soft breathing when it is intentional and steady.
- Repeated simple phrases when the content is calm, non-medical, non-sexual, and not startling.
- Non-verbal mouth-adjacent texture only if it is gentle, not wet/gross, not sexualized, and explicitly reviewed.

### Rejected ASMR Voice

Reject immediately:

- Sudden loud speech.
- Random talking, background conversation, crowd noise, children, laughter, or interruptions.
- Unplanned human sounds inside otherwise environmental ambience.
- Roleplay, personal attention, medical/therapy claims, eroticized/sexualized content, intimidation, or distress sounds.
- Any voice whose language/content cannot be understood well enough to safety-review.

### Environment Rule Remains Separate

Nature, Noise, and environmental beds still fail if they contain audible human voice. Human voice in ASMR is acceptable only when the asset is classified as `ASMR` or controlled `Voice`, not when it is pretending to be rain, forest, room tone, ocean, or other environment.

## ASMR Families

| Family | Voice policy | Examples |
|---|---|---|
| Foley ASMR | No voice preferred | only if it supports a calm/focus structure; reject raw tapping, clicking, scratching, and typing as standalone assets |
| Breath ASMR | Voice-like allowed | only scripted, intentional, steady breathing guidance; reject raw breath or sigh loops |
| Whisper ASMR | Voice allowed | soft repeated phrases, calm whisper, short guided cue |
| Hypnosis-style ASMR | Voice allowed with strict script review | regular counting, slow suggestion, non-medical relaxation |
| Environmental ASMR | No voice | rain-on-window, soft crackle, quiet room texture |

## Metadata Requirements

Each ASMR candidate must record:

- `content_type`: `asmr_foley`, `asmr_breath`, `asmr_whisper`, `asmr_hypnosis`, or `asmr_environmental`.
- `voice_presence`: `none`, `breath`, `whisper`, `soft_speech`, `regular_speech`, or `unsafe_voice`.
- `voice_language`: language or `nonverbal`.
- `voice_script_review`: `not_needed`, `needed`, `passed`, or `failed`.
- `sudden_speech_risk`: `low`, `medium`, or `high`.
- `startle_risk`: `low`, `medium`, or `high`.
- `medical_claim_risk`: `none`, `review`, or `reject`.
- `sexualized_risk`: `none`, `review`, or `reject`.
- normal source/license/hash/technical/listening QA fields.

## Promotion Rule

An ASMR candidate can be promoted only when all are true:

1. Source and license are captured.
2. Commercial and derivative use are allowed.
3. Raw redistribution policy is recorded.
4. File hash and decode QA pass.
5. Loudness, peak, silence, and sudden transient QA pass.
6. Human listening confirms voice content is intentional, gentle, regular, and non-startling.
7. If speech is intelligible, script/content review passes.
8. No medical, sexualized, threatening, or confusing spoken content.
9. It is tagged as ASMR/Voice, not as environment.

## Initial Free Search Targets

Start with 80-120 candidates:

| Type | Target count |
|---|---:|
| Foley ASMR without voice | 45 |
| Breath ASMR | 15 |
| Whisper / soft speech ASMR | 20 |
| Hypnosis-style counting / regular speech | 10 |
| Environmental ASMR without voice | 20 |

Do not seed any ASMR item until the metadata model supports the ASMR-specific fields above.
