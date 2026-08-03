#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE_SCRIPT = ROOT / "scripts/generate-controlled-stem-factory-001.py"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-004"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-004"

spec = importlib.util.spec_from_file_location("controlled_stem_factory_001", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.DURATION = 104.0
base.OUT_DIR = OUT_DIR
base.REVIEW_DIR = REVIEW_DIR


def add_item(items, name, typ, goal, title, audio, intent, note):
    wav, mp3 = base.write_audio(name, audio)
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
            "metrics": base.metrics(audio),
        }
    )


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(
            f"""
      <article class="card">
        <p class="eyebrow">{base.html_escape(item['type'])} · {base.html_escape(item['goal'])}</p>
        <h2>{base.html_escape(item['title'])}</h2>
        <audio controls preload="metadata" src="{base.html_escape(item['reviewPath'])}"></audio>
        <p>{base.html_escape(item['intent'])}</p>
        <details>
          <summary>结构 / 参数 / QA</summary>
          <pre>{base.html_escape(json.dumps(item['metrics'], indent=2, ensure_ascii=False))}</pre>
          <p>{base.html_escape(item['productionNote'])}</p>
        </details>
      </article>
            """
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Controlled Stem Factory 004</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101312; color: #eef4ee; }}
    main {{ max-width: 980px; margin: 0 auto; padding: 32px 18px 60px; }}
    .hero {{ border: 1px solid rgba(255,255,255,.12); border-radius: 28px; padding: 24px; background: linear-gradient(135deg, rgba(180,150,102,.18), rgba(69,96,85,.15)); }}
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
      <p class="eyebrow">SNOOZE controlled route · batch 004</p>
      <h1>音乐性连接版：去掉白噪/蜂鸣，用尾音和短句连接</h1>
      <p>003 的问题是用连续底层补空白后出现白噪/蜂鸣感，并且破坏韵律。004 取消所有 noise floor 和 sustained drone，只保留柔和音乐素材，通过更密的短句、重叠尾音和轻和声让它“连接起来像一首完整音乐”。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def soft_note(freq, start, length, velocity=0.4, brightness=0.65, pan=0.0):
    n = int(length * base.SR)
    t = np.arange(n) / base.SR
    attack = max(1, int(0.08 * base.SR))
    release_curve = np.exp(-t / (length * 0.55))
    env = release_curve
    env[:attack] *= np.linspace(0, 1, attack) ** 1.9

    sig = (
        1.0 * np.sin(2 * np.pi * freq * t)
        + 0.28 * brightness * np.sin(2 * np.pi * freq * 2.005 * t + 0.3)
        + 0.08 * brightness * np.sin(2 * np.pi * freq * 3.01 * t + 1.1)
    )
    sig *= env * velocity * 0.13
    sig = base.lowpass(base.highpass(sig, 65), 2400 if brightness > 0.55 else 1800)
    out = np.zeros((int(base.DURATION * base.SR), 2))
    offset = int(start * base.SR)
    end = min(len(out), offset + len(sig))
    sig = sig[: end - offset]
    left = sig * (1 - max(0, pan) * 0.25)
    right = sig * (1 + min(0, pan) * 0.25)
    out[offset:end, 0] += left
    out[offset:end, 1] += right
    return out


def chord(notes, start, length, velocity=0.34, brightness=0.55, spread=0.08):
    out = np.zeros((int(base.DURATION * base.SR), 2))
    for idx, note in enumerate(notes):
        pan = -0.25 + idx * (0.5 / max(1, len(notes) - 1))
        out += soft_note(base.note_freq(note), start + idx * spread, length, velocity, brightness, pan)
    return out


def compose(events, gain_db=-18.0, fade_in=4.0, fade_out=12.0):
    out = np.zeros((int(base.DURATION * base.SR), 2))
    for event in events:
        out += chord(**event)
    out = base.fade(out, fade_in, fade_out)
    out = out / max(np.max(np.abs(out)), 1e-9) * base.db_to_amp(gain_db)
    return out


def sleep_lull_piece():
    # Overlapping chords every 7-9 seconds; no noise/drone layer.
    events = [
        {"notes": ["C3", "G3"], "start": 2.0, "length": 9.5, "velocity": 0.33},
        {"notes": ["E3", "G3", "C4"], "start": 9.8, "length": 10.5, "velocity": 0.29},
        {"notes": ["A3", "E4"], "start": 18.4, "length": 9.0, "velocity": 0.25},
        {"notes": ["G3", "C4"], "start": 26.0, "length": 10.0, "velocity": 0.26},
        {"notes": ["C3", "E3", "G3"], "start": 34.5, "length": 11.0, "velocity": 0.28},
        {"notes": ["E3", "G3"], "start": 44.0, "length": 9.0, "velocity": 0.24},
        {"notes": ["A3", "E4"], "start": 52.0, "length": 9.5, "velocity": 0.23},
        {"notes": ["G3", "C4"], "start": 60.4, "length": 10.0, "velocity": 0.23},
        {"notes": ["C3", "G3", "C4"], "start": 69.0, "length": 11.0, "velocity": 0.25},
        {"notes": ["E3", "G3"], "start": 78.4, "length": 9.0, "velocity": 0.21},
        {"notes": ["C3", "G3"], "start": 87.0, "length": 12.0, "velocity": 0.20},
    ]
    return compose(events, gain_db=-17.0)


def calm_breath_piece():
    events = [
        {"notes": ["C3", "E3", "G3"], "start": 1.5, "length": 8.5, "velocity": 0.34, "brightness": 0.58},
        {"notes": ["G3", "C4"], "start": 8.0, "length": 8.8, "velocity": 0.28, "brightness": 0.55},
        {"notes": ["A3", "E4"], "start": 15.7, "length": 8.8, "velocity": 0.27, "brightness": 0.52},
        {"notes": ["E3", "G3", "C4"], "start": 23.5, "length": 9.0, "velocity": 0.27, "brightness": 0.54},
        {"notes": ["C3", "G3"], "start": 31.4, "length": 9.5, "velocity": 0.29, "brightness": 0.50},
        {"notes": ["G3", "D4"], "start": 40.0, "length": 8.8, "velocity": 0.24, "brightness": 0.50},
        {"notes": ["A3", "E4"], "start": 48.0, "length": 9.2, "velocity": 0.24, "brightness": 0.50},
        {"notes": ["E3", "G3"], "start": 56.5, "length": 9.0, "velocity": 0.23, "brightness": 0.48},
        {"notes": ["C3", "E3", "G3"], "start": 65.0, "length": 10.0, "velocity": 0.25, "brightness": 0.46},
        {"notes": ["G3", "C4"], "start": 74.2, "length": 9.0, "velocity": 0.22, "brightness": 0.45},
        {"notes": ["C3", "G3"], "start": 83.0, "length": 13.0, "velocity": 0.20, "brightness": 0.42},
    ]
    return compose(events, gain_db=-16.8)


def return_sleep_piece():
    events = [
        {"notes": ["C3", "G3"], "start": 3.0, "length": 11.0, "velocity": 0.27, "brightness": 0.45},
        {"notes": ["E3"], "start": 12.0, "length": 10.0, "velocity": 0.22, "brightness": 0.42},
        {"notes": ["G3", "C4"], "start": 21.5, "length": 10.5, "velocity": 0.22, "brightness": 0.42},
        {"notes": ["A3"], "start": 31.0, "length": 10.0, "velocity": 0.20, "brightness": 0.40},
        {"notes": ["E3", "G3"], "start": 40.8, "length": 11.0, "velocity": 0.21, "brightness": 0.40},
        {"notes": ["C3", "G3"], "start": 51.0, "length": 12.0, "velocity": 0.21, "brightness": 0.39},
        {"notes": ["G3"], "start": 62.0, "length": 10.0, "velocity": 0.18, "brightness": 0.38},
        {"notes": ["E3", "G3"], "start": 72.0, "length": 12.0, "velocity": 0.18, "brightness": 0.37},
        {"notes": ["C3"], "start": 84.0, "length": 14.0, "velocity": 0.16, "brightness": 0.35},
    ]
    return compose(events, gain_db=-18.2, fade_in=6.0)


def focus_plain_piece():
    # More connected than 002, but deliberately uneven timing so it does not
    # become a pulse/beat.
    events = [
        {"notes": ["C3", "E3"], "start": 1.5, "length": 7.0, "velocity": 0.34, "brightness": 0.62},
        {"notes": ["G3"], "start": 7.8, "length": 7.2, "velocity": 0.29, "brightness": 0.60},
        {"notes": ["E3", "G3"], "start": 15.0, "length": 7.0, "velocity": 0.31, "brightness": 0.58},
        {"notes": ["C3", "D4"], "start": 22.8, "length": 7.0, "velocity": 0.28, "brightness": 0.56},
        {"notes": ["G3", "C4"], "start": 31.0, "length": 7.5, "velocity": 0.28, "brightness": 0.55},
        {"notes": ["E3"], "start": 39.0, "length": 7.0, "velocity": 0.24, "brightness": 0.54},
        {"notes": ["C3", "G3"], "start": 47.2, "length": 7.5, "velocity": 0.25, "brightness": 0.53},
        {"notes": ["G3"], "start": 56.0, "length": 7.0, "velocity": 0.22, "brightness": 0.52},
        {"notes": ["E3", "G3"], "start": 64.0, "length": 7.0, "velocity": 0.23, "brightness": 0.50},
        {"notes": ["C3", "D4"], "start": 73.0, "length": 7.2, "velocity": 0.21, "brightness": 0.49},
        {"notes": ["G3", "C4"], "start": 82.0, "length": 7.0, "velocity": 0.20, "brightness": 0.48},
        {"notes": ["C3", "G3"], "start": 91.0, "length": 9.0, "velocity": 0.18, "brightness": 0.45},
    ]
    return compose(events, gain_db=-16.4, fade_in=3.0)


def two_layer_sleep_piece():
    main = sleep_lull_piece() * base.db_to_amp(-1.0)
    # A second musical layer: a few lower soft notes, not a sustained hum.
    low_events = [
        {"notes": ["C3"], "start": 0.0, "length": 14.0, "velocity": 0.13, "brightness": 0.30},
        {"notes": ["A3"], "start": 24.0, "length": 13.0, "velocity": 0.10, "brightness": 0.28},
        {"notes": ["C3"], "start": 49.0, "length": 14.0, "velocity": 0.11, "brightness": 0.28},
        {"notes": ["G3"], "start": 73.0, "length": 14.0, "velocity": 0.09, "brightness": 0.26},
    ]
    low = compose(low_events, gain_db=-24.0, fade_in=4.0)
    out = main + low
    out = base.fade(out, 4.0, 12.0)
    out = out / max(np.max(np.abs(out)), 1e-9) * base.db_to_amp(-16.3)
    return out


def main():
    sleep = sleep_lull_piece()
    calm = calm_breath_piece()
    returned = return_sleep_piece()
    focus = focus_plain_piece()
    sleep_two_layer = two_layer_sleep_piece()

    items = []
    add_item(items, "piece_sleep_lull_connected_004", "Piece", "Sleep", "Sleep lull connected 004", sleep, "去掉 003 的连续蜂鸣底层，改用重叠尾音和柔和和弦把声音连接成一首慢音乐。", "No noise floor, no drone; musical overlap only.")
    add_item(items, "piece_calm_breath_connected_004", "Piece", "Calm meditation", "Calm breath connected 004", calm, "冥想/放松版本：有连贯短句和韵律，但不做人声、不唱诵、不大混响。", "Uneven gentle phrases; no white noise layer.")
    add_item(items, "piece_return_sleep_connected_004", "Piece", "Return to sleep", "Return sleep connected 004", returned, "回睡版本：仍然轻，但不再长时间听不到；用音乐尾音承接。", "Softer and darker; no sustained hum.")
    add_item(items, "piece_focus_plain_connected_004", "Piece", "Focus", "Focus plain connected 004", focus, "专注版本：比睡眠更清楚，但时间点不完全等距，避免变成节拍。", "Connected phrases without percussion or arpeggio.")
    add_item(items, "piece_sleep_two_layer_musical_004", "Piece", "Sleep", "Sleep two-layer musical 004", sleep_two_layer, "更完整的睡眠版本：两层音乐互相支撑，不靠噪音或蜂鸣补厚度。", "Best candidate if 003 felt noisy but 002 felt empty.")

    manifest = {
        "batch": "controlled-stem-factory-004",
        "route": "SNOOZE controlled stem factory",
        "source": "project-original procedural/additive synthesis; no external model, no paid cloud API",
        "userFeedbackApplied": [
            "003 added white-noise/hum-like sound and became less comfortable.",
            "Individual sounds have rhythm, but they need to connect into a piece.",
            "Remove noise/hum beds; use musical phrasing and overlapping tails."
        ],
        "durationSeconds": base.DURATION,
        "items": items,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} audio items")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


if __name__ == "__main__":
    main()
