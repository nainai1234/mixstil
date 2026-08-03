#!/usr/bin/env python3
import json
import math
import subprocess
from fractions import Fraction
from html import escape
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets/audio-sources/vcsl-kawai-soft"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-007"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-007"
SR = 44100
DURATION = 96.0
SOURCE_COMMIT = "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e"

NOTE_MIDI = {
    "C2": 36, "D2": 38, "E2": 40, "F2": 41, "G2": 43, "A2": 45,
    "B2": 47, "C3": 48, "D3": 50, "E3": 52, "F3": 53, "G3": 55,
    "A3": 57, "B3": 59, "C4": 60, "D4": 62, "E4": 64, "F4": 65,
    "G4": 67, "A4": 69, "B4": 71, "C5": 72,
}
SOURCE_NOTES = {"C2": 36, "C3": 48, "E3": 52, "G3": 55, "B3": 59,
                "D4": 62, "F4": 65, "A4": 69, "C5": 72}


def db_to_amp(db):
    return 10 ** (db / 20)


def load_sources():
    missing = [SOURCE_DIR / f"{name}.wav" for name in SOURCE_NOTES if not (SOURCE_DIR / f"{name}.wav").exists()]
    if missing:
        raise SystemExit("Missing VCSL sources. Run: bash scripts/fetch-vcsl-kawai-soft-samples.sh")
    sources = {}
    for name, midi in SOURCE_NOTES.items():
        audio, sample_rate = sf.read(SOURCE_DIR / f"{name}.wav", always_2d=True)
        if sample_rate != SR:
            audio = resample_poly(audio, SR, sample_rate, axis=0)
        if audio.shape[1] == 1:
            audio = np.repeat(audio, 2, axis=1)
        audio = audio.astype(np.float64)
        audio -= np.mean(audio, axis=0, keepdims=True)
        peak = max(float(np.max(np.abs(audio))), 1e-9)
        sources[name] = (midi, audio / peak)
    return sources


def pitch_sample(sources, target_midi):
    _, (source_midi, sample) = min(sources.items(), key=lambda item: abs(item[1][0] - target_midi))
    speed = 2 ** ((target_midi - source_midi) / 12)
    ratio = Fraction(1 / speed).limit_denominator(1000)
    return resample_poly(sample, ratio.numerator, ratio.denominator, axis=0)


def soft_note(sources, note_name, duration, velocity, pan=0.0):
    audio = pitch_sample(sources, NOTE_MIDI[note_name])
    length = min(len(audio), int(duration * SR))
    audio = audio[:length].copy()
    attack = min(length, int(0.065 * SR))
    release = min(length, int(min(2.8, duration * 0.48) * SR))
    envelope = np.ones(length)
    if attack:
        envelope[:attack] = np.sin(np.linspace(0, math.pi / 2, attack)) ** 1.35
    if release:
        envelope[-release:] *= np.cos(np.linspace(0, math.pi / 2, release)) ** 1.6
    audio *= envelope[:, None] * velocity
    left = math.cos((pan + 1) * math.pi / 4)
    right = math.sin((pan + 1) * math.pi / 4)
    audio[:, 0] *= left
    audio[:, 1] *= right
    return audio


def add_event(mix, sources, start, note, duration, velocity, pan=0.0):
    audio = soft_note(sources, note, duration, velocity, pan)
    offset = int(start * SR)
    end = min(len(mix), offset + len(audio))
    if end > offset:
        mix[offset:end] += audio[:end - offset]


def arrange(sources, spec):
    mix = np.zeros((int(DURATION * SR), 2), dtype=np.float64)
    for event in spec["events"]:
        add_event(mix, sources, **event)

    # A very short room reflection keeps the sampled piano cohesive without an ambient wash.
    room = mix.copy()
    for delay_seconds, gain in ((0.037, 0.035), (0.061, 0.022)):
        delay = int(delay_seconds * SR)
        room[delay:] += mix[:-delay] * gain

    sos = butter(3, spec["lowpass_hz"], btype="lowpass", fs=SR, output="sos")
    room = sosfiltfilt(sos, room, axis=0)
    fade_in = int(1.8 * SR)
    fade_out = int(8.0 * SR)
    room[:fade_in] *= np.sin(np.linspace(0, math.pi / 2, fade_in))[:, None] ** 1.4
    room[-fade_out:] *= np.cos(np.linspace(0, math.pi / 2, fade_out))[:, None] ** 1.7
    peak = max(float(np.max(np.abs(room))), 1e-9)
    room = room / peak * db_to_amp(-6.0)
    return room


def events_from_sections(sections, melody, spacing, chord_duration, melody_duration):
    events = []
    pans = (-0.18, 0.0, 0.18)
    for section_index, (start, chord) in enumerate(sections):
        for index, note in enumerate(chord):
            events.append({"start": start + index * 0.08, "note": note,
                           "duration": chord_duration, "velocity": 0.105 - index * 0.012,
                           "pan": pans[index % len(pans)]})
        phrase_end = sections[section_index + 1][0] if section_index + 1 < len(sections) else DURATION - 7
        cursor = start + 1.3
        melody_index = section_index * 3
        while cursor < phrase_end - 0.8:
            note = melody[melody_index % len(melody)]
            events.append({"start": cursor, "note": note, "duration": melody_duration,
                           "velocity": 0.072, "pan": (-0.12 if melody_index % 2 else 0.12)})
            cursor += spacing[melody_index % len(spacing)]
            melody_index += 1
    return events


def build_specs():
    sleep_sections = [(0.5, ("C3", "E3", "G3")), (11.5, ("A2", "E3", "G3")),
                      (23.0, ("F2", "C3", "E3")), (35.0, ("C3", "E3", "G3")),
                      (47.0, ("A2", "E3", "G3")), (59.0, ("F2", "C3", "E3")),
                      (71.0, ("C3", "E3", "G3")), (83.0, ("C3", "E3", "G3"))]
    meditation_sections = [(0.5, ("C3", "G3", "C4")), (10.5, ("F2", "C3", "A3")),
                           (21.0, ("A2", "E3", "C4")), (32.0, ("G2", "D3", "B3")),
                           (43.0, ("C3", "G3", "E4")), (54.0, ("F2", "C3", "A3")),
                           (65.0, ("A2", "E3", "C4")), (76.0, ("C3", "G3", "E4")),
                           (86.0, ("C3", "G3", "C4"))]
    focus_sections = [(0.4, ("C3", "G3", "D4")), (9.0, ("A2", "E3", "B3")),
                      (18.0, ("F2", "C3", "G3")), (27.0, ("G2", "D3", "A3")),
                      (36.0, ("C3", "G3", "D4")), (45.0, ("A2", "E3", "B3")),
                      (54.0, ("F2", "C3", "G3")), (63.0, ("G2", "D3", "A3")),
                      (72.0, ("C3", "G3", "D4")), (81.0, ("F2", "C3", "G3")),
                      (88.0, ("C3", "G3", "C4"))]
    return [
        {"id": "vcsl_sleep_connected_piano_007", "goal": "Sleep",
         "title": "VCSL Sleep Connected Piano 007", "lowpass_hz": 3300,
         "intent": "持续可听、低力度、无鼓点；慢来自和声运动，而不是长时间空白。",
         "events": events_from_sections(sleep_sections, ["E3", "G3", "C4", "B3", "G3", "E3"],
                                        (3.0, 3.4, 2.8), 10.2, 4.6)},
        {"id": "vcsl_meditation_breathing_piano_007", "goal": "Meditation",
         "title": "VCSL Meditation Breathing Piano 007", "lowpass_hz": 3600,
         "intent": "音符以不完全等距的呼吸式短句连接，不加入 drone、白噪音或大混响。",
         "events": events_from_sections(meditation_sections, ["G3", "C4", "E4", "D4", "C4", "A3"],
                                        (2.5, 3.0, 2.7, 3.2), 9.2, 4.2)},
        {"id": "vcsl_focus_even_piano_007", "goal": "Focus",
         "title": "VCSL Focus Even Piano 007", "lowpass_hz": 3900,
         "intent": "比睡眠版更连续清楚，但不形成鼓点、强旋律、高潮或上扬段落。",
         "events": events_from_sections(focus_sections, ["G3", "D4", "B3", "E4", "D4", "A3"],
                                        (2.1, 2.4, 2.2), 8.0, 3.5)},
    ]


def metrics(audio):
    mono = audio.mean(axis=1)
    frame = int(0.5 * SR)
    frame_rms = np.array([np.sqrt(np.mean(mono[i:i + frame] ** 2)) for i in range(0, len(mono) - frame, frame)])
    quiet = frame_rms < db_to_amp(-43)
    longest = current = 0
    for value in quiet:
        current = current + 1 if value else 0
        longest = max(longest, current)
    spectrum = np.abs(np.fft.rfft(mono)) ** 2
    frequencies = np.fft.rfftfreq(len(mono), 1 / SR)
    high_ratio = float(spectrum[frequencies >= 4000].sum() / max(spectrum.sum(), 1e-12))
    return {
        "durationSeconds": round(len(mono) / SR, 2),
        "peakDbfs": round(20 * math.log10(np.max(np.abs(mono)) + 1e-12), 2),
        "rmsDbfs": round(20 * math.log10(np.sqrt(np.mean(mono ** 2)) + 1e-12), 2),
        "longestBelowMinus43DbSeconds": round(longest * 0.5, 2),
        "energyAbove4kRatio": round(high_ratio, 5),
    }


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""
      <article class="card">
        <p class="eyebrow">自产编排 · {escape(item['goal'])}</p>
        <h2>{escape(item['title'])}</h2>
        <audio controls preload="metadata" src="{escape(item['reviewPath'])}"></audio>
        <p>{escape(item['intent'])}</p>
        <details><summary>权利来源 / QA</summary>
          <p>音符、结构、力度、声像与母带参数由本项目代码生成。底层 Kawai 钢琴采样来自 VCSL 固定提交，CC0 1.0。</p>
          <pre>{escape(json.dumps(item['metrics'], indent=2, ensure_ascii=False))}</pre>
        </details>
      </article>""")
    html = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Controlled Stem Factory 007</title><style>
body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#101312;color:#eef4ee}}
main{{max-width:900px;margin:0 auto;padding:32px 18px 60px}}.hero{{padding:24px 0;border-bottom:1px solid #405047}}
.card{{padding:20px 0;border-bottom:1px solid #2f3934}}.eyebrow{{color:#aebeb2;font-size:12px;text-transform:uppercase}}
audio{{width:100%;margin:10px 0}}summary{{cursor:pointer;color:#d6c096}}pre{{white-space:pre-wrap;color:#d9e5d9}}
</style></head><body><main><section class="hero"><p class="eyebrow">SNOOZE · controlled stem factory 007</p>
<h1>第一批权利链清晰的本地产音乐段</h1>
<p>不调用付费 API，不调用生成模型，不使用系统 DLS。我们自己写音符与结构，以 VCSL CC0 原始钢琴采样渲染。无白噪音、无蜂鸣底床、无鼓、无大混响。</p>
</section>{''.join(cards)}</main></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    sources = load_sources()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for spec in build_specs():
        audio = arrange(sources, spec)
        wav = OUT_DIR / f"{spec['id']}.wav"
        mp3 = OUT_DIR / f"{spec['id']}.mp3"
        sf.write(wav, audio, SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
                        "-af", "loudnorm=I=-20:LRA=5:TP=-4", "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
        item = {key: spec[key] for key in ("id", "goal", "title", "intent")}
        item.update({"publicPath": "/" + str(mp3.relative_to(ROOT / "public")),
                     "reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
                     "localPath": str(mp3), "metrics": metrics(audio)})
        items.append(item)
    manifest = {
        "batch": "controlled-stem-factory-007",
        "route": "self-written deterministic arrangement + pinned VCSL CC0 instrument samples + local DSP render",
        "sourceCommit": SOURCE_COMMIT,
        "license": "CC0-1.0",
        "paidApi": False,
        "generativeModel": False,
        "rightsStatement": "SNOOZE owns the new arrangement and rendered master; VCSL source samples remain non-exclusive CC0 material.",
        "items": items,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} pieces")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


if __name__ == "__main__":
    main()
