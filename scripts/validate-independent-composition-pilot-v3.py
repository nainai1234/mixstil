#!/usr/bin/env python3
"""Validate independent composition identity, files, stems, and machine gates."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public/audio/music/local-review/independent-composition-pilot-v3/manifest.json"
REVIEW = ROOT / "public/review/independent-composition-pilot-v3/index.html"
REQUIRED = {"harmony", "melody", "accompaniment", "low_support", "transition"}


def main():
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    errors = []
    kits = payload.get("kits", [])
    if payload.get("status") != "candidate": errors.append("batch must remain candidate")
    if payload.get("paidApi") or payload.get("generativeModel"): errors.append("batch must remain local and model-free")
    if len(kits) != 12: errors.append(f"expected 12 compositions, received {len(kits)}")
    profile_counts = Counter(item.get("profileId") for item in kits)
    if set(profile_counts.values()) != {3}: errors.append(f"each profile must contain A/B/C: {dict(profile_counts)}")
    if float(payload.get("maximumSimilarity", 1)) > float(payload.get("similarityThreshold", 0)):
        errors.append("composition similarity threshold failed")
    if len({item.get("compositionId") for item in kits}) != len(kits): errors.append("duplicate composition ids")
    for kit in kits:
        if set(kit.get("materials", {})) != {"harmony", "motif", "form", "grammar"}:
            errors.append(f"{kit.get('id')}: incomplete material provenance")
        if not all(kit.get("machineQa", {}).values()): errors.append(f"{kit.get('id')}: machine QA failed")
        if float(kit.get("reconstructionMaxAbsError", 1)) > 1e-9: errors.append(f"{kit.get('id')}: reconstruction failed")
        if {stem.get("role") for stem in kit.get("stems", [])} != REQUIRED: errors.append(f"{kit.get('id')}: roles incomplete")
        for source in [kit.get("fullMixPublicPath"), *[stem.get("publicPath") for stem in kit.get("stems", [])]]:
            target = ROOT / "public" / str(source or "").lstrip("/")
            if not target.is_file() or target.stat().st_size == 0: errors.append(f"missing audio: {source}")
    if not REVIEW.is_file(): errors.append("review page missing")
    if errors:
        for error in errors: print(f"FAIL: {error}")
        raise SystemExit(1)
    print(f"PASS: {len(kits)} independent compositions, {len(kits) * 5} synchronized stems, four A/B/C profile groups, and maximum similarity {payload['maximumSimilarity']}")


if __name__ == "__main__":
    main()
