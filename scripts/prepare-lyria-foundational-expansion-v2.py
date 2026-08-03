#!/usr/bin/env python3
import html
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import find_peaks

ROOT = Path.cwd()
BATCH_ID = os.environ.get("LYRIA_FOUNDATIONAL_BATCH_ID", "lyria-foundational-expansion-v2")
OUTPUT_ROOT = ROOT / "public/audio/music/local-review" / BATCH_ID
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"
PREPARED_DIR = OUTPUT_ROOT / "prepared"
REVIEW_DIR = ROOT / "public/review" / BATCH_ID


def public_url(path):
    return "/" + str(path.relative_to(ROOT / "public"))


def encode_mp3(audio, rate, destination):
    temporary = destination.with_suffix(".wav")
    sf.write(temporary, audio, rate, subtype="PCM_16")
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(temporary),
        "-c:a", "libmp3lame", "-b:a", "192k", str(destination),
    ], check=True)
    temporary.unlink(missing_ok=True)


def normalize(audio, target_peak=0.54):
    peak = float(np.max(np.abs(audio)))
    return audio if peak <= 1e-9 else audio * min(1.0, target_peak / peak)


def prepare_loop(audio, rate):
    fade = min(int(rate * 2.0), max(1, len(audio) // 5))
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)[:, None]
    crossfade = audio[-fade:] * (1.0 - ramp) + audio[:fade] * ramp
    unit = np.concatenate([audio[fade:-fade], crossfade], axis=0)
    return normalize(unit), {"method": "two_second_equal_gain_crossfade", "crossfadeSeconds": round(fade / rate, 3)}


def prepare_one_shot(audio, rate):
    mono = np.mean(audio, axis=1)
    hop = 256
    envelope = librosa.onset.onset_strength(y=mono, sr=rate, hop_length=hop)
    prominence = max(0.15, float(np.std(envelope) * 0.8))
    peaks, _ = find_peaks(envelope, distance=max(1, int(0.65 * rate / hop)), prominence=prominence)
    if len(peaks) == 0:
        onset_sample = int(np.argmax(np.abs(mono)))
        next_sample = min(len(audio), onset_sample + int(rate * 5.0))
    else:
        onset_sample = int(peaks[0] * hop)
        next_sample = int(peaks[1] * hop) if len(peaks) > 1 else min(len(audio), onset_sample + int(rate * 7.0))
    start = max(0, onset_sample - int(rate * 0.08))
    end = min(len(audio), max(start + int(rate * 1.2), next_sample - int(rate * 0.08), start + int(rate * 3.0)))
    end = min(end, start + int(rate * 7.0))
    unit = audio[start:end].copy()
    fade_in = min(int(rate * 0.02), len(unit) // 4)
    fade_out = min(int(rate * 0.45), len(unit) // 3)
    if fade_in > 0:
        unit[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    if fade_out > 0:
        unit[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]
    return normalize(unit), {
        "method": "first_prominent_onset_isolation",
        "sourceOnsetCandidates": int(len(peaks)),
        "sourceStartSeconds": round(start / rate, 3),
        "sourceEndSeconds": round(end / rate, 3),
    }


def analyze(path, loop_mode):
    audio, rate = librosa.load(path, sr=22050, mono=True)
    hop = 512
    duration = len(audio) / rate
    onset = librosa.onset.onset_strength(y=audio, sr=rate, hop_length=hop)
    frames = librosa.onset.onset_detect(onset_envelope=onset, sr=rate, hop_length=hop)
    centroid = librosa.feature.spectral_centroid(y=audio, sr=rate, hop_length=hop)[0]
    rms = librosa.feature.rms(y=audio, hop_length=hop)[0]
    peak = float(np.max(np.abs(audio)))
    flags = []
    if peak > 0.62:
        flags.append("prepared_peak_too_high")
    if loop_mode == "one_shot" and len(frames) > 5:
        flags.append("prepared_one_shot_has_multiple_onsets")
    return {
        "durationSeconds": round(duration, 3),
        "peakDbfs": round(float(20 * np.log10(peak + 1e-12)), 3),
        "onsetCount": int(len(frames)),
        "onsetDensityPerSecond": round(len(frames) / max(duration, 1), 4),
        "spectralCentroidHz": round(float(np.mean(centroid)), 2),
        "rmsVariation": round(float(np.std(rms) / (np.mean(rms) + 1e-12)), 4),
        "technicalFlags": flags,
        "technicalStatus": "pass" if not flags else "review",
        "humanIdentityStatus": "pending",
        "humanVoiceStatus": "pending",
    }


def build_review(manifest):
    groups = []
    for category in ("environment", "texture", "instrument", "accent"):
        cards = []
        for candidate in [item for item in manifest["candidates"] if item["category"] == category]:
            analysis = candidate["preparedAnalysis"]
            cards.append(f'''<article><p class="family">{html.escape(candidate["title"])}</p><h3>候选 {candidate["variant"]}</h3><p class="meta">{html.escape(candidate["candidateId"])} · {analysis["durationSeconds"]}s · peak {analysis["peakDbfs"]} dBFS · onset {analysis["onsetCount"]} · technical {analysis["technicalStatus"]}</p><audio controls preload="metadata" src="{html.escape(candidate["preparedAudioUrl"])}"></audio><details><summary>查看原始 Lyria 输出</summary><audio controls preload="metadata" src="{html.escape(candidate["audioUrl"])}"></audio></details><div class="fields"><label>元素身份<select data-key="{candidate["candidateId"]}:identity"><option value="">未判断</option><option value="yes">身份清楚</option><option value="mixed">混入其他内容</option><option value="no">身份错误</option></select></label><label>人声/类人声<select data-key="{candidate["candidateId"]}:voice"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label><label>长期循环/单次点缀<select data-key="{candidate["candidateId"]}:behavior"><option value="">未判断</option><option value="pass">符合</option><option value="edit">需再编辑</option><option value="fail">不合格</option></select></label><label>场景价值<select data-key="{candidate["candidateId"]}:value"><option value="">未判断</option><option value="useful">值得保留</option><option value="duplicate">与现有太像</option><option value="fatiguing">容易疲劳</option></select></label><label>结论<select data-key="{candidate["candidateId"]}:decision"><option value="">待审核</option><option value="pass">通过</option><option value="retry">重做</option><option value="fail">淘汰</option></select></label><label>记录<textarea data-key="{candidate["candidateId"]}:notes" rows="3"></textarea></label></div></article>''')
        groups.append(f'<section><p class="eyebrow">{category}</p><h2>{category.title()} · {len(cards)} candidates</h2><div class="grid">{"".join(cards)}</div></section>')
    page = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>基础元素扩容 V2</title><style>:root{{color-scheme:dark;--bg:#101311;--panel:#181d19;--line:#39453c;--text:#f2f4f1;--muted:#aab4ac;--accent:#dfc77c;--warn:#e5a19a}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}}main{{max-width:1240px;margin:auto;padding:28px 18px 80px}}header,section{{padding:24px 0;border-bottom:1px solid var(--line)}}h1{{font-size:30px;margin:7px 0}}h2{{font-size:22px}}h3{{font-size:17px;margin:2px 0}}.eyebrow,.family{{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}}.intro,.meta,summary{{color:var(--muted);line-height:1.5}}.warning{{color:var(--warn)}}.grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}}article{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:13px;min-width:0}}.meta{{font-size:11px}}audio{{width:100%;height:40px}}details{{margin:8px 0}}summary{{cursor:pointer;font-size:12px}}.fields{{display:grid;gap:8px;margin-top:10px}}label{{display:grid;gap:4px;color:var(--muted);font-size:12px}}select,textarea{{width:100%;border:1px solid var(--line);border-radius:4px;background:#121613;color:var(--text);padding:8px;font:inherit}}button{{border:0;border-radius:5px;background:var(--accent);color:#171811;padding:10px 14px;font-weight:700;cursor:pointer}}@media(max-width:900px){{.grid{{grid-template-columns:1fr}}}}@media(max-width:560px){{main{{padding:18px 12px 60px}}h1{{font-size:25px}}}}</style></head><body><main><header><p class="eyebrow">84-ELEMENT INTERNAL BASELINE CANDIDATE</p><h1>基础元素扩容 V2 · 处理后试听</h1><p class="intro">24 个既有正式音乐元素 + 60 个新增候选。默认播放器播放降峰值、循环边界或单次点缀处理后的版本；原始 Lyria 输出保留在折叠区域用于核对谱系。</p><p class="warning">60 个新增项目仍未批准。请判断身份、人声、长期行为与实际价值；机器通过不等于内容通过。</p><button id="export">导出审核结果</button></header>{"".join(groups)}</main><script>const key='snooze-{BATCH_ID}-review';const state=JSON.parse(localStorage.getItem(key)||'{{}}');document.querySelectorAll('[data-key]').forEach(input=>{{input.value=state[input.dataset.key]||'';const save=()=>{{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))}};input.addEventListener('change',save);input.addEventListener('input',save)}});document.getElementById('export').addEventListener('click',()=>{{const payload={{schemaVersion:'2.0.0',batchId:'{BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state}};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{{type:'application/json'}}));const a=document.createElement('a');a.href=url;a.download='{BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)}});</script></body></html>'''
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    (REVIEW_DIR / "index.html").write_text(page, encoding="utf-8")


manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
expected = int(manifest.get("expectedCandidateCount", 60))
if len(manifest.get("candidates", [])) != expected:
    raise RuntimeError("Expansion manifest is incomplete.")
PREPARED_DIR.mkdir(parents=True, exist_ok=True)
for candidate in manifest["candidates"]:
    source = ROOT / "public" / candidate["audioUrl"].lstrip("/")
    audio, rate = sf.read(source, dtype="float32", always_2d=True)
    if candidate["loopMode"] == "one_shot":
        prepared, method = prepare_one_shot(audio, rate)
    else:
        prepared, method = prepare_loop(audio, rate)
    destination = PREPARED_DIR / f'{candidate["candidateId"]}.mp3'
    encode_mp3(prepared, rate, destination)
    candidate["preparedAudioUrl"] = public_url(destination)
    candidate["preparation"] = method
    candidate["preparedAnalysis"] = analyze(destination, candidate["loopMode"])
manifest["preparationVersion"] = "foundational-expansion-preparation-v1"
manifest["preparationGeneratedOn"] = datetime.now(timezone.utc).isoformat()
manifest["status"] = "prepared_candidates_pending_human_review"
manifest["productionAllowed"] = False
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
build_review(manifest)
technical_pass = sum(1 for item in manifest["candidates"] if item["preparedAnalysis"]["technicalStatus"] == "pass")
print(json.dumps({"batchId": BATCH_ID, "prepared": expected, "technicalPass": technical_pass, "humanReviewPending": expected, "productionAllowed": False, "reviewUrl": f"/review/{BATCH_ID}/index.html"}, indent=2))
