import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CommandResult = {
  id: string;
  command: string;
  status: 'passed' | 'failed';
  durationMs: number;
  summary: string;
};

const root = process.cwd();
const codeOnly = process.argv.includes('--code-only') || process.argv.includes('--skip-device-gates');

const summarize = (output: string) => output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(-6)
  .join(' | ')
  .slice(0, 900);

const run = (id: string, command: string) => new Promise<CommandResult>((resolve) => {
  const startedAt = Date.now();
  const child = spawn(command, {
    cwd: root,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => { output += String(chunk); });
  child.stderr?.on('data', (chunk) => { output += String(chunk); });
  child.on('close', (code) => resolve({
    id,
    command,
    status: code === 0 ? 'passed' : 'failed',
    durationMs: Date.now() - startedAt,
    summary: summarize(output) || `Exited with status ${code ?? 'unknown'}`,
  }));
});

const requiredCodeContracts: Array<[string, string]> = [
  ['media-session', 'pnpm validate:media-session-contract'],
  ['playback-recovery', 'pnpm validate:playback-recovery-contract'],
  ['interruption-recovery', 'pnpm validate:playback-interruption-contract'],
  ['long-session-scheduler', 'pnpm validate:long-session-playback-contract'],
  ['checkpoint-telemetry', 'pnpm validate:playback-checkpoint-contract'],
  ['native-mobile-playback', 'pnpm validate:native-mobile-playback-contract'],
  ['mobile-qa-workbench', 'pnpm validate:mobile-playback-qa-workbench'],
  ['sprint1-code-readiness-docs', 'pnpm validate:sprint1-code-readiness'],
];

const results: CommandResult[] = [];
for (const [id, command] of requiredCodeContracts) {
  const result = await run(id, command);
  results.push(result);
  console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${id} (${result.durationMs} ms)`);
  if (result.status === 'failed') break;
}

const deviceQa = await readFile(path.join(root, 'docs/mobile-playback-device-qa.md'), 'utf8');
const distributionReadiness = await readFile(path.join(root, 'docs/mobile-distribution-readiness.md'), 'utf8');

const requiredEvidenceSnippets = [
  ['iOS 30 pass', '| iOS 30 |', 'passed'],
  ['iOS 60 pass', '| iOS 60 |', 'passed'],
  ['iOS 90 pass', '| iOS 90 |', 'passed'],
  ['iOS 120 pass', '| iOS 120 |', 'passed'],
  ['Android 30 pending row', '| Android 30 |', 'pending'],
  ['Android 60 partial row', '| Android 60 |', 'partial'],
  ['Android 90 pending row', '| Android 90 |', 'pending'],
  ['Android 120 pending row', '| Android 120 |', 'pending'],
] as const;

const evidenceRows = requiredEvidenceSnippets.map(([label, rowNeedle, statusNeedle]) => {
  const line = deviceQa.split('\n').find((candidate) => candidate.includes(rowNeedle)) ?? '';
  return {
    label,
    status: line.includes(statusNeedle) ? 'recognized' : 'missing',
    evidence: line.trim() || `Missing row containing ${rowNeedle}`,
  };
});

const releaseBlockers = [
  'Android 30/90/120 installed-device rows are not complete.',
  'Android 60 still requires owner confirmation of uninterrupted audible output',
  'Android headphone or Bluetooth-change recovery remains unverified.',
].filter((needle) => distributionReadiness.includes(needle) || deviceQa.includes(needle));

const codePassed = results.length === requiredCodeContracts.length
  && results.every((result) => result.status === 'passed');
const deviceEvidenceParsed = evidenceRows.every((row) => row.status === 'recognized');
const androidRowsComplete = !deviceQa.includes('| Android 30 |') || !deviceQa.includes('pending')
  ? releaseBlockers.length === 0
  : false;
const releaseApproved = !codeOnly && codePassed && deviceEvidenceParsed && androidRowsComplete && releaseBlockers.length === 0;
const verdict = codeOnly
  ? (codePassed ? 'GO' : 'NO-GO')
  : releaseApproved ? 'GO' : 'NO-GO';
const timestamp = new Date().toISOString();
const stamp = timestamp.replace(/[:.]/g, '-');
const report = {
  generatedAt: timestamp,
  sprint: 'Sprint 1 mobile playback reliability',
  mode: codeOnly ? 'code-only-device-gates-deferred' : 'release-gate',
  verdict,
  codePassed,
  releaseApproved,
  deviceEvidenceParsed,
  codeContracts: results,
  physicalDeviceEvidence: evidenceRows,
  releaseBlockers,
  deferredDeviceGates: codeOnly ? releaseBlockers : [],
  decisionRule: codeOnly
    ? 'Code-only mode permits continuing later implementation work while keeping physical-device mobile playback gates deferred and releaseApproved false.'
    : 'Code contract pass means implementation is QA-ready. Release approval requires every iOS and Android physical-device row, interruption check, lock-screen control check, checkpoint, and audible-continuity observation to pass.',
};

await mkdir(path.join(root, 'reports'), { recursive: true });
const reportPath = path.join(root, 'reports', `sprint1-mobile-playback-release-gate-${stamp}.md`);
const reportJsonPath = path.join(root, 'reports', `sprint1-mobile-playback-release-gate-${stamp}.json`);
const codeRows = results.map((item) => `| ${item.id} | ${item.status} | ${item.durationMs} | ${item.summary.replace(/\|/g, '\\|')} |`).join('\n');
const evidenceMarkdownRows = evidenceRows.map((item) => `| ${item.label} | ${item.status} | ${item.evidence.replace(/\|/g, '\\|')} |`).join('\n');
const blockerRows = releaseBlockers.length
  ? releaseBlockers.map((item) => `- ${item}`).join('\n')
  : '- None.';
const markdown = `# Sprint 1 Mobile Playback Release Gate

Generated: ${timestamp}  
Mode: **${report.mode}**  
Verdict: **${verdict}**  
Code passed: **${codePassed ? 'yes' : 'no'}**  
Release approved: **${releaseApproved ? 'yes' : 'no'}**

## Code Contracts

| Contract | Status | Duration ms | Summary |
| --- | --- | ---: | --- |
${codeRows}

## Physical Device Evidence

| Row | Status | Evidence |
| --- | --- | --- |
${evidenceMarkdownRows}

## Release Blockers

${blockerRows}

## Decision Rule

${report.decisionRule}
`;

await Promise.all([
  writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(reportPath, markdown, 'utf8'),
]);

console.log(JSON.stringify({
  passed: codePassed,
  verdict,
  releaseApproved,
  mode: report.mode,
  releaseBlockers,
  report: path.relative(root, reportPath),
}, null, 2));

if (!codePassed) process.exitCode = 1;
