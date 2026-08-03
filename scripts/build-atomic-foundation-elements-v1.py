#!/usr/bin/env python3
"""Build an atomic foundational element review page.

This is not a music-composition listening page.  It exposes small, reusable
elements: single notes, chord cells, short motifs, bass anchors, and symbolic
form/grammar rules.  The goal is to review whether each element can be used in
the composition system, not whether a finished track is enjoyable.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


ROOT = Path.cwd()
BATCH_ID = "atomic-foundation-elements-v1"
PROOF_SCRIPT = ROOT / "scripts/build-instrument-runtime-render-proof-v1.py"
MASTER_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "masters"
PREPARED_DIR = ROOT / "public/audio/music/local-review" / BATCH_ID / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = ROOT / "public/audio/music/local-review" / BATCH_ID / "manifest.json"
REPORT_JSON = ROOT / "reports/atomic-foundation-elements-v1.json"
REPORT_MD = ROOT / "reports/atomic-foundation-elements-v1.md"


def load_proof_module():
    spec = importlib.util.spec_from_file_location("instrument_runtime_render_proof_v1", PROOF_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load instrument runtime proof module")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


proof = load_proof_module()


SOURCE_BY_INSTRUMENT = {
    "piano": "vcsl_kawai_soft_piano",
    "rhodes": "discord_cc0_rhodes",
    "guitar": "discord_cc0_guitar",
    "bass": "discord_cc0_bass",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def make_samplers() -> dict[str, Any]:
    return {
        "piano": proof.Sampler("vcsl_kawai_soft_piano", ROOT / "assets/audio-sources/vcsl-kawai-soft", "*.wav", proof.extract_vcsl_note),
        "rhodes": proof.Sampler("discord_cc0_rhodes", ROOT / "assets/audio-sources/discord-cc0-band/rhodes", "*.wav", proof.extract_rhodes_note),
        "guitar": proof.Sampler("discord_cc0_guitar", ROOT / "assets/audio-sources/discord-cc0-band/guitar", "*.wav", proof.extract_martin_note),
        "bass": proof.Sampler("discord_cc0_bass", ROOT / "assets/audio-sources/discord-cc0-band/bass", "*.wav", proof.extract_bass_note),
    }


def silence(seconds: float) -> np.ndarray:
    return np.zeros((int(seconds * proof.SR), 2), dtype=np.float32)


def render_note(sampler: Any, note: str, duration: float, gain: float = 0.42) -> np.ndarray:
    rng = np.random.default_rng(proof.note_to_midi(note) * 17)
    audio = sampler.render_note(note, duration, gain, rng, 0.0)
    audio = proof.highpass(audio, 40)
    audio = proof.lowpass(audio, 3600)
    return proof.normalize_lufs(audio, -28.5, peak_db=-9.0)


def render_sequence(sampler: Any, notes: list[str], durations: list[float], gaps: list[float], gain: float, lowpass: int) -> np.ndarray:
    total = sum(durations) + sum(gaps) + 1.0
    out = silence(total)
    cursor = 0.2
    rng = np.random.default_rng(sum(proof.note_to_midi(note) for note in notes) + len(notes) * 31)
    for idx, note in enumerate(notes):
        piece = sampler.render_note(note, durations[idx], gain, rng, -0.18 if idx % 2 == 0 else 0.18)
        start = int(cursor * proof.SR)
        end = min(len(out), start + len(piece))
        out[start:end] += piece[: end - start]
        cursor += durations[idx] + gaps[idx]
    out = proof.highpass(out, 40)
    out = proof.lowpass(out, lowpass)
    out = proof.fade(out, fade_in=0.15, fade_out=0.8)
    return proof.normalize_lufs(out, -28.0, peak_db=-8.5)


def render_chord(sampler: Any, notes: list[str], duration: float, arpeggiate: bool, gain: float, lowpass: int) -> np.ndarray:
    out = silence(duration + 1.0)
    rng = np.random.default_rng(sum(proof.note_to_midi(note) for note in notes) * 7)
    for idx, note in enumerate(notes):
        piece = sampler.render_note(note, duration, gain, rng, 0.0)
        start = int((0.08 * idx if arpeggiate else 0.0) * proof.SR)
        end = min(len(out), start + len(piece))
        out[start:end] += piece[: end - start]
    out = proof.highpass(out, 40)
    out = proof.lowpass(out, lowpass)
    out = proof.fade(out, fade_in=0.12, fade_out=1.2)
    return proof.normalize_lufs(out, -29.0, peak_db=-9.0)


def write_element_audio(element_id: str, audio: np.ndarray) -> tuple[str, str]:
    wav_path = MASTER_DIR / f"{element_id}.wav"
    mp3_path = PREPARED_DIR / f"{element_id}.mp3"
    sf.write(wav_path, audio, proof.SR, subtype="PCM_24")
    proof.encode_mp3(wav_path, mp3_path)
    return str(wav_path.relative_to(ROOT)), "/" + str(mp3_path.relative_to(ROOT / "public"))


def audio_element(element: dict[str, Any], audio: np.ndarray) -> dict[str, Any]:
    master_path, prepared_url = write_element_audio(element["elementId"], audio)
    analysis = proof.analyze_audio(audio)
    machine_status, failures = proof.machine_status(analysis, element["goal"])
    return {
        **element,
        "masterAudioPath": master_path,
        "preparedAudioUrl": prepared_url,
        "reviewAudioSrc": "../../" + prepared_url.lstrip("/"),
        "durationSeconds": analysis["durationSeconds"],
        "analysis": analysis,
        "machineStatus": machine_status,
        "failures": failures,
        "humanListeningStatus": "pending",
        "formalUsable": False,
        "productionAllowed": False,
    }


def build_audio_elements(library: dict[str, Any], samplers: dict[str, Any]) -> list[dict[str, Any]]:
    elements: list[dict[str, Any]] = []

    single_notes = [
        ("piano", "sleep", ["C3", "E3", "G3"]),
        ("rhodes", "calm", ["C3", "E3", "G3"]),
        ("guitar", "calm", ["C3", "E3", "G3"]),
        ("bass", "focus", ["C2", "Gb2", "C3"]),
    ]
    for instrument, goal, notes in single_notes:
        for note in notes:
            element_id = f"atom_note_{instrument}_{note.lower().replace('b', 'flat')}"
            elements.append(
                audio_element(
                    {
                        "elementId": element_id,
                        "elementType": "single_note",
                        "goal": goal,
                        "instrument": instrument,
                        "instrumentSourceId": SOURCE_BY_INSTRUMENT[instrument],
                        "notes": [note],
                        "businessQuestion": "这个单音音色能不能作为基础乐器源？注意听起音、尾音、刺耳感和音色身份。",
                        "reviewMode": "element_usability_not_music_preference",
                    },
                    render_note(samplers[instrument], note, 3.2 if instrument != "bass" else 2.6, 0.36 if instrument != "bass" else 0.32),
                )
            )

    chord_specs = [
        ("sleep_open_fifth_c_g", "sleep", "piano", ["C3", "G3"], False),
        ("sleep_soft_triad_c", "sleep", "piano", ["C3", "E3", "G3"], True),
        ("calm_open_fifth_d_a", "calm", "rhodes", ["D3", "A3"], False),
        ("calm_soft_triad_f", "calm", "rhodes", ["F3", "A3", "C4"], True),
        ("calm_guitar_open_c", "calm", "guitar", ["C3", "G3", "E4"], True),
        ("focus_neutral_cell_cg", "focus", "rhodes", ["C3", "G3", "A3"], False),
    ]
    for element_id, goal, instrument, notes, arpeggiate in chord_specs:
        elements.append(
            audio_element(
                {
                    "elementId": f"atom_chord_{element_id}",
                    "elementType": "harmony_cell",
                    "goal": goal,
                    "instrument": instrument,
                    "instrumentSourceId": SOURCE_BY_INSTRUMENT[instrument],
                    "notes": notes,
                    "businessQuestion": "这个和声音型能不能作为可复用基础和声？不要按一首歌判断，只判断它是否稳定、舒缓、可组合。",
                    "reviewMode": "element_usability_not_music_preference",
                },
                render_chord(samplers[instrument], notes, 5.5, arpeggiate, 0.24, 2800 if goal == "sleep" else 3300),
            )
        )

    motif_specs = [
        ("sleep_two_note_release", "sleep", "piano", ["F3", "C3"], [1.6, 2.1], [0.6, 0.0]),
        ("sleep_falling_1_micro", "sleep", "piano", ["G3", "E3", "D3", "C3"], [0.8, 0.9, 1.0, 1.4], [0.35, 0.4, 0.45, 0.0]),
        ("calm_breath_arch_micro", "calm", "rhodes", ["E3", "G3", "A3", "G3", "E3"], [0.55, 0.65, 0.8, 0.7, 1.1], [0.18, 0.2, 0.22, 0.3, 0.0]),
        ("calm_guitar_open_return", "calm", "guitar", ["C4", "G3", "E4"], [0.9, 1.1, 1.6], [0.4, 0.5, 0.0]),
        ("focus_common_tone_cell", "focus", "rhodes", ["A3", "C4", "A3", "E4"], [0.45, 0.5, 0.55, 0.85], [0.15, 0.15, 0.18, 0.0]),
        ("focus_two_note_anchor", "focus", "rhodes", ["G3", "D4", "G3"], [0.7, 0.75, 1.1], [0.2, 0.22, 0.0]),
    ]
    for element_id, goal, instrument, notes, durations, gaps in motif_specs:
        elements.append(
            audio_element(
                {
                    "elementId": f"atom_motif_{element_id}",
                    "elementType": "short_motif",
                    "goal": goal,
                    "instrument": instrument,
                    "instrumentSourceId": SOURCE_BY_INSTRUMENT[instrument],
                    "notes": notes,
                    "businessQuestion": "这个短动机是不是可复用？重点判断它是否太像固定旋律、是否容易听腻、是否能被变形。",
                    "reviewMode": "element_usability_not_music_preference",
                },
                render_sequence(samplers[instrument], notes, durations, gaps, 0.27 if goal != "sleep" else 0.22, 2600 if goal == "sleep" else 3400),
            )
        )

    bass_specs = [
        ("sleep_low_anchor_c", "sleep", ["C2"], [2.6], [0.0]),
        ("sleep_fifth_anchor_cg", "sleep", ["C2", "G2"], [1.8, 2.2], [0.5, 0.0]),
        ("focus_low_pulse_free_anchor", "focus", ["C2", "Gb2", "C3"], [0.9, 0.9, 1.2], [0.35, 0.35, 0.0]),
    ]
    for element_id, goal, notes, durations, gaps in bass_specs:
        elements.append(
            audio_element(
                {
                    "elementId": f"atom_bass_{element_id}",
                    "elementType": "bass_support",
                    "goal": goal,
                    "instrument": "bass",
                    "instrumentSourceId": SOURCE_BY_INSTRUMENT["bass"],
                    "notes": notes,
                    "businessQuestion": "这个低音支撑是否能做底层锚点？不能有鼓点感、不能像循环节拍、不能抢主层。",
                    "reviewMode": "element_usability_not_music_preference",
                },
                render_sequence(samplers["bass"], notes, durations, gaps, 0.28, 820 if goal == "sleep" else 1050),
            )
        )

    return elements


def build_symbolic_elements(library: dict[str, Any]) -> list[dict[str, Any]]:
    elements: list[dict[str, Any]] = []
    for item in library["harmonyPool"][:12]:
        elements.append(
            {
                "elementId": f"symbolic_harmony_{item['id']}",
                "elementType": "symbolic_harmony_template",
                "goal": item["family"].split("_")[0] if item["family"].split("_")[0] in ["sleep", "calm", "focus"] else "calm",
                "family": item["family"],
                "chords": item["chords"],
                "businessQuestion": "这个和声模板是否适合作为可变化的作曲材料？它不是音频，也不是一首歌。",
                "reviewMode": "structure_usability",
                "productionAllowed": False,
                "humanReviewStatus": "pending",
                "formalUsable": False,
            }
        )
    for item in library["motifPool"][:18]:
        elements.append(
            {
                "elementId": f"symbolic_motif_{item['id']}",
                "elementType": "symbolic_motif_template",
                "goal": item["id"].split("_")[0] if item["id"].split("_")[0] in ["sleep", "calm", "focus"] else "calm",
                "notes": item["notes"],
                "beats": item["beats"],
                "contour": item["contour"],
                "businessQuestion": "这个动机结构是否可变形、可复用、不会变成固定主题？",
                "reviewMode": "structure_usability",
                "productionAllowed": False,
                "humanReviewStatus": "pending",
                "formalUsable": False,
            }
        )
    for item in library["formPool"]:
        elements.append(
            {
                "elementId": f"symbolic_form_{item['id']}",
                "elementType": "symbolic_form_rule",
                "goal": item["id"].split("_")[0] if item["id"].split("_")[0] in ["sleep", "calm", "focus"] else "calm",
                "sectionStarts": item["sectionStarts"],
                "motifStarts": item["motifStarts"],
                "releaseAt": item["releaseAt"],
                "businessQuestion": "这个曲式规则是否能组织一段声音，而不是生成固定曲子？",
                "reviewMode": "structure_usability",
                "productionAllowed": False,
                "humanReviewStatus": "pending",
                "formalUsable": False,
            }
        )
    for item in library["grammarPool"]:
        elements.append(
            {
                "elementId": f"symbolic_grammar_{item['id']}",
                "elementType": "symbolic_arrangement_grammar",
                "goal": "multi",
                "kind": item["kind"],
                "supportStep": item["supportStep"],
                "spacing": item["spacing"],
                "pattern": item["pattern"],
                "businessQuestion": "这个编配规则是否能生成变化，而不是固定音乐片段？",
                "reviewMode": "structure_usability",
                "productionAllowed": False,
                "humanReviewStatus": "pending",
                "formalUsable": False,
            }
        )
    return elements


def build_review(manifest: dict[str, Any]) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    audio_cards = []
    for element in manifest["audioElements"]:
        audio_cards.append(
            f"""
      <article class="card">
        <p class="eyebrow">{escape(element['elementType'])} · {escape(element['goal'])} · {escape(element['instrumentSourceId'])}</p>
        <h2>{escape(element['elementId'])}</h2>
        <audio controls preload="metadata" src="{escape(element['reviewAudioSrc'])}"></audio>
        <p class="question">{escape(element['businessQuestion'])}</p>
        <details>
          <summary>元素参数 / QA</summary>
          <pre>{escape(json.dumps({k: element[k] for k in ['elementId','elementType','goal','instrument','notes','durationSeconds','analysis','machineStatus','failures']}, ensure_ascii=False, indent=2))}</pre>
        </details>
      </article>
"""
        )
    symbolic_cards = []
    for element in manifest["symbolicElements"]:
        symbolic_cards.append(
            f"""
      <article class="card symbolic">
        <p class="eyebrow">{escape(element['elementType'])} · {escape(element['goal'])}</p>
        <h2>{escape(element['elementId'])}</h2>
        <p class="question">{escape(element['businessQuestion'])}</p>
        <pre>{escape(json.dumps(element, ensure_ascii=False, indent=2))}</pre>
      </article>
"""
        )
    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Atomic Foundation Elements V1</title>
  <style>
    body {{ margin:0; background:#101210; color:#eef5ef; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }}
    main {{ max-width:1120px; margin:0 auto; padding:32px 18px 64px; }}
    .hero,.card {{ border:1px solid rgba(255,255,255,.12); border-radius:24px; padding:20px; background:rgba(255,255,255,.045); margin:16px 0; }}
    .hero {{ background:linear-gradient(135deg,rgba(169,139,96,.18),rgba(73,101,88,.16)); }}
    .eyebrow {{ color:#bbcab8; letter-spacing:.08em; text-transform:uppercase; font-size:12px; }}
    audio {{ width:100%; margin:10px 0; }}
    pre {{ white-space:pre-wrap; color:#dce8d7; max-height:360px; overflow:auto; }}
    summary {{ cursor:pointer; color:#dcc38d; }}
    .question {{ color:#f2dfb0; }}
    .symbolic {{ background:rgba(83,99,83,.18); }}
    nav {{ display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }}
    nav a {{ color:#f2dfb0; border:1px solid rgba(242,223,176,.35); border-radius:999px; padding:8px 12px; text-decoration:none; }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <p class="eyebrow">SNOOZE · Foundational elements · atomic review</p>
      <h1>基础元素拆解与筛选页</h1>
      <p>这不是音乐候选页。这里按“元素能不能用”来筛：单音、和声单元、短动机、低音支撑、和声模板、动机模板、曲式规则、编配规则。</p>
      <p>判断标准不是喜不喜欢一首歌，而是：这个元素是否可复用、可组合、不会太像固定曲子、不会刺耳或抢注意力。</p>
      <nav>
        <a href="#audio">音频原子元素</a>
        <a href="#symbolic">结构规则元素</a>
      </nav>
    </section>
    <section id="audio">
      <h2>音频原子元素</h2>
      {''.join(audio_cards)}
    </section>
    <section id="symbolic">
      <h2>结构规则元素</h2>
      {''.join(symbolic_cards)}
    </section>
  </main>
</body>
</html>
"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main() -> None:
    proof.require_tools()
    for directory in [MASTER_DIR, PREPARED_DIR, REVIEW_DIR, REPORT_JSON.parent]:
        directory.mkdir(parents=True, exist_ok=True)
    library = load_json(ROOT / "config/composition-material-library-v1.json")
    samplers = make_samplers()
    audio_elements = build_audio_elements(library, samplers)
    symbolic_elements = build_symbolic_elements(library)
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": "atomic_foundation_elements_pending_human_review",
        "productionAllowed": False,
        "formalUsableCount": 0,
        "humanPassCount": 0,
        "purpose": "Review true foundational elements instead of finished or semi-finished music candidates.",
        "hardRules": [
            "Do not review these as finished songs.",
            "Every audio item must be short: single notes, chord cells, motifs, or support gestures.",
            "Symbolic elements are structure data, not audio.",
            "No Lyria, no finished songs, no voice, no drums, no therapeutic claims.",
        ],
        "counts": {
            "audioElements": len(audio_elements),
            "symbolicElements": len(symbolic_elements),
            "totalElements": len(audio_elements) + len(symbolic_elements),
            "singleNotes": sum(1 for item in audio_elements if item["elementType"] == "single_note"),
            "harmonyCells": sum(1 for item in audio_elements if item["elementType"] == "harmony_cell"),
            "shortMotifs": sum(1 for item in audio_elements if item["elementType"] == "short_motif"),
            "bassSupport": sum(1 for item in audio_elements if item["elementType"] == "bass_support"),
        },
        "reviewUrl": f"/review/{BATCH_ID}/index.html",
        "audioElements": audio_elements,
        "symbolicElements": symbolic_elements,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)
    report = {
        "batchId": BATCH_ID,
        "verdict": "atomic_foundation_elements_generated_human_review_required",
        "counts": manifest["counts"],
        "reviewUrl": manifest["reviewUrl"],
        "productionAllowed": False,
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(
        f"""# Atomic Foundation Elements V1

Generated: {manifest['generatedAt']}

## Verdict

atomic_foundation_elements_generated_human_review_required

This is the corrected review surface: select true foundational elements, not finished music candidates.

## Counts

| Type | Count |
| --- | ---: |
| Audio elements | {manifest['counts']['audioElements']} |
| Symbolic elements | {manifest['counts']['symbolicElements']} |
| Total elements | {manifest['counts']['totalElements']} |
| Single notes | {manifest['counts']['singleNotes']} |
| Harmony cells | {manifest['counts']['harmonyCells']} |
| Short motifs | {manifest['counts']['shortMotifs']} |
| Bass support | {manifest['counts']['bassSupport']} |

## Review

Open: `{manifest['reviewUrl']}`
""",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
