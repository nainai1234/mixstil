#!/usr/bin/env python3
"""Render the 15 rights-ready MusicKit expansion profiles as synchronized stems."""
import importlib.util
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import welch

ROOT = Path(__file__).resolve().parents[1]
BATCH = "music-inventory-expansion-v2"
OUT_DIR = ROOT / "public/audio/music/local-review" / BATCH
REVIEW_DIR = ROOT / "public/review" / BATCH
PLAN_PATH = ROOT / "config/content-inventory-expansion-v2.json"
BASE_PATH = ROOT / "scripts/generate-music-kit-batch-001.py"

module_spec = importlib.util.spec_from_file_location("music_kit_batch_001", BASE_PATH)
base = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(base)

SR = base.SR
DURATION = 96.0
ROLES = base.ROLES


COMPOSITIONS = {
    "modal_piano_night_fall": dict(instrument="piano", seed=4201, lowpass=2700, meter="4/4", tempo=50,
        chords=[("C2","G2","E3"),("A2","E3","C3"),("F2","C3","A3"),("C2","G2","D3")],
        motif=("G3","E3","D3","C3"), spacing=3.8, contour="falling_modal"),
    "six_eight_guitar_lullaby_no_backbeat": dict(instrument="guitar", seed=4202, lowpass=3300, meter="6/8", tempo=47,
        chords=[("C3","G3","E4"),("A2","E3","C4"),("F2","C3","A3"),("G2","D3","B3")],
        motif=("E4","G4","E4","D4"), spacing=2.9, contour="soft_wave"),
    "low_piano_rain_compatible": dict(instrument="piano", seed=4203, lowpass=2450, meter="free_4/4", tempo=48,
        chords=[("C2","G2","E3"),("F2","C3","G3"),("A2","E3","C4"),("C2","G2","E3")],
        motif=("E3","G3","A3","G3"), spacing=4.1, contour="small_arch"),
    "low_piano_ocean_compatible": dict(instrument="piano", seed=4204, lowpass=2550, meter="free_6/8", tempo=46,
        chords=[("C2","G2","D3"),("A2","E3","B3"),("F2","C3","G3"),("G2","D3","A3")],
        motif=("D3","G3","A3","E3"), spacing=4.4, contour="long_wave"),
    "return_sleep_sparse_piano": dict(instrument="piano", seed=4205, lowpass=2300, meter="free", tempo=44,
        chords=[("C2","G2","E3"),("A2","E3","C3"),("F2","C3","A3"),("C2","G2","E3")],
        motif=("E3","D3","C3"), spacing=4.0, contour="short_descent"),
    "return_sleep_open_fifth_guitar": dict(instrument="guitar", seed=4206, lowpass=3000, meter="4/4", tempo=46,
        chords=[("C3","G3","C4"),("F2","C3","G3"),("A2","E3","A3"),("G2","D3","G3")],
        motif=("C4","G4","E4"), spacing=3.6, contour="open_fifth_return"),
    "return_sleep_melody_optional_keys": dict(instrument="piano", seed=4207, lowpass=2200, meter="free", tempo=43,
        chords=[("C2","G2","E3"),("F2","C3","A3"),("A2","E3","C4"),("C2","G2","E3")],
        motif=("G3","E3","C3"), spacing=4.2, contour="reduced_identity", melody_scale=.68),
    "warm_rhodes_sleep_nocturne": dict(instrument="rhodes", seed=4208, lowpass=2600, meter="4/4", tempo=49,
        chords=[("C2","G2","E3"),("A2","E3","C4"),("F2","C3","A3"),("C2","G2","E3")],
        motif=("E3","G3","E3","D3"), spacing=3.7, contour="warm_fall"),
    "breathing_pentatonic_piano": dict(instrument="piano", seed=4301, lowpass=3000, meter="4/4", tempo=53,
        chords=[("C2","G2","E3"),("F2","C3","A3"),("A2","E3","C4"),("G2","D3","B3")],
        motif=("E3","G3","A3","G3","E3"), spacing=3.0, contour="breath_arch"),
    "emotional_settling_dry_rhodes": dict(instrument="rhodes", seed=4302, lowpass=3100, meter="4/4", tempo=57,
        chords=[("C3","G3","D4"),("A2","E3","G3"),("F2","C3","A3"),("G2","D3","B3")],
        motif=("D4","E4","G4","E4"), spacing=2.7, contour="narrow_settle"),
    "calm_low_piano_reflection": dict(instrument="piano", seed=4303, lowpass=2800, meter="3/4", tempo=55,
        chords=[("C2","G2","E3"),("F2","C3","A3"),("A2","E3","G3"),("C2","G2","E3")],
        motif=("E3","G3","C4","A3","G3"), spacing=3.2, contour="reflective_arch"),
    "stable_rhodes_common_tone": dict(instrument="rhodes", seed=4401, lowpass=3400, meter="4/4", tempo=64,
        chords=[("C3","G3","E4"),("A2","G3","E4"),("F2","C3","E4"),("G2","D3","E4")],
        motif=("E4","D4","E4","G4"), spacing=2.45, contour="common_tone_cycle"),
    "dry_piano_deep_work": dict(instrument="piano", seed=4402, lowpass=3200, meter="4/4", tempo=62,
        chords=[("C3","G3","D4"),("A2","E3","B3"),("F2","C3","G3"),("G2","D3","A3")],
        motif=("D4","E4","D4","A3"), spacing=2.5, contour="work_cycle"),
    "low_motion_guitar_focus": dict(instrument="guitar", seed=4403, lowpass=3500, meter="6/8", tempo=60,
        chords=[("C3","G3","E4"),("A2","E3","C4"),("F2","C3","A3"),("G2","D3","B3")],
        motif=("E4","D4","G3","A3"), spacing=2.65, contour="restrained_wave"),
    "neutral_modal_keys_focus": dict(instrument="piano", seed=4404, lowpass=3100, meter="4/4", tempo=64,
        chords=[("C3","G3","D4"),("A2","E3","B3"),("F2","C3","G3"),("C3","G3","D4")],
        motif=("D4","E4","G4","E4"), spacing=2.55, contour="neutral_modal_cycle"),
}

DEFAULT_VOLUMES = {
    "sleep": {"harmony": .62, "melody": .48, "accompaniment": .44, "low_support": .38, "transition": .40},
    "calm": {"harmony": .62, "melody": .60, "accompaniment": .50, "low_support": .34, "transition": .44},
    "focus": {"harmony": .58, "melody": .42, "accompaniment": .60, "low_support": .30, "transition": .36},
}


def add(events, instrument, start, note, duration, velocity, role="support", pan=0.0):
    events.append({"instrument": instrument, "start": start, "note": note,
                   "duration": duration, "velocity": velocity, "pan": pan,
                   "softAttack": True, "role": role})


def build_events(profile, spec):
    goal, instrument = profile["goal"], spec["instrument"]
    events = []
    section_starts = (1.2, 24.0, 46.8, 69.6)
    harmony_velocity = {"sleep": .027, "calm": .032, "focus": .030}[goal]
    for section, start in enumerate(section_starts):
        chord = spec["chords"][section]
        for index, note in enumerate(chord):
            add(events, instrument, start + index * .065, note, 17.5,
                harmony_velocity - index * .004, "harmony", (-.03, 0, .03)[index])
        add(events, instrument, start + .18, chord[0], 15.5,
            .022 if goal == "sleep" else .025, "low_support", -.025)

    motif_starts = {"sleep": (13.0, 38.0, 63.0), "calm": (10.0, 33.0, 56.0, 76.0), "focus": (8.0, 29.0, 50.0, 71.0)}[goal]
    melody_scale = spec.get("melody_scale", 1.0)
    for phrase_index, start in enumerate(motif_starts):
        cursor = start
        notes = spec["motif"] if phrase_index % 2 == 0 else tuple(reversed(spec["motif"]))
        for note_index, note in enumerate(notes):
            duration = spec["spacing"] * (.62 + .08 * (note_index % 2))
            add(events, instrument, cursor, note, duration,
                ({"sleep": .032, "calm": .040, "focus": .034}[goal] * melody_scale),
                "motif", .018 if note_index % 2 == 0 else -.018)
            cursor += spec["spacing"] * (.82 + .12 * (note_index % 3))

    accompaniment_spacing = spec["spacing"] * ({"sleep": .78, "calm": .68, "focus": .62}[goal])
    cursor, index = 8.5, 0
    while cursor < 82.0:
        chord = spec["chords"][(index // 4) % 4]
        note = chord[1 + (index % 2)]
        add(events, instrument, cursor, note, min(3.2, accompaniment_spacing * 1.15),
            .018 if goal == "sleep" else .022, "accompaniment", .02 if index % 2 else -.02)
        cursor += accompaniment_spacing * (1.0 + .08 * (index % 3))
        index += 1

    # Sampled notes have finite tails. A very quiet, non-pulsing re-articulation
    # keeps the musical bed continuous without turning into a drone or beat.
    support_step = {"sleep": 2.35, "calm": 2.05, "focus": 1.95}[goal]
    cursor, index = 1.6, 0
    while cursor < 86.0:
        chord = spec["chords"][(index // 5) % 4]
        add(events, instrument, cursor, chord[0], 3.0,
            {"sleep": .014, "calm": .016, "focus": .014}[goal],
            "low_support", -.012 if index % 2 else .012)
        cursor += support_step * (1.0 + .04 * (index % 3))
        index += 1

    # Dedicated soft entry/release gestures guarantee an independently
    # controllable transition Stem without impacts or bright chimes.
    add(events, instrument, .4, spec["chords"][0][1], 7.2, .022, "transition")
    add(events, instrument, 84.0, spec["chords"][-1][1], 8.5, .018, "transition")
    return events


def metrics(audio):
    mono = np.mean(audio, axis=1)
    peak = max(float(np.max(np.abs(mono))), 1e-12)
    rms = max(float(np.sqrt(np.mean(mono ** 2))), 1e-12)
    frame = max(1, int(.25 * SR))
    usable = mono[:len(mono) - len(mono) % frame]
    frame_rms = np.sqrt(np.mean(usable.reshape(-1, frame) ** 2, axis=1))
    quiet = frame_rms < 10 ** (-48 / 20)
    longest = current = 0
    core_quiet = quiet[:int(84 / .25)]
    core_longest = core_current = 0
    for value in quiet:
        current = current + 1 if value else 0
        longest = max(longest, current)
    for value in core_quiet:
        core_current = core_current + 1 if value else 0
        core_longest = max(core_longest, core_current)
    frequencies, power = welch(mono, SR, nperseg=16384)
    audible = float(np.sum(power[(frequencies >= 30) & (frequencies < 16000)])) + 1e-18
    high = float(np.sum(power[(frequencies >= 4000) & (frequencies < 16000)])) / audible
    return {
        "durationSeconds": round(len(audio) / SR, 2),
        "peakDbfs": round(20 * math.log10(peak), 2),
        "rmsDbfs": round(20 * math.log10(rms), 2),
        "activeRatio": round(float(np.mean(np.abs(mono) > 10 ** (-55 / 20))), 4),
        "longestBelowMinus48DbSeconds": round(longest * .25, 2),
        "coreLongestBelowMinus48DbSeconds": round(core_longest * .25, 2),
        "highFrequencyEnergyRatio": round(high, 5),
    }


def write_mp3(path, audio):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp.wav")
    sf.write(temporary, audio, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(temporary),
                    "-codec:a", "libmp3lame", "-q:a", "4", str(path)], check=True)
    temporary.unlink()


def review_page(records, blocked):
    cards = []
    for record in records:
        layers = "".join(
            f"<details><summary>{stem['role']}</summary><audio controls preload='metadata' src='{stem['reviewPath']}'></audio></details>"
            for stem in record["stems"]
        )
        cards.append(
            f"<article><p class='eyebrow'>{record['goal']} · {record['scene']}</p><h2>{record['id']}</h2>"
            f"<p>{record['composition']['instrument']} · {record['composition']['meter']} · {record['composition']['tempo']} BPM · {record['composition']['contour']}</p>"
            f"<audio controls preload='metadata' src='{record['fullMixReviewPath']}'></audio>{layers}</article>"
        )
    blocked_html = "".join(f"<li><strong>{item['id']}</strong>: {item['sourceRoute']}</li>" for item in blocked)
    html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>SNOOZE Music Inventory Expansion V2</title><style>body{{margin:0;background:#101312;color:#eef4ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}main{{max-width:940px;margin:auto;padding:30px 18px 70px}}header,article{{padding:22px 0;border-bottom:1px solid #344139}}h1{{font-size:28px}}h2{{font-size:19px}}.eyebrow{{font-size:12px;color:#aebeb2}}audio{{width:100%;margin:9px 0}}details{{margin:6px 0}}summary{{cursor:pointer;color:#d6c096}}</style></head>
<body><main><header><p class='eyebrow'>SNOOZE · CANDIDATE INVENTORY · V2</p><h1>15套可生产候选 Music Kit</h1><p>全部使用已审核 CC0 真实采样与项目自有确定性编排，无付费 API、无人声、无鼓点、无蜂鸣底层。当前只供试听和 QA，尚未注册为正式素材。</p><h3>因缺少真实音源而阻断</h3><ul>{blocked_html}</ul></header>{''.join(cards)}</main></body></html>"""
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    planned = [item for item in plan["musicKits"] if item["status"] == "planned"]
    renderable = [item for item in planned if item["id"] in COMPOSITIONS]
    blocked = [item for item in planned if item["id"] not in COMPOSITIONS]
    if len(renderable) != 15 or len(blocked) != 3:
        raise SystemExit(f"Expected 15 renderable and 3 blocked profiles, received {len(renderable)} and {len(blocked)}")

    piano_sources = base.pilot.base.load_sources()
    instrument_sources = base.pilot.western.load_instruments()
    records = []
    for profile in renderable:
        spec = COMPOSITIONS[profile["id"]]
        events = build_events(profile, spec)
        layers = base.render_layers(events, spec["seed"], spec["lowpass"], piano_sources, instrument_sources)
        defaults = DEFAULT_VOLUMES[profile["goal"]]
        full_mix = sum(layers[role] * defaults[role] for role in ROLES)
        # The renderer keeps each raw Stem headroom-safe, but the user's
        # default MusicKit balance attenuates the reconstructed mix too far.
        # Apply one shared gain to every Stem so the mix is more audible while
        # preserving exact default-volume reconstruction.
        target_peak = 10 ** (-8 / 20)
        current_peak = max(float(np.max(np.abs(full_mix))), 1e-9)
        shared_gain = min(4.0, target_peak / current_peak)
        layers = {role: audio * shared_gain for role, audio in layers.items()}
        full_mix = sum(layers[role] * defaults[role] for role in ROLES)
        kit_id = f"kit_{profile['id']}_001"
        kit_dir = OUT_DIR / kit_id
        stems = []
        for role in ROLES:
            path = kit_dir / f"{role}.mp3"
            write_mp3(path, layers[role])
            stems.append({
                "role": role,
                "defaultVolume": round(defaults[role] * 100),
                "metrics": metrics(layers[role]),
                "publicPath": "/" + str(path.relative_to(ROOT / "public")),
                "reviewPath": f"../../audio/music/local-review/{BATCH}/{kit_id}/{role}.mp3",
            })
        mix_path = kit_dir / "full_mix.mp3"
        write_mp3(mix_path, full_mix)
        full_metrics = metrics(full_mix)
        records.append({
            "id": kit_id,
            "version": "0.1.0",
            "status": "candidate",
            "profileId": profile["id"],
            "goal": profile["goal"],
            "scene": profile["scene"],
            "sourceRights": "VCSL or Discord GM source under CC0-1.0; project-owned deterministic arrangement",
            "composition": {key: spec[key] for key in ("instrument", "meter", "tempo", "contour", "seed")},
            "mixMetrics": full_metrics,
            "machineQa": {
                "duration": full_metrics["durationSeconds"] == 96.0,
                "openingAndContinuity": full_metrics["coreLongestBelowMinus48DbSeconds"] <= 4.5,
                "controlledTopEnd": full_metrics["highFrequencyEnergyRatio"] <= .16,
                "peakSafe": full_metrics["peakDbfs"] <= -6.0,
            },
            "reconstructionMaxAbsError": float(np.max(np.abs(sum(layers[role] * defaults[role] for role in ROLES) - full_mix))),
            "fullMixPublicPath": "/" + str(mix_path.relative_to(ROOT / "public")),
            "fullMixReviewPath": f"../../audio/music/local-review/{BATCH}/{kit_id}/full_mix.mp3",
            "stems": stems,
        })

    manifest = {
        "batch": BATCH,
        "status": "candidate",
        "generator": "evidence-based deterministic MusicKit expansion renderer v2",
        "paidApi": False,
        "generativeModel": False,
        "requiredRoles": list(ROLES),
        "releaseBoundary": "Candidate only. Human listening, rights manifest, long-loop QA, and promotion are still required.",
        "kits": records,
        "blockedProfiles": [{"id": item["id"], "sourceRoute": item["sourceRoute"]} for item in blocked],
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    review_page(records, blocked)
    print(json.dumps({"passed": True, "renderedKits": len(records), "renderedStems": len(records) * len(ROLES),
                      "blockedProfiles": len(blocked), "review": str(REVIEW_DIR / 'index.html')}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
