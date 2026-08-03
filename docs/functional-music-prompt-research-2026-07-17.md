# Functional Music Prompt Research — Sleep / Meditation / Focus

Date: 2026-07-17  
Status: research notes for candidate generation only; no audio is approved.

## Why this research pass exists

Batch 020 proved ACE-Step can generate music without obvious fake vocals, but the sleep/focus pieces felt too exciting or too reverberant. Batch 021 improved direction but still produced:

- `focus_matte_near_room_021_004`: exciting, emotional lift, strong tune, large reverb.
- `focus_dry_close_keys_021_003`: “space bath” feeling.
- `sleep_matte_low_motion_021_001`: large reverb and strong melody.

The conclusion is that raw descriptive prompts such as “sleepy”, “matte”, “near room”, and “low motion” are not enough. The next pass should use more explicit music-generation parameters: genre, BPM, key/mode, instrumentation, energy, production style, and forbidden structure.

## Sources checked

### ACE-Step parameterized prompt builder

Source: https://github.com/christinazhang139/ace-music-generation

Useful findings:

- The frontend builds prompts from structured fields rather than a long emotional sentence.
- Its prompt builder serializes: genre, BPM, key/scale, time signature, vocal type, instruments, drum pattern, feel, mood, energy, production style, duration.
- It exposes `Dry / Tight` as an explicit production style opposite to `Spacious / Reverb-heavy`.
- Built-in low-risk anchors include `Instrumental`, `Peaceful`, `Dreamy`, `very low energy`, `low energy`, `No Drums`, `Lo-fi`, `Vintage / Analog`, and `Dry / Tight`.

Relevant files:

- https://github.com/christinazhang139/ace-music-generation/blob/main/app/lib/caption-builder.ts
- https://github.com/christinazhang139/ace-music-generation/blob/main/app/lib/constants.ts
- https://github.com/christinazhang139/ace-music-generation/blob/main/app/lib/presets.ts

### MusicGen / AudioCraft official docs

Source: https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md

Useful findings:

- Official examples are compact style descriptions such as “happy rock”, “energetic EDM”, “sad jazz”, or “80s pop track with bassy drums and synth”.
- This supports using concise, high-signal musical attributes rather than long prose.
- The example write path normalizes output with loudness control; for our pipeline, generated candidates should remain review-only and then get separate loudness/peak processing after listening approval.

### Lo-fi / ambient local generation project

Source: https://github.com/willibrandon/lofi.nvim

Useful findings:

- Public usage examples for low-distraction local generation use compact phrases:
  - `lofi hip hop, jazzy piano, relaxing vibes`
  - `ambient electronic, slow tempo, dreamy pads`
  - `chill ambient`
- This is useful for naming, but `lofi hip hop` and `ambient` can also pull the model toward beats or large reverb. For our product, those terms should be constrained with `no drums`, `no beat`, `dry/tight`, and `short room`.

### ACE-Step prompt extraction workflow

Source: https://github.com/alanzou/music-prompt-generator/blob/master/prompt_template.py

Useful findings:

- The analyzer asks for explicit musical characteristics: genre tags, mood, instruments, BPM, key, time signature, vocals, energy, structure, and a comma-separated style prompt.
- This reinforces the move from mood-only prompts to a reusable prompt schema.

### Suno / Udio prompt and field guides

Sources:

- https://github.com/daveshap/suno
- https://github.com/mttkllr/suno-field-guide
- https://github.com/naqashmunir21/awesome-suno-prompts
- https://github.com/yzfly/awesome-music-prompts

Useful findings:

- Suno/Udio and MusicGen-style tools use different prompt paradigms, but they agree on the same core ingredients: genre/function, mood, instruments, BPM/key, production, and structure.
- Style prompts should stay focused. Long prompt lists dilute the result; contradictory production terms are especially harmful.
- Concrete musical terms work better than vague adjectives. Public guides repeatedly recommend BPM, key, instrumentation, production, energy, and mixing approach.
- Community guides emphasize using explicit excludes for unwanted elements. For our domain, this is critical for vocals, beat, chorus, build/drop, reverb wash, and cinematic movement.
- Public prompt collections directly flag background/study music as low energy, no jarring elements, calm tempo, and instrumental-focused.
- Several example “meditation” prompts in broad prompt collections include drums, 808s, high BPM, or heavy reverb. Those are useful negative examples for our platform: meditation as a label alone is not enough.

See the derived prompt library:

- `docs/functional-music-prompt-library-2026-07-17.md`

## Prompt rules for the next batch

### Required positive anchors

Use these in every candidate:

- `instrumental`
- `very low energy` or `low energy`
- explicit BPM: sleep/meditation 45–60 BPM, focus 60–75 BPM
- explicit key/scale: C major, D major, F major, or A minor only
- sparse instrumentation: one primary instrument plus one support texture
- `dry/tight production` or `short room production`
- `no song structure`
- `no chorus`
- `no build`
- `no drop`
- `no climax`

### Avoid or tightly constrain

These words caused or may cause the wrong behavior:

- `lullaby`: can become emotionally tuneful or exciting.
- `cinematic`: can create drama.
- `spacious`, `ambient`, `dreamy`, `pad`: can create large reverb or wash.
- `lo-fi hip-hop`: can create beats.
- `felt piano`: can become a melody lead.
- `new age`: can become glossy, reverberant, or sentimental.

### Candidate archetypes to test

Do not test “nice music”. Test utilitarian backing beds:

1. Sleep: low-register, sparse, no melody, no pad wash.
2. Sleep: plain sustained tones, dull electric piano, no emotional cadence.
3. Focus: dry/tight lo-fi study texture without drums or beat.
4. Focus: neutral electric piano support, no lead line, no reverb tail.
5. Meditation: stable tanpura-like or organ-like support, but no drone buzz and no chanting.

## Batch 022 generation policy

Generate only a small smoke test after this research pass. Do not produce a full batch until at least one candidate has the right product feeling.

Suggested first 022 smoke test:

- 2 sleep candidates
- 2 focus candidates
- 1 meditation candidate

Hard reject after listening:

- exciting
- emotional lift
- strong tune
- memorable melody
- large reverb
- long tail
- space-bath wash
- beat or implied beat
- cinematic movement
- fake vocals or choir-like vowels
