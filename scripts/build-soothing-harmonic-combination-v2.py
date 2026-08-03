#!/usr/bin/env python3
"""Build no-road soothing harmonic combination candidates.

Owner rejected the previous deterministic combination batch because continuous
noise beds sounded like highway traffic.  This batch avoids broadband
environment/noise foregrounds and uses soft harmonic material instead.
"""

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
from scipy import signal


ROOT = Path.cwd()
BATCH_ID = "soothing-harmonic-no-road-combination-v2"
RATE = 48_000
DURATION = 90.0
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREVIEW_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_MD = ROOT / "reports/soothing-harmonic-no-road-combination-v2-machine-qa.md"
REPORT_JSON = ROOT / "reports/soothing-harmonic-no-road-combination-v2-machine-qa.json"


@dataclass(frozen=True)
class ToneLayer:
    role: str
    frequencies: tuple[float, ...]
    gain: float
    attack: float
    release: float
    motion_period: float
    motion_depth: float
    color: str


@dataclass(frozen=True)
class SparseNoteLayer:
    role: str
    frequencies: tuple[float, ...]
    times: tuple[float, ...]
    gain: float
    decay: float
    color: str


@dataclass(frozen=True)
class Combo:
    combo_id: str
    title: str
    goal: str
    scene: str
    thesis: str
    target_lufs: float
    seed: int
    tone_layers: tuple[ToneLayer, ...]
    note_layers: tuple[SparseNoteLayer, ...] = ()


def require_tools() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required")


def time() -> np.ndarray:
    return np.arange(int(RATE * DURATION), dtype=np.float64) / RATE


def soft_envelope(t: np.ndarray, attack: float, release: float) -> np.ndarray:
    env = np.ones_like(t)
    a = max(1, int(attack * RATE))
    r = max(1, int(release * RATE))
    env[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    env[-r:] *= np.sin(np.linspace(np.pi / 2, 0, r)) ** 2
    return env


def lowpass(audio: np.ndarray, cutoff: float) -> np.ndarray:
    sos = signal.butter(4, cutoff, btype="lowpass", fs=RATE, output="sos")
    return signal.sosfiltfilt(sos, audio, axis=0)


def highpass(audio: np.ndarray, cutoff: float) -> np.ndarray:
    sos = signal.butter(2, cutoff, btype="highpass", fs=RATE, output="sos")
    return signal.sosfiltfilt(sos, audio, axis=0)


def render_tone_layer(layer: ToneLayer, rng: np.random.Generator) -> np.ndarray:
    t = time()
    stereo = []
    for channel in range(2):
        side = -1 if channel == 0 else 1
        signal_mono = np.zeros_like(t)
        for index, freq in enumerate(layer.frequencies):
            phase = rng.uniform(0, 2 * np.pi)
            detune = 1.0 + side * (0.00016 + index * 0.00003)
            partial = np.sin(2 * np.pi * freq * detune * t + phase)
            if layer.color in ("felt", "rhodes"):
                partial += 0.055 * np.sin(2 * np.pi * freq * 2.0 * detune * t + phase / 2)
                partial += 0.018 * np.sin(2 * np.pi * freq * 3.01 * detune * t + phase / 3)
            elif layer.color == "strings":
                partial += 0.040 * np.sin(2 * np.pi * freq * 2.01 * detune * t + phase / 2)
            motion = 1.0 + layer.motion_depth * np.sin(2 * np.pi * t / layer.motion_period + phase)
            signal_mono += partial * motion / max(len(layer.frequencies), 1)
        signal_mono *= soft_envelope(t, layer.attack, layer.release) * layer.gain
        stereo.append(signal_mono)
    out = np.stack(stereo, axis=1)
    cutoff = 1800 if layer.color in ("felt", "strings") else 2400
    return lowpass(highpass(out, 65), cutoff)


def render_note_layer(layer: SparseNoteLayer, rng: np.random.Generator) -> np.ndarray:
    t = time()
    out = np.zeros((len(t), 2), dtype=np.float64)
    for index, start in enumerate(layer.times):
        freq = layer.frequencies[index % len(layer.frequencies)]
        start_sample = int(start * RATE)
        if start_sample >= len(t):
            continue
        local = t[: len(t) - start_sample]
        phase = rng.uniform(0, 2 * np.pi)
        attack = np.sin(np.linspace(0, np.pi / 2, min(int(0.12 * RATE), len(local)))) ** 2
        env = np.exp(-local / layer.decay)
        env[: len(attack)] *= attack
        tone = np.sin(2 * np.pi * freq * local + phase)
        tone += 0.035 * np.sin(2 * np.pi * freq * 2.0 * local + phase / 2)
        if layer.color == "bowl":
            tone += 0.018 * np.sin(2 * np.pi * freq * 2.93 * local + phase / 3)
        note = tone * env * layer.gain
        pan = -0.28 if index % 2 == 0 else 0.28
        left = math.cos((pan + 1) * math.pi / 4)
        right = math.sin((pan + 1) * math.pi / 4)
        out[start_sample:, 0] += note * left
        out[start_sample:, 1] += note * right
    return lowpass(highpass(out, 80), 2600)


def normalize(audio: np.ndarray, target_lufs: float, peak_db: float = -8.0) -> np.ndarray:
    meter = pyln.Meter(RATE)
    loudness = meter.integrated_loudness(audio)
    if math.isfinite(loudness):
        audio = audio * (10 ** ((target_lufs - loudness) / 20))
    ceiling = 10 ** (peak_db / 20)
    peak = np.max(np.abs(audio)) + 1e-12
    if peak > ceiling:
        audio = audio * (ceiling / peak)
    return audio.astype(np.float32)


def render(combo: Combo) -> np.ndarray:
    rng = np.random.default_rng(combo.seed)
    audio = np.zeros((int(RATE * DURATION), 2), dtype=np.float64)
    for layer in combo.tone_layers:
        audio += render_tone_layer(layer, rng)
    for layer in combo.note_layers:
        audio += render_note_layer(layer, rng)
    # Very gentle final tilt away from traffic rumble and harsh brightness.
    audio = highpass(audio, 72)
    audio = lowpass(audio, 2200 if combo.goal != "focus" else 2600)
    return normalize(audio, combo.target_lufs)


COMBOS = (
    Combo(
        "sleep_warm_felt_chord_field",
        "Sleep · Warm Felt Chord Field",
        "sleep",
        "bedtime",
        "Soft harmonic bed, no broadband air or road-like wash.",
        -29.0,
        270201,
        (
            ToneLayer("felt_harmonic_body", (110.0, 164.81, 220.0), 0.42, 11, 14, 47, 0.018, "felt"),
            ToneLayer("dark_string_shadow", (82.41, 123.47, 196.0), 0.20, 18, 18, 61, 0.012, "strings"),
        ),
    ),
    Combo(
        "sleep_breathing_low_harmony",
        "Sleep · Breathing Low Harmony",
        "sleep",
        "return_to_sleep",
        "Almost motionless low harmony with slow breathing amplitude, no noise foreground.",
        -29.5,
        270202,
        (
            ToneLayer("low_harmony", (98.0, 146.83, 220.0), 0.36, 14, 18, 73, 0.015, "strings"),
            ToneLayer("felt_upper_warmth", (196.0, 261.63), 0.12, 20, 20, 89, 0.010, "felt"),
        ),
    ),
    Combo(
        "calm_soft_rhodes_space",
        "Calm · Soft Rhodes Space",
        "calm",
        "quiet_relaxation",
        "Warm Rhodes-like color and spacious low harmony; no rain, ocean, road, or whoosh.",
        -28.5,
        270203,
        (
            ToneLayer("rhodes_warmth", (130.81, 196.0, 261.63, 329.63), 0.32, 9, 14, 53, 0.020, "rhodes"),
            ToneLayer("low_ground", (87.31, 130.81), 0.18, 16, 16, 67, 0.012, "strings"),
        ),
    ),
    Combo(
        "calm_sparse_bowl_over_harmony",
        "Calm · Sparse Bowl Over Harmony",
        "calm",
        "voice_free_meditation",
        "One or two soft tonal arrivals over a harmonic pad, avoiding a highway-like continuous bed.",
        -29.0,
        270204,
        (
            ToneLayer("quiet_harmonic_pad", (116.54, 174.61, 233.08), 0.30, 16, 18, 79, 0.014, "strings"),
        ),
        (
            SparseNoteLayer("soft_bowl_arrivals", (261.63, 196.0), (8.0, 54.0), 0.12, 9.5, "bowl"),
        ),
    ),
    Combo(
        "focus_clear_soft_harmony",
        "Focus · Clear Soft Harmony",
        "focus",
        "reading_or_code",
        "Clear but gentle tonal support; designed to avoid both groove and noise wall.",
        -28.0,
        270205,
        (
            ToneLayer("clear_rhodes_body", (130.81, 196.0, 261.63), 0.28, 8, 12, 43, 0.018, "rhodes"),
            ToneLayer("upper_focus_air_without_noise", (329.63, 392.0), 0.08, 15, 15, 71, 0.010, "felt"),
        ),
    ),
    Combo(
        "focus_gentle_pentatonic_hold",
        "Focus · Gentle Pentatonic Hold",
        "focus",
        "low_arousal_work",
        "Pentatonic held tones for difference from Sleep/Calm, still no beat or percussion.",
        -28.0,
        270206,
        (
            ToneLayer("pentatonic_hold", (146.83, 196.0, 220.0, 293.66), 0.28, 10, 12, 59, 0.014, "rhodes"),
            ToneLayer("low_clean_anchor", (98.0, 146.83), 0.14, 16, 16, 83, 0.010, "strings"),
        ),
        (
            SparseNoteLayer("rare_soft_notes", (392.0, 329.63, 293.66), (18.0, 47.0, 72.0), 0.055, 6.0, "felt"),
        ),
    ),
)


def analyze(audio: np.ndarray) -> dict:
    mono = np.mean(audio, axis=1)
    y = librosa.resample(mono, orig_sr=RATE, target_sr=22_050)
    centroid = librosa.feature.spectral_centroid(y=y, sr=22_050, hop_length=512)[0]
    flatness = librosa.feature.spectral_flatness(y=y, hop_length=512)[0]
    onset_env = librosa.onset.onset_strength(y=y, sr=22_050, hop_length=512)
    raw_onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=22_050, hop_length=512)
    macro_window = int(RATE * 0.5)
    usable = mono[: len(mono) - (len(mono) % macro_window)]
    macro = usable.reshape(-1, macro_window)
    rms = np.sqrt(np.mean(macro * macro, axis=1) + 1e-12)
    dbs = 20 * np.log10(rms + 1e-12)
    interior = dbs[16:-16] if len(dbs) > 34 else dbs
    jumps = np.abs(np.diff(interior))
    macro_events = int(np.sum(jumps > 1.1))
    meter = pyln.Meter(RATE)
    return {
        "durationSeconds": round(len(audio) / RATE, 3),
        "integratedLufs": round(float(meter.integrated_loudness(audio)), 2),
        "samplePeakDbfs": round(20 * math.log10(float(np.max(np.abs(audio))) + 1e-12), 2),
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "spectralFlatnessMean": round(float(np.mean(flatness)), 5),
        "rawLibrosaOnsetCount": int(len(raw_onsets)),
        "onsetCount": macro_events,
        "onsetDensityPerSecond": round(macro_events / DURATION, 4),
        "eventMetric": "interior_500ms_rms_jump_over_1.1db_raw_librosa_retained_for_reference",
        "p99InteriorRmsJumpDb": round(float(np.percentile(jumps, 99)) if len(jumps) else 0.0, 2),
        "roadLikeRiskProxy": "low_if_spectral_flatness_below_0.12_and_no_broadband_noise_source",
        "voiceProbability": "not_applicable_deterministic_voice_free",
        "drumProbability": "not_applicable_deterministic_no_percussion",
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
        cards.append(f"""
<article>
  <p class="family">{item["goal"]} · {item["scene"]}</p>
  <h3>{item["title"]}</h3>
  <p class="meta">{item["comboId"]} · {item["analysis"]["integratedLufs"]} LUFS · flatness {item["analysis"]["spectralFlatnessMean"]} · centroid {item["analysis"]["spectralCentroidHz"]} Hz · {item["machineStatus"]}</p>
  <audio controls preload="metadata" src="{item["preparedAudioUrl"]}"></audio>
  <p>{item["thesis"]}</p>
  <div class="fields">
    <label>是否还像高速/车流<select data-key="{item["comboId"]}:road"><option value="">未判断</option><option value="no">不像</option><option value="slight">有一点</option><option value="yes">像</option></select></label>
    <label>整体舒缓<select data-key="{item["comboId"]}:soothing"><option value="">未判断</option><option value="pass">舒缓</option><option value="borderline">一般</option><option value="fail">不舒缓</option></select></label>
    <label>鼓点/脉冲<select data-key="{item["comboId"]}:pulse"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label>
    <label>结论<select data-key="{item["comboId"]}:decision"><option value="">待审核</option><option value="pass">通过</option><option value="retry">调整</option><option value="fail">淘汰</option></select></label>
    <label>记录<textarea data-key="{item["comboId"]}:notes" rows="3"></textarea></label>
  </div>
</article>""")
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>无高速感舒缓和声组合 V2</title><style>:root{{color-scheme:dark;--bg:#101311;--panel:#181d19;--line:#39453c;--text:#f2f4f1;--muted:#aab4ac;--accent:#dfc77c;--warn:#e5a19a}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:1200px;margin:auto;padding:28px 18px 80px}}header,section{{padding:24px 0;border-bottom:1px solid var(--line)}}h1{{font-size:30px;margin:7px 0}}h3{{font-size:17px;margin:2px 0}}.eyebrow,.family{{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}}.intro,.meta,p{{color:var(--muted);line-height:1.5}}.warning{{color:var(--warn)}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}article{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:13px;min-width:0}}.meta{{font-size:11px}}audio{{width:100%;height:40px}}.fields{{display:grid;gap:8px;margin-top:10px}}label{{display:grid;gap:4px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid var(--line);border-radius:4px;background:#121613;color:var(--text);padding:8px;font:inherit}}button{{border:0;border-radius:5px;background:var(--accent);color:#171811;padding:10px 14px;font-weight:700;cursor:pointer}}@media(max-width:900px){{.grid{{grid-template-columns:1fr}}}}</style></head><body><main><header><p class="eyebrow">NO-ROAD HARMONIC QA</p><h1>无高速感舒缓和声组合 V2</h1><p class="intro">上一批被判定像高速公路。这一批避开雨、海、空气噪声和宽频 whoosh，改用柔和和声床、低密度轻音乐色彩和稀疏音色事件。</p><p class="warning">仍是候选。请优先判断：还像不像车流？是否舒缓？有没有鼓点/脉冲？</p><button id="export">导出审核结果</button></header><section><div class="grid">{''.join(cards)}</div></section></main><script>const key='snooze-soothing-harmonic-no-road-combination-v2-review';const state=JSON.parse(localStorage.getItem(key)||'{{}}');document.querySelectorAll('[data-key]').forEach(input=>{{input.value=state[input.dataset.key]||'';const save=()=>{{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))}};input.addEventListener('change',save);input.addEventListener('input',save)}});document.getElementById('export').addEventListener('click',()=>{{const payload={{schemaVersion:'1.0.0',batchId:'{BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}}));const a=document.createElement('a');a.href=url;a.download='{BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}});</script></body></html>"""


def main() -> None:
    require_tools()
    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    results = []
    for combo in COMBOS:
        audio = render(combo)
        wav_path = MASTER_DIR / f"{combo.combo_id}.wav"
        mp3_path = PREVIEW_DIR / f"{combo.combo_id}.mp3"
        sf.write(wav_path, audio, RATE, subtype="PCM_24")
        mp3(wav_path, mp3_path)
        analysis = analyze(audio)
        failures = []
        if analysis["samplePeakDbfs"] > -6:
            failures.append("peak_above_minus_6_dbfs")
        if analysis["spectralFlatnessMean"] > 0.12:
            failures.append("too_broadband_road_like")
        if analysis["onsetDensityPerSecond"] > 0.45:
            failures.append("too_many_note_events")
        if analysis["p99InteriorRmsJumpDb"] > 2.5:
            failures.append("interior_rms_jump_too_high")
        if combo.goal in ("sleep", "calm") and analysis["spectralCentroidHz"] > 1400:
            failures.append("too_bright_for_sleep_or_calm")
        results.append({
            "comboId": combo.combo_id,
            "title": combo.title,
            "goal": combo.goal,
            "scene": combo.scene,
            "thesis": combo.thesis,
            "source": "deterministic_harmonic_synthesis",
            "productionAllowed": False,
            "masterAudioPath": str(wav_path.relative_to(ROOT)),
            "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
            "analysis": analysis,
            "machineStatus": "pass" if not failures else "fail",
            "failures": failures,
        })
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "candidate_pending_owner_no_road_review",
        "replacesRejectedBatch": "soothing-deterministic-combination-v1",
        "rejectionReasonAddressed": "Previous batch sounded like cars on a highway.",
        "productionAllowed": False,
        "candidateCount": len(results),
        "machinePassCount": sum(1 for item in results if item["machineStatus"] == "pass"),
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "hardExclusions": ["highway-like broadband wash", "traffic rumble", "rain/ocean/air noise foreground", "drums", "percussion", "beat", "rhythmic pulse", "groove", "human voice", "medical claims"],
        "combinations": results,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    REPORT_JSON.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    rows = [
        f'| `{item["comboId"]}` | {item["goal"]} | {item["analysis"]["integratedLufs"]} | {item["analysis"]["samplePeakDbfs"]} | {item["analysis"]["spectralFlatnessMean"]} | {item["analysis"]["spectralCentroidHz"]} | {item["machineStatus"]} | [试听]({item["preparedAudioUrl"]}) |'
        for item in results
    ]
    REPORT_MD.write_text(
        "# Soothing Harmonic No-Road Combination V2 Machine QA\n\n"
        f"Batch: `{BATCH_ID}`  \n"
        "Status: candidate-only; built after owner rejected the prior batch as highway-like.\n\n"
        "| Combo | Goal | LUFS | Peak | Flatness | Centroid Hz | Machine | Preview |\n"
        "| --- | --- | ---: | ---: | ---: | ---: | --- | --- |\n"
        + "\n".join(rows)
        + "\n\n## Listening Gate\n\nReject if it still sounds like road traffic, car cabin, fan/AC, broadband whoosh, a noise wall, drums, pulse, or voice.\n",
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
