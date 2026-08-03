#!/usr/bin/env python3
"""Functional soundscape QA gates for sleep/meditation/focus candidates.

This is intentionally lightweight and deterministic. It does not try to decide
whether a piece is beautiful. It rejects obvious blockers for SNOOZE content:
strong onset density, high-frequency harshness, large loudness motion, clipping,
and pulse-like envelope regularity.
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal


THRESHOLDS = {
    "sleep": {
        "target_lufs_min": -32.0,
        "target_lufs_max": -22.0,
        "lra_proxy_max": 8.0,
        "onsets_per_minute_max": 10.0,
        "envelope_events_per_minute_max": 8.0,
        "high_frequency_ratio_max": 0.045,
        "pulse_strength_max": 0.34,
        "opening_peak_dbfs_max": -8.0,
        "sample_peak_dbfs_max": -3.0,
    },
    "meditation": {
        "target_lufs_min": -31.0,
        "target_lufs_max": -21.0,
        "lra_proxy_max": 10.0,
        "onsets_per_minute_max": 14.0,
        "envelope_events_per_minute_max": 10.0,
        "high_frequency_ratio_max": 0.055,
        "pulse_strength_max": 0.38,
        "opening_peak_dbfs_max": -7.0,
        "sample_peak_dbfs_max": -3.0,
    },
    "focus": {
        "target_lufs_min": -30.0,
        "target_lufs_max": -20.0,
        "lra_proxy_max": 12.0,
        "onsets_per_minute_max": 22.0,
        "envelope_events_per_minute_max": 18.0,
        "high_frequency_ratio_max": 0.075,
        "pulse_strength_max": 0.44,
        "opening_peak_dbfs_max": -6.0,
        "sample_peak_dbfs_max": -2.0,
    },
}


def db(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def frame_rms_db(mono: np.ndarray, sample_rate: int, frame_seconds: float = 0.4) -> np.ndarray:
    frame = max(1, int(sample_rate * frame_seconds))
    usable = mono[: len(mono) - (len(mono) % frame)]
    if len(usable) == 0:
        return np.array([], dtype=np.float32)
    blocks = usable.reshape(-1, frame)
    rms = np.sqrt(np.mean(blocks * blocks, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def spectral_flux_onsets_per_minute(mono: np.ndarray, sample_rate: int) -> float:
    frequencies, times, spectrogram = signal.stft(
        mono,
        fs=sample_rate,
        window="hann",
        nperseg=2048,
        noverlap=1536,
        boundary=None,
    )
    if spectrogram.shape[1] < 4:
        return 0.0
    magnitude = np.abs(spectrogram)
    # Ignore sub-bass/low-body bins. A stationary low drone can create STFT
    # phase/bin changes that look like flux but are not perceived as note
    # attacks or beat events.
    active = frequencies >= 120
    if not np.any(active) or float(np.sum(magnitude[active])) < 1e-7:
        return 0.0
    magnitude = magnitude[active]
    diff = np.diff(magnitude, axis=1)
    positive = np.maximum(diff, 0.0)
    flux = np.sum(positive, axis=0)
    if np.max(flux) <= 1e-9:
        return 0.0
    flux = flux / (np.median(flux) + 1e-9)
    peaks, _ = signal.find_peaks(flux, height=6.0, distance=max(1, int(0.8 / (times[1] - times[0]))))
    minutes = len(mono) / sample_rate / 60
    return float(len(peaks) / max(minutes, 1e-9))


def envelope_events_per_minute(mono: np.ndarray, sample_rate: int) -> float:
    analytic = signal.hilbert(mono)
    envelope = np.abs(analytic)
    smoothing = max(1, int(sample_rate * 0.25))
    kernel = np.ones(smoothing, dtype=np.float32) / smoothing
    smooth = np.convolve(envelope, kernel, mode="same")
    if np.max(smooth) <= 1e-9:
        return 0.0
    normalized = smooth / (np.median(smooth) + 1e-9)
    peaks, _ = signal.find_peaks(normalized, height=1.55, distance=max(1, int(sample_rate * 2.0)))
    minutes = len(mono) / sample_rate / 60
    return float(len(peaks) / max(minutes, 1e-9))


def high_frequency_ratio(mono: np.ndarray, sample_rate: int, cutoff_hz: float = 4000.0) -> float:
    frequencies, _, spectrogram = signal.spectrogram(
        mono,
        fs=sample_rate,
        window="hann",
        nperseg=4096,
        noverlap=2048,
        scaling="spectrum",
    )
    power = np.maximum(spectrogram, 0.0)
    total = float(np.sum(power)) + 1e-12
    high = float(np.sum(power[frequencies >= cutoff_hz]))
    return high / total


def pulse_strength(mono: np.ndarray, sample_rate: int) -> float:
    rms_db = frame_rms_db(mono, sample_rate, 0.2)
    if len(rms_db) < 20:
        return 0.0
    if float(np.percentile(rms_db, 95) - np.percentile(rms_db, 10)) < 1.5:
        return 0.0
    centered = rms_db - np.mean(rms_db)
    std = float(np.std(centered))
    if std < 1e-6:
        return 0.0
    autocorr = np.correlate(centered, centered, mode="full")[len(centered) - 1 :]
    autocorr = autocorr / (autocorr[0] + 1e-9)
    frame_rate = 1 / 0.2
    min_lag = int(frame_rate * 0.35)
    max_lag = min(len(autocorr), int(frame_rate * 2.5))
    if max_lag <= min_lag:
        return 0.0
    return float(np.max(autocorr[min_lag:max_lag]))


def analyze(file_path: str, goal: str) -> dict:
    audio, sample_rate = sf.read(file_path, always_2d=True, dtype="float32")
    mono = np.mean(audio, axis=1)
    meter = pyln.Meter(sample_rate)
    rms_db = frame_rms_db(mono, sample_rate, 0.4)
    opening = audio[: min(len(audio), sample_rate * 20)]
    integrated = float(meter.integrated_loudness(audio))
    lra_proxy = float(np.percentile(rms_db, 95) - np.percentile(rms_db, 10)) if len(rms_db) else 0.0
    metrics = {
        "file": file_path,
        "goal": goal,
        "durationSeconds": round(len(audio) / sample_rate, 3),
        "sampleRate": sample_rate,
        "channels": audio.shape[1],
        "integratedLufs": round(integrated, 2),
        "lraProxyDb": round(lra_proxy, 2),
        "samplePeakDbfs": round(db(float(np.max(np.abs(audio)))), 2),
        "opening20sPeakDbfs": round(db(float(np.max(np.abs(opening)))), 2),
        "onsetsPerMinute": round(spectral_flux_onsets_per_minute(mono, sample_rate), 2),
        "envelopeEventsPerMinute": round(envelope_events_per_minute(mono, sample_rate), 2),
        "highFrequencyEnergyRatio": round(high_frequency_ratio(mono, sample_rate), 5),
        "pulseStrength": round(pulse_strength(mono, sample_rate), 3),
        "clippedSampleCount": int(np.sum(np.abs(audio) >= 0.999)),
    }
    thresholds = THRESHOLDS[goal]
    failures = []
    if metrics["integratedLufs"] < thresholds["target_lufs_min"] or metrics["integratedLufs"] > thresholds["target_lufs_max"]:
        failures.append("lufs_out_of_range")
    if metrics["lraProxyDb"] > thresholds["lra_proxy_max"]:
        failures.append("loudness_motion_too_large")
    if metrics["onsetsPerMinute"] > thresholds["onsets_per_minute_max"]:
        failures.append("onset_density_too_high")
    if metrics["envelopeEventsPerMinute"] > thresholds["envelope_events_per_minute_max"]:
        failures.append("note_or_envelope_density_too_high")
    if metrics["highFrequencyEnergyRatio"] > thresholds["high_frequency_ratio_max"]:
        failures.append("high_frequency_energy_too_high")
    pulse_has_event_support = (
        metrics["onsetsPerMinute"] > 1.0
        or metrics["envelopeEventsPerMinute"] > 1.0
    )
    if metrics["pulseStrength"] > thresholds["pulse_strength_max"] and pulse_has_event_support:
        failures.append("pulse_strength_too_high")
    if metrics["opening20sPeakDbfs"] > thresholds["opening_peak_dbfs_max"]:
        failures.append("opening_too_loud")
    if metrics["samplePeakDbfs"] > thresholds["sample_peak_dbfs_max"]:
        failures.append("peak_too_hot")
    if metrics["clippedSampleCount"] > 0:
        failures.append("clipping")
    metrics["machineStatus"] = "pass" if not failures else "fail"
    metrics["failures"] = failures
    metrics["thresholds"] = thresholds
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--goal", choices=sorted(THRESHOLDS), default="sleep")
    parser.add_argument("--output")
    args = parser.parse_args()

    results = [analyze(file, args.goal) for file in args.files]
    payload = results[0] if len(results) == 1 else {"results": results}
    text = json.dumps(payload, indent=2)
    if args.output:
        Path(args.output).write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
