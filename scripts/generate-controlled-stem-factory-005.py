#!/usr/bin/env python3
import json
import math
import subprocess
import tempfile
from pathlib import Path
from html import escape

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public/audio/music/local-review/controlled-stem-factory-005"
REVIEW_DIR = ROOT / "public/review/controlled-stem-factory-005"
SWIFT_RENDERER = ROOT / "scripts/render-dls-notes.swift"
SR = 44100
DURATION = 112.0

NOTES = {
    "C3": 48, "D3": 50, "E3": 52, "G3": 55, "A3": 57,
    "C4": 60, "D4": 62, "E4": 64, "G4": 67,
}


def db_to_amp(db):
    return 10 ** (db / 20)


def lowpass(audio, cutoff=4200, order=3):
    sos = butter(order, cutoff, btype="lowpass", fs=SR, output="sos")
    return sosfiltfilt(sos, audio, axis=0)


def highpass(audio, cutoff=45, order=2):
    sos = butter(order, cutoff, btype="highpass", fs=SR, output="sos")
    return sosfiltfilt(sos, audio, axis=0)


def fade(audio, fade_in=3.5, fade_out=12.0):
    out = audio.copy()
    fi = min(len(out), int(fade_in * SR))
    fo = min(len(out), int(fade_out * SR))
    if fi:
        out[:fi] *= (np.linspace(0, 1, fi) ** 1.7)[:, None]
    if fo:
        out[-fo:] *= (np.linspace(1, 0, fo) ** 1.8)[:, None]
    return out


def normalize(audio, peak_db=-17.5):
    peak = max(float(np.max(np.abs(audio))), 1e-9)
    return audio / peak * db_to_amp(peak_db)


def render_dls_piece(name, note_groups, program=0, master_gain=0.72, peak_db=-17.5, cutoff=3600):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    notes = []
    for group in note_groups:
        start = group["start"]
        spread = group.get("spread", 0.08)
        for idx, note_name in enumerate(group["notes"]):
            notes.append({
                "note": NOTES[note_name],
                "start": start + idx * spread,
                "duration": group.get("duration", 4.8),
                "velocity": group.get("velocity", 38),
            })

    wav = OUT_DIR / f"{name}.wav"
    raw_wav = OUT_DIR / f"{name}.raw.wav"
    pcm_wav = OUT_DIR / f"{name}.pcm.wav"
    spec = {
        "outputWav": str(raw_wav),
        "durationSeconds": DURATION,
        "sampleRate": SR,
        "program": program,
        "masterGain": master_gain,
        "notes": notes,
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(spec, f)
        spec_path = f.name

    subprocess.run(["swift", str(SWIFT_RENDERER), spec_path], check=True)
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(raw_wav), "-c:a", "pcm_s16le", str(pcm_wav)],
        check=True,
    )
    audio, sr = sf.read(pcm_wav, always_2d=True)
    if sr != SR:
        raise RuntimeError(f"Unexpected sample rate {sr}")
    audio = highpass(lowpass(audio, cutoff=cutoff), 45)
    audio = fade(audio)
    audio = normalize(audio, peak_db=peak_db)
    sf.write(wav, audio, SR, subtype="PCM_24")

    mp3 = OUT_DIR / f"{name}.mp3"
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-q:a", "2", str(mp3)],
        check=True,
    )
    return wav, mp3, audio


def metrics(audio):
    mono = audio.mean(axis=1)
    peak = float(np.max(np.abs(mono)))
    rms = float(np.sqrt(np.mean(mono**2)))
    frame = int(0.1 * SR)
    energy = np.array([np.sqrt(np.mean(mono[i:i+frame] ** 2)) for i in range(0, len(mono)-frame, frame)])
    jumps = np.diff(20 * np.log10(energy + 1e-9))
    return {
        "durationSeconds": round(len(mono) / SR, 2),
        "peakDbfs": round(20 * math.log10(peak + 1e-9), 2),
        "rmsDbfs": round(20 * math.log10(rms + 1e-9), 2),
        "onsetLikeJumpsOver4_5Db": int(np.sum(jumps > 4.5)),
    }


def add_item(items, name, goal, title, groups, intent, note, program=0, peak_db=-17.5, cutoff=3400):
    wav, mp3, audio = render_dls_piece(name, groups, program=program, peak_db=peak_db, cutoff=cutoff)
    items.append({
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
        "metrics": metrics(audio),
    })


def render_review(items):
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in items:
        cards.append(f"""
      <article class="card">
        <p class="eyebrow">{escape(item['type'])} · {escape(item['goal'])}</p>
        <h2>{escape(item['title'])}</h2>
        <audio controls preload="metadata" src="{escape(item['reviewPath'])}"></audio>
        <p>{escape(item['intent'])}</p>
        <details>
          <summary>音源 / QA</summary>
          <pre>{escape(json.dumps(item['metrics'], indent=2, ensure_ascii=False))}</pre>
          <p>{escape(item['productionNote'])}</p>
        </details>
      </article>
        """)
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Controlled Stem Factory 005</title>
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
      <p class="eyebrow">SNOOZE controlled route · batch 005</p>
      <h1>换音源：系统 DLS 采样乐器，禁用蜂鸣合成</h1>
      <p>004 的蜂鸣来自手写合成音色本身。005 不再用 NumPy 纯波/sine/e-piano 合成器，而用 macOS 系统 DLS 乐器采样渲染慢速音乐短句，再做低通、淡入淡出和响度控制。</p>
      <p>这一批没有 white noise、没有 organic room、没有 continuous hum、没有 sustained sine bed。</p>
    </section>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    sleep_groups = [
        {"start": 1.5, "notes": ["C3", "G3", "C4"], "duration": 5.8, "velocity": 35},
        {"start": 8.5, "notes": ["E3", "G3"], "duration": 5.4, "velocity": 31},
        {"start": 16.0, "notes": ["A3", "E4"], "duration": 5.5, "velocity": 28},
        {"start": 24.0, "notes": ["G3", "C4"], "duration": 5.8, "velocity": 29},
        {"start": 32.5, "notes": ["C3", "E3", "G3"], "duration": 6.0, "velocity": 30},
        {"start": 41.5, "notes": ["E3", "G3"], "duration": 5.6, "velocity": 27},
        {"start": 50.0, "notes": ["A3", "E4"], "duration": 5.8, "velocity": 26},
        {"start": 59.0, "notes": ["G3", "C4"], "duration": 5.8, "velocity": 25},
        {"start": 68.0, "notes": ["C3", "G3", "C4"], "duration": 6.4, "velocity": 26},
        {"start": 78.0, "notes": ["E3", "G3"], "duration": 6.0, "velocity": 23},
        {"start": 88.0, "notes": ["C3", "G3"], "duration": 8.0, "velocity": 22},
    ]
    calm_groups = [
        {"start": 1.0, "notes": ["C3", "E3", "G3"], "duration": 4.8, "velocity": 38},
        {"start": 7.2, "notes": ["G3", "D4"], "duration": 4.8, "velocity": 32},
        {"start": 14.5, "notes": ["A3", "E4"], "duration": 5.0, "velocity": 31},
        {"start": 22.0, "notes": ["E3", "G3", "C4"], "duration": 5.0, "velocity": 31},
        {"start": 30.0, "notes": ["C3", "G3"], "duration": 5.3, "velocity": 31},
        {"start": 38.5, "notes": ["G3", "D4"], "duration": 5.0, "velocity": 28},
        {"start": 47.0, "notes": ["A3", "E4"], "duration": 5.0, "velocity": 27},
        {"start": 56.0, "notes": ["E3", "G3"], "duration": 5.3, "velocity": 26},
        {"start": 65.0, "notes": ["C3", "E3", "G3"], "duration": 5.8, "velocity": 27},
        {"start": 75.0, "notes": ["G3", "C4"], "duration": 5.4, "velocity": 24},
        {"start": 86.0, "notes": ["C3", "G3"], "duration": 8.0, "velocity": 22},
    ]
    return_groups = [
        {"start": 2.5, "notes": ["C3", "G3"], "duration": 6.8, "velocity": 28},
        {"start": 12.0, "notes": ["E3"], "duration": 6.5, "velocity": 23},
        {"start": 22.0, "notes": ["G3", "C4"], "duration": 6.8, "velocity": 24},
        {"start": 33.0, "notes": ["A3"], "duration": 6.5, "velocity": 21},
        {"start": 44.0, "notes": ["E3", "G3"], "duration": 7.0, "velocity": 22},
        {"start": 56.0, "notes": ["C3", "G3"], "duration": 7.5, "velocity": 22},
        {"start": 69.0, "notes": ["G3"], "duration": 6.8, "velocity": 19},
        {"start": 82.0, "notes": ["C3"], "duration": 9.0, "velocity": 18},
    ]
    focus_groups = [
        {"start": 1.0, "notes": ["C3", "E3"], "duration": 4.2, "velocity": 38},
        {"start": 6.8, "notes": ["G3"], "duration": 4.1, "velocity": 34},
        {"start": 13.2, "notes": ["E3", "G3"], "duration": 4.4, "velocity": 35},
        {"start": 20.1, "notes": ["C3", "D4"], "duration": 4.2, "velocity": 31},
        {"start": 27.8, "notes": ["G3", "C4"], "duration": 4.4, "velocity": 31},
        {"start": 36.0, "notes": ["E3"], "duration": 4.5, "velocity": 28},
        {"start": 44.0, "notes": ["C3", "G3"], "duration": 4.6, "velocity": 29},
        {"start": 53.0, "notes": ["G3"], "duration": 4.4, "velocity": 26},
        {"start": 62.0, "notes": ["E3", "G3"], "duration": 4.6, "velocity": 27},
        {"start": 72.0, "notes": ["C3", "D4"], "duration": 4.7, "velocity": 24},
        {"start": 83.0, "notes": ["G3", "C4"], "duration": 4.6, "velocity": 23},
        {"start": 94.0, "notes": ["C3", "G3"], "duration": 5.8, "velocity": 21},
    ]

    items = []
    add_item(items, "dls_sleep_sampled_piano_005", "Sleep", "DLS Sleep sampled piano 005", sleep_groups, "慢速采样钢琴，避免 004 的蜂鸣合成音色。", "System DLS sampled instrument; no sine-bed/noise/hum.", program=0, peak_db=-18.0, cutoff=3000)
    add_item(items, "dls_calm_sampled_piano_005", "Calm meditation", "DLS Calm sampled piano 005", calm_groups, "更连贯的冥想短句，但音源改为系统采样，避免伤耳。", "System DLS sampled instrument; uneven phrase timing, no beat.", program=0, peak_db=-17.5, cutoff=3200)
    add_item(items, "dls_return_sleep_sampled_piano_005", "Return to sleep", "DLS Return sleep sampled piano 005", return_groups, "回睡版本，声音更少但不是空白，也没有持续蜂鸣。", "System DLS sampled instrument; low velocity and darker filtering.", program=0, peak_db=-19.0, cutoff=2600)
    add_item(items, "dls_focus_sampled_piano_005", "Focus", "DLS Focus sampled piano 005", focus_groups, "专注版本稍微更清楚，但不加鼓点、不加 pulse。", "System DLS sampled instrument; no arpeggio/percussion.", program=0, peak_db=-17.0, cutoff=3400)

    manifest = {
        "batch": "controlled-stem-factory-005",
        "route": "SNOOZE controlled stem factory with system DLS sampled instrument",
        "source": "macOS system DLS sampled instrument rendering; no paid cloud API; no external generative model",
        "userFeedbackApplied": [
            "004 has loud buzzing and is ear-unfriendly.",
            "Stop pure-wave/sine/additive synthesis as the audible instrument core.",
            "Use more natural sampled instrument source."
        ],
        "durationSeconds": DURATION,
        "items": items,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    render_review(items)
    print(f"Wrote {len(items)} audio items")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


if __name__ == "__main__":
    main()
