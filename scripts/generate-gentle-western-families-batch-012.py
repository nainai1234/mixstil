#!/usr/bin/env python3
"""Render four structurally distinct, original low-stimulation music families."""
import importlib.util
import json
import math
import re
import subprocess
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/audio-sources/discord-cc0-band"
OUT_DIR = ROOT / "public/audio/music/local-review/gentle-western-families-batch-012"
REVIEW_DIR = ROOT / "public/review/gentle-western-families-batch-012"
BASE_PATH = ROOT / "scripts/generate-controlled-stem-factory-010.py"
SR = 44100

module_spec = importlib.util.spec_from_file_location("factory010", BASE_PATH)
factory = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(factory)
piano_sources = factory.base009.load_sources()

MAPS = {
    "guitar": [(40, "MartinGM2_040__E2_1.wav"), (43, "MartinGM2_043__G2_1.wav"),
               (46, "MartinGM2_046_Bb2_1.wav"), (49, "MartinGM2_049_Db3_1.wav"),
               (52, "MartinGM2_052__E3_1.wav"), (55, "MartinGM2_055__G3_1.wav"),
               (58, "MartinGM2_058_Bb3_1.wav"), (61, "MartinGM2_061_Db4_1.wav"),
               (64, "MartinGM2_064__E4_1.wav"), (68, "MartinGM2_068_Ab4_1.wav"),
               (71, "MartinGM2_071__B4_1.wav"), (74, "MartinGM2_074__D5_1.wav")],
    "bass": [(24, "killer_bass_c2_vl1.wav"), (30, "killer_bass_gb2_vl1.wav"),
             (36, "killer_bass_c3_vl1.wav"), (42, "killer_bass_gb3_vl1.wav"),
             (48, "killer_bass_c4_vl1.wav")],
    "rhodes": [(40, "A_040__E2_3.wav"), (45, "A_045__A2_3.wav"),
               (50, "A_050__D3_3.wav"), (55, "A_055__G3_3.wav"),
               (59, "A_059__B3_3.wav"), (62, "A_062__D4_3.wav"),
               (65, "A_065__F4_3.wav"), (71, "A_071__B4_4.wav"),
               (76, "A_076__E5_4.wav")],
}


def load_instruments():
    result = {}
    for name, mapping in MAPS.items():
        result[name] = []
        for midi, filename in mapping:
            audio, sr = sf.read(SOURCE / name / filename, always_2d=True)
            if sr != SR:
                audio = resample_poly(audio, SR, sr, axis=0)
            if audio.shape[1] == 1:
                audio = np.repeat(audio, 2, axis=1)
            audio = audio.astype(np.float64)
            audio -= np.mean(audio, axis=0, keepdims=True)
            audio /= max(float(np.max(np.abs(audio))), 1e-9)
            result[name].append((midi, audio))
    return result


def sampled_note(sources, instrument, midi, duration, velocity, pan, rng):
    source_midi, source = min(sources[instrument], key=lambda item: abs(item[0] - midi))
    ratio = Fraction(1 / (2 ** ((midi - source_midi) / 12))).limit_denominator(1000)
    audio = resample_poly(source, ratio.numerator, ratio.denominator, axis=0)
    length = min(len(audio), int(duration * SR))
    audio = audio[:length].copy()
    attack_ranges = {"guitar": (0.025, 0.06), "bass": (0.045, 0.09), "rhodes": (0.07, 0.13)}
    attack = min(length, int(rng.uniform(*attack_ranges[instrument]) * SR))
    release = min(length, int(min(1.8, duration * 0.48) * SR))
    envelope = np.ones(length)
    envelope[:attack] = np.sin(np.linspace(0, math.pi / 2, attack)) ** 1.2
    envelope[-release:] *= np.cos(np.linspace(0, math.pi / 2, release)) ** 1.35
    audio *= envelope[:, None] * velocity * rng.uniform(0.94, 1.04)
    audio[:, 0] *= math.cos((pan + 1) * math.pi / 4)
    audio[:, 1] *= math.sin((pan + 1) * math.pi / 4)
    return audio


def add(events, instrument, start, pitch, duration, velocity, pan=0.0):
    events.append({"instrument": instrument, "start": start, "pitch": pitch,
                   "duration": duration, "velocity": velocity, "pan": pan})


def guitar_six_eight():
    events, eighth, bars = [], 60 / 52 / 3, 38
    chords = [(40, 47, 52, 55), (45, 52, 57, 59), (43, 50, 55, 59), (40, 47, 52, 55)]
    for bar in range(bars):
        chord = chords[(bar // 2) % len(chords)]
        start = bar * 6 * eighth
        for step, index in ((0, 0), (1, 2), (3, 1), (4, 3)):
            add(events, "guitar", start + step * eighth, chord[index], eighth * 3.0, 0.072, (-0.08, 0.08)[step % 2])
        if 4 <= bar < 34 and bar % 2 == 0:
            melody = (64, 67, 69, 67, 64, 62, 59, 62)
            add(events, "guitar", start + 1.8 * eighth, melody[(bar // 2) % len(melody)], eighth * 4.5, 0.058, 0.04)
    return spec("western_guitar_drift_012", "潮汐以西", "Drumless soft rock", "6/8", 52,
                "steel guitar", "rolling 6/8 arpeggio", "through-composed arc", events, bars * 6 * eighth + 6, 4600)


def modal_piano_bass():
    events, beat, bars = [], 60 / 58, 24
    chords = [("C3", "G3", "B3", "D4"), ("F2", "C3", "E3", "A3"),
              ("A2", "E3", "G3", "C4"), ("C3", "G3", "B3", "E4")]
    bass_roots = (36, 41, 45, 36)
    melody = ("E4", "G4", "A4", "G4", "D4", "E4", "C4", "D4")
    for bar in range(bars):
        start, chord_index = bar * 4 * beat, (bar // 2) % 4
        for index, note in enumerate(chords[chord_index]):
            add(events, "piano", start + index * 0.055, note, beat * 4.8, 0.050 - index * 0.005, (-0.04, -0.01, 0.015, 0.04)[index])
        if bar % 2 == 0:
            add(events, "bass", start + 0.08, bass_roots[chord_index], beat * 5.8, 0.064, -0.03)
        if 3 <= bar < 21 and bar % 2:
            add(events, "piano", start + beat * 0.65, melody[(bar // 2) % len(melody)], beat * 2.4, 0.054, 0.025)
            add(events, "piano", start + beat * 2.9, melody[(bar // 2 + 2) % len(melody)], beat * 1.8, 0.046, 0.015)
    return spec("modal_piano_long_bass_012", "远灯之间", "Modal jazz", "free 4/4", 58,
                "acoustic piano + finger bass", "long chords, rubato melody", "open modal episodes", events, bars * 4 * beat + 7, 3500)


def slowcore_three_four():
    events, beat, bars = [], 60 / 54, 29
    chords = [("A3", "E4", "A4", "C5"), ("C4", "F4", "A4", "C5"),
              ("G3", "B3", "E4", "G4"), ("D4", "G4", "B4", "C5")]
    guitar_tones = (64, 69, 67, 71, 74, 69, 72, 67)
    for bar in range(bars):
        start, chord_notes = bar * 3 * beat, chords[(bar // 3) % 4]
        for index, note in enumerate(chord_notes):
            add(events, "piano", start + index * 0.04, note, beat * 3.4, 0.019 - index * 0.0015, (-0.025, 0.0, 0.018, 0.03)[index])
        if 2 <= bar < 27:
            lead = guitar_tones[bar % len(guitar_tones)]
            add(events, "guitar", start + beat * (0.35 if bar % 2 else 1.25), lead, beat * 2.2, 0.076, 0.07)
            add(events, "guitar", start + beat * 2.05, max(40, lead - 5), beat * 1.45, 0.054, -0.055)
    return spec("slowcore_piano_guitar_012", "空房间的下午", "Slowcore calm", "3/4", 54,
                "high-register close piano + steel guitar", "airy block chords and long guitar replies", "minimal repeating rooms", events, bars * 3 * beat + 7, 3300)


def rhodes_focus():
    events, beat, bars = [], 60 / 72, 30
    chords = [(45, 52, 55, 59), (41, 48, 52, 57), (36, 43, 47, 52), (43, 50, 55, 59)]
    roots = (33, 29, 36, 31)
    for bar in range(bars):
        start, index = bar * 4 * beat, (bar // 2) % 4
        chord_notes = chords[index]
        for offset, gain in ((0.0, 0.048), (2.45, 0.039)):
            for voice, midi in enumerate(chord_notes):
                add(events, "rhodes", start + offset * beat + voice * 0.025, midi, beat * 2.5, gain - voice * 0.003, (-0.05, -0.015, 0.018, 0.05)[voice])
        add(events, "bass", start + 0.05, roots[index], beat * 1.7, 0.052, -0.025)
        add(events, "bass", start + beat * 2.05, roots[index] + 7, beat * 1.45, 0.043, -0.015)
    return spec("rhodes_brushless_focus_012", "灰蓝色书桌", "Cool jazz focus", "4/4", 72,
                "Rhodes + finger bass", "soft syncopation, no drums", "steady focus cycle", events, bars * 4 * beat + 6, 4300)


def spec(piece_id, title, family, meter, bpm, lead, rhythm, form, events, duration, lowpass):
    return {"id": piece_id, "title": title, "family": family, "meter": meter, "bpm": bpm,
            "lead": lead, "rhythmIdentity": rhythm, "form": form, "events": events,
            "duration": duration, "lowpass": lowpass}


def render_piece(sources, piece, seed):
    rng = np.random.default_rng(seed)
    mix = np.zeros((int(piece["duration"] * SR), 2), dtype=np.float64)
    for event in sorted(piece["events"], key=lambda value: value["start"]):
        if event["instrument"] == "piano":
            piano_event = {"note": event["pitch"], "duration": event["duration"],
                           "velocity": event["velocity"], "pan": event["pan"], "softAttack": True}
            audio, _ = factory.natural_note(piano_sources, piano_event, rng)
        else:
            audio = sampled_note(sources, event["instrument"], event["pitch"], event["duration"],
                                 event["velocity"], event["pan"], rng)
        offset = int(max(0, event["start"] + rng.uniform(-0.025, 0.025)) * SR)
        end = min(len(mix), offset + len(audio))
        mix[offset:end] += audio[:end - offset]
    sos = butter(3, piece["lowpass"], btype="lowpass", fs=SR, output="sos")
    mix = sosfiltfilt(sos, mix, axis=0)
    fade_in, fade_out = int(1.2 * SR), int(6 * SR)
    mix[:fade_in] *= np.sin(np.linspace(0, math.pi / 2, fade_in))[:, None] ** 1.2
    mix[-fade_out:] *= np.cos(np.linspace(0, math.pi / 2, fade_out))[:, None] ** 1.5
    mix /= max(float(np.max(np.abs(mix))), 1e-9)
    return mix * 10 ** (-7 / 20)


def main():
    sources, pieces = load_instruments(), [guitar_six_eight(), modal_piano_bass(), slowcore_three_four(), rhodes_focus()]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for index, piece in enumerate(pieces):
        audio = render_piece(sources, piece, 1201 + index)
        wav, mp3 = OUT_DIR / f"{piece['id']}.wav", OUT_DIR / f"{piece['id']}.mp3"
        sf.write(wav, audio, SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
                        "-af", "acompressor=threshold=-30dB:ratio=1.7:attack=70:release=480:makeup=1.5dB,loudnorm=I=-18:LRA=5:TP=-4",
                        "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
        record = {key: piece[key] for key in ("id", "title", "family", "meter", "bpm", "lead", "rhythmIdentity", "form")}
        record.update({"durationSeconds": round(piece["duration"], 2),
                       "reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
                       "publicPath": "/" + str(mp3.relative_to(ROOT / "public"))})
        items.append(record)
    manifest = {"batch": "gentle-western-families-batch-012",
                "diversityContract": ["different lead instruments", "different meters", "different accompaniment algorithms", "different forms", "different harmonic pacing"],
                "brushDecision": "No brush sample used. The upstream Brush Kit is a sine dummy; the Cool Jazz Focus piece is honestly drumless.",
                "composition": "Original SNOOZE notes, harmony, structure, scheduling, and masters",
                "licenses": ["VCSL Kawai CC0", "Discord GM Martin steel guitar CC0", "Killer Bass CC0", "jRhodes CC0"],
                "paidApi": False, "generativeModel": False, "items": items}
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} distinct gentle western family pieces")


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""<article><p class="eyebrow">{factory.base.escape(item['family'])} · {item['meter']} · {item['bpm']} BPM</p><h2>{factory.base.escape(item['title'])}</h2><audio controls preload="metadata" src="{factory.base.escape(item['reviewPath'])}"></audio><p>{factory.base.escape(item['lead'])}；{factory.base.escape(item['rhythmIdentity'])}；{factory.base.escape(item['form'])}。</p></article>""")
    html = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gentle Western Families 012</title><style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:900px;margin:auto;padding:30px 18px 60px}}header,article{{padding:21px 0;border-bottom:1px solid #344139}}.eyebrow{{font-size:12px;color:#aebeb2;text-transform:uppercase}}audio{{width:100%;margin:10px 0}}</style></head><body><main><header><p class="eyebrow">SNOOZE · batch 012</p><h1>四种真正不同的西方低刺激音乐</h1><p>主奏乐器、拍号、伴奏算法、和声节奏和结构均不同。所有作品原创、本地渲染、无付费 API。Brush Kit 因上游只是正弦占位符而未使用，Cool Jazz Focus 为诚实的无鼓版本。</p></header>{''.join(cards)}</main></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
