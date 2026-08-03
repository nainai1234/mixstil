#!/usr/bin/env python3
"""Package the 30 owner-approved baseline seeds as long-form release masters."""

import hashlib
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/audio/content-baseline/published-2026-07-20"
REPORT = ROOT / "reports/content-baseline-30-longform-release.json"
BATCHES = ("012", "013", "014", "015", "016", "017")
DURATIONS = {"sleep": 1800, "calm": 1200, "focus": 1500}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render(item):
    source = ROOT / item["outputPath"]
    duration = DURATIONS[item["goal"]]
    target = OUT / f"{item['id']}.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-stream_loop", "-1", "-i", str(source), "-t", str(duration),
        "-af", f"afade=t=in:st=0:d=4,afade=t=out:st={duration - 12}:d=12,alimiter=limit=0.82",
        "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "128k", str(target),
    ], check=True)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", str(target)
    ], text=True))["format"]
    return {
        **item,
        "releaseDurationSeconds": round(float(probe["duration"]), 3),
        "releaseSizeBytes": int(probe["size"]),
        "releasePath": str(target.relative_to(ROOT)),
        "releaseUrl": "/" + str(target.relative_to(ROOT / "public")),
        "releaseSha256": sha256(target),
        "loopStrategy": "repeat accepted 180-second structured master; source fade plus final 12-second release",
        "rightsStatus": "verified_derivative_release",
        "rightsBasis": [
            "reports/content-release-manifest-2026-07-15.json",
            "docs/license-snapshots/batch-08/mixkit-license.html",
            "reports/authentic-scene-promotion-2026-07-14.json",
            "reports/supply-gap-batch-01-promotion-2026-07-15.json",
        ],
        "rawRedistributionAllowed": False,
        "discoverStatus": "ready_to_publish",
    }


def main():
    release_manifest = json.loads((ROOT / "reports/content-release-manifest-2026-07-15.json").read_text())
    if release_manifest.get("status") != "pass":
        raise SystemExit("Existing source release manifest does not pass")
    items = []
    for batch in BATCHES:
        payload = json.loads((ROOT / f"data/content-baseline/content-baseline-batch-{batch}-promotion.json").read_text())
        items.extend(payload["promoted"])
    if len(items) != 30 or any(item.get("ownerListeningVerdict") != "save_and_replay_worthy" for item in items):
        raise SystemExit("Expected exactly 30 owner-approved save/replay items")
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(render, items))
    output = {
        "status": "ready_to_publish",
        "generatedOn": "2026-07-20",
        "count": len(results),
        "byGoal": {goal: sum(item["goal"] == goal for item in results) for goal in DURATIONS},
        "items": results,
    }
    REPORT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"PASS: built {len(results)} long-form release masters")
    print(REPORT)


if __name__ == "__main__":
    main()
