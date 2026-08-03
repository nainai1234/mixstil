import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type Goal = 'sleep' | 'calm' | 'focus';
type Instrument = 'piano' | 'guitar' | 'rhodes' | 'bass';

type ProofCase = {
  id: string;
  label: string;
  prompt: string;
  goal: Goal;
  scene: string;
  admissionStatus: 'controlled_composer_combination_proof';
  proofAllowed: true;
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  formalUsable: false;
  renderedMixAllowed: false;
  instrumentLayer: {
    id: string;
    instrument: Instrument;
    compositionPlanId: string;
    audioUrl: string;
    routeTier: 'reserve_candidate';
    humanListeningStatus: 'pending';
    productionAllowed: false;
    formalUsable: false;
  };
  supportLayers: Array<{
    id: string;
    recipeRole: string;
    sourceKind: string;
    sourceBatchId: string;
    goalSuitability: 'primary' | 'secondary';
    routeStatus: string;
    audioUrl: string;
    productionAllowed: false;
    formalUsable: false;
  }>;
  requiredProofGates: string[];
  blockedUse: string[];
  reviewNotes: string[];
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  sourceAdmission: string;
  sourceEligibilityMap: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  quickCreateRouterAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  renderedMixesProduced: boolean;
  hardRules: string[];
  counts: {
    cases: number;
    instrumentLayers: number;
    supportLayers: number;
    audioControls: number;
    quickCreateRouterAllowed: number;
    productionAllowed: number;
    publicReleaseAllowed: number;
    formalUsable: number;
    renderedMixAllowed: number;
    byGoal: Record<Goal, number>;
    byInstrument: Record<Instrument, number>;
  };
  cases: ProofCase[];
  reviewUrl: string;
};

type AdmissionManifest = {
  batchId: string;
  items: Array<{
    id: string;
    goal: Goal;
    instrument: Instrument;
    audioUrl: string;
    controlledComposerProofAllowed: boolean;
    quickCreateRouterAllowed: boolean;
    productionAllowed: boolean;
    publicReleaseAllowed: boolean;
    formalUsable: boolean;
  }>;
};

type EligibilityManifest = {
  mapId: string;
  eligibilities: Array<{
    id: string;
    recipeRole: string;
    goalSuitability: Record<Goal, 'primary' | 'secondary' | 'avoid'>;
    audioUrl?: string;
    productionAllowed: boolean;
    formalUsable: boolean;
  }>;
};

const root = process.cwd();
const batchId = 'foundational-instrument-composer-admission-proof-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational instrument composer admission proof v1 validation failed: ${message}`);
};

const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');

for (const file of [reportJsonPath, reportPath, reviewPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(reportJsonPath, 'utf8')) as Manifest;
if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.batchId !== batchId) fail(`unexpected batch id ${manifest.batchId}`);
if (manifest.status !== 'controlled_instrument_composer_admission_proof_ready') fail(`unexpected status ${manifest.status}`);
if (manifest.sourceAdmission !== 'reports/foundational-instrument-composition-admission-v1.json') fail('unexpected admission source');
if (manifest.sourceEligibilityMap !== 'reports/foundational-recipe-eligibility-map-v1.json') fail('unexpected eligibility map source');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('unexpected review URL');
if (
  manifest.productionAllowed
  || manifest.publicReleaseAllowed
  || manifest.quickCreateRouterAllowed
  || manifest.formalUsablePromotionAllowed
  || manifest.renderedMixesProduced
) {
  fail('manifest-level promotion/render flags must remain blocked');
}

for (const rule of [
  'This proof does not promote reserve instrument candidates to consumer Quick Create.',
  'This proof does not promote any ingredient to production, public release, offline release, or formal usable.',
  'This proof is combination QA, not finished-render evidence.',
  'Every case uses exactly one admitted instrument candidate and three already mapped support ingredients.',
  'No Lyria single-element reserve item may be used.',
  'The consumer is never asked to choose these materials.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.cases.length !== 6 || manifest.counts.cases !== 6) fail('expected six proof cases');
if (manifest.counts.instrumentLayers !== 6) fail('expected six instrument layers');
if (manifest.counts.supportLayers !== 18) fail('expected eighteen support layers');
if (manifest.counts.audioControls !== 24) fail('expected twenty-four audio controls');
if (
  manifest.counts.quickCreateRouterAllowed !== 0
  || manifest.counts.productionAllowed !== 0
  || manifest.counts.publicReleaseAllowed !== 0
  || manifest.counts.formalUsable !== 0
  || manifest.counts.renderedMixAllowed !== 0
) {
  fail('case-level promotion/render counts must remain zero');
}
if (manifest.counts.byGoal.sleep !== 2 || manifest.counts.byGoal.calm !== 2 || manifest.counts.byGoal.focus !== 2) {
  fail('goal distribution must be 2/2/2');
}
if (
  manifest.counts.byInstrument.piano !== 2
  || manifest.counts.byInstrument.guitar !== 1
  || manifest.counts.byInstrument.rhodes !== 1
  || manifest.counts.byInstrument.bass !== 2
) {
  fail('instrument distribution must be piano 2, guitar 1, rhodes 1, bass 2');
}

const admissionPath = path.join(root, manifest.sourceAdmission);
const eligibilityPath = path.join(root, manifest.sourceEligibilityMap);
if (!existsSync(admissionPath)) fail('source admission manifest missing');
if (!existsSync(eligibilityPath)) fail('source eligibility map missing');

const admission = JSON.parse(readFileSync(admissionPath, 'utf8')) as AdmissionManifest;
const eligibility = JSON.parse(readFileSync(eligibilityPath, 'utf8')) as EligibilityManifest;
if (admission.batchId !== 'foundational-instrument-composition-admission-v1') fail('unexpected source admission batch');
if (eligibility.mapId !== 'foundational_recipe_eligibility_map_v1') fail('unexpected source eligibility map');

const admittedById = new Map(admission.items.map((item) => [item.id, item]));
const eligibilityById = new Map(eligibility.eligibilities.map((item) => [item.id, item]));
const requiredGates = [
  'ingredient_level_audio_check',
  'composer_combination_listening',
  'fatigue_review',
  'explicit_exclusion_mapping',
  'no_quick_create_router_promotion',
];
const requiredBlockedUses = [
  'consumer_quick_create_router',
  'production_playback',
  'public_release',
  'offline_release',
  'formal_usable_promotion',
  'finished_render_counting',
];
const allowedSupportRoles = new Set(['environment_identity_bed', 'organic_texture', 'accent_transition']);
const caseIds = new Set<string>();
const instrumentIds = new Set<string>();

for (const item of manifest.cases) {
  if (caseIds.has(item.id)) fail(`duplicate case id ${item.id}`);
  caseIds.add(item.id);
  if (!item.label || !item.prompt) fail(`${item.id}: missing label or prompt`);
  if (item.admissionStatus !== 'controlled_composer_combination_proof') fail(`${item.id}: unexpected admission status`);
  if (!item.proofAllowed) fail(`${item.id}: proof must be allowed`);
  if (
    item.quickCreateRouterAllowed
    || item.productionAllowed
    || item.publicReleaseAllowed
    || item.formalUsable
    || item.renderedMixAllowed
  ) {
    fail(`${item.id}: promotion/render flags must remain false`);
  }

  for (const gate of requiredGates) {
    if (!item.requiredProofGates.includes(gate)) fail(`${item.id}: missing proof gate ${gate}`);
  }
  for (const blockedUse of requiredBlockedUses) {
    if (!item.blockedUse.includes(blockedUse)) fail(`${item.id}: missing blocked use ${blockedUse}`);
  }
  if (!item.reviewNotes.join(' ').includes('consumer is not asked to select materials')) {
    fail(`${item.id}: missing consumer material-choice boundary`);
  }

  if (instrumentIds.has(item.instrumentLayer.id)) fail(`${item.id}: instrument candidate reused`);
  instrumentIds.add(item.instrumentLayer.id);
  const admitted = admittedById.get(item.instrumentLayer.id);
  if (!admitted) fail(`${item.id}: instrument is not from admission manifest`);
  if (admitted.goal !== item.goal) fail(`${item.id}: admitted instrument goal mismatch`);
  if (admitted.instrument !== item.instrumentLayer.instrument) fail(`${item.id}: admitted instrument mismatch`);
  if (admitted.audioUrl !== item.instrumentLayer.audioUrl) fail(`${item.id}: instrument audio mismatch`);
  if (!admitted.controlledComposerProofAllowed) fail(`${item.id}: instrument is not controlled-proof allowed`);
  if (admitted.quickCreateRouterAllowed || admitted.productionAllowed || admitted.publicReleaseAllowed || admitted.formalUsable) {
    fail(`${item.id}: admitted instrument has invalid promotion flag`);
  }
  if (item.instrumentLayer.routeTier !== 'reserve_candidate') fail(`${item.id}: instrument must remain reserve candidate`);
  if (item.instrumentLayer.humanListeningStatus !== 'pending') fail(`${item.id}: instrument human listening status must remain pending`);
  const instrumentPath = path.join(root, 'public', item.instrumentLayer.audioUrl.replace(/^\//, ''));
  if (!existsSync(instrumentPath)) fail(`${item.id}: instrument audio missing`);
  if (statSync(instrumentPath).size < 10_000) fail(`${item.id}: instrument audio is unexpectedly small`);

  if (item.supportLayers.length !== 3) fail(`${item.id}: expected exactly three support layers`);
  const supportIds = new Set<string>();
  for (const support of item.supportLayers) {
    if (supportIds.has(support.id)) fail(`${item.id}: duplicate support ${support.id}`);
    supportIds.add(support.id);
    if (!allowedSupportRoles.has(support.recipeRole)) fail(`${item.id}: unexpected support role ${support.recipeRole}`);
    const source = eligibilityById.get(support.id);
    if (!source) fail(`${item.id}: support ${support.id} is missing from eligibility map`);
    if (!source.audioUrl) fail(`${item.id}: support ${support.id} has no audio URL in eligibility map`);
    if (source.audioUrl !== support.audioUrl) fail(`${item.id}: support ${support.id} audio URL mismatch`);
    if (source.recipeRole !== support.recipeRole) fail(`${item.id}: support ${support.id} role mismatch`);
    if (source.goalSuitability[item.goal] === 'avoid') fail(`${item.id}: support ${support.id} avoids ${item.goal}`);
    if (source.productionAllowed || source.formalUsable || support.productionAllowed || support.formalUsable) {
      fail(`${item.id}: support ${support.id} has invalid promotion flag`);
    }
    const supportPath = path.join(root, 'public', support.audioUrl.replace(/^\//, ''));
    if (!existsSync(supportPath)) fail(`${item.id}: support audio missing ${support.id}`);
    if (statSync(supportPath).size < 10_000) fail(`${item.id}: support audio ${support.id} is unexpectedly small`);
    if (support.id.includes('lyria') || support.sourceKind.includes('lyria_single_element_reserve')) {
      fail(`${item.id}: Lyria single-element reserve support is not allowed`);
    }
  }
}

const html = readFileSync(reviewPath, 'utf8');
if ((html.match(/<audio /g) ?? []).length !== 24) fail('review page must expose twenty-four ingredient audio controls');
if (/<input|<select|<textarea/i.test(html)) fail('review page must not ask for material choices');
if (!html.includes('Quick Create routing remains blocked')) fail('review missing Quick Create boundary');
if (!html.includes('not a finished render page')) fail('review missing finished-render boundary');
if (html.includes('lyria_single_element_reserve')) fail('review must not include Lyria reserve items');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('Six controlled composer-admission combinations')) fail('report missing verdict');
if (!report.includes('does not promote any candidate into')) fail('report missing promotion boundary');

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  cases: manifest.counts.cases,
  audioControls: manifest.counts.audioControls,
  quickCreateRouterAllowed: manifest.counts.quickCreateRouterAllowed,
  productionAllowed: manifest.counts.productionAllowed,
  reviewUrl: manifest.reviewUrl,
}, null, 2));
