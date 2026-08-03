import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = resolve(import.meta.dirname, '..');
const manifestPath = resolve(ROOT, process.argv.find((value) => value.startsWith('--manifest='))?.slice(11)
  ?? 'docs/local-procedural-content-batch-2026-07-14.json');
const force = process.argv.includes('--force');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const outputDir = resolve(ROOT, manifest.outputDirectory);
const reviewDate = manifest.reviewDate ?? '2026-07-14';
const previewDir = resolve(ROOT, manifest.previewDirectory ?? `public/audio/music/local-review/${reviewDate}`);
const reportBaseName = manifest.reportBaseName ?? `local-procedural-content-machine-qa-${reviewDate}`;
const reportJsonPath = resolve(ROOT, `reports/${reportBaseName}.json`);
const reportMarkdownPath = resolve(ROOT, `reports/${reportBaseName}.md`);
const python = resolve(ROOT, manifest.python);
const generator = resolve(ROOT, manifest.generator);
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');

mkdirSync(outputDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });
mkdirSync(dirname(reportJsonPath), { recursive: true });

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${basename(command)} failed: ${result.stderr || result.stdout || result.error}`);
  return result.stdout ?? '';
};
const sha256 = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex');

const results = [];
for (const candidate of manifest.candidates) {
  const wavPath = resolve(outputDir, `${candidate.id}.wav`);
  const mp3Path = resolve(previewDir, `${candidate.id}.mp3`);
  if (force || !existsSync(wavPath)) {
    run(python, [generator, '--profile', candidate.profile, '--seed', String(candidate.seed), '--output', wavPath]);
  }
  const analysis = JSON.parse(run(python, [analyzer, wavPath], { capture: true }));
  const targetLufs = candidate.targetLufs ?? (candidate.profile.startsWith('focus_') ? -25 : -26);
  const failures = [
    ...(Math.abs(analysis.durationSeconds - 60) > 0.05 ? ['duration'] : []),
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(Math.abs(analysis.integratedLufs - targetLufs) > 0.5 ? ['lufs'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
  ];
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '256k', mp3Path]);
  results.push({
    ...candidate,
    wavPath: wavPath.slice(ROOT.length + 1),
    fileSha256: sha256(wavPath),
    previewPath: mp3Path.slice(ROOT.length + 1),
    previewUrl: `/${mp3Path.slice(resolve(ROOT, 'public').length + 1)}`,
    analysis,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    warnings: analysis.interiorSilence100msFrames > 0
      ? ['Fade regions cross the analyzer silence threshold; confirm there is no interior dropout during listening QA.']
      : [],
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  batchId: manifest.batchId,
  generatorSha256: sha256(generator),
  candidateCount: results.length,
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  promotionAllowed: false,
  requiredNextGate: 'human_listening_and_loop_qa',
  results,
};
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

const rows = results.map((item) =>
  `| ${item.id} | ${item.goal}/${item.scene} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.machineStatus} | [试听](http://localhost:5174${item.previewUrl}) |`);
writeFileSync(reportMarkdownPath, `# ${manifest.title ?? 'Local Procedural Content Machine QA'}\n\nDate: ${reviewDate}  \nBatch: \`${manifest.batchId}\`  \nStatus: machine QA only; publication and asset promotion are not allowed.\n\n| Candidate | Target | LUFS | Peak dBFS | Machine | Preview |\n| --- | --- | ---: | ---: | --- | --- |\n${rows.join('\n')}\n\n## Required Next Gate\n\nListen to the opening, full 60 seconds, 30-minute loop, and combinations with the intended Recipe V2 background. Reject fright, pulse, melody hooks, fatigue, clipping, dropouts, or scene mismatch.\n`);

console.log(JSON.stringify({
  batchId: report.batchId,
  candidateCount: report.candidateCount,
  machinePassCount: report.machinePassCount,
  reportJson: reportJsonPath.slice(ROOT.length + 1),
  reportMarkdown: reportMarkdownPath.slice(ROOT.length + 1),
}, null, 2));
