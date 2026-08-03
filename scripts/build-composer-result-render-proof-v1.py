#!/usr/bin/env python3
"""Render the professional composer bundle plan into audible proof mixes.

This is deliberately downstream of `composer-bundle-plan-v1`: the page no
longer asks the owner to choose materials.  It reads the professional bundle
decisions, maps them to existing atomic music elements plus deterministic
support beds, and renders short playable Sleep/Calm/Focus examples.

The rendered files are proof mixes, not new foundational elements and not
release content.
"""

from __future__ import annotations

import importlib.util
import json
import math
import subprocess
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


ROOT = Path.cwd()
BATCH_ID = "composer-result-render-proof-v1"
PROOF_SCRIPT = ROOT / "scripts/build-instrument-runtime-render-proof-v1.py"
COMPOSER_MANIFEST = ROOT / "public/review/composer-bundle-plan-v1/manifest.json"
ATOMIC_MANIFEST = ROOT / "public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json"
SOOTHING_MANIFEST = ROOT / "public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json"
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREPARED_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON = ROOT / "reports/composer-result-render-proof-v1.json"
REPORT_MD = ROOT / "reports/composer-result-render-proof-v1.md"
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
        try:
            import librosa
        except Exception as exc:  # pragma: no cover - only used if sources drift sample rate
            raise RuntimeError(f"{relative_path} sample rate {sr} requires librosa resampling") from exc
        audio = librosa.resample(audio.T, orig_sr=sr, target_sr=proof.SR).T
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    return audio.astype(np.float32)


def fit_to_duration(audio: np.ndarray, seconds: float) -> np.ndarray:
    target = int(seconds * proof.SR)
    if len(audio) >= target:
        return audio[:target].copy()
    repeats = math.ceil(target / max(1, len(audio)))
    return np.tile(audio, (repeats, 1))[:target].copy()


def add(out: np.ndarray, clip: np.ndarray, start_seconds: float, gain: float, pan: float = 0.0) -> None:
    start = int(start_seconds * proof.SR)
    if start >= len(out):
        return
    end = min(len(out), start + len(clip))
    piece = clip[: end - start].copy() * gain
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    piece = np.column_stack([piece[:, 0] * left, piece[:, min(1, piece.shape[1] - 1)] * right])
    out[start:end] += piece.astype(np.float32)


def sine_layer(freq: float, gain: float, seconds: float) -> np.ndarray:
    t = np.arange(int(seconds * proof.SR), dtype=np.float32) / proof.SR
    wave = np.sin(2 * np.pi * freq * t) * gain
    stereo = np.column_stack([wave, wave]).astype(np.float32)
    return proof.fade(stereo, fade_in=4.0, fade_out=8.0)


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "256k", str(mp3_path)],
        check=True,
    )


def support_pick(case_id: str, goal: str, role: str, soothing: list[dict[str, Any]]) -> dict[str, Any]:
    if role == "environment_bed":
        preferred = "proc_velvet_room_air_b" if goal == "sleep" else "proc_velvet_room_air_a"
    elif role == "texture":
        preferred = "proc_brown_velvet_hush_b" if goal == "sleep" else "proc_warm_pink_haze_a"
    else:
        preferred = "proc_soft_bowl_tail_a" if goal != "focus" else "proc_warm_pink_haze_b"
    for item in soothing:
        if item["candidateId"] == preferred:
            return item
    for item in soothing:
        if role == "environment_bed" and item["role"] == "environment_bed" and goal in item["goals"]:
            return item
        if role == "texture" and item["role"] in {"noise_texture", "masking_texture", "low_texture", "tonal_texture"} and goal in item["goals"]:
            return item
        if role == "accent" and item["role"] in {"one_shot_accent", "masking_texture"} and goal in item["goals"]:
            return item
    raise RuntimeError(f"No support material for {case_id}:{role}")


def atomic_plan_for(case_id: str) -> dict[str, Any] | None:
    plans: dict[str, dict[str, Any] | None] = {
        "sleep_piano_warm_sparse": {
            "chord": "atom_chord_sleep_soft_triad_c",
            "motif": "atom_motif_sleep_falling_1_micro",
            "bass": "atom_bass_sleep_low_anchor_c",
            "schedule": [
                ("chord", 0, 0.46, -0.08), ("chord", 18, 0.42, 0.06), ("chord", 38, 0.38, -0.02),
                ("motif", 12, 0.22, 0.12), ("motif", 44, 0.18, 0.1),
                ("bass", 6, 0.20, 0.0), ("bass", 34, 0.16, 0.0),
            ],
        },
        "calm_guitar_meditation": {
            "chord": "atom_chord_calm_guitar_open_c",
            "motif": "atom_motif_calm_guitar_open_return",
            "note": "atom_note_guitar_g3",
            "schedule": [
                ("chord", 0, 0.42, -0.10), ("chord", 16, 0.38, 0.08), ("chord", 34, 0.34, -0.04),
                ("motif", 10, 0.24, 0.12), ("motif", 28, 0.22, -0.08), ("motif", 48, 0.18, 0.1),
                ("note", 23, 0.12, 0.0),
            ],
        },
        "focus_rhodes_no_nature": {
            "chord": "atom_chord_focus_neutral_cell_cg",
            "motif": "atom_motif_focus_common_tone_cell",
            "bass": "atom_bass_focus_low_pulse_free_anchor",
            "schedule": [
                ("chord", 0, 0.34, -0.08), ("chord", 14, 0.32, 0.06), ("chord", 28, 0.30, -0.04), ("chord", 43, 0.28, 0.05),
                ("motif", 8, 0.18, 0.12), ("motif", 24, 0.17, -0.08), ("motif", 40, 0.16, 0.1),
                ("bass", 5, 0.16, 0.0), ("bass", 32, 0.14, 0.0),
            ],
        },
    }
    return plans.get(case_id)


def render_case(case: dict[str, Any], atomic_by_id: dict[str, dict[str, Any]], soothing: list[dict[str, Any]]) -> dict[str, Any]:
    goal = case["goal"]
    out = np.zeros((int(DURATION * proof.SR), 2), dtype=np.float32)
    env = support_pick(case["id"], goal, "environment_bed", soothing)
    texture = support_pick(case["id"], goal, "texture", soothing)
    accent = support_pick(case["id"], goal, "accent", soothing)

    env_audio = fit_to_duration(read_audio(env["masterAudioPath"]), DURATION)
    texture_audio = fit_to_duration(read_audio(texture["masterAudioPath"]), DURATION)
    add(out, env_audio, 0, 0.74 if goal != "focus" else 0.62)
    add(out, texture_audio, 0, 0.42 if goal != "focus" else 0.50)

    atomic_plan = atomic_plan_for(case["id"])
    selected_atomic_ids: list[str] = []
    if atomic_plan and case["bundle"]["mode"] == "music_supported":
        for key, element_id in atomic_plan.items():
            if key == "schedule":
                continue
            selected_atomic_ids.append(element_id)
        clips = {element_id: read_audio(atomic_by_id[element_id]["masterAudioPath"]) for element_id in selected_atomic_ids}
        for role, start, gain, pan in atomic_plan["schedule"]:
            add(out, clips[atomic_plan[role]], start, gain, pan)

    if case["bundle"]["bundle"]["deterministicAcousticConfig"] == "dsp_tone_reference_528hz_v1":
        add(out, sine_layer(528.0, 0.010, DURATION), 0, 1.0)

    if goal != "focus":
        accent_audio = read_audio(accent["masterAudioPath"])
        for start in ([20, 50] if case["bundle"]["mode"] == "support_only" else [52]):
            add(out, accent_audio, start, 0.045 if case["bundle"]["mode"] == "support_only" else 0.06, 0.0)

    lowpass = 2350 if goal == "sleep" else 3000 if goal == "calm" else 3400
    out = proof.highpass(out, 35)
    out = proof.lowpass(out, lowpass)
    out = proof.fade(out, fade_in=3.5, fade_out=8.0)
    out = proof.normalize_lufs(out, -27.5 if goal != "focus" else -26.8, peak_db=-7.0)

    bundle_id = f"composer_render_{case['id']}"
    wav_path = MASTER_DIR / f"{bundle_id}.wav"
    mp3_path = PREPARED_DIR / f"{bundle_id}.mp3"
    sf.write(wav_path, out, proof.SR, subtype="PCM_24")
    encode_mp3(wav_path, mp3_path)
    analysis = proof.analyze_audio(out)
    failures: list[str] = []
    if not (59 <= analysis["durationSeconds"] <= 61):
        failures.append("duration_not_60s_proof")
    if analysis["peakDbfs"] > -7:
        failures.append("peak_too_hot_for_composer_proof")
    if case["bundle"]["mode"] == "support_only" and selected_atomic_ids:
        failures.append("support_only_used_music_atoms")
    if case["bundle"]["mode"] == "music_supported" and len(selected_atomic_ids) < 3:
        failures.append("music_supported_missing_atomic_spine")
    machine_status = "pass" if not failures else "review_required"
    return {
        "id": case["id"],
        "label": case["label"],
        "prompt": case["prompt"],
        "goal": goal,
        "scene": case["scene"],
        "sourceComposerBundleId": case["bundle"]["id"],
        "composerMode": case["bundle"]["mode"],
        "professionalReviewDecision": case["professionalReview"]["decision"],
        "selectedBundle": case["bundle"]["bundle"],
        "selectedAtomicElementIds": selected_atomic_ids,
        "selectedSupportMaterialIds": [env["candidateId"], texture["candidateId"], accent["candidateId"]],
        "masterAudioPath": str(wav_path.relative_to(ROOT)),
        "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
        "reviewAudioSrc": "../../" + str(mp3_path.relative_to(ROOT / "public")),
        "durationSeconds": analysis["durationSeconds"],
        "analysis": analysis,
        "machineStatus": machine_status,
        "failures": failures,
        "professionalVerdict": "render_proof_pass" if machine_status == "pass" else "render_proof_needs_adjustment",
        "productionAllowed": False,
    }


def build_review(manifest: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in manifest["renders"]:
        cards.append(f"""
    <article class="card {escape(item['composerMode'])}">
      <p class="eyebrow">{escape(item['goal'])} · {escape(item['scene'])} · {escape(item['composerMode'])}</p>
      <h2>{escape(item['id'])}</h2>
      <p class="prompt">{escape(item['prompt'])}</p>
      <audio controls preload="metadata" src="{escape(item['reviewAudioSrc'])}"></audio>
      <div class="verdict"><b>{escape(item['professionalVerdict'])}</b> · composer decision: {escape(item['professionalReviewDecision'])}</div>
      <details open>
        <summary>Professional composer mapping</summary>
        <pre>{escape(json.dumps({
            'selectedBundle': item['selectedBundle'],
            'selectedAtomicElementIds': item['selectedAtomicElementIds'],
            'selectedSupportMaterialIds': item['selectedSupportMaterialIds'],
            'machineStatus': item['machineStatus'],
            'failures': item['failures'],
            'analysis': item['analysis'],
        }, ensure_ascii=False, indent=2))}</pre>
      </details>
    </article>""")

    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Composer Result Render Proof V1</title>
  <style>
    body{{margin:0;background:#0f1110;color:#edf4ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
    main{{max-width:1120px;margin:0 auto;padding:30px 16px 80px}}
    .hero,.card{{border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:18px;background:rgba(255,255,255,.045);margin:14px 0}}
    .hero{{background:linear-gradient(135deg,rgba(108,132,92,.2),rgba(92,132,126,.14))}}
    .eyebrow{{color:#d8c884;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}}
    .prompt{{color:#f1d08b;line-height:1.55}}
    audio{{width:100%;margin:12px 0}}
    .verdict{{padding:10px 12px;border-radius:14px;background:rgba(216,200,132,.08);border:1px solid rgba(216,200,132,.18)}}
    pre{{white-space:pre-wrap;max-height:380px;overflow:auto;background:rgba(0,0,0,.22);padding:12px;border-radius:14px}}
    summary{{cursor:pointer;color:#d8c884;font-weight:800}}
    code{{color:#f0dc91}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE · composer plan → audible proof</p>
      <h1>Composer Result Render Proof V1</h1>
      <p>这一步不让用户选素材：系统读取 <code>composer-bundle-plan-v1</code> 的专业判定，自动映射到原子音乐元素与确定性支持层，并渲染成可听结果。</p>
      <p>边界：这些音频是 composer 链路证明，不是新增基础素材，也不是正式发布内容。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    proof.require_tools()
    for directory in [MASTER_DIR, PREPARED_DIR, REVIEW_DIR, REPORT_JSON.parent]:
        directory.mkdir(parents=True, exist_ok=True)

    composer_manifest = load_json(COMPOSER_MANIFEST)
    atomic_manifest = load_json(ATOMIC_MANIFEST)
    soothing_manifest = load_json(SOOTHING_MANIFEST)
    if composer_manifest["counts"]["professionalPass"] != composer_manifest["counts"]["cases"]:
        raise RuntimeError("Composer bundle plan must be professionally passed before rendering")

    atomic_by_id = {item["elementId"]: item for item in atomic_manifest["audioElements"]}
    renders = [
        render_case(case, atomic_by_id, soothing_manifest["candidates"])
        for case in composer_manifest["results"]
    ]
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "composer_result_render_proof_ready",
        "sourceComposerPlan": "public/review/composer-bundle-plan-v1/manifest.json",
        "sourceAtomicElements": "public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json",
        "sourceSupportElements": "public/audio/music/local-review/soothing-deterministic-foundation-v1/manifest.json",
        "productionAllowed": False,
        "publicReleaseAllowed": False,
        "purpose": "Render professional composer bundle plans into audible proof mixes without asking the owner to choose materials.",
        "hardRules": [
            "Rendered proof files are not foundational elements.",
            "Rendered proof files are not finished seed content.",
            "Owner does not choose materials; professional routing and producer rules must decide.",
            "Support-only requests must not include atomic music elements.",
            "No voice, no drums, no runtime external generation API.",
        ],
        "counts": {
            "renders": len(renders),
            "musicSupported": sum(1 for item in renders if item["composerMode"] == "music_supported"),
            "supportOnly": sum(1 for item in renders if item["composerMode"] == "support_only"),
            "machinePass": sum(1 for item in renders if item["machineStatus"] == "pass"),
            "professionalRenderPass": sum(1 for item in renders if item["professionalVerdict"] == "render_proof_pass"),
        },
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "renders": renders,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)
    report = {
        "batchId": BATCH_ID,
        "verdict": "composer_result_render_proof_ready",
        "counts": manifest["counts"],
        "reviewUrl": manifest["reviewUrl"],
        "productionAllowed": False,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(
        f"""# Composer Result Render Proof V1

Generated: {manifest['generatedAt']}

## Verdict

composer_result_render_proof_ready

The professional bundle-plan decisions were rendered into audible Sleep/Calm/Focus proof mixes. These renders prove the composer chain; they are not foundational elements and not release content.

## Counts

| Type | Count |
| --- | ---: |
| Render proofs | {manifest['counts']['renders']} |
| Music-supported | {manifest['counts']['musicSupported']} |
| Support-only | {manifest['counts']['supportOnly']} |
| Machine pass | {manifest['counts']['machinePass']} |
| Professional render pass | {manifest['counts']['professionalRenderPass']} |

## Review

Open: `{manifest['reviewUrl']}`
""",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
