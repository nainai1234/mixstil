# SNOOZE Global Calming Music Style and Generator Evolution Plan

Date: 2026-07-18  
Status: active composition-engine execution plan  
Scope: self-produced, voice-free Sleep, Calm, Meditation, and Focus music

## 1. Authority and product boundary

This document converts listening feedback and external music research into an
ordered implementation plan for the SNOOZE controlled composition engine.

It is subordinate to:

1. [Project Mainline Charter](./project-mainline-charter.md).
2. [ToC Product Development Master Plan](./toc-product-development-master-plan.md).
3. [Personalized Audio Generation Plan V2](./personalized-audio-generation-plan-v2.md).
4. [Music Generation Route Decisions](./music-generation-route-decisions-2026-07-17.md).

This is not a plan for a generic AI song generator. The production objective is:

> Produce rights-safe, musically distinct, low-stimulation music that a user is
> willing to save and replay, then combine it with optional approved environment
> layers through Recipe V2.

The music generator produces clean music masters. Rain, ocean, forest, colored
noise, and accents remain separate Recipe V2 tracks so users can add, remove,
mute, delay, or rebalance them without regenerating the composition.

## 2. Research conclusion

There is no single globally universal form of calming or so-called healing
music. Popular content spans several different listening jobs:

- Sleep: low event density, low dynamic range, no attention-seeking climax, and
  long-session continuity.
- Calm and emotional settling: recognizable melody, gentle narrative movement,
  and a stable return.
- Meditation: spacious phrasing, organic timbre, controlled repetition, and no
  intrusive rhythm.
- Focus: predictable motion and continuity without strong downbeats, vocals, or
  emotional escalation.

Preference also varies by cultural familiarity, instrument timbre, tolerance
for rhythm, sensitivity to high frequencies, and whether the user wants music
or a pure soundscape. Therefore the engine must not have a single `slow piano`
template. It needs independent `StyleProfile` definitions with independent
melody, rhythm, accompaniment, form, performance, and rejection rules.

### 2.1 Market and user signals

The following public signals demonstrate demand, not therapeutic efficacy:

- Peder B. Helland's long-form ambient sleep track
  [Flying](https://www.youtube.com/watch?v=1ZYbU82GVz4) showed roughly 520
  million views and 2.84 million likes during the 2026-07-18 review.
- Soothing Relaxation's
  [piano and water content](https://www.youtube.com/watch?v=77ZozI0rw7w) showed
  roughly 270 million views. This supports `melodic music + restrained
  environment layer` as a mature content shape.
- The public search sample also included an eight-hour sleep-music item at
  roughly 110 million views, a Celtic relaxation item above 5 million views,
  and Japanese koto/Zen content above 1 million views.
- Insight Timer exposes a large catalog across Yoga Nidra, long-form sleep
  music, piano, nature sound, ambient soundscape, and guided content rather
  than one dominant music formula.
- Reddit discussions explicitly ask for
  [meditation music that is not clichéd](https://www.reddit.com/r/Meditation/comments/7wl4c4/any_recommendations_for_meditation_music_that/)
  and compare
  [which background sound or music works best](https://www.reddit.com/r/Meditation/comments/1an6mnp/what_background_soundmusic_do_you_find_works_best/).
- Highly liked YouTube comments repeatedly described returning to the same
  track, using it for sleep or study, and valuing uninterrupted playback and
  the absence of advertising or sudden disruption.

These signals do not prove that a frequency, instrument, scale, or track treats
any condition. SNOOZE must describe content as designed for a listening context,
not as medically effective.

### 2.2 Melody research translated into engine rules

Research on musical hooks, expectation, repetition, and involuntary musical
imagery supports a practical design principle: memorable music balances
recognition with controlled variation.

Engine rules:

- Introduce a recognizable three-to-five-note motif within the first 20 seconds.
- Use question and answer phrases instead of rotating through a pitch array.
- Repeat the motif three to five times, but allow at most two exact repetitions.
- Keep most movement stepwise or in thirds; follow a larger leap with
  stepwise movement in the opposite direction.
- Create one restrained pitch high point without making it an amplitude climax.
- Change one main variable at a time during development: ending, rhythm,
  register, or harmony.
- Return to recognizable material before the release section.
- Simplify or remove notes during a Sleep release instead of adding a final
  emotional lift.

Supporting references:

- [Dissecting an earworm](https://doi.org/10.1037/aca0000090).
- [Auditory Expectation](https://doi.org/10.1111/j.1756-8765.2012.01214.x).
- [The Effects of Repetition on Liking for Music](https://doi.org/10.2307/3345279).
- [Hooks in Popular Music](https://doi.org/10.1007/978-3-031-19000-1).

## 3. Global style matrix

The matrix defines composition families, not claims that every listener from a
region prefers a given style.

| Style family | Musical language | Primary scenes | Generator risk |
| --- | --- | --- | --- |
| Peaceful piano / neoclassical | 3-5 note motifs, 4/4 or 3/4, rubato, restrained functional harmony | Calm, Sleep | Shared templates make every piece sound the same |
| Ambient / New Age | Long harmony, weak meter, slow timbral change | Sleep, Meditation | Sustained tones become buzz or synthetic drone |
| Acoustic guitar light music | 6/8 wave motion, warm broken chords, lyrical pickup | Calm, evening unwind | Hard plucks and forward motion feel hurried |
| Soft jazz / Rhodes | add9 and maj7 color, light syncopation, 55-72 BPM | Focus, Calm | Bass and reverb create a lounge or bar identity |
| Lo-fi / chillhop | Stable short cycles, 65-82 BPM, muted percussion | Focus | Beat becomes foreground and is unsuitable for Sleep |
| Slow rock / lyrical folk | Guitar and piano, weak backbeat, 60-76 BPM | Calm | Song build, heavy downbeat, or chorus escalation |
| Chinese pentatonic | Gong and Yu modal colors, guzheng, xiao, dizi, erhu | Calm, Meditation | Bright plucks and upper flute become piercing |
| Japanese contemplative | Ma-informed space, in/yo colors, koto and shakuhachi | Meditation, Calm | Excessive silence feels empty rather than spacious |
| Indian slow raga / alap | Free melodic unfolding, drone support, bansuri | Meditation, Sleep | Tabla or dense ornament creates active rhythm |
| Celtic lyrical | Dorian/Mixolydian color, 6/8, harp and low flute | Calm, Sleep | Becomes cinematic, heroic, or travel music |
| Nordic ambient folk | Modal piano, low strings, cool sparse texture | Sleep, Calm | Low sustained tone becomes buzz or ominous drone |
| Middle Eastern ney / oud | Maqam color, free introduction, controlled ornament | Meditation, Calm | Ornament density captures too much attention |
| West African kora / mbira | Gentle interlocking patterns and bright plucks | Focus, Calm | High-frequency attacks and polyrhythm become busy |
| Latin bossa / slow bolero | Nylon guitar, warm harmony, restrained syncopation | Calm, Focus | Pulse becomes too explicit for meditation or sleep |

### 3.1 Cultural implementation rule

Changing an instrument patch does not create a culturally grounded style. A
profile must define all of the following:

```text
scale and allowed tones
motif contour
meter and tempo
ornament vocabulary
phrase and cadence rules
accompaniment grammar
traditional instrument roles
dynamic and emotional arc
supported product scenes
forbidden features
compatible environment layers
```

Do not label a piece with a cultural or traditional style until its profile and
instrument source have been reviewed. Do not simulate koto, shakuhachi, ney,
oud, guzheng, or bansuri by pitch-shifting a piano sample. Missing
commercial-compatible instrument sources block that profile from production.

### 3.2 Evidence hierarchy

Different sources answer different questions. They must not be merged into one
undifferentiated claim of effectiveness.

| Evidence layer | What it can answer | What it cannot answer | Product use |
| --- | --- | --- | --- |
| Composition and orchestration textbooks | How motives, phrases, harmony, form, timbre, and arrangement work | Whether a piece improves sleep or focus | Implement musical grammar |
| Music cognition research | How expectation, repetition, familiarity, preference, and attention may interact | A universal recipe for every listener | Set hypotheses and QA features |
| Clinical and systematic reviews | Whether music interventions show aggregate outcome signals | Which exact style, BPM, key, frequency, or instrument will work for one user | Conservative product boundaries |
| Platform rankings and play counts | Which content shapes attract large audiences | Therapeutic efficacy or long-term satisfaction | Select families worth testing |
| Reviews, comments, and forums | User language, frustrations, use cases, and reasons for returning | Representative population-level conclusions | Build feedback taxonomy |
| SNOOZE save/replay/exit data | Whether a result creates product value for our users | Medical benefit | Promote, demote, and personalize profiles |

Research findings become generator rules only when the translation is explicit.
For example, `preference and familiarity matter` becomes `retain multiple style
families and learn explicit user preferences`; it does not become `one familiar
major-key melody is best for sleep`.

### 3.3 Composition and production curriculum

The generator should be informed by established composition knowledge rather
than prompt collections alone. The following materials are reference curricula,
not datasets to copy into the product.

| Area | Reference | Knowledge to extract | Generator artifact |
| --- | --- | --- | --- |
| Motive and development | Arnold Schoenberg, *Fundamentals of Musical Composition* | motive identity, variation, sentence, period, continuation | motif transformations and phrase plans |
| Formal function | William Caplin, *Classical Form* | initiating, medial, and cadential function; formal expectation | section roles and form graphs |
| Melody writing | Jack Perricone, *Melody in Songwriting* | contour, motif rhythm, phrase balance, harmonic implication | melody grammar and hook timing |
| Harmony and voice leading | Aldwell, Schachter, and Cadwallader, *Harmony and Voice Leading* | common-tone retention, bass motion, tendency tones, cadence | harmonic planner and voice-leading cost |
| Integrated tonal craft | Steven Laitz, *The Complete Musician* | phrase, harmony, counterpoint, and form as one system | cross-layer validation |
| Orchestration | Samuel Adler, *The Study of Orchestration* | playable ranges, register color, balance, doubling, attack character | instrument-role and register rules |
| Jazz harmony | Mark Levine, *The Jazz Theory Book* and *The Jazz Piano Book* | modal color, extended chords, voicing, harmonic rhythm | Rhodes/soft-jazz profile only |
| Musical expectation | David Huron, *Sweet Anticipation* | expectation, surprise, statistical learning, tension | predictability and novelty budget |
| Repetition and memory | Elizabeth Margulis, *On Repeat* | repetition, segmentation, attention, and musical meaning | repetition and variation limits |
| Popular-music analysis | Philip Tagg, *Everyday Tonality II* | loops, grooves, modal harmony, popular-music syntax | non-classical profile vocabulary |
| Mixing | Mike Senior, *Mixing Secrets for the Small Studio* | foreground/background, masking, dynamics, spatial hierarchy | mix-role checks |
| Mastering | Bob Katz, *Mastering Audio* | loudness, dynamics, translation, and listening fatigue | scene-aware mastering targets |
| Cultural context | *The Garland Encyclopedia of World Music* and regional scholarship | instrument function, tuning, form, social context | cultural profile research record |

Learning procedure:

1. Record the concept and source chapter in a research note.
2. Translate it into a small testable rule or metric.
3. Create positive and negative event-plan fixtures.
4. Generate an A/B comparison changing one concept at a time.
5. Keep the rule only if listening evidence improves the intended scene.

Do not train on, transcribe, or copy copyrighted book examples, scores, MIDI,
recordings, or named melodies. Implement general principles in original event
plans. Public-domain works still require an edition and arrangement rights
check before any score or audio is used as machine input.

### 3.4 Scientific research map

The current evidence supports pluralism and conservative claims, not a magic
tempo or frequency.

| Question | Research signal | Generator implication | Limit |
| --- | --- | --- | --- |
| Does music help some adults with sleep? | [Cochrane 2022](https://doi.org/10.1002/14651858.cd010459.pub3) reviewed 13 studies and 1007 participants and found evidence for some subjective sleep-quality improvement | Maintain a Sleep music family and long-session QA | Does not identify a universal genre, BPM, key, or sequence |
| What music do people use for sleep? | [Trahan et al. 2018](https://doi.org/10.1371/journal.pone.0206531) found broad diversity in reported music and reasons | Build multiple families and preference memory | Self-reported use is not clinical efficacy |
| Does music affect stress-related outcomes? | [de Witte et al.](https://doi.org/10.1080/17437199.2019.1627897) reported aggregate effects across heterogeneous interventions | Test low-arousal Calm content | Heterogeneity prevents one composition prescription |
| Do preference and familiarity matter? | [Tan et al. 2012](https://doi.org/10.1093/jmt/49.2.150) examined preference, familiarity, and psychophysical properties together | Store explicit style and timbre preferences; offer variants | Familiar is not always suitable, especially for attention-demanding tasks |
| Can background music affect attention? | [Mendes et al. 2021](https://doi.org/10.1080/87565641.2021.1905816) reviewed mixed attention effects | Focus profiles must be tested by task and user, not labeled by tempo | Music may distract some users |
| What is the aggregate background-music effect? | [Kämpfe et al.](https://doi.org/10.1177/0305735610376261) found effects vary by behavior and context | Keep `music off` and pure soundscape as valid outcomes | No universal productivity soundtrack |
| How do melody and popularity relate to involuntary recall? | [Jakubowski et al. 2017](https://doi.org/10.1037/aca0000090) linked melodic features and popularity with involuntary musical imagery | Calm content may use a restrained hook; Sleep must limit attention capture | Earworm potential is not always desirable |
| How does repetition affect liking? | [Hargreaves 1984](https://doi.org/10.2307/3345279) supports a non-monotonic relationship between repetition and liking | Repetition needs controlled variation and fatigue QA | Optimal exposure differs by listener and material |
| Are there musical universals? | [Mehr et al. 2019](https://doi.org/10.1126/science.aax0868) documented both universality and diversity in human song | Share low-level descriptors while preserving cultural profiles | Cross-cultural regularities do not justify generic ethnic imitation |
| What about natural sounds? | A [PNAS review](https://pubmed.ncbi.nlm.nih.gov/33753555/) synthesized 36 studies with some positive outcome signals | Keep nature as optional, independently controllable layers | Does not prove rain, water, or birds suit every listener |

Research updates should record population, intervention duration, comparison,
outcome type, effect direction, uncertainty, and whether the study used
self-selected or researcher-selected music. A title or abstract alone is not
enough to set an acoustic threshold.

### 3.5 Reference repertoire and popularity examples

Reference works are used to study abstract structure, not as training audio,
source material, MIDI, melody, harmony transcription, or style-cloning targets.

| Family | Reference examples | What to study | What not to inherit |
| --- | --- | --- | --- |
| Long-form ambient sleep | Peder B. Helland, *Flying*; Brian Eno, *Music for Airports 1/1* | long continuity, overlapping layers, low event pressure, stable return value | exact texture, harmony, melody, or marketing claims |
| Peaceful piano | Erik Satie, *Gymnopédie No. 1*; Bill Evans, *Peace Piece* | sparse phrase timing, ostinato stability, common-tone harmony | recognizable melody or chord transcription |
| Popular lyrical piano | Yiruma, *River Flows in You*; Ludovico Einaudi, *Nuvole Bianche* | early motif identity, contour, repetition with escalation | late emotional build for Sleep, or any melodic imitation |
| East Asian lyrical orchestration | Joe Hisaishi, *One Summer's Day*; traditional Chinese `Pinghu Qiuyue` and `Yuzhou Changwan` repertoires | motif return, pentatonic color, register and instrumental dialogue | named themes, arrangements, or cinematic climax |
| Japanese contemplative | shakuhachi honkyoku repertoire such as `Kokū`; koto repertoire such as `Rokudan no Shirabe` | breath-shaped phrase, ma, timbral decay, sectional pacing | assuming silence alone creates meditation value |
| Indian contemplative | Raga Yaman or Darbari alap practice | characteristic tones, slow exposition, drone relationship, ornament hierarchy | copying a performance, adding generic tabla, or treating raga as a scale preset |
| Celtic / New Age | Enya, *Watermark*; Secret Garden, *Song from a Secret Garden* | modal color, harp/string balance, lyrical spaciousness | choir/vocal texture, heroic or cinematic rise |
| Soft jazz / Rhodes | Bill Evans, *Peace Piece*; slow modal and ECM-style repertoire | voicing, common tones, restrained harmonic color | walking bass, solo density, club ambience, or large room sound |
| Bossa / slow Latin | Antônio Carlos Jobim, *Corcovado* and *Wave* | gentle syncopation, nylon-guitar balance, understated harmony | vocal melody, foreground percussion, or dance emphasis |
| Focus loops | Lofi Girl editorial streams and low-distraction study playlists | session continuity, stable loop identity, low foreground change | vinyl noise as mandatory filler, heavy kick/snare, or copied loops |
| Marketed relaxation | Marconi Union, *Weightless* | gradual texture, restrained pulse, continuous arc | unverified claims that one track or tempo is scientifically optimal |

Popularity is a discovery signal. It is biased by channel size, platform age,
SEO wording, thumbnails, autoplay, playlist placement, advertising, and existing
artist fame. Store, when visible:

- observation date, platform, region, and query;
- views/plays, likes, comments, saves, playlist placement, and content age;
- duration, release type, artist/channel size, and advertising interruptions;
- user-stated use cases and return reasons;
- complaints about volume, repetition, interruption, timbre, or emotional fit;
- whether the item is music, guided content, nature sound, or a hybrid;
- whether musical structure was actually listened to or only inferred from
  title and metadata.

Do not compare raw lifetime view totals across platforms as if they were a
quality ranking. Prefer normalized signals such as replay, saves per listener,
completion, negative feedback, and age-adjusted engagement when available.

### 3.6 Style-to-goal applicability

The same style is not automatically valid for every goal.

| Family | Sleep | Calm | Meditation | Focus |
| --- | --- | --- | --- | --- |
| Peaceful piano | Yes, reduced motif and falling density | Yes | Conditional | Conditional |
| Ambient / New Age | Yes, after buzz and ominous-tone gates | Yes | Yes | Conditional |
| Acoustic guitar | Conditional, very soft attack | Yes | Limited | Yes, if pulse is stable |
| Soft jazz / Rhodes | No by default | Conditional | No by default | Yes, dry and brushless |
| Lo-fi / chillhop | No | Conditional | No | Yes, soft-beat option only |
| Slow rock / folk | No | Yes, without chorus build | No | Conditional |
| Chinese contemplative | Conditional | Yes | Yes | Conditional |
| Japanese contemplative | Conditional | Yes | Yes | Limited |
| Indian alap | Yes, when sparse and voice-free | Yes | Yes | Limited |
| Celtic lyrical | Conditional | Yes | Conditional | Conditional |
| Nordic ambient | Yes | Yes | Yes | Conditional |
| Ney / oud | Conditional | Yes | Yes | Limited |
| Kora / mbira | No by default | Yes | Conditional | Yes |
| Bossa / bolero | No | Yes | No by default | Yes, low syncopation |

`Conditional` means a separate goal variant with different density, form,
register, mastering, and forbidden features. It must not be the same rendered
piece relabeled for several goals.

### 3.7 Detailed `StyleProfile` parameter contract

Every production profile must make the following decisions explicit.

| Group | Required parameters |
| --- | --- |
| Identity | profile id, semantic version, cultural scope, research sources, reviewer, allowed goals |
| Tonal system | tonic, scale/mode, characteristic tones, optional/forbidden tones, tuning system, pitch range |
| Melody | motif length, contour families, onset deadline, phrase length, cadence targets, leap limit, climax position, exact-repeat cap |
| Harmony | chord/sonority vocabulary, harmonic rhythm, common-tone target, bass-motion limit, dissonance and resolution budget |
| Rhythm | meter, tempo range, subdivision, syncopation budget, onset density, pulse salience, minimum and maximum phrase gap |
| Form | allowed form graphs, arrival length, contrast type, return location, release behavior, density curve |
| Instrumentation | primary/secondary roles, sample source ids, native ranges, articulation, doubling restrictions |
| Performance | velocity range, phrase envelope, timing offsets, articulation, pedal/decay behavior, hand separation |
| Mix | foreground hierarchy, spectral role, stereo width, room/reverb limit, loudness and LRA target |
| Environment | compatible families, default off/on state, level range, fade/crossfade, exclusion behavior |
| Safety and QA | forbidden affect, voice/beat/transient/buzz gates, similarity limits, long-session fatigue limits |

Illustrative data shape:

```json
{
  "id": "east_asian_pentatonic_lyrical_piano",
  "version": "0.1.0",
  "goals": ["calm"],
  "tonal": {
    "pitchSet": [0, 2, 4, 7, 9],
    "rangeMidi": [55, 76],
    "characteristicDegrees": [2, 6],
    "maxLeapSemitones": 7
  },
  "melody": {
    "motifNotes": [3, 5],
    "firstMotifBeforeSeconds": 20,
    "phraseBars": [2, 4],
    "exactRepeatMax": 2,
    "highPointPositionRatio": [0.50, 0.70]
  },
  "rhythm": {
    "meters": ["4/4"],
    "bpm": [58, 64],
    "onsetsPerBar": [1, 5],
    "maxNonReleaseGapSeconds": 4.5
  },
  "forbidden": ["theatrical_climax", "bright_repeated_pluck", "generic_pentatonic_random_walk"]
}
```

The exact thresholds are hypotheses until calibrated against accepted and
rejected listening examples.

### 3.8 Melody, harmony, rhythm, and form rules

#### Melody

- Separate `identity notes` from ornamental or connective notes.
- Represent contour independently from absolute pitch so similarity QA can
  detect transposed duplicates.
- Define question and answer cadence targets per profile.
- Track interval direction, size, duration, metric position, and chord relation.
- Use a novelty budget: one changed ending or register event is enough for one
  return; do not mutate every parameter simultaneously.
- Sleep motifs should be less complete and less salient on later returns.
- Calm motifs may have a clear return and one restrained high point.
- Focus motifs prioritize stable rhythm identity over lyrical pitch development.

#### Harmony

- Prefer common-tone voice leading and bounded bass motion for low-arousal
  profiles.
- Store harmonic rhythm separately from note density.
- Limit dominant-function urgency and rapid cadence cycles in Sleep.
- Extended chords are colors, not automatic relaxation; maj7/add9 voicings can
  still create lounge identity.
- Modal and cultural profiles require characteristic-tone behavior, not merely
  a matching pitch set.

#### Rhythm

- BPM alone does not determine perceived speed. Measure onset density,
  subdivision, syncopation, attack sharpness, bass placement, and phrase gaps.
- A 48 BPM piece with continuous eighth notes can feel more hurried than a
  68 BPM piece with two soft events per bar.
- Separate `pulse continuity` from `beat salience`: Focus may retain the first
  while Sleep and Meditation suppress the second.
- Long gaps must be intentional phrase space supported by decay or
  accompaniment, not missing content.

#### Form

- Encode form as a graph of functions and transformations, not section labels
  alone.
- Contrast can come from register, texture, cadence, accompaniment, or motif
  ending; it does not require greater loudness.
- Sleep release removes layers and notes.
- Calm return restores familiarity without a final chorus effect.
- Focus forms avoid narrative climax and use controlled long-range variation to
  prevent loop fatigue.

### 3.9 Reference-analysis worksheet

Every new reference item must be analyzed into this structure before it can
influence a profile:

```text
reference id and rights boundary
source/platform/date/region
observed popularity and review signals
intended listener job
duration and large-scale form
opening behavior in first 20 seconds
motif onset, length, contour, and return pattern
phrase length and cadence behavior
mode/scale and characteristic tones
harmonic rhythm and bass movement
meter, tempo, onset density, and pulse salience
instrument roles, register, and articulation
dynamic arc, high point, reverb, and spectral balance
environment/noise relationship
positive user-language themes
negative user-language themes
principles safe to generalize
features forbidden from copying
proposed StyleProfile hypothesis
```

At least three structurally different references should inform a new family.
One hit song or one highly viewed video is not enough to define a profile.

### 3.10 Research backlog and priority

Research is staged so that the generator receives useful knowledge before the
project spends time on low-value catalog expansion.

| Priority | Research question | Deliverable | Blocks |
| --- | --- | --- | --- |
| P0 | Which three profiles can be rendered with rights-safe sources now? | source map, profile draft, three event-plan fixtures | pilot generation |
| P0 | What makes a piece feel hurried, empty, heavy, or mechanical to our listeners? | labeled listening set and acoustic feature table | QA thresholds |
| P0 | Which motif, phrase, and form differences are audible between profiles? | contour/rhythm/form comparison report | diversity gate |
| P1 | Which piano, guitar, Rhodes, and low-register articulations support each goal? | sample-role and register matrix | source selection |
| P1 | How do users describe popular references in their own words? | comment/review taxonomy with evidence links | prompt and profile language |
| P1 | How do rain and ocean layers change perceived melody, pace, and attention? | music-only versus environment A/B matrix | Recipe defaults |
| P1 | How does long-session repetition change acceptance? | 30-minute and 120-minute fatigue protocol | loop and form planner |
| P2 | Which culturally specific instruments and tunings can we source legally? | rights and cultural-review checklist | additional style profiles |
| P2 | How do focus listeners differ by task, familiarity, and music tolerance? | task-specific Focus cohorts | Focus personalization |
| P2 | Can a local open model provide useful dry stems under acceptable terms? | model comparison record | optional supply-gap route |

Each research item must end with one of three decisions: `adopt rule`,
`keep as hypothesis`, or `reject for product use`. A source that only produces
interesting prose but no testable decision does not block implementation.

### 3.11 Candidate examples and analysis boundaries

The examples below are a study repertoire, not a generation prompt list. They
are selected because they represent different kinds of popularity or musical
craft. The engine should extract abstract properties and create original
counterexamples.

| Candidate | Why study it | First analysis pass | SNOOZE translation |
| --- | --- | --- | --- |
| *Flying* — Peder B. Helland | mass long-form sleep audience | opening quietness, layer continuity, event scarcity, section persistence | `sleep_ambient_continuity` hypothesis |
| *Music for Airports 1/1* — Brian Eno | canonical ambient listening reference | gradual timbral overlap and low urgency | `ambient_overlap` hypothesis |
| *Gymnopédie No. 1* — Erik Satie | sparse piano and recognizable phrase identity | cadence softness, phrase spacing, common tones | `piano_nocturne` hypothesis |
| *Peace Piece* — Bill Evans | sustained ostinato with independent right-hand movement | ostinato stability versus foreground attention | `dry_modal_focus` hypothesis |
| *Watermark* — Enya | popular ambient/new-age production | texture layering and vocal/choir boundary | instrumental texture only; no vocal imitation |
| *Song from a Secret Garden* — Secret Garden | lyrical modal/neo-classical family | instrumental dialogue and melodic return | `celtic_lyrical` hypothesis |
| *One Summer's Day* — Joe Hisaishi | widely familiar cinematic piano reference | motif, register, orchestration, emotional lift | use motif-development principles only; reject cinematic climax |
| Japanese honkyoku and koto repertoire | culture-specific contemplative phrasing | breath, ma, decay, form, ornament hierarchy | requires real instrument source and cultural review |
| Indian alap practice | non-metered melodic exposition | drone relation, characteristic tones, ornament density | `alap_sparse` hypothesis; no generic scale substitution |
| slow modal jazz/ECM repertoire | low-density harmonic color | voicing, common tones, space, bass restraint | `rhodes_dry_focus` hypothesis |
| Jobim's slow bossa repertoire | relaxed syncopation | guitar pattern, anticipations, harmonic color | Calm/Focus only after pulse gate |
| editorial study streams | practical long-session utility | loop continuity, low event salience, session length | focus continuity QA, not copied lo-fi loops |

Named works must not be used as audio or MIDI input, and the generator must not
output a melodic or harmonic near-copy. The reference report must state which
features were deliberately excluded.

### 3.12 Research-to-code mapping

Every accepted research insight must land in a named implementation artifact.

| Knowledge type | Code/config destination | Test fixture |
| --- | --- | --- |
| Motif contour and cadence | `StyleProfile.melody` | `motif_contour_fixtures.json` |
| Phrase length and continuation | `PhrasePlanner` | `phrase_gap_fixtures.json` |
| Harmonic rhythm and bass motion | `StyleProfile.harmony` | `voice_leading_fixtures.json` |
| Meter, subdivision, and pulse salience | `StyleProfile.rhythm` | `onset_density_fixtures.json` |
| Register and articulation | `StyleProfile.instrumentation` | `register_attack_fixtures.json` |
| Foreground/background hierarchy | `PerformancePlanner` and Recipe mix profile | `music_environment_ab_fixtures.json` |
| Repetition and long-session fatigue | `FormPlanner` | `long_session_form_fixtures.json` |
| Cultural tuning and instrument role | profile research record and source manifest | cultural review checklist |
| User feedback categories | decision log and preference taxonomy | blind-listening form |

No research note is considered implemented until it points to a code/config
destination and a fixture or QA observation.

### 3.13 Research record template

Each research item must be stored as a short, auditable record. This prevents
an attractive playlist, forum comment, or textbook sentence from silently
becoming a generation rule.

```yaml
id: research-YYYY-MM-DD-slug
question: "What are we trying to decide?"
source_type: textbook | peer_reviewed | platform | review | forum | internal
sources:
  - title: "..."
    url_or_citation: "..."
    accessed_at: "YYYY-MM-DD"
population_or_sample: "Who or what was observed?"
observation: "Directly supported finding, separated from interpretation."
confidence: high | medium | low
generalizable_principle: "Original principle, never a copied song feature."
proposed_rule: "Concrete StyleProfile, planner, mix, or QA change."
fixture: "Path to positive/negative test case."
decision: adopt_rule | keep_hypothesis | reject
owner: "reviewer"
review_due: "YYYY-MM-DD"
```

`platform` evidence is descriptive demand evidence; `peer_reviewed` evidence
may support a cautious hypothesis about listening outcomes; neither authorizes
medical claims. A record without a proposed fixture remains research backlog,
not a generator change.

### 3.14 Popularity and user-language sampling sheet

For each candidate reference, capture a normalized observation rather than a
raw view-count ranking. Sample at least 20 recent comments/reviews when
available, code each into the same vocabulary, and keep the original quote
with a URL for audit.

| Field | Required values or example |
| --- | --- |
| listener job | sleep / return-to-sleep / calm / meditation / focus / background |
| positive reason | continuity / warmth / melody / low stimulation / nature layer / familiarity |
| negative reason | too loud / too empty / repetitive / busy / artificial / ads / sudden change |
| return signal | saved / playlisted / daily use / overnight use / replayed / unspecified |
| structure signal | song / loop / drone / free-form / guided / hybrid |
| acoustic clue | onset density, register, attack, reverb, dynamic movement |
| confidence | direct quote / repeated theme / analyst inference |

Popularity becomes a candidate-family priority only when at least three
independent sources show a similar listening job or structure. A single viral
track can seed analysis, but cannot set a default profile, tempo, frequency, or
therapeutic claim.

### 3.15 Finer substyle split for the pilot catalog

The top-level matrix is still too coarse for generation. Each family should be
split by musical behavior and goal before adding more instruments. The first
catalog target is 12-15 profiles, but only three are implemented until their
rights-safe sources and QA are ready.

| Substyle | Distinguishing behavior | Initial goal | Hard exclusions |
| --- | --- | --- | --- |
| piano nocturne | sparse 3-5 note motif, soft pedal, delayed cadence | Sleep/Calm | chorus, bright octave doubling, loud first chord |
| piano lyrical arc | clearer question-answer, one restrained high point | Calm | late crescendo, recognizable named melody |
| piano steady-focus | narrow register, regular phrase return, dry room | Focus | rubato drift, dramatic cadence |
| acoustic 6/8 unwind | wave-shaped arpeggio with softened attack | Calm | marching bass, continuous hard eighths |
| guitar rest bed | two-note/three-note cells, long decay, minimal harmony | Sleep/Calm | pick noise, folk strum, rhythmic build |
| dry Rhodes focus | stable soft pulse, add9/maj7 color, no brushes | Focus | walking bass, club reverb, chord stabs |
| modal Rhodes calm | slower harmonic rhythm, less syncopation, warmer register | Calm | lounge swing, solo density |
| ambient piano overlap | overlapping tones with identifiable returns | Sleep | narrowband drone, ominous low pedal |
| pentatonic chamber | piano plus one approved acoustic role, call/response | Calm | generic random pentatonic walk |
| Japanese ma-inspired | breath-shaped phrases with supported continuity | Meditation | decorative high attacks, empty silence |
| alap-inspired free line | non-metric phrase, sparse drone-free support | Meditation | tabla, dense ornament, synthetic buzz |
| Celtic modal lull | 6/8 or free pulse, harp/low flute role if rights-safe | Calm/Sleep | heroic lift, cinematic swell |
| Nordic stillness | cool modal harmony, low event rate, moving inner voice | Sleep/Calm | ominous bass, sustained single-frequency tone |
| slow bossa focus | nylon guitar anticipation with barely perceptible pulse | Focus | foreground percussion, danceable groove |

Each substyle must differ on at least four axes: motif contour, phrase rhythm,
harmonic rhythm, accompaniment grammar, form graph, register, articulation, or
goal-specific density. Changing only the instrument sample is a duplicate.

### 3.16 Melody and form acceptance heuristics

These are starting hypotheses for fixtures, not universal music laws. Calibrate
them against accepted and rejected listening examples.

- **Arrival:** first musical event at 1-4 seconds; first recognizable motif by
  8-20 seconds depending on goal; no full-volume synchronized chord.
- **Continuity:** no unintentional gap longer than 4.5 seconds in Calm/Focus or
  7 seconds in Sleep/Meditation; decay or a supporting layer must explain any
  longer space.
- **Salience:** one identity motif per phrase; no more than one foreground
  high point per 3-5 minutes; later returns reduce notes or register.
- **Variety:** adjacent phrases must change one planned variable, while at least
  two identity features remain recognizable.
- **Cadence:** Sleep avoids repeated dominant-to-tonic urgency; Calm may use a
  gentle cadence every 8-16 bars; Focus favors open or common-tone endings.
- **Trajectory:** measure energy as event density, attack, register, and loudness
  together. A piece fails if two or more rise persistently in the second half.
- **Ending:** use reduction, held consonance, or an open loop; never add a final
  chorus, drop, or triumphant lift.

The fixture suite should contain at least one valid and one deliberately bad
example for every heuristic. The bad example must fail for the intended reason,
so a QA pass cannot be achieved by simply lowering all levels.

### 3.17 StyleProfile review checklist

Before a profile can generate a review batch, a reviewer must confirm:

- its musical identity can be described without naming a famous artist or song;
- its source manifest names an approved sample or an original synthesis method;
- its motif, phrase, accompaniment, and form rules are independent of other
  profiles;
- Sleep/Calm/Meditation/Focus variants are separate profiles or explicit goal
  overrides, not one track relabeled four ways;
- forbidden features include buzz, mechanical narrowband tone, lounge/rock
  drift, heavy opening, excessive reverb, and missing-content silence where
  relevant;
- the profile has a positive fixture, a negative fixture, and a blind-listening
  question;
- expected user value is “would save and replay,” not “sounds technically
  generated”;
- cultural naming and instrument claims have a source and review owner.

If any item is unknown, profile status is `draft`, not `production`.

### 3.18 Generator versioning and rollback

Composition rules, source manifests, QA thresholds, and render code must be
versioned as one reproducible bundle. A review page must display:

```text
profile_id + profile_version
generator_version
event-plan seed
source manifest hash
render preset version
QA report version and pass/fail reasons
```

Version rules:

1. Patch changes may adjust a threshold or one bounded parameter without
   changing musical identity.
2. Minor changes add a new motif, phrase, or approved source while preserving
   the profile contract.
3. Major changes alter meter, tonal language, form, or instrument identity and
   require a new listening batch.
4. Never overwrite an approved profile in place; freeze the old version so
   saved sounds remain reproducible.
5. If a new version worsens save/replay, comfort, or scene-fit metrics, roll
   back the profile pointer while retaining the failed batch as a regression
   fixture.

### 3.19 Stage gates from research to catalog

| Stage | Work | Required evidence | Exit decision |
| --- | --- | --- | --- |
| R0 | collect references, textbooks, studies, platform signals | research records with rights boundaries | adopt / hypothesis / reject |
| R1 | write StyleProfile and source map | complete checklist, positive/negative fixtures | draft profile |
| G0 | generate 3-5 event plans | deterministic manifests and machine QA | keep candidates |
| G1 | blind listening | scene fit, comfort, save/replay intent, defect labels | revise or pass |
| G2 | long-session and environment A/B | 30/120 minute continuity, layer balance, fatigue | approved foundational music |
| G3 | catalog batch | diversity, rights, reproducibility, Discover metadata | eligible for release |

Quantity expansion is blocked at each gate until the previous gate passes. This
is how research and generator changes stay coupled instead of producing another
large batch of near-duplicates.

## 4. Current generator diagnosis

The current controlled-stem route has a usable sampler, deterministic event
scheduling, rights record, and render pipeline. Those parts should remain.

The composition layer is not yet a reusable generator:

- `scripts/generate-original-lyrical-piano-batch-011.py` gives all three pieces
  the same accompaniment event pattern.
- The same file uses similar two-note-per-bar melody rhythms and one common
  `intro-A-B-A'-coda` form.
- `scripts/generate-gentle-western-families-batch-012.py` improves instrument,
  meter, and accompaniment diversity, but still rotates literal pitch arrays
  instead of developing motifs and phrases.
- Rendering humanization is mostly random timing, velocity, and pan variation.
  Randomness does not create phrase direction or a human performance arc.
- The current QA measures acoustic properties and silence, but does not reject
  near-duplicate melody contours, rhythm fingerprints, accompaniment patterns,
  or forms.

Listening feedback establishes hard failures:

- long gaps that feel like missing content;
- music that is too quiet or too slow to remain engaging;
- white noise, hum, buzz, or mechanical sustained tones added as filler;
- strong downbeats, hurried movement, rock drift, or lounge/bar identity;
- opening with a complete loud chord;
- late emotional or loudness escalation;
- several outputs sounding like one piece with different titles.

## 5. Target generator architecture

```text
ProductionBrief
  -> StyleProfile selection
  -> MotifGenerator
  -> PhrasePlanner
  -> FormPlanner
  -> AccompanimentPlanner
  -> PerformancePlanner
  -> EventRenderer
  -> Music QA
  -> clean music master
  -> optional Recipe V2 environment layering
```

### 5.1 `ProductionBrief`

Required fields:

- goal: `sleep`, `calm`, `meditation`, or `focus`;
- style profile id;
- duration and target loop behavior;
- desired warmth, movement, melody prominence, and variation;
- required and excluded instruments or sounds;
- environment preference, stored separately from music composition;
- deterministic seed and origin record.

### 5.2 `StyleProfile`

Each profile owns:

- mode, scale, tonal center, and pitch range;
- meter and tempo range;
- motif length and contour families;
- phrase length, cadence targets, and silence limits;
- accompaniment patterns and harmonic rhythm;
- supported forms and development operations;
- goal-specific density and dynamic limits;
- instrument source requirements;
- explicit forbidden traits;
- reference research and version.

### 5.3 Motif and phrase engine

Replace literal melody arrays with motif objects and transformations:

- `answer`: resolve a question phrase toward a stable tone;
- `vary_ending`: preserve identity while changing the final one or two notes;
- `rhythmic_variant`: preserve contour while changing duration placement;
- `register_variant`: change register without adding loudness;
- `reduce`: remove nonessential notes for Sleep release;
- `extend`: lengthen the final tone without increasing event density.

Inversion, sequence, and transposition are allowed only when the profile permits
them. Mechanical transformation is not automatically musical development.

### 5.4 Form and scene engine

Forms must be profile-specific rather than globally fixed. Supported examples:

- nocturne: intro -> theme -> response -> contrast -> return -> coda;
- 6/8 walk: pickup -> wave theme -> open response -> shortened return -> rest;
- sleep variation: arrival -> A -> A' -> A'' -> reduction -> release;
- focus cycle: motif cycle -> controlled variation -> stable return;
- free meditation: arrival -> spacious statement -> response -> silence-aware
  continuation -> release.

Goal overrides style:

- Sleep reduces density and register during the second half.
- Calm may use a restrained narrative arc and one pitch high point.
- Meditation allows space but must stay below the missing-content silence limit.
- Focus maintains continuity and a soft pulse without a foreground beat.

### 5.5 Performance engine

Phrase-aware performance replaces independent randomization:

- phrase opening is lighter;
- phrase middle has modest directional energy;
- phrase ending relaxes and lengthens;
- left and right hands avoid machine-perfect simultaneous attacks;
- returning material is usually softer than its first statement;
- downbeat velocity follows phrase meaning, not meter alone;
- global randomization remains bounded and reproducible.

### 5.6 Renderer boundary

Keep the current rights-safe sample loader, deterministic seeds, bounded pitch
shifting, stereo mix, filter, WAV/MP3 export, and origin manifest. Make fade,
mastering, and loudness targets goal-aware rather than identical across all
styles.

Do not add oscillator, drone, colored noise, or white noise to hide gaps in a
composition. If a phrase feels empty, fix the phrase plan or accompaniment.

## 6. Ordered adjustment plan

The order is designed to produce audible evidence quickly without rebuilding
the entire factory before the first review.

### Step 1: freeze usable infrastructure

Keep:

- VCSL Kawai piano and approved CC0 guitar, bass, and Rhodes sources;
- sample loading and bounded pitch shifting;
- deterministic event rendering;
- WAV/MP3 output and rights manifest;
- existing Recipe V2 music/environment separation.

Exit criterion: a fixed legacy event list renders identically before and after
the composition refactor.

### Step 2: split composition from rendering

Create independent data structures and modules for `ProductionBrief`,
`StyleProfile`, motif, phrase, form, accompaniment, and performance events.

Exit criterion: the renderer accepts a neutral event plan without importing a
batch-specific composition function.

### Step 3: implement the first three profiles

Do not implement all global families first. Build three profiles that can be
rendered with currently approved instrument sources:

1. `east_asian_pentatonic_lyrical_piano`;
2. `western_six_eight_acoustic_unwind`;
3. `dry_rhodes_brushless_focus`.

Exit criterion: profiles use different meter, motif grammar, accompaniment,
form, density, and performance rules.

### Step 4: replace pitch arrays with motif development

Implement question, answer, varied return, contrast, and reduction operations.

Exit criterion: each pilot has a three-to-five-note motif before 20 seconds,
three to five recognizable returns, and no more than two exact repetitions.

### Step 5: implement profile-specific forms and openings

- Use an 8-12 second layered musical arrival.
- Do not begin with a complete loud chord or synchronized bass attack.
- Give every pilot a different formal plan.
- Prevent late amplitude escalation.

Exit criterion: the opening is audible but gentle; the middle develops; the
ending returns and releases without a climax.

### Step 6: implement phrase-aware performance

Apply phrase-level velocity, timing, articulation, and hand-separation rules.

Exit criterion: repeated phrases sound related but not mechanically identical,
and the music does not depend on large reverb to feel connected.

### Step 7: add automated composition QA

Add gates for:

- motif presence and first appearance time;
- note density and longest perceptual gap;
- pitch interval distribution and leap recovery;
- melody contour and rhythm fingerprint similarity;
- accompaniment and form similarity;
- opening energy jump;
- second-half loudness growth;
- onset density, high-frequency energy, and abnormal sustained narrowband tone.

Exit criterion: deliberately duplicated profiles and known buzzy, silence-heavy,
or late-building failures are rejected.

### Step 8: generate one pilot per profile

Generate exactly three first-round pieces. Do not expand quantity yet.

Exit criterion: the pieces are identifiable without seeing their titles and do
not sound like one template with different instruments.

### Step 9: blind listening and rule correction

Ask only behaviorally useful questions:

- Would you continue listening?
- Would you save and replay it?
- Does it feel hurried, empty, heavy, mechanical, noisy, or over-reverberant?
- Which layer or moment caused the problem?
- Does the label Sleep, Calm, Meditation, or Focus match the sound without
  explanation?

Exit criterion: each rejection maps to a profile rule, composition-engine rule,
performance rule, source problem, or mix problem.

### Step 10: expand styles only after pilot acceptance

Expansion order:

1. Nordic ambient piano using existing piano/low-register sources, with a
   narrowband-tone rejection gate.
2. Chinese, Japanese, Indian, Celtic, and Middle Eastern profiles only after
   appropriate commercial-compatible instrument samples and cultural review.
3. Kora/mbira, Latin bossa, lo-fi, and slow-rock Calm/Focus profiles after the
   no-heavy-beat gate is calibrated.

Exit criterion: every new family adds a new compositional identity and approved
source capability rather than increasing the catalog count with variants.

## 7. First three pilot specifications

### 7.1 East Asian pentatonic lyrical piano

- Goal: Calm.
- Meter: 4/4 with rubato phrase edges.
- Tempo: 58-64 BPM.
- Motif: four notes, light pickup, rising third, pause, stepwise return.
- Form: nocturne.
- Accompaniment: low root plus sparse inner response; no shared four-trigger
  pattern.
- Forbidden: bright upper-register repetition, theatrical climax, imitation of
  a named composition, and generic pentatonic random walk.

### 7.2 Western 6/8 acoustic unwind

- Goal: evening Calm.
- Meter: 6/8.
- Tempo: 48-56 dotted-quarter BPM equivalent.
- Motif: wave contour with a pickup and changed final two notes on return.
- Form: pickup -> A -> A' -> open B -> shortened A -> release.
- Accompaniment: alternating low-middle-high guitar motion with softened attack.
- Forbidden: hard pluck, marching bass, rock backbeat, heroic lift, and hurried
  continuous eighth notes.

### 7.3 Dry Rhodes brushless focus

- Goal: Focus.
- Meter: 4/4.
- Tempo: 62-72 BPM.
- Motif: range no wider than a fifth, restrained syncopation, stable cycle.
- Form: motif cycle -> directional variant -> stable return.
- Accompaniment: dry Rhodes upper voice plus finger bass that avoids the first
  melody downbeat.
- Forbidden: drums, lounge bass walk, large reverb, jazz soloing, strong chord
  stabs, and emotional lift.

## 8. Environment and noise layering policy

Music generation and environment mixing remain separate.

Default target:

- music: perceptual foreground, approximately 85-95 percent of the intended
  musical experience;
- rain or ocean: optional decoration, approximately 5-12 percent;
- white, pink, or brown noise: off unless explicitly requested, then kept below
  attention, approximately 0-5 percent.

Recipe rules:

- environment layers use approved recordings and independent rights records;
- rain/ocean fade in over approximately 15-25 seconds unless the user requests
  a different arrival;
- ocean peaks must not become a repeating downbeat;
- environment loops use a long enough crossfade to avoid an audible seam;
- environment exclusions persist as explicit preferences;
- a music-only version and each environment variant remain separately savable;
- environment loudness feedback changes the Recipe profile, not the clean music
  master.

## 9. Automated and listening QA contract

### 9.1 Hard machine gates

- Decode, channel, sample rate, duration, peak, and loudness are valid.
- No audible voice, whisper, chant, choir, or fake vocal artifact.
- No clipping, abrupt onset, alarm-like transient, or narrowband buzz.
- No foreground beat for Sleep or Meditation.
- The first motif is present before 20 seconds for melodic content.
- The longest non-release low-content interval stays below the profile limit.
- Second-half integrated loudness does not exceed the middle by more than 1 dB.
- Cross-profile melody contour and rhythm similarity stay below the calibrated
  duplicate threshold.

### 9.2 Human listening gates

- The listener can identify the intended family without reading the title.
- The opening is gentle but not inaudible.
- The piece has continuity without mechanical filler.
- Melody is recognizable without demanding active attention.
- No section feels hurried, celebratory, cinematic, ominous, bar-like, or
  forcibly combined.
- The listener would save and replay the piece for the labeled scene.

### 9.3 Release states

```text
generated candidate
  -> machine QA passed
  -> listening QA passed
  -> combination QA passed
  -> rights reviewed
  -> approved foundational music
  -> eligible for Recipe V2 and Discover finished content
```

No review-page approval directly promotes a file into the public catalog.

## 10. Continuous adjustment loop

This document and the generator evolve together:

```text
research or listening evidence
  -> classify the problem
  -> update the smallest responsible rule
  -> generate a bounded comparison batch
  -> machine QA
  -> blind listening
  -> accept, reject, or revise
  -> update StyleProfile, QA threshold, and this decision log
```

### 10.1 Feedback routing

| Feedback | Change location |
| --- | --- |
| Several pieces sound the same | motif, rhythm fingerprint, form, or accompaniment diversity gate |
| One piece has a weak hook | that piece's motif seed or profile motif family |
| Opening is heavy across a style | profile arrival and performance rules |
| Music becomes excited late | form planner and second-half density/dynamic limits |
| Long gaps feel empty | phrase planner and profile silence limit |
| Buzz or mechanical tone appears | source rejection, narrowband QA, or renderer; never add noise to mask it |
| Rain/ocean is too loud | Recipe environment balance, not music composition |
| A cultural style sounds fake | block profile; improve source and cultural grammar before retrying |
| One goal label does not fit | goal override and scene-fit QA |

### 10.2 Update discipline

For every accepted or rejected batch, append one row to the decision log below
and update the relevant profile version. Do not silently change generator rules.

| Date | Evidence | Decision | Generator/Profile change | Result |
| --- | --- | --- | --- | --- |
| 2026-07-18 | Batch 011 pieces sounded too similar | Separate composition identity from rendering | Plan `StyleProfile`, motif, form, and similarity QA | Planned |
| 2026-07-18 | Batch 012 openings were heavy and melodies lacked patience value | Add layered arrival and real motif development | Plan three pilot profiles and first-20-second motif gate | Planned |
| 2026-07-18 | Earlier controlled-stem batches were silence-heavy, noisy, buzzy, or mechanical | Ban filler noise and narrowband sustained cores | Add gap, onset, and narrowband gates | Planned |
| 2026-07-18 | Global platform and forum research shows multiple viable families | Avoid one universal calming template | Add global profile matrix and source prerequisites | Planned |
| 2026-07-18 | Research plan required an executable first boundary | Freeze three pilot profile contracts before refactoring the renderer | Added `config/music-style-profiles-v1.json` and a contract validator | Implemented |

## 11. Success metrics

The engine is not successful because it rendered a file. A pilot family passes
when:

- at least one piece is judged worth saving and replaying;
- style identity is audible without title priming;
- cross-style duplicate QA passes;
- no hard comfort, voice, rights, or scene-fit gate fails;
- environment variants remain controllable and do not overpower music;
- the accepted composition can be reproduced from profile version, seed,
  source hashes, and generator version.

After release, save rate, replay on multiple days, removal/mute frequency, AI
adjustment requests, early exits, and negative reasons supersede internal batch
counts as the evidence used to evolve profiles.

## 12. Immediate implementation target

The next implementation task is limited to Steps 1-8:

1. preserve the existing renderer;
2. introduce the composition data model;
3. implement the three pilot `StyleProfile` definitions;
4. implement motif and phrase transformations;
5. implement three distinct forms and phrase-aware performance;
6. add the first composition-diversity QA gates;
7. generate one piece per profile;
8. publish one local review page with profile and QA evidence.

Do not begin the global instrument expansion until those three pieces pass
listening QA.

## 13. MusicKit candidate boundary

On 2026-07-20, the three accepted profile pilots were split into candidate
MusicKits. Each kit contains synchronized harmony, melody, accompaniment,
low-support, and transition stems. The candidates remain outside the approved
asset pool until human layer listening, rights registration, long-session QA,
and Recipe V2 release validation pass.
