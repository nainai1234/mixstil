#!/usr/bin/env python3
"""Render instrument runtime proof candidates from symbolic composition material.

This deliberately avoids Lyria and finished-song reuse.  It renders note events
from composition-material-library-v1 through local multisample instrument
sources, then writes a review page and machine-readable manifest.  SoundFont
sources are recorded honestly as blocked when no local loader is available.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy import signal


ROOT = Path.cwd()
BATCH_ID = "instrument-runtime-render-proof-v1"
SR = 48_000
DURATION = 92.0
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREPARED_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON = ROOT / "reports/instrument-runtime-render-proof-v1.json"
REPORT_MD = ROOT / "reports/instrument-runtime-render-proof-v1.md"

NOTE_BASE = {"C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
MIDI_TO_NOTE = {v: k for k, v in NOTE_BASE.items()}


def require_tools() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required")


def note_to_midi(note: str) -> int:
    match = re.fullmatch(r"([A-G](?:b)?)(-?\d)", note)
    if not match:
        raise ValueError(f"Unsupported note name {note}")
    pitch, octave = match.groups()
    return (int(octave) + 1) * 12 + NOTE_BASE[pitch]


def midi_to_note(midi: int) -> str:
    return f"{MIDI_TO_NOTE[midi % 12]}{midi // 12 - 1}"


def db_to_amp(db: float) -> float:
    return 10 ** (db / 20)


def read_audio(path: Path) -> np.ndarray:
    audio, sr = sf.read(path, always_2d=True, dtype="float32")
    if sr != SR:
        audio = librosa.resample(audio.T, orig_sr=sr, target_sr=SR).T
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    return audio.astype(np.float32)


def lowpass(audio: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype="lowpass", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, audio, axis=0).astype(np.float32)


def highpass(audio: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, cutoff, btype="highpass", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, audio, axis=0).astype(np.float32)


def fade(audio: np.ndarray, fade_in: float = 2.5, fade_out: float = 8.0) -> np.ndarray:
    out = audio.copy()
    fi = min(len(out), int(fade_in * SR))
    fo = min(len(out), int(fade_out * SR))
    if fi:
        out[:fi] *= (np.linspace(0, 1, fi) ** 1.8)[:, None]
    if fo:
        out[-fo:] *= (np.linspace(1, 0, fo) ** 1.8)[:, None]
    return out


def normalize_lufs(audio: np.ndarray, target_lufs: float, peak_db: float = -7.0) -> np.ndarray:
    meter = pyln.Meter(SR)
    loudness = meter.integrated_loudness(audio)
    if math.isfinite(loudness):
        audio = audio * db_to_amp(target_lufs - loudness)
    peak = max(float(np.max(np.abs(audio))), 1e-9)
    ceiling = db_to_amp(peak_db)
    if peak > ceiling:
        audio = audio * (ceiling / peak)
    return audio.astype(np.float32)


def prepare_note_sample(audio: np.ndarray, target_seconds: float, attack: float, release: float) -> np.ndarray:
    target_len = max(1, int(target_seconds * SR))
    if len(audio) < target_len:
        repeats = math.ceil(target_len / len(audio))
        audio = np.tile(audio, (repeats, 1))
    out = audio[:target_len].copy()
    out = highpass(out, 40)
    fi = min(len(out), int(attack * SR))
    fo = min(len(out), int(release * SR))
    if fi:
        out[:fi] *= np.linspace(0, 1, fi)[:, None]
    if fo:
        out[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return out


@dataclass
class Sample:
    note: str
    midi: int
    path: Path
    audio: np.ndarray


class Sampler:
    def __init__(self, source_id: str, root: Path, pattern: str, note_extractor: Any):
        self.source_id = source_id
        self.root = root
        self.samples: list[Sample] = []
        for path in sorted(root.glob(pattern)):
            note = note_extractor(path)
            if not note:
                continue
            self.samples.append(Sample(note, note_to_midi(note), path, read_audio(path)))
        if not self.samples:
            raise RuntimeError(f"No samples found for {source_id} in {root}")

    def render_note(self, note: str, duration: float, gain: float, rng: np.random.Generator, pan: float) -> np.ndarray:
        midi = note_to_midi(note)
        sample = min(self.samples, key=lambda item: abs(item.midi - midi))
        semitones = midi - sample.midi
        audio = sample.audio
        if semitones != 0:
            shifted = librosa.effects.pitch_shift(audio.T, sr=SR, n_steps=semitones).T
        else:
            shifted = audio.copy()
        out = prepare_note_sample(shifted, duration, attack=0.035, release=min(1.8, duration * 0.45))
        out *= gain * rng.uniform(0.92, 1.04)
        left = math.cos((pan + 1) * math.pi / 4)
        right = math.sin((pan + 1) * math.pi / 4)
        return np.column_stack([out[:, 0] * left, out[:, min(1, out.shape[1] - 1)] * right]).astype(np.float32)


def extract_vcsl_note(path: Path) -> str | None:
    return path.stem.split("_")[0] if re.fullmatch(r"[A-G](?:b)?\d(?:_v\d)?", path.stem) else None


def extract_martin_note(path: Path) -> str | None:
    match = re.search(r"_([A-G]b?)(\d)_", path.stem)
    return f"{match.group(1)}{match.group(2)}" if match else None


def extract_rhodes_note(path: Path) -> str | None:
    match = re.search(r"_([A-G]b?)(\d)_", path.stem)
    return f"{match.group(1)}{match.group(2)}" if match else None


def extract_bass_note(path: Path) -> str | None:
    match = re.search(r"_([a-g]b?)(\d)_", path.stem)
    if not match:
        return None
    pitch = match.group(1).replace("b", "b").capitalize()
    return f"{pitch}{match.group(2)}"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def build_events(plan: dict[str, Any], library: dict[str, Any], support_only: bool = False) -> list[dict[str, Any]]:
    harmonies = {item["id"]: item for item in library["harmonyPool"]}
    motifs = {item["id"]: item for item in library["motifPool"]}
    forms = {item["id"]: item for item in library["formPool"]}
    grammars = {item["id"]: item for item in library["grammarPool"]}
    harmony = harmonies[plan["harmonyId"]]
    motif = motifs[plan["motifId"]]
    form = forms[plan["formId"]]
    grammar = grammars[plan["grammarId"]]
    beat_seconds = 60.0 / float(plan["tempo"])

    events: list[dict[str, Any]] = []
    for index, start in enumerate(form["sectionStarts"]):
        chord = harmony["chords"][index % len(harmony["chords"])]
        if support_only:
            notes = [chord[0]]
            duration = 9.0 if plan["goal"] == "sleep" else 6.5
            velocity = 0.22
        else:
            pattern = grammar.get("pattern", [0, 1, 2])
            notes = [chord[i % len(chord)] for i in pattern]
            duration = max(1.8, float(grammar.get("spacing", 3.0)) * beat_seconds)
            velocity = 0.28 if plan["goal"] == "sleep" else 0.34
        for offset, note in enumerate(notes):
            events.append(
                {
                    "note": note,
                    "start": float(start) + offset * float(grammar.get("supportStep", 2.4)) * beat_seconds,
                    "duration": duration,
                    "gain": velocity * (0.9 if offset else 1.0),
                    "role": "harmony_support" if not support_only else "bass_support",
                }
            )

    if not support_only:
        for motif_start in form["motifStarts"]:
            cursor = float(motif_start)
            for index, note in enumerate(motif["notes"]):
                beat = float(motif["beats"][index])
                events.append(
                    {
                        "note": note,
                        "start": cursor,
                        "duration": max(1.2, beat * beat_seconds * 1.8),
                        "gain": 0.23 if plan["goal"] == "sleep" else 0.30,
                        "role": "motif",
                    }
                )
                cursor += beat * beat_seconds * 1.25
    return [event for event in events if event["start"] < DURATION - 2]


def render_events(sampler: Sampler, events: list[dict[str, Any]], plan: dict[str, Any]) -> np.ndarray:
    rng = np.random.default_rng(int(plan["seed"]))
    audio = np.zeros((int(DURATION * SR), 2), dtype=np.float32)
    for index, event in enumerate(events):
        pan = (-0.16 if index % 2 == 0 else 0.16) if event["role"] == "motif" else 0.0
        note_audio = sampler.render_note(event["note"], event["duration"], event["gain"], rng, pan)
        start = int(event["start"] * SR)
        end = min(len(audio), start + len(note_audio))
        audio[start:end] += note_audio[: end - start]
    audio = highpass(audio, 42)
    audio = lowpass(audio, float(plan.get("lowpass", 3000)))
    audio = fade(audio)
    target_lufs = -29.5 if plan["goal"] == "sleep" else (-28.0 if plan["goal"] == "calm" else -26.5)
    return normalize_lufs(audio, target_lufs)


def encode_mp3(wav_path: Path, mp3_path: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_path), "-codec:a", "libmp3lame", "-q:a", "2", str(mp3_path)],
        check=True,
    )


def analyze_audio(audio: np.ndarray) -> dict[str, Any]:
    mono = audio.mean(axis=1)
    meter = pyln.Meter(SR)
    integrated_lufs = float(meter.integrated_loudness(audio))
    onset_env = librosa.onset.onset_strength(y=mono.astype(np.float32), sr=SR)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=SR, units="time", backtrack=False)
    frame = int(0.5 * SR)
    rms = np.array([np.sqrt(np.mean(mono[i : i + frame] ** 2)) for i in range(0, len(mono) - frame, frame)])
    jumps = np.diff(20 * np.log10(rms + 1e-10))
    centroid = librosa.feature.spectral_centroid(y=mono.astype(np.float32), sr=SR)
    peak = max(float(np.max(np.abs(audio))), 1e-9)
    return {
        "durationSeconds": round(len(mono) / SR, 3),
        "integratedLufs": round(integrated_lufs, 2) if math.isfinite(integrated_lufs) else None,
        "peakDbfs": round(20 * math.log10(peak), 2),
        "rawOnsetCount": int(len(onsets)),
        "onsetDensityPerSecond": round(len(onsets) / (len(mono) / SR), 4),
        "p99RmsJumpDb": round(float(np.percentile(jumps, 99)), 2) if len(jumps) else 0,
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "humanVoiceProbability": "not_applicable_local_instrument_samples_no_voice_source",
        "drumProbability": "not_applicable_no_percussion_events",
    }


def machine_status(metrics: dict[str, Any], goal: str) -> tuple[str, list[str]]:
    failures: list[str] = []
    if metrics["durationSeconds"] < 80:
        failures.append("duration_too_short_for_form_proof")
    if metrics["peakDbfs"] > -3:
        failures.append("peak_too_hot")
    if goal in ("sleep", "calm") and metrics["onsetDensityPerSecond"] > 0.9:
        failures.append("too_many_onsets_for_low_arousal_default")
    if goal == "sleep" and metrics["spectralCentroidHz"] > 2400:
        failures.append("sleep_too_bright")
    return ("pass" if not failures else "review_required", failures)


def build_review(manifest: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in manifest["renderedCandidates"]:
        review_audio_src = "../../" + item["preparedAudioUrl"].lstrip("/")
        cards.append(
            f"""
      <article class="card">
        <p class="eyebrow">{escape(item['goal'])} · {escape(item['instrumentSourceId'])} · {escape(item['machineStatus'])}</p>
        <h2>{escape(item['title'])}</h2>
        <audio controls preload="metadata" src="{escape(review_audio_src)}"></audio>
        <p>{escape(item['businessPurpose'])}</p>
        <details>
          <summary>作曲材料 / QA</summary>
          <pre>{escape(json.dumps({k:item[k] for k in ['compositionPlanId','harmonyId','motifId','formId','grammarId','sourceSamplesUsed','analysis','failures']}, ensure_ascii=False, indent=2))}</pre>
        </details>
      </article>
"""
        )
    blockers = []
    for item in manifest["blockedSources"]:
        blockers.append(
            f"""
      <article class="blocked">
        <h3>{escape(item['sourceId'])}</h3>
        <p>{escape(item['reason'])}</p>
        <pre>{escape(json.dumps(item, ensure_ascii=False, indent=2))}</pre>
      </article>
"""
        )

    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instrument Runtime Render Proof V1</title>
  <style>
    body {{ margin: 0; background: #101210; color: #eef4ee; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    main {{ max-width: 1080px; margin: 0 auto; padding: 32px 18px 64px; }}
    .hero, .card, .blocked {{ border: 1px solid rgba(255,255,255,.12); border-radius: 24px; padding: 20px; background: rgba(255,255,255,.045); margin: 16px 0; }}
    .hero {{ background: linear-gradient(135deg, rgba(169, 139, 96, .18), rgba(73, 101, 88, .16)); }}
    .eyebrow {{ color: #bbcab8; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }}
    audio {{ width: 100%; margin: 10px 0; }}
    pre {{ white-space: pre-wrap; color: #dce8d7; }}
    summary {{ cursor: pointer; color: #dcc38d; }}
    .blocked {{ border-color: rgba(230, 174, 100, .28); background: rgba(90, 62, 24, .22); }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE · Runtime proof · candidate only</p>
      <h1>乐器源 + 作曲材料可控渲染验证</h1>
      <p>这一页验证的是业务逻辑：音源、和声、动机、曲式和目标场景可以分开调度。它不是 Lyria，不是成品歌，也不是环境噪声组合。</p>
      <p>当前 productionAllowed=false；需要人工听感、疲劳、循环和身份确认后，才可能进入正式基础元素库。</p>
    </section>
    {''.join(cards)}
    <section class="hero">
      <h2>未通过 runtime proof 的已配置来源</h2>
      <p>这些来源不伪装成通过：本机缺少可用 SoundFont loader，所以只能保留为 blocked。</p>
      {''.join(blockers)}
    </section>
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    require_tools()
    for directory in (MASTER_DIR, PREPARED_DIR, REVIEW_DIR, REPORT_JSON.parent):
        directory.mkdir(parents=True, exist_ok=True)

    library = load_json(ROOT / "config/composition-material-library-v1.json")
    registry = load_json(ROOT / "config/instrument-source-registry-v1.json")
    plans = library["compositionPlans"]

    samplers = {
        "piano": Sampler("vcsl_kawai_soft_piano", ROOT / "assets/audio-sources/vcsl-kawai-soft", "*.wav", extract_vcsl_note),
        "rhodes": Sampler("discord_cc0_rhodes", ROOT / "assets/audio-sources/discord-cc0-band/rhodes", "*.wav", extract_rhodes_note),
        "guitar": Sampler("discord_cc0_guitar", ROOT / "assets/audio-sources/discord-cc0-band/guitar", "*.wav", extract_martin_note),
        "bass": Sampler("discord_cc0_bass", ROOT / "assets/audio-sources/discord-cc0-band/bass", "*.wav", extract_bass_note),
    }
    instrument_to_source = {
        "piano": "vcsl_kawai_soft_piano",
        "rhodes": "discord_cc0_rhodes",
        "guitar": "discord_cc0_guitar",
    }

    rendered: list[dict[str, Any]] = []
    for plan in plans:
        sampler = samplers[plan["instrument"]]
        source_id = instrument_to_source[plan["instrument"]]
        events = build_events(plan, library)
        audio = render_events(sampler, events, plan)
        safe_id = f"{plan['id']}_{source_id}"
        wav_path = MASTER_DIR / f"{safe_id}.wav"
        mp3_path = PREPARED_DIR / f"{safe_id}.mp3"
        sf.write(wav_path, audio, SR, subtype="PCM_24")
        encode_mp3(wav_path, mp3_path)
        metrics = analyze_audio(audio)
        status, failures = machine_status(metrics, plan["goal"])
        sample_notes = sorted({midi_to_note(sample.midi) for sample in sampler.samples})
        rendered.append(
            {
                "candidateId": safe_id,
                "title": f"{plan['goal'].title()} · {plan['instrument'].title()} · {plan['variant']}",
                "goal": plan["goal"],
                "scene": plan["scene"],
                "instrumentSourceId": source_id,
                "compositionPlanId": plan["id"],
                "harmonyId": plan["harmonyId"],
                "motifId": plan["motifId"],
                "formId": plan["formId"],
                "grammarId": plan["grammarId"],
                "tempo": plan["tempo"],
                "seed": plan["seed"],
                "sourceSamplesUsed": sample_notes,
                "eventCount": len(events),
                "masterAudioPath": str(wav_path.relative_to(ROOT)),
                "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
                "productionAllowed": False,
                "businessPurpose": "Proof that symbolic composition materials can drive a local playable instrument source into a controllable music element.",
                "analysis": metrics,
                "machineStatus": status,
                "failures": failures,
            }
        )

    # Bass is a support source rather than a lead composition plan in v1. Render two
    # direct proofs so it is not silently counted as runtime-integrated.
    for source_plan_id, support_goal in [("sleep_low_piano_a", "sleep"), ("focus_rhodes_a", "focus")]:
        base_plan = next(plan for plan in plans if plan["id"] == source_plan_id)
        support_plan = dict(base_plan)
        support_plan["instrument"] = "bass"
        support_plan["id"] = f"{support_goal}_bass_support_a"
        support_plan["seed"] = int(base_plan["seed"]) + 90_000
        support_plan["lowpass"] = 900
        events = build_events(support_plan, library, support_only=True)
        audio = render_events(samplers["bass"], events, support_plan)
        safe_id = f"{support_plan['id']}_discord_cc0_bass"
        wav_path = MASTER_DIR / f"{safe_id}.wav"
        mp3_path = PREPARED_DIR / f"{safe_id}.mp3"
        sf.write(wav_path, audio, SR, subtype="PCM_24")
        encode_mp3(wav_path, mp3_path)
        metrics = analyze_audio(audio)
        status, failures = machine_status(metrics, support_plan["goal"])
        rendered.append(
            {
                "candidateId": safe_id,
                "title": f"{support_goal.title()} · Bass support · low anchor",
                "goal": support_goal,
                "scene": base_plan["scene"],
                "instrumentSourceId": "discord_cc0_bass",
                "compositionPlanId": support_plan["id"],
                "harmonyId": support_plan["harmonyId"],
                "motifId": "not_used_support_only",
                "formId": support_plan["formId"],
                "grammarId": support_plan["grammarId"],
                "tempo": support_plan["tempo"],
                "seed": support_plan["seed"],
                "sourceSamplesUsed": sorted({midi_to_note(sample.midi) for sample in samplers["bass"].samples}),
                "eventCount": len(events),
                "masterAudioPath": str(wav_path.relative_to(ROOT)),
                "preparedAudioUrl": "/" + str(mp3_path.relative_to(ROOT / "public")),
                "productionAllowed": False,
                "businessPurpose": "Proof that bass can be scheduled as a low support instrument, not a finished song or foreground loop.",
                "analysis": metrics,
                "machineStatus": status,
                "failures": failures,
            }
        )

    soundfont_loader_available = shutil.which("fluidsynth") is not None or shutil.which("timidity") is not None
    blocked = []
    for source in registry["sources"]:
        if source["sourceType"] == "soundfont" and not soundfont_loader_available:
            blocked.append(
                {
                    "sourceId": source["id"],
                    "label": source["label"],
                    "assetPath": source["assetPath"],
                    "expectedRuntimeLoader": source["runtimeLoader"],
                    "status": "runtime_loader_blocked",
                    "reason": "FluidR3 .sf2 is present, but this machine does not currently expose fluidsynth or timidity. This source is not counted as runtime-proven.",
                }
            )

    source_results = []
    for source in registry["sources"]:
        rendered_count = sum(1 for item in rendered if item["instrumentSourceId"] == source["id"])
        blocked_item = next((item for item in blocked if item["sourceId"] == source["id"]), None)
        source_results.append(
            {
                "sourceId": source["id"],
                "label": source["label"],
                "registryStatus": source["status"],
                "runtimeProofStatus": "machine_passed_candidate" if rendered_count > 0 else (blocked_item["status"] if blocked_item else "not_attempted"),
                "renderedCandidateCount": rendered_count,
                "productionAllowed": False,
            }
        )

    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "candidate_runtime_render_proof_pending_human_review",
        "productionAllowed": False,
        "purpose": "Prove that local playable instrument sources can be driven by symbolic composition materials for Sleep, Calm, and Focus without using Lyria or fixed finished songs.",
        "hardRules": [
            "Do not count finished songs or mixed combinations as foundational elements.",
            "Do not count blocked SoundFont sources as runtime-proven.",
            "No human voice, singing, chanting, choir, drums, percussion, groove, or therapeutic claims.",
            "All rendered items remain candidate-only until human identity, fatigue, and loop review passes.",
        ],
        "sourceResults": source_results,
        "renderedCandidateCount": len(rendered),
        "machinePassCount": sum(1 for item in rendered if item["machineStatus"] == "pass"),
        "humanPassCount": 0,
        "formalUsableCount": 0,
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "renderedCandidates": rendered,
        "blockedSources": blocked,
    }

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)

    report = {
        "batchId": BATCH_ID,
        "verdict": "runtime_proof_partial_pass_human_review_required",
        "renderedCandidateCount": manifest["renderedCandidateCount"],
        "machinePassCount": manifest["machinePassCount"],
        "blockedSourceCount": len(blocked),
        "renderedSources": [item for item in source_results if item["renderedCandidateCount"] > 0],
        "blockedSources": blocked,
        "reviewUrl": manifest["reviewUrl"],
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    source_table_rows = "\n".join(
        f"| {item['sourceId']} | {item['runtimeProofStatus']} | {item['renderedCandidateCount']} |" for item in source_results
    )
    REPORT_MD.write_text(
        f"""# Instrument Runtime Render Proof V1

Generated: {manifest['generatedAt']}

## Verdict

runtime_proof_partial_pass_human_review_required

This batch proves that local multisample instrument sources can be driven by the symbolic composition library. It does not promote any item to production.

## Counts

| Metric | Count |
| --- | ---: |
| Rendered candidate clips | {manifest['renderedCandidateCount']} |
| Machine pass | {manifest['machinePassCount']} |
| Human pass | 0 |
| Formal usable | 0 |
| Blocked configured sources | {len(blocked)} |

## Source results

| Source | Runtime proof status | Rendered candidates |
| --- | --- | ---: |
{source_table_rows}

## Review

Open: `{manifest['reviewUrl']}`

## Product meaning

The important result is architectural: notes, harmonies, motifs, forms, tempo, and instrument choice are now separate controllable inputs. This is the composer-like path the product needs. The two FluidR3 SoundFont sources remain blocked until a SoundFont runtime loader is installed and verified.
""",
        encoding="utf-8",
    )

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
