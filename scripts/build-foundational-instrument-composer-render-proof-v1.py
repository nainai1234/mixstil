#!/usr/bin/env python3
"""Render controlled instrument composer admission proofs into audible mixes.

This is the next layer after `foundational-instrument-composer-admission-proof-v1`.
It renders the six already-defined instrument + support combinations so the
team can judge the actual mixed result. These files remain internal proof
artifacts: no Quick Create routing, production, public, offline, or formal
usable promotion happens here.
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

import librosa
import numpy as np
import soundfile as sf


ROOT = Path.cwd()
BATCH_ID = "foundational-instrument-composer-render-proof-v1"
SOURCE_PROOF = ROOT / "reports/foundational-instrument-composer-admission-proof-v1.json"
PROOF_SCRIPT = ROOT / "scripts/build-instrument-runtime-render-proof-v1.py"
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREPARED_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON = ROOT / "reports" / f"{BATCH_ID}.json"
REPORT_MD = ROOT / "reports" / f"{BATCH_ID}.md"
DURATION_SECONDS = 60.0


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


def public_path(audio_url: str) -> Path:
    return ROOT / "public" / audio_url.lstrip("/")


def read_audio_url(audio_url: str) -> np.ndarray:
    source = public_path(audio_url)
    if not source.exists():
        raise RuntimeError(f"Missing audio source {audio_url}")
    audio, sr = sf.read(source, always_2d=True, dtype="float32")
    if sr != proof.SR:
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
    left = math.cos((pan + 1) * math.pi / 4)
    right = math.sin((pan + 1) * math.pi / 4)
    piece = np.column_stack([piece[:, 0] * left, piece[:, min(1, piece.shape[1] - 1)] * right])
    out[start:end] += piece.astype(np.float32)


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "256k",
            str(mp3_path),
        ],
        check=True,
    )


def support_gain(role: str, goal: str) -> float:
    if role == "environment_identity_bed":
        return 0.66 if goal != "focus" else 0.58
    if role == "organic_texture":
        return 0.34 if goal == "sleep" else 0.40
    if role == "accent_transition":
        return 0.050 if goal != "focus" else 0.030
    return 0.24


def instrument_gain(instrument: str, goal: str) -> float:
    if instrument == "bass":
        return 0.18 if goal == "sleep" else 0.20
    if instrument == "rhodes":
        return 0.30
    if instrument == "guitar":
        return 0.32
    return 0.27 if goal == "sleep" else 0.30


def render_case(item: dict[str, Any]) -> dict[str, Any]:
    goal = item["goal"]
    instrument = item["instrumentLayer"]["instrument"]
    out = np.zeros((int(DURATION_SECONDS * proof.SR), 2), dtype=np.float32)

    support_ids: list[str] = []
    for layer in item["supportLayers"]:
        support_ids.append(layer["id"])
        clip = read_audio_url(layer["audioUrl"])
        role = layer["recipeRole"]
        if role == "accent_transition":
            for start in ([20, 47] if goal != "focus" else [44]):
                add(out, clip, start, support_gain(role, goal), 0.0)
        else:
            add(out, fit_to_duration(clip, DURATION_SECONDS), 0, support_gain(role, goal), 0.0)

    instrument_clip = fit_to_duration(read_audio_url(item["instrumentLayer"]["audioUrl"]), DURATION_SECONDS)
    instrument_clip = proof.fade(instrument_clip, fade_in=4.0, fade_out=9.0)
    add(out, instrument_clip, 0, instrument_gain(instrument, goal), -0.05 if instrument == "piano" else 0.06)

    lowpass = 2200 if goal == "sleep" else 3000 if goal == "calm" else 3400
    target_lufs = -28.2 if goal == "sleep" else -27.4 if goal == "calm" else -26.7
    out = proof.highpass(out, 35)
    out = proof.lowpass(out, lowpass)
    out = proof.fade(out, fade_in=3.5, fade_out=8.0)
    out = proof.normalize_lufs(out, target_lufs, peak_db=-7.0)

    file_base = f"instrument_composer_render_{item['id']}"
    wav_path = MASTER_DIR / f"{file_base}.wav"
    mp3_path = PREPARED_DIR / f"{file_base}.mp3"
    sf.write(wav_path, out, proof.SR, subtype="PCM_24")
    encode_mp3(wav_path, mp3_path)
    analysis = proof.analyze_audio(out)

    failures: list[str] = []
    if not (59 <= analysis["durationSeconds"] <= 61):
        failures.append("duration_not_60s_render_proof")
    if analysis["peakDbfs"] > -7:
        failures.append("peak_too_hot_for_internal_render_proof")
    if len(support_ids) != 3:
        failures.append("support_layer_count_changed")
    if "lyria" in " ".join(support_ids).lower():
        failures.append("lyria_reserve_used")
    machine_status = "pass" if not failures else "review_required"

    return {
        "id": item["id"],
        "label": item["label"],
        "prompt": item["prompt"],
        "goal": goal,
        "scene": item["scene"],
        "admissionSourceId": item["id"],
        "admissionStatus": item["admissionStatus"],
        "renderStatus": "internal_render_proof_ready" if machine_status == "pass" else "internal_render_proof_needs_adjustment",
        "instrumentLayer": item["instrumentLayer"],
        "supportLayers": item["supportLayers"],
        "selectedInstrumentId": item["instrumentLayer"]["id"],
        "selectedSupportMaterialIds": support_ids,
        "masterAudioPath": str(wav_path.relative_to(ROOT)),
        "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
        "reviewAudioSrc": "../../" + str(mp3_path.relative_to(ROOT / "public")),
        "durationSeconds": analysis["durationSeconds"],
        "analysis": {
            **analysis,
            "humanVoiceProbability": "not_applicable_local_instrument_and_deterministic_support_sources",
            "drumProbability": "not_applicable_no_percussion_source",
        },
        "machineStatus": machine_status,
        "failures": failures,
        "internalListeningStatus": "pending",
        "quickCreateRouterAllowed": False,
        "productionAllowed": False,
        "publicReleaseAllowed": False,
        "offlineReleaseAllowed": False,
        "formalUsable": False,
    }


def build_review(manifest: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in manifest["renders"]:
        cards.append(f"""
    <article class="card" data-goal="{escape(item['goal'])}" data-instrument="{escape(item['instrumentLayer']['instrument'])}">
      <p class="eyebrow">{escape(item['goal'])} · {escape(item['scene'])} · rendered internal proof</p>
      <h2>{escape(item['label'])}</h2>
      <p class="prompt">{escape(item['prompt'])}</p>
      <audio controls preload="metadata" src="{escape(item['reviewAudioSrc'])}"></audio>
      <div class="verdict"><b>{escape(item['machineStatus'])}</b> · {escape(item['renderStatus'])} · routing blocked</div>
      <details>
        <summary>Render mapping</summary>
        <pre>{escape(json.dumps({
            'instrumentLayer': item['instrumentLayer']['id'],
            'supportLayers': item['selectedSupportMaterialIds'],
            'analysis': item['analysis'],
            'blocked': {
                'quickCreateRouterAllowed': item['quickCreateRouterAllowed'],
                'productionAllowed': item['productionAllowed'],
                'publicReleaseAllowed': item['publicReleaseAllowed'],
                'formalUsable': item['formalUsable'],
            },
        }, ensure_ascii=False, indent=2))}</pre>
      </details>
    </article>""")

    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foundational Instrument Composer Render Proof V1</title>
  <style>
    body{{margin:0;background:#101214;color:#f4f0e7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
    main{{max-width:1120px;margin:0 auto;padding:30px 16px 80px}}
    .hero,.card{{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:18px;background:#171a1d;margin:14px 0}}
    .hero{{background:#181b1e}}
    .eyebrow{{color:#9fd3bc;text-transform:uppercase;letter-spacing:0;font-size:12px;font-weight:800}}
    h1{{font-size:clamp(2rem,5vw,3.6rem);line-height:1;margin:0 0 12px;letter-spacing:0}}
    h2{{letter-spacing:0}}
    p{{line-height:1.55;color:#cbc3b7}}
    .prompt{{color:#f1d08b}}
    audio{{width:100%;margin:12px 0;min-height:38px}}
    .verdict{{padding:10px 12px;border-radius:8px;background:#22251f;border:1px solid #4d5140;color:#eee8dc}}
    pre{{white-space:pre-wrap;max-height:360px;overflow:auto;background:rgba(0,0,0,.24);padding:12px;border-radius:8px}}
    summary{{cursor:pointer;color:#f7e3aa;font-weight:800}}
    code{{color:#f0dc91}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE internal render proof</p>
      <h1>Instrument Composer Render Proof</h1>
      <p>这一步把 <code>foundational-instrument-composer-admission-proof-v1</code> 的 6 条候选组合渲染成实际可听混音，用于内部判断“候选乐器 + 支撑层”是否有产品听感价值。</p>
      <p>边界：这些音频不是基础元素、不是正式内容、不是 Quick Create 路由素材，也不能进入生产、公开、离线或正式可用集合。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    proof.require_tools()
    source = load_json(SOURCE_PROOF)
    if source["batchId"] != "foundational-instrument-composer-admission-proof-v1":
        raise RuntimeError("Unexpected admission proof source")
    if source["counts"]["cases"] != 6 or source["renderedMixesProduced"]:
        raise RuntimeError("Admission proof must contain six unrendered proof cases")

    for directory in [MASTER_DIR, PREPARED_DIR, REVIEW_DIR, REPORT_JSON.parent]:
        directory.mkdir(parents=True, exist_ok=True)

    renders = [render_case(item) for item in source["cases"]]
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "foundational_instrument_composer_render_proof_ready",
        "sourceAdmissionProof": "reports/foundational-instrument-composer-admission-proof-v1.json",
        "productionAllowed": False,
        "publicReleaseAllowed": False,
        "quickCreateRouterAllowed": False,
        "offlineReleaseAllowed": False,
        "formalUsablePromotionAllowed": False,
        "purpose": "Render six controlled instrument composer admission combinations into audible internal proof mixes without promoting them to consumer routing.",
        "hardRules": [
            "Rendered files are internal proof mixes, not foundational elements.",
            "Rendered files are not finished seed content and not public release content.",
            "No reserve candidate is promoted to consumer Quick Create by this proof.",
            "Every render uses exactly one admitted instrument candidate and three mapped support ingredients.",
            "No Lyria single-element reserve item may be used.",
            "The consumer is never asked to choose these materials.",
        ],
        "counts": {
            "renders": len(renders),
            "machinePass": sum(1 for item in renders if item["machineStatus"] == "pass"),
            "sleep": sum(1 for item in renders if item["goal"] == "sleep"),
            "calm": sum(1 for item in renders if item["goal"] == "calm"),
            "focus": sum(1 for item in renders if item["goal"] == "focus"),
            "quickCreateRouterAllowed": sum(1 for item in renders if item["quickCreateRouterAllowed"]),
            "productionAllowed": sum(1 for item in renders if item["productionAllowed"]),
            "publicReleaseAllowed": sum(1 for item in renders if item["publicReleaseAllowed"]),
            "formalUsable": sum(1 for item in renders if item["formalUsable"]),
        },
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "renders": renders,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)

    rows = "\n".join(
        f"| `{item['id']}` | {item['goal']} | {item['instrumentLayer']['instrument']} | {item['analysis']['integratedLufs']} | {item['analysis']['peakDbfs']} | {item['machineStatus']} | [试听]({item['preparedAudioUrl']}) |"
        for item in renders
    )
    REPORT_MD.write_text(
        f"""# Foundational Instrument Composer Render Proof V1

Generated: {manifest['generatedAt']}

## Verdict

Six controlled instrument-composer admission combinations were rendered into
audible internal proof mixes. They are now listenable as mixed results, but
remain blocked from Quick Create routing, production playback, public release,
offline release, and formal usable promotion.

## Counts

| Metric | Count |
| --- | ---: |
| Renders | {manifest['counts']['renders']} |
| Machine pass | {manifest['counts']['machinePass']} |
| Sleep / Calm / Focus | {manifest['counts']['sleep']} / {manifest['counts']['calm']} / {manifest['counts']['focus']} |
| Quick Create router allowed | {manifest['counts']['quickCreateRouterAllowed']} |
| Production allowed | {manifest['counts']['productionAllowed']} |
| Public release allowed | {manifest['counts']['publicReleaseAllowed']} |
| Formal usable | {manifest['counts']['formalUsable']} |

## Boundary

This is rendered listening evidence for composer admission only. It does not
modify `foundational_recipe_eligibility_map_v1`, does not promote reserve
instrument candidates, and does not ask the consumer to select materials.

## Renders

| ID | Goal | Instrument | LUFS | Peak dBFS | Status | Audio |
| --- | --- | --- | ---: | ---: | --- | --- |
{rows}
""",
        encoding="utf-8",
    )
    print(json.dumps({
        "batchId": BATCH_ID,
        "status": manifest["status"],
        "reviewUrl": manifest["reviewUrl"],
        "counts": manifest["counts"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
