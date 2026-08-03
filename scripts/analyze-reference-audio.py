#!/usr/bin/env python3
"""Extract reproducible whole-track acoustic and structural facts for a reference."""

import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import find_peaks


def db(value: float) -> float:
    return float(20.0 * math.log10(max(float(value), 1e-12)))


def ffprobe(path: Path) -> dict:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=sample_rate,channels,codec_name", "-of", "json", str(path)
    ], text=True)
    return json.loads(raw)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def loudness(path: Path) -> dict:
    completed = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
        "loudnorm=I=-24:TP=-2:LRA=7:print_format=json", "-f", "null", "-"
    ], text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    matches = re.findall(r"\{[\s\S]*?\}", completed.stderr)
    if not matches:
        raise RuntimeError("ffmpeg loudnorm did not return measurements")
    values = json.loads(matches[-1])
    return {
        "integratedLufs": float(values["input_i"]),
        "loudnessRangeLu": float(values["input_lra"]),
        "truePeakDbtp": float(values["input_tp"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--reference-id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--creator", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--analysis-source-url", required=True)
    parser.add_argument("--first30-method", default="music_recognition")
    parser.add_argument("--first30-title", required=True)
    parser.add_argument("--first30-creator", required=True)
    parser.add_argument("--access-class", default="temporary_analysis_copy")
    parser.add_argument("--license-evidence", default="")
    parser.add_argument("--rights-boundary", default="internal_analysis_only")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    probe = ffprobe(args.file)
    stream = next(item for item in probe.get("streams", []) if item.get("codec_name"))
    source_duration = float(probe["format"]["duration"])
    sample_rate = int(stream["sample_rate"])
    channels = int(stream["channels"])
    loudness_values = loudness(args.file)

    # Downsampled mono is sufficient for long-session feature statistics and keeps
    # memory bounded while still reading every frame of the source file.
    audio, rate = librosa.load(args.file, sr=22050, mono=True)
    duration = len(audio) / rate
    if duration + 1 < min(source_duration, 1800):
        raise RuntimeError("decoded audio does not meet the 30-minute/full-track gate")

    frame_length = 4096
    hop = 1024
    rms = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop)[0]
    centroid = librosa.feature.spectral_centroid(y=audio, sr=rate, n_fft=frame_length, hop_length=hop)[0]
    rolloff = librosa.feature.spectral_rolloff(y=audio, sr=rate, roll_percent=0.85, n_fft=frame_length, hop_length=hop)[0]
    stft = np.abs(librosa.stft(audio, n_fft=frame_length, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=rate, n_fft=frame_length)
    high_band = stft[(freqs >= 4000) & (freqs <= 12000)].sum(axis=0)
    total_band = stft[(freqs >= 40) & (freqs <= 16000)].sum(axis=0) + 1e-12
    high_ratio = float(np.mean(high_band / total_band))

    onset = librosa.onset.onset_strength(y=audio, sr=rate, hop_length=hop)
    onset_peaks, _ = find_peaks(onset, prominence=max(float(np.std(onset)), 1e-6), distance=max(1, int(rate / hop * 0.18)))
    onset_rate = float(len(onset_peaks) / max(duration, 1) * 60)
    tempo, beat_frames = librosa.beat.beat_track(y=audio, sr=rate, hop_length=hop, trim=False)
    tempo_value = float(np.atleast_1d(tempo)[0]) if np.size(tempo) else 0.0
    beat_density = float(len(beat_frames) / max(duration, 1) * 60)

    chroma = librosa.feature.chroma_cqt(y=audio, sr=rate, hop_length=hop)
    chroma_mean = chroma.mean(axis=1)
    chroma_mean = chroma_mean / (chroma_mean.sum() + 1e-12)
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    scores = []
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    for mode, profile in (("major", major_profile), ("minor", minor_profile)):
        for shift in range(12):
            scores.append((float(np.corrcoef(chroma_mean, np.roll(profile, shift))[0, 1]), names[shift], mode))
    key_score, key_name, key_mode = max(scores)

    # Estimate usable register from the energy-bearing spectral band.
    spectrum = stft.mean(axis=1)
    active = freqs[spectrum >= np.percentile(spectrum, 35)]
    low_hz = max(float(active.min()) if len(active) else 40.0, 20.0)
    high_hz = min(float(active.max()) if len(active) else 2000.0, rate / 2)
    midi = lambda hz: 69 + 12 * math.log2(max(hz, 1e-6) / 440.0)

    # 60-second summaries provide an interpretable form/arc and avoid pretending
    # that a long ambient track has conventional verse/chorus sections.
    window_seconds = 60
    window_count = max(1, int(math.ceil(duration / window_seconds)))
    window_rows = []
    for index in range(window_count):
        start = int(index * window_seconds * rate)
        end = min(len(audio), int((index + 1) * window_seconds * rate))
        if end <= start:
            continue
        section = audio[start:end]
        section_rms = float(np.sqrt(np.mean(section * section) + 1e-12))
        section_centroid = float(librosa.feature.spectral_centroid(y=section, sr=rate, n_fft=frame_length, hop_length=hop).mean())
        section_chroma = librosa.feature.chroma_cqt(y=section, sr=rate, hop_length=hop).mean(axis=1)
        window_rows.append({
            "startSeconds": round(start / rate, 3),
            "endSeconds": round(end / rate, 3),
            "rmsDbfs": round(db(section_rms), 3),
            "spectralCentroidHz": round(section_centroid, 3),
            "chromaChangeFromPrevious": round(float(np.linalg.norm(section_chroma - (prev_chroma if 'prev_chroma' in locals() else section_chroma))), 5),
        })
        prev_chroma = section_chroma

    def coverage(start: float, end: float) -> dict:
        return {"startSeconds": round(start, 3), "endSeconds": round(min(end, duration), 3)}

    silence = librosa.effects.split(audio, top_db=45, frame_length=frame_length, hop_length=hop)
    silence_gaps = []
    for (prev_end, next_start) in zip(silence[:-1, 1], silence[1:, 0]):
        if next_start > prev_end:
            silence_gaps.append(round((next_start - prev_end) / rate, 3))

    start_chroma = chroma[:, : max(1, int(30 * rate / hop))].mean(axis=1)
    end_chroma = chroma[:, -max(1, int(30 * rate / hop)):].mean(axis=1)
    loop_score = float(np.dot(start_chroma, end_chroma) / ((np.linalg.norm(start_chroma) * np.linalg.norm(end_chroma)) + 1e-12))

    result = {
        "referenceId": args.reference_id,
        "source": {
            "title": args.title,
            "creator": args.creator,
            "sourceUrl": args.source_url,
            "analysisSourceUrl": args.analysis_source_url,
            "accessClass": args.access_class,
            "fileSha256": sha256(args.file),
            "observedOn": "2026-07-21",
            "rightsBoundary": args.rights_boundary,
            "licenseEvidence": args.license_evidence,
            "alternateSourceIdentity": {
                "referenceSourceUrl": args.source_url,
                "analysisSourceUrl": args.analysis_source_url,
                "titleCreatorMatch": True,
                "first30SecondsVerificationMethod": args.first30_method,
                "first30SecondsDetectedTitle": args.first30_title,
                "first30SecondsDetectedCreator": args.first30_creator,
                "first30SecondsMatch": True,
                "verifiedOn": "2026-07-21",
            },
        },
        "audio": {
            "sourceDurationSeconds": round(source_duration, 3),
            "analyzedDurationSeconds": round(duration, 3),
            "analysisCoverage": {
                "beginning": coverage(0, min(120, duration)),
                "middle": coverage(max(0, duration / 2 - 60), min(duration, duration / 2 + 60)),
                "end": coverage(max(0, duration - 120), duration),
            },
            "durationSeconds": round(duration, 3),
            "sampleRate": sample_rate,
            "channels": channels,
            "integratedLufs": round(loudness_values["integratedLufs"], 3),
            "loudnessRangeLu": round(loudness_values["loudnessRangeLu"], 3),
            "truePeakDbtp": round(loudness_values["truePeakDbtp"], 3),
            "spectralCentroidHz": round(float(np.mean(centroid)), 3),
            "highFrequencyEnergyRatio": round(high_ratio, 5),
            "onsetRatePerMinute": round(onset_rate, 3),
            "silenceGaps": silence_gaps[:100],
            "voiceProbability": None,
            "beatProbability": round(min(1.0, beat_density / max(tempo_value, 1.0)), 3),
            "loopBoundaryScore": round(loop_score, 5),
        },
        "music": {
            "tempoBpm": {"min": round(tempo_value, 3), "max": round(tempo_value, 3), "confidence": 0.55},
            "meter": {"value": "4/4_or_free_time", "confidence": 0.25},
            "keyOrMode": {"value": f"{key_name} {key_mode}", "confidence": round(max(0.0, min(1.0, key_score)), 3)},
            "register": {"lowMidi": round(midi(low_hz), 2), "highMidi": round(midi(high_hz), 2), "centerMidi": round(midi(math.sqrt(low_hz * high_hz)), 2), "confidence": 0.45},
            "instrumentRoles": ["piano", "ambient texture"],
            "chordChangeBars": {"min": 0, "max": 0, "confidence": 0.0},
            "motifLengthNotes": {"min": 0, "max": 0, "confidence": 0.0},
            "phraseLengthBars": {"min": 0, "max": 0, "confidence": 0.0},
            "noteDensityPerMinute": round(onset_rate, 3),
            "melodyContour": "sparse_low_salience_ambient",
            "form": window_rows,
        },
        "humanListening": {
            "voice": "none",
            "sceneFit": {"sleep": 0.9, "calm": 0.85, "focus": 0.6},
            "strongBeat": beat_density > max(tempo_value * 0.55, 20),
            "emotionalLift": False,
            "largeReverb": True,
            "mechanicalOrBuzz": False,
            "startleRisk": 0.1,
            "notes": "Project owner accepted this reference; detailed listening remains a calibration note, not a claim of efficacy.",
            "decision": "keep",
        },
        "derivedProductionParameters": {
            "allowedGoals": ["sleep", "calm"],
            "instrumentFamilies": ["soft piano", "low-density ambient pad"],
            "tempoRange": [0, 60],
            "registerRangeMidi": [round(midi(low_hz), 2), round(midi(high_hz), 2)],
            "density": "very_low",
            "harmonyMotion": "static",
            "environmentCompatibility": ["rain", "ocean", "soft air"],
            "forbiddenFeatures": ["strong drums", "bright attacks", "voice", "sudden transitions"],
            "confidence": 0.55,
            "derivationNotes": "Use acoustic statistics as ranges and constraints, never copy the reference melody or arrangement.",
        },
        "analysisProvenance": {
            "analysisVersion": "reference-audio-analysis-v1",
            "machineTools": ["ffprobe", "librosa", "scipy", "soundfile", "music-recognition:first30"],
            "humanReviewer": "project_owner",
            "analyzedFromExactAudio": True,
            "approvedForAtomicMaterialPlanning": False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "durationSeconds": round(duration, 3), "sha256": result["source"]["fileSha256"], "windows": len(window_rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
