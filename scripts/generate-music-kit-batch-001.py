#!/usr/bin/env python3
"""Split the three accepted profile pilots into synchronized MusicKit stems."""
import importlib.util
import json
import math
import os
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
PILOT_PATH = ROOT / "scripts/generate-profile-pilot-batch-001.py"
CONFIG_PATH = ROOT / "config/music-kits-v1.json"
BATCH = os.environ.get("MUSIC_KIT_BATCH", "music-kit-batch-001")
CONTINUITY_V2 = os.environ.get("MUSIC_KIT_CONTINUITY_V2", "0") == "1"
OUT_DIR = ROOT / f"public/audio/music/local-review/{BATCH}"
REVIEW_DIR = ROOT / f"public/review/{BATCH}"
SR = 44100
ROLES = ("harmony", "melody", "accompaniment", "low_support", "transition")

module_spec = importlib.util.spec_from_file_location("profile_pilot", PILOT_PATH)
pilot = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(pilot)


def classify_event(event):
    start = float(event["start"])
    midi = pilot.base.MIDI[event["note"]]
    if start < 8.0 or start >= 78.0:
        return "transition"
    if event.get("role") == "motif":
        return "melody"
    if event.get("instrument") == "bass" or midi <= 47:
        return "low_support"
    if float(event["duration"]) >= 6.0 or float(event["velocity"]) >= 0.028:
        return "harmony"
    return "accompaniment"


def render_layers(events, seed, lowpass_hz, piano_sources, instrument_sources):
    rng = np.random.default_rng(seed)
    length = int(pilot.DURATION * SR)
    layers = {role: np.zeros((length, 2), dtype=np.float64) for role in ROLES}
    for event in sorted(events, key=lambda item: item["start"]):
        instrument = event["instrument"]
        if instrument == "piano":
            audio, _ = pilot.base.natural_note(piano_sources, event, rng)
        else:
            audio = pilot.western.sampled_note(
                instrument_sources,
                instrument,
                pilot.base.MIDI[event["note"]],
                event["duration"],
                event["velocity"],
                event["pan"],
                rng,
            )
        start = max(0.0, event["start"] + rng.uniform(-0.018, 0.018))
        offset = int(start * SR)
        end = min(length, offset + len(audio))
        if end > offset:
            layers[classify_event(event)][offset:end] += audio[:end - offset]

    sos = butter(3, lowpass_hz, btype="lowpass", fs=SR, output="sos")
    fade_in, fade_out = int(1.4 * SR), int(7 * SR)
    fade_in_curve = np.sin(np.linspace(0, math.pi / 2, fade_in)) ** 1.25
    fade_out_curve = np.cos(np.linspace(0, math.pi / 2, fade_out)) ** 1.5
    for role in ROLES:
        layer = layers[role]
        mid = (layer[:, 0] + layer[:, 1]) * 0.5
        side = (layer[:, 0] - layer[:, 1]) * 0.5 * 0.38
        layer[:, 0], layer[:, 1] = mid + side, mid - side
        layer = sosfiltfilt(sos, layer, axis=0)
        layer[:fade_in] *= fade_in_curve[:, None]
        layer[-fade_out:] *= fade_out_curve[:, None]
        layers[role] = layer

    maximum_mix = sum(layers.values())
    scale = pilot.base.base.db_to_amp(-8) / max(float(np.max(np.abs(maximum_mix))), 1e-9)
    return {role: audio * scale for role, audio in layers.items()}


def audio_metrics(audio):
    mono = audio.mean(axis=1)
    rms = float(np.sqrt(np.mean(mono ** 2)) + 1e-12)
    peak = float(np.max(np.abs(mono)) + 1e-12)
    active = float(np.mean(np.abs(mono) > pilot.base.base.db_to_amp(-55)))
    return {
        "durationSeconds": round(len(audio) / SR, 2),
        "peakDbfs": round(20 * math.log10(peak), 2),
        "rmsDbfs": round(20 * math.log10(rms), 2),
        "activeRatio": round(active, 4),
    }


def write_audio(path, audio):
    sf.write(path.with_suffix(".wav"), audio, SR, subtype="PCM_24")
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(path.with_suffix(".wav")),
        "-codec:a", "libmp3lame", "-q:a", "2",
        str(path.with_suffix(".mp3")),
    ], check=True)


def main():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    kit_by_profile = {item["profileId"]: item for item in config["kits"]}
    plans = pilot.all_plans()
    piano_sources = pilot.base.load_sources()
    instrument_sources = pilot.western.load_instruments()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    records = []

    for index, (brief, motif, phrases, form, events, source_note) in enumerate(plans):
        if CONTINUITY_V2:
            # Extend only quiet support notes to reduce accidental holes from
            # one-shot samples; this is musical continuity, not a noise bed.
            for event in events:
                if event.get("role") == "support":
                    event["duration"] = min(float(event["duration"]) * 1.55, 3.8)
        kit = kit_by_profile[brief.profile_id]
        defaults = {item["role"]: item["defaultVolume"] / 100 for item in kit["stems"]}
        kit_dir = OUT_DIR / kit["id"]
        kit_dir.mkdir(parents=True, exist_ok=True)
        layers = render_layers(
            events,
            brief.seed,
            (2850, 4200, 3600, 2500, 3400, 3000)[index],
            piano_sources,
            instrument_sources,
        )
        full_mix = sum(layers[role] * defaults[role] for role in ROLES)
        stem_records = []
        for role in ROLES:
            path = kit_dir / role
            write_audio(path, layers[role])
            relative = path.with_suffix(".mp3").relative_to(ROOT / "public")
            stem_records.append({
                "role": role,
                "defaultVolume": round(defaults[role] * 100),
                "metrics": audio_metrics(layers[role]),
                "publicPath": "/" + str(relative),
                "reviewPath": f"../../audio/music/local-review/{BATCH}/" + kit["id"] + f"/{role}.mp3",
            })
        mix_path = kit_dir / "full_mix"
        write_audio(mix_path, full_mix)
        reconstructed = sum(layers[role] * defaults[role] for role in ROLES)
        records.append({
            "id": kit["id"],
            "version": kit["version"],
            "status": "candidate",
            "profileId": brief.profile_id,
            "goal": brief.goal,
            "form": form.name,
            "sourceRights": kit["sourceRights"],
            "loopCrossfadeSeconds": kit["loopCrossfadeSeconds"],
            "mixMetrics": audio_metrics(full_mix),
            "reconstructionMaxAbsError": float(np.max(np.abs(reconstructed - full_mix))),
            "fullMixReviewPath": f"../../audio/music/local-review/{BATCH}/" + kit["id"] + "/full_mix.mp3",
            "stems": stem_records,
        })

    manifest = {
        "batch": BATCH,
        "status": "candidate",
        "continuityVariant": "support-note-overlap-v2" if CONTINUITY_V2 else "baseline",
        "paidApi": False,
        "generativeModel": False,
        "requiredRoles": list(ROLES),
        "mixContract": "All stems share sample rate, duration, timeline, profile, key, and tempo. Default-volume sum reconstructs full_mix.",
        "releaseBoundary": "Listening review only. Nothing in this batch is registered or approved for consumer use.",
        "kits": records,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    render_review(records)
    print(f"Wrote {len(records)} MusicKits and {len(records) * len(ROLES)} synchronized stems")
    print(f"Review: {REVIEW_DIR / 'index.html'}")


def render_review(records):
    labels = {
        "harmony": "Harmony",
        "melody": "Melody",
        "accompaniment": "Accompaniment",
        "low_support": "Low support",
        "transition": "Arrival / release",
    }
    sections = []
    for record in records:
        rows = []
        for stem in record["stems"]:
            role = stem["role"]
            value = stem["defaultVolume"]
            rows.append(
                f"<div class='layer'><button type='button' class='solo' data-solo='{role}' title='Solo {labels[role]}'>{labels[role]}</button>"
                f"<input type='range' min='0' max='100' value='{value}' data-default='{value}' data-role='{role}' aria-label='{labels[role]} volume'>"
                f"<output>{value}%</output><audio preload='metadata' data-audio-role='{role}' src='{stem['reviewPath']}'></audio></div>"
            )
        sections.append(
            f"<section class='kit' data-kit='{record['id']}'><header><p class='eyebrow'>{record['goal']} · {record['profileId']}</p>"
            f"<h2>{record['id']}</h2><p>{record['sourceRights']}</p></header>"
            f"<audio class='full' controls preload='metadata' src='{record['fullMixReviewPath']}'></audio>"
            f"<div class='transport'><button type='button' class='toggle'>Play adjustable layers</button>"
            f"<button type='button' class='reset'>Reset</button><span class='time'>0:00</span></div>"
            f"<div class='layers'>{''.join(rows)}</div></section>"
        )

    html = """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SNOOZE MusicKit {BATCH}</title><style>
:root{--bg:#101312;--panel:#181d1a;--line:#344139;--text:#eef4ee;--muted:#aebeb2;--accent:#d6c096}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:920px;margin:auto;padding:30px 18px 70px}.intro{padding-bottom:24px;border-bottom:1px solid var(--line)}
h1{font-size:30px;margin:8px 0}h2{font-size:19px;margin:5px 0}.eyebrow{font-size:12px;color:var(--muted)}
.kit{padding:24px 0;border-bottom:1px solid var(--line)}.full{width:100%;margin:12px 0}
.transport{display:flex;gap:8px;align-items:center;margin:8px 0 16px}
button{min-height:38px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--text);padding:0 12px;cursor:pointer}
.toggle{background:var(--accent);color:#151812;border:0;font-weight:700}.time{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums}
.layers{display:grid;gap:8px}.layer{display:grid;grid-template-columns:150px minmax(0,1fr) 52px;gap:10px;align-items:center}
.solo{text-align:left}input{width:100%}output{font-size:13px;color:var(--muted);text-align:right}
@media(max-width:560px){.layer{grid-template-columns:118px minmax(0,1fr) 44px}}
</style></head><body><main><header class="intro"><p class="eyebrow">SNOOZE · MUSIC KIT · CANDIDATE</p>
<h1>可拆分原创音乐素材包</h1><p>批次：{BATCH}。每套音乐共享时间轴、调式和速度。先试听完整 Mix，再同时播放五层并调整比例。当前仅供审核，尚未进入正式素材库。</p>
</header>""" + "".join(sections) + """</main><script>
document.querySelectorAll(".kit").forEach(function(kit){
  var audios=Array.from(kit.querySelectorAll("audio[data-audio-role]"));
  var full=kit.querySelector(".full");
  var toggle=kit.querySelector(".toggle");
  var time=kit.querySelector(".time");
  var timer=null;
  function sync(){
    var leader=audios[0];
    if(!leader)return;
    audios.slice(1).forEach(function(audio){if(Math.abs(audio.currentTime-leader.currentTime)>.12)audio.currentTime=leader.currentTime;});
    time.textContent=Math.floor(leader.currentTime/60)+":"+String(Math.floor(leader.currentTime%60)).padStart(2,"0");
  }
  toggle.addEventListener("click",async function(){
    full.pause();
    if(audios.some(function(audio){return !audio.paused;})){
      audios.forEach(function(audio){audio.pause();});
      toggle.textContent="Play adjustable layers";
      clearInterval(timer);
      return;
    }
    var start=audios[0] ? audios[0].currentTime : 0;
    audios.forEach(function(audio){audio.currentTime=start;});
    await Promise.all(audios.map(function(audio){return audio.play();}));
    toggle.textContent="Pause adjustable layers";
    timer=setInterval(sync,250);
  });
  kit.querySelectorAll("input[data-role]").forEach(function(input){
    input.addEventListener("input",function(){
      var selector="audio[data-audio-role='"+input.dataset.role+"']";
      kit.querySelector(selector).volume=Number(input.value)/100;
      input.nextElementSibling.value=input.value+"%";
    });
    input.dispatchEvent(new Event("input"));
  });
  kit.querySelectorAll("[data-solo]").forEach(function(button){
    button.addEventListener("click",function(){
      kit.querySelectorAll("input[data-role]").forEach(function(input){
        input.value=input.dataset.role===button.dataset.solo ? "100" : "0";
        input.dispatchEvent(new Event("input"));
      });
    });
  });
  kit.querySelector(".reset").addEventListener("click",function(){
    audios.forEach(function(audio){audio.pause();audio.currentTime=0;});
    clearInterval(timer);
    toggle.textContent="Play adjustable layers";
    time.textContent="0:00";
    kit.querySelectorAll("input[data-role]").forEach(function(input){
      input.value=input.dataset.default;
      input.dispatchEvent(new Event("input"));
    });
  });
});
</script></body></html>"""
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
