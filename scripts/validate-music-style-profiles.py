#!/usr/bin/env python3
"""Validate the first controlled-composition StyleProfile contract."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "config/music-style-profiles-v1.json"
REQUIRED_SECTIONS = {
    "tonal", "melody", "rhythm", "harmony", "form",
    "instrumentation", "performance", "mix", "forbidden",
}
GLOBAL_FORBIDDEN = {"buzz", "filler_noise"}


def validate_range(name, value, errors, *, minimum=None, maximum=None):
    if not isinstance(value, list) or len(value) != 2 or value[0] > value[1]:
        errors.append(f"{name} must be an ordered two-value range")
        return
    if minimum is not None and value[0] < minimum:
        errors.append(f"{name} starts below {minimum}")
    if maximum is not None and value[1] > maximum:
        errors.append(f"{name} ends above {maximum}")


def validate_profile(profile):
    errors = []
    profile_id = profile.get("id", "<missing-id>")
    missing = REQUIRED_SECTIONS - profile.keys()
    if missing:
        errors.append(f"missing sections: {sorted(missing)}")
    if profile.get("status") not in {"draft", "review", "approved", "retired"}:
        errors.append("status must be draft, review, approved, or retired")
    if not profile.get("version"):
        errors.append("version is required")
    if not profile.get("goals"):
        errors.append("at least one goal is required")

    melody = profile.get("melody", {})
    rhythm = profile.get("rhythm", {})
    form = profile.get("form", {})
    mix = profile.get("mix", {})
    validate_range("melody.motifNoteCount", melody.get("motifNoteCount"), errors, minimum=2, maximum=8)
    validate_range("melody.firstMotifSeconds", melody.get("firstMotifSeconds"), errors, minimum=0, maximum=20)
    validate_range("melody.returnCount", melody.get("returnCount"), errors, minimum=1, maximum=8)
    validate_range("rhythm.onsetsPerBar", rhythm.get("onsetsPerBar"), errors, minimum=1, maximum=12)
    validate_range("mix.integratedLufs", mix.get("integratedLufs"), errors, minimum=-24, maximum=-12)

    if melody.get("exactRepeatMax", 99) > 2:
        errors.append("melody.exactRepeatMax must be at most 2")
    if rhythm.get("maxNonReleaseGapSeconds", 99) > 7:
        errors.append("rhythm.maxNonReleaseGapSeconds must be at most 7")
    if form.get("secondHalfEnergy") not in {"flat", "falling", "flat_or_falling"}:
        errors.append("form.secondHalfEnergy cannot rise")
    if mix.get("reverbWetMax", 1) > 0.12:
        errors.append("mix.reverbWetMax exceeds the low-stimulation boundary")
    if not GLOBAL_FORBIDDEN.issubset(set(profile.get("forbidden", []))):
        errors.append("forbidden must include buzz and filler_noise")
    if len(form.get("graph", [])) < 4:
        errors.append("form.graph needs at least four functional stages")
    return profile_id, errors


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PATH
    payload = json.loads(path.read_text(encoding="utf-8"))
    profiles = payload.get("profiles", [])
    errors = []
    ids = [profile.get("id") for profile in profiles]
    if len(ids) != len(set(ids)):
        errors.append("profile ids must be unique")
    if len(profiles) != 3:
        errors.append("v1 pilot contract must contain exactly three profiles")
    for profile in profiles:
        profile_id, profile_errors = validate_profile(profile)
        errors.extend(f"{profile_id}: {message}" for message in profile_errors)

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)
    print(f"PASS: {len(profiles)} StyleProfiles validated from {path.relative_to(ROOT)}")
    for profile in profiles:
        print(f"  {profile['id']}@{profile['version']} [{','.join(profile['goals'])}]")


if __name__ == "__main__":
    main()
