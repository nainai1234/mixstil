#!/usr/bin/env python3
"""Generate independent A/B/C compositions from reusable material pools."""
import difflib
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BATCH = "independent-composition-pilot-v3"
LIBRARY_PATH = ROOT / "config/composition-material-library-v1.json"
V2_PATH = ROOT / "scripts/generate-music-inventory-expansion-v2.py"
OUT_DIR = ROOT / "public/audio/music/local-review" / BATCH
REVIEW_DIR = ROOT / "public/review" / BATCH

module_spec = importlib.util.spec_from_file_location("inventory_v2", V2_PATH)
v2 = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(v2)

ROLES = v2.ROLES
MIDI = v2.base.pilot.base.MIDI


def indexed(items):
    return {item["id"]: item for item in items}


def add(events, instrument, start, note, duration, velocity, role="support", pan=0.0):
    events.append({"instrument": instrument, "start": start, "note": note,
                   "duration": duration, "velocity": velocity, "pan": pan,
                   "softAttack": True, "role": role})


def section_index(starts, at):
    selected = 0
    for index, start in enumerate(starts):
        if start <= at:
            selected = index
        else:
            break
    return selected


def phrase_material(motif, occurrence, variant):
    notes = list(motif["notes"])
    beats = list(motif["beats"])
    if variant == "descending_answer" and occurrence % 2 == 1:
        notes.reverse()
        beats.reverse()
    elif variant == "rotate":
        amount = occurrence % len(notes)
        notes = notes[amount:] + notes[:amount]
        beats = beats[amount:] + beats[:amount]
    elif variant == "reduce_last" and occurrence >= 2:
        notes = notes[::2]
        beats = beats[::2]
    elif variant == "direct" and occurrence % 2 == 1:
        notes = notes[:-1] + [notes[-2], notes[-1]]
    return notes, beats


def build_events(plan, harmony, motif, form, grammar):
    goal, instrument = plan["goal"], plan["instrument"]
    starts, chords = form["sectionStarts"], harmony["chords"]
    events = []
    for index, start in enumerate(starts):
        chord = chords[index % len(chords)]
        next_start = starts[index + 1] if index + 1 < len(starts) else form["releaseAt"]
        requested_duration = max(7.0, next_start - start - 1.0)
        for voice, note in enumerate(chord):
            add(events, instrument, start + voice * .055, note, requested_duration,
                {"sleep": .027, "calm": .032, "focus": .030}[goal] - voice * .0035,
                "harmony", (-.035, 0, .035)[voice])

    for occurrence, start in enumerate(form["motifStarts"]):
        notes, beats = phrase_material(motif, occurrence, plan["variant"])
        cursor = start
        for index, (note, beat) in enumerate(zip(notes, beats)):
            add(events, instrument, cursor, note, max(.8, beat * .9),
                {"sleep": .030, "calm": .039, "focus": .033}[goal],
                "motif", .02 if index % 2 == 0 else -.02)
            cursor += beat

    cursor, pattern_index = 8.2, 0
    while cursor < form["releaseAt"] - 2.0:
        section = section_index(starts, cursor)
        chord = chords[section % len(chords)]
        note_index = grammar["pattern"][pattern_index % len(grammar["pattern"])] % len(chord)
        add(events, instrument, cursor, chord[note_index], min(3.4, grammar["spacing"] * 1.1),
            {"sleep": .017, "calm": .021, "focus": .020}[goal],
            "accompaniment", .018 if pattern_index % 2 else -.018)
        cursor += grammar["spacing"] * (1.0 + .06 * (pattern_index % 4))
        pattern_index += 1

    cursor, support_index = 1.7, 0
    while cursor < form["releaseAt"] + 1.0:
        section = section_index(starts, cursor)
        chord = chords[section % len(chords)]
        support_instrument = "bass" if instrument == "rhodes" else instrument
        add(events, support_instrument, cursor, chord[0], 3.0,
            {"sleep": .014, "calm": .016, "focus": .014}[goal],
            "low_support", -.012 if support_index % 2 else .012)
        cursor += grammar["supportStep"] * (1.0 + .035 * (support_index % 3))
        support_index += 1

    first_chord, last_chord = chords[0], chords[-1]
    add(events, instrument, .35, first_chord[1], 7.4, .021, "transition")
    add(events, instrument, form["releaseAt"], last_chord[1], 8.2, .017, "transition")
    return events


def sequence_similarity(left, right):
    return difflib.SequenceMatcher(a=left, b=right, autojunk=False).ratio()


def fingerprint(harmony, motif, form, grammar):
    roots = [min(MIDI[note] for note in chord) for chord in harmony["chords"]]
    intervals = [MIDI[right] - MIDI[left] for left, right in zip(motif["notes"], motif["notes"][1:])]
    beat_shape = [round(float(value), 2) for value in motif["beats"]]
    form_gaps = [round(right - left, 1) for left, right in zip(form["sectionStarts"], form["sectionStarts"][1:])]
    return {"harmonyRoots": roots, "motifIntervals": intervals, "motifBeats": beat_shape,
            "formGaps": form_gaps, "grammarPattern": grammar["pattern"]}


def fingerprint_similarity(left, right):
    return round(
        .30 * sequence_similarity(left["harmonyRoots"], right["harmonyRoots"])
        + .30 * sequence_similarity(left["motifIntervals"], right["motifIntervals"])
        + .15 * sequence_similarity(left["motifBeats"], right["motifBeats"])
        + .15 * sequence_similarity(left["formGaps"], right["formGaps"])
        + .10 * sequence_similarity(left["grammarPattern"], right["grammarPattern"]),
        4,
    )


def render_review(records, similarities):
    groups = {}
    for record in records:
        groups.setdefault(record["profileId"], []).append(record)
    sections = []
    for profile_id, items in groups.items():
        cards = []
        for item in items:
            layers = "".join(
                f"<details><summary>{stem['role']}</summary><audio controls preload='metadata' src='{stem['reviewPath']}'></audio></details>"
                for stem in item["stems"]
            )
            cards.append(f"<article><p class='eyebrow'>{item['goal']} · {item['scene']}</p><h3>{item['compositionId']}</h3>"
                         f"<p>{item['materials']['harmony']} · {item['materials']['motif']} · {item['materials']['form']}</p>"
                         f"<audio controls preload='metadata' src='{item['fullMixReviewPath']}'></audio>{layers}</article>")
        sections.append(f"<section><h2>{profile_id}: A / B / C</h2>{''.join(cards)}</section>")
    html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Independent Composition Pilot V3</title><style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}main{{max-width:960px;margin:auto;padding:30px 18px 70px}}header,section,article{{padding:20px 0;border-bottom:1px solid #344139}}h1{{font-size:28px}}h2{{margin-top:28px}}h3{{font-size:18px}}.eyebrow{{font-size:12px;color:#aebeb2}}audio{{width:100%;margin:8px 0}}summary{{cursor:pointer;color:#d6c096}}pre{{white-space:pre-wrap}}</style></head><body><main>
<header><p class='eyebrow'>SNOOZE · INDEPENDENT COMPOSITION · V3</p><h1>同一风格，A / B / C 三首独立曲子</h1><p>每首使用不同和声图、Motif、段落图和伴奏语法。真实 CC0 采样、项目自有编排、无商业 API。当前仅供听感和多样性 QA。</p><details><summary>作品指纹相似度</summary><pre>{json.dumps(similarities, ensure_ascii=False, indent=2)}</pre></details></header>{''.join(sections)}</main></body></html>"""
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    library = json.loads(LIBRARY_PATH.read_text(encoding="utf-8"))
    harmonies = indexed(library["harmonyPool"])
    motifs = indexed(library["motifPool"])
    forms = indexed(library["formPool"])
    grammars = indexed(library["grammarPool"])
    plans = library["compositionPlans"]
    piano_sources = v2.base.pilot.base.load_sources()
    instrument_sources = v2.base.pilot.western.load_instruments()

    fingerprints = {}
    for plan in plans:
        fingerprints[plan["id"]] = fingerprint(harmonies[plan["harmonyId"]], motifs[plan["motifId"]],
                                                forms[plan["formId"]], grammars[plan["grammarId"]])
    similarities = {}
    for left_index, left in enumerate(plans):
        for right in plans[left_index + 1:]:
            key = f"{left['id']} vs {right['id']}"
            similarities[key] = fingerprint_similarity(fingerprints[left["id"]], fingerprints[right["id"]])
    maximum_similarity = max(similarities.values())
    if maximum_similarity > .78:
        offenders = {key: value for key, value in similarities.items() if value > .78}
        raise SystemExit(f"Composition similarity gate failed: {offenders}")

    records = []
    for plan in plans:
        harmony, motif = harmonies[plan["harmonyId"]], motifs[plan["motifId"]]
        form, grammar = forms[plan["formId"]], grammars[plan["grammarId"]]
        events = build_events(plan, harmony, motif, form, grammar)
        layers = v2.base.render_layers(events, plan["seed"], plan["lowpass"], piano_sources, instrument_sources)
        defaults = v2.DEFAULT_VOLUMES[plan["goal"]]
        full_mix = sum(layers[role] * defaults[role] for role in ROLES)
        target_peak = 10 ** (-8 / 20)
        shared_gain = min(4.0, target_peak / max(float(np.max(np.abs(full_mix))), 1e-9))
        layers = {role: audio * shared_gain for role, audio in layers.items()}
        full_mix = sum(layers[role] * defaults[role] for role in ROLES)
        kit_id = f"kit_{plan['id']}_001"
        kit_dir = OUT_DIR / kit_id
        stems = []
        for role in ROLES:
            path = kit_dir / f"{role}.mp3"
            v2.write_mp3(path, layers[role])
            stems.append({"role": role, "defaultVolume": round(defaults[role] * 100),
                          "metrics": v2.metrics(layers[role]),
                          "publicPath": "/" + str(path.relative_to(ROOT / "public")),
                          "reviewPath": f"../../audio/music/local-review/{BATCH}/{kit_id}/{role}.mp3"})
        mix_path = kit_dir / "full_mix.mp3"
        v2.write_mp3(mix_path, full_mix)
        mix_metrics = v2.metrics(full_mix)
        records.append({
            "id": kit_id, "compositionId": plan["id"], "profileId": plan["profileId"],
            "goal": plan["goal"], "scene": plan["scene"], "status": "candidate",
            "sourceRights": "VCSL or Discord GM CC0-1.0; project-owned deterministic composition",
            "materials": {"harmony": plan["harmonyId"], "motif": plan["motifId"],
                          "form": plan["formId"], "grammar": plan["grammarId"]},
            "fingerprint": fingerprints[plan["id"]], "mixMetrics": mix_metrics,
            "machineQa": {"duration": mix_metrics["durationSeconds"] == 96.0,
                          "coreContinuity": mix_metrics["coreLongestBelowMinus48DbSeconds"] <= 4.5,
                          "controlledTopEnd": mix_metrics["highFrequencyEnergyRatio"] <= .16,
                          "peakSafe": mix_metrics["peakDbfs"] <= -6.0},
            "reconstructionMaxAbsError": float(np.max(np.abs(sum(layers[r] * defaults[r] for r in ROLES) - full_mix))),
            "fullMixPublicPath": "/" + str(mix_path.relative_to(ROOT / "public")),
            "fullMixReviewPath": f"../../audio/music/local-review/{BATCH}/{kit_id}/full_mix.mp3",
            "stems": stems,
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {"batch": BATCH, "status": "candidate", "paidApi": False, "generativeModel": False,
                "compositionModel": "StyleProfile -> material pools -> independent CompositionPlan -> MusicKit",
                "similarityThreshold": .78, "maximumSimilarity": maximum_similarity,
                "pairwiseSimilarity": similarities, "kits": records,
                "releaseBoundary": "Candidate only. Human A/B/C diversity listening is required before promotion."}
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    render_review(records, similarities)
    print(json.dumps({"passed": True, "compositions": len(records), "musicStems": len(records) * len(ROLES),
                      "profiles": len(set(item["profileId"] for item in records)),
                      "maximumSimilarity": maximum_similarity,
                      "review": str(REVIEW_DIR / 'index.html')}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
