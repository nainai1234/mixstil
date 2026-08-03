#!/usr/bin/env python3
"""Build reusable, rights-safe stems from the pinned VCSL source and 007 recipes.

This batch deliberately does not add a synthetic noise bed. It separates the
same deterministic arrangement into a sustained harmonic bed, a sparse upper
phrase stem, and a finished mix so the product can compose variants without
re-generating or importing a song.
"""
import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts/generate-controlled-stem-factory-007.py"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-008"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-008"

spec = importlib.util.spec_from_file_location("factory007", BASE_PATH)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
base.OUT_DIR = OUT_DIR


def render_events(sources, events, lowpass_hz):
    return base.arrange(sources, {"events": events, "lowpass_hz": lowpass_hz})


def write_audio(name, audio, normalize_db=-18.0):
    peak = max(float(np.max(np.abs(audio))), 1e-9)
    audio = audio / peak * base.db_to_amp(normalize_db)
    wav = OUT_DIR / f"{name}.wav"
    mp3 = OUT_DIR / f"{name}.mp3"
    sf.write(wav, audio, base.SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(wav), "-af", f"loudnorm=I={normalize_db}:LRA=5:TP=-4",
                    "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
    return wav, mp3, audio


def classify(events):
    # 007's arrangement intentionally uses low velocity for the upper phrase.
    bed = [event for event in events if event["velocity"] >= 0.08]
    phrase = [event for event in events if event["velocity"] < 0.08]
    return bed, phrase


def metrics(audio):
    mono = audio.mean(axis=1)
    frame = int(0.5 * base.SR)
    rms = np.array([np.sqrt(np.mean(mono[i:i + frame] ** 2)) for i in range(0, len(mono) - frame, frame)])
    quiet = rms < base.db_to_amp(-43)
    longest = current = 0
    for value in quiet:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return {
        "durationSeconds": round(len(mono) / base.SR, 2),
        "peakDbfs": round(20 * np.log10(np.max(np.abs(mono)) + 1e-12), 2),
        "rmsDbfs": round(20 * np.log10(np.sqrt(np.mean(mono ** 2)) + 1e-12), 2),
        "longestBelowMinus43DbSeconds": round(longest * 0.5, 2),
    }


def main():
    sources = base.load_sources()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for piece in base.build_specs():
        bed_events, phrase_events = classify(piece["events"])
        bed = render_events(sources, bed_events, piece["lowpass_hz"])
        phrase = render_events(sources, phrase_events, min(piece["lowpass_hz"] + 250, 4200))
        # Keep the phrase as a true accent: it should never dominate the bed.
        mix = bed * 0.86 + phrase * 0.34
        stem_specs = [
            (f"{piece['id']}_harmonic_bed", "harmonic bed", bed, -19.0,
             "持续和声层；没有噪声底床，没有鼓点。"),
            (f"{piece['id']}_upper_phrase", "upper phrase", phrase, -24.0,
             "稀疏上层短句；默认低于底层，只作为可替换点缀。"),
            (f"{piece['id']}_finished_mix", "finished mix", mix, -20.0,
             "由同一套底层与上层组合得到的可试听成品。"),
        ]
        for asset_id, role, audio, gain, intent in stem_specs:
            _, mp3, rendered = write_audio(asset_id, audio, normalize_db=gain)
            items.append({
                "id": asset_id,
                "parentPiece": piece["id"],
                "goal": piece["goal"],
                "role": role,
                "title": f"{piece['title']} · {role}",
                "intent": intent,
                "publicPath": "/" + str(mp3.relative_to(ROOT / "public")),
                "reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
                "localPath": str(mp3),
                "metrics": metrics(rendered),
            })

    manifest = {
        "batch": "controlled-stem-factory-008",
        "route": "007 deterministic VCSL CC0 arrangement split into reusable stems",
        "sourceCommit": base.SOURCE_COMMIT,
        "license": "CC0-1.0",
        "paidApi": False,
        "generativeModel": False,
        "roles": ["harmonic bed", "upper phrase", "finished mix"],
        "rightsStatement": "SNOOZE owns the new arrangement, split, and rendered masters; VCSL source samples remain non-exclusive CC0 material.",
        "items": items,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} reusable stem/mix assets")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""<article class="card"><p class="eyebrow">{base.escape(item['goal'])} · {base.escape(item['role'])}</p>
<h2>{base.escape(item['title'])}</h2><audio controls preload="metadata" src="{base.escape(item['reviewPath'])}"></audio>
<p>{base.escape(item['intent'])}</p><details><summary>权利 / QA</summary>
<pre>{base.escape(json.dumps(item['metrics'], indent=2, ensure_ascii=False))}</pre>
<p>编排和拆分由 SNOOZE 代码完成；底层 VCSL Kawai 采样固定提交为 CC0 1.0。</p></details></article>""")
    html = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controlled Stem Factory 008</title>
<style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:940px;margin:auto;padding:30px 18px 60px}}.hero{{padding:22px 0;border-bottom:1px solid #405047}}.card{{padding:18px 0;border-bottom:1px solid #2f3934}}.eyebrow{{font-size:12px;text-transform:uppercase;color:#aebeb2}}audio{{width:100%;margin:10px 0}}summary{{color:#d6c096;cursor:pointer}}pre{{white-space:pre-wrap;color:#d9e5d9}}</style></head>
<body><main><section class="hero"><p class="eyebrow">SNOOZE · controlled stem factory 008</p><h1>可组合的基础层与成品混音</h1><p>这批不是新增歌曲，而是把 007 的自有编排拆成 harmonic bed、upper phrase 和 finished mix。仍然不使用白噪音、蜂鸣、鼓点、付费 API 或生成模型。</p></section>{''.join(cards)}</main></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
