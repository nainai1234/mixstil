# Evidence-Based Audio Content And Materials Plan V1

Date: 2026-07-21  
Status: research baseline for the next content expansion milestone

This document defines what SNOOZE should produce before expanding the audio
inventory. It is a content and engineering specification, not a medical
protocol. The product must not claim to treat insomnia, anxiety, ADHD, or any
other condition.

## 1. What The Research Actually Supports

The evidence supports designing for a listening state and a user's preference,
not a universal healing formula.

| Evidence | Finding | Product consequence |
| --- | --- | --- |
| Cochrane review, `CD010459`, 13 studies and 1007 participants | Prerecorded music probably improves subjective sleep quality. Evidence for insomnia severity, sleep onset, duration, efficiency, and awakenings is low or insufficient. | We can describe a sleep-oriented listening aid, but cannot promise faster sleep or a medical outcome. |
| Trahan et al., PLOS ONE 2018, DOI `10.1371/journal.pone.0206531`, survey `n=651` | 62% reported using music to help sleep. Music choices were highly diverse and did not reveal one universal structure. Reported pathways included routine, mental/physical state, and masking distraction. | Build multiple style families and allow preference memory. Do not train one universal “sleep sound”. |
| Riedy et al., Sleep Medicine Reviews 2021, PMID `33007706` | White noise is proposed as a masking aid, but the review called for better objective measures and detailed acoustic descriptions. | Noise is a controllable masking layer, not the musical identity and not a guaranteed sleep intervention. |
| Buxton et al., PNAS 2021, DOI `10.1073/pnas.2013097118` | Natural sounds are associated with health and restoration outcomes in a synthesis of park-sound studies; human noise changes the result. | Natural environments need their own source, event-density, and human-noise metadata. |
| Bernardi et al., Heart 2006, PMID `16199412` | Physiological arousal tracked musical tempo and emphasis; slow or meditative music was more relaxing in the study context. | Avoid fast tempo, strong accent, and rising emphasis for Sleep and Calm. Tempo is a control, not a treatment claim. |
| de Witte et al., 2020, DOI `10.1080/17437199.2019.1627897` | Music interventions show stress-related effects across heterogeneous studies and outcome measures. | Use listening acceptance and self-report as product signals; do not infer a fixed effect from one waveform feature. |
| Souza et al., 2023, PMC `PMC10162369` | Music with lyrics generally interfered with cognitive performance in the reviewed tasks; instrumental effects were smaller and less certain. | Focus defaults to instrumental, voice-free content. Lyrics are an explicit exclusion in the Beta. |
| Cheah et al., 2022, DOI `10.1177/20592043221134392` | Background-music effects on cognitive tasks were inconsistent across task, music, and population. | Focus content needs task-specific profiles and user preference feedback, not a blanket “focus frequency”. |
| WHO Make Listening Safe | Unsafe recreational listening is a major preventable hearing-risk category; standards should be evidence-based. | Every asset and mix needs peak, loudness, spectral, and long-session safety checks. |

The following are design foundations rather than clinical evidence: Bregman's
Auditory Scene Analysis for separating concurrent layers, Lerdahl and
Jackendoff's hierarchical phrase theory for phrase boundaries, and
Juslin/Vastfjall's multi-mechanism model for musical emotion. They justify
separate stems, predictable phrase structure, and controlled novelty. They do
not justify claims about special frequencies or guaranteed states.

## 2. Content We Need To Produce

The inventory is not just a list of finished songs. It has five cooperating
families.

### 2.1 Music Kits

Each kit is a synchronized, rights-cleared set of five stems:

1. `harmony`: stable tonal bed and chord movement.
2. `melody`: sparse motif or contour; may be absent in Sleep variants.
3. `accompaniment`: restrained instrument texture, never a second lead.
4. `low_support`: low-level warmth and continuity, never a buzzy tone.
5. `transition`: gentle arrival/release material, never a drop or impact.

Every kit must have a distinct style profile:

- goal and scene;
- instrument/source identity;
- mode or scale and allowed pitch register;
- tempo or pulse policy;
- motif length, phrase length, and repetition rules;
- event-density and transient limits;
- brightness and reverb limits;
- arrival, settling, core, and release behavior;
- forbidden characteristics;
- compatible environment and masking layers;
- provenance, rights, seed, renderer version, and acoustic measurements.

### 2.2 Environmental Beds

Rain, ocean, wind, room, forest, and water are not interchangeable noise. Each
asset needs tags for location type, event density, spectral tilt, modulation,
human-made intrusions, loop boundary quality, and foreground-event risk.

Core sleep and calm environments should be first-party recordings, commissioned
recordings, or assets with a documented commercial redistribution license.
Procedural synthesis is suitable for masking and abstract textures, but should
not pretend to be an authentic forest or ocean recording.

### 2.3 Masking And Noise Beds

Maintain controlled variants of brown, pink, and soft white noise with explicit
spectral curves, not arbitrary “white noise” files. Store recommended default
levels and a maximum level. Noise is normally a supporting layer and must never
cover the musical identity by default.

### 2.4 Organic Textures And Accents

Use soft room tone, air, distant water movement, cloth, wood, and other low-
attention textures. Avoid pitched beeps, continuous sine tones, harsh chimes,
mechanical loops, and human voice in Voice-free Beta. Every accent needs a
startle-risk score and a placement policy.

### 2.5 Scenario Arrangements

The same Stem inventory should support multiple deterministic arrangements:

- Sleep: arrival 30-90 seconds, long stable core, very low novelty, gradual
  release or seamless continuation.
- Calm/Meditation: a clear but quiet settling phase, sparse motifs, optional
  natural bed, and no emotional climax.
- Focus: stable low-distraction texture, optional very soft pulse, no lyrics,
  no strong hook, and enough continuity to avoid attention resets.

## 3. Proposed Inventory Target

The current production baseline is six Music Kits and 30 stems. The next
content milestone should target 24 kits and 120 synchronized music stems:

- Sleep: 10 kits, covering bedtime and return-to-sleep.
- Calm/Meditation: 8 kits, covering breathing and emotional settling.
- Focus: 6 kits, covering dry instrumental, warm mid, and low-motion variants.

In parallel, prepare at least 24 masking/noise beds, 30 licensed or first-party
environment beds, and 24 safe transition/accent assets. These are targets for
approved inventory, not a reason to promote unreviewed files.

The machine-readable implementation plan is
[`config/content-inventory-expansion-v2.json`](../config/content-inventory-expansion-v2.json).
It separates renderable profiles from profiles that first require a new or
commissioned instrument source, and validates all inventory totals before any
batch is promoted.

## 4. Generation Architecture

```text
Research profile
  -> StyleProfile and acoustic targets
  -> project-owned deterministic renderer or rights-cleared source
  -> synchronized Stem export
  -> machine acoustic QA
  -> human listening QA
  -> rights/provenance manifest
  -> semantic metadata and compatibility graph
  -> MusicKit / scenario registration
  -> Quick Create inventory routing
```

The preferred production route is project-owned synthesis, controlled
arrangement, and licensed/first-party recordings. A commercial music API is a
background supply-gap tool only:

1. Search approved inventory first.
2. Try a compatible local MusicKit factory or deterministic variant.
3. If exactly one Stem is missing, generate only that Stem.
4. Cache by a normalized gap specification.
5. Require the same QA and rights gates before promotion.
6. Never route a normal request to a full-track external generator.

This makes the API an amortized replenishment cost instead of a per-user audio
cost. Lyria output must not enter production merely because it decoded
successfully; provider terms must explicitly permit the intended commercial
use, storage, derivative mixing, offline replay, and distribution.

## 5. QA Requirements

### Machine gates

- decodes and has the declared duration;
- no clipping and controlled true peak;
- integrated LUFS and loudness range inside the profile target;
- no abnormal silence or long unintended gaps;
- bounded high-frequency energy and transient count;
- no detectable voice for Voice-free Beta;
- loop boundary and crossfade test;
- event-density and motif repetition checks;
- compatibility check against proposed companion Stems.

### Human gates

Reviewers score scene fit, relaxation/attention neutrality, opening safety,
melodic interest without hook pressure, layer balance, loop fatigue, and
startle risk. A technically valid file is not an approved product asset.

### Release metrics

- `inventory_only` at least 85% of representative prompt cases;
- one missing Stem at most 10-12%;
- multi-gap block or fallback below 5%;
- paid external generation below 5% of requests;
- no repeated Kit family should account for more than 35% of accepted results;
- saved/replayed results and explicit exclusions are more important than raw
  generation count.

## 6. What This Means For The Generator

The generator should not receive one loose prompt and improvise a song. It
should receive a structured `ProductionBrief` containing:

- goal, scene, duration, and user exclusions;
- selected StyleProfile;
- required Stem roles;
- mode/register/tempo and motif constraints;
- phase plan;
- compatible environment and masking candidates;
- acoustic targets;
- seed, renderer version, and rights policy.

The generator produces a candidate bundle and a machine-readable manifest. The
composition engine and Recipe V2 decide how the bundle is combined; the
commercial provider is never allowed to decide the whole product arrangement.

## 7. Research Limits

There is no scientifically established “healing frequency”, universal BPM,
universal scale, or one best meditation genre. Preferences, familiarity,
routine, stress, age, task, and sensitivity all matter. We should use research
to constrain risk and design low-distraction options, then use save, replay,
mute, volume reduction, deletion, and refinement behavior to learn which
profiles actually fit our users.

## 8. Source Links

- [Cochrane: Music for insomnia in adults](https://www.cochrane.org/evidence/CD010459_music-insomnia-adults)
- [PLOS ONE: The music that helps people sleep](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0206531)
- [PubMed: Noise as a sleep aid: A systematic review](https://pubmed.ncbi.nlm.nih.gov/33007706/)
- [PNAS: A synthesis of health benefits of natural sounds](https://www.pnas.org/doi/10.1073/pnas.2013097118)
- [PubMed: Cardiovascular, cerebrovascular, and respiratory changes induced by different types of music](https://pubmed.ncbi.nlm.nih.gov/16199412/)
- [Google Scholar result / PubMed record: Music interventions and stress outcomes](https://pubmed.ncbi.nlm.nih.gov/31167611/)
- [PMC: Music with lyrics and cognitive performance](https://pmc.ncbi.nlm.nih.gov/articles/PMC10162369/)
- [SAGE: Background music systematic review](https://journals.sagepub.com/doi/10.1177/20592043221134392)
- [WHO: Making listening safe](https://www.who.int/activities/making-listening-safe)
