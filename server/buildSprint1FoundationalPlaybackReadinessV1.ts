import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gateId = 'sprint1-foundational-playback-readiness-v1';

type Json = Record<string, any>;

const parseLastJsonObject = (output: string): Json => {
  const trimmed = output.trim();
  const start = trimmed.lastIndexOf('\n{');
  const jsonText = start >= 0 ? trimmed.slice(start + 1) : trimmed.slice(trimmed.indexOf('{'));
  return JSON.parse(jsonText) as Json;
};

const run = (script: string) => {
  const output = execFileSync('pnpm', [script], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      API_BASE: process.env.API_BASE ?? 'http://127.0.0.1:8788',
    },
  });
  const parsed = parseLastJsonObject(output);
  if (parsed.passed !== true) throw new Error(`${script} did not report passed=true`);
  return {
    script,
    passed: true,
    output: parsed,
  };
};

const requiredFiles = [
  'config/foundational-eligibility-coverage-render-v1-owner-decision.json',
  'reports/consumer-quick-create-internal-baseline-regression-v1.json',
  'reports/composer-quick-create-consumer-chain-v1.json',
  'server/validateMediaSessionContract.ts',
  'server/validatePlaybackRecoveryContract.ts',
  'server/validatePlaybackInterruptionContract.ts',
  'server/validatePlaybackCheckpointContract.ts',
  'server/validatePlaybackMetrics.ts',
  'server/validateLongSessionPlaybackContract.ts',
  'server/validateNativeMobilePlaybackContract.ts',
];

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) throw new Error(`missing required file: ${file}`);
}

const ownerDecision = JSON.parse(readFileSync(path.join(root, 'config/foundational-eligibility-coverage-render-v1-owner-decision.json'), 'utf8')) as Json;
if (ownerDecision.ownerDecision !== 'passed_for_internal_audible_product_baseline_regression') {
  throw new Error('foundational coverage owner decision has not passed for internal baseline regression');
}
if (ownerDecision.productionAllowed !== false) throw new Error('owner decision must keep production blocked');

const consumerBaseline = JSON.parse(readFileSync(path.join(root, 'reports/consumer-quick-create-internal-baseline-regression-v1.json'), 'utf8')) as Json;
if (consumerBaseline.status !== 'passed') throw new Error('consumer Quick Create internal baseline regression is not passed');
if (consumerBaseline.counts?.runtimeExternalApiUsed !== 0) throw new Error('consumer baseline used runtime external API');
if (consumerBaseline.counts?.savedReplayProofs !== 1) throw new Error('consumer baseline lacks saved replay proof');

const composerQuickCreate = JSON.parse(readFileSync(path.join(root, 'reports/composer-quick-create-consumer-chain-v1.json'), 'utf8')) as Json;
if (composerQuickCreate.status !== 'passed') throw new Error('composer Quick Create consumer chain is not passed');
if (composerQuickCreate.counts?.cases !== 6) throw new Error('composer Quick Create must cover six proof cases');
if (composerQuickCreate.counts?.readyRenderedMixes !== 6) throw new Error('composer Quick Create did not return six ready rendered mixes');
if (composerQuickCreate.counts?.savedReplayProofs !== 1) throw new Error('composer Quick Create lacks saved replay proof');
if (composerQuickCreate.productionAllowed !== false) throw new Error('composer Quick Create must keep production blocked');

const validations = [
  run('validate:consumer-quick-create-internal-baseline-regression-v1'),
  run('validate:composer-quick-create-consumer-chain-v1'),
  run('validate:media-session-contract'),
  run('validate:playback-recovery-contract'),
  run('validate:playback-interruption-contract'),
  run('validate:playback-checkpoint-contract'),
  run('validate:playback-metrics'),
  run('validate:long-session-playback-contract'),
  run('validate:native-mobile-playback-contract'),
];

const remainingDeviceGates = [...new Set(validations.flatMap((item) => item.output.remainingDeviceGates ?? []))];
const contractCount = validations.reduce((sum, item) => sum + (Array.isArray(item.output.contracts) ? item.output.contracts.length : 0), 0);

const report = {
  schemaVersion: '1.0.0',
  gateId,
  generatedAt: new Date().toISOString(),
  status: 'code_contracts_passed_physical_device_gates_remaining',
  productionAllowed: false,
  formalUsablePromotionAllowed: false,
  requiredApiMode: 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1',
  contentBaseline: {
    ownerDecision: ownerDecision.ownerDecision,
    consumerQuickCreateRegression: consumerBaseline.status,
    cases: consumerBaseline.counts.cases,
    distinctSelections: consumerBaseline.counts.distinctSelections,
    savedReplayProofs: consumerBaseline.counts.savedReplayProofs,
    runtimeExternalApiUsed: consumerBaseline.counts.runtimeExternalApiUsed,
    composerQuickCreateRegression: composerQuickCreate.status,
    composerCases: composerQuickCreate.counts.cases,
    composerReadyRenderedMixes: composerQuickCreate.counts.readyRenderedMixes,
    composerMusicSupported: composerQuickCreate.counts.musicSupported,
    composerSupportOnly: composerQuickCreate.counts.supportOnly,
    composerSavedReplayProofs: composerQuickCreate.counts.savedReplayProofs,
  },
  playbackReadiness: {
    validationsPassed: validations.length,
    contractCount,
    mediaSession: 'passed',
    playbackRecovery: 'passed',
    interruptionHandling: 'passed',
    checkpoints: 'passed',
    playbackMetrics: 'passed',
    longSessionScheduling: 'passed',
    nativeMobileContract: 'passed',
  },
  remainingDeviceGates,
  hardBoundary: [
    'This gate is code-contract readiness, not real-device approval.',
    'Physical lock-screen card, real audio interruption recovery, and 30/60/90/120 minute device playback remain required.',
    'Production release remains blocked until physical-device gates pass.',
  ],
  validations,
};

await mkdir(path.join(root, 'reports'), { recursive: true });
await writeFile(path.join(root, 'reports', `${gateId}.json`), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(root, 'reports', `${gateId}.md`), `# Sprint 1 Foundational Playback Readiness V1

Generated: ${report.generatedAt}

Status: \`${report.status}\`

## Verdict

The owner-approved foundational audio baseline now passes the consumer Quick
Create regression and all current Sprint 1 playback code contracts.

This is code-contract readiness only. It is not physical-device approval and it
does not allow production release.

## Content baseline carried into playback

| Metric | Value |
| --- | ---: |
| Quick Create cases | ${report.contentBaseline.cases} |
| Distinct foundational selections | ${report.contentBaseline.distinctSelections} |
| Saved replay proofs | ${report.contentBaseline.savedReplayProofs} |
| Runtime external API used | ${report.contentBaseline.runtimeExternalApiUsed} |
| Composer Quick Create cases | ${report.contentBaseline.composerCases} |
| Composer ready rendered mixes | ${report.contentBaseline.composerReadyRenderedMixes} |
| Composer music-supported cases | ${report.contentBaseline.composerMusicSupported} |
| Composer support-only cases | ${report.contentBaseline.composerSupportOnly} |
| Composer saved replay proofs | ${report.contentBaseline.composerSavedReplayProofs} |

## Playback contracts passed

| Contract group | Status |
| --- | --- |
| Consumer Quick Create internal baseline regression | passed |
| Composer Quick Create consumer chain | passed |
| Media Session controls | passed |
| Playback recovery | passed |
| Interruption handling | passed |
| Playback checkpoints | passed |
| Playback metrics | passed |
| Long-session scheduling | passed |
| Native mobile playback contract | passed |

Total contract assertions surfaced by validators: ${contractCount}

## Remaining physical-device gates

${remainingDeviceGates.map((gate) => `- ${gate}`).join('\n')}

## Boundary

- This gate is code-contract readiness, not real-device approval.
- Physical lock-screen card, real audio interruption recovery, and 30/60/90/120
  minute device playback remain required.
- Production release remains blocked until physical-device gates pass.
`);

console.log(JSON.stringify({
  passed: true,
  gateId,
  status: report.status,
  validationsPassed: validations.length,
  contractCount,
  remainingDeviceGates,
  productionAllowed: report.productionAllowed,
  reportPath: `reports/${gateId}.md`,
  jsonReportPath: `reports/${gateId}.json`,
}, null, 2));
