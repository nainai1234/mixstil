import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type GateReport = {
  schemaVersion: string;
  gateId: string;
  status: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  requiredApiMode: string;
  contentBaseline: {
    ownerDecision: string;
    consumerQuickCreateRegression: string;
    cases: number;
    distinctSelections: number;
    savedReplayProofs: number;
    runtimeExternalApiUsed: number;
    composerQuickCreateRegression: string;
    composerCases: number;
    composerReadyRenderedMixes: number;
    composerMusicSupported: number;
    composerSupportOnly: number;
    composerSavedReplayProofs: number;
  };
  playbackReadiness: Record<string, any>;
  remainingDeviceGates: string[];
  hardBoundary: string[];
  validations: Array<{ script: string; passed: boolean; output: Record<string, any> }>;
};

const root = process.cwd();
const gateId = 'sprint1-foundational-playback-readiness-v1';
const fail = (message: string): never => {
  throw new Error(`Sprint 1 foundational playback readiness v1 validation failed: ${message}`);
};

const jsonPath = path.join(root, 'reports', `${gateId}.json`);
const mdPath = path.join(root, 'reports', `${gateId}.md`);
if (!existsSync(jsonPath)) fail(`missing ${jsonPath}`);
if (!existsSync(mdPath)) fail(`missing ${mdPath}`);

const report = JSON.parse(readFileSync(jsonPath, 'utf8')) as GateReport;
const markdown = readFileSync(mdPath, 'utf8');

if (report.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (report.gateId !== gateId) fail('gate id mismatch');
if (report.status !== 'code_contracts_passed_physical_device_gates_remaining') fail(`unexpected status ${report.status}`);
if (report.productionAllowed !== false) fail('production must remain blocked');
if (report.formalUsablePromotionAllowed !== false) fail('formal usable promotion must remain blocked');
if (report.requiredApiMode !== 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1') fail('required API mode mismatch');

if (report.contentBaseline.ownerDecision !== 'passed_for_internal_audible_product_baseline_regression') fail('content owner decision mismatch');
if (report.contentBaseline.consumerQuickCreateRegression !== 'passed') fail('consumer Quick Create regression missing');
if (report.contentBaseline.cases !== 4) fail('expected four consumer baseline cases');
if (report.contentBaseline.distinctSelections < 3) fail('foundational selections collapsed');
if (report.contentBaseline.savedReplayProofs !== 1) fail('missing saved replay proof');
if (report.contentBaseline.runtimeExternalApiUsed !== 0) fail('runtime external API was used');
if (report.contentBaseline.composerQuickCreateRegression !== 'passed') fail('composer Quick Create regression missing');
if (report.contentBaseline.composerCases !== 6) fail('expected six composer Quick Create cases');
if (report.contentBaseline.composerReadyRenderedMixes !== 6) fail('expected six composer ready rendered mixes');
if (report.contentBaseline.composerMusicSupported !== 3) fail('expected three music-supported composer cases');
if (report.contentBaseline.composerSupportOnly !== 3) fail('expected three support-only composer cases');
if (report.contentBaseline.composerSavedReplayProofs !== 1) fail('missing composer saved replay proof');

for (const key of [
  'mediaSession',
  'playbackRecovery',
  'interruptionHandling',
  'checkpoints',
  'playbackMetrics',
  'longSessionScheduling',
  'nativeMobileContract',
]) {
  if (report.playbackReadiness[key] !== 'passed') fail(`${key} did not pass`);
}
if (report.playbackReadiness.validationsPassed !== 9) fail('expected nine validation groups');
if (report.playbackReadiness.contractCount < 25) fail('too few surfaced playback contracts');

for (const script of [
  'validate:consumer-quick-create-internal-baseline-regression-v1',
  'validate:composer-quick-create-consumer-chain-v1',
  'validate:media-session-contract',
  'validate:playback-recovery-contract',
  'validate:playback-interruption-contract',
  'validate:playback-checkpoint-contract',
  'validate:playback-metrics',
  'validate:long-session-playback-contract',
  'validate:native-mobile-playback-contract',
]) {
  const item = report.validations.find((entry) => entry.script === script);
  if (!item?.passed) fail(`missing passed validation ${script}`);
}

for (const gate of [
  'background-playback',
  'audio-interruption',
  'long-session',
  'physical-lock-screen-card',
  '30-120-minute-checkpoints',
]) {
  if (!report.remainingDeviceGates.includes(gate)) fail(`missing remaining physical/device gate ${gate}`);
}

for (const boundary of [
  'This gate is code-contract readiness, not real-device approval.',
  'Physical lock-screen card, real audio interruption recovery, and 30/60/90/120 minute device playback remain required.',
  'Production release remains blocked until physical-device gates pass.',
]) {
  if (!report.hardBoundary.includes(boundary)) fail(`missing boundary ${boundary}`);
}

if (!markdown.includes('not physical-device approval')) fail('markdown missing physical-device boundary');
if (!markdown.includes('Production release remains blocked')) fail('markdown missing production block');
if (!markdown.includes('Remaining physical-device gates')) fail('markdown missing remaining gates');
if (!markdown.includes('Composer Quick Create consumer chain')) fail('markdown missing composer Quick Create chain');

console.log(JSON.stringify({
  passed: true,
  gateId,
  status: report.status,
  validationsPassed: report.playbackReadiness.validationsPassed,
  contractCount: report.playbackReadiness.contractCount,
  remainingDeviceGates: report.remainingDeviceGates,
  productionAllowed: report.productionAllowed,
}, null, 2));
