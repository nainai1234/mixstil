#!/usr/bin/env python3
"""Generate deterministic, non-rhythmic foundation pads for internal review."""

import argparse
import math
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
from scipy.io import wavfile


RATE = 48_000
DURATION = 60
PROFILES = {
    "night_neutral": {
        "roots": [(73.42, 0.48), (110.13, 0.14), (146.84, 0.22), (220.25, 0.045)],
        "noise": 0.004,
        "harmonic": 0.12,
        "target_lufs": -26.0,
    },
    "deep_sleep_low": {
        "roots": [(65.41, 0.54), (98.12, 0.11), (130.81, 0.19), (196.24, 0.025)],
        "noise": 0.003,
        "harmonic": 0.08,
        "target_lufs": -27.0,
    },
    "return_to_sleep_soft": {
        "roots": [(82.41, 0.45), (123.62, 0.12), (164.81, 0.20), (247.23, 0.035)],
        "noise": 0.0035,
        "harmonic": 0.10,
        "target_lufs": -27.0,
    },
    "calm_grounded": {
        "roots": [(87.31, 0.42), (130.81, 0.16), (174.62, 0.18), (261.63, 0.035)],
        "noise": 0.0035,
        "harmonic": 0.10,
        "target_lufs": -26.0,
    },
    "meditation_open": {
        "roots": [(98.00, 0.40), (146.83, 0.15), (196.00, 0.18), (293.66, 0.030)],
        "noise": 0.003,
        "harmonic": 0.09,
        "target_lufs": -26.0,
    },
    "focus_neutral": {
        "roots": [(110.00, 0.38), (165.00, 0.14), (220.00, 0.16), (330.00, 0.025)],
        "noise": 0.0025,
        "harmonic": 0.07,
        "target_lufs": -25.0,
        "motion": 0.035,
        "drift": 0.0007,
        "noise_smoothing": 5,
    },
    "focus_warm_mid": {
        "roots": [(123.47, 0.34), (185.00, 0.15), (246.94, 0.13), (369.99, 0.018)],
        "noise": 0.0018,
        "harmonic": 0.045,
        "target_lufs": -25.0,
        "motion": 0.022,
        "drift": 0.0004,
        "noise_smoothing": 7,
    },
    "focus_low_anchor": {
        "roots": [(82.41, 0.44), (123.62, 0.12), (164.81, 0.14), (247.23, 0.020)],
        "noise": 0.0022,
        "harmonic": 0.055,
        "target_lufs": -25.0,
        "motion": 0.018,
        "drift": 0.00025,
        "noise_smoothing": 8,
    },
    "focus_open_air": {
        "roots": [(130.81, 0.30), (196.00, 0.13), (261.63, 0.11), (392.00, 0.015)],
        "noise": 0.0028,
        "harmonic": 0.030,
        "target_lufs": -25.0,
        "motion": 0.048,
        "drift": 0.0010,
        "noise_smoothing": 4,
    },
}


def slow_envelope(t: np.ndarray, period: float, phase: float, depth: float) -> np.ndarray:
    return 1.0 + depth * np.sin(2 * np.pi * t / period + phase)


def oscillator(
    t: np.ndarray,
    frequency: float,
    phase: float,
    drift_period: float,
    drift_depth: float,
) -> np.ndarray:
    drift = drift_depth * np.sin(2 * np.pi * t / drift_period + phase)
    warped_time = t + drift_period * drift / (2 * np.pi)
    return np.sin(2 * np.pi * frequency * warped_time + phase)


def render(seed: int, profile_name: str) -> np.ndarray:
    rng = np.random.default_rng(seed)
    t = np.arange(RATE * DURATION, dtype=np.float64) / RATE
    profile = PROFILES[profile_name]
    channels = []

    for channel in range(2):
        signal = np.zeros_like(t)
        for index, (frequency, amplitude) in enumerate(profile["roots"]):
            stereo_detune = 1 + (channel * 2 - 1) * (0.00035 + index * 0.00005)
            phase = rng.uniform(0, 2 * np.pi)
            drift_depth = profile.get("drift", 0.0007)
            motion_depth = profile.get("motion", 0.035)
            tone = oscillator(t, frequency * stereo_detune, phase, 29 + index * 7, drift_depth)
            tone += profile["harmonic"] * oscillator(
                t,
                frequency * 2 * stereo_detune,
                phase / 2,
                41 + index * 5,
                drift_depth * 0.7,
            )
            signal += amplitude * slow_envelope(t, 23 + index * 11, phase, motion_depth) * tone

        noise = rng.normal(0, 1, len(t))
        for _ in range(profile.get("noise_smoothing", 5)):
            noise = np.convolve(noise, np.ones(9) / 9, mode="same")
        signal += profile["noise"] * noise
        channels.append(signal)

    audio = np.stack(channels, axis=1)
    fade_samples = RATE * 8
    fade = np.sin(np.linspace(0, np.pi / 2, fade_samples)) ** 2
    audio[:fade_samples] *= fade[:, None]
    audio[-fade_samples:] *= fade[::-1, None]

    meter = pyln.Meter(RATE)
    loudness = meter.integrated_loudness(audio)
    audio *= 10 ** ((profile["target_lufs"] - loudness) / 20)
    peak = float(np.max(np.abs(audio)))
    peak_ceiling = 10 ** (-9 / 20)
    if peak > peak_ceiling:
        audio *= peak_ceiling / peak
    return audio.astype(np.float32)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=PROFILES, default="night_neutral")
    parser.add_argument("--output")
    parser.add_argument("--seed", type=int, default=73401)
    args = parser.parse_args()
    output = Path(args.output or f"public/audio/music/local-candidates/2026-07-13/procedural_{args.profile}.wav")
    output.parent.mkdir(parents=True, exist_ok=True)
    # scipy writes a stable IEEE-float WAV header. libsndfile adds a PEAK chunk
    # timestamp for float WAVs, which changes the file hash across identical runs.
    wavfile.write(output, RATE, render(args.seed, args.profile))
    print(output)


if __name__ == "__main__":
    main()
