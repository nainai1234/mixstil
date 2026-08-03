# Functional Music Prompt Pack V1 — Sleep / Meditation / Focus

Date: 2026-07-17  
Status: prompt standard for small candidate smoke tests only; no generated audio is approved for product use.

## Why V1 replaces the Batch 022 style

Batch 020 and 021 showed that generic calming words are not enough. The model kept turning "sleep", "matte", "near room", or "soft keys" into music that was too emotional, too melodic, or too reverberant.

This V1 prompt pack treats functional music as a controlled production brief, not a vibe sentence. Every candidate must specify:

1. functional use case;
2. genre/style boundary;
3. BPM, key, meter;
4. energy level;
5. instrumentation count and roles;
6. note density and melodic behavior;
7. arrangement/structure limits;
8. production, stereo, and reverb limits;
9. explicit exclusions;
10. listening QA rejection criteria.

## Public prompt sources used

These sources were used for prompt structure and keyword extraction, not for copying melodies or audio.

- ACE-Step structured builder: https://github.com/christinazhang139/ace-music-generation
  - Useful because it builds prompts from fields: genre, BPM, key, time signature, vocals, instruments, feel, mood, energy, and production style.
- MusicGen official docs: https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md
  - Useful because examples are short, concrete audio captions with genre and instrumentation, not abstract wellness copy.
- Claude Code media skill with Suno guide: https://github.com/Hao0321/ai-media-generator/blob/main/references/suno.md
  - Useful because it separates Style from Lyrics and recommends genre, mood/energy, key instruments, production, and BPM.
- Community prompt pattern guide: https://github.com/Hao0321/ai-media-generator/blob/main/references/community-prompt-patterns.md
  - Useful because it summarizes the Suno pattern as four lines: style, production, energy, BPM/key.
- Music prompt generator skill: https://github.com/huangzongjingziliu-png/music-prompt-generator/blob/main/SKILL.md
  - Useful because it analyzes reference music into genre, mood, BPM, mode, instruments, section arrangement, and production requirements.
- Awesome Suno prompts: https://github.com/naqashmunir21/awesome-suno-prompts
  - Useful because successful prompts consistently include exact BPM, key, production terms, and energy notes.
- Cross-platform AI music prompts: https://github.com/suno-ai-farm/awesome-ai-music-prompts
  - Useful because it explicitly says cross-platform prompts benefit from genre tags, mood, instrument names, BPM/key, and production terminology.
- Universal prompt builder: https://github.com/bitburner/universal-prompt-builder
  - Useful because it organizes reusable music prompt tags into ordered sections such as main style, secondary style, vocals, mood, and mix.
- lofi.nvim: https://github.com/willibrandon/lofi.nvim
  - Useful because local MusicGen/ACE-Step usage examples show compact prompts such as "lofi hip hop, jazzy piano, relaxing vibes" and "ambient electronic, slow tempo, dreamy pads"; for SNOOZE these must be constrained to avoid beats and reverb wash.

## Dangerous words for this product

These words may be useful in general music generation, but are dangerous for SNOOZE because they often create excitement, emotional lift, strong melody, or large reverb.

| Dangerous word or pattern | Why it is risky for SNOOZE |
| --- | --- |
| lullaby | Often becomes melodic, sentimental, or emotionally rising. |
| dreamy / dream pop | Often creates lush reverb, shimmer, and emotional atmosphere. |
| ambient without constraints | Often becomes a space-bath wash with long tails. |
| spacious / wide stereo / cavernous | Directly encourages large room and long reverb. |
| cinematic / film score | Encourages narrative movement, drama, swells, or climax. |
| euphoric / uplifting / triumphant | Encourages emotional lift and excitement. |
| build-up / soaring / anthem / chorus | Encourages song structure and energy rise. |
| arpeggiated / pulsing / driving | Encourages motion, implied beat, or groove. |
| lo-fi hip hop without "no drums" | Often produces drums or beat loops. |
| felt piano lead / sax lead / guitar lead | Encourages a foreground melody line. |
| new age | Often becomes glossy, sentimental, and reverberant. |

## Global prompt contract

Every generation prompt should be written in English and follow this order:

```text
Functional [goal] instrumental bed for [scene].
Style: [minimal genre boundary], [non-song / background bed].
Tempo and key: [BPM], [key], [meter].
Energy: [1-3]/10, [low arousal / neutral / steady].
Instrumentation: [one primary instrument], [one support texture], no more than two musical sources.
Performance: [note density], [register], [attack], [melody behavior].
Arrangement: single continuous section, no intro, no verse, no chorus, no bridge, no build, no drop, no climax.
Production: dry tight close mix, short room only, narrow or natural stereo, low high-frequency sparkle, no long reverb tail.
Exclude: [hard negatives].
```

Do not use full song structures, hooks, climaxes, or emotionally descriptive arcs. The correct output should feel useful, almost boring, and easy to ignore.

## Goal-specific prompt templates

### Sleep template

Use for bedtime and return-to-sleep.

```text
Functional sleep instrumental bed for bedtime or returning to sleep.
Style: minimal non-song background music, not a lullaby, not cinematic.
Tempo and key: 44-50 BPM, F major or C major, 4/4.
Energy: 1/10, low arousal, sleepy, plain, emotionally neutral.
Instrumentation: soft low electric piano as the only primary instrument, faint low warm organ support, no more than two musical sources.
Performance: very sparse single notes, long gaps, soft attack, low register, almost no chord movement, no lead melody.
Arrangement: single continuous section, no intro, no verse, no chorus, no bridge, no build, no drop, no climax.
Production: dry tight close mix, short room only, narrow natural stereo, rolled-off highs, no shimmer, no large space.
Exclude: vocals, spoken voice, choir, humming, chanting, lyrics, drums, beat, percussion, pulse, arpeggio, bass line, lead melody, memorable hook, emotional lift, exciting chord progression, cinematic score, lullaby tune, large reverb, long reverb tail, ambient wash, bright bells, alarm-like tone.
```

### Meditation template

Use for voice-free breath attention and quiet sitting.

```text
Functional meditation instrumental support for quiet breath attention.
Style: minimal non-song support tone, not new age, not cinematic, not chant music.
Tempo and key: 52-58 BPM, D major or A minor, 4/4.
Energy: 2/10, stable, grounded, neutral, non-dramatic.
Instrumentation: soft organ-like sustained tone as support, sparse muted electric piano accents, no more than two musical sources.
Performance: extremely slow harmonic movement, no foreground tune, no call-and-response, no rhythmic phrase, no emotional cadence.
Arrangement: single continuous section, no intro, no verse, no chorus, no bridge, no build, no drop, no climax.
Production: close dry mix, short room only, low shimmer, gentle low-mid warmth, no cavern or temple reverb.
Exclude: vocals, spoken voice, choir, humming, chanting, mantra, lyrics, drums, beat, percussion, pulse, arpeggio, lead melody, memorable hook, emotional lift, cinematic score, new age gloss, large reverb, long reverb tail, ambient wash, buzzing drone, bright bell strike.
```

### Focus template

Use for reading and deep work. It should not make the user sleepy, but it must not create excitement or space-bath wash.

```text
Functional focus instrumental bed for reading and deep work.
Style: minimal dry study background, non-song, not lo-fi hip hop, not ambient wash.
Tempo and key: 62-70 BPM, A minor or D minor, 4/4.
Energy: 3/10, steady, neutral, low-distraction, non-emotional.
Instrumentation: muted electric piano or soft Rhodes as the only primary instrument, faint tape-noise or warm analog support texture, no more than two musical sources.
Performance: sparse broken chords with irregular spacing, no lead line, no arpeggio loop, no rhythmic motif, no hook.
Arrangement: single continuous section, no intro, no verse, no chorus, no bridge, no build, no drop, no climax.
Production: dry tight close mix, very short room, narrow natural stereo, low high-frequency sparkle, no wide stereo wash.
Exclude: vocals, spoken voice, choir, humming, lyrics, drums, beat, percussion, pulse, bass line, arpeggio, lead melody, strong tune, memorable hook, emotional lift, exciting progression, cinematic score, large reverb, long reverb tail, spacious reverb, ambient wash, shimmer, bright bells.
```

## Batch 023 smoke-test set

The next smoke test should be six candidates:

1. sleep: dry low electric piano, F major, 46 BPM.
2. sleep: dull warm organ plus sparse low keys, C major, 44 BPM.
3. meditation: grounded organ-like tone, D major, 54 BPM.
4. meditation: muted low piano and soft support tone, A minor, 56 BPM.
5. focus: dry muted Rhodes, A minor, 64 BPM.
6. focus: close soft electric piano plus tape texture, D minor, 68 BPM.

Listening QA must reject any candidate that is exciting, emotionally rising, strongly melodic, reverberant, space-bath-like, beat-driven, hooky, cinematic, or vocal-like.
