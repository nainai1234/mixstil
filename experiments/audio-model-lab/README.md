# Audio model lab

This folder contains local research experiments for sleep-healing music generation.

Downloaded code repositories live in `../../.local-models/`:

- `audiocraft` — best first candidate because MusicGen-Style supports audio style conditioning.
- `stable-audio-tools` — useful for Stable Audio research, but weights and commercial use require separate review.
- `AudioLDM2` — text-to-audio/music baseline; pretrained weights are non-commercial.
- `tango` — text-to-audio baseline; pretrained weights are non-commercial.
- `TangoFlux` — newer text-to-audio baseline; repository states research/non-commercial constraints.
- `ACE-Step` — existing baseline that produced poor healing-music fit in prior listening.

## Priority experiment

Use `facebook/musicgen-style` with the Gemini reference excerpt:

```bash
python3 -m venv .venv-musicgen-style
. .venv-musicgen-style/bin/activate
pip install -U pip
pip install -e .local-models/audiocraft
pip install torch torchaudio
python scripts/run-musicgen-style-sleep-ab.py --limit 3
```

Notes:

- The model requires a GPU-class environment; Meta recommends 16GB VRAM.
- The pretrained weights are CC-BY-NC 4.0. Treat outputs as internal research only.
- Full grid is 27 candidates: 3 reference excerpts × 3 prompts × 3 parameter sets.

## Optimization idea

The first optimization pass is not fine-tuning. It is controlled candidate search:

1. Use multiple 4-second excerpts from the same reference track.
2. Keep prompts explicitly sleep-oriented: no beat, no vocal, no hook, low dynamics.
3. Sweep `eval_q`, `cfg_coef`, and `cfg_coef_beta` to balance reference adherence against text control.
4. Run listening QA before considering longer renders or commercial-model replacements.
