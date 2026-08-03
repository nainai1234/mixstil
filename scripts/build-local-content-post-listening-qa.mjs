import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-14';
const sourceReportPath = resolve(ROOT, `reports/local-procedural-content-machine-qa-${DATE}.json`);
const outputDir = resolve(ROOT, `public/audio/music/local-loop-qa/${DATE}`);
const masterDir = resolve(outputDir, 'wav-masters');
const reportJsonPath = resolve(ROOT, `reports/local-procedural-content-post-listening-qa-${DATE}.json`);
const force = process.argv.includes('--force');
const python = resolve(ROOT, '.venv-audio/bin/python');
const loopBuilder = resolve(ROOT, 'scripts/build-loop-qa.py');
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');
const seamAnalyzer = resolve(ROOT, 'scripts/analyze-loop-seams.py');
const sourceReport = JSON.parse(readFileSync(sourceReportPath, 'utf8'));

mkdirSync(masterDir, { recursive: true });

const run = (command, args, capture = false) => {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) throw new Error(`${basename(command)} failed: ${result.stderr || result.stdout || result.error}`);
  return result.stdout ?? '';
};

const results = [];
for (const candidate of sourceReport.results) {
  if (candidate.machineStatus !== 'pass') throw new Error(`${candidate.id} did not pass the prerequisite machine QA`);
  const source = resolve(ROOT, candidate.wavPath);
  const master = resolve(masterDir, `${candidate.id}.wav`);
  const mp3 = resolve(outputDir, `${candidate.id}.mp3`);
  if (force || !existsSync(master)) {
    run(python, [loopBuilder, source, master, '--duration', '600', '--crossfade', '2', '--trim-start', '8', '--trim-end', '8', '--output-fade', '4']);
  }
  if (force || !existsSync(mp3)) {
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', master, '-codec:a', 'libmp3lame', '-b:a', '256k', mp3]);
  }
  const analysis = JSON.parse(run(python, [analyzer, master], true));
  const seams = JSON.parse(run(python, [seamAnalyzer, master, '--source-duration', '44', '--crossfade', '2'], true));
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 600) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(seams.digitalSilence100msFrames > 0 ? ['digital_dropout'] : []),
    ...(seams.maxJoinRmsDeltaDb > 1.5 ? ['loop_join_rms'] : []),
  ];
  results.push({
    id: candidate.id,
    basicListening: {
      status: 'pass',
      reviewedBy: 'project_owner',
      reviewedOn: DATE,
      scope: '60_second_preview_sound_fit',
    },
    loop: {
      durationSeconds: 600,
      crossfadeSeconds: 2,
      sourceTrimSeconds: { start: 8, end: 8 },
      outputFadeSeconds: 4,
      masterPath: master.slice(ROOT.length + 1),
      previewPath: mp3.slice(ROOT.length + 1),
      previewUrl: `/audio/music/local-loop-qa/${DATE}/${candidate.id}.mp3`,
      analysis,
      seams,
      machineStatus: failures.length ? 'fail' : 'pass',
      failures,
      humanListeningStatus: 'pending',
    },
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  batchId: sourceReport.batchId,
  promotionAllowed: false,
  candidateStatus: 'candidate',
  basicListeningPassCount: results.filter((item) => item.basicListening.status === 'pass').length,
  loopMachinePassCount: results.filter((item) => item.loop.machineStatus === 'pass').length,
  remainingGates: ['loop_human_listening', 'recipe_v2_combination_machine_qa', 'recipe_v2_combination_human_listening'],
  results,
};
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  report: reportJsonPath.slice(ROOT.length + 1),
  basicListeningPassCount: report.basicListeningPassCount,
  loopMachinePassCount: report.loopMachinePassCount,
}, null, 2));
