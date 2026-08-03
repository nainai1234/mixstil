#!/usr/bin/env python3
"""
Run a small MusicGen-Style A/B batch for sleep-healing audio experiments.

This is intentionally an internal research harness. The pretrained
facebook/musicgen-style weights are CC-BY-NC 4.0, so outputs from this script
must not be promoted into commercial/product content without separate rights.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_PROMPTS = [
    (
        "slow therapeutic ambient sleep music, soft warm drone, sparse gentle "
        "piano-like tones, no beat, no vocals, no melody hook, long reverb, "
        "calm, low intensity, seamless meditation bed"
    ),
    (
        "deep sleep healing soundscape, quiet cinematic ambient texture, "
        "breathing slow harmonic movement, very soft attack, no percussion, "
        "no sudden changes, relaxing spa meditation music"
    ),
    (
        "minimal warm ambient music for insomnia relief, floating sustained "
        "pads, distant bell-like accents, extremely gentle dynamics, no drums, "
        "no vocals, loopable and unobtrusive"
    ),
]


DEFAULT_REFERENCE_EXCERPTS = [
    "experiments/audio-model-lab/reference-excerpts/unlit-corners-early-08s-4s.wav",
    "experiments/audio-model-lab/reference-excerpts/unlit-corners-mid-32s-4s.wav",
    "experiments/audio-model-lab/reference-excerpts/unlit-corners-late-62s-4s.wav",
]


PARAMETER_GRID = [
    {"eval_q": 1, "cfg_coef": 2.5, "cfg_coef_beta": 4.0, "top_k": 180, "temperature": 1.0},
    {"eval_q": 2, "cfg_coef": 3.0, "cfg_coef_beta": 5.0, "top_k": 250, "temperature": 1.0},
    {"eval_q": 3, "cfg_coef": 3.5, "cfg_coef_beta": 6.0, "top_k": 250, "temperature": 1.0},
]


LOW_MOTION_PARAMETER_GRID = [
    {"eval_q": 1, "cfg_coef": 1.6, "cfg_coef_beta": 2.2, "top_k": 60, "temperature": 0.55},
    {"eval_q": 1, "cfg_coef": 2.0, "cfg_coef_beta": 2.8, "top_k": 90, "temperature": 0.62},
    {"eval_q": 1, "cfg_coef": 2.3, "cfg_coef_beta": 3.2, "top_k": 120, "temperature": 0.70},
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        default="experiments/audio-model-lab/outputs/musicgen-style",
        help="Directory for generated wav files and manifest.",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=30.0,
        help="Generation duration in seconds. MusicGen-Style supports up to 30s.",
    )
    parser.add_argument(
        "--model",
        default="facebook/musicgen-style",
        help="AudioCraft model id or local checkpoint directory.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional max number of candidates to render. 0 means full grid.",
    )
    parser.add_argument(
        "--prompt",
        action="append",
        help="Prompt to render. Can be repeated. Defaults to the built-in prompt set.",
    )
    parser.add_argument(
        "--reference",
        action="append",
        help="Reference excerpt wav. Can be repeated. Defaults to the built-in reference set.",
    )
    parser.add_argument(
        "--grid",
        choices=["default", "low-motion"],
        default="default",
        help="Parameter grid. low-motion is tuned to reduce hurried/pulse-like movement.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Import lazily so this file can be inspected without AudioCraft installed.
    import torch
    import numpy as np
    import soundfile as sf
    from audiocraft.data.audio import audio_write
    from audiocraft.models import MusicGen

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    model = MusicGen.get_pretrained(args.model)
    prompts = args.prompt or DEFAULT_PROMPTS
    references = args.reference or DEFAULT_REFERENCE_EXCERPTS
    parameter_grid = LOW_MOTION_PARAMETER_GRID if args.grid == "low-motion" else PARAMETER_GRID

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": args.model,
        "grid": args.grid,
        "license_note": (
            "facebook/musicgen-style pretrained weights are CC-BY-NC 4.0; "
            "use generated files for internal research only unless relicensed."
        ),
        "duration": args.duration,
        "candidates": [],
    }

    rendered = 0
    for ref_path in references:
        melody_np, sample_rate = sf.read(ref_path, always_2d=True)
        melody = torch.from_numpy(np.asarray(melody_np, dtype=np.float32)).t()

        for prompt_index, prompt in enumerate(prompts, start=1):
            for params in parameter_grid:
                if args.limit and rendered >= args.limit:
                    break

                model.set_generation_params(
                    duration=args.duration,
                    use_sampling=True,
                    top_k=params["top_k"],
                    temperature=params.get("temperature", 1.0),
                    cfg_coef=params["cfg_coef"],
                    cfg_coef_beta=params["cfg_coef_beta"],
                )
                model.set_style_conditioner_params(
                    eval_q=params["eval_q"],
                    excerpt_length=4.0,
                )

                stem = (
                    f"musicgen-style_ref-{Path(ref_path).stem}"
                    f"_prompt-{prompt_index}"
                    f"_q{params['eval_q']}"
                    f"_cfg{params['cfg_coef']}"
                    f"_beta{params['cfg_coef_beta']}"
                ).replace(".", "p")

                print(f"Rendering {stem}")
                with torch.no_grad():
                    wav = model.generate_with_chroma(
                        descriptions=[prompt],
                        melody_wavs=melody.unsqueeze(0),
                        melody_sample_rate=sample_rate,
                        progress=True,
                    )

                audio_write(
                    str(output_dir / stem),
                    wav[0].cpu(),
                    model.sample_rate,
                    strategy="loudness",
                    loudness_compressor=True,
                )

                manifest["candidates"].append(
                    {
                        "file": str(output_dir / f"{stem}.wav"),
                        "reference_excerpt": ref_path,
                        "prompt": prompt,
                        "params": params,
                    }
                )
                rendered += 1

            if args.limit and rendered >= args.limit:
                break
        if args.limit and rendered >= args.limit:
            break

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
