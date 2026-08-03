#!/usr/bin/env python3
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-001"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-001"
SR = 44100
DURATION = 72.0


def db_to_amp(db):
    return 10 ** (db / 20)


def fade(signal, fade_in=3.0, fade_out=6.0):
    result = signal.copy()
    n = len(result)
    fi = min(n, int(fade_in * SR))
    fo = min(n, int(fade_out * SR))
    if fi:
        curve = np.linspace(0, 1, fi) ** 1.6
        result[:fi] *= curve[:, None] if result.ndim == 2 else curve
    if fo:
        curve = np.linspace(1, 0, fo) ** 1.8
        result[-fo:] *= curve[:, None] if result.ndim == 2 else curve
    return result


def lowpass(signal, cutoff=3800, order=3):
    sos = butter(order, cutoff, btype="lowpass", fs=SR, output="sos")
    return sosfiltfilt(sos, signal)


def highpass(signal, cutoff=55, order=2):
    sos = butter(order, cutoff, btype="highpass", fs=SR, output="sos")
    return sosfiltfilt(sos, signal)


def note_freq(name):
    table = {
        "C3": 130.8128,
        "E3": 164.8138,
        "G3": 195.9977,
        "A3": 220.0,
        "C4": 261.6256,
        "D4": 293.6648,
        "E4": 329.6276,
        "G4": 391.9954,
    }
    return table[name]


def electric_piano_note(freq, start, length, velocity=0.55):
    n = int(length * SR)
    t = np.arange(n) / SR
    attack = int(0.055 * SR)
    decay = np.exp(-t / (length * 0.42))
    env = decay
    if attack > 0:
        env[:attack] *= np.linspace(0, 1, attack) ** 1.8
    # Rhodes-like soft partials, deliberately low-passable and non-bright.
    sig = (
        1.0 * np.sin(2 * np.pi * freq * t)
        + 0.36 * np.sin(2 * np.pi * freq * 2.01 * t + 0.2)
        + 0.14 * np.sin(2 * np.pi * freq * 3.0 * t + 1.1)
        + 0.05 * np.sin(2 * np.pi * freq * 4.02 * t + 1.7)
    )
    # Tiny pitch settling prevents a sterile sine/buzz feeling.
    settle = 1 + 0.002 * np.exp(-t / 1.8) * np.sin(2 * np.pi * 0.7 * t)
    sig *= settle
    sig = lowpass(sig, cutoff=2600)
    sig *= env * velocity * 0.12
    out = np.zeros(int(DURATION * SR))
    offset = int(start * SR)
    end = min(len(out), offset + len(sig))
    out[offset:end] += sig[: end - offset]
    return out


def sparse_keys(pattern, gain_db=-21):
    out = np.zeros(int(DURATION * SR))
    for start, notes, length, velocity in pattern:
        for idx, note in enumerate(notes):
            out += electric_piano_note(note_freq(note), start + idx * 0.09, length, velocity)
    out = highpass(lowpass(out, 3000), 70)
    out = fade(out, 2.0, 8.0)
    peak = max(np.max(np.abs(out)), 1e-9)
    out = out / peak * db_to_amp(gain_db)
    return stereo(out)


def warm_support(gain_db=-34):
    n = int(DURATION * SR)
    t = np.arange(n) / SR
    freqs = [note_freq("C3"), note_freq("G3"), note_freq("C4")]
    out = np.zeros(n)
    for i, f in enumerate(freqs):
        slow = 1 + 0.004 * np.sin(2 * np.pi * (0.018 + i * 0.006) * t + i)
        out += (0.45 / (i + 1)) * np.sin(2 * np.pi * f * slow * t + i * 0.7)
    lfo = 0.78 + 0.22 * np.sin(2 * np.pi * 0.012 * t + 0.4)
    out *= lfo
    out = lowpass(highpass(out, 80), 1200)
    out = fade(out, 9.0, 12.0)
    out = out / max(np.max(np.abs(out)), 1e-9) * db_to_amp(gain_db)
    return stereo(out)


def organic_room(gain_db=-38, seed=1001):
    rng = np.random.default_rng(seed)
    n = int(DURATION * SR)
    white = rng.normal(0, 1, n)
    # Soft brown-ish movement, not hiss-led white noise.
    brown = np.cumsum(white)
    brown -= np.mean(brown)
    brown /= max(np.max(np.abs(brown)), 1e-9)
    brown = lowpass(highpass(brown, 120), 2200)
    t = np.arange(n) / SR
    motion = 0.68 + 0.32 * np.sin(2 * np.pi * 0.021 * t + 0.8)
    out = fade(brown * motion, 7.0, 10.0)
    out = out / max(np.max(np.abs(out)), 1e-9) * db_to_amp(gain_db)
    return stereo(out)


def stereo(mono):
    delay = int(0.013 * SR)
    right = np.roll(mono, delay) * 0.92
    right[:delay] = 0
    return np.stack([mono, right], axis=1)


def mix(parts, gain_db=-18):
    out = np.zeros((int(DURATION * SR), 2))
    for audio, db in parts:
        out += audio * db_to_amp(db)
    out = fade(out, 2.0, 10.0)
    peak = max(np.max(np.abs(out)), 1e-9)
    out = out / peak * db_to_amp(gain_db)
    return out


def metrics(audio):
    mono = audio.mean(axis=1) if audio.ndim == 2 else audio
    peak = float(np.max(np.abs(mono)))
    rms = float(np.sqrt(np.mean(mono**2)))
    crest = 20 * math.log10((peak + 1e-9) / (rms + 1e-9))
    frame = int(0.1 * SR)
    energy = np.array([np.sqrt(np.mean(mono[i : i + frame] ** 2)) for i in range(0, len(mono) - frame, frame)])
    jumps = np.diff(20 * np.log10(energy + 1e-9))
    onset_like = int(np.sum(jumps > 4.5))
    return {
        "durationSeconds": round(len(mono) / SR, 2),
        "peakDbfs": round(20 * math.log10(peak + 1e-9), 2),
        "rmsDbfs": round(20 * math.log10(rms + 1e-9), 2),
        "crestDb": round(crest, 2),
        "onsetLikeJumpsOver4_5Db": onset_like,
    }


def write_audio(name, audio):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wav = OUT_DIR / f"{name}.wav"
    mp3 = OUT_DIR / f"{name}.mp3"
    sf.write(wav, audio, SR, subtype="PCM_24")
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)],
        check=True,
    )
    return wav, mp3


def html_escape(value):
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(
            f"""
      <article class="card">
        <p class="eyebrow">{html_escape(item['type'])} · {html_escape(item['goal'])}</p>
        <h2>{html_escape(item['title'])}</h2>
        <audio controls preload="metadata" src="{html_escape(item['reviewPath'])}"></audio>
        <p>{html_escape(item['intent'])}</p>
        <details>
          <summary>Production note / QA</summary>
          <pre>{html_escape(json.dumps(item['metrics'], indent=2))}</pre>
          <p>{html_escape(item['productionNote'])}</p>
        </details>
      </article>
            """
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Controlled Stem Factory 001</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101312; color: #eef4ee; }}
    main {{ max-width: 960px; margin: 0 auto; padding: 32px 18px 60px; }}
    .hero {{ border: 1px solid rgba(255,255,255,.12); border-radius: 28px; padding: 24px; background: linear-gradient(135deg, rgba(177,151,105,.16), rgba(92,117,98,.12)); }}
    .card {{ margin-top: 18px; border: 1px solid rgba(255,255,255,.12); border-radius: 22px; padding: 18px; background: rgba(255,255,255,.045); }}
    .eyebrow {{ color: #b8c7b7; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }}
    audio {{ width: 100%; margin: 10px 0 8px; }}
    pre {{ white-space: pre-wrap; color: #d9e5d9; }}
    summary {{ cursor: pointer; color: #d6c096; }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE content route reset</p>
      <h1>Controlled Stem Factory 001</h1>
      <p>这不是 AI 歌曲生成批次，而是第一版自有、可控、低密度素材工厂。目标是验证：少量干净 stem 是否比“模型直接生成一首歌”更接近睡眠、冥想和专注。</p>
      <p>听的时候重点判断：是否还有酒吧感、摇滚感、蜂鸣机械感、兴奋感；以及这些素材作为底层 music bed / support texture 是否有继续打磨价值。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    stem_sleep_keys = sparse_keys(
        [
            (6, ["C3", "G3", "E4"], 8.0, 0.44),
            (22, ["A3", "E4"], 7.0, 0.35),
            (39, ["C3", "G3", "D4"], 8.5, 0.38),
            (58, ["E3", "G3"], 7.0, 0.32),
        ],
        gain_db=-23,
    )
    stem_focus_keys = sparse_keys(
        [
            (5, ["C3", "E3"], 5.5, 0.46),
            (17, ["G3", "C4"], 5.0, 0.39),
            (30, ["E3", "G3"], 5.5, 0.41),
            (44, ["C3", "D4"], 5.0, 0.34),
            (59, ["G3", "C4"], 5.0, 0.32),
        ],
        gain_db=-22,
    )
    stem_warm = warm_support()
    stem_room = organic_room()

    items = []
    definitions = [
        ("stem_sleep_dry_sparse_keys_001", "Stem", "Sleep", "Sleep dry sparse keys", stem_sleep_keys, "Soft low electric piano notes with long gaps; no pad wash, no rhythm.", "Project-original additive synthesis; dry, low-pass, no reverb tail."),
        ("stem_focus_dry_close_keys_001", "Stem", "Focus", "Focus dry close keys", stem_focus_keys, "Slightly clearer sparse keys for focus without pulse or arpeggio.", "Project-original additive synthesis; controlled note density."),
        ("stem_warm_support_tone_001", "Stem", "Sleep/Calm", "Warm support tone", stem_warm, "Very low-level warmth only; should sit under the music rather than become a drone.", "Project-original soft harmonic support, intentionally -34 dBFS class."),
        ("stem_organic_room_texture_001", "Stem", "Calm/Focus", "Organic room texture", stem_room, "Low-attention room texture; not white noise as the main content.", "Project-original filtered stochastic room bed, intentionally below attention."),
    ]
    combos = [
        (
            "combo_sleep_minimal_keys_bed_001",
            "Recipe V2 combo",
            "Sleep",
            "Sleep minimal keys bed",
            mix([(stem_sleep_keys, 0), (stem_warm, -3)], gain_db=-19),
            "Closest to the Gemini prompt structure: sparse keys, warm support, no beat, no vocal, no build.",
            "Composition controlled by SNOOZE, not by a song model.",
        ),
        (
            "combo_calm_keys_with_tiny_room_001",
            "Recipe V2 combo",
            "Calm",
            "Calm keys with tiny room",
            mix([(stem_sleep_keys, -1), (stem_warm, -5), (stem_room, -9)], gain_db=-19),
            "Adds a small organic floor below the keys; texture must stay under attention.",
            "Noise/room texture is intentionally low and decorative.",
        ),
        (
            "combo_focus_close_keys_no_pulse_001",
            "Recipe V2 combo",
            "Focus",
            "Focus close keys no pulse",
            mix([(stem_focus_keys, 0), (stem_room, -14)], gain_db=-18),
            "Dry close keys with no drums, no arpeggio, no hurry.",
            "Focus route tests clarity without becoming busy music.",
        ),
    ]

    for name, typ, goal, title, audio, intent, note in definitions + combos:
        wav, mp3 = write_audio(name, audio)
        public_path = "/" + str(mp3.relative_to(ROOT / "public"))
        review_path = "../../" + str(mp3.relative_to(ROOT / "public"))
        items.append(
            {
                "id": name,
                "type": typ,
                "goal": goal,
                "title": title,
                "publicPath": public_path,
                "reviewPath": review_path,
                "localPath": str(mp3),
                "wavLocalPath": str(wav),
                "intent": intent,
                "productionNote": note,
                "metrics": metrics(audio),
            }
        )

    manifest = {
        "batch": "controlled-stem-factory-001",
        "route": "SNOOZE controlled stem factory",
        "source": "project-original procedural/additive synthesis; no external model, no paid cloud API",
        "durationSeconds": DURATION,
        "items": items,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    build_review(items)
    print(f"Wrote {len(items)} audio items")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


if __name__ == "__main__":
    main()
