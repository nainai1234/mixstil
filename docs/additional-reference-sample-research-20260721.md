# Additional Pure-Instrument Reference Research 2026-07-21

The user supplied a second list intended to exclude voice and chanting. Public
metadata was checked on 2026-07-21. “Instrumental” in a title is not accepted
as proof until the audio is listened to; vocal versions, sampled voices,
choirs, and spoken content remain hard exclusions for Voice-free Beta.

## Meditation / Calm

| Reference | Visible demand signal | Initial decision |
| --- | ---: | --- |
| Marconi Union - Weightless | 152.9M official result; 68.4M 10-hour result | retain Calm/Sleep texture reference; reject causal claims |
| Brian Eno - 1/1 | 375.9K public result | retain canonical ambient structure reference |
| Steve Roach - Structures from Silence | 58.5K Topic result | niche ambient reference; demand weaker than assumed |
| Liquid Mind - Reflection | 135.0K public result | retain low-motion texture reference |
| Laraaji - Meditation No. 1 | 145.6K Topic result | retain zither/electronic texture reference |
| Steven Halpern - Chakra Suite | 68.4K public result | analyze label versus acoustics; reject frequency claims |
| Harold Budd / Brian Eno - First Light | 1.30M Topic result | retain piano/ambient balance reference |
| Kitaro - Silk Road | 7.89M official full-album result | retain as cultural/ambient contrast; check rhythmic lift |
| Tony Anderson - Dwell | 201.7K result | retain modern texture reference; demand is moderate |
| Paul Horn - Inside | 37.7K full-album result | retain spatial flute study; not broad popularity proof |

## Sleep

| Reference | Visible demand signal | Initial decision |
| --- | ---: | --- |
| Max Richter - Dream 1 | 1.41M official result | retain structured low-motion reference; test emotional arc |
| Ludovico Einaudi - Nuvole Bianche | 6.54M official visualizer; 149.7M popular upload | Calm reference, not Sleep default; melody too recognizable |
| Aphex Twin - #3 (Rhubarb) | 12.66M public result | retain ambient bed reference; verify no artifacts and rights |
| Ólafur Arnalds - saman | 1.19M official video | retain soft piano reference |
| Yiruma - River Flows in You | 7.03M official result; 229.0M popular upload | Calm reference, not Sleep default; strong hook |
| Nils Frahm - Ambre | 181.9K official result | retain felt-piano reference; demand is niche |
| Alexis Ffrench - Bluebird | 3.36M official result | verify exact version; vocal association may disqualify |
| Claude Debussy - Clair de Lune | 6.25M public performance result | classical Calm reference, not Sleep default |
| Hammock - Blankets of Night | 90.1K artist result | contrast reference only; post-rock swell risk |
| Johannes Bornlöf - Reminiscence | 602.3K artist result | retain piano/cello reference; verify dynamic arc |

## Focus

| Reference | Visible demand signal | Initial decision |
| --- | ---: | --- |
| Trent Reznor / Atticus Ross - In Motion | 3.02M public result | active Focus reference only |
| Hans Zimmer - Time | 20.76M official audio | reject default Focus; cinematic build |
| Tycho - A Walk | 7.13M official result | active Focus reference; pulse gate required |
| Jinsang - Affection | 1.35M Topic result | Lo-fi Focus reference; beat is explicit |
| Solar Fields - Leaving Home | 80.1K artist result; 401.6K album result | niche ambient Focus reference |
| Jon Hopkins - Open Eye Signal | 8.40M official video | reject default Focus; Techno pulse foreground |
| Rival Consoles - Recovery | 439.1K artist result | structured electronic Focus reference |
| Ludovico Einaudi - Experience | 47.76M official visualizer | reject default Focus; emotional escalation |
| deadmau5 - Strobe | 71.46M official result | high-energy Focus contrast only; build/drop risk |
| Kiasmos - Looped | 919.7K artist result | active Focus reference; 4/4 pulse gate required |

## Corrected interpretation

- The list has useful stylistic coverage, but “high播放量代表作” is not true
  for every item. Steve Roach, Paul Horn, Nils Frahm, Solar Fields and some
  others are meaningful niche references with much smaller visible signals.
- Pure instrumental does not mean Sleep-safe. `Time`, `Experience`, `Strobe`,
  `Open Eye Signal`, `Looped`, and `Blankets of Night` may be useful for active
  Focus or contrast research but are not low-stimulation defaults.
- 432Hz, chakra, Alpha/Theta, heart-rate synchronization, cortisol reduction,
  and “forces the brain into focus” are not adopted as product claims or
  composition rules.
- Vocal/choir/chant versions remain excluded even if a different upload of the
  same work is instrumental.

## Seamless-loop requirements

The generator should not loop a whole song. It should loop short, tagged
materials and create transitions between them.

### Pitched music elements

- loop at phrase or bar boundaries, never in the middle of an attack;
- store key, mode, root, register, tempo policy, and phrase length;
- use a 100-500 ms equal-power crossfade for short instrument events;
- use a 1-4 second overlap for pads and long-decay notes;
- match RMS/LUFS and spectral tilt at both ends;
- reject loops with a sudden high-frequency edge, exposed tail, or audible
  phase jump;
- verify at least 20 repeated cycles and a 30-minute rendered session.

### Environment and texture elements

- use 2-8 second boundary crossfades for rain, wind, water, and air;
- match wave/event density across the join;
- avoid repeating a distinctive bird, splash, click, or transient at a fixed
  interval;
- store foreground-event risk and maximum recommended level;
- run both waveform correlation and headphone listening checks.

### Composition-level continuity

- arrival and release are separate one-shot materials, not loop bodies;
- stable core loops must not contain a hidden crescendo or final cadence;
- variation is introduced by changing material, voicing, register, or phrase
  order, not by making one fixed song play forever;
- every saved result stores its score, seed, selected elements, and loop points
  so replay is deterministic.
