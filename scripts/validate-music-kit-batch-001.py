#!/usr/bin/env python3
"""Validate MusicKit batch files, roles, timing, and reconstruction metadata."""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {"harmony", "melody", "accompaniment", "low_support", "transition"}


class AudioSourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []

    def handle_starttag(self, tag, attrs):
        if tag == "audio":
            self.sources.append(dict(attrs).get("src"))


def main():
    batch = sys.argv[1] if len(sys.argv) > 1 else "music-kit-batch-001"
    manifest_path = ROOT / f"public/audio/music/local-review/{batch}/manifest.json"
    review_path = ROOT / f"public/review/{batch}/index.html"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = []
    if payload.get("status") != "candidate":
        errors.append("batch must remain candidate until listening and release QA pass")
    if payload.get("paidApi") or payload.get("generativeModel"):
        errors.append("batch provenance must remain local and model-free")
    for kit in payload.get("kits", []):
        roles = {stem.get("role") for stem in kit.get("stems", [])}
        if roles != REQUIRED:
            errors.append(f"{kit.get('id')}: missing or duplicate stem roles")
        if float(kit.get("reconstructionMaxAbsError", 1)) > 1e-9:
            errors.append(f"{kit.get('id')}: default mix does not reconstruct from stems")
        durations = {stem.get("metrics", {}).get("durationSeconds") for stem in kit.get("stems", [])}
        durations.add(kit.get("mixMetrics", {}).get("durationSeconds"))
        if durations != {96.0}:
            errors.append(f"{kit.get('id')}: stem durations are not synchronized")
        for stem in kit.get("stems", []):
            if float(stem.get("metrics", {}).get("activeRatio", 0)) <= 0.01:
                errors.append(f"{kit.get('id')}/{stem.get('role')}: stem is effectively empty")
            public_path = ROOT / "public" / str(stem.get("publicPath", "")).lstrip("/")
            if not public_path.is_file() or public_path.stat().st_size == 0:
                errors.append(f"{kit.get('id')}/{stem.get('role')}: missing MP3")

    parser = AudioSourceParser()
    parser.feed(review_path.read_text(encoding="utf-8"))
    expected_sources = len(payload.get("kits", [])) * 6
    if len(parser.sources) != expected_sources:
        errors.append(f"review page should reference {expected_sources} audio files, found {len(parser.sources)}")
    for source in parser.sources:
        target = (review_path.parent / source).resolve()
        if not target.is_file() or target.stat().st_size == 0:
            errors.append(f"review page has broken audio source: {source}")

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)
    kit_count = len(payload.get("kits", []))
    print(f"PASS: {kit_count} candidate MusicKits, {kit_count * 5} synchronized non-empty stems, and {expected_sources} review audio paths")


if __name__ == "__main__":
    main()
