#!/usr/bin/env python3
"""Reference-informed, independently arranged VCSL piano soundscapes."""
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, find_peaks, sosfiltfilt, welch

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts/generate-controlled-stem-factory-009.py"
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-010"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-010"
REFERENCE = Path("/Users/pang/Downloads/Unlit_Corners.mp3")

module_spec = importlib.util.spec_from_file_location("factory009", BASE_PATH)
base009 = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(base009)
base = base009.base


def connected_events(sections, line, spacing, chord_duration):
    events = []
    for section_index, (start, chord) in enumerate(sections):
        # Rich voicing stays stable. The low notes carry warmth; upper chord
        # members are softer so this does not become a sequence of block chords.
        velocities = (0.105, 0.082, 0.067, 0.052, 0.043)
        pans = (-0.035, -0.018, 0.0, 0.018, 0.035)
        for index, note in enumerate(chord):
            events.append({"start": start + index * 0.045, "note": note,
                           "duration": chord_duration, "velocity": velocities[index],
                           "pan": pans[index], "softAttack": True})

        section_end = sections[section_index + 1][0] if section_index + 1 < len(sections) else 91.0
        # Re-touch only the two lowest chord members halfway through the long
        # section to prevent a loud onset followed by a deep energy valley.
        midpoint = start + (section_end - start) * 0.52
        for index, note in enumerate(chord[:2]):
            events.append({"start": midpoint + index * 0.05, "note": note,
                           "duration": chord_duration * 0.65, "velocity": 0.061 - index * 0.008,
                           "pan": (-0.025, 0.025)[index], "softAttack": True})

        cursor = start + 0.8
        phrase_index = section_index * 7
        while cursor < section_end - 0.35:
            events.append({"start": cursor, "note": line[phrase_index % len(line)],
                           "duration": spacing[phrase_index % len(spacing)] + 2.0,
                           "velocity": 0.037 + (0.004 if phrase_index % 5 == 0 else 0),
                           "pan": 0.025 if phrase_index % 2 == 0 else -0.025,
                           "softAttack": True})
            cursor += spacing[phrase_index % len(spacing)]
            phrase_index += 1
    return events


def natural_note(sources, event, rng):
    layer = event.get("layer", int(rng.random() > 0.82))
    source, shift = base009.pitched_source(sources, base009.MIDI[event["note"]], layer)
    duration = event["duration"] * rng.uniform(0.975, 1.025)
    length = min(len(source), int(duration * base.SR))
    audio = source[:length].copy()
    attack_range = (0.095, 0.17) if event.get("softAttack") else (0.035, 0.085)
    attack = min(length, int(rng.uniform(*attack_range) * base.SR))
    release = min(length, int(min(3.5, duration * 0.55) * base.SR))
    envelope = np.ones(length)
    if attack:
        envelope[:attack] = np.sin(np.linspace(0, math.pi / 2, attack)) ** rng.uniform(1.0, 1.25)
    if release:
        envelope[-release:] *= np.cos(np.linspace(0, math.pi / 2, release)) ** rng.uniform(1.15, 1.45)
    audio *= envelope[:, None] * event["velocity"] * rng.uniform(0.94, 1.045)
    pan = max(-0.12, min(0.12, event.get("pan", 0.0) + rng.uniform(-0.012, 0.012)))
    audio[:, 0] *= math.cos((pan + 1) * math.pi / 4)
    audio[:, 1] *= math.sin((pan + 1) * math.pi / 4)
    return audio, shift


def render(sources, spec):
    rng = np.random.default_rng(spec["seed"])
    mix = np.zeros((int(base.DURATION * base.SR), 2), dtype=np.float64)
    max_shift = 0
    for event in spec["events"]:
        audio, shift = natural_note(sources, event, rng)
        max_shift = max(max_shift, shift)
        start = max(0, event["start"] + rng.uniform(-0.045, 0.045))
        offset = int(start * base.SR)
        end = min(len(mix), offset + len(audio))
        mix[offset:end] += audio[:end - offset]

    # Make the performance spatially cohesive. The reference is correlated and
    # centered; 009 was much wider and sounded like separated sample triggers.
    mid = (mix[:, 0] + mix[:, 1]) * 0.5
    side = (mix[:, 0] - mix[:, 1]) * 0.5 * 0.45
    mix[:, 0] = mid + side
    mix[:, 1] = mid - side

    # Preserve piano overtones while removing the hard upper edge. Warmth comes
    # from real low piano notes, never from a sine/noise bed.
    sos = butter(3, spec["lowpass_hz"], btype="lowpass", fs=base.SR, output="sos")
    mix = sosfiltfilt(sos, mix, axis=0)
    dry = mix.copy()
    for delay_seconds, gain in ((0.024, 0.012), (0.041, 0.008)):
        delay = int(delay_seconds * base.SR)
        mix[delay:] += dry[:-delay] * gain
    fade_in = int(1.0 * base.SR)
    fade_out = int(6.5 * base.SR)
    mix[:fade_in] *= np.sin(np.linspace(0, math.pi / 2, fade_in))[:, None] ** 1.15
    mix[-fade_out:] *= np.cos(np.linspace(0, math.pi / 2, fade_out))[:, None] ** 1.45
    peak = max(float(np.max(np.abs(mix))), 1e-9)
    return mix / peak * base.db_to_amp(-7.0), max_shift


def specs():
    sleep_sections = [
        (0.3, ("C2", "G2", "C3", "E3", "A3")),
        (15.5, ("F2", "C3", "E3", "A3", "C4")),
        (30.8, ("A2", "E3", "G3", "C4", "E4")),
        (46.1, ("C2", "G2", "C3", "E3", "A3")),
        (61.4, ("F2", "C3", "E3", "A3", "C4")),
        (76.7, ("C2", "G2", "C3", "E3", "A3")),
    ]
    meditation_sections = [
        (0.3, ("C2", "G2", "C3", "G3", "E4")),
        (14.8, ("F2", "C3", "E3", "A3", "C4")),
        (29.3, ("A2", "E3", "G3", "C4", "E4")),
        (43.8, ("C2", "G2", "C3", "G3", "E4")),
        (58.3, ("F2", "C3", "E3", "A3", "C4")),
        (72.8, ("A2", "E3", "G3", "C4", "E4")),
        (87.0, ("C2", "G2", "C3", "E3", "G3")),
    ]
    focus_sections = [
        (0.3, ("C2", "G2", "C3", "G3", "D4")),
        (12.9, ("A2", "E3", "G3", "B3", "D4")),
        (25.5, ("F2", "C3", "G3", "A3", "D4")),
        (38.1, ("C2", "G2", "C3", "G3", "D4")),
        (50.7, ("A2", "E3", "G3", "B3", "D4")),
        (63.3, ("F2", "C3", "G3", "A3", "D4")),
        (75.9, ("C2", "G2", "C3", "G3", "D4")),
        (88.0, ("C2", "G2", "C3", "E3", "G3")),
    ]
    return [
        {"id": "sleep_warm_continuous_010", "goal": "Sleep", "title": "Sleep Warm Continuous 010",
         "seed": 1001, "lowpass_hz": 2850,
         "intent": "更厚的低频承托、更频繁但更轻的触键，和声移动保持非常慢。",
         "events": connected_events(sleep_sections, ("G3", "E3", "G3", "C4", "A3", "E3"),
                                    (1.48, 1.62, 1.55), 10.8)},
        {"id": "meditation_warm_continuous_010", "goal": "Meditation", "title": "Meditation Warm Continuous 010",
         "seed": 1002, "lowpass_hz": 3100,
         "intent": "稳定和声场内的柔和交叠触键，不靠大混响制造空间。",
         "events": connected_events(meditation_sections, ("G3", "C4", "E4", "C4", "A3", "G3"),
                                    (1.38, 1.52, 1.45), 10.2)},
        {"id": "focus_warm_continuous_010", "goal": "Focus", "title": "Focus Warm Continuous 010",
         "seed": 1003, "lowpass_hz": 3400,
         "intent": "连续、居中、低刺激，触键略多但不形成鼓点或明显旋律。",
         "events": connected_events(focus_sections, ("G3", "D4", "B3", "D4", "A3", "G3"),
                                    (1.28, 1.42, 1.35), 9.6)},
    ]


def acoustic_profile(path):
    audio, sr = sf.read(path, always_2d=True, dtype="float32")
    mono = np.mean(audio, axis=1)
    rms = float(np.sqrt(np.mean(mono ** 2)) + 1e-12)
    frame = int(0.1 * sr)
    usable = mono[:len(mono) - len(mono) % frame]
    frames = usable.reshape(-1, frame)
    frame_db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-12)
    frequencies, power = welch(mono, sr, nperseg=32768)
    def energy(low, high):
        return float(np.sum(power[(frequencies >= low) & (frequencies < high)]))
    total = energy(30, sr / 2)
    envelope = np.sqrt(np.mean(frames ** 2, axis=1))
    positive_change = np.maximum(0, np.diff(envelope))
    threshold = np.percentile(positive_change, 82)
    peaks, _ = find_peaks(positive_change, height=threshold, distance=2)
    left, right = audio[:, 0], audio[:, 1]
    mid = (left + right) * 0.5
    side = (left - right) * 0.5
    return {
        "rmsDbfs": round(20 * math.log10(rms), 2),
        "crestDb": round(20 * math.log10((np.max(np.abs(mono)) + 1e-12) / rms), 2),
        "rmsP90MinusP10Db": round(float(np.percentile(frame_db, 90) - np.percentile(frame_db, 10)), 2),
        "warm80To250Percent": round(energy(80, 250) / max(total, 1e-12) * 100, 2),
        "body250To800Percent": round(energy(250, 800) / max(total, 1e-12) * 100, 2),
        "softEventEstimatePerMinute": round(len(peaks) / (len(mono) / sr) * 60, 2),
        "stereoCorrelation": round(float(np.corrcoef(left, right)[0, 1]), 4),
        "sideToMidDb": round(10 * math.log10((np.mean(side ** 2) + 1e-12) / (np.mean(mid ** 2) + 1e-12)), 2),
    }


def main():
    sources = base009.load_sources()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reference_profile = acoustic_profile(REFERENCE) if REFERENCE.exists() else None
    items = []
    for item_spec in specs():
        audio, max_shift = render(sources, item_spec)
        wav = OUT_DIR / f"{item_spec['id']}.wav"
        mp3 = OUT_DIR / f"{item_spec['id']}.mp3"
        sf.write(wav, audio, base.SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav),
                        "-af", "bass=g=5:f=180:w=0.7,acompressor=threshold=-30dB:ratio=2.0:attack=80:release=520:makeup=2.2dB,loudnorm=I=-16.5:LRA=4:TP=-3",
                        "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
        record = {key: item_spec[key] for key in ("id", "goal", "title", "intent")}
        record.update({"reviewPath": "../../" + str(mp3.relative_to(ROOT / "public")),
                       "publicPath": "/" + str(mp3.relative_to(ROOT / "public")),
                       "maxSourcePitchShiftSemitones": max_shift,
                       "profile": acoustic_profile(mp3)})
        items.append(record)
    manifest = {
        "batch": "controlled-stem-factory-010",
        "referenceUse": "Acoustic target analysis only. No reference audio was sampled, transformed, or mixed into outputs.",
        "referenceProfile": reference_profile,
        "changesFrom009": ["more frequent softer overlaps", "stronger real-piano low register",
                            "richer slower-moving voicings", "lower crest and smaller energy valleys",
                            "narrower cohesive stereo image"],
        "license": "CC0-1.0", "paidApi": False, "generativeModel": False,
        "items": items,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items, reference_profile)
    print(f"Wrote {len(items)} reference-informed independent pieces")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


def render_review(items, reference_profile):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""<article><p class="eyebrow">{base.escape(item['goal'])}</p><h2>{base.escape(item['title'])}</h2>
<audio controls preload="metadata" src="{base.escape(item['reviewPath'])}"></audio><p>{base.escape(item['intent'])}</p>
<details><summary>参考差异 / QA</summary><pre>{base.escape(json.dumps(item['profile'], indent=2, ensure_ascii=False))}</pre>
<p>参考仅用于统计目标；没有截取、变换或混入参考音频。VCSL CC0 钢琴，自有编排，无 API、无生成模型。</p></details></article>""")
    target = base.escape(json.dumps(reference_profile, indent=2, ensure_ascii=False)) if reference_profile else "Reference unavailable"
    html = f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controlled Stem Factory 010</title><style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}main{{max-width:900px;margin:auto;padding:30px 18px 60px}}header,article{{padding:21px 0;border-bottom:1px solid #344139}}.eyebrow{{font-size:12px;color:#aebeb2;text-transform:uppercase}}audio{{width:100%;margin:10px 0}}summary{{cursor:pointer;color:#d6c096}}pre{{white-space:pre-wrap}}</style></head><body><main><header><p class="eyebrow">SNOOZE · batch 010</p><h1>参考放松感，但保持完全独立制作</h1><p>010 将 Gemini 参考的温暖承托、柔和密集触键、较小动态落差和统一声像转译为我们自己的生成规则。没有复制或混入参考音频。</p><details><summary>参考声学目标</summary><pre>{target}</pre></details></header>{''.join(cards)}</main></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
