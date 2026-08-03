#!/usr/bin/env python3
import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE_SCRIPT = ROOT / "scripts/generate-controlled-stem-factory-001.py"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-002"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-002"

spec = importlib.util.spec_from_file_location("controlled_stem_factory_001", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.DURATION = 96.0
base.OUT_DIR = OUT_DIR
base.REVIEW_DIR = REVIEW_DIR


def mix_with_arrival(parts, gain_db=-19, fade_in=10.0, fade_out=14.0):
    out = base.mix(parts, gain_db=gain_db)
    return base.fade(out, fade_in, fade_out)


def write_audio(name, audio):
    wav, mp3 = base.write_audio(name, audio)
    return wav, mp3


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
  <title>Controlled Stem Factory 002</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101312; color: #eef4ee; }}
    main {{ max-width: 980px; margin: 0 auto; padding: 32px 18px 60px; }}
    .hero {{ border: 1px solid rgba(255,255,255,.12); border-radius: 28px; padding: 24px; background: linear-gradient(135deg, rgba(177,151,105,.16), rgba(73,102,92,.14)); }}
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
      <p class="eyebrow">SNOOZE controlled route · batch 002</p>
      <h1>更接近产品内容的受控 Stem / Combo</h1>
      <p>你确认 001 方向正确后，这一批把它往真实产品推进一点：更长的 arrival、更低的事件密度、更明确的 Sleep / Return to sleep / Calm meditation / Focus 分工。</p>
      <p>仍然不使用 Gemini、Stability、ACE-Step 或 MusicGen；所有声音都是项目原创的可控 stem，再由 SNOOZE 编排组合。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def shifted_room(seed, gain_db=-41):
    return base.organic_room(gain_db=gain_db, seed=seed)


def slow_sleep_keys():
    return base.sparse_keys(
        [
            (12, ["C3", "G3"], 9.5, 0.31),
            (34, ["E3", "G3"], 8.5, 0.26),
            (57, ["A3", "E4"], 9.0, 0.24),
            (80, ["C3", "G3"], 8.0, 0.22),
        ],
        gain_db=-25,
    )


def return_sleep_keys():
    return base.sparse_keys(
        [
            (10, ["C3"], 10.0, 0.25),
            (31, ["G3", "C4"], 8.0, 0.22),
            (54, ["E3"], 9.5, 0.22),
            (76, ["C3", "G3"], 8.0, 0.20),
        ],
        gain_db=-27,
    )


def meditation_keys():
    return base.sparse_keys(
        [
            (9, ["C3", "E3", "G3"], 8.5, 0.32),
            (29, ["G3", "D4"], 8.0, 0.24),
            (50, ["A3", "E4"], 8.5, 0.25),
            (72, ["E3", "G3"], 8.0, 0.22),
        ],
        gain_db=-24,
    )


def focus_keys():
    return base.sparse_keys(
        [
            (8, ["C3", "E3"], 6.5, 0.33),
            (24, ["G3"], 6.0, 0.27),
            (40, ["E3", "G3"], 6.5, 0.29),
            (57, ["C3", "D4"], 6.0, 0.24),
            (74, ["G3", "C4"], 6.0, 0.23),
            (89, ["E3"], 5.0, 0.20),
        ],
        gain_db=-24,
    )


def soft_low_breath_support(gain_db=-39):
    # Low amplitude undulation built from the warm tone, deliberately quieter
    # than the musical stem. It should be felt as warmth, not heard as a buzz.
    audio = base.warm_support(gain_db=gain_db)
    n = len(audio)
    t = np.arange(n) / base.SR
    envelope = 0.82 + 0.18 * np.sin(2 * np.pi * 0.035 * t)
    return audio * envelope[:, None]


def add_item(items, name, typ, goal, title, audio, intent, note):
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
            "metrics": base.metrics(audio),
        }
    )


def main():
    sleep = slow_sleep_keys()
    returned = return_sleep_keys()
    meditation = meditation_keys()
    focus = focus_keys()
    warmth = soft_low_breath_support()
    room_a = shifted_room(2002, -43)
    room_b = shifted_room(2003, -44)

    sleep_combo = mix_with_arrival([(sleep, 0), (warmth, -5)], gain_db=-20, fade_in=14)
    return_combo = mix_with_arrival([(returned, 0), (warmth, -7), (room_a, -16)], gain_db=-21, fade_in=18)
    calm_combo = mix_with_arrival([(meditation, 0), (warmth, -8), (room_a, -17)], gain_db=-20, fade_in=12)
    focus_combo = mix_with_arrival([(focus, 0), (room_b, -18)], gain_db=-19, fade_in=8)
    ultra_quiet_combo = mix_with_arrival([(returned, -2), (warmth, -9)], gain_db=-23, fade_in=20)

    items = []
    add_item(items, "stem_sleep_slow_sparse_keys_002", "Stem", "Sleep", "Sleep slow sparse keys 002", sleep, "入睡主音乐素材：音符更少、更慢、更暗，不制造旋律记忆点。", "Project-original dry sparse keys; no cloud/model source.")
    add_item(items, "stem_return_sleep_near_silence_keys_002", "Stem", "Return to sleep", "Return sleep near-silence keys 002", returned, "夜醒回睡素材：比入睡更少事件，避免把人重新唤醒。", "Project-original dry sparse keys; lower gain and longer gaps.")
    add_item(items, "stem_meditation_soft_settle_keys_002", "Stem", "Calm meditation", "Meditation soft settle keys 002", meditation, "冥想稳定素材：允许一点温暖，但不做上扬和高潮。", "Project-original dry sparse keys; no chant, no bowl cliché.")
    add_item(items, "stem_focus_close_low_density_keys_002", "Stem", "Focus", "Focus close low-density keys 002", focus, "专注素材：略清晰，但没有 pulse、鼓点、琶音或赶路感。", "Project-original dry sparse keys; controlled event spacing.")
    add_item(items, "stem_soft_low_breath_support_002", "Stem", "Sleep/Calm", "Soft low breath support 002", warmth, "很低的暖底，不应该成为蜂鸣声，只给音乐床一点身体感。", "Project-original harmonic support below attention.")
    add_item(items, "combo_sleep_deep_arrival_002", "Recipe V2 combo", "Sleep", "Sleep deep arrival 002", sleep_combo, "更像完整入睡开头：慢进入、稀疏键盘、极低暖底，没有白噪音主导。", "SNOOZE-owned arrangement with 14s arrival fade.")
    add_item(items, "combo_return_sleep_minimum_motion_002", "Recipe V2 combo", "Return to sleep", "Return sleep minimum motion 002", return_combo, "夜醒后回睡：比普通 sleep 更安静、更少变化，尽量不抓注意力。", "SNOOZE-owned arrangement with tiny room texture under attention.")
    add_item(items, "combo_calm_meditation_settle_002", "Recipe V2 combo", "Calm meditation", "Calm meditation settle 002", calm_combo, "冥想/放松：有一点空间，但不做大混响、不做人声、不做仪式感。", "SNOOZE-owned arrangement; texture remains decorative.")
    add_item(items, "combo_focus_dry_low_density_002", "Recipe V2 combo", "Focus", "Focus dry low-density 002", focus_combo, "专注：更清楚一点，但仍然没有节奏驱动和忙碌感。", "SNOOZE-owned arrangement; no beat-like layer.")
    add_item(items, "combo_ultra_quiet_return_sleep_002", "Recipe V2 combo", "Sleep", "Ultra quiet return sleep 002", ultra_quiet_combo, "极安静版本：用于已经很困、只需要一点点声音陪伴的场景。", "Lowest-gain combo in this batch.")

    manifest = {
        "batch": "controlled-stem-factory-002",
        "route": "SNOOZE controlled stem factory",
        "source": "project-original procedural/additive synthesis; no external model, no paid cloud API",
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
