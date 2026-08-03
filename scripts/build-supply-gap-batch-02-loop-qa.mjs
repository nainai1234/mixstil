#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-15';
const sourceReport = JSON.parse(readFileSync(resolve(ROOT, `reports/supply-gap-batch-02-source-review-${DATE}.json`), 'utf8'));
const outputDir = resolve(ROOT, `public/audio/supply-gap-batch-02-loop-qa/${DATE}`);
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

const eligible = sourceReport.results.filter((item) => item.machineStatus === 'pass');
const results = eligible.map((item) => {
  const sourceMaster = resolve(sourceMasterDir, `${item.id}.wav`);
  const loopMaster = resolve(loopMasterDir, `${item.id}.wav`);
  const preview = resolve(outputDir, `${item.id}.mp3`);
  const crossfadeSeconds = item.family === 'train_carriage_all_night' ? 5 : 4;

  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(ROOT, item.reviewPath),
    '-ar', '48000', '-ac', '2', '-codec:a', 'pcm_f32le', sourceMaster,
  ]);
  const sourceDurationSeconds = probeDuration(sourceMaster);
  run(python, [
    loopBuilder, sourceMaster, loopMaster,
    '--duration', '600',
    '--crossfade', String(crossfadeSeconds),
    '--output-fade', '4',
  ]);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', loopMaster,
    '-codec:a', 'libmp3lame', '-b:a', '256k', preview,
  ]);

  const analysis = analyze(loopMaster);
  const seams = JSON.parse(run(python, [
    seamAnalyzer, loopMaster,
    '--source-duration', String(sourceDurationSeconds),
    '--crossfade', String(crossfadeSeconds),
  ], true));
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 600) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.integratedLufs < -38 || analysis.integratedLufs > -24 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(seams.digitalSilence100msFrames > 0 ? ['digital_dropout'] : []),
    ...(seams.maxJoinRmsDeltaDb > 3 ? ['loop_join_rms'] : []),
  ];
  return {
    id: item.id,
    title: item.title,
    family: item.family,
    licenseName: item.licenseName,
    sourceUrl: item.sourceUrl,
    sourceCreator: item.sourceCreator,
    sourceReviewStatus: 'pending_human_listening',
    noHumanVoiceStatus: 'pending_human_listening',
    sourceMasterPath: sourceMaster.slice(ROOT.length + 1),
    loopMasterPath: loopMaster.slice(ROOT.length + 1),
    previewUrl: `/audio/supply-gap-batch-02-loop-qa/${DATE}/${item.id}.mp3`,
    loop: { durationSeconds: 600, crossfadeSeconds },
    analysis,
    seams,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    humanLoopListeningStatus: 'pending',
    promotionAllowed: false,
  };
});

const excluded = sourceReport.results.filter((item) => item.machineStatus !== 'pass').map((item) => ({
  id: item.id,
  title: item.title,
  failures: item.failures,
  disposition: 'isolated_machine_failed_not_rendered',
}));
const report = {
  generatedAt: new Date().toISOString(),
  batchId: 'supply_gap_batch_02',
  eligibleLoopCandidateCount: results.length,
  loopMachinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  excluded,
  promotionAllowed: false,
  remainingGates: ['source_human_listening', 'no_human_voice_hard_gate', 'loop_human_listening', 'recipe_v2_combination_qa', 'final_promotion_review'],
  results,
};
writeFileSync(resolve(ROOT, `reports/supply-gap-batch-02-loop-qa-${DATE}.json`), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(ROOT, `reports/supply-gap-batch-02-loop-qa-${DATE}.md`), `# Supply Gap Batch 02 Loop QA

Date: ${DATE}  
Eligible machine-passed source candidates: **${results.length}**.  
Ten-minute loop machine QA: **${report.loopMachinePassCount}/${results.length} passed**.  
Machine-failed sources kept isolated: **${excluded.length}**.

| Candidate | Family | LUFS | Peak | Join RMS | Machine | Review |
| --- | --- | ---: | ---: | ---: | --- | --- |
${results.map((item) => `| ${item.title} | ${item.family} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.seams.maxJoinRmsDeltaDb} | ${item.machineStatus} | [10 分钟试听](http://localhost:5174${item.previewUrl}) |`).join('\n')}

These are candidates only. Source identity, no-human-voice, loop comfort, Recipe V2 combination, and owner promotion approval remain pending.
`);
console.log(JSON.stringify({
  candidateCount: results.length,
  loopMachinePassCount: report.loopMachinePassCount,
  excludedCount: excluded.length,
  report: `reports/supply-gap-batch-02-loop-qa-${DATE}.md`,
}, null, 2));
