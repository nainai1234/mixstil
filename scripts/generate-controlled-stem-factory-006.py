#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE_SCRIPT = ROOT / "scripts/generate-controlled-stem-factory-005.py"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-006"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-006"

spec = importlib.util.spec_from_file_location("controlled_stem_factory_005", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.OUT_DIR = OUT_DIR
base.REVIEW_DIR = REVIEW_DIR
base.DURATION = 112.0


def add_item(items, name, goal, title, groups, intent, note, program=0, peak_db=-17.5, cutoff=3400):
    wav, mp3, audio = base.render_dls_piece(name, groups, program=program, peak_db=peak_db, cutoff=cutoff)
    items.append(
        {
            "id": name,
            "type": "DLS sampled piece",
            "goal": goal,
            "title": title,
            "publicPath": "/" + str(mp3.relative_to(ROOT / "public")),
            "reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
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
        <p class="eyebrow">{base.escape(item['type'])} · {base.escape(item['goal'])}</p>
        <h2>{base.escape(item['title'])}</h2>
        <audio controls preload="metadata" src="{base.escape(item['reviewPath'])}"></audio>
        <p>{base.escape(item['intent'])}</p>
        <details>
          <summary>音源 / QA</summary>
          <pre>{base.escape(json.dumps(item['metrics'], indent=2, ensure_ascii=False))}</pre>
          <p>{base.escape(item['productionNote'])}</p>
        </details>
      </article>
            """
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Controlled Stem Factory 006</title>
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
      <p class="eyebrow">SNOOZE controlled route · batch 006</p>
      <h1>把 005 的间隔再砍半，保持采样乐器但更连贯</h1>
      <p>用户反馈很明确：005 本身没问题，但两个音之间的空白仍然太长。006 在保留 DLS 采样乐器的前提下，把组间间隔从 005 的 6–10 秒压到大约 3–5 秒，并用更长尾音做轻微重叠。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def dense_sleep_groups():
    return [
        {"start": 1.0, "notes": ["C3", "G3", "C4"], "duration": 6.2, "velocity": 34},
        {"start": 4.8, "notes": ["E3", "G3"], "duration": 5.8, "velocity": 31},
        {"start": 8.8, "notes": ["A3", "E4"], "duration": 5.8, "velocity": 29},
        {"start": 13.0, "notes": ["G3", "C4"], "duration": 5.9, "velocity": 29},
        {"start": 17.4, "notes": ["C3", "E3", "G3"], "duration": 6.3, "velocity": 29},
        {"start": 22.2, "notes": ["E3", "G3"], "duration": 5.8, "velocity": 27},
        {"start": 27.0, "notes": ["A3", "E4"], "duration": 5.8, "velocity": 26},
        {"start": 31.8, "notes": ["G3", "C4"], "duration": 5.9, "velocity": 26},
        {"start": 36.8, "notes": ["C3", "G3", "C4"], "duration": 6.5, "velocity": 26},
        {"start": 42.2, "notes": ["E3", "G3"], "duration": 6.0, "velocity": 24},
        {"start": 47.2, "notes": ["A3", "E4"], "duration": 6.0, "velocity": 24},
        {"start": 52.4, "notes": ["G3", "C4"], "duration": 6.1, "velocity": 23},
        {"start": 58.0, "notes": ["C3", "E3", "G3"], "duration": 6.6, "velocity": 23},
        {"start": 64.0, "notes": ["E3", "G3"], "duration": 6.2, "velocity": 22},
        {"start": 70.0, "notes": ["A3", "E4"], "duration": 6.2, "velocity": 21},
        {"start": 76.0, "notes": ["G3", "C4"], "duration": 6.4, "velocity": 21},
        {"start": 82.0, "notes": ["C3", "G3", "C4"], "duration": 6.8, "velocity": 22},
        {"start": 88.0, "notes": ["E3", "G3"], "duration": 6.5, "velocity": 20},
        {"start": 94.0, "notes": ["C3", "G3"], "duration": 8.0, "velocity": 19},
    ]


def dense_calm_groups():
    return [
        {"start": 0.8, "notes": ["C3", "E3", "G3"], "duration": 5.2, "velocity": 37},
        {"start": 4.5, "notes": ["G3", "D4"], "duration": 5.0, "velocity": 33},
        {"start": 8.8, "notes": ["A3", "E4"], "duration": 5.2, "velocity": 31},
        {"start": 13.0, "notes": ["E3", "G3", "C4"], "duration": 5.2, "velocity": 31},
        {"start": 17.6, "notes": ["C3", "G3"], "duration": 5.3, "velocity": 30},
        {"start": 22.0, "notes": ["G3", "D4"], "duration": 5.1, "velocity": 28},
        {"start": 26.8, "notes": ["A3", "E4"], "duration": 5.1, "velocity": 27},
        {"start": 31.4, "notes": ["E3", "G3"], "duration": 5.3, "velocity": 27},
        {"start": 36.5, "notes": ["C3", "E3", "G3"], "duration": 5.7, "velocity": 27},
        {"start": 41.8, "notes": ["G3", "C4"], "duration": 5.3, "velocity": 25},
        {"start": 47.0, "notes": ["C3", "G3"], "duration": 5.6, "velocity": 24},
        {"start": 52.8, "notes": ["G3", "D4"], "duration": 5.1, "velocity": 24},
        {"start": 58.2, "notes": ["A3", "E4"], "duration": 5.1, "velocity": 23},
        {"start": 63.5, "notes": ["E3", "G3"], "duration": 5.4, "velocity": 23},
        {"start": 69.0, "notes": ["C3", "E3", "G3"], "duration": 5.8, "velocity": 23},
        {"start": 75.0, "notes": ["G3", "C4"], "duration": 5.4, "velocity": 22},
        {"start": 81.0, "notes": ["C3", "G3"], "duration": 5.8, "velocity": 21},
        {"start": 87.0, "notes": ["E3", "G3"], "duration": 6.0, "velocity": 20},
        {"start": 94.0, "notes": ["C3", "G3"], "duration": 8.0, "velocity": 19},
    ]


def dense_return_groups():
    return [
        {"start": 1.8, "notes": ["C3", "G3"], "duration": 7.2, "velocity": 27},
        {"start": 6.2, "notes": ["E3"], "duration": 6.8, "velocity": 23},
        {"start": 10.8, "notes": ["G3", "C4"], "duration": 7.0, "velocity": 24},
        {"start": 16.0, "notes": ["A3"], "duration": 6.8, "velocity": 21},
        {"start": 21.0, "notes": ["E3", "G3"], "duration": 7.2, "velocity": 22},
        {"start": 26.0, "notes": ["C3", "G3"], "duration": 7.5, "velocity": 22},
        {"start": 31.6, "notes": ["G3"], "duration": 6.8, "velocity": 20},
        {"start": 36.8, "notes": ["C3"], "duration": 7.2, "velocity": 19},
        {"start": 42.0, "notes": ["E3", "G3"], "duration": 7.0, "velocity": 21},
        {"start": 47.5, "notes": ["A3"], "duration": 6.8, "velocity": 20},
        {"start": 53.0, "notes": ["C3", "G3"], "duration": 7.0, "velocity": 20},
        {"start": 58.6, "notes": ["E3"], "duration": 6.6, "velocity": 19},
        {"start": 64.2, "notes": ["G3"], "duration": 6.6, "velocity": 18},
        {"start": 70.0, "notes": ["C3", "G3"], "duration": 7.0, "velocity": 18},
        {"start": 76.0, "notes": ["E3"], "duration": 6.6, "velocity": 18},
        {"start": 82.0, "notes": ["C3"], "duration": 7.0, "velocity": 17},
        {"start": 88.0, "notes": ["G3"], "duration": 6.8, "velocity": 17},
        {"start": 94.0, "notes": ["C3"], "duration": 8.0, "velocity": 16},
    ]


def dense_focus_groups():
    return [
        {"start": 0.8, "notes": ["C3", "E3"], "duration": 4.6, "velocity": 37},
        {"start": 4.2, "notes": ["G3"], "duration": 4.4, "velocity": 34},
        {"start": 7.8, "notes": ["E3", "G3"], "duration": 4.6, "velocity": 35},
        {"start": 11.6, "notes": ["C3", "D4"], "duration": 4.6, "velocity": 32},
        {"start": 15.6, "notes": ["G3", "C4"], "duration": 4.7, "velocity": 31},
        {"start": 19.8, "notes": ["E3"], "duration": 4.6, "velocity": 29},
        {"start": 24.0, "notes": ["C3", "G3"], "duration": 4.8, "velocity": 29},
        {"start": 28.4, "notes": ["G3"], "duration": 4.6, "velocity": 27},
        {"start": 33.0, "notes": ["E3", "G3"], "duration": 4.8, "velocity": 27},
        {"start": 37.8, "notes": ["C3", "D4"], "duration": 4.8, "velocity": 25},
        {"start": 42.8, "notes": ["G3", "C4"], "duration": 4.8, "velocity": 24},
        {"start": 48.0, "notes": ["E3"], "duration": 4.6, "velocity": 23},
        {"start": 53.0, "notes": ["C3", "G3"], "duration": 4.8, "velocity": 23},
        {"start": 58.2, "notes": ["G3"], "duration": 4.6, "velocity": 22},
        {"start": 63.8, "notes": ["E3", "G3"], "duration": 4.8, "velocity": 21},
        {"start": 69.2, "notes": ["C3", "D4"], "duration": 4.8, "velocity": 21},
        {"start": 75.0, "notes": ["G3", "C4"], "duration": 4.8, "velocity": 20},
        {"start": 81.0, "notes": ["C3", "G3"], "duration": 4.8, "velocity": 20},
        {"start": 88.0, "notes": ["E3"], "duration": 4.8, "velocity": 19},
        {"start": 96.0, "notes": ["C3", "G3"], "duration": 6.0, "velocity": 18},
    ]


def main():
    items = []
    add_item(items, "dls_sleep_tighter_spacing_006", "Sleep", "DLS Sleep tighter spacing 006", dense_sleep_groups(), "把 005 的间隔直接压短到一半左右，让它持续听得到，但不变快。", "Intervals shortened roughly by half; still no beat or percussion.")
    add_item(items, "dls_calm_tighter_spacing_006", "Calm meditation", "DLS Calm tighter spacing 006", dense_calm_groups(), "冥想版本也把间隔收紧，尽量避免中间掉空。", "More connected phrases; no noise floor.")
    add_item(items, "dls_return_sleep_tighter_spacing_006", "Return to sleep", "DLS Return sleep tighter spacing 006", dense_return_groups(), "回睡版本更密一点，但依然保持很轻。", "Shorter gaps, softer velocities.")
    add_item(items, "dls_focus_tighter_spacing_006", "Focus", "DLS Focus tighter spacing 006", dense_focus_groups(), "专注版本把空白压短，但仍然不做 pulse。", "Connected but not rhythmic.")

    manifest = {
        "batch": "controlled-stem-factory-006",
        "route": "SNOOZE controlled stem factory with system DLS sampled instrument",
        "source": "macOS system DLS sampled instrument rendering; no paid cloud API; no external generative model",
        "userFeedbackApplied": [
            "005 audio is fine, but the gaps between notes still need to be at least half shorter.",
            "Keep the sampled instrument sound, not the pure-wave synthesis."
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
