#!/usr/bin/env python3
"""Report acoustic safety facts for a generated music candidate."""

import argparse
import json
import math

import numpy as np
import pyloudnorm as pyln
import soundfile as sf


def db(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("file")
    args = parser.parse_args()

    audio, sample_rate = sf.read(args.file, always_2d=True, dtype="float32")
    mono = np.mean(audio, axis=1)
    meter = pyln.Meter(sample_rate)
    window = max(1, int(sample_rate * 0.1))
    usable = mono[: len(mono) - (len(mono) % window)]
    frames = usable.reshape(-1, window)
    frame_rms = np.sqrt(np.mean(frames * frames, axis=1) + 1e-12)
    frame_db = 20 * np.log10(frame_rms)
    jumps = np.abs(np.diff(frame_db))
    non_silent = frame_db > -50
    interior_silence_frames = int(np.sum(~non_silent[10:-10])) if len(non_silent) > 20 else 0
    opening = audio[: min(len(audio), sample_rate * 20)]

    print(json.dumps({
        "file": args.file,
        "durationSeconds": round(len(audio) / sample_rate, 3),
        "sampleRate": sample_rate,
        "channels": audio.shape[1],
        "integratedLufs": round(float(meter.integrated_loudness(audio)), 2),
        "samplePeakDbfs": round(db(float(np.max(np.abs(audio)))), 2),
        "opening20sPeakDbfs": round(db(float(np.max(np.abs(opening)))), 2),
        "max100msRmsJumpDb": round(float(np.max(jumps)) if len(jumps) else 0, 2),
        "p99_100msRmsJumpDb": round(float(np.percentile(jumps, 99)) if len(jumps) else 0, 2),
        "interiorSilence100msFrames": interior_silence_frames,
        "clippedSampleCount": int(np.sum(np.abs(audio) >= 0.999)),
    }, indent=2))


if __name__ == "__main__":
    main()
