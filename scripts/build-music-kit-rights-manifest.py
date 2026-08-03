#!/usr/bin/env python3
"""Build an auditable rights manifest for a candidate MusicKit batch."""

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_BY_PROFILE = {
    "east_asian_pentatonic_lyrical_piano": {
        "sourceRecord": "docs/vcsl-kawai-soft-source-record.md",
        "upstream": "https://github.com/sgossner/VCSL",
        "pinnedCommit": "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e",
        "licenseName": "CC0 1.0 Universal",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    "western_six_eight_acoustic_unwind": {
        "sourceRecord": "docs/discord-cc0-band-source-record.md",
        "upstream": "https://github.com/sfzinstruments/Discord-SFZ-GM-Bank",
        "pinnedCommit": "7a9c478fe331f94f246d33332f0adedb25bbbe27",
        "licenseName": "CC0 1.0 Universal",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    "dry_rhodes_brushless_focus": {
        "sourceRecord": "docs/discord-cc0-band-source-record.md",
        "upstream": "https://github.com/sfzinstruments/Discord-SFZ-GM-Bank",
        "pinnedCommit": "7a9c478fe331f94f246d33332f0adedb25bbbe27",
        "licenseName": "CC0 1.0 Universal",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    "low_register_piano_sleep_descent": {
        "sourceRecord": "docs/vcsl-kawai-soft-source-record.md",
        "upstream": "https://github.com/sgossner/VCSL",
        "pinnedCommit": "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e",
        "licenseName": "CC0 1.0 Universal",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    "open_fifth_guitar_meditation": {
        "sourceRecord": "docs/discord-cc0-band-source-record.md",
        "upstream": "https://github.com/sfzinstruments/Discord-SFZ-GM-Bank",
        "pinnedCommit": "7a9c478fe331f94f246d33332f0adedb25bbbe27",
        "licenseName": "CC0 1.0 Universal",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    "common_tone_piano_focus": {
        "sourceRecord": "docs/vcsl-kawai-soft-source-record.md",
        "upstream": "https://github.com/sgossner/VCSL",
        "pinnedCommit": "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e",
        "licenseName": "CC0 1.0 Universal",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", default="music-kit-batch-002")
    args = parser.parse_args()
    batch_dir = ROOT / "public/audio/music/local-review" / args.batch
    manifest = json.loads((batch_dir / "manifest.json").read_text(encoding="utf-8"))
    records = []
    for kit in manifest["kits"]:
        source = SOURCE_BY_PROFILE[kit["profileId"]]
        if not (ROOT / source["sourceRecord"]).exists():
            raise SystemExit(f"Missing source record: {source['sourceRecord']}")
        for stem in kit["stems"]:
            path = batch_dir / kit["id"] / f"{stem['role']}.mp3"
            records.append({
                "stemId": f"{kit['id']}__{stem['role']}",
                "musicKitId": kit["id"],
                "musicKitVersion": kit["version"],
                "musicPart": stem["role"],
                "localPath": str(path.relative_to(ROOT)),
                "fileSha256": sha256(path),
                **source,
                "commercialUseAllowed": True,
                "derivativeUseAllowed": True,
                "attributionRequired": False,
                "rawRedistributionAllowed": True,
                "arrangementOwnership": "SNOOZE original deterministic composition and rendered master; source samples remain non-exclusive CC0 material.",
                "promotionStatus": "candidate_pending_catalog_and_long_session_qa",
            })
    output = {
        "batch": args.batch,
        "generatedOn": str(date.today()),
        "status": "rights_registered_candidate",
        "stemCount": len(records),
        "records": records,
    }
    target = ROOT / "reports" / f"{args.batch}-rights-manifest.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PASS: registered rights metadata and hashes for {len(records)} candidate stems")
    print(target)


if __name__ == "__main__":
    main()
