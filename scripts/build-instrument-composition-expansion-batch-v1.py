#!/usr/bin/env python3
"""Expand controllable foundational music candidates after owner direction approval.

This batch builds on instrument-runtime-render-proof-v1.  It reuses the same
local multisample render path, but produces a broader set of Sleep, Calm, and
Focus music elements for listening selection.  Everything remains candidate-only.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import soundfile as sf


ROOT = Path.cwd()
BATCH_ID = "instrument-composition-expansion-batch-v1"
PROOF_SCRIPT = ROOT / "scripts/build-instrument-runtime-render-proof-v1.py"
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREPARED_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON = ROOT / "reports/instrument-composition-expansion-batch-v1.json"
REPORT_MD = ROOT / "reports/instrument-composition-expansion-batch-v1.md"


def load_proof_module():
    spec = importlib.util.spec_from_file_location("instrument_runtime_render_proof_v1", PROOF_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load instrument runtime proof module")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


proof = load_proof_module()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def make_samplers() -> dict[str, Any]:
    return {
        "piano": proof.Sampler("vcsl_kawai_soft_piano", ROOT / "assets/audio-sources/vcsl-kawai-soft", "*.wav", proof.extract_vcsl_note),
        "rhodes": proof.Sampler("discord_cc0_rhodes", ROOT / "assets/audio-sources/discord-cc0-band/rhodes", "*.wav", proof.extract_rhodes_note),
        "guitar": proof.Sampler("discord_cc0_guitar", ROOT / "assets/audio-sources/discord-cc0-band/guitar", "*.wav", proof.extract_martin_note),
        "bass": proof.Sampler("discord_cc0_bass", ROOT / "assets/audio-sources/discord-cc0-band/bass", "*.wav", proof.extract_bass_note),
    }


SOURCE_BY_INSTRUMENT = {
    "piano": "vcsl_kawai_soft_piano",
    "rhodes": "discord_cc0_rhodes",
    "guitar": "discord_cc0_guitar",
    "bass": "discord_cc0_bass",
}


VARIANTS = [
    {
        "suffix": "soft_a",
        "tempoDelta": -3,
        "seedOffset": 1100,
        "lowpassDelta": -250,
        "intent": "softer, darker, lower-energy variant for first-pass listening.",
    },
    {
        "suffix": "open_b",
        "tempoDelta": 2,
        "seedOffset": 2200,
        "lowpassDelta": 120,
        "intent": "slightly more open variant while staying voice-free and percussion-free.",
    },
]


def adjusted_plan(plan: dict[str, Any], variant: dict[str, Any]) -> dict[str, Any]:
    next_plan = dict(plan)
    next_plan["id"] = f"{plan['id']}_{variant['suffix']}"
    next_plan["tempo"] = max(40, min(72, int(plan["tempo"]) + int(variant["tempoDelta"])))
    next_plan["seed"] = int(plan["seed"]) + int(variant["seedOffset"])
    next_plan["lowpass"] = max(1500, min(3900, int(plan.get("lowpass", 3000)) + int(variant["lowpassDelta"])))
    next_plan["variant"] = variant["suffix"]
    next_plan["variantIntent"] = variant["intent"]
    return next_plan


def render_one(plan: dict[str, Any], library: dict[str, Any], samplers: dict[str, Any], support_only: bool = False) -> dict[str, Any]:
    sampler = samplers[plan["instrument"]]
    events = proof.build_events(plan, library, support_only=support_only)
    audio = proof.render_events(sampler, events, plan)
    source_id = SOURCE_BY_INSTRUMENT[plan["instrument"]]
    candidate_id = f"{plan['id']}_{source_id}"
    wav_path = MASTER_DIR / f"{candidate_id}.wav"
    mp3_path = PREPARED_DIR / f"{candidate_id}.mp3"
    sf.write(wav_path, audio, proof.SR, subtype="PCM_24")
    proof.encode_mp3(wav_path, mp3_path)
    analysis = proof.analyze_audio(audio)
    machine_status, failures = proof.machine_status(analysis, plan["goal"])
    return {
        "candidateId": candidate_id,
        "title": f"{plan['goal'].title()} · {plan['instrument'].title()} · {plan['variant']}",
        "goal": plan["goal"],
        "scene": plan["scene"],
        "instrument": plan["instrument"],
        "instrumentSourceId": source_id,
        "compositionPlanId": plan["id"],
        "baseCompositionPlanId": plan.get("baseCompositionPlanId", plan["id"]),
        "harmonyId": plan["harmonyId"],
        "motifId": "not_used_support_only" if support_only else plan["motifId"],
        "formId": plan["formId"],
        "grammarId": plan["grammarId"],
        "tempo": plan["tempo"],
        "seed": plan["seed"],
        "lowpassHz": plan["lowpass"],
        "eventCount": len(events),
        "masterAudioPath": str(wav_path.relative_to(ROOT)),
        "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
        "reviewAudioSrc": "../../" + str(mp3_path.relative_to(ROOT / "public")),
        "productionAllowed": False,
        "humanListeningStatus": "pending",
        "formalUsable": False,
        "businessPurpose": "Candidate foundational music element from local playable instruments and symbolic composition material.",
        "analysis": analysis,
        "machineStatus": machine_status,
        "failures": failures,
    }


def build_review(manifest: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    grouped = []
    for candidate in manifest["candidates"]:
        grouped.append(
            f"""
      <article class="card">
        <p class="eyebrow">{escape(candidate['goal'])} · {escape(candidate['instrumentSourceId'])} · {escape(candidate['machineStatus'])}</p>
        <h2>{escape(candidate['title'])}</h2>
        <audio controls preload="metadata" src="{escape(candidate['reviewAudioSrc'])}"></audio>
        <p>{escape(candidate['businessPurpose'])}</p>
        <details>
          <summary>元素参数 / QA</summary>
          <pre>{escape(json.dumps({k: candidate[k] for k in ['candidateId', 'scene', 'compositionPlanId', 'harmonyId', 'motifId', 'formId', 'grammarId', 'tempo', 'seed', 'lowpassHz', 'eventCount', 'analysis', 'failures']}, ensure_ascii=False, indent=2))}</pre>
        </details>
      </article>
"""
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instrument Composition Expansion Batch V1</title>
  <style>
    body {{ margin:0; background:#101210; color:#eef5ef; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }}
    main {{ max-width:1120px; margin:0 auto; padding:32px 18px 64px; }}
    .hero,.card {{ border:1px solid rgba(255,255,255,.12); border-radius:24px; padding:20px; background:rgba(255,255,255,.045); margin:16px 0; }}
    .hero {{ background:linear-gradient(135deg,rgba(169,139,96,.18),rgba(73,101,88,.16)); }}
    .eyebrow {{ color:#bbcab8; letter-spacing:.08em; text-transform:uppercase; font-size:12px; }}
    audio {{ width:100%; margin:10px 0; }}
    pre {{ white-space:pre-wrap; color:#dce8d7; }}
    summary {{ cursor:pointer; color:#dcc38d; }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE · Candidate foundational music · expansion v1</p>
      <h1>可控基础音乐元素扩容</h1>
      <p>这批沿用已确认正确的方向：本地可演奏乐器源 + 和声/动机/曲式/节奏/seed。它不是 Lyria 成品，不是噪声组合，不进入正式库。</p>
      <p>目标：给 Sleep / Calm / Focus 各自提供更多可筛选的钢琴、Rhodes、吉他和低音支撑候选。</p>
      <p>当前 productionAllowed=false；请只做方向和单条听感筛选。</p>
    </section>
    {''.join(grouped)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    proof.require_tools()
    for directory in [MASTER_DIR, PREPARED_DIR, REVIEW_DIR, REPORT_JSON.parent]:
        directory.mkdir(parents=True, exist_ok=True)
    library = load_json(ROOT / "config/composition-material-library-v1.json")
    owner_decision = load_json(ROOT / "config/instrument-runtime-render-proof-v1-owner-decision.json")
    if owner_decision["decision"] != "direction_accepted_item_review_pending":
        raise RuntimeError("Owner direction has not been accepted")
    samplers = make_samplers()
    base_plans = library["compositionPlans"]

    candidates: list[dict[str, Any]] = []
    for base_plan in base_plans:
        for variant in VARIANTS:
            plan = adjusted_plan(base_plan, variant)
            plan["baseCompositionPlanId"] = base_plan["id"]
            candidates.append(render_one(plan, library, samplers))

    # Add bass support candidates that can become low-support ingredients rather
    # than foreground finished music.
    bass_bases = [
        ("sleep_low_piano_a", "sleep"),
        ("sleep_low_piano_b", "sleep"),
        ("calm_lyrical_piano_a", "calm"),
        ("calm_guitar_a", "calm"),
        ("focus_rhodes_a", "focus"),
        ("focus_rhodes_b", "focus"),
    ]
    for index, (base_id, goal) in enumerate(bass_bases):
        base_plan = next(item for item in base_plans if item["id"] == base_id)
        plan = dict(base_plan)
        plan["id"] = f"{goal}_bass_support_{index + 1}"
        plan["baseCompositionPlanId"] = base_id
        plan["instrument"] = "bass"
        plan["seed"] = int(base_plan["seed"]) + 50_000 + index * 100
        plan["tempo"] = max(40, int(base_plan["tempo"]) - 4)
        plan["lowpass"] = 780 if goal == "sleep" else 920
        plan["variant"] = "low_support"
        candidates.append(render_one(plan, library, samplers, support_only=True))

    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "candidate_expansion_pending_human_listening",
        "ownerDirectionSource": "config/instrument-runtime-render-proof-v1-owner-decision.json",
        "productionAllowed": False,
        "formalUsableCount": 0,
        "humanPassCount": 0,
        "purpose": "First expansion batch after owner accepted the controllable instrument-composition direction.",
        "hardRules": [
            "Candidate-only; no public Recipe routing until item-level human listening passes.",
            "No Lyria finished music clips, no mixed stem separation, no human voice, no drums, no medical or healing claims.",
            "Bass support candidates are low-support ingredients, not standalone finished music.",
        ],
        "candidateCount": len(candidates),
        "machinePassCount": sum(1 for item in candidates if item["machineStatus"] == "pass"),
        "byGoal": {goal: sum(1 for item in candidates if item["goal"] == goal) for goal in ["sleep", "calm", "focus"]},
        "byInstrumentSource": {
            source: sum(1 for item in candidates if item["instrumentSourceId"] == source)
            for source in ["vcsl_kawai_soft_piano", "discord_cc0_rhodes", "discord_cc0_guitar", "discord_cc0_bass"]
        },
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "candidates": candidates,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)

    report = {
        "batchId": BATCH_ID,
        "verdict": "candidate_expansion_generated_human_review_required",
        "candidateCount": manifest["candidateCount"],
        "machinePassCount": manifest["machinePassCount"],
        "byGoal": manifest["byGoal"],
        "byInstrumentSource": manifest["byInstrumentSource"],
        "reviewUrl": manifest["reviewUrl"],
        "productionAllowed": manifest["productionAllowed"],
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(
        f"""# Instrument Composition Expansion Batch V1

Generated: {manifest['generatedAt']}

## Verdict

candidate_expansion_generated_human_review_required

This batch follows the owner-accepted direction: playable local instrument sources driven by symbolic composition material. It remains candidate-only.

## Counts

| Metric | Count |
| --- | ---: |
| Candidates | {manifest['candidateCount']} |
| Machine pass | {manifest['machinePassCount']} |
| Human pass | 0 |
| Formal usable | 0 |

## By goal

| Goal | Count |
| --- | ---: |
| Sleep | {manifest['byGoal']['sleep']} |
| Calm | {manifest['byGoal']['calm']} |
| Focus | {manifest['byGoal']['focus']} |

## By instrument source

| Source | Count |
| --- | ---: |
{chr(10).join(f"| {source} | {count} |" for source, count in manifest['byInstrumentSource'].items())}

## Review

Open: `{manifest['reviewUrl']}`
""",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
