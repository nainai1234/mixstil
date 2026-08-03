#!/usr/bin/env python3
"""Build a long internal loop test with an equal-power crossfade at each seam."""

import argparse
import math
from pathlib import Path

import numpy as np
import soundfile as sf


def build_loop(audio: np.ndarray, target_seconds: float, sample_rate: int, crossfade_seconds: float) -> np.ndarray:
    overlap = max(1, int(sample_rate * crossfade_seconds))
    if overlap >= len(audio):
        raise ValueError("crossfade must be shorter than the source")
    repeats = math.ceil((target_seconds * sample_rate - overlap) / (len(audio) - overlap))
    output = audio.copy()
    fade_out = np.cos(np.linspace(0, np.pi / 2, overlap))[:, None]
    fade_in = np.sin(np.linspace(0, np.pi / 2, overlap))[:, None]
    for _ in range(1, repeats):
        output = np.concatenate([
            output[:-overlap],
            output[-overlap:] * fade_out + audio[:overlap] * fade_in,
            audio[overlap:],
        ])
    return output[: int(target_seconds * sample_rate)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--duration", type=float, default=600)
    parser.add_argument("--crossfade", type=float, default=2)
    parser.add_argument("--trim-start", type=float, default=0)
    parser.add_argument("--trim-end", type=float, default=0)
    parser.add_argument("--output-fade", type=float, default=0)
    args = parser.parse_args()
    audio, sample_rate = sf.read(args.input, always_2d=True, dtype="float32")
    trim_start = int(round(args.trim_start * sample_rate))
    trim_end = int(round(args.trim_end * sample_rate))
    if trim_start + trim_end >= len(audio):
        raise ValueError("trim removes the entire source")
    audio = audio[trim_start:len(audio) - trim_end if trim_end else None]
    looped = build_loop(audio, args.duration, sample_rate, args.crossfade)
    output_fade = int(round(args.output_fade * sample_rate))
    if output_fade:
        fade = np.sin(np.linspace(0, np.pi / 2, output_fade)) ** 2
        looped[:output_fade] *= fade[:, None]
        looped[-output_fade:] *= fade[::-1, None]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(output, looped, sample_rate, subtype="FLOAT")
    print(f"wrote {output} duration={len(looped) / sample_rate:.3f}s source={len(audio) / sample_rate:.3f}s repeats={math.ceil((args.duration * sample_rate - int(sample_rate * args.crossfade)) / (len(audio) - int(sample_rate * args.crossfade)))}")


if __name__ == "__main__":
    main()
