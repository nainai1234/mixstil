#!/usr/bin/env python3
import itertools
import json
import math
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

ROOT = Path.cwd()
SOURCE_BATCH = ROOT / "public/audio/music/local-review/lyria-single-element-pilot-v1"
SOURCE_MANIFEST = SOURCE_BATCH / "manifest.json"
BATCH_ID = "lyria-element-combination-pilot-v1"
OUTPUT_ROOT = ROOT / "public/audio/music/local-review" / BATCH_ID
UNIT_DIR = OUTPUT_ROOT / "prepared-units"
MIX_DIR = OUTPUT_ROOT / "mixes"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
ANALYSIS_PATH = OUTPUT_ROOT / "analysis.json"
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"
TARGET_SECONDS = 600

PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

SCENARIOS = [
    {
        "id": "sleep_dark_warm",
        "title": "Sleep · Dark Warm",
        "goal": "sleep",
        "families": ["deep_low_drone", "warm_analog_pad", "felt_piano_phrase"],
        "gains": [0.48, 0.40, 0.20],
        "description": "低频 Drone、温暖 Pad 与稀疏毛毡钢琴；检验入睡场景中的调性冲突和短乐句重复。",
    },
    {
        "id": "meditation_open_air",
        "title": "Meditation · Open Air",
        "goal": "calm",
        "families": ["airy_bright_pad", "warm_rhodes_phrase", "sparse_tonal_texture"],
        "gains": [0.40, 0.25, 0.17],
        "description": "明亮 Pad、Rhodes 与稀疏颗粒纹理；检验留白、呼吸感和高频疲劳。",
    },
    {
        "id": "focus_steady_tonal",
        "title": "Focus · Steady Tonal",
        "goal": "focus",
        "families": ["open_fifth_harmonic_bed", "nylon_guitar_phrase", "sparse_tonal_texture"],
        "gains": [0.42, 0.27, 0.15],
        "description": "开放五度和声床、尼龙吉他与低注意力纹理；检验稳定推进和旋律干扰。",
    },
]


def run(command):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or f"command failed: {command}")
    return result.stdout


def estimate_key(chroma):
    normalized = chroma / (chroma.sum() + 1e-12)
    scores = []
    for mode, profile in (("major", MAJOR_PROFILE), ("minor", MINOR_PROFILE)):
        for root in range(12):
            shifted = np.roll(profile, root)
            score = float(np.corrcoef(normalized, shifted)[0, 1])
            scores.append((score, root, mode))
    scores.sort(reverse=True)
    best, second = scores[0], scores[1]
    return {
        "root": PITCH_NAMES[best[1]],
        "rootIndex": best[1],
        "mode": best[2],
        "confidence": round(max(0.0, best[0] - second[0]), 4),
        "profileScore": round(best[0], 4),
    }


def analyze(record):
    source = ROOT / "public" / record["audioUrl"].lstrip("/")
    audio, rate = librosa.load(source, sr=22050, mono=True)
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=audio, sr=rate, hop_length=hop)
    chroma_mean = chroma.mean(axis=1)
    chroma_mean = chroma_mean / (chroma_mean.sum() + 1e-12)
    onset = librosa.onset.onset_strength(y=audio, sr=rate, hop_length=hop)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset, sr=rate, hop_length=hop)
    tempo, beats = librosa.beat.beat_track(y=audio, sr=rate, hop_length=hop, trim=False)
    tempo_value = float(np.asarray(tempo).reshape(-1)[0]) if np.asarray(tempo).size else 0.0
    centroid = librosa.feature.spectral_centroid(y=audio, sr=rate, hop_length=hop)[0]
    rms = librosa.feature.rms(y=audio, hop_length=hop)[0]
    edge_frames = max(1, int(2.0 * rate / hop))
    start = chroma[:, :edge_frames].mean(axis=1)
    end = chroma[:, -edge_frames:].mean(axis=1)
    loop_score = float(np.dot(start, end) / ((np.linalg.norm(start) * np.linalg.norm(end)) + 1e-12))
    duration = len(audio) / rate
    return {
        "candidateId": record["candidateId"],
        "family": record["id"],
        "variant": record["variant"],
        "audioUrl": record["audioUrl"],
        "durationSeconds": round(duration, 3),
        "key": estimate_key(chroma_mean),
        "chroma": [round(float(value), 6) for value in chroma_mean],
        "estimatedTempoBpm": round(tempo_value, 2),
        "beatCount": int(len(beats)),
        "onsetDensityPerSecond": round(len(onset_frames) / max(duration, 1), 4),
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "rmsVariation": round(float(np.std(rms) / (np.mean(rms) + 1e-12)), 4),
        "loopTonalSimilarity": round(loop_score, 4),
    }


def chroma_similarity(left, right):
    a = np.array(left["chroma"])
    b = np.array(right["chroma"])
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-12))


def choose_combination(scenario, analyses):
    pools = [[item for item in analyses if item["family"] == family] for family in scenario["families"]]
    if any(len(pool) != 3 for pool in pools):
        raise RuntimeError(f"{scenario['id']} does not have three candidates per family")
    ranked = []
    for items in itertools.product(*pools):
        pair_scores = [chroma_similarity(a, b) for a, b in itertools.combinations(items, 2)]
        onset = float(np.mean([item["onsetDensityPerSecond"] for item in items]))
        loop = float(np.mean([item["loopTonalSimilarity"] for item in items]))
        brightness = float(np.mean([item["spectralCentroidHz"] for item in items]))
        target_onset = 0.22 if scenario["goal"] == "sleep" else 0.35 if scenario["goal"] == "calm" else 0.55
        score = float(np.mean(pair_scores)) + 0.16 * loop - 0.10 * abs(onset - target_onset)
        if scenario["goal"] == "sleep":
            score -= max(0.0, brightness - 1900.0) / 10000.0
        ranked.append((score, pair_scores, items))
    ranked.sort(key=lambda item: item[0], reverse=True)
    score, pair_scores, selected = ranked[0]
    return {
        "score": round(score, 4),
        "pairwiseChromaSimilarity": [round(value, 4) for value in pair_scores],
        "selected": list(selected),
    }


def build_loop_unit(analysis):
    source = ROOT / "public" / analysis["audioUrl"].lstrip("/")
    destination = UNIT_DIR / f"{analysis['candidateId']}.wav"
    audio, rate = sf.read(source, dtype="float32", always_2d=True)
    fade = min(int(rate * 2.0), max(1, len(audio) // 5))
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
    crossfade = audio[-fade:] * (1.0 - ramp) + audio[:fade] * ramp
    unit = np.concatenate([audio[fade:-fade], crossfade], axis=0)
    peak = float(np.max(np.abs(unit)))
    if peak > 0:
        unit *= min(1.0, 0.68 / peak)
    sf.write(destination, unit, rate, subtype="PCM_16")
    return destination


def render_mix(scenario, selection):
    units = [build_loop_unit(item) for item in selection["selected"]]
    output = MIX_DIR / f"{scenario['id']}.mp3"
    command = ["ffmpeg", "-hide_banner", "-y"]
    for unit in units:
        command.extend(["-stream_loop", "-1", "-i", str(unit)])
    filters = []
    labels = []
    for index, gain in enumerate(scenario["gains"]):
        label = f"a{index}"
        filters.append(f"[{index}:a]volume={gain}[{label}]")
        labels.append(f"[{label}]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:duration=longest:normalize=0,afade=t=in:st=0:d=4,afade=t=out:st={TARGET_SECONDS - 8}:d=8,loudnorm=I=-20:TP=-2:LRA=7[out]")
    command.extend(["-filter_complex", ";".join(filters), "-map", "[out]", "-t", str(TARGET_SECONDS), "-c:a", "libmp3lame", "-b:a", "192k", str(output)])
    run(command)
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,sample_rate,channels", "-of", "json", str(output)]))
    stream = probe.get("streams", [{}])[0]
    return {
        "audioUrl": "/" + str(output.relative_to(ROOT / "public")),
        "durationSeconds": round(float(probe["format"]["duration"]), 3),
        "bytes": int(probe["format"]["size"]),
        "codec": stream.get("codec_name"),
        "sampleRate": int(stream.get("sample_rate", 0)),
        "channels": int(stream.get("channels", 0)),
    }


def escape(value):
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def build_review(manifest):
    sections = []
    for result in manifest["scenarios"]:
        ingredient_html = "".join(
            f'<section><strong>{escape(item["family"])}</strong><span>{escape(item["candidateId"])} · {escape(item["key"]["root"])} {escape(item["key"]["mode"])} · onset {item["onsetDensityPerSecond"]}/s</span><audio controls preload="metadata" src="{escape(item["audioUrl"])}"></audio></section>'
            for item in result["selection"]["selected"]
        )
        sections.append(f'''<article><p class="goal">{escape(result["goal"])}</p><h2>{escape(result["title"])}</h2><p class="description">{escape(result["description"])}</p><p class="meta">10分钟组合 · compatibility {result["selection"]["score"]} · productionAllowed=false</p><audio class="mix" controls preload="metadata" src="{escape(result["render"]["audioUrl"])}"></audio><details><summary>查看并单独试听组成元素</summary><div class="ingredients">{ingredient_html}</div></details><div class="review"><label>调性是否自然<select data-key="{result["id"]}:harmony"><option value="">未判断</option><option value="pass">自然</option><option value="partial">轻微冲突</option><option value="fail">明显冲突</option></select></label><label>是否听到固定短循环<select data-key="{result["id"]}:repetition"><option value="">未判断</option><option value="none">不明显</option><option value="tolerable">能听出但可接受</option><option value="fatiguing">明显且疲劳</option></select></label><label>场景是否成立<select data-key="{result["id"]}:fit"><option value="">未判断</option><option value="pass">符合</option><option value="partial">部分符合</option><option value="fail">不符合</option></select></label><label>元素组合结论<select data-key="{result["id"]}:decision"><option value="">待审核</option><option value="pass">允许进入元素精修</option><option value="retry">重新选择组合</option><option value="fail">此路线失败</option></select></label></div><label class="notes">听感记录<textarea data-key="{result["id"]}:notes" rows="4"></textarea></label></article>''')
    html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lyria 元素组合验证</title><style>:root{{color-scheme:dark;--bg:#101311;--panel:#191e1a;--line:#3b473d;--text:#f1f4f0;--muted:#aab5ac;--accent:#dfc47c;--warn:#e0a19b}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}}main{{max-width:980px;margin:auto;padding:28px 18px 80px}}header,article{{padding:24px 0;border-bottom:1px solid var(--line)}}h1{{font-size:29px;margin:7px 0}}h2{{font-size:22px;margin:5px 0}}p{{line-height:1.55}}.eyebrow,.goal{{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}}.intro,.description,.meta,summary,.ingredients span{{color:var(--muted)}}.warning{{color:var(--warn)}}audio{{width:100%;height:42px}}.mix{{margin:8px 0 14px}}details{{margin-top:12px}}summary{{cursor:pointer}}.ingredients{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}}.ingredients section{{display:grid;gap:5px;padding:10px;background:var(--panel);border:1px solid var(--line);border-radius:5px}}.ingredients span{{font-size:11px}}.review{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}}label{{display:grid;gap:5px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--text);padding:9px;font:inherit}}.notes{{margin-top:10px}}button{{margin-top:18px;border:0;border-radius:6px;background:var(--accent);color:#171811;padding:11px 15px;font-weight:700;cursor:pointer}}@media(max-width:650px){{main{{padding:18px 12px 60px}}.ingredients,.review{{grid-template-columns:1fr}}}}</style></head><body><main><header><p class="eyebrow">FOUNDATIONAL ELEMENT COMBINATION GATE</p><h1>元素是否真的能够组成不同内容</h1><p class="intro">三套10分钟组合分别验证 Sleep、Meditation 和 Focus。这里不是发布成品，而是检查调性兼容、短循环疲劳和场景差异。</p><p class="warning">机器只负责选择相对兼容的候选和安全处理。是否自然、是否重复、是否符合场景必须以试听为准，当前没有元素进入正式库存。</p><button id="export">导出审核结果</button></header>{''.join(sections)}</main><script>const key='snooze-{BATCH_ID}-review';const state=JSON.parse(localStorage.getItem(key)||'{{}}');document.querySelectorAll('[data-key]').forEach(input=>{{input.value=state[input.dataset.key]||'';const save=()=>{{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))}};input.addEventListener('change',save);input.addEventListener('input',save)}});document.getElementById('export').addEventListener('click',()=>{{const payload={{schemaVersion:'1.0.0',batchId:'{BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}}));const a=document.createElement('a');a.href=url;a.download='{BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}});</script></body></html>'''
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    source_manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    if len(source_manifest.get("candidates", [])) != 24:
        raise RuntimeError("source pilot must contain 24 candidates")
    UNIT_DIR.mkdir(parents=True, exist_ok=True)
    MIX_DIR.mkdir(parents=True, exist_ok=True)

    analyses = [analyze(record) for record in source_manifest["candidates"]]
    ANALYSIS_PATH.write_text(json.dumps({"schemaVersion": "1.0.0", "generatedOn": datetime.now(timezone.utc).isoformat(), "candidates": analyses}, indent=2) + "\n", encoding="utf-8")

    scenario_results = []
    for scenario in SCENARIOS:
        selection = choose_combination(scenario, analyses)
        render = render_mix(scenario, selection)
        scenario_results.append({**scenario, "selection": selection, "render": render, "productionAllowed": False})

    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedOn": datetime.now(timezone.utc).isoformat(),
        "sourceBatchId": source_manifest["batchId"],
        "analysisMethod": "librosa_chroma_onset_tempo_spectral_plus_human_listening_gate",
        "targetDurationSeconds": TARGET_SECONDS,
        "productionAllowed": False,
        "status": "candidate_pending_human_combination_review",
        "scenarios": scenario_results,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)
    shutil.rmtree(UNIT_DIR, ignore_errors=True)
    print(json.dumps({"passed": True, "batchId": BATCH_ID, "analyzedCandidates": len(analyses), "mixes": len(scenario_results), "durationSecondsEach": TARGET_SECONDS, "productionAllowed": False, "reviewUrl": f"/review/{BATCH_ID}/index.html"}, indent=2))


if __name__ == "__main__":
    main()
