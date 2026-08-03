#!/usr/bin/env python3
"""Validate the candidate MusicKit contract without promoting any audio."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT_PATH = ROOT / "config/music-kits-v1.json"
PROFILE_PATH = ROOT / "config/music-style-profiles-v1.json"


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else KIT_PATH
    payload = json.loads(path.read_text(encoding="utf-8"))
    profiles = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))["profiles"]
    profile_versions = {(item["id"], item["version"]) for item in profiles}
    required_roles = payload.get("requiredStemRoles", [])
    errors = []
    ids = set()
    for kit in payload.get("kits", []):
        label = f"{kit.get('id', '<missing>')}@{kit.get('version', '<missing>')}"
        if kit.get("id") in ids:
            errors.append(f"{label}: duplicate kit id")
        ids.add(kit.get("id"))
        if kit.get("status") not in {"candidate", "review", "approved", "retired"}:
            errors.append(f"{label}: invalid status")
        if (kit.get("profileId"), kit.get("profileVersion")) not in profile_versions:
            errors.append(f"{label}: unknown StyleProfile version")
        if kit.get("goal") not in {"sleep", "calm", "focus"}:
            errors.append(f"{label}: invalid goal")
        if not 3 <= float(kit.get("loopCrossfadeSeconds", 0)) <= 12:
            errors.append(f"{label}: loop crossfade must be between 3 and 12 seconds")
        roles = [stem.get("role") for stem in kit.get("stems", [])]
        if sorted(roles) != sorted(required_roles):
            errors.append(f"{label}: stems must contain each required role exactly once")
        for stem in kit.get("stems", []):
            value = stem.get("defaultVolume")
            limits = stem.get("range")
            if not isinstance(value, (int, float)) or not isinstance(limits, list) or len(limits) != 2:
                errors.append(f"{label}/{stem.get('role')}: invalid volume contract")
            elif not (0 <= limits[0] <= value <= limits[1] <= 100):
                errors.append(f"{label}/{stem.get('role')}: default volume outside range")
    if not 6 <= len(payload.get("kits", [])) <= 8:
        errors.append("v1 foundation contract must contain 6-8 kits")
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)
    print(f"PASS: {len(payload['kits'])} MusicKits validated")
    for kit in payload["kits"]:
        print(f"  {kit['id']}@{kit['version']} -> {kit['profileId']} [{kit['goal']}]")


if __name__ == "__main__":
    main()
