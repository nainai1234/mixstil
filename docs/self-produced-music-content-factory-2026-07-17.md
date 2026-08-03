# SNOOZE Self-Produced Music Content Factory

Date: 2026-07-17  
Status: superseded by controlled-stem route after listening QA

## Decision

SNOOZE will produce the next content expansion from an internal, review-gated
music-bed and stem factory instead of prioritizing externally sourced music
assets or paid cloud generation.

2026-07-17 correction: ACE-Step and MusicGen-style full-music generation are no
longer acceptable as the next SNOOZE production route. Listening QA showed that
these models repeatedly drift toward song, lounge, bar, excited, busy, or
rock-like priors. The active route is now the
`SNOOZE controlled stem factory` recorded in
`docs/open-self-hosted-audio-route-candidates-2026-07-17.json`.

The factory is a background production pipeline, not a user-facing AI music
generator. Generated audio remains a candidate until it passes technical QA,
rights/origin record review, human listening, loop/repetition review, Recipe V2
combination QA, and final promotion.

This work exists to scale the proven Batch 012 formula:

> quiet music bed as the main content, with micro organic texture or musical
> release below attention.

It does not change the ToC product promise. Users still receive fast,
reproducible Recipe V2 soundscapes from approved assets.

## Why this now

The current content blocker is not playback technology; it is paid-value depth.
The Internal Audible Product Baseline has 30 save/replay-worthy seeds, but the
Paid Beta Baseline still needs:

- 80-100 finished content items.
- 150-250 foundational sounds.
- at least 20 content items with strong replay value.
- at least 30 content items suitable for 30+ minute sessions.

External materials can help, but they add license, attribution, derivative-use,
and future availability risk. Self-produced music beds give us stronger control
over origin records, scene fit, reproducibility, and long-listen behavior.

## MakeBestMusic principle, adapted

MakeBestMusic-style products appear to use this broad pattern:

```text
prompt / style / duration
  -> music generation model or API
  -> downloadable generated song
  -> account history, quotas, and subscription
```

SNOOZE should use only the production principle:

```text
scene-specific production brief
  -> controlled open model candidate generation
  -> strict rejection and listening QA
  -> loop/loudness/metadata packaging
  -> approved music-bed asset
  -> Recipe V2 finished soundscape
```

We should not copy the front-stage product pattern. A foreground "AI song
generator" would distract from the consumer soundscape loop and would weaken
quality control for sleep/focus listening.

## Model routing

| Route | Use | Product boundary |
| --- | --- | --- |
| ACE-Step | Rejected for SNOOZE sleep/calm/focus core after listening QA | Research/model comparison only |
| Deterministic procedural synthesis | Sleep-safe drone/pad support when model output has too much pulse or emotion | Preferred for sleep support layers |
| Stable Audio Tools / Stable Audio Open | Later comparison route after exact model terms are reviewed | Not used for this first batch |
| MusicGen / AudioCraft | Internal reference only where weights are non-commercial | No public/commercial assets |
| AudioLDM2 / Riffusion | Research reference only | Not a main production route |
| FFmpeg + audio QA scripts | Trim, loop, loudness, review copies, probe validation | Production utilities |

ACE-Step remains disabled as the default Sleep route because earlier sleep
attempts produced cheerful/celebratory affect and detected pulse. For the first
self-produced batch, Sleep content should be created by combining existing
promoted sleep seeds with tiny deterministic support layers, not by trusting
ACE-Step raw output.

## Superseded Batch 018 target

Manifest: `docs/self-produced-music-bed-batch-018.json`

Command:

```bash
pnpm generate:self-produced-music-batch-018
```

This command is now intentionally blocked. Do not use ACE-Step Batch 018 as a
product-content production route unless the project explicitly reopens it for
model-comparison research.

Output directory:

```text
public/audio/music/local-candidates/batch-018-self-produced/
```

Target generation:

- 30 ACE-Step candidates.
- 15 Calm candidates.
- 15 Focus candidates.
- 60-second WAV candidate previews.
- No vocals, speech, drums, beat, abrupt impact, horror/suspense semantics,
  strong hooks, or bright alarm-like tones.

Expected acceptance:

- 6-10 usable music beds after strict listening review.
- 12-18 finished soundscape variants after Recipe V2 packaging.

This is enough to decide whether the route can scale toward the Paid Beta
Baseline without committing to a large generation run.

## Admission gates

Every generated candidate must stay in candidate storage until all gates pass:

1. Origin record gate: model, source repository, checkpoint, code license,
   prompt, seed, generation date, and local output path are retained.
2. Technical gate: decode, duration, sample rate, channels, peak, silence, and
   loudness are valid.
3. No-human gate: no vocals, speech, whispering, chanting, or human-like
   fragments.
4. No-startle gate: first 20 seconds contain no abrupt onset, impact, dark
   swell, alarm-like tone, or cinematic tension.
5. Low-attention gate: no foreground melody hook, drum pattern, obvious pulse,
   chorus/drop behavior, or active song structure.
6. Loop/repetition gate: 30-minute repetition does not expose fatigue,
   obvious seams, or irritating cycles.
7. Scene-fit gate: Calm and Focus are perceptually distinct without relying on
   titles.
8. Rights gate: model and output terms remain compatible with commercial
   product use; any uncertainty keeps the candidate out of public assets.
9. Combination gate: in Recipe V2, organic/environment layers remain below
   attention and do not turn the music bed into a noisy mix.
10. Promotion gate: only promoted files may enter approved asset catalogs,
    public playback, offline playback, or rendered works.

## Rejection rules

Reject immediately if a candidate has any of these qualities:

- festive, cheerful, triumphant, cinematic, horror, suspense, dark ritual, or
  sentimental trailer emotion;
- obvious drums, pulse, metronomic arpeggio, sidechain pumping, or dance-music
  motion;
- vocal, choir, humming, whisper, lyric-like artifact, or speech-like texture;
- bright bell, notification-like tone, sharp pluck, sudden swell, or impact;
- strong memorable melody that becomes the thing the user listens to;
- generic filler variation that exists only to increase count.

## Promotion path after listening

```text
ACE-Step candidate WAV
  -> normalized private review copy
  -> listening notes and rejects
  -> selected music-bed stems
  -> Recipe V2 finished soundscape batch
  -> content-baseline manifest
  -> owner listening promotion
  -> internal baseline catalog / Discover mapping
```

The first promotion target is not "30 accepted model files." The target is a
small set of self-produced dry stems and music beds that can create
replay-worthy Sleep, Calm, and Focus finished soundscapes without relying on a
full-song model prior.
