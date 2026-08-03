import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type OwnerDecision = {
  schemaVersion: string;
  decisionId: string;
  sourceBatchId: string;
  ownerFeedback: string;
  ownerDecision: string;
  humanListeningResult: string;
  humanPassScope: {
    audioReviewItems: number;
    dspConfigItems: number;
    symbolicRuleItems: number;
    totalReviewItems: number;
  };
  formalUsablePromotionAllowed: boolean;
  productionAllowed: boolean;
  nextAllowedStage: string;
  mustRemainBlocked: string[];
  nextStageRequirements: string[];
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Foundational material complete owner decision validation failed: ${message}`);
};

const decisionPath = path.join(root, 'config/foundational-material-complete-v1-owner-decision.json');
const reportPath = path.join(root, 'reports/foundational-material-complete-v1-owner-decision.md');
const sourceManifestPath = path.join(root, 'public/review/foundational-material-complete-v1/manifest.json');

for (const file of [decisionPath, reportPath, sourceManifestPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const decision = JSON.parse(readFileSync(decisionPath, 'utf8')) as OwnerDecision;
const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8')) as {
  batchId: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  counts: {
    atomicAudioElements: number;
    atomicSymbolicElements: number;
    soothingDeterministicAudioCandidates: number;
    deterministicDspConfigs: number;
    consolidatedReviewItems: number;
  };
};

if (decision.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (decision.decisionId !== 'foundational-material-complete-v1-owner-decision') fail('decision id changed');
if (decision.sourceBatchId !== sourceManifest.batchId) fail('source batch mismatch');
if (decision.ownerDecision !== 'passed_for_recipe_eligibility_mapping') fail(`unexpected owner decision ${decision.ownerDecision}`);
if (decision.humanListeningResult !== 'positive_directional_pass') fail('human listening result must be directional, not production approval');
if (!decision.ownerFeedback.includes('效果都不错')) fail('owner feedback text missing');
if (decision.productionAllowed !== false) fail('owner decision must not allow production');
if (decision.formalUsablePromotionAllowed !== false) fail('owner decision must not allow formal usable promotion');
if (sourceManifest.productionAllowed !== false) fail('source manifest must remain non-production');
if (sourceManifest.formalUsablePromotionAllowed !== false) fail('source manifest must remain non-promoted');
if (decision.nextAllowedStage !== 'foundational_recipe_eligibility_map_v1') fail('next stage mismatch');

const expectedAudio = sourceManifest.counts.atomicAudioElements + sourceManifest.counts.soothingDeterministicAudioCandidates;
if (decision.humanPassScope.audioReviewItems !== expectedAudio) fail(`audio review scope mismatch: ${decision.humanPassScope.audioReviewItems}/${expectedAudio}`);
if (decision.humanPassScope.dspConfigItems !== sourceManifest.counts.deterministicDspConfigs) fail('DSP scope mismatch');
if (decision.humanPassScope.symbolicRuleItems !== sourceManifest.counts.atomicSymbolicElements) fail('symbolic scope mismatch');
if (decision.humanPassScope.totalReviewItems !== sourceManifest.counts.consolidatedReviewItems) fail('total scope mismatch');

for (const required of [
  'public production routing',
  'formal usable item promotion',
  'medical or healing claims',
  'voice, choir, singing, chanting, or human-like vocal texture',
  'drums or beat-forward defaults for Sleep and Calm',
  'finished-content or router-proof renders counted as foundational elements',
]) {
  if (!decision.mustRemainBlocked.includes(required)) fail(`missing blocked boundary: ${required}`);
}

for (const required of [
  'assign recipeRole and defaultGainRange to each eligible audio element',
  'mark support-only materials so noise/air layers do not become foreground identity by default',
  'separate Sleep, Calm, and Focus routing suitability',
  'record hard exclusions such as road-like, pulse-like, voice-like, harsh, or attention-capturing risks',
]) {
  if (!decision.nextStageRequirements.includes(required)) fail(`missing next-stage requirement: ${required}`);
}

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('passed_for_recipe_eligibility_mapping')) fail('report missing decision');
if (!report.includes('does not promote any item into public production routing')) fail('report must keep production boundary');
if (!report.includes('Build `foundational_recipe_eligibility_map_v1`')) fail('report missing next stage');

console.log(JSON.stringify({
  passed: true,
  decisionId: decision.decisionId,
  ownerDecision: decision.ownerDecision,
  humanPassScope: decision.humanPassScope,
  productionAllowed: decision.productionAllowed,
  formalUsablePromotionAllowed: decision.formalUsablePromotionAllowed,
  nextAllowedStage: decision.nextAllowedStage,
}, null, 2));
