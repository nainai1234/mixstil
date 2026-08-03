#!/usr/bin/env python3
"""Compose and render original gentle lyrical piano pieces."""
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts/generate-controlled-stem-factory-010.py"
OUT_DIR = ROOT / "public/audio/music/local-review/original-lyrical-piano-batch-011"
REVIEW_DIR = ROOT / "public/review/original-lyrical-piano-batch-011"

module_spec = importlib.util.spec_from_file_location("factory010", BASE_PATH)
factory = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(factory)
base009 = factory.base009
base = factory.base


def chord(root, *notes):
    return (root,) + notes


def accompaniment_events(progression, seconds_per_beat, section_levels):
    events = []
    for bar_index, voicing in enumerate(progression):
        start = bar_index * 4 * seconds_per_beat
        level = section_levels[min(bar_index // 4, len(section_levels) - 1)]
        pattern = ((0.0, 0, 3.8, 0.070), (0.72, 1, 3.0, 0.052),
                   (1.68, 2, 2.7, 0.046), (2.72, 3, 2.35, 0.041))
        for beat, note_index, beats, velocity in pattern:
            events.append({"start": start + beat * seconds_per_beat,
                           "note": voicing[note_index % len(voicing)],
                           "duration": beats * seconds_per_beat,
                           "velocity": velocity * level,
                           "pan": (-0.035, -0.018, 0.012, 0.032)[note_index],
                           "softAttack": True})
    return events


def melody_events(patterns, seconds_per_beat, section_starts, levels):
    events = []
    for section_index, (start_bar, pattern_set) in enumerate(zip(section_starts, patterns)):
        level = levels[section_index]
        for local_bar, bar_notes in enumerate(pattern_set):
            bar_start = (start_bar + local_bar) * 4 * seconds_per_beat
            for beat, note, beats in bar_notes:
                events.append({"start": bar_start + beat * seconds_per_beat,
                               "note": note, "duration": beats * seconds_per_beat,
                               "velocity": 0.060 * level,
                               "pan": 0.008, "softAttack": False})
    return events


def repeat_progression(parts):
    result = []
    for progression, repeats in parts:
        for _ in range(repeats):
            result.extend(progression)
    return result


def piece_specs():
    c = chord("C2", "G2", "E3", "G3")
    am = chord("A2", "E3", "G3", "C4")
    f = chord("F2", "C3", "E3", "A3")
    g = chord("G2", "D3", "G3", "B3")
    em = chord("E2", "B2", "E3", "G3")
    dm = chord("D2", "A2", "D3", "F3")

    night_progression = repeat_progression([
        ([c, am, f, g], 1), ([c, am, f, g], 2), ([am, em, f, g], 2),
        ([c, am, f, g], 2), ([f, g, c, c], 1),
    ])
    night_a = [
        [(0.6, "E4", 1.4), (2.3, "G4", 1.1)], [(0.4, "A4", 1.7), (2.5, "G4", 1.0)],
        [(0.5, "E4", 1.2), (2.0, "D4", 1.5)], [(0.5, "C4", 2.8)],
        [(0.5, "E4", 1.3), (2.2, "G4", 1.1)], [(0.4, "A4", 1.5), (2.2, "C5", 1.2)],
        [(0.5, "A4", 1.0), (1.9, "G4", 1.0), (3.0, "E4", 0.8)], [(0.4, "D4", 1.2), (1.9, "C4", 2.0)],
    ]
    night_b = [
        [(0.5, "A4", 1.4), (2.2, "C5", 1.2)], [(0.4, "B4", 1.3), (2.0, "G4", 1.5)],
        [(0.6, "A4", 1.2), (2.2, "G4", 1.2)], [(0.5, "E4", 2.8)],
        [(0.4, "G4", 1.3), (2.0, "A4", 1.4)], [(0.5, "C5", 1.5), (2.4, "A4", 1.0)],
        [(0.5, "G4", 1.2), (2.1, "E4", 1.4)], [(0.5, "D4", 1.2), (2.0, "C4", 1.8)],
    ]

    street_progression = repeat_progression([
        ([dm, f, c, am], 1), ([dm, f, c, am], 2), ([f, c, dm, am], 2),
        ([dm, f, c, am], 2), ([f, c, dm, dm], 1),
    ])
    street_a = [
        [(0.5, "A3", 1.0), (1.8, "D4", 1.4)], [(0.4, "F4", 1.4), (2.2, "E4", 1.2)],
        [(0.5, "G4", 1.2), (2.0, "E4", 1.4)], [(0.5, "C4", 2.7)],
        [(0.4, "D4", 1.1), (1.9, "F4", 1.3)], [(0.5, "A4", 1.5), (2.5, "G4", 0.9)],
        [(0.4, "E4", 1.1), (1.8, "D4", 1.2), (3.1, "C4", 0.7)], [(0.5, "A3", 2.8)],
    ]
    street_b = [
        [(0.4, "F4", 1.1), (1.8, "A4", 1.5)], [(0.5, "G4", 1.2), (2.1, "E4", 1.3)],
        [(0.4, "D4", 1.0), (1.7, "F4", 1.5)], [(0.5, "A4", 1.3), (2.2, "G4", 1.2)],
        [(0.5, "E4", 1.3), (2.3, "D4", 1.1)], [(0.4, "C4", 1.0), (1.8, "E4", 1.5)],
        [(0.5, "D4", 1.1), (2.0, "C4", 1.3)], [(0.5, "A3", 2.8)],
    ]

    sea_progression = repeat_progression([
        ([em, c, g, dm], 1), ([em, c, g, dm], 2), ([c, g, am, em], 2),
        ([em, c, g, dm], 2), ([c, dm, em, em], 1),
    ])
    sea_a = [
        [(0.6, "E4", 1.6), (2.5, "G4", 0.9)], [(0.5, "A4", 1.4), (2.4, "G4", 1.0)],
        [(0.6, "D4", 1.3), (2.3, "E4", 1.2)], [(0.5, "A3", 2.9)],
        [(0.5, "B3", 1.1), (1.9, "E4", 1.5)], [(0.6, "G4", 1.5), (2.6, "A4", 0.8)],
        [(0.5, "G4", 1.1), (2.0, "E4", 1.4)], [(0.6, "D4", 1.1), (2.1, "B3", 1.7)],
    ]
    sea_b = [
        [(0.5, "G4", 1.2), (2.1, "A4", 1.4)], [(0.6, "C5", 1.5), (2.6, "A4", 0.8)],
        [(0.5, "G4", 1.3), (2.3, "E4", 1.1)], [(0.6, "D4", 2.7)],
        [(0.5, "E4", 1.1), (1.9, "G4", 1.5)], [(0.6, "A4", 1.4), (2.5, "G4", 0.9)],
        [(0.5, "E4", 1.2), (2.1, "D4", 1.3)], [(0.6, "B3", 1.1), (2.1, "E4", 1.7)],
    ]

    return [
        build_piece("letters_beside_the_night_window_011", "夜窗旁的信", "Calm", 62,
                    night_progression, night_a, night_b, 1101, 3200,
                    "温柔明亮、略带怀念的夜晚钢琴叙事。"),
        build_piece("the_street_after_the_wind_011", "风停后的街道", "Unwind", 66,
                    street_progression, street_a, street_b, 1102, 3450,
                    "带轻微行走感但不急促，旋律克制、自然回落。"),
        build_piece("homeward_under_blue_water_011", "蓝色水面下的归途", "Sleep", 58,
                    sea_progression, sea_a, sea_b, 1103, 2950,
                    "更慢、更深、更安静，保留叙事感但没有情绪高潮。"),
    ]


def build_piece(piece_id, title, goal, bpm, progression, motif_a, motif_b, seed, lowpass_hz, intent):
    seconds_per_beat = 60 / bpm
    section_levels = (0.72, 0.78, 0.88, 0.91, 0.90, 0.86, 0.82, 0.72)
    accompaniment = accompaniment_events(progression, seconds_per_beat, section_levels)
    # Intro 4 bars, A 8, B 8, A' 8, coda 4. The returned A' is slightly
    # softer, preventing a late cinematic build.
    melody = melody_events([motif_a, motif_b, motif_a, [
        [(0.6, motif_a[0][0][1], 1.6)], [(0.6, motif_a[1][0][1], 1.5)],
        [(0.6, motif_a[2][0][1], 1.4)], [(0.6, motif_a[3][0][1], 2.7)],
    ]], seconds_per_beat, (4, 12, 20, 28), (0.86, 0.92, 0.82, 0.68))
    duration = len(progression) * 4 * seconds_per_beat + 7.0
    return {"id": piece_id, "title": title, "goal": goal, "bpm": bpm,
            "form": "intro-A-B-A'-coda", "seed": seed, "lowpass_hz": lowpass_hz,
            "intent": intent, "duration": duration, "events": accompaniment + melody}


def render_piece(sources, spec):
    rng = np.random.default_rng(spec["seed"])
    mix = np.zeros((int(spec["duration"] * base.SR), 2), dtype=np.float64)
    max_shift = 0
    for event in sorted(spec["events"], key=lambda value: value["start"]):
        audio, shift = factory.natural_note(sources, event, rng)
        max_shift = max(max_shift, shift)
        start = max(0, event["start"] + rng.uniform(-0.032, 0.032))
        offset = int(start * base.SR)
        end = min(len(mix), offset + len(audio))
        mix[offset:end] += audio[:end - offset]
    mid = (mix[:, 0] + mix[:, 1]) * 0.5
    side = (mix[:, 0] - mix[:, 1]) * 0.5 * 0.50
    mix[:, 0], mix[:, 1] = mid + side, mid - side
    sos = butter(3, spec["lowpass_hz"], btype="lowpass", fs=base.SR, output="sos")
    mix = sosfiltfilt(sos, mix, axis=0)
    fade_in, fade_out = int(1.3 * base.SR), int(6.5 * base.SR)
    mix[:fade_in] *= np.sin(np.linspace(0, math.pi / 2, fade_in))[:, None] ** 1.2
    mix[-fade_out:] *= np.cos(np.linspace(0, math.pi / 2, fade_out))[:, None] ** 1.5
    peak = max(float(np.max(np.abs(mix))), 1e-9)
    return mix / peak * base.db_to_amp(-7), max_shift


def main():
    sources = base009.load_sources()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for spec in piece_specs():
        audio, max_shift = render_piece(sources, spec)
        wav, mp3 = OUT_DIR / f"{spec['id']}.wav", OUT_DIR / f"{spec['id']}.mp3"
        sf.write(wav, audio, base.SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
                        "-af", "bass=g=3:f=180:w=0.7,acompressor=threshold=-29dB:ratio=1.7:attack=70:release=480:makeup=1.8dB,loudnorm=I=-17:LRA=5:TP=-3",
                        "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
        items.append({"id": spec["id"], "title": spec["title"], "goal": spec["goal"],
                      "bpm": spec["bpm"], "form": spec["form"], "intent": spec["intent"],
                      "durationSeconds": round(spec["duration"], 2), "maxSourcePitchShiftSemitones": max_shift,
                      "reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
                      "publicPath": "/" + str(mp3.relative_to(ROOT / "public"))})
    manifest = {"batch": "original-lyrical-piano-batch-011",
                "composition": "Original SNOOZE melodies, harmony, form, performance scheduling, and masters",
                "styleBoundary": "High-level gentle East Asian lyrical piano traits only; no melody, MIDI, harmony transcription, or audio copied from named references.",
                "instrumentSource": "Pinned VCSL Kawai piano samples", "license": "CC0-1.0",
                "paidApi": False, "generativeModel": False, "items": items}
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} original lyrical piano pieces")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""<article><p class="eyebrow">{base.escape(item['goal'])} · {item['bpm']} BPM</p><h2>{base.escape(item['title'])}</h2>
<audio controls preload="metadata" src="{base.escape(item['reviewPath'])}"></audio><p>{base.escape(item['intent'])}</p>
<details><summary>创作与权利</summary><p>原创旋律、和声与 {base.escape(item['form'])} 结构；VCSL CC0 钢琴采样；无 API、无生成模型、无参考音频或 MIDI 复制。</p></details></article>""")
    html = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>原创东方抒情钢琴 011</title><style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:900px;margin:auto;padding:30px 18px 60px}}header,article{{padding:21px 0;border-bottom:1px solid #344139}}.eyebrow{{font-size:12px;color:#aebeb2;text-transform:uppercase}}audio{{width:100%;margin:10px 0}}summary{{cursor:pointer;color:#d6c096}}</style></head><body><main><header><p class="eyebrow">SNOOZE · original lyrical piano 011</p><h1>原创、完整、轻柔的钢琴纯音乐</h1><p>从功能性声景切换到完整钢琴作品：前奏、主题、发展、回归与尾声。借鉴东方抒情与夜晚叙事的高层语言，但不复制任何已有作品。</p></header>{''.join(cards)}</main></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
