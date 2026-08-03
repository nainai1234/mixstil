# Functional Music Prompt Library — Meditation / Sleep / Focus

Date: 2026-07-17  
Status: prompt library for local candidate generation only. No prompt here approves an audio asset for product use.

## Source pattern summary

This library combines four public prompt patterns:

1. **ACE-Step parameter builders** use structured fields: genre, BPM, key, instruments, mood, energy, production style, duration.
2. **Suno/Udio field guides** emphasize short style fields, concrete musical words, BPM/key locks, structure tags, and explicit excludes.
3. **Stable Audio / MusicGen examples** use keyword-stacking: comma-separated genre, mood, instrumentation, BPM, and production terms.
4. **Community prompt guides** warn against vague prompts, contradictory production terms, overlong tag lists, large reverb when asking for lo-fi/intimate music, and unplanned chorus/build/drop structures.

For our product, the prompt must behave like a functional audio prescription, not a song request.

## Global prompt grammar

Every generation prompt should include these eight fields, even if written as one ACE-Step string:

1. **Function:** sleep / meditation / focus background, not entertainment music.
2. **Format:** instrumental, no vocals, no lyrics.
3. **Tempo / key:** explicit BPM and key.
4. **Energy:** very low energy or low energy, never building.
5. **Instrumentation:** 1 lead texture + 1 support texture only.
6. **Density:** sparse notes, long gaps, low variation, no lead line.
7. **Production:** dry/tight, close, short room, controlled top end.
8. **Structure exclusions:** no song structure, no chorus, no build, no drop, no climax.

## Global negative bank

Use these exclusions aggressively:

`no vocals, no spoken voice, no fake voice, no choir, no humming, no chanting, no lyrics, no ooh vocals, no ahh vocals, no wordless vocals, no drums, no beat, no percussion, no pulse, no arpeggio, no bass line, no lead melody, no strong tune, no memorable hook, no chorus, no build, no drop, no climax, no emotional lift, no exciting chord progression, no cinematic score, no suspense, no large reverb, no long reverb tail, no spacious reverb, no ambient wash, no shimmer, no bright bells, no alarm-like tone`

## Terms to avoid unless tightly constrained

- `lullaby`: often becomes tuneful or emotionally sweet.
- `cinematic`: often creates drama or a score-like arc.
- `ambient`: can create large reverb and space-bath wash.
- `dreamy`: can become glossy, sentimental, or washed out.
- `pad`: can become wide reverberant wash.
- `lo-fi hip hop`: often creates beats.
- `felt piano`: often becomes a lead melody.
- `new age`: can become glossy, reverberant, or sentimental.
- `peaceful`: useful only when paired with technical constraints.

## Sleep prompt patterns

### Sleep A — plain low keys

Purpose: bedtime background that does not become a song.

Style-field form:

```text
Minimal instrumental sleep background. 48 BPM. C major. Very low energy. Soft low electric piano and faint warm support tone. Sparse notes with long gaps. Flat harmony. Dry tight production. Close mic. Short room only. Controlled top end. No song structure. No chorus. No build. No drop. No climax.
```

ACE-Step keyword-stack form:

```text
minimal instrumental sleep background, 48 BPM, C major, very low energy, soft low electric piano, faint warm support tone, sparse notes with long gaps, flat harmony, no melodic lead, dry tight production, close mic, short room only, controlled top end, no song structure, no chorus, no build, no drop, no climax, no vocals, no drums, no beat, no percussion, no arpeggio, no strong tune, no emotional lift, no large reverb, no ambient wash
```

### Sleep B — dull warm hold

Purpose: return-to-sleep bed; almost no chord movement.

```text
plain instrumental return-to-sleep music, 45 BPM, F major, very low energy, dull warm sustained electric piano, quiet low organ support, low register, almost no chord movement, sparse note events, no tune to follow, dry tight production, very short room, narrow stereo image, soft high-frequency rolloff, no song structure, no chorus, no build, no drop, no climax, no vocals, no drums, no beat, no percussion, no lullaby melody, no emotional cadence, no spacious reverb, no long tail
```

### Sleep C — near-silence musical bed

Purpose: test whether ACE-Step can produce a music-like sleep bed without melody.

```text
near-silence instrumental sleep bed, 42 BPM, D major, very low energy, low warm sine-like organ tone, occasional muted electric piano note, long pauses, no repeating motif, no melody, no rhythmic grid, dry intimate production, short room reflections only, mono-stable low end, smooth top end, no vocals, no drums, no beat, no percussion, no arpeggio, no chord progression excitement, no chorus, no build, no drop, no climax, no large reverb, no ambient wash
```

## Meditation prompt patterns

### Meditation A — breath anchor

Purpose: stable breath-attention support without chant, drone buzz, or fake voice.

```text
minimal instrumental meditation support, 54 BPM, D major, very low energy, stable soft organ-like tone, sparse low electric piano, slow breath-like volume contour, steady consonant harmony, no tune to follow, dry tight production, short room production, smooth top end, no vocals, no fake voice, no choir, no humming, no chanting, no wordless vocals, no drums, no beat, no pulse, no arpeggio, no lead melody, no emotional lift, no cinematic score, no large reverb, no buzzing drone
```

### Meditation B — handpan avoided, soft resonant tone

Purpose: meditation without handpan clichés becoming melodic or bright.

```text
voice-free instrumental meditation background, 52 BPM, C major, very low energy, soft muted resonant tone, warm low support tone, slow decay but short room, sparse single notes, no melodic phrase, no hook, stable harmony, close dry production, narrow stereo image, no vocals, no spoken voice, no choir, no humming, no chanting, no drums, no beat, no percussion, no shimmer, no bright bells, no cinematic movement, no emotional lift, no large reverb, no ambient wash
```

### Meditation C — grounded low-register room

Purpose: ordinary calm room, not mystical cinematic ambience.

```text
grounded instrumental meditation room tone music, 56 BPM, F major, very low energy, low muted electric piano, subtle warm organ support, ordinary quiet room, close dry mix, short early reflections, minimal harmonic movement, no song structure, no chorus, no build, no drop, no climax, no vocals, no fake voice, no choir, no humming, no chanting, no drums, no pulse, no lead melody, no strong tune, no cinematic score, no suspense, no large reverb
```

## Focus prompt patterns

### Focus A — dry lo-fi without drums

Purpose: study/focus texture, borrowing lo-fi production but rejecting beat behavior.

```text
instrumental lo-fi study background, 68 BPM, A minor, low energy, muted electric piano, soft tape noise texture, dry tight production, close room, short decay, narrow stereo image, low cognitive load, no drums, no beat, no percussion, no bass line, no pulse, no arpeggio, no song structure, no chorus, no build, no drop, no lead melody, no strong tune, no emotional lift, no spacious reverb, no ambient wash, background for reading
```

### Focus B — neutral close electric piano

Purpose: neutral work background, not pretty music.

```text
minimal instrumental focus background for reading, 64 BPM, D minor, low energy, close dry electric piano, quiet warm analog support tone, stable neutral harmony, sparse two-note cells, no memorable phrase, dry tight production, short room production, controlled top end, no vocals, no drums, no beat, no percussion, no pulse, no arpeggio, no lead melody, no chorus, no build, no drop, no climax, no emotional lift, no large reverb, no space-bath wash
```

### Focus C — soft desk-room texture

Purpose: product-friendly desk ambience with music-like tone but no attention capture.

```text
instrumental desk-room focus texture, 72 BPM, C minor, low energy, muted Rhodes-like keys, very quiet analog hiss, dry intimate production, short room reflections, center-focused low end, smooth top end, low variation, no melody lead, no chord progression drama, no drums, no beat, no percussion, no bass line, no arpeggio, no chorus, no build, no drop, no climax, no vocals, no spacious reverb, no ambient wash, no strong tune
```

## Review gates

Reject immediately if a candidate has any of these:

- excitement or emotional lift
- a tune you can remember after one listen
- a chorus-like or build/drop-like structure
- large room, hall, cathedral, or space-bath wash
- fake voice, choir, humming, ooh/ahh vowels
- beat, implied beat, arpeggio, or bass line
- cinematic suspense, sentimental new-age gloss, or trailer-like movement

## Generation policy

Generate only small smoke tests until one prompt family passes listening. A reasonable smoke test is:

- 2 sleep candidates
- 2 focus candidates
- 1 meditation candidate

If none pass, stop ACE-Step prompt iteration and switch to reference-audio analysis: find successful sleep/focus/meditation examples, extract BPM/key/instrumentation/mix traits, then generate or synthesize from those measurements.
