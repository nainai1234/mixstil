# Reference Music Analysis Queue V1

Status: analysis queue; no item is approved for audio production

Every row must be completed from the cited source and a listening pass before
its slot can become `validated`. Metadata labels such as “healing”, “432Hz”,
“delta”, or “focus” are not evidence of efficacy.

| Slot | Candidate | Goal | Primary analysis questions | Current state |
| --- | --- | --- | --- | --- |
| sleep_ref_01_low_soft_piano | Flying | Sleep | continuity, opening safety, event scarcity, low-register texture | pending analysis |
| sleep_ref_02_minimal_felt_piano | Gymnopédie No. 1 | Sleep | phrase spacing, cadence softness, common tones, piano attack | pending analysis |
| sleep_ref_03_piano_distant_rain | piano/water long-form market sample | Sleep | music/environment balance, rain foreground level, loop fatigue | pending source assignment |
| sleep_ref_04_piano_distant_ocean | piano/ocean long-form market sample | Sleep | wave masking, low-frequency buildup, melody persistence | pending source assignment |
| sleep_ref_05_warm_low_rhodes | slow modal/ECM repertoire | Sleep | Rhodes brightness, bass restraint, room size, lounge risk | pending analysis |
| sleep_ref_06_soft_acoustic_guitar | slow acoustic/nylon repertoire | Sleep | pluck attack, 6/8 motion, forward motion, decay | pending source assignment |
| sleep_ref_07_piano_low_strings | Song from a Secret Garden | Sleep | piano/string balance, modal color, cinematic-lift risk | pending analysis |
| sleep_ref_08_sparse_soft_harp | Celtic/New Age repertoire | Sleep | harp attack, low-flute role, modal calm, fantasy-score risk | pending source assignment |
| sleep_ref_09_beatless_environmental | Music for Airports 1/1 | Sleep | low urgency, overlapping layers, structural change rate | pending analysis |
| sleep_ref_10_nocturnal_minimal | singing-bowl sleep sample | Sleep | single-source foreground, event scarcity, startle risk | pending analysis |
| calm_ref_01_breath_piano | Peace Piece | Calm | stable bed versus foreground attention, motif movement | pending analysis |
| calm_ref_02_open_chord_guitar | Jobim slow bossa repertoire | Calm | nylon guitar, syncopation ceiling, warmth without dance pulse | pending analysis |
| calm_ref_03_sparse_harp | sparse harp repertoire | Calm | decay, phrase gaps, register, bright-pluck risk | pending source assignment |
| calm_ref_04_pentatonic_piano | Pinghu Qiuyue | Calm | pentatonic contour, ornament spacing, phrase return | pending analysis |
| calm_ref_05_restrained_woodwind | Japanese honkyoku | Calm | breath phrasing, ornament density, instrument authenticity | pending analysis |
| calm_ref_06_dry_rhodes | Weightless | Calm | texture motion, brightness, marketing claim separation | pending analysis |
| calm_ref_07_soft_strings | Watermark | Calm | string/pad layering, vocal boundary, dynamic range | pending analysis |
| calm_ref_08_nature_minimal_melody | Reiki and Rain sample | Calm | nature foreground, voice/branding separation, event density | pending analysis |
| focus_ref_01_dry_rhodes | editorial study streams | Focus | loop continuity, foreground change, beat and vinyl-noise risk | pending analysis |
| focus_ref_02_common_tone_piano | Peace Piece | Focus | common-tone stability, motif salience, long-session fatigue | pending analysis |
| focus_ref_03_low_density_guitar | low-density acoustic repertoire | Focus | pluck transient, pulse strength, register and repetition | pending source assignment |
| focus_ref_04_beatless_harmonic_cycle | slow modal/ECM repertoire | Focus | harmonic cycle, stable pulse without drums, room control | pending analysis |
| focus_ref_05_stable_tonal_bed | No Talking sleep ASMR sample | Focus | continuous bed, foreground absence, adaptation to work sessions | pending analysis |
| focus_ref_06_quiet_environment_instrument | long-form guided sleep samples | Focus | voice-free degradation, background continuity, interruption risk | pending analysis |

## Required analysis record

For each row, record the source URL and observation date, demand evidence,
instrument roles, tempo or free-time policy, meter, key/mode, register, note
density, chord-change rate, dynamic range, spectral brightness, reverb size,
form phases, arousal curve, distracting events, and the exact high-level rules
to adopt or reject. Also record whether the source can only be analyzed or is
licensed for transformation. The default is analysis-only.

## Decision states

- `pending source assignment`: the current family hypothesis needs a specific
  source before listening analysis.
- `pending analysis`: a candidate source exists but has not completed the full
  analysis record.
- `validated`: all required fields are complete and the project owner accepts
  the listening result.
- `rejected`: source or scene fit is unsuitable.

No `validated` row may be used to authorize API material production until the
rights boundary and listening decision are present in the machine-readable
research manifest.
