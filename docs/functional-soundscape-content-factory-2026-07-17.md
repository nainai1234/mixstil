# SNOOZE Functional Soundscape Content Factory

Date: 2026-07-17  
Status: supersedes the music-led wording in Batch 018 planning

## User listening decision

Project-owner listening confirmed that the self-produced direction is useful,
but the output must not be framed or prompted as generic music or cinematic
audio. Any vocal or vocal-like artifact sounds fake and weakens the product.

Therefore the next generation stream targets functional scene content for:

- meditation without voice;
- sleep and return-to-sleep;
- focus and low-distraction work;
- calm emotional settling.

The product goal is a useful listening state, not a song, score, film cue,
trailer pad, or AI music demo.

## Updated production rule

Old framing:

```text
AI music bed -> soundscape
```

New framing:

```text
functional scene brief
  -> voice-free soundscape foundation
  -> long-listen QA
  -> Recipe V2 finished content
```

Generated content must be judged by whether it supports a use case:

- "I can meditate with this without being distracted."
- "I can fall asleep or return to sleep with this."
- "I can focus with this in the background."
- "I can calm down without feeling pushed by a song or movie cue."

## Routing

| Goal | Default route | Why |
| --- | --- | --- |
| Sleep | deterministic procedural synthesis + approved quiet layers | Lowest risk of fake voice, pulse, climax, and emotional over-coloring |
| Return to sleep | deterministic procedural synthesis + very restrained Recipe V2 arrangement | Needs predictable, non-startling continuity |
| Meditation | deterministic procedural synthesis first; ACE-Step only for non-vocal support candidates | Meditation content fails quickly if it sounds like fake singing or a film score |
| Focus | ACE-Step may produce candidate support layers, but only under strict no-vocal/no-song prompts | Focus can tolerate slightly more structure, but not melody hooks or lyrics |
| Calm | ACE-Step may produce candidate support layers if they remain ordinary, non-cinematic, and voice-free | Useful for emotional color, but easy to overdo |

## Hard rejection update

Reject any candidate with:

- audible voice, fake voice, vowel-like pad, choir, humming, chanting, whisper,
  breathy human texture, or lyric-like artifact;
- film, trailer, fantasy, cinematic, heroic, sentimental, suspense, horror, or
  spiritual-choir feeling;
- song structure, foreground melody, hook, beat, pulse, arpeggio, drop, or
  climax;
- anything that feels like "music to listen to" instead of "environment to use";
- claims or naming that imply therapy, cure, treatment, brainwave effect, or
  guaranteed outcome.

## Batch 018 status

Batch 018 produced five useful exploratory ACE-Step candidates before being
stopped. They remain candidate-only. They may inform prompt direction, but they
are not approved assets and should not be expanded under the same "music bed"
brief.

## Batch 019 target

Batch 019 is the first functional soundscape foundation batch.

Manifest:

```text
docs/functional-soundscape-foundation-batch-019.json
```

Generation:

```bash
pnpm generate:functional-soundscape-batch-019
```

It uses deterministic procedural synthesis for 12 voice-free foundations:

- 4 sleep / return-to-sleep foundations;
- 4 meditation foundations;
- 4 focus foundations.

The target is not final public catalog depth. The target is to create a safer
foundation layer set that can later be packaged into finished Recipe V2
soundscapes.

## Batch 019 listening result

Project-owner listening rejected Batch 019 as a product direction:

> Cannot be used for meditation, sleep, or focus. The batch sounds like anxious
> buzzing and is uncomfortable.

This overrides the 12/12 machine QA pass. The lesson is that acoustic technical
validity does not imply product usefulness. Pure procedural drone/buzz
foundations must not be used as the main route for meditation, sleep, or focus
content.

Rejected direction:

- pure sustained synthesized buzz as the audible subject;
- therapeutic-looking frequency pads with no musical comfort;
- machine-pass foundations that feel physically tense or irritating;
- judging content by LUFS/peak/duration before listening-state usefulness.

Next direction:

- borrow structural principles from hypnosis and meditation music, not protected
  source audio;
- create gentle musical soundscapes with soft harmonic movement, slow breathing
  arcs, and familiar calming instrument textures;
- avoid fake voice, choir, vowel pads, cinematic scoring, and foreground drone;
- judge candidates by whether they actually support meditation, sleep, or focus.

## Batch 020 target

Batch 020 is the corrective music-like functional soundscape batch.

Manifest:

```text
docs/meditation-sleep-focus-music-batch-020.json
```

Generation:

```bash
pnpm generate:meditation-sleep-focus-batch-020
```

The first run should be small and smoke-tested: one meditation candidate, one
sleep candidate, and one focus candidate before any full expansion.
