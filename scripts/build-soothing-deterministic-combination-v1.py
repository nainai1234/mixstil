#!/usr/bin/env python3
"""Build combination QA renders from deterministic soothing foundation elements."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf


ROOT = Path.cwd()
SOURCE_BATCH = "soothing-deterministic-foundation-v1"
BATCH_ID = "soothing-deterministic-combination-v1"
SOURCE_MANIFEST = ROOT / "public/audio/music/local-review" / SOURCE_BATCH / "manifest.json"
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREVIEW_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_MD = ROOT / "reports/soothing-deterministic-combination-v1-machine-qa.md"
REPORT_JSON = ROOT / "reports/soothing-deterministic-combination-v1-machine-qa.json"
RATE = 48_000


@dataclass(frozen=True)
class Layer:
    candidate_id: str
    gain_db: float
    role: str


@dataclass(frozen=True)
class Combo:
    combo_id: str
    title: str
    goal: str
    scene: str
    thesis: str
    target_lufs: float
    layers: tuple[Layer, ...]


COMBOS = (
    Combo(
        "sleep_dark_room_low_resonance",
        "Sleep · Dark Room Low Resonance",
        "sleep",
        "bedtime",
        "Very dark room air plus low felt resonance; tests whether two non-musical elements create comfort without a beat.",
        -27.5,
        (
            Layer("proc_velvet_room_air_a", -1.5, "air_body"),
            Layer("proc_low_felt_resonance_b", -6.0, "low_support"),
        ),
    ),
    Combo(
        "sleep_far_ocean_rain_hush",
        "Sleep · Far Ocean Rain Hush",
        "sleep",
        "return_to_sleep",
        "Distant ocean body with muffled rain detail; tests whether natural layers stay blurred and non-eventful.",
        -28.0,
        (
            Layer("proc_far_ocean_blur_a", -2.0, "low_environment"),
            Layer("proc_rain_behind_wall_b", -7.0, "soft_detail"),
            Layer("proc_low_felt_resonance_a", -10.0, "barely_felt_anchor"),
        ),
    ),
    Combo(
        "calm_pine_granular_space",
        "Calm · Pine Granular Space",
        "calm",
        "quiet_relaxation",
        "Pine air and dark granular smooth texture; tests a spacious calm mix without melody, voice, or percussion.",
        -28.0,
        (
            Layer("proc_pine_air_haze_b", -2.0, "air"),
            Layer("proc_dark_granular_smooth_b", -7.5, "space_texture"),
        ),
    ),
    Combo(
        "calm_room_bowl_entry",
        "Calm · Room With One Bowl Entry",
        "calm",
        "breathing_meditation_voice_free",
        "A single soft bowl cue enters once over room air and low resonance; tests whether an accent can mark the beginning without becoming music.",
        -28.5,
        (
            Layer("proc_velvet_room_air_b", -2.5, "room_air"),
            Layer("proc_low_felt_resonance_b", -8.0, "low_support"),
            Layer("proc_soft_bowl_tail_b", -3.0, "single_entry_accent"),
        ),
    ),
    Combo(
        "focus_soft_rain_pink_haze",
        "Focus · Soft Rain Pink Haze",
        "focus",
        "deep_work_low_arousal",
        "Muffled rain and warm pink haze; tests focus masking without hi-hats, groove, or rhythmic drive.",
        -27.0,
        (
            Layer("proc_rain_behind_wall_a", -2.0, "soft_environment"),
            Layer("proc_warm_pink_haze_a", -6.0, "masking_texture"),
            Layer("proc_velvet_room_air_a", -9.0, "room_fill"),
        ),
    ),
    Combo(
        "focus_dark_room_clean_haze",
        "Focus · Dark Room Clean Haze",
        "focus",
        "reading_or_code",
        "Room air with warm pink haze; tests a neutral focus bed that avoids music and avoids a heavy noise wall.",
        -27.5,
        (
            Layer("proc_velvet_room_air_a", -2.0, "room_air"),
            Layer("proc_warm_pink_haze_b", -7.0, "soft_mask"),
        ),
    ),
)


def require_tools() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required")


def db(value: float) -> float:
    return 20 * math.log10(max(value, 1e-12))


def normalize(audio: np.ndarray, target_lufs: float, peak_db: float = -7.0) -> np.ndarray:
    meter = pyln.Meter(RATE)
    loudness = meter.integrated_loudness(audio)
    if math.isfinite(loudness):
        audio = audio * (10 ** ((target_lufs - loudness) / 20))
    ceiling = 10 ** (peak_db / 20)
    peak = float(np.max(np.abs(audio))) or 1
    if peak > ceiling:
        audio = audio * (ceiling / peak)
    return audio.astype(np.float32)


def load_audio(path: Path) -> np.ndarray:
    audio, rate = sf.read(path, always_2d=True, dtype="float32")
    if rate != RATE:
        raise RuntimeError(f"{path} has sample rate {rate}, expected {RATE}")
    return audio


def render(combo: Combo, candidates: dict[str, dict]) -> np.ndarray:
    rendered = None
    for layer in combo.layers:
        source_path = ROOT / candidates[layer.candidate_id]["masterAudioPath"]
        audio = load_audio(source_path) * (10 ** (layer.gain_db / 20))
        rendered = audio if rendered is None else rendered + audio
    assert rendered is not None
    return normalize(rendered, combo.target_lufs)


def analyze(audio: np.ndarray) -> dict:
    mono = np.mean(audio, axis=1)
    y = librosa.resample(mono, orig_sr=RATE, target_sr=22_050)
    centroid = librosa.feature.spectral_centroid(y=y, sr=22_050, hop_length=512)[0]
    macro_window = int(RATE * 0.5)
    usable = mono[: len(mono) - (len(mono) % macro_window)]
    macro = usable.reshape(-1, macro_window)
    rms = np.sqrt(np.mean(macro * macro, axis=1) + 1e-12)
    dbs = 20 * np.log10(rms + 1e-12)
    interior = dbs[16:-16] if len(dbs) > 34 else dbs
    jumps = np.abs(np.diff(interior))
    events = int(np.sum(jumps > 0.95))
    meter = pyln.Meter(RATE)
    return {
        "durationSeconds": round(len(audio) / RATE, 3),
        "integratedLufs": round(float(meter.integrated_loudness(audio)), 2),
        "samplePeakDbfs": round(db(float(np.max(np.abs(audio)))), 2),
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "macroEventCount": events,
        "macroEventDensityPerSecond": round(events / max(len(audio) / RATE, 1), 4),
        "p99InteriorRmsJumpDb": round(float(np.percentile(jumps, 99)) if len(jumps) else 0.0, 2),
        "voiceProbability": "not_applicable_source_layers_are_deterministic_voice_free",
        "drumProbability": "not_applicable_source_layers_are_deterministic_no_percussion",
    }


def mp3(wav: Path, target: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "256k", str(target)],
        cwd=ROOT,
        check=True,
    )


def html(results: list[dict]) -> str:
    cards = []
    for item in results:
        layer_rows = "".join(
            f"<li><code>{layer['candidateId']}</code> · {layer['role']} · {layer['gainDb']} dB</li>"
            for layer in item["layers"]
        )
        cards.append(f"""
<article>
  <p class="family">{item["goal"]} · {item["scene"]}</p>
  <h3>{item["title"]}</h3>
  <p class="meta">{item["comboId"]} · {item["analysis"]["integratedLufs"]} LUFS · peak {item["analysis"]["samplePeakDbfs"]} dBFS · centroid {item["analysis"]["spectralCentroidHz"]} Hz · {item["machineStatus"]}</p>
  <audio controls preload="metadata" src="{item["preparedAudioUrl"]}"></audio>
  <p>{item["thesis"]}</p>
  <details><summary>组合层</summary><ul>{layer_rows}</ul></details>
  <div class="fields">
    <label>整体舒缓<select data-key="{item["comboId"]}:soothing"><option value="">未判断</option><option value="pass">舒缓</option><option value="borderline">一般</option><option value="fail">不舒缓</option></select></label>
    <label>鼓点/脉冲感<select data-key="{item["comboId"]}:pulse"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label>
    <label>差异度<select data-key="{item["comboId"]}:distinct"><option value="">未判断</option><option value="clear">明显不同</option><option value="weak">差异弱</option><option value="same">太像</option></select></label>
    <label>结论<select data-key="{item["comboId"]}:decision"><option value="">待审核</option><option value="pass">通过</option><option value="retry">调整</option><option value="fail">淘汰</option></select></label>
    <label>记录<textarea data-key="{item["comboId"]}:notes" rows="3"></textarea></label>
  </div>
</article>""")
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>确定性基础元素组合 V1</title><style>:root{{color-scheme:dark;--bg:#101311;--panel:#181d19;--line:#39453c;--text:#f2f4f1;--muted:#aab4ac;--accent:#dfc77c;--warn:#e5a19a}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:1200px;margin:auto;padding:28px 18px 80px}}header,section{{padding:24px 0;border-bottom:1px solid var(--line)}}h1{{font-size:30px;margin:7px 0}}h3{{font-size:17px;margin:2px 0}}.eyebrow,.family{{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}}.intro,.meta,p,summary,li{{color:var(--muted);line-height:1.5}}.warning{{color:var(--warn)}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}article{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:13px;min-width:0}}.meta{{font-size:11px}}audio{{width:100%;height:40px}}.fields{{display:grid;gap:8px;margin-top:10px}}label{{display:grid;gap:4px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid var(--line);border-radius:4px;background:#121613;color:var(--text);padding:8px;font:inherit}}button{{border:0;border-radius:5px;background:var(--accent);color:#171811;padding:10px 14px;font-weight:700;cursor:pointer}}code{{color:#f1de9a}}@media(max-width:900px){{.grid{{grid-template-columns:1fr}}}}</style></head><body><main><header><p class="eyebrow">FOUNDATION COMBINATION QA</p><h1>确定性基础元素组合 V1 · Sleep / Calm / Focus</h1><p class="intro">这页验证“基础元素叠起来之后有没有产品价值”。所有组合只使用机器通过的确定性基础元素；仍然不是正式内容，不进入用户配方。</p><p class="warning">重点听：是否舒缓、是否有鼓点/脉冲感、是否像噪声墙、Sleep/Calm/Focus 是否真的不同。</p><button id="export">导出审核结果</button></header><section><div class="grid">{''.join(cards)}</div></section></main><script>const key='snooze-soothing-deterministic-combination-v1-review';const state=JSON.parse(localStorage.getItem(key)||'{{}}');document.querySelectorAll('[data-key]').forEach(input=>{{input.value=state[input.dataset.key]||'';const save=()=>{{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))}};input.addEventListener('change',save);input.addEventListener('input',save)}});document.getElementById('export').addEventListener('click',()=>{{const payload={{schemaVersion:'1.0.0',batchId:'{BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}}));const a=document.createElement('a');a.href=url;a.download='{BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}});</script></body></html>"""


def main() -> None:
    require_tools()
    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    candidates = {item["candidateId"]: item for item in source_manifest["candidates"]}
    results = []
    for combo in COMBOS:
        for layer in combo.layers:
            if candidates[layer.candidate_id]["machineStatus"] != "pass":
                raise RuntimeError(f"{combo.combo_id} uses non-pass source {layer.candidate_id}")
        audio = render(combo, candidates)
        wav_path = MASTER_DIR / f"{combo.combo_id}.wav"
        mp3_path = PREVIEW_DIR / f"{combo.combo_id}.mp3"
        sf.write(wav_path, audio, RATE, subtype="PCM_24")
        mp3(wav_path, mp3_path)
        analysis = analyze(audio)
        failures = []
        if analysis["samplePeakDbfs"] > -6:
            failures.append("peak_above_minus_6_dbfs")
        if analysis["macroEventDensityPerSecond"] > 0.35:
            failures.append("macro_event_density_too_high")
        if analysis["p99InteriorRmsJumpDb"] > 1.8:
            failures.append("interior_rms_jump_too_high")
        if combo.goal in ("sleep", "calm") and analysis["spectralCentroidHz"] > 1600:
            failures.append("too_bright_for_sleep_or_calm")
        results.append({
            "comboId": combo.combo_id,
            "title": combo.title,
            "goal": combo.goal,
            "scene": combo.scene,
            "thesis": combo.thesis,
            "sourceBatch": SOURCE_BATCH,
            "productionAllowed": False,
            "masterAudioPath": str(wav_path.relative_to(ROOT)),
            "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
            "layers": [
                {
                    "candidateId": layer.candidate_id,
                    "title": candidates[layer.candidate_id]["title"],
                    "role": layer.role,
                    "gainDb": layer.gain_db,
                }
                for layer in combo.layers
            ],
            "analysis": analysis,
            "machineStatus": "pass" if not failures else "fail",
            "failures": failures,
        })
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceBatch": SOURCE_BATCH,
        "status": "candidate_pending_human_combination_review",
        "productionAllowed": False,
        "candidateCount": len(results),
        "machinePassCount": sum(1 for item in results if item["machineStatus"] == "pass"),
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "hardExclusions": ["drums", "percussion", "beat", "rhythmic pulse", "groove", "human voice", "human-like vocal texture", "medical claims"],
        "combinations": results,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    rows = [
        f'| `{item["comboId"]}` | {item["goal"]} | {len(item["layers"])} | {item["analysis"]["integratedLufs"]} | {item["analysis"]["samplePeakDbfs"]} | {item["analysis"]["macroEventDensityPerSecond"]} | {item["analysis"]["spectralCentroidHz"]} | {item["machineStatus"]} | [试听]({item["preparedAudioUrl"]}) |'
        for item in results
    ]
    REPORT_MD.write_text(
        "# Soothing Deterministic Combination V1 Machine QA\n\n"
        f"Batch: `{BATCH_ID}`  \n"
        f"Source: `{SOURCE_BATCH}`  \n"
        "Status: candidate-only combination QA; no production promotion.\n\n"
        "| Combo | Goal | Layers | LUFS | Peak | Events/s | Centroid Hz | Machine | Preview |\n"
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |\n"
        + "\n".join(rows)
        + "\n\n## Listening Gate\n\nPass only if the combination remains soothing, voice-free, drum-free, non-pulsing, and meaningfully distinct for its goal.\n",
        encoding="utf-8",
    )
    (REVIEW_DIR / "index.html").write_text(html(results), encoding="utf-8")
    print(json.dumps({
        "batchId": BATCH_ID,
        "candidateCount": manifest["candidateCount"],
        "machinePassCount": manifest["machinePassCount"],
        "reviewUrl": manifest["reviewUrl"],
        "productionAllowed": False,
    }, indent=2))


if __name__ == "__main__":
    main()
