#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np

ROOT = Path.cwd()
BATCH_ID = os.environ.get("LYRIA_FOUNDATIONAL_BATCH_ID", "lyria-foundational-expansion-v2")
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"


def chroma_similarity(left, right):
    left = left / (np.linalg.norm(left) + 1e-12)
    right = right / (np.linalg.norm(right) + 1e-12)
    return float(np.dot(left, right))


def analyze(candidate):
    source = ROOT / "public" / candidate["audioUrl"].lstrip("/")
    audio, rate = librosa.load(source, sr=22050, mono=True)
    hop = 512
    duration = len(audio) / rate
    onset = librosa.onset.onset_strength(y=audio, sr=rate, hop_length=hop)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset, sr=rate, hop_length=hop, backtrack=False)
    centroid = librosa.feature.spectral_centroid(y=audio, sr=rate, hop_length=hop)[0]
    rms = librosa.feature.rms(y=audio, hop_length=hop)[0]
    chroma = librosa.feature.chroma_cqt(y=audio, sr=rate, hop_length=hop).mean(axis=1)
    edge_frames = max(1, int(2.0 * rate / hop))
    start_chroma = librosa.feature.chroma_cqt(y=audio[: edge_frames * hop], sr=rate, hop_length=hop).mean(axis=1)
    end_chroma = librosa.feature.chroma_cqt(y=audio[-edge_frames * hop :], sr=rate, hop_length=hop).mean(axis=1)
    tail = max(1, int(5 * rate))
    head_rms = float(np.sqrt(np.mean(audio[:tail] ** 2)) + 1e-12)
    tail_rms = float(np.sqrt(np.mean(audio[-tail:] ** 2)) + 1e-12)
    flags = list(candidate.get("machineFlags", []))
    family = candidate["category"]
    loop_score = chroma_similarity(start_chroma, end_chroma)
    onset_density = len(onset_frames) / max(duration, 1)
    rms_variation = float(np.std(rms) / (np.mean(rms) + 1e-12))
    if candidate["loopMode"] == "crossfade" and loop_score < 0.62:
        flags.append("weak_tonal_loop_boundary")
    if family in ("environment", "texture") and onset_density > 2.0:
        flags.append("event_density_high_for_background")
    if family == "instrument" and onset_density > 1.8:
        flags.append("phrase_density_high_for_element")
    if family == "accent" and len(onset_frames) > 4:
        flags.append("more_than_one_clear_onset_possible")
    return {
        "durationSeconds": round(duration, 3),
        "onsetCount": int(len(onset_frames)),
        "onsetDensityPerSecond": round(float(onset_density), 4),
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "rmsVariation": round(rms_variation, 4),
        "loopTonalSimilarity": round(loop_score, 4),
        "headToTailRmsRatio": round(head_rms / tail_rms, 4),
        "chroma": [round(float(value), 6) for value in (chroma / (chroma.sum() + 1e-12))],
        "humanVoiceProbability": "manual_listening_required",
        "identityProbability": "manual_listening_required",
        "machineStatus": "review_required" if flags else "machine_screen_pass",
        "flags": sorted(set(flags)),
    }


manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
expected = int(manifest.get("expectedCandidateCount", 60))
if manifest["batchId"] != BATCH_ID or len(manifest.get("candidates", [])) != expected:
    raise RuntimeError("Expansion manifest is incomplete.")
for candidate in manifest["candidates"]:
    candidate["analysis"] = analyze(candidate)
    candidate["machineFlags"] = sorted(set(candidate.get("machineFlags", []) + candidate["analysis"]["flags"]))
manifest["analysisVersion"] = "foundational-expansion-acoustic-v1"
manifest["analysisGeneratedOn"] = datetime.now(timezone.utc).isoformat()
manifest["analysisStatus"] = "candidate_pending_human_identity_and_voice_review"
manifest["productionAllowed"] = False
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
summary = {}
for candidate in manifest["candidates"]:
    status = candidate["analysis"]["machineStatus"]
    summary[status] = summary.get(status, 0) + 1
print(json.dumps({"batchId": BATCH_ID, "analyzed": len(manifest["candidates"]), "machineStatus": summary, "productionAllowed": False}, indent=2))
