#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-15';
const batchId = 'supply_gap_batch_02';
const sourceDir = resolve(ROOT, 'public/audio/candidates/supply-gap-batch-02/aircraft');
const reviewDir = resolve(ROOT, `public/audio/supply-gap-batch-02/review/${DATE}`);
const python = resolve(ROOT, '.venv-audio/bin/python');
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');

const candidates = [
  {
    id: 'aircraft_cabin_csnmedia_381174',
    title: 'Aircraft Cabin · Steady Jet Rumble',
    family: 'aircraft_cabin',
    sourcePath: resolve(sourceDir, 'aircraft_cabin_csnmedia_381174.mp3'),
    sourcePlatform: 'Freesound',
    sourceCreator: 'csnmedia',
    sourceUrl: 'https://freesound.org/people/csnmedia/sounds/381174/',
    downloadUrl: 'https://cdn.freesound.org/previews/381/381174_926978-hq.mp3',
    sourceDescription: 'Rumbling engine sound recorded inside an aircraft.',
    sourceSnapshot: 'docs/license-snapshots/supply-gap-batch-02/freesound-381174.source.html',
    processing: 'linear_gain_only',
  },
  {
    id: 'airbus_a330_cabin_fillsoko_456092',
    title: 'Airbus A330 Cabin Ambience',
    family: 'aircraft_cabin',
    sourcePath: resolve(sourceDir, 'airbus_a330_cabin_fillsoko_456092.mp3'),
    sourcePlatform: 'Freesound',
    sourceCreator: 'FillSoko',
    sourceUrl: 'https://freesound.org/people/FillSoko/sounds/456092/',
    downloadUrl: 'https://cdn.freesound.org/previews/456/456092_3025911-hq.mp3',
    sourceDescription: 'Airplane cabin ambience recorded inside an Airbus A330-300.',
    sourceSnapshot: 'docs/license-snapshots/supply-gap-batch-02/freesound-456092.source.html',
    processing: 'linear_gain_only',
  },
  {
    id: 'atr_cabin_stanestane_834221',
    title: 'ATR Mid-flight Cabin Engine',
    family: 'aircraft_cabin',
    sourcePath: resolve(sourceDir, 'atr_cabin_stanestane_834221.mp3'),
    sourcePlatform: 'Freesound',
    sourceCreator: 'StaneStane',
    sourceUrl: 'https://freesound.org/people/StaneStane/sounds/834221/',
    downloadUrl: 'https://cdn.freesound.org/previews/834/834221_701056-hq.mp3',
    sourceDescription: 'Propeller-engine noise recorded mid-flight inside an ATR passenger cabin.',
    sourceSnapshot: 'docs/license-snapshots/supply-gap-batch-02/freesound-834221.source.html',
    processing: 'linear_gain_only',
  },
  {
    id: 'turboplane_cabin_trp_573143',
    title: 'Small Turboplane In-flight Cabin',
    family: 'aircraft_cabin',
    sourcePath: resolve(sourceDir, 'turboplane_cabin_trp_573143.mp3'),
    sourcePlatform: 'Freesound',
    sourceCreator: 'TRP',
    sourceUrl: 'https://freesound.org/people/TRP/sounds/573143/',
    downloadUrl: 'https://cdn.freesound.org/previews/573/573143_97550-hq.mp3',
    sourceDescription: 'Small turboprop aircraft cabin ambience recorded in flight.',
    sourceSnapshot: 'docs/license-snapshots/supply-gap-batch-02/freesound-573143.source.html',
    processing: 'linear_gain_only',
  },
  {
    id: 'train_taiwan_all_night_variant',
    title: 'Taiwan Rail Car · All-night Low-stimulation Variant',
    family: 'train_carriage_all_night',
    sourcePath: resolve(ROOT, 'public/audio/candidates/batch-09/authentic-indoor/train_taiwan_ep727.ogg'),
    sourcePlatform: 'Wikimedia Commons',
    sourceCreator: 'Jidanni',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Taiwan_railways_EP727_train_cars_sounds.ogg',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Taiwan_railways_EP727_train_cars_sounds.ogg',
    sourceDescription: 'Previously approved authentic Taiwan rail-car recording, now tested as a lower-brightness all-night variant.',
    sourceSnapshot: 'docs/license-snapshots/batch-09/train_taiwan_ep727.source.html',
    processing: 'highpass_35_lowpass_2400_soft_compression',
  },
];

const rejectedAtSourceScreen = [
  ['richwise_451741', 'Description explicitly says passenger conversation is present.'],
  ['globofonia_547027', 'Pilot and loudspeaker announcements are explicitly present.'],
  ['drewhalasz_433002', 'Passenger chatter and seatbelt announcement are explicitly present.'],
  ['kyles_452099', 'French and English PA landing message is explicitly present.'],
  ['kyles_453710', 'Pre-takeoff passenger settling is not a steady in-flight bed.'],
  ['macdaddyno1_361503', 'Cabin crew announcement is explicitly present.'],
  ['macdaddyno1_361504', 'Cabin crew announcement is explicitly present.'],
  ['macdaddyno1_361505', 'Cabin crew announcement is explicitly present.'],
  ['macdaddyno1_361507', 'Cabin crew announcement is explicitly present.'],
  ['marc_om_806562', 'Muffled announcements are explicitly present.'],
  ['elevatorfan_845957', 'Takeoff phase and tonal engine event are too attention-capturing.'],
];

mkdirSync(reviewDir, { recursive: true });

const run = (command, args, capture = false) => execFileSync(command, args, {
  cwd: ROOT,
  encoding: capture ? 'utf8' : undefined,
  stdio: capture ? 'pipe' : 'inherit',
  maxBuffer: 50 * 1024 * 1024,
});
const analyze = (file) => JSON.parse(run(python, [analyzer, file], true));
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

const results = candidates.map((candidate) => {
  const sourceAnalysis = analyze(candidate.sourcePath);
  const targetLufs = candidate.family === 'train_carriage_all_night' ? -32 : -30;
  const gainDb = Math.round(Math.min(
    targetLufs - sourceAnalysis.integratedLufs,
    -8 - sourceAnalysis.samplePeakDbfs,
  ) * 100) / 100;
  const reviewPath = resolve(reviewDir, `${candidate.id}.mp3`);
  const filter = candidate.processing === 'linear_gain_only'
    ? `volume=${gainDb}dB`
    : `highpass=f=35,lowpass=f=2400,acompressor=threshold=-24dB:ratio=1.5:attack=80:release=600,volume=${gainDb}dB`;
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', candidate.sourcePath,
    '-af', filter, '-ar', '48000', '-ac', '2',
    '-codec:a', 'libmp3lame', '-b:a', '256k', reviewPath,
  ]);
  const analysis = analyze(reviewPath);
  const failures = [
    ...(analysis.durationSeconds < 45 ? ['duration_under_45s'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak_above_-6_dbfs'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(analysis.interiorSilence100msFrames > 0 ? ['digital_dropout'] : []),
    ...(analysis.max100msRmsJumpDb > 12 ? ['sudden_rms_jump'] : []),
  ];
  return {
    ...candidate,
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
    commercialUseAllowed: true,
    derivativeUseAllowed: true,
    rawRedistributionAllowed: true,
    sourceSha256: sha256(candidate.sourcePath),
    sourceAnalysis,
    reviewGainDb: gainDb,
    reviewPath: reviewPath.slice(ROOT.length + 1),
    previewUrl: `/audio/supply-gap-batch-02/review/${DATE}/${candidate.id}.mp3`,
    analysis,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    semanticIdentityStatus: 'pending',
    noHumanVoiceStatus: 'pending',
    lowStimulationStatus: 'pending',
    promotionAllowed: false,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  batchId,
  purpose: 'close_remaining_train_all_night_and_aircraft_cabin_content_coverage',
  candidateCount: results.length,
  aircraftCandidateCount: results.filter((item) => item.family === 'aircraft_cabin').length,
  trainVariantCount: results.filter((item) => item.family === 'train_carriage_all_night').length,
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  rejectedAtSourceScreen: rejectedAtSourceScreen.map(([id, reason]) => ({ id, reason })),
  promotionAllowed: false,
  remainingGates: [
    'semantic_identity_listening',
    'no_human_voice_listening',
    'low_stimulation_listening',
    'ten_minute_loop_qa',
    'recipe_v2_combination_qa',
    'final_promotion_review',
  ],
  results,
};

writeFileSync(resolve(ROOT, `reports/supply-gap-batch-02-source-review-${DATE}.json`), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(ROOT, `reports/supply-gap-batch-02-source-review-${DATE}.md`), `# Supply Gap Batch 02 Source Review

Date: ${DATE}  
Status: **candidate-only**. Nothing on this page is approved or matchable.

- Shortlisted: ${results.length} candidates.
- Rejected before download: ${rejectedAtSourceScreen.length}.
- Machine pass: ${report.machinePassCount}/${results.length}.
- Hard listening rule: any audible human voice, announcement, or passenger speech fails.

| Candidate | Family | Seconds | LUFS | Peak | 100ms jump | Machine | Review |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
${results.map((item) => `| ${item.title} | ${item.family} | ${item.analysis.durationSeconds} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.analysis.max100msRmsJumpDb} | ${item.machineStatus} | [试听](http://localhost:5174${item.previewUrl}) |`).join('\n')}

## Listening gate

Confirm the source identity is authentic, no human voice or announcement is audible, no sudden engine event pulls attention, and the sound remains comfortable at low volume. Machine pass does not imply listening approval.
`);

const cards = results.map((item, index) => `
<article class="card" data-id="${item.id}" data-status="pending">
  <header><div><p>${String(index + 1).padStart(2, '0')} · ${item.family}</p><h2>${item.title}</h2></div><span class="${item.machineStatus}">${item.machineStatus}</span></header>
  <audio controls preload="metadata" src="${item.previewUrl}"></audio>
  <p>${item.sourceDescription}</p>
  <p class="metrics">${item.analysis.durationSeconds}s · ${item.analysis.integratedLufs} LUFS · peak ${item.analysis.samplePeakDbfs} dBFS · jump ${item.analysis.max100msRmsJumpDb} dB</p>
  <p class="focus">重点听：是否有任何人声或广播；是否有突然的机械变化；低音量下是否真实且不疲劳。</p>
  <div class="actions"><button data-decision="pass">通过</button><button data-decision="needs_fix">需修正</button><button data-decision="reject">拒绝</button></div>
  <textarea placeholder="记录听到的人声、广播、突变、疲劳点或适用场景"></textarea>
  <div class="decision">待定</div>
</article>`).join('\n');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Supply Gap Batch 02 Source Listening QA</title>
<style>
:root{color-scheme:dark;--bg:#09100f;--panel:#131c19;--line:#2b3a34;--text:#edf7f2;--muted:#9fafaa;--good:#7ee2a8;--warn:#ffd077;--bad:#ff9292}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:28px 18px 64px}h1{margin:0 0 8px}.summary,p{line-height:1.55}.summary,.metrics,header p,.focus{color:var(--muted)}.stats{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.stats span,.card header span,.decision{border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12px}.grid{display:grid;gap:14px}.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}.card header{display:flex;justify-content:space-between;gap:12px}.card h2{font-size:18px;margin:3px 0}.card header p{margin:0;font-size:13px}.pass{color:var(--good);border-color:var(--good)!important}.fail,.card[data-status=reject] .decision{color:var(--bad);border-color:var(--bad)!important}.card[data-status=pass] .decision{color:var(--good);border-color:var(--good)}.card[data-status=needs_fix] .decision{color:var(--warn);border-color:var(--warn)}audio{width:100%;margin:12px 0}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button{border:1px solid var(--line);background:#202b27;color:var(--text);border-radius:7px;padding:9px 12px;cursor:pointer}textarea{width:100%;min-height:64px;background:#0c1311;color:var(--text);border:1px solid var(--line);border-radius:7px;padding:9px}.decision{display:inline-block;margin-top:9px}.toolbar{display:flex;justify-content:flex-end}@media(max-width:700px){.card header{display:block}}
</style></head><body><main>
<h1>Supply Gap Batch 02 · 第一轮试听</h1>
<p class="summary">只检查剩余两个内容缺口：飞机客舱底噪，以及火车车厢的整夜低刺激版本。任何可闻人声或广播都必须拒绝；本页通过也不代表入库。</p>
<div class="stats"><span>${results.length} 个候选</span><span>${report.machinePassCount}/${results.length} 机器通过</span><span>${rejectedAtSourceScreen.length} 个源头淘汰</span><span>CC0</span></div>
<div class="toolbar"><button id="export">导出决定</button></div><div class="grid">${cards}</div>
<script>
const key='supply-gap-batch-02-source-listening-v1',cards=[...document.querySelectorAll('.card')],load=()=>JSON.parse(localStorage.getItem(key)||'{}'),save=s=>localStorage.setItem(key,JSON.stringify(s));
function render(){const s=load();for(const c of cards){const v=s[c.dataset.id]||{decision:'pending',notes:''};c.dataset.status=v.decision;c.querySelector('.decision').textContent=({pending:'待定',pass:'通过',needs_fix:'需修正',reject:'拒绝'})[v.decision];c.querySelector('textarea').value=v.notes||''}}
for(const c of cards){for(const b of c.querySelectorAll('[data-decision]'))b.onclick=()=>{const s=load(),v=s[c.dataset.id]||{};s[c.dataset.id]={...v,decision:b.dataset.decision,notes:c.querySelector('textarea').value};save(s);render()};c.querySelector('textarea').oninput=e=>{const s=load(),v=s[c.dataset.id]||{decision:'pending'};s[c.dataset.id]={...v,notes:e.target.value};save(s)}}
document.querySelector('#export').onclick=()=>{const s=load(),rows=[['item_id','decision','notes'],...cards.map(c=>{const v=s[c.dataset.id]||{decision:'pending',notes:''};return[c.dataset.id,v.decision,v.notes]})],tsv=rows.map(r=>r.map(x=>String(x).replaceAll('\\t',' ').replaceAll('\\n',' ')).join('\\t')).join('\\n')+'\\n',a=document.createElement('a');a.href=URL.createObjectURL(new Blob([tsv],{type:'text/tab-separated-values'}));a.download='supply-gap-batch-02-source-listening-decisions.tsv';a.click();URL.revokeObjectURL(a.href)};render();
</script></main></body></html>`;

writeFileSync(resolve(ROOT, 'public/review/supply-gap-batch-02.html'), html);
console.log(JSON.stringify({
  page: 'public/review/supply-gap-batch-02.html',
  report: `reports/supply-gap-batch-02-source-review-${DATE}.md`,
  candidateCount: results.length,
  machinePassCount: report.machinePassCount,
  sourceScreenRejectedCount: rejectedAtSourceScreen.length,
  promotionAllowed: false,
}, null, 2));
