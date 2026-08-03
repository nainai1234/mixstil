#!/usr/bin/env python3
"""Generate Functional Soundscape Engine v1 deterministic sleep content.

Design goals:
- no AI model;
- stable core is seamless-loopable;
- final preview is assembled from arrival -> settle -> looped stable core -> release;
- future runtime can repeat the stable core for 30 minutes or 8 hours.
"""

import argparse
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal


ROOT = Path(__file__).resolve().parents[1]
RATE = 48_000
LOOP_SECONDS = 60


def pink_noise(rng: np.random.Generator, samples: int) -> np.ndarray:
    white = rng.normal(0, 1, samples)
    spectrum = np.fft.rfft(white)
    frequencies = np.fft.rfftfreq(samples, 1 / RATE)
    shaping = 1 / np.sqrt(np.maximum(frequencies, 1.0))
    shaped = np.fft.irfft(spectrum * shaping, n=samples)
    shaped = shaped / (np.max(np.abs(shaped)) + 1e-9)
    return shaped.astype(np.float32)


def butter_filter(audio: np.ndarray, cutoff: float, kind: str, order: int = 4) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype=kind, fs=RATE, output="sos")
    return signal.sosfiltfilt(sos, audio).astype(np.float32)


def equal_power_pan(mono: np.ndarray, pan: float) -> np.ndarray:
    angle = (pan + 1) * math.pi / 4
    left = mono * math.cos(angle)
    right = mono * math.sin(angle)
    return np.column_stack([left, right]).astype(np.float32)


def periodic_lfo(t: np.ndarray, cycles: int, depth: float, phase: float = 0.0) -> np.ndarray:
    return 1.0 + depth * np.sin(2 * np.pi * cycles * t / t[-1] + phase)


def normalize(audio: np.ndarray, target_lufs: float, peak_db: float = -8.0) -> np.ndarray:
    meter = pyln.Meter(RATE)
    measured = meter.integrated_loudness(audio)
    normalized = pyln.normalize.loudness(audio, measured, target_lufs)
    peak = float(np.max(np.abs(normalized))) + 1e-9
    peak_limit = 10 ** (peak_db / 20)
    if peak > peak_limit:
        normalized = normalized * (peak_limit / peak)
    return normalized.astype(np.float32)


def fade(audio: np.ndarray, fade_in: float, fade_out: float) -> np.ndarray:
    result = audio.copy()
    in_samples = min(len(result), int(fade_in * RATE))
    out_samples = min(len(result), int(fade_out * RATE))
    if in_samples:
        result[:in_samples] *= np.linspace(0, 1, in_samples)[:, None]
    if out_samples:
        result[-out_samples:] *= np.linspace(1, 0, out_samples)[:, None]
    return result


def stable_sleep_core(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    samples = LOOP_SECONDS * RATE
    t = np.linspace(0, LOOP_SECONDS, samples, endpoint=False, dtype=np.float32)

    # Low body: musically non-performative, no chord progression.
    body = (
        0.38 * np.sin(2 * np.pi * 55.0 * t)
        + 0.22 * np.sin(2 * np.pi * 82.5 * t + 0.7)
        + 0.11 * np.sin(2 * np.pi * 110.0 * t + 1.4)
    )
    body *= periodic_lfo(t, cycles=1, depth=0.045, phase=0.2)
    body = butter_filter(body, 650, "lowpass")

    # Warm air: low-level texture, not a white-noise foreground.
    air = pink_noise(rng, samples)
    air = butter_filter(air, 1350, "lowpass")
    air = butter_filter(air, 120, "highpass")
    air *= periodic_lfo(t, cycles=2, depth=0.055, phase=1.1)

    # Soft movement layer: extremely slow, no note attacks.
    movement = (
        0.07 * np.sin(2 * np.pi * 0.0333333333 * t + 0.4)
        + 0.04 * np.sin(2 * np.pi * 0.0666666667 * t + 1.8)
    )
    movement = butter_filter(movement, 90, "lowpass")

    mono = body * 0.46 + air * 0.045 + movement * 0.12
    stereo = (
        equal_power_pan(body, -0.08) * 0.46
        + equal_power_pan(air, 0.16) * 0.045
        + equal_power_pan(movement, 0.0) * 0.12
    )
    del mono

    # Equal power pan produces slight level difference; keep core conservative.
    return normalize(stereo, -29.0, -9.0)


def assemble_preview(core: np.ndarray, duration: int) -> np.ndarray:
    arrival_seconds = 30
    settle_seconds = 90
    release_seconds = 30
    stable_seconds = max(LOOP_SECONDS, duration - arrival_seconds - settle_seconds - release_seconds)

    repeats = math.ceil(stable_seconds / LOOP_SECONDS)
    stable = np.tile(core, (repeats, 1))[: stable_seconds * RATE]

    arrival = stable[: arrival_seconds * RATE] * 0.45
    settle = stable[arrival_seconds * RATE : (arrival_seconds + settle_seconds) * RATE] if len(stable) >= (arrival_seconds + settle_seconds) * RATE else stable[: settle_seconds * RATE]
    settle = settle * np.linspace(0.50, 0.82, len(settle))[:, None]
    stable_main = stable[: stable_seconds * RATE] * 0.86
    release = stable[-release_seconds * RATE :] * np.linspace(0.70, 0.22, release_seconds * RATE)[:, None]

    preview = np.concatenate([arrival, settle, stable_main, release], axis=0)
    preview = fade(preview, 5, 24)
    return normalize(preview[: duration * RATE], -27.5, -8.0)


def write_audio(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, audio, RATE, subtype="PCM_24")


def encode_mp3(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        str(target),
    ], check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=825001)
    parser.add_argument("--duration", type=int, default=300)
    parser.add_argument("--output-dir", default="public/audio/music/functional-engine-v1")
    parser.add_argument("--review-dir", default="public/audio/music/local-review/functional-engine-v1")
    args = parser.parse_args()

    output_dir = ROOT / args.output_dir
    review_dir = ROOT / args.review_dir
    core = stable_sleep_core(args.seed)
    preview = assemble_preview(core, args.duration)

    core_wav = output_dir / "sleep_foundation_stable_core_loop_025.wav"
    preview_wav = output_dir / "sleep_arrival_settle_stable_release_025.wav"
    preview_mp3 = review_dir / "sleep_arrival_settle_stable_release_025.mp3"
    write_audio(core_wav, core)
    write_audio(preview_wav, preview)
    encode_mp3(preview_wav, preview_mp3)

    metadata = {
        "engine": "functional_soundscape_engine_v1",
        "contentId": "sleep_arrival_settle_stable_release_025",
        "seed": args.seed,
        "sampleRate": RATE,
        "durationSeconds": args.duration,
        "stableCoreLoopSeconds": LOOP_SECONDS,
        "dynamicPlaybackPlan": {
            "arrivalSeconds": 30,
            "settleSeconds": 90,
            "stableCore": "repeat this seamless core to match requested session length",
            "releaseSeconds": 30
        },
        "files": {
            "stableCoreLoopWav": str(core_wav.relative_to(ROOT)),
            "previewWav": str(preview_wav.relative_to(ROOT)),
            "previewMp3": str(preview_mp3.relative_to(ROOT))
        },
        "policy": [
            "no AI model used",
            "no melody line",
            "no beat or percussion",
            "noise is background texture, not foreground white-noise content",
            "stable core can be looped for long-session playback"
        ]
    }
    metadata_path = output_dir / "sleep_arrival_settle_stable_release_025.json"
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
