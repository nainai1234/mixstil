import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Bundle = {
  bundleId: string;
  goal: 'sleep' | 'calm' | 'focus';
  scene: string;
  selectedAtomicElementIds: string[];
  selectedSymbolicRuleIds: string[];
  schedule: Array<{ elementId: string; start: number; gain: number }>;
  masterAudioPath: string;
  preparedAudioUrl: string;
  reviewAudioSrc: string;
  durationSeconds: number;
  machineStatus: string;
  humanListeningStatus: string;
  productionAllowed: boolean;
  formalUsable: boolean;
  analysis: {
    durationSeconds: number;
    peakDbfs: number;
    humanVoiceProbability: string;
    drumProbability: string;
  };
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  sourceAtomicBatchId: string;
  ownerDecisionSource: string;
  productionAllowed: boolean;
  formalUsableCount: number;
  humanPassCount: number;
  purpose: string;
  hardRules: string[];
  bundleCount: number;
  byGoal: Record<string, number>;
  reviewUrl: string;
  bundles: Bundle[];
};

const root = process.cwd();
const batchId = 'atomic-composer-router-proof-v1';
const fail = (message: string): never => {
  throw new Error(`Atomic composer router proof v1 validation failed: ${message}`);
};

const manifestPath = path.join(root, `public/audio/music/local-review/${batchId}/manifest.json`);
const reviewPath = path.join(root, `public/review/${batchId}/index.html`);
const reportPath = path.join(root, `reports/${batchId}.md`);
const ownerDecisionPath = path.join(root, 'config/atomic-foundation-elements-v1-owner-decision.json');
const atomicManifestPath = path.join(root, 'public/audio/music/local-review/atomic-foundation-elements-v1/manifest.json');

for (const file of [manifestPath, reviewPath, reportPath, ownerDecisionPath, atomicManifestPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const ownerDecision = JSON.parse(readFileSync(ownerDecisionPath, 'utf8')) as {
  ownerDecision: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
};
const atomicManifest = JSON.parse(readFileSync(atomicManifestPath, 'utf8')) as {
  batchId: string;
  audioElements: Array<{ elementId: string }>;
  symbolicElements: Array<{ elementId: string }>;
};

if (ownerDecision.ownerDecision !== 'passed_for_next_stage_router_proof') fail('owner decision does not allow router proof');
if (ownerDecision.productionAllowed !== false) fail('owner decision must not grant production');
if (ownerDecision.formalUsablePromotionAllowed !== false) fail('owner decision must not promote formal usability');
if (atomicManifest.batchId !== 'atomic-foundation-elements-v1') fail('atomic source batch mismatch');

if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.batchId !== batchId) fail(`unexpected batch id ${manifest.batchId}`);
if (manifest.status !== 'atomic_composer_router_proof_pending_human_review') fail(`unexpected status ${manifest.status}`);
if (manifest.sourceAtomicBatchId !== 'atomic-foundation-elements-v1') fail('source atomic batch mismatch');
if (manifest.ownerDecisionSource !== 'config/atomic-foundation-elements-v1-owner-decision.json') fail('owner decision source mismatch');
if (manifest.productionAllowed !== false) fail('router proof must remain productionAllowed=false');
if (manifest.formalUsableCount !== 0) fail('formal usable count must remain 0');
if (manifest.humanPassCount !== 0) fail('human pass count must remain 0 for proof bundles');
if (!manifest.purpose.includes('atomic element selection')) fail('purpose must mention atomic element selection');
if (!manifest.hardRules.some((rule) => rule.includes('not foundational elements'))) fail('hard rules must distinguish proofs from elements');
if (!manifest.hardRules.some((rule) => rule.includes('No voice'))) fail('hard rules must ban voice');
if (!manifest.hardRules.some((rule) => rule.includes('no drums'))) fail('hard rules must ban drums');
if (manifest.bundleCount !== manifest.bundles.length) fail('bundle count mismatch');
if (manifest.bundleCount !== 6) fail(`expected 6 proof bundles, got ${manifest.bundleCount}`);
for (const goal of ['sleep', 'calm', 'focus']) {
  if (manifest.byGoal[goal] !== 2) fail(`expected 2 ${goal} bundles`);
}

const atomicIds = new Set(atomicManifest.audioElements.map((item) => item.elementId));
const symbolicIds = new Set(atomicManifest.symbolicElements.map((item) => item.elementId));
const bundleIds = new Set<string>();
for (const bundle of manifest.bundles) {
  if (bundleIds.has(bundle.bundleId)) fail(`duplicate bundle id ${bundle.bundleId}`);
  bundleIds.add(bundle.bundleId);
  if (!['sleep', 'calm', 'focus'].includes(bundle.goal)) fail(`${bundle.bundleId} unsupported goal`);
  if (bundle.selectedAtomicElementIds.length < 3) fail(`${bundle.bundleId} must select at least 3 atomic audio elements`);
  if (bundle.selectedSymbolicRuleIds.length < 4) fail(`${bundle.bundleId} must expose symbolic rules`);
  for (const elementId of bundle.selectedAtomicElementIds) {
    if (!atomicIds.has(elementId)) fail(`${bundle.bundleId} selected unknown atomic element ${elementId}`);
  }
  for (const ruleId of bundle.selectedSymbolicRuleIds) {
    if (!symbolicIds.has(ruleId)) fail(`${bundle.bundleId} selected unknown symbolic rule ${ruleId}`);
  }
  for (const event of bundle.schedule) {
    if (!bundle.selectedAtomicElementIds.includes(event.elementId)) fail(`${bundle.bundleId} schedules unselected element ${event.elementId}`);
    if (event.start < 0 || event.start >= 60) fail(`${bundle.bundleId} has invalid event start`);
    if (event.gain <= 0 || event.gain > 1) fail(`${bundle.bundleId} has invalid gain`);
  }
  if (bundle.durationSeconds < 58 || bundle.durationSeconds > 62) fail(`${bundle.bundleId} must be a short proof render`);
  if (Math.abs(bundle.durationSeconds - bundle.analysis.durationSeconds) > 0.05) fail(`${bundle.bundleId} duration mismatch`);
  if (bundle.analysis.peakDbfs > -3) fail(`${bundle.bundleId} peak too hot`);
  if (!bundle.analysis.humanVoiceProbability.includes('not_applicable')) fail(`${bundle.bundleId} voice gate not deterministic`);
  if (!bundle.analysis.drumProbability.includes('not_applicable')) fail(`${bundle.bundleId} drum gate not deterministic`);
  if (!['pass', 'review_required'].includes(bundle.machineStatus)) fail(`${bundle.bundleId} invalid machine status`);
  if (bundle.humanListeningStatus !== 'pending') fail(`${bundle.bundleId} must await human listening`);
  if (bundle.productionAllowed !== false) fail(`${bundle.bundleId} must not be production allowed`);
  if (bundle.formalUsable !== false) fail(`${bundle.bundleId} must not be formal usable`);
  if (!bundle.reviewAudioSrc.startsWith('../../audio/')) fail(`${bundle.bundleId} review path must work from file://`);
  if (!existsSync(path.join(root, bundle.masterAudioPath))) fail(`${bundle.bundleId} missing master wav`);
  if (!existsSync(path.join(root, 'public', bundle.preparedAudioUrl.replace(/^\//, '')))) fail(`${bundle.bundleId} missing prepared mp3`);
}

const review = readFileSync(reviewPath, 'utf8');
if (review.includes('src="/audio/')) fail('review page contains absolute audio src; file:// playback would fail');
if ((review.match(/<audio /g) ?? []).length !== manifest.bundleCount) fail('review audio count mismatch');
for (const requiredText of ['不是新的基础元素', '组合证明', 'selectedAtomicElementIds', 'selectedSymbolicRuleIds']) {
  if (!review.includes(requiredText)) fail(`review missing framing text ${requiredText}`);
}

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('atomic_composer_router_proof_generated_human_review_required')) fail('report missing verdict');

console.log(JSON.stringify({
  passed: true,
  batchId: manifest.batchId,
  bundleCount: manifest.bundleCount,
  byGoal: manifest.byGoal,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: manifest.reviewUrl,
}, null, 2));
