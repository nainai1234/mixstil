#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE_SCRIPT = ROOT / "scripts/generate-controlled-stem-factory-001.py"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-003"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-003"

spec = importlib.util.spec_from_file_location("controlled_stem_factory_001", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.DURATION = 96.0
base.OUT_DIR = OUT_DIR
base.REVIEW_DIR = REVIEW_DIR


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
  <title>Controlled Stem Factory 003</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101312; color: #eef4ee; }}
    main {{ max-width: 980px; margin: 0 auto; padding: 32px 18px 60px; }}
    .hero {{ border: 1px solid rgba(255,255,255,.12); border-radius: 28px; padding: 24px; background: linear-gradient(135deg, rgba(184,154,104,.18), rgba(63,91,86,.16)); }}
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
      <p class="eyebrow">SNOOZE controlled route · batch 003</p>
      <h1>减少空白、提高音量、保持无节奏</h1>
      <p>002 的方向正确，但空白太长、整体太小。003 的改动是：第一声更早，音符间隔缩短，加入很轻的连续音乐底层，整体音量提高，但不做鼓点、不做白噪音主导、不做忙碌节奏。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


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


def continuous_felt_bed(gain_db=-31, root="C3"):
    """A musical continuity layer, not a white-noise or buzzing drone."""
    n = int(base.DURATION * base.SR)
    t = np.arange(n) / base.SR
    root_hz = base.note_freq(root)
    fifth = root_hz * 1.5
    octave = root_hz * 2.0
    shimmer = 0.0025 * np.sin(2 * np.pi * 0.023 * t)
    sig = (
        0.62 * np.sin(2 * np.pi * root_hz * (1 + shimmer) * t)
        + 0.24 * np.sin(2 * np.pi * fifth * (1 - shimmer * 0.5) * t + 0.7)
        + 0.12 * np.sin(2 * np.pi * octave * t + 1.4)
    )
    # Gentle non-periodic contour avoids a machine-steady buzz.
    contour = 0.74 + 0.14 * np.sin(2 * np.pi * 0.011 * t + 0.2) + 0.08 * np.sin(2 * np.pi * 0.017 * t + 1.1)
    sig = sig * contour
    sig = base.lowpass(base.highpass(sig, 65), 1450)
    sig = base.fade(sig, 7.0, 12.0)
    sig = sig / max(np.max(np.abs(sig)), 1e-9) * base.db_to_amp(gain_db)
    return base.stereo(sig)


def keys_sleep_steady():
    return base.sparse_keys(
        [
            (3, ["C3", "G3"], 10.5, 0.34),
            (15, ["E3", "G3"], 10.0, 0.29),
            (28, ["C3", "E3", "G3"], 11.0, 0.30),
            (42, ["A3", "E4"], 10.0, 0.25),
            (56, ["E3", "G3"], 10.5, 0.26),
            (70, ["C3", "G3", "D4"], 11.0, 0.25),
            (84, ["G3", "C4"], 9.0, 0.22),
        ],
        gain_db=-21,
    )


def keys_return_soft():
    return base.sparse_keys(
        [
            (4, ["C3"], 11.0, 0.29),
            (17, ["G3", "C4"], 10.0, 0.25),
            (31, ["E3"], 11.0, 0.25),
            (45, ["C3", "G3"], 10.5, 0.24),
            (60, ["A3"], 10.0, 0.22),
            (75, ["E3", "G3"], 10.0, 0.21),
            (88, ["C3"], 8.0, 0.18),
        ],
        gain_db=-23,
    )


def keys_meditation_present():
    return base.sparse_keys(
        [
            (3, ["C3", "E3", "G3"], 10.0, 0.36),
            (16, ["G3", "D4"], 9.5, 0.29),
            (29, ["A3", "E4"], 10.0, 0.29),
            (43, ["E3", "G3"], 10.0, 0.27),
            (57, ["C3", "G3", "C4"], 10.5, 0.27),
            (72, ["G3", "D4"], 9.5, 0.23),
            (86, ["C3", "E3"], 8.5, 0.21),
        ],
        gain_db=-21,
    )


def keys_focus_even_but_not_pulse():
    return base.sparse_keys(
        [
            (2, ["C3", "E3"], 7.0, 0.36),
            (12, ["G3"], 7.0, 0.31),
            (24, ["E3", "G3"], 7.0, 0.33),
            (36, ["C3", "D4"], 7.0, 0.29),
            (49, ["G3", "C4"], 7.0, 0.28),
            (62, ["E3"], 7.0, 0.25),
            (75, ["C3", "G3"], 7.0, 0.25),
            (88, ["G3"], 6.0, 0.20),
        ],
        gain_db=-20,
    )


def organic_air_floor(seed=3003, gain_db=-42):
    # Very low floor; audible only as continuity, not as white noise content.
    return base.organic_room(gain_db=gain_db, seed=seed)


def combo(parts, gain_db=-16.5, fade_in=5.0):
    return base.fade(base.mix(parts, gain_db=gain_db), fade_in, 10.0)


def main():
    sleep_keys = keys_sleep_steady()
    return_keys = keys_return_soft()
    meditation_keys = keys_meditation_present()
    focus_keys = keys_focus_even_but_not_pulse()
    bed_c = continuous_felt_bed(-31, "C3")
    bed_a = continuous_felt_bed(-32, "A3")
    air = organic_air_floor()

    sleep_combo = combo([(sleep_keys, 0), (bed_c, -2)], gain_db=-16.8, fade_in=6)
    return_combo = combo([(return_keys, 0), (bed_c, -4), (air, -18)], gain_db=-18.0, fade_in=8)
    calm_combo = combo([(meditation_keys, 0), (bed_a, -4), (air, -20)], gain_db=-16.8, fade_in=5)
    focus_combo = combo([(focus_keys, 0), (bed_c, -8)], gain_db=-15.8, fade_in=4)
    sleep_fuller_combo = combo([(sleep_keys, 0), (bed_c, 0), (air, -22)], gain_db=-15.8, fade_in=5)

    items = []
    add_item(items, "stem_continuous_felt_bed_c_003", "Stem", "Sleep/Calm", "Continuous felt bed C 003", bed_c, "轻连续音乐底层：填补空白，但不是蜂鸣、不是白噪音、不是主旋律。", "Continuity layer added because 002 had too much silence.")
    add_item(items, "stem_sleep_steady_sparse_keys_003", "Stem", "Sleep", "Sleep steady sparse keys 003", sleep_keys, "比 002 更连续：间隔缩短，音量提高，但仍然没有节奏和高潮。", "First event at 3s; average gap roughly 12-14s.")
    add_item(items, "stem_return_soft_keys_003", "Stem", "Return to sleep", "Return soft keys 003", return_keys, "夜醒回睡版本：不再长时间空白，但比入睡更轻。", "Higher than 002, still softer than normal Sleep.")
    add_item(items, "stem_meditation_present_keys_003", "Stem", "Calm meditation", "Meditation present keys 003", meditation_keys, "冥想版本：存在感更明确，不是每隔很久才响一下。", "More continuous phrase spacing without a beat.")
    add_item(items, "stem_focus_even_nopulse_keys_003", "Stem", "Focus", "Focus even no-pulse keys 003", focus_keys, "专注版本：更容易听见，但避免形成节拍或赶路感。", "Slightly denser, still no percussion/arpeggio.")
    add_item(items, "combo_sleep_continuous_bed_003", "Recipe V2 combo", "Sleep", "Sleep continuous bed 003", sleep_combo, "修正 002 空白过长：轻底层一直托住，钢琴间隔缩短，整体更容易听见。", "Raised loudness and added continuous musical bed.")
    add_item(items, "combo_return_sleep_soft_continuity_003", "Recipe V2 combo", "Return to sleep", "Return sleep soft continuity 003", return_combo, "回睡版本：更小心，但不再像没声音。", "Tiny organic air floor remains far below attention.")
    add_item(items, "combo_calm_meditation_continuous_003", "Recipe V2 combo", "Calm meditation", "Calm meditation continuous 003", calm_combo, "冥想版本：声音连续性更好，仍然没有仪式化人声/唱诵/大混响。", "Controlled stem arrangement, no external model.")
    add_item(items, "combo_focus_audible_low_density_003", "Recipe V2 combo", "Focus", "Focus audible low-density 003", focus_combo, "专注版本：音量更足，声音更稳定，但不变成节奏音乐。", "Audible but no pulse layer.")
    add_item(items, "combo_sleep_fuller_no_noise_003", "Recipe V2 combo", "Sleep", "Sleep fuller no-noise 003", sleep_fuller_combo, "更饱满的 sleep 版本：不用白噪音增加厚度，而用音乐底层补齐。", "Best candidate if 002 felt too empty.")

    manifest = {
        "batch": "controlled-stem-factory-003",
        "route": "SNOOZE controlled stem factory",
        "source": "project-original procedural/additive synthesis; no external model, no paid cloud API",
        "userFeedbackApplied": [
            "002 direction is correct.",
            "Reduce long silent gaps.",
            "Increase perceived volume.",
            "Keep it slow but not absent."
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
