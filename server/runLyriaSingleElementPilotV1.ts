import 'dotenv/config';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { generateLyriaMusic } from './lyriaProvider';

const root = process.cwd();
const batchId = 'lyria-single-element-pilot-v1';
const publicRoot = path.join(root, 'public');
const batchRoot = path.join(publicRoot, 'audio/music/local-review', batchId);
const audioDir = path.join(batchRoot, 'audio');
const manifestPath = path.join(batchRoot, 'manifest.json');
const reviewDir = path.join(publicRoot, 'review', batchId);
const sourceModel = 'lyria-3-clip-preview';

const elementTypes = [
  {
    id: 'warm_analog_pad',
    title: 'Warm Analog Pad',
    category: 'pad_drone',
    role: 'harmonic_bed',
    prompt: 'Instrumental ambient sound material, free-time, intensity 1/10. A single continuous warm analog synthesizer pad is the only foreground identity. Dark-warm timbre, soft low-mid register, extremely slow filter movement, sustained open fifth harmony, stable dynamics, no chord progression, and a neutral unresolved ending. Clean wide recording with soft attacks and restrained reverb. Keep the texture minimal and consistent for editing and crossfaded looping. No singing, spoken voice, choir, piano, guitar, strings, drums, percussion, rhythmic pulse, arpeggio, lead melody, chimes, climax, or sudden change.',
  },
  {
    id: 'deep_low_drone',
    title: 'Deep Low Drone',
    category: 'pad_drone',
    role: 'low_support',
    prompt: 'Instrumental dark ambient sound material, free-time, intensity 1/10. One deep sustained synthesizer drone is the only foreground identity. Low register, rounded sub-bass with audible low-mid body, extremely slow organic movement, one stable pitch center, no harmonic journey, no cadence, and an unresolved ending. Soft attacks, controlled bass, restrained stereo space, stable loudness, suitable for crossfaded looping. No singing, spoken voice, choir, piano, guitar, strings, drums, percussion, heartbeat, rhythmic pulse, melody, bright overtones, impact, climax, or sudden change.',
  },
  {
    id: 'airy_bright_pad',
    title: 'Airy Bright Pad',
    category: 'pad_drone',
    role: 'harmonic_bed',
    prompt: 'Instrumental ambient sound material, free-time, intensity 1/10. A single airy synthesizer pad is the only foreground identity. Light upper-mid texture without piercing highs, gentle major add-nine color, extremely slow breathing movement, stable harmony, no chord progression, no cadence, and a soft unresolved ending. Smooth attacks, clean open stereo image, restrained reverb, consistent dynamics, suitable for crossfaded looping. No singing, spoken voice, choir, piano, guitar, strings, drums, percussion, rhythmic pulse, arpeggio, lead melody, bells, sharp sparkle, climax, or sudden change.',
  },
  {
    id: 'felt_piano_phrase',
    title: 'Sparse Felt Piano Phrase',
    category: 'instrument_phrase',
    role: 'melodic_phrase',
    prompt: 'Instrumental minimalist ambient phrase at 48 BPM and intensity 1/10. Solo soft felt piano is the only instrument. A very sparse four-note motif in the middle-low register, gentle touch, long pauses, narrow pitch range, simple open harmony implied by single notes, small natural variation, no dramatic resolution, and a quiet unfinished ending. Intimate dry-to-moderate room sound with soft mechanical texture and no accompaniment. No singing, spoken voice, choir, synthesizer pad, strings, guitar, bass, drums, percussion, arpeggio, dense chords, catchy hook, climax, or sudden change.',
  },
  {
    id: 'warm_rhodes_phrase',
    title: 'Warm Rhodes Phrase',
    category: 'instrument_phrase',
    role: 'melodic_phrase',
    prompt: 'Instrumental minimalist ambient phrase at 60 BPM and intensity 2/10. Solo warm Rhodes electric piano is the only instrument. A restrained five-note motif in a narrow middle register, soft rounded attacks, long spaces, subtle repetition with small variations, harmonically neutral, no emotional cadence, and an unfinished ending. Clean close recording with restrained tremolo and limited reverb, no accompaniment. No singing, spoken voice, choir, acoustic piano, synthesizer pad, strings, guitar, bass, drums, percussion, arpeggio, dense chords, bright bell tone, catchy hook, climax, or sudden change.',
  },
  {
    id: 'nylon_guitar_phrase',
    title: 'Sparse Nylon Guitar Phrase',
    category: 'instrument_phrase',
    role: 'melodic_phrase',
    prompt: 'Instrumental minimalist ambient phrase at 54 BPM and intensity 2/10. Solo nylon-string acoustic guitar is the only instrument. A sparse four-note fingerpicked motif in the middle register, warm fingertip attack, long pauses, narrow pitch range, gentle repetition with small variations, no full strummed chords, no cadence, and a quiet unfinished ending. Intimate natural room recording with restrained delay and no accompaniment. No singing, spoken voice, choir, steel-string guitar, piano, synthesizer pad, strings, bass, drums, percussion, rhythmic groove, fast arpeggio, catchy hook, climax, or sudden change.',
  },
  {
    id: 'open_fifth_harmonic_bed',
    title: 'Open Fifth Harmonic Bed',
    category: 'harmonic_material',
    role: 'harmony',
    prompt: 'Instrumental ambient harmonic material, free-time, intensity 1/10. One soft blended synthesizer tone sustains a neutral open fifth as the only identity. Slow overlapping swells, no melody, no bass line, no chord progression, no tonal resolution, stable low density, consistent dynamics, and an unresolved ending. Soft attacks, warm middle register, restrained stereo width and reverb, designed as an editable background bed and for crossfaded looping. No singing, spoken voice, choir, piano, guitar, strings, drums, percussion, pulse, arpeggio, lead tone, bright transient, climax, or sudden change.',
  },
  {
    id: 'sparse_tonal_texture',
    title: 'Sparse Tonal Texture',
    category: 'tonal_texture',
    role: 'texture',
    prompt: 'Instrumental ambient tonal texture, free-time, intensity 1/10. A single soft granular glass-like texture is the only identity, with distant rounded partials emerging very slowly from silence. Sparse, low-event-density, harmonically neutral, no identifiable melody, no chord progression, no beat, stable dynamics, and an unresolved ending. Diffuse wide space, softened high frequencies, no sharp attacks, suitable as a subtle editable detail layer and for crossfaded looping. No singing, spoken voice, choir, piano, guitar, strings, bowls, bells, drums, percussion, pulse, bass line, hook, climax, or sudden change.',
  },
] as const;

type Metrics = {
  durationSeconds: number;
  codec: string;
  sampleRate: number;
  channels: number;
  bytes: number;
  meanVolumeDb: number | null;
  maxVolumeDb: number | null;
  silenceEvents: number;
};

type CandidateRecord = (typeof elementTypes)[number] & {
  candidateId: string;
  variant: number;
  model: string;
  provider: 'google-cloud-vertex-ai';
  audioUrl: string;
  metrics: Metrics;
  machineFlags: string[];
  generatedOn: string;
  productionAllowed: false;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const probe = (filePath: string): Metrics => {
  const data = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,sample_rate,channels', '-of', 'json', filePath], { encoding: 'utf8' }));
  const stream = data.streams?.[0] ?? {};
  const runFfmpegAnalysis = (filter: string) => {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-i', filePath, '-af', filter, '-f', 'null', '-'], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || `ffmpeg ${filter} failed`);
    return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  };
  const volumeOutput = runFfmpegAnalysis('volumedetect');
  const silenceOutput = runFfmpegAnalysis('silencedetect=noise=-50dB:d=0.5');
  const meanMatch = volumeOutput.match(/mean_volume:\s*(-?[\d.]+) dB/);
  const maxMatch = volumeOutput.match(/max_volume:\s*(-?[\d.]+) dB/);
  return {
    durationSeconds: Number(Number(data.format?.duration ?? 0).toFixed(3)),
    codec: String(stream.codec_name ?? ''),
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
    bytes: Number(data.format?.size ?? 0),
    meanVolumeDb: meanMatch ? Number(meanMatch[1]) : null,
    maxVolumeDb: maxMatch ? Number(maxMatch[1]) : null,
    silenceEvents: (silenceOutput.match(/silence_start:/g) ?? []).length,
  };
};

const publicUrl = (filePath: string) => `/${path.relative(publicRoot, filePath).split(path.sep).join('/')}`;
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const machineFlagsFor = (metrics: Metrics) => [
  ...(metrics.durationSeconds < 25 ? ['shorter_than_25_seconds'] : []),
  ...(metrics.maxVolumeDb !== null && metrics.maxVolumeDb > -0.5 ? ['near_digital_ceiling'] : []),
  ...(metrics.silenceEvents > 0 ? ['contains_detected_silence'] : []),
];

const generateWithRetry = async (prompt: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await generateLyriaMusic({ prompt, model: sourceModel });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 4_000);
    }
  }
  throw lastError;
};

const loadExistingRecords = async (): Promise<CandidateRecord[]> => {
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  return Array.isArray(manifest.candidates) ? manifest.candidates : [];
};

const writeManifest = async (records: CandidateRecord[]) => {
  const manifest = {
    schemaVersion: '1.0.0',
    batchId,
    updatedOn: new Date().toISOString(),
    status: records.length === elementTypes.length * 3 ? 'candidate_pending_human_identity_review' : 'generation_in_progress',
    provider: 'google-cloud-vertex-ai',
    sourceModel,
    experiment: 'direct_single_identity_generation_without_source_separation',
    productionAllowed: false,
    expectedElementTypes: elementTypes.length,
    expectedCandidatesPerType: 3,
    expectedCandidateCount: elementTypes.length * 3,
    completedCandidateCount: records.length,
    candidates: records,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

const buildReviewPage = async (records: CandidateRecord[]) => {
  const groups = elementTypes.map((element) => {
    const candidates = records.filter((record) => record.id === element.id).sort((a, b) => a.variant - b.variant);
    return `<section class="element"><header class="element-head"><p class="category">${escapeHtml(element.category)} · ${escapeHtml(element.role)}</p><h2>${escapeHtml(element.title)}</h2><p>${escapeHtml(element.prompt)}</p></header><div class="candidates">${candidates.map((record) => `<article><div class="candidate-head"><strong>候选 ${record.variant}</strong><span>${record.metrics.durationSeconds}s · ${record.metrics.sampleRate.toLocaleString()} Hz · mean ${record.metrics.meanVolumeDb ?? '-'} dB</span></div><audio controls preload="metadata" src="${record.audioUrl}"></audio><div class="review-grid"><label>主要身份是否正确<select data-key="${record.candidateId}:identity"><option value="">未判断</option><option value="yes">是，身份清楚</option><option value="mixed">部分正确但混合</option><option value="no">不是所请求元素</option></select></label><label>意外其他乐器<select data-key="${record.candidateId}:other"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label><label>意外旋律/Hook<select data-key="${record.candidateId}:melody"><option value="">未判断</option><option value="none">没有</option><option value="acceptable">有但可接受</option><option value="present">明显且不需要</option></select></label><label>意外和声变化<select data-key="${record.candidateId}:harmony"><option value="">未判断</option><option value="none">没有</option><option value="acceptable">有但可接受</option><option value="present">明显且不需要</option></select></label><label>鼓点/脉冲<select data-key="${record.candidateId}:beat"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label><label>人声/类人声<select data-key="${record.candidateId}:voice"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label><label>循环潜力<select data-key="${record.candidateId}:loop"><option value="">未判断</option><option value="yes">可交叉淡化循环</option><option value="edit">需要明显编辑</option><option value="no">不适合循环</option></select></label><label>基础元素可用性<select data-key="${record.candidateId}:usable"><option value="">未判断</option><option value="yes">可以</option><option value="conditional">有条件可用</option><option value="no">不可以</option></select></label><label>最终结论<select data-key="${record.candidateId}:decision"><option value="">待审核</option><option value="pass">通过候选</option><option value="retry">改提示词重试</option><option value="fail">淘汰</option></select></label></div><label class="notes">听感记录<textarea data-key="${record.candidateId}:notes" rows="3"></textarea></label></article>`).join('')}</div></section>`;
  }).join('');

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lyria 单一元素能力验证</title><style>:root{color-scheme:dark;--bg:#101311;--panel:#1a1f1b;--panel2:#141815;--line:#3a463d;--text:#f2f4f1;--muted:#aab5ac;--accent:#dfc77f;--danger:#e7a49b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}main{max-width:1180px;margin:auto;padding:28px 18px 80px}.intro{padding-bottom:24px;border-bottom:1px solid var(--line)}.eyebrow,.category{color:var(--accent);font-size:12px;text-transform:uppercase;font-weight:700}h1{font-size:30px;margin:8px 0 10px}h2{font-size:22px;margin:5px 0 8px}.intro p,.element-head p,.candidate-head span{color:var(--muted);line-height:1.55}.warning{color:var(--danger)!important}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);margin-top:20px}.summary div{background:var(--panel);padding:14px}.summary strong{display:block;font-size:19px}.summary span{color:var(--muted);font-size:12px}.element{padding:26px 0;border-bottom:1px solid var(--line)}.element-head>p:last-child{max-width:980px;font-size:13px}.candidates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}article{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:14px;min-width:0}.candidate-head{display:grid;gap:3px;margin-bottom:12px}.candidate-head span{font-size:11px}audio{width:100%;height:40px}.review-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px}label{display:grid;gap:4px;color:var(--muted);font-size:12px}select,textarea{width:100%;min-width:0;border:1px solid var(--line);border-radius:4px;background:var(--panel);color:var(--text);padding:8px;font:inherit}.notes{margin-top:8px}.actions{position:sticky;bottom:12px;display:flex;justify-content:flex-end;margin-top:20px;pointer-events:none}.actions button{pointer-events:auto;border:0;border-radius:6px;background:var(--accent);color:#171811;padding:11px 15px;font-weight:700;cursor:pointer}@media(max-width:900px){.candidates{grid-template-columns:1fr}.summary{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){main{padding:18px 12px 60px}.summary{grid-template-columns:1fr}h1{font-size:25px}}</style></head><body><main><section class="intro"><p class="eyebrow">REAL GOOGLE VERTEX AI LYRIA · NO DEMUCS</p><h1>单一基础元素能力验证</h1><p>8 类请求，每类使用完全相同的提示词真实生成 3 次。目标是判断 Lyria 能否稳定输出身份清楚、可独立使用的音乐级元素，而不是评价完整歌曲。</p><p class="warning">所有 24 条均为候选，productionAllowed=false。API 返回成功、文件可播放或机器指标正常，都不代表素材通过。</p><div class="summary"><div><strong>${elementTypes.length}</strong><span>元素类型</span></div><div><strong>${records.length}</strong><span>真实候选</span></div><div><strong>3</strong><span>每类重复生成</span></div><div><strong>0</strong><span>自动批准</span></div></div></section>${groups}<div class="actions"><button id="export" type="button">导出全部审核结果</button></div></main><script>const storageKey='snooze-${batchId}-review';const state=JSON.parse(localStorage.getItem(storageKey)||'{}');document.querySelectorAll('[data-key]').forEach(input=>{input.value=state[input.dataset.key]||'';const save=()=>{state[input.dataset.key]=input.value;localStorage.setItem(storageKey,JSON.stringify(state))};input.addEventListener('change',save);input.addEventListener('input',save)});document.getElementById('export').addEventListener('click',()=>{const output={schemaVersion:'1.0.0',batchId:'${batchId}',reviewedOn:new Date().toISOString(),productionAllowed:false,reviews:state};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='${batchId}-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)});</script></body></html>`;
  await mkdir(reviewDir, { recursive: true });
  await writeFile(path.join(reviewDir, 'index.html'), html);
};

const main = async () => {
  await mkdir(audioDir, { recursive: true });
  let records = await loadExistingRecords();

  for (const element of elementTypes) {
    for (let variant = 1; variant <= 3; variant += 1) {
      const candidateId = `${element.id}_v${variant}`;
      const audioPath = path.join(audioDir, `${candidateId}.mp3`);
      const existingIndex = records.findIndex((record) => record.candidateId === candidateId);
      if (existsSync(audioPath)) {
        const metrics = probe(audioPath);
        const record: CandidateRecord = {
          ...element,
          candidateId,
          variant,
          model: sourceModel,
          provider: 'google-cloud-vertex-ai',
          audioUrl: publicUrl(audioPath),
          metrics,
          machineFlags: machineFlagsFor(metrics),
          generatedOn: existingIndex >= 0 ? records[existingIndex].generatedOn : new Date().toISOString(),
          productionAllowed: false,
        };
        if (existingIndex >= 0) records[existingIndex] = record;
        else records.push(record);
        continue;
      }

      console.log(`[${records.length + 1}/${elementTypes.length * 3}] generating ${candidateId}`);
      const generated = await generateWithRetry(element.prompt);
      try {
        await copyFile(generated.outputPath, audioPath);
      } finally {
        await rm(generated.temporaryDirectory, { recursive: true, force: true });
      }
      const metrics = probe(audioPath);
      records.push({
        ...element,
        candidateId,
        variant,
        model: generated.model,
        provider: generated.provider,
        audioUrl: publicUrl(audioPath),
        metrics,
        machineFlags: machineFlagsFor(metrics),
        generatedOn: new Date().toISOString(),
        productionAllowed: false,
      });
      records = records.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
      await writeManifest(records);
    }
  }

  records = records.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  await writeManifest(records);
  await buildReviewPage(records);
  console.log(JSON.stringify({ passed: true, batchId, elementTypes: elementTypes.length, realCandidates: records.length, productionAllowed: false, reviewUrl: `/review/${batchId}/index.html` }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
