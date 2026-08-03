#!/usr/bin/env python3
"""Less mechanical, more connected VCSL piano arrangements for listening QA."""
import importlib.util
import json
import math
import subprocess
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts/generate-controlled-stem-factory-007.py"
SOURCE_DIR = ROOT / "assets/audio-sources/vcsl-kawai-soft"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-009"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-009"

module_spec = importlib.util.spec_from_file_location("factory007", BASE_PATH)
base = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(base)

ANCHORS = ["C2", "F2", "A2", "C3", "E3", "G3", "B3", "D4", "F4", "A4", "C5"]
MIDI = base.NOTE_MIDI


def load_sources():
    sources = {}
    for note in ANCHORS:
        variants = []
        for layer in ("v1", "v2"):
            path = SOURCE_DIR / f"{note}_{layer}.wav"
            if not path.exists():
                raise SystemExit("Missing expanded VCSL samples. Run: pnpm fetch:vcsl-kawai-soft")
            audio, sample_rate = sf.read(path, always_2d=True)
            if sample_rate != base.SR:
                audio = resample_poly(audio, base.SR, sample_rate, axis=0)
            if audio.shape[1] == 1:
                audio = np.repeat(audio, 2, axis=1)
            audio = audio.astype(np.float64)
            audio -= np.mean(audio, axis=0, keepdims=True)
            peak = max(float(np.max(np.abs(audio))), 1e-9)
            variants.append(audio / peak)
        sources[note] = (MIDI[note], variants)
    return sources


def pitched_source(sources, target_midi, layer):
    _, (source_midi, variants) = min(sources.items(), key=lambda item: abs(item[1][0] - target_midi))
    audio = variants[layer]
    semitones = target_midi - source_midi
    speed = 2 ** (semitones / 12)
    ratio = Fraction(1 / speed).limit_denominator(1000)
    return resample_poly(audio, ratio.numerator, ratio.denominator, axis=0), abs(semitones)


def natural_note(sources, event, rng):
    layer = event.get("layer", int(rng.random() > 0.72))
    source, shift = pitched_source(sources, MIDI[event["note"]], layer)
    duration = event["duration"] * rng.uniform(0.96, 1.04)
    length = min(len(source), int(duration * base.SR))
    audio = source[:length].copy()
    attack_seconds = rng.uniform(0.025, 0.085)
    attack = min(length, int(attack_seconds * base.SR))
    release = min(length, int(min(3.2, duration * 0.52) * base.SR))
    envelope = np.ones(length)
    if attack:
        envelope[:attack] = np.sin(np.linspace(0, math.pi / 2, attack)) ** rng.uniform(1.0, 1.45)
    if release:
        envelope[-release:] *= np.cos(np.linspace(0, math.pi / 2, release)) ** rng.uniform(1.25, 1.65)
    velocity = event["velocity"] * rng.uniform(0.91, 1.07)
    audio *= envelope[:, None] * velocity
    pan = max(-0.35, min(0.35, event.get("pan", 0.0) + rng.uniform(-0.035, 0.035)))
    audio[:, 0] *= math.cos((pan + 1) * math.pi / 4)
    audio[:, 1] *= math.sin((pan + 1) * math.pi / 4)
    return audio, shift


def render_piece(sources, spec):
    rng = np.random.default_rng(spec["seed"])
    mix = np.zeros((int(base.DURATION * base.SR), 2), dtype=np.float64)
    max_pitch_shift = 0
    for event in spec["events"]:
        audio, shift = natural_note(sources, event, rng)
        max_pitch_shift = max(max_pitch_shift, shift)
        start = max(0, event["start"] + rng.uniform(-0.075, 0.075))
        offset = int(start * base.SR)
        end = min(len(mix), offset + len(audio))
        mix[offset:end] += audio[:end - offset]

    # Early reflections only; no large ambient reverb or synthetic wash.
    dry = mix.copy()
    for delay_seconds, gain in ((0.029, 0.018), (0.047, 0.012)):
        delay = int(delay_seconds * base.SR)
        mix[delay:] += dry[:-delay] * gain
    sos = butter(3, spec["lowpass_hz"], btype="lowpass", fs=base.SR, output="sos")
    mix = sosfiltfilt(sos, mix, axis=0)
    fade_in = int(1.1 * base.SR)
    fade_out = int(7.0 * base.SR)
    mix[:fade_in] *= np.sin(np.linspace(0, math.pi / 2, fade_in))[:, None] ** 1.25
    mix[-fade_out:] *= np.cos(np.linspace(0, math.pi / 2, fade_out))[:, None] ** 1.5
    peak = max(float(np.max(np.abs(mix))), 1e-9)
    return mix / peak * base.db_to_amp(-7.0), max_pitch_shift


def make_events(sections, upper_line, upper_spacing, chord_duration):
    events = []
    for section_index, (start, chord) in enumerate(sections):
        for index, note in enumerate(chord):
            events.append({"start": start + index * 0.07, "note": note,
                           "duration": chord_duration, "velocity": 0.105 - index * 0.01,
                           "pan": (-0.17, 0.0, 0.17)[index]})
        section_end = sections[section_index + 1][0] if section_index + 1 < len(sections) else 90.5
        cursor = start + 0.95
        step = section_index * 4
        while cursor < section_end - 0.45:
            events.append({"start": cursor, "note": upper_line[step % len(upper_line)],
                           "duration": upper_spacing[step % len(upper_spacing)] + 1.35,
                           "velocity": 0.064, "pan": 0.11 if step % 2 == 0 else -0.09})
            cursor += upper_spacing[step % len(upper_spacing)]
            step += 1
    return events


def specs():
    sleep = [(0.35, ("C3", "E3", "G3")), (8.0, ("A2", "E3", "G3")),
             (15.7, ("F2", "C3", "E3")), (23.5, ("C3", "E3", "G3")),
             (31.4, ("A2", "E3", "G3")), (39.2, ("F2", "C3", "E3")),
             (47.1, ("C3", "E3", "G3")), (55.0, ("A2", "E3", "G3")),
             (63.0, ("F2", "C3", "E3")), (71.0, ("C3", "E3", "G3")),
             (79.0, ("F2", "C3", "E3")), (87.0, ("C3", "E3", "G3"))]
    meditation = [(0.35, ("C3", "G3", "C4")), (7.5, ("F2", "C3", "A3")),
                  (15.0, ("A2", "E3", "C4")), (22.5, ("G2", "D3", "B3")),
                  (30.0, ("C3", "G3", "E4")), (37.6, ("F2", "C3", "A3")),
                  (45.2, ("A2", "E3", "C4")), (52.8, ("G2", "D3", "B3")),
                  (60.4, ("C3", "G3", "E4")), (68.0, ("F2", "C3", "A3")),
                  (75.7, ("A2", "E3", "C4")), (83.5, ("C3", "G3", "E4"))]
    focus = [(0.3, ("C3", "G3", "D4")), (6.8, ("A2", "E3", "B3")),
             (13.6, ("F2", "C3", "G3")), (20.4, ("G2", "D3", "A3")),
             (27.2, ("C3", "G3", "D4")), (34.0, ("A2", "E3", "B3")),
             (40.8, ("F2", "C3", "G3")), (47.6, ("G2", "D3", "A3")),
             (54.4, ("C3", "G3", "D4")), (61.2, ("A2", "E3", "B3")),
             (68.0, ("F2", "C3", "G3")), (74.8, ("G2", "D3", "A3")),
             (81.6, ("C3", "G3", "D4")), (88.2, ("C3", "G3", "C4"))]
    return [
        {"id": "sleep_connected_humanized_009", "goal": "Sleep", "seed": 901, "lowpass_hz": 3150,
         "title": "Sleep Connected Humanized 009",
         "intent": "缩短段落空档，使用两层真实采样和轻微演奏变化，保持低能量。",
         "events": make_events(sleep, ["E3", "G3", "C4", "B3", "G3", "E3"], (2.15, 2.4, 2.25), 8.9)},
        {"id": "meditation_connected_humanized_009", "goal": "Meditation", "seed": 902, "lowpass_hz": 3400,
         "title": "Meditation Connected Humanized 009",
         "intent": "用交叠和呼吸式微变化连接乐句，不依赖机械循环或大混响。",
         "events": make_events(meditation, ["G3", "C4", "E4", "D4", "C4", "A3"], (1.95, 2.2, 2.05, 2.35), 8.5)},
        {"id": "focus_connected_humanized_009", "goal": "Focus", "seed": 903, "lowpass_hz": 3700,
         "title": "Focus Connected Humanized 009",
         "intent": "更连续但无鼓点，降低重复触发造成的机器演奏感。",
         "events": make_events(focus, ["G3", "D4", "B3", "E4", "D4", "A3"], (1.7, 1.9, 1.8), 7.8)},
    ]


def silence_metrics(path):
    audio, sr = sf.read(path, always_2d=True)
    mono = audio.mean(axis=1)
    frame = int(0.25 * sr)
    rms = np.array([np.sqrt(np.mean(mono[i:i + frame] ** 2)) for i in range(0, len(mono) - frame, frame)])
    quiet = rms < base.db_to_amp(-43)
    longest = current = 0
    for value in quiet:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return {"durationSeconds": round(len(mono) / sr, 2),
            "longestBelowMinus43DbSecondsIncludingFade": round(longest * 0.25, 2)}


def main():
    sources = load_sources()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for item_spec in specs():
        audio, max_shift = render_piece(sources, item_spec)
        wav = OUT_DIR / f"{item_spec['id']}.wav"
        mp3 = OUT_DIR / f"{item_spec['id']}.mp3"
        sf.write(wav, audio, base.SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
                        "-af", "loudnorm=I=-20:LRA=5:TP=-4", "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
        record = {key: item_spec[key] for key in ("id", "goal", "title", "intent")}
        record.update({"reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
                       "publicPath": "/" + str(mp3.relative_to(ROOT / "public")),
                       "maxSourcePitchShiftSemitones": max_shift, "metrics": silence_metrics(mp3)})
        items.append(record)
    manifest = {"batch": "controlled-stem-factory-009",
                "changesFrom008": ["shorter overlapping phrases", "two real velocity layers",
                                      "expanded native pitch anchors", "deterministic timing/velocity/pan humanization"],
                "license": "CC0-1.0", "paidApi": False, "generativeModel": False,
                "items": items}
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} connected humanized pieces")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""<article><p class="eyebrow">{base.escape(item['goal'])}</p><h2>{base.escape(item['title'])}</h2>
<audio controls preload="metadata" src="{base.escape(item['reviewPath'])}"></audio><p>{base.escape(item['intent'])}</p>
<details><summary>009 修正 / QA</summary><pre>{base.escape(json.dumps(item['metrics'], indent=2, ensure_ascii=False))}</pre>
<p>两层 VCSL CC0 钢琴采样；最大音高拉伸 {item['maxSourcePitchShiftSemitones']} 个半音；无 API、无生成模型。</p></details></article>""")
    html = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controlled Stem Factory 009</title><style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:900px;margin:auto;padding:30px 18px 60px}}header,article{{padding:21px 0;border-bottom:1px solid #344139}}.eyebrow{{font-size:12px;color:#aebeb2;text-transform:uppercase}}audio{{width:100%;margin:10px 0}}summary{{cursor:pointer;color:#d6c096}}pre{{white-space:pre-wrap}}</style></head><body><main><header><p class="eyebrow">SNOOZE · batch 009</p><h1>更紧密、更接近真实演奏</h1><p>根据 008 反馈，缩短乐句间隔，并从单一固定采样升级为两层真实采样与确定性演奏微变化。试听页只呈现最终成品。</p></header>{''.join(cards)}</main></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
