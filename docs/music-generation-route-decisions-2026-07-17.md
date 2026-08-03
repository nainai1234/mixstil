# Music generation route decisions

Date: 2026-07-17

Status: active content-baseline decision log

## Current decision

Composition-engine implementation order, global style research, pilot
`StyleProfile` definitions, and the continuing feedback loop are maintained in
[SNOOZE Global Calming Music Style and Generator Evolution Plan](./global-calming-music-style-generator-evolution-plan-2026-07-18.md).

Stop the local MusicGen-Style route for SNOOZE sleep, meditation, and calm core
content.

Do not replace the failed local route with a paid cloud API as the product core.
Gemini, Stability Audio, or any other commercial provider may be used only as a
quality benchmark or temporary comparison target. If the core production route
depends on a paid cloud music generator, SNOOZE has weak differentiation: a user
or competitor can go directly to the same provider, while SNOOZE keeps the cost,
latency, dependency, and rights risk.

The next route is an open-source or self-hosted content-production route with
commercial-compatible rights, strict acoustic QA, and deterministic arrangement
inside Recipe V2. The goal is not to generate "songs"; it is to produce or
assemble sleep, meditation, and focus music beds and soundscape stems that are
quiet, sparse, replayable, and controllable.

## Rejected route: AudioCraft MusicGen-Style

Local experiment pages:

- `public/review/musicgen-style-reference-ab-001/index.html`
- `public/review/musicgen-style-low-motion-001/index.html`

Observed listening failures:

- The best candidate was only "a little better" than previous local attempts.
- Output still did not sound relaxed like the Gemini reference.
- Low-motion prompts still produced busy, chaotic, rock-like or forward-moving
  musical behavior.
- The model behaved like a song/music generator, not a sleep or meditation
  functional-audio generator.

Technical cause:

- The model's music prior overpowered the negative prompt constraints.
- Text negatives such as "no beat", "no pulse", "no rock", and "no strong tune"
  did not reliably suppress active musical structure.
- Style conditioning constrained timbre only partially and did not enforce
  calm structure or low event density.

Rights boundary:

- `facebook/musicgen-style` pretrained weights are CC-BY-NC 4.0, so outputs
  were internal research only and cannot be promoted into commercial product
  content.

Decision:

- Keep scripts and outputs only as research evidence.
- Do not run more MusicGen-Style sleep/calm/focus batches unless the explicit
  purpose is model comparison, not content production.

## Commercial providers are benchmark only

Initial implementation:

- `scripts/run-stability-audio-sleep-spike.mjs`
- `scripts/build-stability-audio-sleep-spike-review.mjs`

Runtime requirements:

- `STABILITY_API_KEY` or `STABILITY_AUDIO_API_KEY`
- Optional `STABILITY_AUDIO_ENDPOINT` override if Stability changes the API
  endpoint.

Command:

```bash
STABILITY_API_KEY=... node scripts/run-stability-audio-sleep-spike.mjs --limit=3
node scripts/build-stability-audio-sleep-spike-review.mjs
```

Review page:

```text
public/review/stability-audio-sleep-spike-001/index.html
```

Benchmark standard:

- No rock, band, guitar, drums, beat, pulse, busy arrangement, or emotional
  lift.
- Must be perceptually closer to the Gemini reference: still, sparse, quiet,
  low-density, and immediately relaxing.
- Outputs remain candidates until API terms, commercial-use rights,
  redistribution rights, technical QA, and listening QA are confirmed.

Boundary:

- Do not promote paid-cloud output as the default SNOOZE production method.
- Do not design the paid product around resale of cloud-generated tracks.
- Use Gemini/Stability-style results to define the listening target, not the
  business moat.

## Required open/self-hosted route

Do not return to local MusicGen-style parameter tweaking.

The next candidate must satisfy all of these conditions before it can become a
production route:

1. License: model code, weights, and generated output terms must be compatible
   with SNOOZE commercial use, offline playback, saved versions, and rendered
   works. Unclear terms keep outputs in research only.
2. Control: the route must reliably suppress vocals, drums, beat, rock/pop/jazz
   priors, strong melody, emotional lift, startle events, and busy motion.
3. Output shape: prefer single-purpose dry stems, pads, sparse keys, warm beds,
   and tiny accents over full songs.
4. Arrangement: final structure, loudness, fades, duration, looping, and
   foreground/background balance must be owned by SNOOZE's deterministic
   composition engine, not by the model.
5. QA: every candidate must pass DSP gates and human listening before it can
   enter approved assets.

## Candidate directions to test next

1. Stable Audio Open / stable-audio-tools only if the exact gated model terms
   are accepted and confirmed commercial-compatible. Treat it as self-hosted,
   not API resale.
2. Other open audio models only if they can be run locally or on self-managed
   GPU with acceptable rights and can generate low-density stems rather than
   complete songs.
3. Rights-safe finished content acquisition remains a fallback for launch
   depth, but it is not the self-produced moat.
4. If no current open model can meet the listening target, SNOOZE should build a
   smaller controlled stem factory: dry sparse piano/key beds, warm support
   tones, organic room textures, and low-attention accents, then compose them
   deterministically.

## Selected implementation: controlled stem factory with VCSL CC0 sources

Selected on 2026-07-18 after the system DLS prototype proved the controlled
arrangement direction but did not provide a sufficiently explicit production
rights chain.

- Renderer: SNOOZE-owned Python event scheduler, sampler, mix, and DSP code.
- Instrument source: selected low-velocity Kawai piano samples from VCSL,
  pinned to commit `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`.
- Source license: CC0 1.0 Universal, captured locally with checksums.
- External generation: no paid API and no pretrained generative model.
- Ownership statement: SNOOZE owns each new arrangement and rendered master;
  the underlying CC0 samples are non-exclusive public-domain material.

Reproduction commands:

```bash
pnpm fetch:vcsl-kawai-soft
pnpm generate:controlled-stem-factory-007
```

Batch 007 is listening-QA content, not an approved catalog promotion. Promotion
still requires human listening approval for goal fit, comfort, musical
continuity, and replay value.
