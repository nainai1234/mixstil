#!/usr/bin/env python3
"""Generate deterministic no-drum soothing foundational elements.

This batch intentionally avoids model-generated musical completions.  It renders
low-event environmental beds, abstract textures, and rare one-shot accents with
deterministic DSP so Sleep/Calm/Focus foundational material can be controlled
instead of hoping a music model follows "no beat" instructions.
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
BATCH_ID = "soothing-deterministic-foundation-v1"
RATE = 48_000
DURATION = 60.0
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREVIEW_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON_PATH = ROOT / "reports/soothing-deterministic-foundation-v1-machine-qa.json"
REPORT_MD_PATH = ROOT / "reports/soothing-deterministic-foundation-v1-machine-qa.md"


def require_tools() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required to create MP3 review files")


@dataclass(frozen=True)
class Spec:
    candidate_id: str
    title: str
    category: str
    role: str
    goals: tuple[str, ...]
    generator: str
    seed: int
    target_lufs: float
    lowpass_hz: float
    highpass_hz: float
    warmth: float
    motion_depth: float
    motion_seconds: float
    notes: str


SPECS: tuple[Spec, ...] = (
    Spec("proc_velvet_room_air_a", "Velvet Room Air A", "environment", "environment_bed", ("sleep", "calm", "focus"), "filtered_noise_air", 260701, -29.0, 2600, 55, 0.74, 0.018, 53, "Dark indoor room-air layer; no fan cycle, no motor pulse."),
    Spec("proc_velvet_room_air_b", "Velvet Room Air B", "environment", "environment_bed", ("sleep", "calm", "focus"), "filtered_noise_air", 260702, -30.0, 2200, 50, 0.82, 0.014, 67, "Even darker room-air variant for sleep."),
    Spec("proc_pine_air_haze_a", "Pine Air Haze A", "environment", "environment_bed", ("sleep", "calm"), "filtered_noise_air", 260703, -30.0, 3100, 70, 0.62, 0.022, 71, "Distant forest air without gusts, birds, insects, or leaf clicks."),
    Spec("proc_pine_air_haze_b", "Pine Air Haze B", "environment", "environment_bed", ("sleep", "calm"), "filtered_noise_air", 260704, -30.5, 2400, 65, 0.72, 0.016, 89, "Lower-brightness pine-air variant."),
    Spec("proc_far_ocean_blur_a", "Far Ocean Blur A", "environment", "environment_bed", ("sleep", "calm"), "blurred_ocean", 260705, -29.0, 1800, 45, 0.88, 0.020, 97, "Distant low ocean wash with no close splash or wave hits."),
    Spec("proc_far_ocean_blur_b", "Far Ocean Blur B", "environment", "environment_bed", ("sleep", "calm"), "blurred_ocean", 260706, -30.0, 1500, 42, 0.92, 0.016, 113, "Darker ocean wash heard as continuous body, not individual waves."),
    Spec("proc_rain_behind_wall_a", "Rain Behind Wall A", "environment", "environment_bed", ("sleep", "calm", "focus"), "muffled_rain", 260707, -30.0, 3300, 120, 0.56, 0.010, 79, "Fine rain blurred behind a wall; no drop transients."),
    Spec("proc_rain_behind_wall_b", "Rain Behind Wall B", "environment", "environment_bed", ("sleep", "calm", "focus"), "muffled_rain", 260708, -31.0, 2800, 110, 0.64, 0.010, 101, "Softer rain texture with less high detail."),
    Spec("proc_brown_velvet_hush_a", "Brown Velvet Hush A", "texture", "noise_texture", ("sleep", "calm"), "colored_noise", 260709, -30.0, 1600, 35, 0.96, 0.012, 131, "Non-musical dark velvet hush; not marketed as therapeutic."),
    Spec("proc_brown_velvet_hush_b", "Brown Velvet Hush B", "texture", "noise_texture", ("sleep", "calm"), "colored_noise", 260710, -31.0, 1200, 32, 1.00, 0.010, 149, "Deepest non-event texture for low sensitivity users."),
    Spec("proc_warm_pink_haze_a", "Warm Pink Haze A", "texture", "masking_texture", ("sleep", "calm", "focus"), "colored_noise", 260711, -31.0, 2600, 45, 0.70, 0.010, 83, "Balanced soft haze; kept low so it does not become the main content."),
    Spec("proc_warm_pink_haze_b", "Warm Pink Haze B", "texture", "masking_texture", ("sleep", "calm", "focus"), "colored_noise", 260712, -31.5, 2100, 42, 0.76, 0.010, 107, "Warmer and less bright than ordinary pink noise."),
    Spec("proc_low_felt_resonance_a", "Low Felt Resonance A", "texture", "low_texture", ("sleep", "calm"), "low_resonance", 260713, -31.0, 950, 38, 0.98, 0.012, 137, "Very low soft resonance with no phrase and no pulse."),
    Spec("proc_low_felt_resonance_b", "Low Felt Resonance B", "texture", "low_texture", ("sleep", "calm"), "low_resonance", 260714, -32.0, 780, 35, 1.00, 0.010, 157, "Darker low resonance for sleep support."),
    Spec("proc_dark_granular_smooth_a", "Dark Granular Smooth A", "texture", "tonal_texture", ("sleep", "calm"), "granular_smooth", 260715, -31.0, 1400, 55, 0.90, 0.012, 173, "Fused microscopic particles, no sparkle and no rhythmic grain."),
    Spec("proc_dark_granular_smooth_b", "Dark Granular Smooth B", "texture", "tonal_texture", ("sleep", "calm"), "granular_smooth", 260716, -32.0, 1100, 50, 0.96, 0.010, 193, "Darker granular cloud, background only."),
    Spec("proc_soft_bowl_tail_a", "Soft Bowl Tail A", "accent", "one_shot_accent", ("sleep", "calm"), "soft_bowl_tail", 260717, -34.0, 1900, 80, 0.86, 0.0, 0, "Single soft low bowl tail, for rare transitions only."),
    Spec("proc_soft_bowl_tail_b", "Soft Bowl Tail B", "accent", "one_shot_accent", ("sleep", "calm"), "soft_bowl_tail", 260718, -35.0, 1500, 70, 0.94, 0.0, 0, "Darker single bowl tail, no sequence."),
)


def t() -> np.ndarray:
    return np.arange(int(RATE * DURATION), dtype=np.float64) / RATE


def colored_noise(rng: np.random.Generator, color: float) -> np.ndarray:
    samples = int(RATE * DURATION)
    freqs = np.fft.rfftfreq(samples, 1 / RATE)
    spectrum = rng.normal(size=len(freqs)) + 1j * rng.normal(size=len(freqs))
    scale = 1 / np.maximum(freqs, 1.0) ** color
    scale[0] = 0
    noise = np.fft.irfft(spectrum * scale, samples)
    noise = noise / (np.max(np.abs(noise)) + 1e-12)
    return noise


def smooth_random_envelope(rng: np.random.Generator, depth: float, step_seconds: float) -> np.ndarray:
    samples = int(RATE * DURATION)
    if depth <= 0:
        return np.ones(samples)
    steps = max(4, int(math.ceil(DURATION / step_seconds)) + 2)
    points = 1 + rng.uniform(-depth, depth, steps)
    x = np.linspace(0, samples - 1, steps)
    env = np.interp(np.arange(samples), x, points)
    b, a = signal.butter(2, 0.08, btype="low")
    env = signal.filtfilt(b, a, env)
    return np.clip(env, 1 - depth, 1 + depth)


def bandlimit(audio: np.ndarray, highpass_hz: float, lowpass_hz: float) -> np.ndarray:
    sos = signal.butter(4, [highpass_hz, lowpass_hz], btype="bandpass", fs=RATE, output="sos")
    return signal.sosfiltfilt(sos, audio)


def fade(audio: np.ndarray, seconds: float = 6.0) -> np.ndarray:
    n = min(len(audio) // 2, int(seconds * RATE))
    curve = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
    out = audio.copy()
    out[:n] *= curve[:, None]
    out[-n:] *= curve[::-1, None]
    return out


def normalize(audio: np.ndarray, target_lufs: float, peak_db: float) -> np.ndarray:
    meter = pyln.Meter(RATE)
    loudness = meter.integrated_loudness(audio)
    if math.isfinite(loudness):
        audio *= 10 ** ((target_lufs - loudness) / 20)
    ceiling = 10 ** (peak_db / 20)
    peak = np.max(np.abs(audio)) + 1e-12
    if peak > ceiling:
        audio *= ceiling / peak
    return audio.astype(np.float32)


def stereoize(mono: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    delay = int(rng.integers(int(RATE * 0.007), int(RATE * 0.019)))
    right = np.roll(mono, delay)
    right[:delay] = right[delay]
    return np.stack([mono * 0.98, right * 0.98], axis=1)


def render(spec: Spec) -> np.ndarray:
    rng = np.random.default_rng(spec.seed)
    time = t()
    if spec.generator == "blurred_ocean":
        base = 0.82 * colored_noise(rng, 1.0) + 0.18 * colored_noise(rng, 0.5)
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)
    elif spec.generator == "muffled_rain":
        base = 0.62 * colored_noise(rng, 0.35) + 0.38 * colored_noise(rng, 0.85)
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)
    elif spec.generator == "colored_noise":
        base = colored_noise(rng, spec.warmth)
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)
    elif spec.generator == "low_resonance":
        base = 0.60 * np.sin(2 * np.pi * 72.0 * time + rng.uniform(0, 2 * np.pi))
        base += 0.28 * np.sin(2 * np.pi * 108.0 * time + rng.uniform(0, 2 * np.pi))
        base += 0.12 * colored_noise(rng, 1.2)
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)
    elif spec.generator == "granular_smooth":
        base = colored_noise(rng, 0.95)
        base += 0.10 * np.sin(2 * np.pi * 146.83 * time + rng.uniform(0, 2 * np.pi))
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)
    elif spec.generator == "soft_bowl_tail":
        base = np.zeros_like(time)
        start = int(RATE * 2.0)
        local = time[: len(time) - start]
        freq = 180 if spec.candidate_id.endswith("_a") else 136
        tail = np.exp(-local / 13.5) * (
            0.75 * np.sin(2 * np.pi * freq * local)
            + 0.20 * np.sin(2 * np.pi * freq * 2.01 * local)
            + 0.08 * np.sin(2 * np.pi * freq * 2.98 * local)
        )
        tail[: int(RATE * 0.08)] *= np.sin(np.linspace(0, np.pi / 2, int(RATE * 0.08))) ** 2
        base[start:] = tail
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)
    else:
        base = colored_noise(rng, 0.8)
        base = bandlimit(base, spec.highpass_hz, spec.lowpass_hz)

    if spec.generator != "soft_bowl_tail":
        base *= smooth_random_envelope(rng, spec.motion_depth, spec.motion_seconds)
    audio = stereoize(base / (np.max(np.abs(base)) + 1e-12), rng)
    return normalize(fade(audio, 6.0 if spec.generator != "soft_bowl_tail" else 0.5), spec.target_lufs, -8.0)


def analyze(audio: np.ndarray, category: str) -> dict:
    mono = np.mean(audio, axis=1)
    hop = 512
    y = librosa.resample(mono, orig_sr=RATE, target_sr=22_050)
    onset_env = librosa.onset.onset_strength(y=y, sr=22_050, hop_length=hop)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=22_050, hop_length=hop)
    centroid = librosa.feature.spectral_centroid(y=y, sr=22_050, hop_length=hop)[0]
    macro_window = int(RATE * 0.5)
    usable = mono[: len(mono) - (len(mono) % macro_window)]
    macro_frames = usable.reshape(-1, macro_window)
    macro_rms = np.sqrt(np.mean(macro_frames * macro_frames, axis=1) + 1e-12)
    macro_db = 20 * np.log10(macro_rms + 1e-12)
    edge_frames = min(16, max(0, len(macro_db) // 4))
    interior_db = macro_db[edge_frames:-edge_frames] if len(macro_db) > edge_frames * 2 + 2 else macro_db
    jumps = np.abs(np.diff(interior_db))
    macro_events = int(np.sum(jumps > 0.85))
    event_count = int(len(onset_frames)) if category == "accent" else macro_events
    meter = pyln.Meter(RATE)
    return {
        "durationSeconds": round(len(audio) / RATE, 3),
        "sampleRate": RATE,
        "channels": 2,
        "integratedLufs": round(float(meter.integrated_loudness(audio)), 2),
        "samplePeakDbfs": round(20 * math.log10(float(np.max(np.abs(audio))) + 1e-12), 2),
        "rawLibrosaOnsetCount": int(len(onset_frames)),
        "onsetCount": event_count,
        "onsetDensityPerSecond": round(float(event_count) / DURATION, 4),
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "maxRmsJumpDb": round(float(np.max(jumps)) if len(jumps) else 0.0, 2),
        "p99RmsJumpDb": round(float(np.percentile(jumps, 99)) if len(jumps) else 0.0, 2),
        "eventMetric": "accent_librosa_onset_count_else_interior_500ms_rms_jump_over_0.85db",
        "humanVoiceProbability": "not_applicable_deterministic_no_voice_source",
        "drumProbability": "not_applicable_deterministic_no_percussion_source",
    }


def hard_failures(spec: Spec, analysis: dict) -> list[str]:
    failures: list[str] = []
    if analysis["durationSeconds"] != 60.0:
        failures.append("duration_not_60s")
    if analysis["samplePeakDbfs"] > -6.0:
        failures.append("peak_above_minus_6_dbfs")
    if spec.category in ("environment", "texture") and analysis["onsetDensityPerSecond"] > 0.75:
        failures.append("event_density_too_high_for_soothing_foundation")
    if spec.category == "accent" and analysis["onsetCount"] > 2:
        failures.append("accent_has_more_than_one_possible_onset")
    if spec.category == "environment" and analysis["spectralCentroidHz"] > 1800:
        failures.append("environment_too_bright")
    if spec.category == "texture" and analysis["spectralCentroidHz"] > 1500:
        failures.append("texture_too_bright")
    if spec.category == "accent" and analysis["spectralCentroidHz"] > 1900:
        failures.append("accent_too_bright")
    if spec.category != "accent" and analysis["p99RmsJumpDb"] > 1.6:
        failures.append("rms_jumps_too_large")
    return failures


def mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "256k", str(mp3_path)],
        cwd=ROOT,
        check=True,
    )


def html(results: list[dict]) -> str:
    groups = []
    for category in ("environment", "texture", "accent"):
        cards = []
        for item in [r for r in results if r["category"] == category]:
            cards.append(f"""
<article>
  <p class="family">{item["role"]}</p>
  <h3>{item["title"]}</h3>
  <p class="meta">{item["candidateId"]} · {item["analysis"]["integratedLufs"]} LUFS · onset {item["analysis"]["onsetDensityPerSecond"]}/s · centroid {item["analysis"]["spectralCentroidHz"]} Hz · {item["machineStatus"]}</p>
  <audio controls preload="metadata" src="{item["preparedAudioUrl"]}"></audio>
  <p class="notes">{item["notes"]}</p>
  <div class="fields">
    <label>舒缓度<select data-key="{item["candidateId"]}:soothing"><option value="">未判断</option><option value="pass">舒缓</option><option value="borderline">一般</option><option value="fail">不舒缓</option></select></label>
    <label>鼓点/脉冲<select data-key="{item["candidateId"]}:pulse"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label>
    <label>长期疲劳<select data-key="{item["candidateId"]}:fatigue"><option value="">未判断</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
    <label>结论<select data-key="{item["candidateId"]}:decision"><option value="">待审核</option><option value="pass">通过</option><option value="retry">微调</option><option value="fail">淘汰</option></select></label>
    <label>记录<textarea data-key="{item["candidateId"]}:notes" rows="3"></textarea></label>
  </div>
</article>""")
        groups.append(f"<section><p class=\"eyebrow\">{category}</p><h2>{category} · {len(cards)} candidates</h2><div class=\"grid\">{''.join(cards)}</div></section>")
    return f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>确定性舒缓基础元素 V1</title><style>:root{{color-scheme:dark;--bg:#101311;--panel:#181d19;--line:#39453c;--text:#f2f4f1;--muted:#aab4ac;--accent:#dfc77c;--warn:#e5a19a}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:1240px;margin:auto;padding:28px 18px 80px}}header,section{{padding:24px 0;border-bottom:1px solid var(--line)}}h1{{font-size:30px;margin:7px 0}}h2{{font-size:22px}}h3{{font-size:17px;margin:2px 0}}.eyebrow,.family{{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}}.intro,.meta,.notes,summary{{color:var(--muted);line-height:1.5}}.warning{{color:var(--warn)}}.grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}}article{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:13px;min-width:0}}.meta{{font-size:11px}}audio{{width:100%;height:40px}}.fields{{display:grid;gap:8px;margin-top:10px}}label{{display:grid;gap:4px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid var(--line);border-radius:4px;background:#121613;color:var(--text);padding:8px;font:inherit}}button{{border:0;border-radius:5px;background:var(--accent);color:#171811;padding:10px 14px;font-weight:700;cursor:pointer}}@media(max-width:900px){{.grid{{grid-template-columns:1fr}}}}</style></head><body><main><header><p class="eyebrow">NO-DRUM DETERMINISTIC FOUNDATION</p><h1>确定性舒缓基础元素 V1 · 试听</h1><p class="intro">这批不是成品曲，也不是 Lyria 混合音乐片段；它是可组合的底层元素。全部由确定性 DSP 生成，目标是低事件密度、低亮度、无人声、无鼓点、无节拍、可循环。</p><p class="warning">仍是内部候选：机器通过不等于内容通过。请重点听是否有鼓点感、脉冲感、刺耳高频、疲劳、机械循环。</p><button id="export">导出审核结果</button></header>{''.join(groups)}</main><script>const key='snooze-soothing-deterministic-foundation-v1-review';const state=JSON.parse(localStorage.getItem(key)||'{{}}');document.querySelectorAll('[data-key]').forEach(input=>{{input.value=state[input.dataset.key]||'';const save=()=>{{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))}};input.addEventListener('change',save);input.addEventListener('input',save)}});document.getElementById('export').addEventListener('click',()=>{{const payload={{schemaVersion:'1.0.0',batchId:'{BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}}));const a=document.createElement('a');a.href=url;a.download='{BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}});</script></body></html>"""


def main() -> None:
    require_tools()
    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)

    results = []
    for spec in SPECS:
        wav_path = MASTER_DIR / f"{spec.candidate_id}.wav"
        mp3_path = PREVIEW_DIR / f"{spec.candidate_id}.mp3"
        audio = render(spec)
        sf.write(wav_path, audio, RATE, subtype="PCM_24")
        mp3(wav_path, mp3_path)
        analysis = analyze(audio, spec.category)
        failures = hard_failures(spec, analysis)
        results.append({
            "candidateId": spec.candidate_id,
            "title": spec.title,
            "category": spec.category,
            "role": spec.role,
            "goals": list(spec.goals),
            "source": "deterministic_dsp",
            "generator": spec.generator,
            "productionAllowed": False,
            "masterAudioPath": str(wav_path.relative_to(ROOT)),
            "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
            "notes": spec.notes,
            "analysis": analysis,
            "machineStatus": "pass" if not failures else "fail",
            "failures": failures,
        })

    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "candidate_pending_human_soothing_review",
        "productionAllowed": False,
        "purpose": "Controlled soothing foundational elements for Sleep, Calm, and low-arousal Focus; not finished songs.",
        "hardExclusions": ["drums", "percussion", "beat", "rhythmic pulse", "groove", "kick", "snare", "hi-hat", "tabla", "singing", "human voice", "human-like vocal texture", "medical claims"],
        "candidateCount": len(results),
        "machinePassCount": sum(1 for item in results if item["machineStatus"] == "pass"),
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "candidates": results,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    REPORT_JSON_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    rows = [
        f'| `{item["candidateId"]}` | {item["category"]} | {item["analysis"]["integratedLufs"]} | {item["analysis"]["samplePeakDbfs"]} | {item["analysis"]["onsetDensityPerSecond"]} | {item["analysis"]["spectralCentroidHz"]} | {item["machineStatus"]} | [试听]({item["preparedAudioUrl"]}) |'
        for item in results
    ]
    REPORT_MD_PATH.write_text(
        f"# Soothing Deterministic Foundation V1 Machine QA\n\n"
        f"Batch: `{BATCH_ID}`  \n"
        f"Status: candidate-only; production promotion is blocked until human soothing and loop review pass.  \n"
        f"Rule: no drums, no percussion, no beat, no rhythmic pulse, no groove, no voice, no medical claims.\n\n"
        f"| Candidate | Category | LUFS | Peak dBFS | Onset/s | Centroid Hz | Machine | Preview |\n"
        f"| --- | --- | ---: | ---: | ---: | ---: | --- | --- |\n"
        + "\n".join(rows)
        + "\n\n## Listening Gate\n\nReject any candidate that feels like a beat, pulse, groove, melody hook, machinery cycle, bright sparkle, human-like voice, or tiring loop.\n",
        encoding="utf-8",
    )
    (REVIEW_DIR / "index.html").write_text(html(results), encoding="utf-8")
    print(json.dumps({
        "batchId": BATCH_ID,
        "candidateCount": manifest["candidateCount"],
        "machinePassCount": manifest["machinePassCount"],
        "manifest": str(MANIFEST_PATH.relative_to(ROOT)),
        "reviewUrl": manifest["reviewUrl"],
        "productionAllowed": False,
    }, indent=2))


if __name__ == "__main__":
    main()
