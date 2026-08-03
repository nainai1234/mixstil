#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-15';
const indoorReport = JSON.parse(readFileSync(resolve(ROOT, 'reports/authentic-indoor-source-review-2026-07-14.json'), 'utf8'));
const focusReport = JSON.parse(readFileSync(resolve(ROOT, 'reports/supply-gap-batch-01-focus-machine-qa-2026-07-15.json'), 'utf8'));
const outputDir = resolve(ROOT, `public/audio/supply-gap-batch-01-loop-qa/${DATE}`);
const sourceMasterDir = resolve(outputDir, 'source-wav-masters');
const loopMasterDir = resolve(outputDir, 'loop-wav-masters');
const python = resolve(ROOT, '.venv-audio/bin/python');
const loopBuilder = resolve(ROOT, 'scripts/build-loop-qa.py');
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');
const seamAnalyzer = resolve(ROOT, 'scripts/analyze-loop-seams.py');

mkdirSync(sourceMasterDir, { recursive: true });
mkdirSync(loopMasterDir, { recursive: true });

const run = (command, args, capture = false) => execFileSync(command, args, {
  cwd: ROOT,
  encoding: capture ? 'utf8' : undefined,
  stdio: capture ? 'pipe' : 'inherit',
  maxBuffer: 50 * 1024 * 1024,
});
const analyze = (file) => JSON.parse(run(python, [analyzer, file], true));
const probeDuration = (file) => Number(JSON.parse(run(
  'ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file],
  true,
)).format.duration);

const eligibleIndoor = indoorReport.results.filter((item) => item.machineStatus === 'pass');
const eligibleFocus = focusReport.results.filter((item) => item.machineStatus === 'pass');
const candidates = [
  ...eligibleIndoor.map((item) => ({
    id: item.id,
    title: item.title,
    group: 'authentic_indoor',
    family: item.family,
    sourcePath: resolve(ROOT, item.localPath),
    sourceGainDb: item.reviewGainDb,
    trimStart: 0,
    trimEnd: 0,
    crossfade: Math.min(5, Math.max(1, item.sourceAnalysis.durationSeconds / 5)),
    license: {
      name: item.licenseName,
      url: item.licenseUrl,
      sourceUrl: item.sourceUrl,
      creator: item.sourceCreator,
      attributionRequired: item.attributionRequired,
    },
  })),
  ...eligibleFocus.map((item) => ({
    id: item.id,
    title: item.id.replaceAll('procedural_', '').replaceAll('_', ' '),
    group: 'local_focus',
    family: item.family,
    sourcePath: resolve(ROOT, item.wavPath),
    sourceGainDb: 0,
    trimStart: 8,
    trimEnd: 8,
    crossfade: 2,
    license: {
      name: 'Deterministic project-owned synthesis',
      generator: focusReport.generatorSha256,
      seed: item.seed,
      profile: item.profile,
      attributionRequired: false,
    },
  })),
];

const results = candidates.map((candidate) => {
  const sourceMaster = resolve(sourceMasterDir, `${candidate.id}.wav`);
  const loopMaster = resolve(loopMasterDir, `${candidate.id}.wav`);
  const preview = resolve(outputDir, `${candidate.id}.mp3`);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', candidate.sourcePath,
    '-af', `volume=${candidate.sourceGainDb}dB`, '-ar', '48000', '-ac', '2',
    '-codec:a', 'pcm_f32le', sourceMaster,
  ]);
  const fullSourceDuration = probeDuration(sourceMaster);
  const loopSourceDuration = fullSourceDuration - candidate.trimStart - candidate.trimEnd;
  run(python, [
    loopBuilder, sourceMaster, loopMaster,
    '--duration', '600',
    '--crossfade', String(candidate.crossfade),
    '--trim-start', String(candidate.trimStart),
    '--trim-end', String(candidate.trimEnd),
    '--output-fade', '4',
  ]);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', loopMaster,
    '-codec:a', 'libmp3lame', '-b:a', '256k', preview,
  ]);
  const analysis = analyze(loopMaster);
  const seams = JSON.parse(run(python, [
    seamAnalyzer, loopMaster,
    '--source-duration', String(loopSourceDuration),
    '--crossfade', String(candidate.crossfade),
  ], true));
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 600) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(seams.digitalSilence100msFrames > 0 ? ['digital_dropout'] : []),
    ...(seams.maxJoinRmsDeltaDb > (candidate.group === 'local_focus' ? 1.5 : 3) ? ['loop_join_rms'] : []),
  ];
  return {
    ...candidate,
    basicListening: {
      status: 'pass',
      noHumanVoiceStatus: 'pass',
      reviewedBy: 'project_owner',
      reviewedOn: DATE,
    },
    sourceMasterPath: sourceMaster.slice(ROOT.length + 1),
    loopMasterPath: loopMaster.slice(ROOT.length + 1),
    previewUrl: `/audio/supply-gap-batch-01-loop-qa/${DATE}/${candidate.id}.mp3`,
    loop: { durationSeconds: 600, crossfadeSeconds: candidate.crossfade },
    analysis,
    seams,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    humanLoopListeningStatus: 'pending',
    promotionAllowed: false,
  };
});

const excluded = indoorReport.results
  .filter((item) => item.machineStatus !== 'pass')
  .map((item) => ({
    id: item.id,
    title: item.title,
    basicListeningStatus: 'pass',
    machineStatus: item.machineStatus,
    failures: item.failures,
    disposition: 'technical_remediation_required_before_loop_qa',
  }));

const report = {
  generatedAt: new Date().toISOString(),
  batchId: 'supply_gap_batch_01',
  basicListeningPassCount: indoorReport.results.length + focusReport.results.length,
  eligibleLoopCandidateCount: results.length,
  loopMachinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  excluded,
  promotionAllowed: false,
  remainingGates: ['loop_human_listening', 'recipe_v2_combination_qa', 'final_promotion_review'],
  results,
};
writeFileSync(resolve(ROOT, `reports/supply-gap-batch-01-loop-qa-${DATE}.json`), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(ROOT, `reports/supply-gap-batch-01-loop-qa-${DATE}.md`), `# Supply Gap Batch 01 Loop QA

Date: ${DATE}  
Basic listening and no-human-voice gate: **13/13 passed by project owner**.  
Eligible for loop QA: **${results.length}**.  
Ten-minute loop machine QA: **${report.loopMachinePassCount}/${results.length} passed**.  
Excluded for remediation: **${excluded.length}**.

| Candidate | Family | LUFS | Peak | Join RMS | Machine | Review |
| --- | --- | ---: | ---: | ---: | --- | --- |
${results.map((item) => `| ${item.title} | ${item.family} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.seams.maxJoinRmsDeltaDb} | ${item.machineStatus} | [10 分钟试听](http://localhost:5174${item.previewUrl}) |`).join('\n')}

Nothing is approved yet. Human loop listening and Recipe V2 combination QA remain required.
`);
console.log(JSON.stringify({
  candidateCount: results.length,
  loopMachinePassCount: report.loopMachinePassCount,
  excludedCount: excluded.length,
  report: `reports/supply-gap-batch-01-loop-qa-${DATE}.md`,
}, null, 2));
