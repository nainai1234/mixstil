#!/usr/bin/env python3
"""Generate Batch 007 structured original soundscape foundations.

This batch is intentionally not a music-sourcing batch.  It creates deterministic
procedural stems and finished preview mixes so listening feedback can be about
bottom-level sound architecture: body, breath/motion, space, and focus energy.
"""

from __future__ import annotations

import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
from scipy.io import wavfile


ROOT = Path.cwd()
RATE = 48_000
DURATION_SECONDS = 180
STEM_DIR = ROOT / "public/audio/content-foundation/batch-007"
MIX_DIR = ROOT / "public/audio/content-baseline/batch-007"
REVIEW_DIR = ROOT / "public/review/content-baseline-batch-007"
MANIFEST_PATH = ROOT / "data/content-baseline/content-baseline-batch-007-manifest.json"


def ensure_tools() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise RuntimeError(f"Missing required tool: {tool}")


def timebase() -> np.ndarray:
    return np.arange(RATE * DURATION_SECONDS, dtype=np.float64) / RATE


def low_smooth_noise(rng: np.random.Generator, samples: int, passes: int = 9) -> np.ndarray:
    noise = rng.normal(0, 1, samples)
    kernel = np.ones(31) / 31
    for _ in range(passes):
        noise = np.convolve(noise, kernel, mode="same")
    peak = np.max(np.abs(noise)) or 1
    return noise / peak


def sine_with_drift(t: np.ndarray, freq: float, phase: float, drift: float = 0.00045) -> np.ndarray:
    warped = t + (drift * np.sin(2 * np.pi * t / 37 + phase))
    return np.sin(2 * np.pi * freq * warped + phase)


def breath_env(t: np.ndarray, period: float, depth: float, phase: float = 0) -> np.ndarray:
    return 1.0 + depth * np.sin(2 * np.pi * t / period + phase)


def fade(audio: np.ndarray, seconds: float = 7.0) -> np.ndarray:
    out = audio.copy()
    n = int(RATE * seconds)
    curve = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
    out[:n] *= curve[:, None]
    out[-n:] *= curve[::-1, None]
    return out


def normalize_lufs(audio: np.ndarray, target_lufs: float, peak_db: float = -8.5) -> np.ndarray:
    meter = pyln.Meter(RATE)
    loudness = meter.integrated_loudness(audio)
    if math.isfinite(loudness):
        audio = audio * (10 ** ((target_lufs - loudness) / 20))
    ceiling = 10 ** (peak_db / 20)
    peak = float(np.max(np.abs(audio))) or 1
    if peak > ceiling:
        audio = audio * (ceiling / peak)
    return audio.astype(np.float32)


@dataclass(frozen=True)
class StemSpec:
    stem_id: str
    title: str
    role: str
    goal: str
    family: str
    target_lufs: float
    seed: int
    tones: tuple[tuple[float, float], ...]
    motion_period: float
    motion_depth: float
    low_noise: float = 0.0
    notes: str = ""


def render_stem(spec: StemSpec) -> np.ndarray:
    rng = np.random.default_rng(spec.seed)
    t = timebase()
    channels: list[np.ndarray] = []
    for channel in range(2):
        signal = np.zeros_like(t)
        side = -1 if channel == 0 else 1
        for index, (freq, amp) in enumerate(spec.tones):
            phase = rng.uniform(0, 2 * np.pi)
            detune = 1 + side * (0.00022 + index * 0.00006)
            tone = sine_with_drift(t, freq * detune, phase)
            tone += 0.085 * sine_with_drift(t, freq * 2 * detune, phase / 2, drift=0.0002)
            tone += 0.024 * sine_with_drift(t, freq * 3 * detune, phase / 3, drift=0.00015)
            signal += amp * breath_env(t, spec.motion_period + index * 9, spec.motion_depth, phase) * tone
        if spec.low_noise:
            signal += spec.low_noise * low_smooth_noise(rng, len(t), passes=12)
        channels.append(signal)
    return normalize_lufs(fade(np.stack(channels, axis=1)), spec.target_lufs)


STEMS = [
    StemSpec(
        "b007_sleep_sub_body_a",
        "Sleep Sub Body A",
        "low_frequency_body",
        "sleep",
        "dark_non_melodic_sleep",
        -28.0,
        90701,
        ((55.0, 0.62), (82.41, 0.22), (110.0, 0.10), (164.81, 0.045)),
        42,
        0.020,
        0.002,
        "Dark, slow, non-celebratory body. Intended to be felt more than followed.",
    ),
    StemSpec(
        "b007_sleep_warm_night_air_a",
        "Sleep Warm Night Air A",
        "dark_air_and_blanket_layer",
        "sleep",
        "low_event_sleep_air",
        -30.0,
        90702,
        ((73.42, 0.38), (98.0, 0.15), (146.83, 0.09), (220.0, 0.025)),
        58,
        0.026,
        0.003,
        "Barely moving air layer; not white noise and not a room recording.",
    ),
    StemSpec(
        "b007_calm_breathing_harmonic_a",
        "Calm Breathing Harmonic A",
        "breathing_harmonic_body",
        "calm",
        "warm_breathing_space",
        -27.0,
        90703,
        ((87.31, 0.44), (130.81, 0.18), (174.61, 0.13), (261.63, 0.040)),
        15,
        0.055,
        0.0012,
        "Audible slow inhale/exhale movement created by harmony, not hiss.",
    ),
    StemSpec(
        "b007_calm_open_room_color_a",
        "Calm Open Room Color A",
        "soft_spatial_color",
        "calm",
        "open_room_meditation",
        -30.0,
        90704,
        ((98.0, 0.34), (146.83, 0.16), (196.0, 0.12), (293.66, 0.035)),
        31,
        0.038,
        0.001,
        "Wide, warm spatial color for calm mixes; avoids foreground melody.",
    ),
    StemSpec(
        "b007_focus_clean_pulse_a",
        "Focus Clean Pulse A",
        "low_distraction_work_pulse",
        "focus",
        "clean_harmonic_focus",
        -26.0,
        90705,
        ((110.0, 0.36), (165.0, 0.17), (220.0, 0.11), (330.0, 0.025)),
        8,
        0.032,
        0.0005,
        "Very restrained tonal work pulse. No noise mask, traffic, fan, or beat.",
    ),
    StemSpec(
        "b007_focus_low_anchor_a",
        "Focus Low Anchor A",
        "steady_low_focus_anchor",
        "focus",
        "clean_harmonic_focus",
        -28.5,
        90706,
        ((82.41, 0.42), (123.47, 0.16), (164.81, 0.10), (246.94, 0.024)),
        23,
        0.020,
        0.0006,
        "Stable low anchor so focus does not become white/pink/brown noise.",
    ),
]


MIXES = [
    {
        "id": "sleep_012_sub_blanket_descent",
        "title": "Sub-Blanket Descent",
        "goal": "sleep",
        "scene": "bedtime_sleep",
        "question": "Does this feel bottom-level and sleep-safe without sounding festive, pretty, or like a song?",
        "structure": "low body is present immediately -> warm night air slowly grows -> upper detail fades -> stable dark blanket remains",
        "layers": [
            ("b007_sleep_sub_body_a", 1.00),
            ("b007_sleep_warm_night_air_a", 0.78),
        ],
    },
    {
        "id": "sleep_013_return_to_sleep_floor",
        "title": "Return-to-Sleep Floor",
        "goal": "sleep",
        "scene": "return_to_sleep",
        "question": "Can this sit under a half-awake state without creating emotional brightness or narrative attention?",
        "structure": "lower, flatter variant; less air and more body than the bedtime version",
        "layers": [
            ("b007_sleep_sub_body_a", 1.08),
            ("b007_sleep_warm_night_air_a", 0.48),
        ],
    },
    {
        "id": "calm_009_breathing_room_foundation",
        "title": "Breathing Room Foundation",
        "goal": "calm",
        "scene": "quiet_relaxation",
        "question": "Does this feel intentional and breathable while still staying below foreground music?",
        "structure": "warm breath cycle leads -> open room color widens -> no bell/event payoff",
        "layers": [
            ("b007_calm_breathing_harmonic_a", 0.96),
            ("b007_calm_open_room_color_a", 0.72),
        ],
    },
    {
        "id": "focus_012_clean_underwork_engine",
        "title": "Clean Underwork Engine",
        "goal": "focus",
        "scene": "deep_work",
        "question": "Can this support work without becoming a noise wall or a track that asks to be listened to?",
        "structure": "clean tonal pulse -> low anchor underneath -> minimal spectral movement only",
        "layers": [
            ("b007_focus_clean_pulse_a", 0.92),
            ("b007_focus_low_anchor_a", 0.82),
        ],
    },
]


def write_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(path, RATE, audio)


def to_mp3(wav_path: Path, mp3_path: Path) -> None:
    mp3_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(wav_path),
            "-ar",
            "48000",
            "-ac",
            "2",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "192k",
            str(mp3_path),
        ],
        check=True,
    )
    wav_path.unlink()


def probe(path: Path) -> dict[str, float | int]:
    raw = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", str(path)],
        text=True,
    )
    data = json.loads(raw)["format"]
    return {"durationSeconds": float(data["duration"]), "sizeBytes": int(data["size"])}


def render_all() -> dict:
    ensure_tools()
    stem_audio: dict[str, np.ndarray] = {}
    stem_records = []
    for spec in STEMS:
        audio = render_stem(spec)
        stem_audio[spec.stem_id] = audio
        wav_path = STEM_DIR / f"{spec.stem_id}.wav"
        mp3_path = STEM_DIR / f"{spec.stem_id}.mp3"
        write_wav(wav_path, audio)
        to_mp3(wav_path, mp3_path)
        stem_records.append(
            {
                "id": spec.stem_id,
                "title": spec.title,
                "role": spec.role,
                "goal": spec.goal,
                "family": spec.family,
                "outputPath": str(mp3_path.relative_to(ROOT)),
                "outputUrl": f"/{mp3_path.relative_to(ROOT / 'public')}",
                "license": "project_original_procedural_generation",
                "commercialUseAllowed": True,
                "derivativeUseAllowed": True,
                "humanVoice": False,
                "notes": spec.notes,
                "probe": probe(mp3_path),
            }
        )

    candidates = []
    for mix in MIXES:
        audio = np.zeros((RATE * DURATION_SECONDS, 2), dtype=np.float64)
        for stem_id, gain in mix["layers"]:
            audio += stem_audio[stem_id] * gain
        audio = normalize_lufs(fade(audio), -25.8 if mix["goal"] == "focus" else -27.0, peak_db=-7.5)
        wav_path = MIX_DIR / f"{mix['id']}.wav"
        mp3_path = MIX_DIR / f"{mix['id']}.mp3"
        write_wav(wav_path, audio)
        to_mp3(wav_path, mp3_path)
        candidates.append(
            {
                **mix,
                "previewDurationSeconds": DURATION_SECONDS,
                "outputPath": str(mp3_path.relative_to(ROOT)),
                "outputUrl": f"/{mp3_path.relative_to(ROOT / 'public')}",
                "productionStatus": "candidate_preview",
                "sourcePolicy": "fully_original_structured_procedural_stems",
                "rejectedPatterns": [
                    "third-party music as the main identity",
                    "cheerful, festive, bright, cute, romantic, or narrative sleep music",
                    "white/pink/brown noise wall used as focus identity",
                    "audible human voice, humming, chanting, crowd, or speech",
                ],
                "probe": probe(mp3_path),
            }
        )
    return {"stems": stem_records, "candidates": candidates}


def write_review(manifest: dict) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for index, item in enumerate(manifest["candidates"], 1):
        src = f"../../{item['outputUrl'].lstrip('/')}"
        layer_lines = "<br />".join(f"{stem_id} × {gain}" for stem_id, gain in item["layers"])
        cards.append(
            f"""
      <article class="card">
        <div class="meta">#{index:02d} · {item['goal'].upper()} · {item['scene']}</div>
        <h2>{item['title']}</h2>
        <audio controls preload="metadata" src="{src}"></audio>
        <p><strong>验证问题：</strong>{item['question']}</p>
        <p><strong>结构：</strong>{item['structure']}</p>
        <p class="sources"><strong>底层 stem：</strong><br />{layer_lines}</p>
      </article>"""
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SNOOZE Content Baseline Batch 007</title>
    <style>
      body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #06080c; color: #f7eee4; }}
      main {{ max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }}
      h1 {{ font-size: 28px; margin: 0 0 8px; }}
      .lead {{ color: #d7c8b9; line-height: 1.6; margin-bottom: 20px; border-left: 3px solid #b8d89a; padding-left: 12px; }}
      .grid {{ display: grid; gap: 14px; }}
      .card {{ border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 16px; background: rgba(255,255,255,.052); }}
      .meta {{ color: #b8d89a; font-size: 12px; letter-spacing: .04em; }}
      h2 {{ font-size: 19px; margin: 6px 0 12px; }}
      audio {{ width: 100%; }}
      p {{ color: #d7c8b9; line-height: 1.5; margin: 10px 0 0; }}
      strong {{ color: #fff0c2; }}
      .sources {{ color: #a9b5c7; font-size: 12px; }}
    </style>
  </head>
  <body>
    <main>
      <h1>Content Baseline Batch 007</h1>
      <p class="lead">这批是原创结构化底层素材测试：不用第三方音乐，不用白噪/粉噪/交通/风扇当主体。每条都由项目内确定性生成的 foundation stems 组合，重点验证“底层身体感、呼吸式运动、空间色彩、专注支撑”是否成立。</p>
      <div class="grid">
{''.join(cards)}
      </div>
    </main>
  </body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf8")


def main() -> None:
    rendered = render_all()
    manifest = {
        "version": "2026-07-16.batch-007-original-structured-foundations",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "Respond to listening feedback that Batch 006 is acceptable but not bottom-level enough by creating original procedural foundation stems and finished previews.",
        "hardGates": [
            "No third-party music source in Batch 007 foundation stems.",
            "No audible human voice, speech, humming, chanting, crowd, or vocal texture.",
            "Sleep must be dark, slow, and non-celebratory.",
            "Focus must not be perceived as white noise, traffic, fan, or harsh masking.",
            "Every candidate must expose explicit stem roles so Recipe V2 can later select and refine structure.",
        ],
        "selection": {
            "stems": len(rendered["stems"]),
            "sleep": sum(1 for item in rendered["candidates"] if item["goal"] == "sleep"),
            "calm": sum(1 for item in rendered["candidates"] if item["goal"] == "calm"),
            "focus": sum(1 for item in rendered["candidates"] if item["goal"] == "focus"),
        },
        "stems": rendered["stems"],
        "candidates": rendered["candidates"],
        "reviewPage": "/review/content-baseline-batch-007/index.html",
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    write_review(manifest)
    print(json.dumps({"passed": True, "manifest": str(MANIFEST_PATH.relative_to(ROOT)), "reviewPage": manifest["reviewPage"]}, indent=2))


if __name__ == "__main__":
    main()
