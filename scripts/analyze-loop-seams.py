#!/usr/bin/env python3
"""Measure the deterministic join boundaries in an equal-power loop render."""

import argparse
import json
import math

import numpy as np
import soundfile as sf


def db(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def rms(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(audio * audio) + 1e-12))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    parser.add_argument("--source-duration", type=float, required=True)
    parser.add_argument("--crossfade", type=float, default=2)
    args = parser.parse_args()

    audio, sample_rate = sf.read(args.file, always_2d=True, dtype="float32")
    hop = int(round((args.source_duration - args.crossfade) * sample_rate))
    window = max(1, int(round(0.1 * sample_rate)))
    boundaries = []
    boundary = hop
    while boundary + window < len(audio):
        before = audio[boundary - window:boundary]
        after = audio[boundary:boundary + window]
        boundaries.append({
            "atSeconds": round(boundary / sample_rate, 3),
            "sampleDeltaDbfs": round(db(float(np.max(np.abs(audio[boundary] - audio[boundary - 1])))), 2),
            "rmsDeltaDb": round(abs(db(rms(after)) - db(rms(before))), 2),
        })
        boundary += hop

    interior = audio[sample_rate * 10:-sample_rate * 10]
    silence_window = max(1, int(round(0.1 * sample_rate)))
    usable = interior[:len(interior) - (len(interior) % silence_window)]
    frames = usable.reshape(-1, silence_window, audio.shape[1])
    digital_silence_frames = int(np.sum(np.max(np.abs(frames), axis=(1, 2)) < 1e-7))

    print(json.dumps({
        "file": args.file,
        "joinCount": len(boundaries),
        "maxJoinSampleDeltaDbfs": max((item["sampleDeltaDbfs"] for item in boundaries), default=-240),
        "maxJoinRmsDeltaDb": max((item["rmsDeltaDb"] for item in boundaries), default=0),
        "digitalSilence100msFrames": digital_silence_frames,
        "boundaries": boundaries,
    }, indent=2))


if __name__ == "__main__":
    main()
