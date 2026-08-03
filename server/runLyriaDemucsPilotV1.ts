import 'dotenv/config';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { generateLyriaMusic } from './lyriaProvider';

const root = process.cwd();
const batchId = 'lyria-demucs-pilot-v1';
const publicRoot = path.join(root, 'public');
const batchRoot = path.join(publicRoot, 'audio/music/local-review', batchId);
const originalsDir = path.join(batchRoot, 'originals');
const separationRoot = path.join(batchRoot, 'separated');
const reviewDir = path.join(publicRoot, 'review', batchId);
const manifestPath = path.join(batchRoot, 'manifest.json');
const demucsPython = path.join(root, '.venv-demucs/bin/python');
const expectedRoles = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];

const candidates = [
  {
    id: 'sleep_felt_piano_low_motion',
    goal: 'sleep',
    prompt: 'Instrumental ambient sleep music, 48 BPM, intensity 1/10. Peaceful and dark-warm, led by soft felt piano in a low register with a quiet sustained pad underneath. Very sparse notes, long spaces, slow harmonic motion, and no foreground hook. A stable 30-second texture with a gentle beginning and an unresolved soft ending. Clean intimate mix, restrained reverb, soft attacks. No singing, spoken voice, drums, percussion, rhythmic pulse, arpeggios, bright chimes, climax, or sudden change.',
  },
  {
    id: 'meditation_rhodes_breath_space',
    goal: 'calm',
    prompt: 'Instrumental ambient meditation music, free-time, intensity 2/10. Spacious, grounded, and inward-looking, led by warm Rhodes with a restrained soft woodwind response. Short phrases separated by long spaces, open harmony, slow timbral movement, and no dramatic resolution. Clean natural production with moderate space. No singing, spoken voice, drums, strong pulse, dense melody, cinematic build, sharp attacks, or sudden transition.',
  },
  {
    id: 'focus_rhodes_common_tone',
    goal: 'focus',
    prompt: 'Instrumental minimal ambient focus music at 68 BPM and intensity 3/10. Neutral, steady, and quietly alert, led by dry warm Rhodes and a soft common-tone synthesizer bed. Use a narrow repeating motif with small variations, stable dynamics, gentle low-frequency movement, restrained percussion, and a clean close mix with limited reverb. Keep the arrangement simple and consistent for background concentration.',
  },
];

const runCommand = (command: string, args: string[]) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
});

const probe = (filePath: string) => {
  const data = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', filePath], { encoding: 'utf8' }));
  const stream = data.streams?.[0] ?? {};
  return {
    durationSeconds: Number(Number(data.format?.duration ?? 0).toFixed(3)),
    codec: String(stream.codec_name ?? ''),
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
  };
};

const publicUrl = (filePath: string) => `/${path.relative(publicRoot, filePath).split(path.sep).join('/')}`;
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const main = async () => {
  if (!existsSync(demucsPython)) throw new Error('Demucs environment is missing. Create .venv-demucs first.');
  await mkdir(originalsDir, { recursive: true });
  await mkdir(separationRoot, { recursive: true });
  const records = [];

  for (const candidate of candidates) {
    const originalPath = path.join(originalsDir, `${candidate.id}.mp3`);
    if (!existsSync(originalPath)) {
      const generated = await generateLyriaMusic({ prompt: candidate.prompt, model: 'lyria-3-clip-preview' });
      try {
        await copyFile(generated.outputPath, originalPath);
      } finally {
        await rm(generated.temporaryDirectory, { recursive: true, force: true });
      }
    }

    const candidateSeparationDir = path.join(separationRoot, 'htdemucs_6s', candidate.id);
    if (!expectedRoles.every((role) => existsSync(path.join(candidateSeparationDir, `${role}.mp3`)))) {
      await runCommand(demucsPython, ['-m', 'demucs', '-n', 'htdemucs_6s', '--mp3', '--mp3-bitrate', '192', '-o', separationRoot, originalPath]);
    }
    const stems = expectedRoles.map((role) => {
      const filePath = path.join(candidateSeparationDir, `${role}.mp3`);
      if (!existsSync(filePath)) throw new Error(`Demucs did not produce ${filePath}`);
      return { role, audioUrl: publicUrl(filePath), metrics: probe(filePath) };
    });
    records.push({ ...candidate, model: 'lyria-3-clip-preview', originalAudioUrl: publicUrl(originalPath), originalMetrics: probe(originalPath), stems });
  }

  const manifest = {
    schemaVersion: '1.0.0',
    batchId,
    generatedOn: new Date().toISOString(),
    status: 'candidate_pending_human_stem_review',
    provider: 'google-cloud-vertex-ai',
    sourceModel: 'lyria-3-clip-preview',
    separator: { name: 'Demucs', version: '4.1.0', model: 'htdemucs_6s', expectedRoles },
    productionAllowed: false,
    candidates: records,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const sections = records.map((record) => `<article><span class="goal">${escapeHtml(record.goal)}</span><h2>${escapeHtml(record.id)}</h2><p class="meta">原始 Lyria · ${record.originalMetrics.durationSeconds}s · ${escapeHtml(record.originalMetrics.codec)}</p><audio controls preload="metadata" src="${record.originalAudioUrl}"></audio><details><summary>提示词</summary><p>${escapeHtml(record.prompt)}</p></details><div class="stems">${record.stems.map((stem) => `<section><h3>${escapeHtml(stem.role)}</h3><p>${stem.metrics.durationSeconds}s · ${stem.metrics.sampleRate.toLocaleString()} Hz</p><audio controls preload="metadata" src="${stem.audioUrl}"></audio></section>`).join('')}</div><div class="review"><label>原曲质量<select data-key="${record.id}:quality"><option value="">未判断</option><option value="pass">符合目标</option><option value="partial">部分符合</option><option value="fail">不符合</option></select></label><label>分轨可用性<select data-key="${record.id}:separation"><option value="">未判断</option><option value="pass">可作为基础元素</option><option value="partial">部分 Stem 可用</option><option value="fail">分轨不可用</option></select></label><label>人声污染<select data-key="${record.id}:voice"><option value="">未判断</option><option value="none">没有</option><option value="present">存在</option><option value="uncertain">不确定</option></select></label><label>结论<select data-key="${record.id}:decision"><option value="">待审核</option><option value="keep">保留候选 Stem</option><option value="retry">改提示词重试</option><option value="reject">淘汰</option></select></label></div><label class="notes">记录<textarea data-key="${record.id}:notes" rows="3"></textarea></label></article>`).join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lyria + Demucs 基础元素试验</title><style>:root{color-scheme:dark;--bg:#111311;--panel:#1b201c;--line:#39443b;--text:#f0f3ef;--muted:#aab5ac;--accent:#dec37c}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1020px;margin:auto;padding:26px 18px 70px}header,article{padding:22px 0;border-bottom:1px solid var(--line)}h1{font-size:28px;margin:8px 0}.eyebrow,.goal{color:var(--accent);font-size:12px;text-transform:uppercase}.intro,.meta,details p,.stems p{color:var(--muted);line-height:1.5}.stems{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.stems section{background:var(--panel);padding:12px;border:1px solid var(--line);border-radius:6px}.stems h3{margin:0;font-size:15px}.stems p{font-size:12px;margin:4px 0}.review{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}label{display:grid;gap:5px;color:var(--muted);font-size:12px}select,textarea{width:100%;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--text);padding:9px;font:inherit}.notes{margin-top:10px}audio{width:100%;height:40px}summary{cursor:pointer;color:var(--accent)}button{margin-top:18px;padding:10px 14px;border:0;border-radius:6px;background:var(--accent);color:#151711;font-weight:700}@media(max-width:620px){.stems,.review{grid-template-columns:1fr}main{padding:18px 12px 55px}}</style></head><body><main><header><p class="eyebrow">LYRIA ORIGINALS · DEMUCS 6-STEM SEPARATION</p><h1>商业生成质量转基础元素试验</h1><p class="intro">先听每条 Lyria 原曲，再逐一听 vocals、drums、bass、guitar、piano、other 六层。只有原曲质量和分轨可用性都通过，Stem 才能进入后续素材 QA；当前没有任何内容自动批准。</p><button id="export">导出审核结果</button></header>${sections}</main><script>const key='snooze-lyria-demucs-pilot-v1';const state=JSON.parse(localStorage.getItem(key)||'{}');document.querySelectorAll('[data-key]').forEach(input=>{input.value=state[input.dataset.key]||'';const save=()=>{state[input.dataset.key]=input.value;localStorage.setItem(key,JSON.stringify(state))};input.addEventListener('change',save);input.addEventListener('input',save)});document.getElementById('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({batchId:'${batchId}',reviewedOn:new Date().toISOString(),reviews:state},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='lyria-demucs-pilot-v1-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0)});</script></body></html>`;
  await mkdir(reviewDir, { recursive: true });
  await writeFile(path.join(reviewDir, 'index.html'), html);
  console.log(JSON.stringify({ passed: true, batchId, originals: records.length, stems: records.length * expectedRoles.length, reviewUrl: `/review/${batchId}/index.html` }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
