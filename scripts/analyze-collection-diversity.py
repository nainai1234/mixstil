#!/usr/bin/env python3
"""Detect collections that only rename near-identical rendered audio."""

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import welch


def spectral_signature(file: Path) -> np.ndarray:
    audio, sample_rate = sf.read(file, always_2d=True, dtype="float32")
    mono = np.mean(audio, axis=1)
    edges = np.geomspace(30, min(12_000, sample_rate / 2), 33)
    bands = []
    for start in range(0, len(mono) - sample_rate * 2 + 1, sample_rate * 5):
        frequencies, power = welch(mono[start:start + sample_rate * 2], sample_rate, nperseg=32768)
        bands.append([
            np.log10(np.sum(power[(frequencies >= low) & (frequencies < high)]) + 1e-14)
            for low, high in zip(edges[:-1], edges[1:])
        ])
    band_matrix = np.asarray(bands)
    mean_bands = np.mean(band_matrix, axis=0)
    mean_bands -= np.mean(mean_bands)
    band_variation = np.std(band_matrix, axis=0)
    one_second = len(mono) // sample_rate * sample_rate
    envelope = 20 * np.log10(np.sqrt(np.mean(mono[:one_second].reshape(-1, sample_rate) ** 2, axis=1)) + 1e-12)
    return np.concatenate([
        mean_bands / 10,
        band_variation / 3,
        [np.std(envelope) / 5, (np.percentile(envelope, 90) - np.percentile(envelope, 10)) / 10],
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory")
    parser.add_argument("--threshold", type=float, default=0.98)
    args = parser.parse_args()

    files = sorted(Path(args.directory).glob("*.mp3"))
    signatures = {file.stem: spectral_signature(file) for file in files}
    pairs = []
    names = list(signatures)
    for index, left in enumerate(names):
        for right in names[index + 1:]:
            left_signature = signatures[left]
            right_signature = signatures[right]
            similarity = float(np.dot(left_signature, right_signature) / (np.linalg.norm(left_signature) * np.linalg.norm(right_signature)))
            pairs.append({
                "left": left,
                "right": right,
                "spectralCorrelation": round(similarity, 4),
                "nearDuplicate": similarity >= args.threshold,
            })

    duplicates = [pair for pair in pairs if pair["nearDuplicate"]]
    print(json.dumps({
        "fileCount": len(files),
        "threshold": args.threshold,
        "status": "fail" if duplicates else "pass",
        "nearDuplicatePairCount": len(duplicates),
        "maxSpectralCorrelation": max((pair["spectralCorrelation"] for pair in pairs), default=0),
        "nearDuplicatePairs": duplicates,
        "pairs": pairs,
    }, indent=2))


if __name__ == "__main__":
    main()
