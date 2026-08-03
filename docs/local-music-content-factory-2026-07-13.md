# Local Music Content Factory Baseline

Date: 2026-07-13

## Decision

Use local generation only as a controlled background content factory for verified supply gaps. Generated files do not enter Quick Create directly. They remain candidates until technical QA, rights review, human listening, metadata labeling, and combination QA all pass.

The first targeted gap is low-stimulation foundation music for bedtime, emotional settling, breathing, and deep focus. This batch explicitly avoids frightening openings, suspense, ominous drones, sudden transients, strong melody hooks, percussion, and vocals.

## Model selection

| Option | Code license | Weight/use constraint | Apple Silicon | Decision |
| --- | --- | --- | --- | --- |
| ACE-Step | Apache-2.0 | Model/output originality still requires project review | M2 Max benchmark published; MPS supported with float32 | Selected for the first local spike |
| AudioCraft / MusicGen | MIT code | Released weights use CC BY-NC 4.0 | Possible, but irrelevant for commercial production | Rejected for product assets |
| stable-audio-tools | MIT code | Model weights have separate Stability licenses | MPS path less clearly supported by the tool README | Keep as a later comparison only |

ACE-Step is installed from GitHub source commit `1bee4c9f5b43e30995f8d4d33b3919197ce1bd68`. The source and Apache-2.0 license are recorded in `.local-models/ACE-Step/.source.json`; `.local-models` is ignored by Git.

Runtime verification:

- Python 3.11.15.
- PyTorch 2.13.0.
- Apple MPS available.
- `acestep --help` succeeds.
- Source import resolves to the pinned local checkout.

## Current runtime state

The checkpoint `ACE-Step/ACE-Step-v1-3.5B` contains a 6.61 GB transformer, a 1.13 GB text encoder, a 314 MB audio autoencoder, and a 206 MB vocoder. The first download attempt reached about 604 MB of the text encoder and then stopped making progress through the local network proxy. The process was stopped cleanly; Hugging Face partial files remain in `~/.cache/ace-step/checkpoints` and can resume.

The checkpoint download was then completed with a single-worker Hugging Face download. The first fixed-seed candidate, `local_warm_sleep_pad`, generated successfully on Apple MPS and passed decode, duration, sample-rate, channel, clipping, peak, and silence checks. Its normalized internal review copy is recorded in `reports/local-music-candidate-review-2026-07-13.md`.

The model is now technically usable as a local candidate generator. It is not a production-approved asset source until human listening, repetition, combination, and rights review pass.

Two sleep-specific ACE-Step attempts failed content constraints: the first sounded cheerful and celebratory, while the second retained a strong detected pulse despite an explicit no-beat prompt. ACE-Step remains available for later focus/calm experiments, but it is no longer the default route for sleep foundation drones.

The sleep foundation route now uses deterministic local synthesis with NumPy, SoundFile, and fixed seeds. The first procedural candidate has no chord progression, no detected tempo, no detected beat events, a `-26 LUFS` target, and a conservative peak. It remains pending human listening.

## First controlled batch

Manifest: `docs/local-music-generation-batch-2026-07-13.json`

The batch contains six fixed-seed candidates:

- Two warm bedtime pads.
- Two neutral deep-focus pads.
- Two gentle calm/breathing drones.

All outputs are 60-second WAV candidates. They must not be inserted into `audio_stems` automatically.

Generation command after the checkpoint download is healthy:

```bash
ACE_PIPELINE_DTYPE=float32 \
  ~/.local/share/snooze/ace-step-runtime/bin/python \
  scripts/generate-ace-step-batch.py
```

## Admission gates

Each candidate must pass all of the following:

1. Decode, duration, sample rate, channels, LUFS, True Peak, transient, and silence checks.
2. Opening 20-second review: no fright, suspense, ominous entry, or abrupt tonal event.
3. Full-track review: no vocals, speech, percussion, strong melody hook, dissonant tension, or unexpected climax.
4. Loop and 30-minute repetition review: no obvious seam or fatigue pattern.
5. Scene labeling: only scenes confirmed by listening receive positive goal fit.
6. Rights record: source commit, model checkpoint, prompt, seed, generation date, and AI disclosure retained.
7. Combination QA: background and environment layers remain balanced in Recipe V2.
8. Only after all gates pass may the candidate be copied to an approved path and receive `qa_status = approved`.

## Rejected inputs

- `stem_mixkit_music_588` Feedback Dreams Drone: rejected after project-owner listening QA because the opening feels dark and frightening at night.
- `stem_mixkit_music_593` Opalescent Pad: rejected for the same nighttime suspense/fright risk and removed from the pending core shortlist.
