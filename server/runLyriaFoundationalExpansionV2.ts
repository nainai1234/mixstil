import 'dotenv/config';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { generateLyriaMusic } from './lyriaProvider';

type ExpansionFamily = {
  id: string;
  title: string;
  category: 'environment' | 'texture' | 'instrument' | 'accent';
  role: string;
  goals: Array<'sleep' | 'calm' | 'focus'>;
  loopMode: 'crossfade' | 'one_shot';
  prompt: string;
};

type Candidate = ExpansionFamily & {
  candidateId: string;
  variant: number;
  provider: 'google-cloud-vertex-ai';
  model: string;
  projectId: string;
  audioUrl: string;
  mimeType: string;
  generatedOn: string;
  bytes: number;
  metrics: {
    durationSeconds: number;
    codec: string;
    sampleRate: number;
    channels: number;
    meanVolumeDb: number | null;
    maxVolumeDb: number | null;
    silenceEvents: number;
  };
  machineFlags: string[];
  productionAllowed: false;
};

const ROOT = process.cwd();
const BATCH_ID = process.env.LYRIA_FOUNDATIONAL_BATCH_ID ?? 'lyria-foundational-expansion-v2';
const PUBLIC_ROOT = path.join(ROOT, 'public');
const OUTPUT_ROOT = path.join(PUBLIC_ROOT, 'audio/music/local-review', BATCH_ID);
const AUDIO_ROOT = path.join(OUTPUT_ROOT, 'audio');
const MANIFEST_PATH = path.join(OUTPUT_ROOT, 'manifest.json');
const REVIEW_ROOT = path.join(PUBLIC_ROOT, 'review', BATCH_ID);
const CONFIG_PATH = path.join(ROOT, process.env.LYRIA_FOUNDATIONAL_CONFIG_PATH ?? 'config/foundational-element-expansion-v2.json');
const MODEL = process.env.GOOGLE_LYRIA_MODEL ?? 'lyria-3-clip-preview';

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as {
  targetFamilyCount?: number;
  variantsPerFamily: number;
  targetNewCandidateCount: number;
  targetCandidateCount?: number;
  soothingProfile?: { globalPromptSuffix?: string };
  families: ExpansionFamily[];
};

const expectedFamilyCount = config.targetFamilyCount ?? config.families.length;
const expectedCandidateCount = config.targetCandidateCount ?? config.targetNewCandidateCount;
if (config.families.length !== expectedFamilyCount || config.variantsPerFamily !== 3 || expectedCandidateCount !== config.families.length * config.variantsPerFamily) {
  throw new Error(`Expansion manifest must contain ${expectedFamilyCount} families and ${expectedCandidateCount} candidates.`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const publicUrl = (filePath: string) => `/${path.relative(PUBLIC_ROOT, filePath).split(path.sep).join('/')}`;
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const probe = (filePath: string) => {
  const data = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,sample_rate,channels', '-of', 'json', filePath], { encoding: 'utf8' }));
  const stream = data.streams?.[0] ?? {};
  const analyze = (filter: string) => {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-i', filePath, '-af', filter, '-f', 'null', '-'], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || `ffmpeg ${filter} failed`);
    return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  };
  const volume = analyze('volumedetect');
  const silence = analyze('silencedetect=noise=-50dB:d=0.5');
  const mean = volume.match(/mean_volume:\s*(-?[\d.]+) dB/);
  const max = volume.match(/max_volume:\s*(-?[\d.]+) dB/);
  return {
    durationSeconds: Number(Number(data.format?.duration ?? 0).toFixed(3)),
    codec: String(stream.codec_name ?? ''),
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
    meanVolumeDb: mean ? Number(mean[1]) : null,
    maxVolumeDb: max ? Number(max[1]) : null,
    silenceEvents: (silence.match(/silence_start:/g) ?? []).length,
  };
};

const machineFlags = (family: ExpansionFamily, metrics: Candidate['metrics']) => [
  ...(metrics.durationSeconds < 20 ? ['shorter_than_20_seconds'] : []),
  ...(metrics.maxVolumeDb !== null && metrics.maxVolumeDb > -0.5 ? ['near_digital_ceiling'] : []),
  ...(family.loopMode === 'crossfade' && metrics.silenceEvents > 0 ? ['contains_detected_silence'] : []),
  ...(family.loopMode === 'one_shot' && metrics.silenceEvents === 0 ? ['one_shot_tail_not_silent'] : []),
  'human_identity_requires_listening',
  'voice_gate_requires_listening',
];

const effectivePrompt = (family: ExpansionFamily) => `${family.prompt}${config.soothingProfile?.globalPromptSuffix ? ` ${config.soothingProfile.globalPromptSuffix}` : ''}`;

const generateWithRetry = async (prompt: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await generateLyriaMusic({ prompt, model: MODEL });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 4_000);
    }
  }
  throw lastError;
};

const loadRecords = async (): Promise<Candidate[]> => {
  if (!existsSync(MANIFEST_PATH)) return [];
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as { candidates?: Candidate[] };
  return Array.isArray(manifest.candidates) ? manifest.candidates : [];
};

const writeManifest = async (candidates: Candidate[]) => {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify({
    schemaVersion: '2.0.0',
    batchId: BATCH_ID,
    generatedOn: new Date().toISOString(),
    provider: 'google-cloud-vertex-ai',
    model: MODEL,
    source: 'Google Vertex AI Lyria direct single-element prompts',
    status: candidates.length === expectedCandidateCount ? 'candidate_pending_human_review' : 'generation_in_progress',
    productionAllowed: false,
    expectedFamilyCount,
    expectedVariantsPerFamily: config.variantsPerFamily,
    expectedCandidateCount,
    completedCandidateCount: candidates.length,
    candidates,
  }, null, 2)}\n`, 'utf8');
};

const buildReviewPage = async (candidates: Candidate[]) => {
  const sections = config.families.map((family) => {
    const items = candidates.filter((candidate) => candidate.id === family.id).sort((a, b) => a.variant - b.variant);
    return `<section><p class="eyebrow">${escapeHtml(family.category)} · ${escapeHtml(family.role)} · ${escapeHtml(family.loopMode)}</p><h2>${escapeHtml(family.title)}</h2><p class="prompt">${escapeHtml(effectivePrompt(family))}</p><div class="candidates">${items.map((item) => `<article><strong>候选 ${item.variant}</strong><span>${item.metrics.durationSeconds}s · ${item.metrics.sampleRate}Hz · mean ${item.metrics.meanVolumeDb ?? '-'}dB · flags ${item.machineFlags.length}</span><audio controls preload="metadata" src="${escapeHtml(item.audioUrl)}"></audio><label>身份<select data-key="${item.candidateId}:identity"><option value="">未判断</option><option value="yes">身份清楚</option><option value="mixed">部分混合</option><option value="no">身份错误</option></select></label><label>人声/类人声<select data-key="${item.candidateId}:voice"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label><label>循环或单次行为<select data-key="${item.candidateId}:loop"><option value="">未判断</option><option value="pass">符合</option><option value="edit">需要编辑</option><option value="fail">不合格</option></select></label><label>最终结论<select data-key="${item.candidateId}:decision"><option value="">待审核</option><option value="pass">通过候选</option><option value="retry">重试提示词</option><option value="fail">淘汰</option></select></label><label>听感记录<textarea data-key="${item.candidateId}:notes" rows="3"></textarea></label></article>`).join('')}</div></section>`;
  }).join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(BATCH_ID)}</title><style>:root{color-scheme:dark;--bg:#101311;--panel:#1a1f1b;--line:#3b473d;--text:#f1f4f0;--muted:#aab5ac;--accent:#dfc77c;--warn:#e0a19b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}main{max-width:1220px;margin:auto;padding:28px 18px 80px}header,section{padding:24px 0;border-bottom:1px solid var(--line)}h1{font-size:30px;margin:7px 0}h2{font-size:21px;margin:5px 0}.eyebrow{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}.intro,.prompt,article span{color:var(--muted);line-height:1.55}.warning{color:var(--warn)}.candidates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}article{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:13px;display:grid;gap:8px}article span{font-size:11px}audio{width:100%;height:40px}label{display:grid;gap:4px;color:var(--muted);font-size:12px}select,textarea{width:100%;border:1px solid var(--line);border-radius:4px;background:#141815;color:var(--text);padding:8px;font:inherit}button{margin-top:14px;border:0;border-radius:5px;background:var(--accent);color:#171811;padding:10px 14px;font-weight:700;cursor:pointer}@media(max-width:900px){.candidates{grid-template-columns:1fr}}@media(max-width:560px){main{padding:18px 12px 60px}h1{font-size:25px}}</style></head><body><main><header><p class="eyebrow">REAL GOOGLE VERTEX AI LYRIA · ${expectedCandidateCount} CANDIDATES</p><h1>${escapeHtml(BATCH_ID)}</h1><p class="intro">${expectedFamilyCount} 个家族，每个家族 ${config.variantsPerFamily} 个真实候选。目标是扩展可组合的元素，不是生成成品音乐。</p><p class="warning">所有候选保持 productionAllowed=false。机器只检查文件和基础声学指标；元素身份、人声风险、循环疲劳和最终可用性必须试听确认。</p><button id="export">导出审核结果</button></header>${sections}</main><script>const key='snooze-${BATCH_ID}-review';const state=JSON.parse(localStorage.getItem(key)||'{}');document.querySelectorAll('[data-key]').forEach(input=>{input.value=state[input.dataset.key]||'';const save=()=>{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))};input.addEventListener('change',save);input.addEventListener('input',save)});document.getElementById('export').addEventListener('click',()=>{const payload={schemaVersion:'2.0.0',batchId:'${BATCH_ID}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='${BATCH_ID}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)});</script></body></html>`;
  await mkdir(REVIEW_ROOT, { recursive: true });
  await writeFile(path.join(REVIEW_ROOT, 'index.html'), html, 'utf8');
};

const main = async () => {
  await mkdir(AUDIO_ROOT, { recursive: true });
  let candidates = await loadRecords();
  for (const family of config.families) {
    for (let variant = 1; variant <= config.variantsPerFamily; variant += 1) {
      const candidateId = `${family.id}_v${variant}`;
      const audioPath = path.join(AUDIO_ROOT, `${candidateId}.mp3`);
      const existingIndex = candidates.findIndex((candidate) => candidate.candidateId === candidateId);
      if (!existsSync(audioPath)) {
        console.log(`[${candidates.length + 1}/${expectedCandidateCount}] generating ${candidateId}`);
        const generated = await generateWithRetry(effectivePrompt(family));
        try { await copyFile(generated.outputPath, audioPath); } finally { await rm(generated.temporaryDirectory, { recursive: true, force: true }); }
      } else {
        console.log(`[resume] probing ${candidateId}`);
      }
      const metrics = probe(audioPath);
      const generatedOn = existingIndex >= 0 ? candidates[existingIndex].generatedOn : new Date().toISOString();
      const generated = existingIndex >= 0 ? candidates[existingIndex] : null;
      const candidate: Candidate = {
        ...family,
        prompt: effectivePrompt(family),
        candidateId,
        variant,
        provider: 'google-cloud-vertex-ai',
        model: generated?.model ?? MODEL,
        projectId: generated?.projectId ?? process.env.GOOGLE_LYRIA_PROJECT_ID ?? 'project-a8dea3a9-cd9d-40dd-867',
        audioUrl: publicUrl(audioPath),
        mimeType: generated?.mimeType ?? 'audio/mpeg',
        generatedOn,
        bytes: metrics ? Number(execFileSync('stat', ['-f', '%z', audioPath], { encoding: 'utf8' }).trim()) : 0,
        metrics,
        machineFlags: machineFlags(family, metrics as Candidate['metrics']),
        productionAllowed: false,
      };
      if (existingIndex >= 0) candidates[existingIndex] = candidate; else candidates.push(candidate);
      candidates = candidates.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
      await writeManifest(candidates);
    }
  }
  await writeManifest(candidates);
  await buildReviewPage(candidates);
  console.log(JSON.stringify({ passed: true, batchId: BATCH_ID, families: config.families.length, candidates: candidates.length, productionAllowed: false, reviewUrl: `/review/${BATCH_ID}/index.html` }, null, 2));
};

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
