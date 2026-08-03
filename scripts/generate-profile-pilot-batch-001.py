#!/usr/bin/env python3
"""Generate one original piece per v1 StyleProfile through a shared planner."""
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

from music_composition_engine import FormPlan, Motif, PhrasePlan, ProductionBrief, motif_events, serialize_plan

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts/generate-controlled-stem-factory-009.py"
WESTERN_PATH = ROOT / "scripts/generate-gentle-western-families-batch-012.py"
OUT_DIR = ROOT / "public/audio/music/local-review/profile-pilot-batch-001"
REVIEW_DIR = ROOT / "public/review/profile-pilot-batch-001"
SR = 44100
DURATION = 96.0

spec = importlib.util.spec_from_file_location("factory009", BASE_PATH)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
western_spec = importlib.util.spec_from_file_location("western012", WESTERN_PATH)
western = importlib.util.module_from_spec(western_spec)
western_spec.loader.exec_module(western)


def add_event(events, start, note, duration, velocity, pan=0.0, role="support", instrument="piano"):
    events.append({"start": start, "note": note, "duration": duration,
                   "velocity": velocity, "pan": pan, "softAttack": True,
                   "role": role, "instrument": instrument})


def assign_instrument(events, instrument):
    for event in events:
        event["instrument"] = instrument
    return events


def piano_plan():
    brief = ProductionBrief("calm", "east_asian_pentatonic_lyrical_piano", DURATION, 3101)
    motif = Motif("window_rise", ("E3", "G3", "A3", "G3"), (0.7, 1.0, 1.0, 1.4), "pickup_rise_step_return")
    form = FormPlan("lyrical_nocturne", ("arrival", "theme", "answer", "return", "release"), (1.5, 10.0, 30.0, 55.0, 78.0), 82.0)
    phrases = [PhrasePlan(10.0, motif, "identity", 0.9), PhrasePlan(30.0, motif, "answer", 0.82), PhrasePlan(55.0, motif, "register", 0.84, 2), PhrasePlan(78.0, motif, "reduce", 0.68)]
    events = []
    chords = [("C2", "G2", "E3"), ("F2", "C3", "A3"), ("A2", "E3", "G3"), ("C2", "G2", "E3")]
    starts = (1.5, 24.0, 46.0, 68.0)
    for section, start in enumerate(starts):
        for index, note in enumerate(chords[section]):
            add_event(events, start + index * 0.07, note, 17.0, (0.075, 0.055, 0.04)[index], (-0.04, 0.0, 0.04)[index])
    for phrase in phrases:
        events.extend(assign_instrument(motif_events(phrase, 0.065, 0.025), "piano"))
    # Real sampled piano notes are finite one-shots. Re-articulate a quiet
    # common-tone support every ~3 seconds so the arrangement never relies on
    # an artificial drone or leaves an accidental hole between phrases.
    for index, start in enumerate(np.arange(2.8, 84.0, 3.0)):
        add_event(events, float(start), ("C3", "A2", "F2", "G2")[index % 4], 2.2,
                  0.020 if index % 3 else 0.026, -0.015, role="support", instrument="piano")
    return brief, motif, phrases, form, events, "VCSL Kawai CC0 piano; pentatonic motif, soft common-tone harmony"


def guitar_plan():
    brief = ProductionBrief("calm", "western_six_eight_acoustic_unwind", DURATION, 3102)
    motif = Motif("tide_pickup", ("E4", "G4", "A4", "G4", "E4"), (0.45, 0.75, 0.75, 0.75, 1.2), "pickup_wave_fall")
    form = FormPlan("six_eight_unwind", ("pickup", "wave", "varied_wave", "open_response", "release"), (1.0, 9.0, 31.0, 53.0, 78.0), 83.0)
    phrases = [PhrasePlan(9.0, motif, "identity", 0.84), PhrasePlan(31.0, motif, "answer", 0.8), PhrasePlan(53.0, motif, "register", 0.76, -2), PhrasePlan(78.0, motif, "reduce", 0.64)]
    events = []
    chords = [("C3", "E3", "G3"), ("A2", "C3", "E3"), ("F2", "A2", "C3"), ("G2", "B2", "D3")]
    eighth = 60 / 52 / 3
    for bar in range(30):
        start = 2.0 + bar * 6 * eighth
        chord = chords[(bar // 2) % len(chords)]
        for step, index in ((0.0, 0), (1.2, 1), (3.2, 2), (4.3, 1)):
            add_event(events, start + step * eighth, chord[index], eighth * 2.8, 0.045,
                      -0.035 if index == 0 else 0.035, instrument="guitar")
    for phrase in phrases:
        events.extend(assign_instrument(motif_events(phrase, 0.052, 0.03), "guitar"))
    for index, start in enumerate(np.arange(2.5, 84.0, 2.6)):
        add_event(events, float(start), ("C3", "A2", "F2", "G2")[index % 4], 1.8,
                  0.018, -0.02 if index % 2 else 0.02, role="support", instrument="guitar")
    return brief, motif, phrases, form, events, "Discord CC0 Martin steel guitar; 6/8 wave motion without rock backbeat"


def rhodes_plan():
    brief = ProductionBrief("focus", "dry_rhodes_brushless_focus", DURATION, 3103)
    motif = Motif("desk_cycle", ("D4", "E4", "G4", "E4"), (0.8, 0.8, 1.0, 1.0), "narrow_step_cycle")
    form = FormPlan("focus_cycle", ("entry", "cycle", "variant", "return", "open_loop"), (1.0, 8.0, 32.0, 58.0, 82.0), 86.0)
    phrases = [PhrasePlan(8.0, motif, "identity", 0.78), PhrasePlan(32.0, motif, "answer", 0.76), PhrasePlan(58.0, motif, "register", 0.75, -2), PhrasePlan(82.0, motif, "reduce", 0.68)]
    events = []
    chords = [("C3", "G3", "B3"), ("A2", "E3", "G3"), ("F2", "C3", "A3"), ("G2", "D3", "B3")]
    for bar in range(32):
        start = 1.0 + bar * 3.0
        chord = chords[(bar // 2) % 4]
        for index, note in enumerate(chord):
            add_event(events, start + index * 0.05, note, 2.3, (0.052, 0.038, 0.03)[index],
                      (-0.03, 0.0, 0.03)[index], instrument="rhodes")
        if bar % 2 == 0:
            add_event(events, start + 1.25, chord[0], 1.5, 0.025, -0.02,
                      role="support", instrument="bass")
    for phrase in phrases:
        events.extend(assign_instrument(motif_events(phrase, 0.045, 0.02), "rhodes"))
    for index, start in enumerate(np.arange(2.0, 86.0, 2.35)):
        add_event(events, float(start), ("C3", "A2", "F2", "G2")[index % 4], 1.7,
                  0.016, -0.015, role="support", instrument="rhodes")
    return brief, motif, phrases, form, events, "jRhodes CC0 plus finger bass source; dry, brushless, no walking bass"


def sleep_piano_plan():
    brief = ProductionBrief("sleep", "low_register_piano_sleep_descent", DURATION, 3201)
    motif = Motif("evening_fall", ("G3", "E3", "D3", "C3"), (1.4, 1.6, 1.8, 2.4), "slow_stepwise_descent")
    form = FormPlan("sleep_descent", ("dim_entry", "descent", "lower_return", "thinning", "release"), (2.0, 14.0, 38.0, 64.0, 82.0), 84.0)
    phrases = [PhrasePlan(14.0, motif, "identity", 0.72), PhrasePlan(38.0, motif, "answer", 0.64), PhrasePlan(64.0, motif, "register", 0.56, -2), PhrasePlan(82.0, motif, "reduce", 0.42)]
    events = []
    chords = [("C2", "G2", "E3"), ("A2", "E3", "C3"), ("F2", "C3", "A3"), ("C2", "G2", "D3")]
    for section, start in enumerate((2.0, 25.0, 48.0, 70.0)):
        for index, note in enumerate(chords[section]):
            add_event(events, start + index * 0.09, note, 20.0, (0.056, 0.040, 0.028)[index], (-0.03, 0.0, 0.03)[index])
    for phrase in phrases:
        events.extend(assign_instrument(motif_events(phrase, 0.048, 0.018), "piano"))
    for index, start in enumerate(np.arange(3.0, 87.0, 2.7)):
        add_event(events, float(start), ("C3", "A2", "F2", "G2")[index % 4], 2.8, 0.017, -0.01, role="support", instrument="piano")
    return brief, motif, phrases, form, events, "VCSL Kawai CC0 piano; low-register falling sleep form"


def meditation_guitar_plan():
    brief = ProductionBrief("calm", "open_fifth_guitar_meditation", DURATION, 3202)
    motif = Motif("open_breath", ("C4", "G4", "E4"), (1.8, 2.2, 3.0), "open_fifth_soft_return")
    form = FormPlan("open_breathing", ("breath_in", "open_space", "answer", "return", "release"), (1.5, 12.0, 36.0, 60.0, 82.0), 85.0)
    phrases = [PhrasePlan(12.0, motif, "identity", 0.68), PhrasePlan(36.0, motif, "answer", 0.62), PhrasePlan(60.0, motif, "register", 0.58, -2), PhrasePlan(82.0, motif, "reduce", 0.44)]
    events = []
    chords = [("C3", "G3", "E4"), ("F2", "C3", "A3"), ("A2", "E3", "C4"), ("G2", "D3", "C4")]
    for bar in range(20):
        start = 2.0 + bar * 4.4
        chord = chords[(bar // 2) % len(chords)]
        for offset, index in ((0.0, 0), (1.45, 2), (2.9, 1)):
            add_event(events, start + offset, chord[index], 2.6, 0.031, -0.025 if index == 0 else 0.025, instrument="guitar")
    for phrase in phrases:
        events.extend(assign_instrument(motif_events(phrase, 0.042, 0.02), "guitar"))
    for index, start in enumerate(np.arange(2.8, 86.0, 4.4)):
        add_event(events, float(start), ("C3", "A2", "F2", "G2")[index % 4], 2.4, 0.018, 0.01, role="support", instrument="guitar")
    return brief, motif, phrases, form, events, "Discord CC0 Martin steel guitar; open-fifth breathing form without backbeat"


def piano_focus_plan():
    brief = ProductionBrief("focus", "common_tone_piano_focus", DURATION, 3203)
    motif = Motif("steady_window", ("C4", "D4", "E4", "D4"), (1.0, 1.0, 1.2, 1.6), "small_arch_common_tone")
    form = FormPlan("steady_common_tone", ("quiet_entry", "work_cycle", "small_variant", "return", "open_end"), (1.0, 8.0, 34.0, 60.0, 84.0), 88.0)
    phrases = [PhrasePlan(8.0, motif, "identity", 0.62), PhrasePlan(34.0, motif, "answer", 0.60), PhrasePlan(60.0, motif, "register", 0.58, -2), PhrasePlan(84.0, motif, "reduce", 0.48)]
    events = []
    chords = [("C3", "G3", "E4"), ("A2", "G3", "E4"), ("F2", "C3", "E4"), ("G2", "D3", "E4")]
    for bar in range(30):
        start = 1.0 + bar * 3.0
        chord = chords[(bar // 2) % len(chords)]
        for index, note in enumerate(chord):
            add_event(events, start + index * 0.06, note, 2.7, (0.040, 0.029, 0.022)[index], (-0.025, 0.0, 0.025)[index], instrument="piano")
    for phrase in phrases:
        events.extend(assign_instrument(motif_events(phrase, 0.038, 0.015), "piano"))
    return brief, motif, phrases, form, events, "VCSL Kawai CC0 piano; stable common-tone focus form without percussion"


def all_plans():
    return [piano_plan(), guitar_plan(), rhodes_plan(), sleep_piano_plan(), meditation_guitar_plan(), piano_focus_plan()]


def render_piece(events, seed, lowpass_hz, piano_sources, instrument_sources):
    rng = np.random.default_rng(seed)
    mix = np.zeros((int(DURATION * SR), 2), dtype=np.float64)
    for event in sorted(events, key=lambda item: item["start"]):
        if event["instrument"] == "piano":
            audio, _ = base.natural_note(piano_sources, event, rng)
        else:
            audio = western.sampled_note(
                instrument_sources, event["instrument"], base.MIDI[event["note"]],
                event["duration"], event["velocity"], event["pan"], rng)
        start = max(0.0, event["start"] + rng.uniform(-0.018, 0.018))
        offset = int(start * SR)
        end = min(len(mix), offset + len(audio))
        mix[offset:end] += audio[:end - offset]
    mid = (mix[:, 0] + mix[:, 1]) * 0.5
    side = (mix[:, 0] - mix[:, 1]) * 0.5 * 0.38
    mix[:, 0], mix[:, 1] = mid + side, mid - side
    mix = sosfiltfilt(butter(3, lowpass_hz, btype="lowpass", fs=SR, output="sos"), mix, axis=0)
    fade_in, fade_out = int(1.4 * SR), int(7 * SR)
    mix[:fade_in] *= np.sin(np.linspace(0, math.pi / 2, fade_in))[:, None] ** 1.25
    mix[-fade_out:] *= np.cos(np.linspace(0, math.pi / 2, fade_out))[:, None] ** 1.5
    return mix / max(float(np.max(np.abs(mix))), 1e-9) * base.base.db_to_amp(-8)


def acoustic_metrics(path):
    audio, sr = sf.read(path, always_2d=True)
    mono = audio.mean(axis=1)
    frame = int(0.25 * sr)
    rms = np.array([np.sqrt(np.mean(mono[i:i + frame] ** 2)) for i in range(0, len(mono) - frame, frame)])
    quiet = rms < base.base.db_to_amp(-43)
    longest = current = 0
    for value in quiet:
        current = current + 1 if value else 0
        longest = max(longest, current)
    return {"durationSeconds": round(len(mono) / sr, 2), "longestBelowMinus43DbSeconds": round(longest * 0.25, 2), "rmsP90MinusP10Db": round(float(20 * np.log10(np.percentile(rms, 90) / max(np.percentile(rms, 10), 1e-9))), 2)}


def contour_signature(events):
    melody = [e for e in events if e.get("role") == "motif"]
    ordered = sorted(melody, key=lambda item: item["start"])
    notes = [base.MIDI[e["note"]] for e in ordered]
    intervals = [b - a for a, b in zip(notes, notes[1:])]
    interval_histogram = [intervals.count(i) for i in range(-12, 13)]
    beat_histogram = [0] * 8
    for event in ordered:
        beat_histogram[min(7, int(round(event["duration"] * 2)))] += 1
    onset_histogram = [0] * 8
    for left, right in zip(ordered, ordered[1:]):
        onset_histogram[min(7, int(round((right["start"] - left["start"]) * 2)))] += 1
    role_histogram = [sum(1 for e in events if e.get("instrument") == name) for name in ("piano", "guitar", "rhodes", "bass")]
    return interval_histogram + beat_histogram + onset_histogram + role_histogram


def similarity(left, right):
    a, b = np.array(left, dtype=float), np.array(right, dtype=float)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return round(float(np.dot(a, b) / denom) if denom else 0.0, 4)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    plans = all_plans()
    piano_sources = base.load_sources()
    instrument_sources = western.load_instruments()
    items, signatures = [], []
    for index, (brief, motif, phrases, form, events, source_note) in enumerate(plans):
        audio = render_piece(events, brief.seed, (2850, 4200, 3600, 2500, 3400, 3000)[index],
                             piano_sources, instrument_sources)
        wav = OUT_DIR / f"{brief.profile_id}.wav"
        mp3 = OUT_DIR / f"{brief.profile_id}.mp3"
        sf.write(wav, audio, SR, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav), "-af", "loudnorm=I=-18:LRA=5:TP=-4", "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)], check=True)
        metrics = acoustic_metrics(mp3)
        signature = contour_signature(events)
        signatures.append(signature)
        items.append({"profile": brief.profile_id, "goal": brief.goal, "seed": brief.seed,
                      "motif": motif.signature(), "form": form.name, "source": source_note,
                      "metrics": metrics,
                      "publicPath": "/" + str(mp3.relative_to(ROOT / "public")),
                      "reviewPath": "../../" + str(mp3.relative_to(ROOT / "public"))})
    pairwise = {f"{items[i]['profile']} vs {items[j]['profile']}": similarity(signatures[i], signatures[j]) for i in range(len(items)) for j in range(i + 1, len(items))}
    manifest = {"batch": "profile-pilot-batch-001", "generator": "shared ProductionBrief/Motif/PhrasePlan/FormPlan engine", "paidApi": False, "generativeModel": False, "compositionPlans": [serialize_plan(*plan[:4]) for plan in plans], "items": items, "melodyContourCosineSimilarity": pairwise, "similarityInterpretation": "Lower is more distinct; this is a diagnostic gate, not a claim of perceptual equivalence."}
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    render_review(items, pairwise)
    print(f"Wrote {len(items)} profile pilot pieces")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


def render_review(items, pairwise):
    cards = []
    for item in items:
        cards.append(f"<article><p class='eyebrow'>{item['goal']} · {item['profile']}</p><h2>{item['profile']}</h2><audio controls preload='metadata' src='{item['reviewPath']}'></audio><p>{item['source']}</p><details><summary>Motif / form / QA</summary><pre>{json.dumps({'motif': item['motif'], 'form': item['form'], 'metrics': item['metrics']}, ensure_ascii=False, indent=2)}</pre></details></article>")
    html = "<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Profile Pilot 001</title><style>body{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{max-width:900px;margin:auto;padding:30px 18px 60px}header,article{padding:21px 0;border-bottom:1px solid #344139}.eyebrow{font-size:12px;color:#aebeb2}audio{width:100%;margin:10px 0}summary{cursor:pointer;color:#d6c096}pre{white-space:pre-wrap}</style></head><body><main><header><p class='eyebrow'>SNOOZE · shared composition engine · pilot 001</p><h1>三套 Profile，各自一首</h1><p>这次试听验证的是作曲结构是否真正分离：五声音阶钢琴、6/8 原声吉他、干燥 Rhodes 专注。没有白噪声、蜂鸣音、付费 API 或外部生成模型。</p><h3>旋律轮廓相似度诊断</h3><pre>" + json.dumps(pairwise, ensure_ascii=False, indent=2) + "</pre></header>" + ''.join(cards) + "</main></body></html>"
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
