#!/usr/bin/env python3
"""Generate a reviewed-only local music candidate batch with ACE-Step."""

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="docs/local-music-generation-batch-2026-07-13.json")
    parser.add_argument("--checkpoint", default="~/.cache/ace-step/checkpoints")
    parser.add_argument("--output", default="public/audio/music/local-candidates/2026-07-13")
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args()

    from acestep.pipeline_ace_step import ACEStepPipeline

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    selected = [
        item for item in manifest["candidates"]
        if item.get("reviewStatus") != "rejected" and (not args.only or item["id"] in args.only)
    ]
    defaults = manifest["defaults"]
    pipeline = ACEStepPipeline(
        checkpoint_dir=str(Path(args.checkpoint).expanduser()),
        dtype="float32",
        cpu_offload=True,
        overlapped_decode=True,
    )
    for item in selected:
        output_path = output_dir / f"{item['id']}.wav"
        if output_path.exists():
            print(f"skip existing {output_path}")
            continue
        print(f"generating {item['id']} seed={item['seed']}")
        lyrics = item.get("lyrics", defaults.get("lyrics", ""))
        if not lyrics.strip():
            lyrics = "[instrumental]"
        pipeline(
            format=defaults["format"],
            audio_duration=defaults["durationSeconds"],
            prompt=item["prompt"],
            lyrics=lyrics,
            infer_step=item.get("inferenceSteps", defaults["inferenceSteps"]),
            guidance_scale=item.get("guidanceScale", defaults["guidanceScale"]),
            scheduler_type=item.get("schedulerType", defaults.get("schedulerType", "euler")),
            cfg_type=item.get("cfgType", defaults.get("cfgType", "apg")),
            guidance_interval=item.get("guidanceInterval", defaults.get("guidanceInterval", 0.5)),
            guidance_interval_decay=item.get("guidanceIntervalDecay", defaults.get("guidanceIntervalDecay", 1.0)),
            min_guidance_scale=item.get("minGuidanceScale", defaults.get("minGuidanceScale", 3.0)),
            use_erg_tag=item.get("useErgTag", defaults.get("useErgTag", True)),
            use_erg_lyric=item.get("useErgLyric", defaults.get("useErgLyric", True)),
            use_erg_diffusion=item.get("useErgDiffusion", defaults.get("useErgDiffusion", True)),
            guidance_scale_text=item.get("guidanceScaleText", defaults.get("guidanceScaleText", 0.0)),
            guidance_scale_lyric=item.get("guidanceScaleLyric", defaults.get("guidanceScaleLyric", 0.0)),
            manual_seeds=[item["seed"]],
            save_path=str(output_path),
        )
        print(f"wrote {output_path}")


if __name__ == "__main__":
    main()
