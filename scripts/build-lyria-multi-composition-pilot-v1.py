#!/usr/bin/env python3
import importlib.util
import itertools
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np

ROOT = Path.cwd()
SOURCE_SCRIPT = ROOT / "scripts/analyze-build-lyria-combination-pilot-v1.py"
SOURCE_ANALYSIS = ROOT / "public/audio/music/local-review/lyria-element-combination-pilot-v1/analysis.json"
BATCH_ID = "lyria-multi-composition-pilot-v1"
OUTPUT_ROOT = ROOT / "public/audio/music/local-review" / BATCH_ID
UNIT_DIR = OUTPUT_ROOT / "prepared-units"
MIX_DIR = OUTPUT_ROOT / "mixes"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"
TARGET_SECONDS = 300

spec = importlib.util.spec_from_file_location("lyria_combination_base", SOURCE_SCRIPT)
base = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(base)
base.UNIT_DIR = UNIT_DIR

STRUCTURES = [
    {"id": "ground_first", "title": "Ground First", "offsets": [0, 7, 19], "gainScale": [1.00, 0.70, 0.30]},
    {"id": "music_first", "title": "Music First", "offsets": [13, 0, 23], "gainScale": [0.55, 1.00, 0.25]},
    {"id": "wide_breath", "title": "Wide Breath", "offsets": [21, 11, 0], "gainScale": [0.65, 0.45, 1.00]},
    {"id": "quiet_detail", "title": "Quiet Detail", "offsets": [5, 17, 29], "gainScale": [0.82, 0.72, 0.50]},
]


def run(command):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or f"command failed: {command}")
    return result.stdout


def score_combo(scenario, items):
    pairs = [base.chroma_similarity(a, b) for a, b in itertools.combinations(items, 2)]
    onset = float(np.mean([item["onsetDensityPerSecond"] for item in items]))
    loop = float(np.mean([item["loopTonalSimilarity"] for item in items]))
    target_onset = 0.22 if scenario["goal"] == "sleep" else 0.35 if scenario["goal"] == "calm" else 0.55
    score = float(np.mean(pairs)) + 0.16 * loop - 0.10 * abs(onset - target_onset)
    return score, pairs


def choose_four(scenario, analyses):
    pools = [[item for item in analyses if item["family"] == family] for family in scenario["families"]]
    ranked = []
    for items in itertools.product(*pools):
        score, pairs = score_combo(scenario, items)
        ranked.append({"score": score, "pairs": pairs, "selected": list(items)})
    ranked.sort(key=lambda item: item["score"], reverse=True)
    selected = []
    usage = {}
    while len(selected) < 4:
        best = None
        best_adjusted = -1e9
        for item in ranked:
            ids = [entry["candidateId"] for entry in item["selected"]]
            if any(set(ids) == set(entry["candidateId"] for entry in chosen["selected"]) for chosen in selected):
                continue
            overlap = max((len(set(ids) & set(entry["candidateId"] for entry in chosen["selected"])) for chosen in selected), default=0)
            if overlap > 1:
                continue
            reuse_penalty = sum(usage.get(candidate_id, 0) for candidate_id in ids) * 0.055
            adjusted = item["score"] - reuse_penalty - overlap * 0.035
            if adjusted > best_adjusted:
                best, best_adjusted = item, adjusted
        if best is None:
            raise RuntimeError(f"could not select four distinct combinations for {scenario['id']}")
        selected.append(best)
        for entry in best["selected"]:
            usage[entry["candidateId"]] = usage.get(entry["candidateId"], 0) + 1
    return selected


def render(composition, scenario, structure):
    units = [base.build_loop_unit(item) for item in composition["selected"]]
    output = MIX_DIR / f"{composition['id']}.mp3"
    command = ["ffmpeg", "-hide_banner", "-y"]
    for offset, unit in zip(structure["offsets"], units):
        command.extend(["-stream_loop", "-1", "-ss", str(offset), "-i", str(unit)])
    filters = []
    labels = []
    phase = [0.0, 1.7, 3.2]
    for index, (gain, scale) in enumerate(zip(scenario["gains"], structure["gainScale"])):
        label = f"a{index}"
        period = 173 + index * 37
        filters.append(f"[{index}:a]volume='{gain * scale}*(0.88+0.12*sin(2*PI*t/{period}+{phase[index]}))':eval=frame[{label}]")
        labels.append(f"[{label}]")
    filters.append(f"{''.join(labels)}amix=inputs=3:duration=longest:normalize=0,afade=t=in:st=0:d=4,afade=t=out:st={TARGET_SECONDS - 8}:d=8,loudnorm=I=-20:TP=-2:LRA=7[out]")
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


def fingerprint(audio_url):
    audio, rate = librosa.load(ROOT / "public" / audio_url.lstrip("/"), sr=11025, mono=True)
    hop = 2048
    mfcc = librosa.feature.mfcc(y=audio, sr=rate, n_mfcc=13, hop_length=hop)
    chroma = librosa.feature.chroma_stft(y=audio, sr=rate, hop_length=hop)
    centroid = librosa.feature.spectral_centroid(y=audio, sr=rate, hop_length=hop)[0]
    onset = librosa.onset.onset_strength(y=audio, sr=rate, hop_length=hop)
    vector = np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1), chroma.mean(axis=1), chroma.std(axis=1), [centroid.mean() / 4000.0, centroid.std() / 4000.0, onset.mean(), onset.std()]])
    norm = float(np.linalg.norm(vector))
    return (vector / (norm + 1e-12)).tolist()


def diversity_report(compositions):
    pairs = []
    for left, right in itertools.combinations(compositions, 2):
        a = np.array(left["fingerprint"])
        b = np.array(right["fingerprint"])
        similarity = float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-12))
        pairs.append({"left": left["id"], "right": right["id"], "similarity": round(similarity, 6), "nearDuplicate": similarity >= 0.995})
    return {
        "method": "normalized_mfcc_chroma_spectral_onset_summary_cosine",
        "threshold": 0.995,
        "maxSimilarity": max(item["similarity"] for item in pairs),
        "nearDuplicatePairs": [item for item in pairs if item["nearDuplicate"]],
        "pairs": pairs,
    }


def escape(value):
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def build_review(manifest):
    groups = []
    for scenario in manifest["scenarios"]:
        cards = []
        for composition in scenario["compositions"]:
            ingredients = " · ".join(item["candidateId"] for item in composition["selected"])
            cards.append(f'''<article><p class="variant">{escape(composition["variantLabel"])} · {escape(composition["structure"]["title"])}</p><h3>{escape(composition["title"])}</h3><p class="meta">{escape(ingredients)}<br>compatibility {composition["compatibilityScore"]}</p><audio controls preload="metadata" src="{escape(composition["render"]["audioUrl"])}"></audio><div class="review"><label>是否与本组其他曲目明显不同<select data-key="{composition["id"]}:distinct"><option value="">未判断</option><option value="yes">明显不同</option><option value="partial">部分不同</option><option value="no">仍像同一首</option></select></label><label>固定旋律/循环疲劳<select data-key="{composition["id"]}:fatigue"><option value="">未判断</option><option value="none">不明显</option><option value="tolerable">可听出但可接受</option><option value="fail">明显且疲劳</option></select></label><label>场景适配<select data-key="{composition["id"]}:fit"><option value="">未判断</option><option value="pass">符合</option><option value="partial">部分符合</option><option value="fail">不符合</option></select></label><label>候选结论<select data-key="{composition["id"]}:decision"><option value="">待审核</option><option value="keep">保留结构</option><option value="adjust">需要调整</option><option value="reject">淘汰</option></select></label></div><label class="notes">记录<textarea data-key="{composition["id"]}:notes" rows="3"></textarea></label></article>''')
        groups.append(f'''<section><header class="group-head"><p class="goal">{escape(scenario["goal"])}</p><h2>{escape(scenario["title"])}</h2><p>同一目标下四首使用不同候选组合和不同层级结构。请横向比较，而不是只判断单首是否好听。</p></header><div class="grid">{''.join(cards)}</div></section>''')
    diversity = manifest["diversity"]
    html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lyria 多曲能力验证</title><style>:root{{color-scheme:dark;--bg:#101311;--panel:#191e1a;--line:#3b473d;--text:#f1f4f0;--muted:#aab5ac;--accent:#dfc47c;--warn:#e2a19a}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}}main{{max-width:1180px;margin:auto;padding:28px 18px 80px}}.intro,.group-head{{padding:22px 0;border-bottom:1px solid var(--line)}}h1{{font-size:30px;margin:7px 0}}h2{{font-size:24px;margin:5px 0}}h3{{font-size:18px;margin:5px 0}}p{{line-height:1.5}}.eyebrow,.goal,.variant{{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}}.summary,.group-head p,.meta{{color:var(--muted)}}.warning{{color:var(--warn)}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 0 28px}}article{{padding:15px;background:var(--panel);border:1px solid var(--line);border-radius:6px}}audio{{width:100%;height:42px}}.meta{{font-size:11px;min-height:34px}}.review{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}}label{{display:grid;gap:4px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid var(--line);border-radius:4px;background:#141815;color:var(--text);padding:8px;font:inherit}}.notes{{margin-top:8px}}button{{margin-top:16px;border:0;border-radius:6px;background:var(--accent);color:#171811;padding:11px 15px;font-weight:700;cursor:pointer}}@media(max-width:700px){{main{{padding:18px 12px 60px}}.grid,.review{{grid-template-columns:1fr}}}}</style></head><body><main><header class="intro"><p class="eyebrow">12 COMPOSITIONS · NO NEW API CALLS</p><h1>同一批元素能否生成不同曲目</h1><p class="summary">Sleep、Meditation、Focus 各4首，每首5分钟。机器指纹最大相似度 {diversity["maxSimilarity"]}，近重复对 {len(diversity["nearDuplicatePairs"])}。</p><p class="warning">指纹不同不等于听感不同。只有你能明确听出同组A/B/C/D不是同一首曲子，元素组合路线才通过。</p><button id="export">导出审核结果</button></header>{''.join(groups)}</main><script>const key='snooze-{BATCH_ID}-review';const state=JSON.parse(localStorage.getItem(key)||'{{}}');document.querySelectorAll('[data-key]').forEach(input=>{{input.value=state[input.dataset.key]||'';const save=()=>{{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))}};input.addEventListener('change',save);input.addEventListener('input',save)}});document.getElementById('export').addEventListener('click',()=>{{const payload={{schemaVersion:'1.0.0',batchId:'{BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}}));const a=document.createElement('a');a.href=url;a.download='{BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}});</script></body></html>'''
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "index.html").write_text(html, encoding="utf-8")


def main():
    analyses = json.loads(SOURCE_ANALYSIS.read_text(encoding="utf-8"))["candidates"]
    UNIT_DIR.mkdir(parents=True, exist_ok=True)
    MIX_DIR.mkdir(parents=True, exist_ok=True)
    scenario_results = []
    all_compositions = []
    labels = ["A", "B", "C", "D"]
    for scenario in base.SCENARIOS:
        combinations = choose_four(scenario, analyses)
        compositions = []
        for index, (combination, structure) in enumerate(zip(combinations, STRUCTURES)):
            composition = {
                "id": f"{scenario['id']}_{labels[index].lower()}",
                "title": f"{scenario['title']} {labels[index]}",
                "variantLabel": labels[index],
                "goal": scenario["goal"],
                "structure": structure,
                "compatibilityScore": round(combination["score"], 4),
                "pairwiseChromaSimilarity": [round(value, 4) for value in combination["pairs"]],
                "selected": combination["selected"],
                "productionAllowed": False,
            }
            composition["render"] = render(composition, scenario, structure)
            composition["fingerprint"] = fingerprint(composition["render"]["audioUrl"])
            compositions.append(composition)
            all_compositions.append(composition)
        scenario_results.append({"id": scenario["id"], "title": scenario["title"], "goal": scenario["goal"], "compositions": compositions})

    diversity = diversity_report(all_compositions)
    manifest = {
        "schemaVersion": "1.0.0",
        "batchId": BATCH_ID,
        "generatedOn": datetime.now(timezone.utc).isoformat(),
        "sourceBatchId": "lyria-single-element-pilot-v1",
        "sourceAnalysisBatchId": "lyria-element-combination-pilot-v1",
        "targetDurationSeconds": TARGET_SECONDS,
        "compositionCount": len(all_compositions),
        "productionAllowed": False,
        "status": "candidate_pending_human_multi_composition_review",
        "diversity": diversity,
        "scenarios": scenario_results,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    build_review(manifest)
    shutil.rmtree(UNIT_DIR, ignore_errors=True)
    print(json.dumps({"passed": True, "batchId": BATCH_ID, "compositions": len(all_compositions), "durationSecondsEach": TARGET_SECONDS, "maxFingerprintSimilarity": diversity["maxSimilarity"], "nearDuplicatePairs": len(diversity["nearDuplicatePairs"]), "productionAllowed": False, "reviewUrl": f"/review/{BATCH_ID}/index.html"}, indent=2))


if __name__ == "__main__":
    main()
