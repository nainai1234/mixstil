#!/usr/bin/env python3
import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path.cwd()
SOURCE_ROOT = ROOT / "public/audio/music/local-review/lyria-single-element-pilot-v1"
SOURCE_MANIFEST = SOURCE_ROOT / "manifest.json"
ANALYSIS_PATH = ROOT / "public/audio/music/local-review/lyria-element-combination-pilot-v1/analysis.json"
DIVERSITY_PATH = ROOT / "public/audio/music/local-review/lyria-multi-composition-pilot-v1/manifest.json"
OUTPUT_ROOT = ROOT / "public/audio/music/foundational-elements-v1"
CONFIG_PATH = ROOT / "config/foundational-audio-elements-v1.json"

FAMILY_POLICY = {
    "warm_analog_pad": {"goals": ["sleep", "calm"], "role": "harmony", "tags": ["warm", "pad", "low_motion"], "defaultVolume": 34},
    "deep_low_drone": {"goals": ["sleep"], "role": "low_support", "tags": ["deep", "drone", "dark_warm"], "defaultVolume": 32},
    "airy_bright_pad": {"goals": ["calm", "focus"], "role": "harmony", "tags": ["airy", "pad", "open"], "defaultVolume": 30},
    "felt_piano_phrase": {"goals": ["sleep", "calm"], "role": "melody", "tags": ["felt_piano", "sparse", "soft_attack"], "defaultVolume": 22},
    "warm_rhodes_phrase": {"goals": ["calm", "focus"], "role": "melody", "tags": ["rhodes", "sparse", "warm"], "defaultVolume": 24},
    "nylon_guitar_phrase": {"goals": ["calm", "focus"], "role": "melody", "tags": ["nylon_guitar", "fingerpicked", "soft"], "defaultVolume": 23},
    "open_fifth_harmonic_bed": {"goals": ["sleep", "calm", "focus"], "role": "harmony", "tags": ["open_fifth", "harmonic_bed", "neutral"], "defaultVolume": 31},
    "sparse_tonal_texture": {"goals": ["calm", "focus"], "role": "texture", "tags": ["tonal_texture", "granular", "sparse"], "defaultVolume": 18},
}


def run(command):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or f"command failed: {command}")
    return result.stdout, result.stderr


def build_loop_source(source, destination):
    audio, rate = sf.read(source, dtype="float32", always_2d=True)
    fade = min(int(rate * 2.0), max(1, len(audio) // 5))
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
    crossfade = audio[-fade:] * (1.0 - ramp) + audio[:fade] * ramp
    unit = np.concatenate([audio[fade:-fade], crossfade], axis=0)
    peak = float(np.max(np.abs(unit)))
    if peak > 0:
        unit *= min(1.0, 0.72 / peak)
    sf.write(destination, unit, rate, subtype="PCM_24")


def analyze_output(path):
    stdout, _ = run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,sample_rate,channels", "-of", "json", str(path)])
    probe = json.loads(stdout)
    stream = probe.get("streams", [{}])[0]
    _, stderr = run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", stderr)
    peaks = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", stderr)
    return {
        "durationSeconds": round(float(probe["format"]["duration"]), 3),
        "bytes": int(probe["format"]["size"]),
        "codec": stream.get("codec_name"),
        "sampleRate": int(stream.get("sample_rate", 0)),
        "channels": int(stream.get("channels", 0)),
        "integratedLufs": float(lufs[-1]) if lufs else None,
        "truePeakDb": float(peaks[-1]) if peaks else None,
    }


def main():
    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    analyses = {entry["candidateId"]: entry for entry in json.loads(ANALYSIS_PATH.read_text(encoding="utf-8"))["candidates"]}
    diversity = json.loads(DIVERSITY_PATH.read_text(encoding="utf-8"))["diversity"]
    if len(source_manifest.get("candidates", [])) != 24 or len(analyses) != 24:
        raise RuntimeError("promotion requires 24 generated candidates and 24 acoustic analyses")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    records = []
    for candidate in source_manifest["candidates"]:
        family = candidate["id"]
        policy = FAMILY_POLICY[family]
        source = ROOT / "public" / candidate["audioUrl"].lstrip("/")
        family_dir = OUTPUT_ROOT / family
        family_dir.mkdir(parents=True, exist_ok=True)
        temp_wav = family_dir / f".{candidate['candidateId']}.wav"
        output = family_dir / f"{candidate['candidateId']}.mp3"
        build_loop_source(source, temp_wav)
        try:
            run(["ffmpeg", "-hide_banner", "-y", "-i", str(temp_wav), "-af", "loudnorm=I=-22:TP=-3:LRA=7", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", str(output)])
        finally:
            temp_wav.unlink(missing_ok=True)
        physical = analyze_output(output)
        digest = hashlib.sha256(output.read_bytes()).hexdigest()
        analysis = analyses[candidate["candidateId"]]
        records.append({
            "id": f"stem_lyria_element_{candidate['candidateId']}",
            "candidateId": candidate["candidateId"],
            "name": f"{candidate['title']} {candidate['variant']}",
            "family": family,
            "variant": candidate["variant"],
            "elementRole": policy["role"],
            "goals": policy["goals"],
            "tags": policy["tags"] + ["voice_free", "lyria_generated", "foundational_element"],
            "audioUrl": "/" + str(output.relative_to(ROOT / "public")),
            "defaultVolume": policy["defaultVolume"],
            "loop": {"enabled": True, "crossfadeSeconds": 2},
            "key": analysis["key"],
            "acoustic": {
                **physical,
                "estimatedTempoBpm": analysis["estimatedTempoBpm"],
                "beatCount": analysis["beatCount"],
                "onsetDensityPerSecond": analysis["onsetDensityPerSecond"],
                "spectralCentroidHz": analysis["spectralCentroidHz"],
                "loopTonalSimilarity": analysis["loopTonalSimilarity"],
                "chroma": analysis["chroma"],
            },
            "sha256": digest,
            "source": {
                "provider": "google-cloud-vertex-ai",
                "product": "lyria-music-generation",
                "model": candidate["model"],
                "sourceCandidateId": candidate["candidateId"],
                "sourceAudioUrl": candidate["audioUrl"],
                "prompt": candidate["prompt"],
                "generatedOn": candidate["generatedOn"],
                "projectId": "project-a8dea3a9-cd9d-40dd-867",
            },
            "rights": {
                "sourceCreator": "SNOOZE via Google Vertex AI Lyria",
                "licenseName": "Customer-generated output under Google Cloud service terms",
                "licenseUrl": "https://cloud.google.com/terms/service-terms",
                "commercialUseAllowed": True,
                "derivativeUseAllowed": True,
                "attributionRequired": False,
                "rawRedistributionAllowed": True,
            },
            "qa": {
                "status": "approved",
                "ownerReviewEvidence": "Owner proceeded after single-element, 10-minute combination, and 12-composition listening gates on 2026-07-22.",
                "machineWarningsResolved": ["near_digital_ceiling_normalized", "loop_boundary_crossfaded"],
                "collectionResidualRisk": f"Multi-composition machine gate retained {len(diversity['nearDuplicatePairs'])} near-duplicate pairs for human-aware selection.",
            },
        })

    payload = {
        "schemaVersion": "1.0.0",
        "catalogId": "foundational-audio-elements-v1",
        "generatedOn": datetime.now(timezone.utc).isoformat(),
        "status": "approved_foundational_elements",
        "sourceBatchId": source_manifest["batchId"],
        "elementCount": len(records),
        "productionAllowed": True,
        "selectionPolicy": {
            "minimumLayers": 2,
            "maximumLayers": 3,
            "preferHarmonicCompatibility": True,
            "respectExplicitInstrumentExclusions": True,
            "avoidExactRecipeReplay": True,
            "externalApiAtRuntime": False,
        },
        "elements": records,
    }
    CONFIG_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"passed": True, "catalogId": payload["catalogId"], "elements": len(records), "outputRoot": str(OUTPUT_ROOT), "config": str(CONFIG_PATH)}, indent=2))


if __name__ == "__main__":
    main()
