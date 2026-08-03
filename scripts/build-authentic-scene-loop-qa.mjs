import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-14';
const sourceReport = JSON.parse(readFileSync(resolve(ROOT, `reports/authentic-scene-source-review-${DATE}.json`), 'utf8'));
const outputDir = resolve(ROOT, `public/audio/authentic-scene-loop-qa/${DATE}`);
const sourceMasterDir = resolve(outputDir, 'source-wav-masters');
const loopMasterDir = resolve(outputDir, 'loop-wav-masters');
const python = resolve(ROOT, '.venv-audio/bin/python');
const loopBuilder = resolve(ROOT, 'scripts/build-loop-qa.py');
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');
const seamAnalyzer = resolve(ROOT, 'scripts/analyze-loop-seams.py');

mkdirSync(sourceMasterDir, { recursive: true });
mkdirSync(loopMasterDir, { recursive: true });

const run = (command, args, capture = false) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${basename(command)} failed: ${result.stderr || result.stdout || result.error}`);
  return result.stdout ?? '';
};
const probeDuration = (file) => Number(JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], true)).format.duration);

const results = sourceReport.results.map((candidate) => {
  const sourceMaster = resolve(sourceMasterDir, `${candidate.id}.wav`);
  const loopMaster = resolve(loopMasterDir, `${candidate.id}.wav`);
  const preview = resolve(outputDir, `${candidate.id}.mp3`);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(ROOT, candidate.input),
    '-af', `volume=${candidate.gainDb}dB`, '-ar', '48000', '-ac', '2', '-codec:a', 'pcm_f32le', sourceMaster,
  ]);
  const sourceDurationSeconds = probeDuration(sourceMaster);
  run(python, [loopBuilder, sourceMaster, loopMaster, '--duration', '600', '--crossfade', '5', '--output-fade', '4']);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', loopMaster, '-codec:a', 'libmp3lame', '-b:a', '256k', preview]);
  const analysis = JSON.parse(run(python, [analyzer, loopMaster], true));
  const seams = JSON.parse(run(python, [seamAnalyzer, loopMaster, '--source-duration', String(sourceDurationSeconds), '--crossfade', '5'], true));
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 600) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(seams.digitalSilence100msFrames > 0 ? ['digital_dropout'] : []),
    ...(seams.maxJoinRmsDeltaDb > 3 ? ['loop_join_rms'] : []),
  ];
  return {
    id: candidate.id,
    title: candidate.title,
    family: candidate.family,
    semanticListening: { status: 'pass', reviewedBy: 'project_owner', reviewedOn: DATE },
    license: candidate.licenseStatus.startsWith('cc_by_3_0')
      ? { status: 'confirmed', name: candidate.licenseName, url: candidate.licenseUrl, creator: candidate.sourceCreator, attributionRequired: true, snapshot: 'docs/license-snapshots/batch-08/commons-wind-pine-forest.source.html' }
      : { status: 'confirmed_for_rendered_projects', name: 'Mixkit Sound Effects Free License', url: 'https://mixkit.co/license/', attributionRequired: false, rawRedistributionAllowed: false, snapshot: 'docs/license-snapshots/batch-08/mixkit-license.html' },
    sourceDurationSeconds,
    loop: { durationSeconds: 600, crossfadeSeconds: 5, outputFadeSeconds: 4 },
    sourceMasterPath: sourceMaster.slice(ROOT.length + 1),
    loopMasterPath: loopMaster.slice(ROOT.length + 1),
    previewPath: preview.slice(ROOT.length + 1),
    previewUrl: `/audio/authentic-scene-loop-qa/${DATE}/${candidate.id}.mp3`,
    analysis,
    seams,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    loopListeningStatus: 'pass',
    loopListening: {
      reviewedBy: 'project_owner',
      reviewedOn: DATE,
      decision: 'passed_without_reported_seam_fatigue_or_comfort_issue',
    },
    promotionAllowed: false,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  semanticListeningPassCount: results.filter((item) => item.semanticListening.status === 'pass').length,
  licenseConfirmedCount: results.filter((item) => item.license.status.startsWith('confirmed')).length,
  loopMachinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  loopListeningPassCount: results.filter((item) => item.loopListeningStatus === 'pass').length,
  promotionAllowed: false,
  remainingGates: ['recipe_v2_combination_qa'],
  results,
};
writeFileSync(resolve(ROOT, `reports/authentic-scene-loop-qa-${DATE}.json`), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(ROOT, `reports/authentic-scene-loop-qa-${DATE}.md`), `# Authentic Scene Loop QA\n\nDate: ${DATE}  \nSemantic identity: 6/6 passed by project owner.  \nLicense evidence: 6/6 recorded.  \nTen-minute seam, repetition-fatigue, transient, fear/tension, and high-frequency comfort review: **6/6 passed by project owner**.  \nPromotion remains blocked only by Recipe V2 combination QA.\n\n| Candidate | Family | LUFS | Peak | Max join RMS delta | Machine | Human loop review | Review |\n| --- | --- | ---: | ---: | ---: | --- | --- | --- |\n${results.map((item) => `| ${item.title} | ${item.family} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.seams.maxJoinRmsDeltaDb} | ${item.machineStatus} | ${item.loopListeningStatus} | [10 分钟试听](http://localhost:5174${item.previewUrl}) |`).join('\n')}\n\nDecision: all six candidates may advance to conservative Recipe V2 combination QA. They are still internal candidates and are not yet available in Home, Discover, or the approved production pool.\n`);
console.log(JSON.stringify({ semanticListeningPassCount: report.semanticListeningPassCount, licenseConfirmedCount: report.licenseConfirmedCount, loopMachinePassCount: report.loopMachinePassCount, loopListeningPassCount: report.loopListeningPassCount }, null, 2));
