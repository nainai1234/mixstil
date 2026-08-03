# AudioIntent V3 State and Stimulation Baseline

Date: 2026-07-14  
Status: implemented and validated

## Purpose

AudioIntent V3 expands Quick Create beyond source labels such as rain, forest, fire, music, and noise. It preserves the user's current state, session subtype, desired state trajectory, stimulation tolerance, listening context, and narrative arc inside the same Recipe V2 execution model.

## Added dimensions

- Session subtype: sleep onset, return to sleep, all-night masking, nap, breath awareness, grounding, open awareness, emotional release, sound meditation, reading and writing, study, creative work, repetitive work, and distraction masking.
- Current state: mental activity, emotional tension, sleepiness, attention stability, and physical restlessness.
- Desired trajectory: settle quickly, settle gradually, release then settle, maintain calm, maintain alertness, or mask distraction.
- Stimulation tolerance: event density, transient sensitivity, brightness, rhythm, melody, low-frequency weight, and variation.
- Listening context: headphones or speaker, external-noise level, time of day, and continuous-loop preference.
- Narrative arc: arrival, core, and release changes stored with the frozen Recipe.

## Decision boundary

Explicit inclusions and exclusions remain hard constraints. The new dimensions change ranking and temporal direction only after rights, approval, duration, and exclusion filters pass. They cannot make an unavailable sound appear or override a user saying no water, no music, or no voice.

## Initial ranking effects

- High transient sensitivity penalizes sudden-peak risks.
- Low event-density requests prefer steady low-event assets.
- Low attention stability penalizes attention-capturing assets.
- No-rhythm and no-melody requests prefer drones over piano, guitar, or bells.
- Reading, study, creative work, all-night masking, distraction masking, and grounding apply subtype-specific candidate preferences.

## Verification

- `pnpm validate:audio-intent-v3`
- `pnpm validate:soundscape-planner`
- `pnpm validate:soundscape-planner:external`
- `pnpm validate:recipe-v2`
- `pnpm validate:recipe-renderer`
- `pnpm validate:voice-free-beta`
- `pnpm validate:mainline-journey`

The first public validation remains Voice-free Beta. Voice-dependent practices such as body scan and loving-kindness meditation remain outside the current release promise.
