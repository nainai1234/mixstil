import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Goal = 'sleep' | 'calm' | 'focus';
type Instrument = 'piano' | 'guitar' | 'rhodes' | 'bass';

type AdmissionItem = {
  id: string;
  title: string;
  sourceBatchId: string;
  sourceKind: 'instrument_composition_candidate';
  goal: Goal;
  scene: string;
  goals: Goal[];
  instrument: Instrument;
  instrumentSourceId: string;
  compositionPlanId: string;
  role: string;
  tempo: number;
  seed: number;
  audioUrl: string;
  routeTier: 'reserve_candidate';
  admissionStatus: 'controlled_composer_admission_review';
  controlledComposerProofAllowed: true;
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  formalUsable: false;
  machineStatus: string;
  humanListeningStatus: 'pending';
  requiredAdmissionGates: string[];
  allowedUse: 'controlled_composer_admission_proof_only';
  blockedUse: string[];
  admissionNotes: string;
  riskTags: string[];
};

type AdmissionManifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  sourceQueue: string;
  sourceManifest: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  quickCreateRouterAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  hardRules: string[];
  counts: {
    candidates: number;
    controlledComposerProofAllowed: number;
    quickCreateRouterAllowed: number;
    productionAllowed: number;
    publicReleaseAllowed: number;
    formalUsable: number;
    sleep: number;
    calm: number;
    focus: number;
    byInstrument: Record<Instrument, number>;
    byInstrumentSource: Record<string, number>;
  };
  items: AdmissionItem[];
};

type QueueManifest = {
  batchId: string;
  counts: Record<string, number>;
  items: Array<{
    id: string;
    sourceKind: string;
    admissionStatus: string;
    composerAdmissionCandidate: boolean;
    quickCreateRouterAllowed: boolean;
    productionAllowed: boolean;
    publicReleaseAllowed: boolean;
    formalUsable: boolean;
  }>;
};

type SourceManifest = {
  batchId: string;
  candidateCount: number;
  machinePassCount: number;
  byGoal: Record<Goal, number>;
  byInstrumentSource: Record<string, number>;
  candidates: Array<{
    candidateId: string;
    goal: Goal;
    instrument: Instrument;
    instrumentSourceId: string;
    preparedAudioUrl: string;
    machineStatus: string;
    productionAllowed: boolean;
    formalUsable: boolean;
  }>;
};

const root = process.cwd();
const batchId = 'foundational-instrument-composition-admission-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational instrument composition admission v1 validation failed: ${message}`);
};

const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');

for (const file of [reportJsonPath, reportPath, reviewPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(reportJsonPath, 'utf8')) as AdmissionManifest;
if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema');
if (manifest.batchId !== batchId) fail(`unexpected batch id ${manifest.batchId}`);
if (manifest.status !== 'instrument_composition_candidates_ready_for_controlled_composer_admission_review') {
  fail(`unexpected status ${manifest.status}`);
}
if (manifest.productionAllowed || manifest.publicReleaseAllowed || manifest.quickCreateRouterAllowed || manifest.formalUsablePromotionAllowed) {
  fail('manifest-level production/public/router/formal flags must remain blocked');
}

for (const rule of [
  'Controlled composer proof is allowed only inside review/admission artifacts.',
  'No item in this manifest is allowed in consumer Quick Create routing.',
  'No item in this manifest is production, public-release, offline-release, or formal-usable approved.',
  'This step admits candidates to review; it does not modify foundational_recipe_eligibility_map_v1.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.sourceQueue !== 'reports/foundational-reserve-admission-queue-v1.json') fail('unexpected queue source');
if (manifest.sourceManifest !== 'public/audio/music/local-review/instrument-composition-expansion-batch-v1/manifest.json') {
  fail('unexpected source manifest path');
}

const queuePath = path.join(root, manifest.sourceQueue);
const sourcePath = path.join(root, manifest.sourceManifest);
if (!existsSync(queuePath)) fail('reserve queue source is missing');
if (!existsSync(sourcePath)) fail('instrument source manifest is missing');

const queue = JSON.parse(readFileSync(queuePath, 'utf8')) as QueueManifest;
const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceManifest;
if (queue.batchId !== 'foundational-reserve-admission-queue-v1') fail('queue source has unexpected batch id');
if (queue.counts.instrumentCompositionCandidates !== 30) fail('queue source instrument count mismatch');
if (source.batchId !== 'instrument-composition-expansion-batch-v1') fail('source manifest has unexpected batch id');
if (source.candidateCount !== 30 || source.machinePassCount !== 30) fail('source manifest candidate or machine-pass count mismatch');

const queueIds = new Set(
  queue.items
    .filter((item) =>
      item.sourceKind === 'instrument_composition_candidate'
      && item.admissionStatus === 'ready_for_composer_admission_review'
      && item.composerAdmissionCandidate
      && !item.quickCreateRouterAllowed
      && !item.productionAllowed
      && !item.publicReleaseAllowed
      && !item.formalUsable,
    )
    .map((item) => item.id),
);
const sourceById = new Map(source.candidates.map((candidate) => [candidate.candidateId, candidate]));

if (manifest.items.length !== 30) fail(`expected 30 items, got ${manifest.items.length}`);
if (manifest.counts.candidates !== 30) fail('candidate count mismatch');
if (manifest.counts.controlledComposerProofAllowed !== 30) fail('controlled proof count mismatch');
if (manifest.counts.quickCreateRouterAllowed !== 0) fail('Quick Create allowed count must be zero');
if (manifest.counts.productionAllowed !== 0 || manifest.counts.publicReleaseAllowed !== 0 || manifest.counts.formalUsable !== 0) {
  fail('production/public/formal counts must remain zero');
}
if (manifest.counts.sleep !== 8 || manifest.counts.calm !== 14 || manifest.counts.focus !== 8) {
  fail('goal distribution must be sleep 8, calm 14, focus 8');
}
if (
  manifest.counts.byInstrument.piano !== 12
  || manifest.counts.byInstrument.guitar !== 6
  || manifest.counts.byInstrument.rhodes !== 6
  || manifest.counts.byInstrument.bass !== 6
) {
  fail('instrument distribution must be piano 12, guitar 6, rhodes 6, bass 6');
}
if (
  manifest.counts.byInstrumentSource.vcsl_kawai_soft_piano !== 12
  || manifest.counts.byInstrumentSource.discord_cc0_guitar !== 6
  || manifest.counts.byInstrumentSource.discord_cc0_rhodes !== 6
  || manifest.counts.byInstrumentSource.discord_cc0_bass !== 6
) {
  fail('instrument source distribution mismatch');
}

const requiredGates = [
  'item_level_human_listening',
  'fatigue_review',
  'recipe_combination_qa',
  'explicit_exclusion_mapping',
  'no_public_release',
];
const requiredBlockedUses = [
  'consumer_quick_create_router',
  'production_playback',
  'public_release',
  'offline_release',
  'formal_usable_promotion',
];

const ids = new Set<string>();
for (const item of manifest.items) {
  if (ids.has(item.id)) fail(`duplicate item id ${item.id}`);
  ids.add(item.id);
  if (!queueIds.has(item.id)) fail(`${item.id} is not a valid instrument candidate from reserve queue`);
  const sourceCandidate = sourceById.get(item.id);
  if (!sourceCandidate) fail(`${item.id} is missing from source manifest`);
  if (sourceCandidate.preparedAudioUrl !== item.audioUrl) fail(`${item.id} audio URL differs from source manifest`);
  if (sourceCandidate.goal !== item.goal) fail(`${item.id} goal differs from source manifest`);
  if (sourceCandidate.instrument !== item.instrument) fail(`${item.id} instrument differs from source manifest`);
  if (sourceCandidate.instrumentSourceId !== item.instrumentSourceId) fail(`${item.id} instrument source differs from source manifest`);
  if (sourceCandidate.machineStatus !== 'pass') fail(`${item.id} source machine status must pass`);
  if (sourceCandidate.productionAllowed || sourceCandidate.formalUsable) fail(`${item.id} source candidate must remain non-production and non-formal`);

  if (item.sourceKind !== 'instrument_composition_candidate') fail(`${item.id} must be an instrument composition candidate`);
  if (item.sourceBatchId !== 'instrument-composition-expansion-batch-v1') fail(`${item.id} unexpected source batch`);
  if (item.routeTier !== 'reserve_candidate') fail(`${item.id} must remain reserve tier`);
  if (item.admissionStatus !== 'controlled_composer_admission_review') fail(`${item.id} unexpected admission status`);
  if (!item.controlledComposerProofAllowed) fail(`${item.id} must allow controlled proof only`);
  if (item.quickCreateRouterAllowed || item.productionAllowed || item.publicReleaseAllowed || item.formalUsable) {
    fail(`${item.id} incorrectly allows router/production/public/formal promotion`);
  }
  if (item.allowedUse !== 'controlled_composer_admission_proof_only') fail(`${item.id} has unexpected allowed use`);
  for (const blockedUse of requiredBlockedUses) {
    if (!item.blockedUse.includes(blockedUse)) fail(`${item.id} missing blocked use ${blockedUse}`);
  }
  if (item.machineStatus !== 'pass') fail(`${item.id} machine status must pass`);
  if (item.humanListeningStatus !== 'pending') fail(`${item.id} human listening status must remain pending`);
  for (const gate of requiredGates) {
    if (!item.requiredAdmissionGates.includes(gate)) fail(`${item.id} missing gate ${gate}`);
  }
  if (!item.riskTags.includes('controlled_proof_only')) fail(`${item.id} missing controlled proof risk tag`);
  if (!item.riskTags.includes('not_quick_create_router_allowed')) fail(`${item.id} missing router-blocked risk tag`);
  if (!item.audioUrl.startsWith('/audio/music/local-review/instrument-composition-expansion-batch-v1/prepared/')) {
    fail(`${item.id} must point at local review prepared audio`);
  }
  if (!existsSync(path.join(root, 'public', item.audioUrl.replace(/^\//, '')))) fail(`${item.id} audio file missing`);
  if (item.audioUrl.includes('composer-result-render-proof-v1') || item.audioUrl.includes('/exports/')) {
    fail(`${item.id} incorrectly references a proof render or export`);
  }
}

const review = readFileSync(reviewPath, 'utf8');
if ((review.match(/<audio /g) ?? []).length !== 30) fail('review must expose 30 audio controls');
if (!review.includes('Quick Create routing remains blocked')) fail('review missing Quick Create blocked boundary');
if (!review.includes('controlled composer proof review')) fail('review missing controlled proof purpose');
if (review.includes('lyria_single_element_reserve')) fail('instrument admission review must not include Lyria reserve items');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('30 local instrument-composition reserve candidates')) fail('report missing admission verdict');
if (!report.includes('consumer router unchanged')) fail('report missing router unchanged boundary');

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  productionAllowed: manifest.productionAllowed,
  quickCreateRouterAllowed: manifest.quickCreateRouterAllowed,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
