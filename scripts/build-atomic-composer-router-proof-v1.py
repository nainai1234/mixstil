#!/usr/bin/env python3
"""Build a router proof from approved atomic foundation elements.

This page is intentionally not a new foundational-element page.  It proves the
next product step: a user need can be routed into already-reviewed atoms and
symbolic rules, then rendered as independently explainable Sleep/Calm/Focus
combination examples.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


ROOT = Path.cwd()
BATCH_ID = "atomic-composer-router-proof-v1"
PROOF_SCRIPT = ROOT / "scripts/build-instrument-runtime-render-proof-v1.py"
ATOMIC_MANIFEST = ROOT / "public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json"
OWNER_DECISION = ROOT / "config/atomic-foundation-elements-v1-owner-decision.json"
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREPARED_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON = ROOT / "reports/atomic-composer-router-proof-v1.json"
REPORT_MD = ROOT / "reports/atomic-composer-router-proof-v1.md"
DURATION = 60.0


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


def read_audio(relative_path: str) -> np.ndarray:
    audio, sr = sf.read(ROOT / relative_path, always_2d=True, dtype="float32")
    if sr != proof.SR:
        import librosa

        audio = librosa.resample(audio.T, orig_sr=sr, target_sr=proof.SR).T
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    return audio.astype(np.float32)


def place(out: np.ndarray, clip: np.ndarray, start_seconds: float, gain: float, pan: float = 0.0) -> None:
    start = int(start_seconds * proof.SR)
    if start >= len(out):
        return
    end = min(len(out), start + len(clip))
    piece = clip[: end - start].copy() * gain
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    piece = np.column_stack([piece[:, 0] * left, piece[:, min(1, piece.shape[1] - 1)] * right])
    out[start:end] += piece.astype(np.float32)


def render_bundle(elements_by_id: dict[str, dict[str, Any]], selected_ids: list[str], schedule: list[dict[str, Any]], goal: str) -> np.ndarray:
    out = np.zeros((int(DURATION * proof.SR), 2), dtype=np.float32)
    clips = {element_id: read_audio(elements_by_id[element_id]["masterAudioPath"]) for element_id in selected_ids}
    for event in schedule:
        place(out, clips[event["elementId"]], float(event["start"]), float(event["gain"]), float(event.get("pan", 0.0)))
    lowpass = 2300 if goal == "sleep" else 3100 if goal == "calm" else 3600
    out = proof.highpass(out, 35)
    out = proof.lowpass(out, lowpass)
    out = proof.fade(out, fade_in=2.5, fade_out=7.0)
    return proof.normalize_lufs(out, -27.5 if goal != "focus" else -26.5, peak_db=-7.5)


def write_audio(bundle_id: str, audio: np.ndarray) -> tuple[str, str]:
    wav_path = MASTER_DIR / f"{bundle_id}.wav"
    mp3_path = PREPARED_DIR / f"{bundle_id}.mp3"
    sf.write(wav_path, audio, proof.SR, subtype="PCM_24")
    proof.encode_mp3(wav_path, mp3_path)
    return str(wav_path.relative_to(ROOT)), "/" + str(mp3_path.relative_to(ROOT / "public"))


def schedule_for(goal: str, ids: dict[str, str], variant: int) -> list[dict[str, Any]]:
    if goal == "sleep":
        chord_starts = [0, 14, 30, 46] if variant == 1 else [0, 18, 36, 50]
        motif_starts = [9, 38] if variant == 1 else [12, 42]
        bass_starts = [4, 32] if variant == 1 else [8, 40]
        schedule = [{"elementId": ids["chord"], "start": start, "gain": 0.78, "pan": -0.05} for start in chord_starts]
        schedule += [{"elementId": ids["motif"], "start": start, "gain": 0.44, "pan": 0.12} for start in motif_starts]
        schedule += [{"elementId": ids["bass"], "start": start, "gain": 0.34, "pan": 0.0} for start in bass_starts]
        return schedule
    if goal == "calm":
        chord_starts = [0, 12, 26, 42] if variant == 1 else [0, 16, 32, 48]
        motif_starts = [7, 21, 38, 52] if variant == 1 else [10, 28, 44]
        note_starts = [18, 35] if variant == 1 else [22, 54]
        schedule = [{"elementId": ids["chord"], "start": start, "gain": 0.68, "pan": -0.12} for start in chord_starts]
        schedule += [{"elementId": ids["motif"], "start": start, "gain": 0.46, "pan": 0.16} for start in motif_starts]
        schedule += [{"elementId": ids["note"], "start": start, "gain": 0.26, "pan": 0.0} for start in note_starts]
        return schedule
    chord_starts = [0, 10, 22, 34, 48] if variant == 1 else [0, 13, 27, 41, 53]
    motif_starts = [6, 18, 31, 44] if variant == 1 else [8, 24, 39]
    bass_starts = [3, 25, 47] if variant == 1 else [5, 33, 51]
    schedule = [{"elementId": ids["chord"], "start": start, "gain": 0.56, "pan": -0.08} for start in chord_starts]
    schedule += [{"elementId": ids["motif"], "start": start, "gain": 0.38, "pan": 0.16} for start in motif_starts]
    schedule += [{"elementId": ids["bass"], "start": start, "gain": 0.28, "pan": 0.0} for start in bass_starts]
    return schedule


def build_bundles(atomic_manifest: dict[str, Any]) -> list[dict[str, Any]]:
    elements_by_id = {item["elementId"]: item for item in atomic_manifest["audioElements"]}
    symbolic_by_goal: dict[str, list[str]] = {}
    for item in atomic_manifest["symbolicElements"]:
        symbolic_by_goal.setdefault(item["goal"], []).append(item["elementId"])

    specs = [
        {
            "bundleId": "atomic_router_sleep_warm_sparse_v1",
            "goal": "sleep",
            "scene": "bedtime",
            "prompt": "睡前需要温暖、很稀疏、没有人声和鼓点的舒缓音乐感。",
            "variant": 1,
            "ids": {
                "chord": "atom_chord_sleep_open_fifth_c_g",
                "motif": "atom_motif_sleep_two_note_release",
                "bass": "atom_bass_sleep_low_anchor_c",
            },
        },
        {
            "bundleId": "atomic_router_sleep_soft_descent_v2",
            "goal": "sleep",
            "scene": "return_to_sleep",
            "prompt": "半夜醒来后回睡，要更慢、更低变化，不能有节奏推动。",
            "variant": 2,
            "ids": {
                "chord": "atom_chord_sleep_soft_triad_c",
                "motif": "atom_motif_sleep_falling_1_micro",
                "bass": "atom_bass_sleep_fifth_anchor_cg",
            },
        },
        {
            "bundleId": "atomic_router_calm_rhodes_breath_v1",
            "goal": "calm",
            "scene": "breathing",
            "prompt": "十分钟冥想，想要 Rhodes 呼吸感，空间开阔，不要鼓点。",
            "variant": 1,
            "ids": {
                "chord": "atom_chord_calm_soft_triad_f",
                "motif": "atom_motif_calm_breath_arch_micro",
                "note": "atom_note_rhodes_g3",
            },
        },
        {
            "bundleId": "atomic_router_calm_guitar_open_v2",
            "goal": "calm",
            "scene": "emotional_settling",
            "prompt": "情绪放松，需要一点自然吉他质感，但不能像完整歌曲。",
            "variant": 2,
            "ids": {
                "chord": "atom_chord_calm_guitar_open_c",
                "motif": "atom_motif_calm_guitar_open_return",
                "note": "atom_note_guitar_g3",
            },
        },
        {
            "bundleId": "atomic_router_focus_rhodes_clear_v1",
            "goal": "focus",
            "scene": "deep_focus",
            "prompt": "白天专注，需要清晰但不抢注意力的 Rhodes 结构，禁止人声和鼓点。",
            "variant": 1,
            "ids": {
                "chord": "atom_chord_focus_neutral_cell_cg",
                "motif": "atom_motif_focus_common_tone_cell",
                "bass": "atom_bass_focus_low_pulse_free_anchor",
            },
        },
        {
            "bundleId": "atomic_router_focus_two_note_anchor_v2",
            "goal": "focus",
            "scene": "deep_focus",
            "prompt": "写代码用的低干扰专注背景，少一点旋律，多一点稳定锚点。",
            "variant": 2,
            "ids": {
                "chord": "atom_chord_focus_neutral_cell_cg",
                "motif": "atom_motif_focus_two_note_anchor",
                "bass": "atom_bass_focus_low_pulse_free_anchor",
            },
        },
    ]

    bundles: list[dict[str, Any]] = []
    for spec in specs:
        selected_ids = list(spec["ids"].values())
        schedule = schedule_for(spec["goal"], spec["ids"], spec["variant"])
        audio = render_bundle(elements_by_id, selected_ids, schedule, spec["goal"])
        master_path, prepared_url = write_audio(spec["bundleId"], audio)
        analysis = proof.analyze_audio(audio)
        machine_status, failures = proof.machine_status(analysis, spec["goal"])
        bundles.append(
            {
                **spec,
                "selectedAtomicElementIds": selected_ids,
                "selectedSymbolicRuleIds": symbolic_by_goal.get(spec["goal"], [])[:4],
                "schedule": schedule,
                "masterAudioPath": master_path,
                "preparedAudioUrl": prepared_url,
                "reviewAudioSrc": "../../" + prepared_url.lstrip("/"),
                "durationSeconds": analysis["durationSeconds"],
                "analysis": analysis,
                "machineStatus": machine_status,
                "failures": failures,
                "humanListeningStatus": "pending",
                "productionAllowed": False,
                "formalUsable": False,
                "rationale": [
                    "User need is mapped to goal and scene.",
                    "Router selects atomic notes/chords/motifs/support gestures, not finished music clips.",
                    "Symbolic rules explain how repetition, spacing, and density are scheduled.",
                    "Rendered audio is only a proof that approved atoms can be combined.",
                ],
            }
        )
    return bundles


def build_review(manifest: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in manifest["bundles"]:
        cards.append(
            f"""
      <article class="card">
        <p class="eyebrow">{escape(item['goal'])} · {escape(item['scene'])} · router proof</p>
        <h2>{escape(item['bundleId'])}</h2>
        <p class="prompt">{escape(item['prompt'])}</p>
        <audio controls preload="metadata" src="{escape(item['reviewAudioSrc'])}"></audio>
        <details open>
          <summary>这不是基础元素，是路由组合证明</summary>
          <pre>{escape(json.dumps({
              'selectedAtomicElementIds': item['selectedAtomicElementIds'],
              'selectedSymbolicRuleIds': item['selectedSymbolicRuleIds'],
              'schedule': item['schedule'],
              'machineStatus': item['machineStatus'],
              'failures': item['failures'],
              'analysis': item['analysis'],
          }, ensure_ascii=False, indent=2))}</pre>
        </details>
      </article>
"""
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atomic Composer Router Proof V1</title>
  <style>
    body {{ margin:0; background:#0f1110; color:#eef4ed; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }}
    main {{ max-width:1120px; margin:0 auto; padding:32px 18px 64px; }}
    .hero,.card {{ border:1px solid rgba(255,255,255,.12); border-radius:24px; padding:20px; background:rgba(255,255,255,.045); margin:16px 0; }}
    .hero {{ background:linear-gradient(135deg,rgba(108,132,93,.18),rgba(177,139,92,.13)); }}
    .eyebrow {{ color:#b8c8b4; letter-spacing:.08em; text-transform:uppercase; font-size:12px; }}
    audio {{ width:100%; margin:10px 0; }}
    pre {{ white-space:pre-wrap; color:#dce8d7; max-height:420px; overflow:auto; }}
    summary {{ cursor:pointer; color:#f1d08b; font-weight:800; }}
    .prompt {{ color:#f1d08b; }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE · Atomic elements → composer/router proof</p>
      <h1>Atomic Composer Router Proof V1</h1>
      <p>本页验证下一阶段：用户需求能否路由到已通过的原子元素，并按结构规则组合成 Sleep / Calm / Focus 的可听结果。</p>
      <p>注意：这些 60 秒音频不是新的基础元素，也不是正式曲库；它们只是证明基础元素可以被选择、排布、解释和试听。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    proof.require_tools()
    for directory in [MASTER_DIR, PREPARED_DIR, REVIEW_DIR, REPORT_JSON.parent]:
        directory.mkdir(parents=True, exist_ok=True)
    atomic_manifest = load_json(ATOMIC_MANIFEST)
    owner_decision = load_json(OWNER_DECISION)
    if owner_decision["ownerDecision"] != "passed_for_next_stage_router_proof":
        raise RuntimeError("Atomic elements are not owner-approved for router proof")
    bundles = build_bundles(atomic_manifest)
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "atomic_composer_router_proof_pending_human_review",
        "sourceAtomicBatchId": "atomic-foundation-elements-v1",
        "ownerDecisionSource": "config/atomic-foundation-elements-v1-owner-decision.json",
        "productionAllowed": False,
        "formalUsableCount": 0,
        "humanPassCount": 0,
        "purpose": "Prove user need to atomic element selection to audible combination, without promoting combinations as foundational elements.",
        "hardRules": [
            "Combination proofs are not foundational elements.",
            "Do not count these rendered proofs as finished content.",
            "No voice, no drums, no runtime external music API.",
            "Every bundle must expose selected atomic element IDs and symbolic rule IDs.",
        ],
        "bundleCount": len(bundles),
        "byGoal": {
            "sleep": sum(1 for item in bundles if item["goal"] == "sleep"),
            "calm": sum(1 for item in bundles if item["goal"] == "calm"),
            "focus": sum(1 for item in bundles if item["goal"] == "focus"),
        },
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "bundles": bundles,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)
    report = {
        "batchId": BATCH_ID,
        "verdict": "atomic_composer_router_proof_generated_human_review_required",
        "bundleCount": len(bundles),
        "byGoal": manifest["byGoal"],
        "reviewUrl": manifest["reviewUrl"],
        "productionAllowed": False,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(
        f"""# Atomic Composer Router Proof V1

Generated: {manifest['generatedAt']}

## Verdict

atomic_composer_router_proof_generated_human_review_required

This is the next-stage proof after Atomic Foundation Elements V1 passed owner review. It proves routing and arrangement, not new foundational inventory.

## Counts

| Type | Count |
| --- | ---: |
| Router proof bundles | {len(bundles)} |
| Sleep | {manifest['byGoal']['sleep']} |
| Calm | {manifest['byGoal']['calm']} |
| Focus | {manifest['byGoal']['focus']} |

## Review

Open: `{manifest['reviewUrl']}`
""",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
