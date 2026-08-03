import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type AdmissionItem = {
  id: string;
  sourceKind: 'instrument_composition_candidate' | 'lyria_single_element_reserve';
  sourceBatchId: string;
  role: string;
  goals: Array<'sleep' | 'calm' | 'focus'>;
  audioUrl: string;
  routeTier: 'reserve_candidate';
  admissionStatus: 'ready_for_composer_admission_review' | 'requires_identity_voice_review';
  composerAdmissionCandidate: boolean;
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  formalUsable: false;
  machineStatus: string;
  humanListeningStatus: 'pending';
  requiredGates: string[];
  routeCandidateRole: string;
  admissionNotes: string;
  riskTags: string[];
};

type AdmissionManifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  quickCreateRouterAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  sourceCompletion: string;
  hardRules: string[];
  counts: Record<string, number>;
  items: AdmissionItem[];
};

type CompletionManifest = {
  batchId: string;
  counts: Record<string, number>;
  items: Array<{ id: string; routeTier: string; sourceKind: string }>;
};

const root = process.cwd();
const batchId = 'foundational-reserve-admission-queue-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational reserve admission queue v1 validation failed: ${message}`);
};

const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
for (const file of [reportJsonPath, reportPath, reviewPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(reportJsonPath, 'utf8')) as AdmissionManifest;
if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema');
if (manifest.batchId !== batchId) fail('unexpected batch id');
if (manifest.status !== 'reserve_candidates_triaged_for_composer_admission') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed || manifest.publicReleaseAllowed || manifest.quickCreateRouterAllowed || manifest.formalUsablePromotionAllowed) {
  fail('production/public/router/formal promotion must remain blocked');
}

for (const rule of [
  'No reserve candidate is added to foundational_recipe_eligibility_map_v1 by this step.',
  'No reserve candidate is allowed in Quick Create routing until all listed gates pass.',
  'This queue is not a production, public release, or formal-usable promotion.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.sourceCompletion !== 'reports/foundational-audio-element-completion-v1.json') fail('unexpected completion source');
const completionPath = path.join(root, manifest.sourceCompletion);
if (!existsSync(completionPath)) fail('completion source is missing');
const completion = JSON.parse(readFileSync(completionPath, 'utf8')) as CompletionManifest;
if (completion.batchId !== 'foundational-audio-element-completion-v1') fail('completion source has unexpected batch id');
if (completion.counts.reserveCandidates !== 35) fail('completion source reserve count mismatch');

const completionReserveIds = new Set(
  completion.items
    .filter((item) => item.routeTier === 'reserve_candidate')
    .map((item) => item.id),
);

if (manifest.items.length !== 35) fail(`expected 35 admission items, got ${manifest.items.length}`);
if (manifest.counts.reserveCandidates !== 35) fail('reserve count mismatch');
if (manifest.counts.instrumentCompositionCandidates !== 30) fail('instrument composition count mismatch');
if (manifest.counts.lyriaSingleElementCandidates !== 5) fail('Lyria reserve count mismatch');
if (manifest.counts.readyForComposerAdmissionReview !== 30) fail('ready-for-review count mismatch');
if (manifest.counts.requiresIdentityVoiceReview !== 5) fail('identity/voice hold count mismatch');
if (manifest.counts.composerAdmissionCandidates !== 30) fail('composer admission candidate count mismatch');
if (manifest.counts.quickCreateRouterAllowed !== 0 || manifest.counts.productionAllowed !== 0 || manifest.counts.publicReleaseAllowed !== 0 || manifest.counts.formalUsable !== 0) {
  fail('no reserve item can be router/production/public/formal usable');
}

const ids = new Set<string>();
for (const item of manifest.items) {
  if (ids.has(item.id)) fail(`duplicate item id ${item.id}`);
  ids.add(item.id);
  if (!completionReserveIds.has(item.id)) fail(`${item.id} is not from completion reserve source`);
  if (item.routeTier !== 'reserve_candidate') fail(`${item.id} must remain reserve tier`);
  if (item.quickCreateRouterAllowed || item.productionAllowed || item.publicReleaseAllowed || item.formalUsable) {
    fail(`${item.id} incorrectly allows router/production/public/formal promotion`);
  }
  if (item.humanListeningStatus !== 'pending') fail(`${item.id} must remain pending human listening`);
  if (item.machineStatus !== 'pass') fail(`${item.id} must be machine-pass before admission queue`);
  if (!item.audioUrl.startsWith('/audio/')) fail(`${item.id} audio URL must be local public audio`);
  if (!existsSync(path.join(root, 'public', item.audioUrl.replace(/^\//, '')))) fail(`${item.id} audio file missing`);
  if (item.audioUrl.includes('composer-result-render-proof-v1') || item.audioUrl.includes('atomic-composer-router-proof-v1')) {
    fail(`${item.id} incorrectly counts a proof render`);
  }
  if (item.audioUrl.includes('/content-baseline/') || item.audioUrl.includes('/exports/')) {
    fail(`${item.id} incorrectly counts finished content/export audio`);
  }
  if (!item.riskTags.includes('reserve_admission_queue_only')) fail(`${item.id} missing queue-only risk tag`);
  if (!item.requiredGates.includes('item_level_human_listening')) fail(`${item.id} missing listening gate`);
  if (!item.requiredGates.includes('recipe_combination_qa')) fail(`${item.id} missing combination QA gate`);

  if (item.sourceKind === 'instrument_composition_candidate') {
    if (item.admissionStatus !== 'ready_for_composer_admission_review') fail(`${item.id} should be ready for composer admission review`);
    if (!item.composerAdmissionCandidate) fail(`${item.id} should be a composer admission candidate`);
    if (!item.requiredGates.includes('no_public_release')) fail(`${item.id} missing no-public-release gate`);
  }
  if (item.sourceKind === 'lyria_single_element_reserve') {
    if (item.admissionStatus !== 'requires_identity_voice_review') fail(`${item.id} should require identity/voice review`);
    if (item.composerAdmissionCandidate) fail(`${item.id} should not be a composer admission candidate yet`);
    if (!item.requiredGates.includes('human_identity_review')) fail(`${item.id} missing identity review gate`);
    if (!item.requiredGates.includes('human_voice_free_review')) fail(`${item.id} missing voice-free review gate`);
  }
}

const review = readFileSync(reviewPath, 'utf8');
if ((review.match(/<audio /g) ?? []).length !== 35) fail('review must expose 35 audio controls');
if (!review.includes('Quick Create routing remains blocked')) fail('review missing router block boundary');
if (review.includes('composer-result-render-proof-v1')) fail('review must not count composer proof renders');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('35 foundational reserve audio candidates')) fail('report missing reserve queue verdict');
if (!report.includes('No reserve candidate is promoted')) fail('report missing promotion boundary');

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  productionAllowed: manifest.productionAllowed,
  quickCreateRouterAllowed: manifest.quickCreateRouterAllowed,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
