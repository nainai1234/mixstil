# AI Composer Reference And Atomic Material Plan V1

Date: 2026-07-21  
Status: approved direction; reference research required before audio production

## 1. Product Definition

The system is not a fixed-track recommender. A consumer describes a desired
Sleep, Calm/Meditation, or Focus result and may select instruments or
environment layers. An LLM converts that request into a structured composition
brief. A composition engine creates a new score and renders it from approved
atomic instrument, environment, and texture materials.

```text
user language and selections
  -> AudioIntent
  -> CompositionBrief
  -> new ScorePlan and note events
  -> atomic instrument and environment inventory
  -> rendered personalized music
  -> QA, save, and deterministic replay
```

Reference tracks inform constraints and quality. They are not copied, split
into consumer stems, or returned as the normal generated result.

## 2. Reference Evidence Hierarchy

No track becomes a reference merely because it is labelled meditation or has a
large play count. Each reference needs three separate evidence records:

1. Demand evidence: long-term plays, saves, chart/category presence, or
   repeated positive user feedback from a named platform.
2. Scene-fit evidence: listening review and acoustic/musicological analysis
   showing why it fits Sleep, Calm/Meditation, or Focus.
3. Rights boundary: whether audio may be downloaded, analyzed internally,
   reproduced, transformed, or only used as a high-level listening reference.

Research and textbooks define general constraints. Popularity demonstrates
demand, not therapeutic efficacy. Copyrighted melody, recording, lyrics, and
distinctive arrangement must not be copied. Only high-level characteristics
such as tempo, register, density, instrumentation, dynamics, and form may be
used when the reference is not licensed for transformation.

## 3. Twenty-Four Reference Slots

The reference set contains 10 Sleep, 8 Calm/Meditation, and 6 Focus slots.
Each slot represents a distinct style and instrument hypothesis:

### Sleep: 10

1. Low-register soft piano.
2. Minimal felt piano.
3. Piano with distant rain.
4. Piano with distant ocean.
5. Warm low Rhodes.
6. Soft acoustic or nylon guitar.
7. Piano with restrained low strings.
8. Sparse soft harp.
9. Beatless environmental music.
10. Nocturnal nature with minimal instrumentation.

### Calm/Meditation: 8

1. Breath-shaped piano.
2. Open-chord acoustic guitar.
3. Sparse harp.
4. Pentatonic piano.
5. Restrained woodwind or flute.
6. Dry low-density Rhodes.
7. Soft string texture.
8. Natural environment with a minimal melodic voice.

### Focus: 6

1. Dry Rhodes without drums.
2. Stable common-tone piano.
3. Low-density acoustic guitar.
4. Beatless repeating harmonic cycle.
5. Stable tonal bed with minimal motif.
6. Quiet environment plus restrained instrument.

These are research slots, not yet validated tracks. A slot becomes validated
only when its source and complete analysis record exist.

## 4. Required Analysis Per Reference

Every reference record must include:

- source platform, URL, title, artist/creator, and observation date;
- demand signal and its measurement date;
- goal and scene;
- instrument identities and roles;
- tempo or free-time policy, meter, key/mode, and register;
- note density, motif length, phrase length, and repetition behavior;
- chord-change rate and harmonic complexity;
- attack strength, dynamic range, brightness, and reverb character;
- arrival, stable core, and release behavior;
- perceived arousal curve and any unsafe or distracting events;
- which high-level properties may inform original generation;
- rights boundary and whether audio reuse is prohibited.

## 5. Instrument Matrix Derived From References

The instrument list is not fixed before research. The initial hypotheses are
soft piano, Rhodes, acoustic/nylon guitar, harp, soft strings, warm bass, and a
restrained woodwind family. A family enters atomic-material production only if:

1. at least two validated references or a strong scene-specific reason support
   its use;
2. its safe register and articulation are documented;
3. the selected commercial API can generate consistent isolated samples;
4. pitch, timbre continuity, voice absence, and commercial-rights QA pass.

## 6. Atomic Material Production

After reference approval, commercial APIs produce two levels of material:

- Atomic pitched material: one instrument, one pitch, one articulation, one
  velocity class, no chord, no accompaniment, and no background music.
- Non-pitched material: one environment or one low-attention texture with no
  melody, beat, voice, or mixed scene.

Scales, chord vocabularies, progression grammars, rhythm cells, motif rules,
form plans, orchestration rules, and scene exclusions are symbolic knowledge,
not audio assets.

The first proposed production target remains subject to reference findings:

- 24 reference tracks for calibration and validation;
- 192 atomic pitched samples across supported instruments;
- 36 environment elements;
- 48 textures and safe accents.

No atomic material is generated until the reference set and instrument matrix
are approved by the project owner.

## 7. Composition Contract

The LLM must output a constrained `CompositionBrief`, never an audio filename:

- goal, scene, duration, and explicit exclusions;
- tempo, meter, mode/key, register, density, and arousal ceiling;
- instrument roles and environment ratios;
- harmony, motif, phrase, and form constraints;
- variation seed and replay identifier;
- acoustic safety targets.

The composition engine creates a new score from symbolic rules and atomic
materials. Saved results retain the score, seed, selected materials, and mix so
replay is deterministic while a new generation may produce a different work.

## 8. Gates

1. Reference gate: 24 sourced and analyzed records with complete rights
   boundaries.
2. Instrument gate: instrument families and safe ranges approved.
3. Provider gate: isolated-sample and environment generation capabilities
   proven with a small paid test.
4. Atomic-material gate: every element individually audible, accurately
   labelled, consistent, and rights-cleared.
5. Composition gate: the same intent generates at least six structurally
   different works that all respect the intent and exclusions.
6. Product gate: accepted results can be refined, saved, and replayed without
   calling the commercial music API again.

