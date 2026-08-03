import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type OwnerDecision = {
  schemaVersion: string;
  decisionId: string;
  sourceBatchId: string;
  reviewer: string;
  ownerFeedback: string;
  ownerDecision: string;
  scope: string;
  humanListeningResult: string;
  humanPassScope: {
    renderedCoverageCases: number;
    sleepCases: number;
    calmCases: number;
    focusCases: number;
    distinctSelections: number;
    runtimeExternalApiUsed: number;
  };
  formalUsablePromotionAllowed: boolean;
  productionAllowed: boolean;
  quickCreateInternalBaselineAllowed: boolean;
  nextAllowedStage: string;
  mustRemainBlocked: string[];
  acceptedCorrections: string[];
  nextStageRequirements: string[];
  currentEvidence: Record<string, string>;
};

type CoverageManifest = {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  counts: {
    cases: number;
    rendered: number;
    sleep: number;
    calm: number;
    focus: number;
    distinctSelections: number;
    runtimeExternalApiUsed: number;
  };
  results: Array<{ id: string; productionAllowed: boolean; runtimeExternalApiUsed: boolean }>;
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Foundational eligibility coverage render owner decision validation failed: ${message}`);
};

const decisionPath = path.join(root, 'config/foundational-eligibility-coverage-render-v1-owner-decision.json');
const manifestPath = path.join(root, 'public/review/foundational-eligibility-coverage-render-v1/manifest.json');
const reportPath = path.join(root, 'reports/foundational-eligibility-coverage-render-v1-owner-decision.md');

for (const file of [decisionPath, manifestPath, reportPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const decision = JSON.parse(readFileSync(decisionPath, 'utf8')) as OwnerDecision;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CoverageManifest;
const report = readFileSync(reportPath, 'utf8');

if (decision.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (decision.decisionId !== 'foundational-eligibility-coverage-render-v1-owner-decision') fail('unexpected decision id');
if (decision.sourceBatchId !== manifest.batchId) fail('source batch mismatch');
if (decision.reviewer !== 'project_owner') fail('reviewer must be project_owner');
if (decision.ownerFeedback !== '内容没问题。') fail('owner feedback must preserve exact approval text');
if (decision.ownerDecision !== 'passed_for_internal_audible_product_baseline_regression') fail('unexpected owner decision');
if (decision.humanListeningResult !== 'positive_content_pass') fail('unexpected human listening result');
if (!decision.scope.includes('route proof')) fail('scope must keep route-proof framing');

if (manifest.status !== 'coverage_render_review_ready') fail('source manifest is not review ready');
if (manifest.productionAllowed !== false || decision.productionAllowed !== false) fail('production must remain blocked');
if (manifest.formalUsablePromotionAllowed !== false || decision.formalUsablePromotionAllowed !== false) fail('formal usable promotion must remain blocked');
if (decision.quickCreateInternalBaselineAllowed !== true) fail('internal Quick Create baseline should be allowed');
if (decision.nextAllowedStage !== 'consumer_quick_create_internal_baseline_regression') fail('next stage mismatch');

if (decision.humanPassScope.renderedCoverageCases !== manifest.counts.rendered) fail('rendered count mismatch');
if (decision.humanPassScope.sleepCases !== manifest.counts.sleep) fail('sleep count mismatch');
if (decision.humanPassScope.calmCases !== manifest.counts.calm) fail('calm count mismatch');
if (decision.humanPassScope.focusCases !== manifest.counts.focus) fail('focus count mismatch');
if (decision.humanPassScope.distinctSelections !== manifest.counts.distinctSelections) fail('distinct selection count mismatch');
if (decision.humanPassScope.runtimeExternalApiUsed !== manifest.counts.runtimeExternalApiUsed) fail('runtime API count mismatch');

for (const item of manifest.results) {
  if (item.productionAllowed !== false) fail(`${item.id} productionAllowed must remain false`);
  if (item.runtimeExternalApiUsed !== false) fail(`${item.id} must not use runtime external API`);
}

for (const required of [
  'public production routing',
  'formal usable item promotion',
  'medical or healing claims',
  'voice, choir, singing, chanting, or human-like vocal texture',
  'strong drums or beat-forward defaults for Sleep and Calm',
  'water, road, HVAC, or machine-like material in explicit no-water/no-road intents',
  'finished-content or router-proof renders counted as foundational elements',
  'runtime external full-track generation during consumer Quick Create',
]) {
  if (!decision.mustRemainBlocked.includes(required)) fail(`missing blocked boundary: ${required}`);
}

for (const required of [
  'sleep_bedtime_warm_sparse must not collapse into generic white-noise-only output.',
  'sleep_no_music_dark_hush must remain pure soundscape without water, road, HVAC, or music roles.',
  'focus_no_melody_masking must avoid water-like beds and melodic motifs while retaining non-melodic focus support.',
]) {
  if (!decision.acceptedCorrections.includes(required)) fail(`missing accepted correction: ${required}`);
}

for (const required of [
  'run consumer Quick Create regression with the foundational eligibility route enabled',
  'verify exclusions are preserved in generated Recipe V2 plans',
  'verify Sleep, Calm, and Focus outputs remain perceptually distinct',
  'verify rendered-route proofs are not promoted as foundational materials',
  'move only after this into Sprint 1 mobile background and long-session playback gates',
]) {
  if (!decision.nextStageRequirements.includes(required)) fail(`missing next-stage requirement: ${required}`);
}

for (const evidence of Object.values(decision.currentEvidence)) {
  if (!existsSync(path.join(root, evidence))) fail(`missing evidence file ${evidence}`);
}

if (!report.includes('passed_for_internal_audible_product_baseline_regression')) fail('report missing decision');
if (!report.includes('“内容没问题。”')) fail('report missing owner feedback');
if (!report.includes('They must not be counted as foundational elements')) fail('report must preserve foundational boundary');
if (!report.includes('consumer_quick_create_internal_baseline_regression')) fail('report missing next allowed stage');

console.log(JSON.stringify({
  passed: true,
  decisionId: decision.decisionId,
  ownerDecision: decision.ownerDecision,
  humanPassScope: decision.humanPassScope,
  productionAllowed: decision.productionAllowed,
  formalUsablePromotionAllowed: decision.formalUsablePromotionAllowed,
  quickCreateInternalBaselineAllowed: decision.quickCreateInternalBaselineAllowed,
  nextAllowedStage: decision.nextAllowedStage,
}, null, 2));
