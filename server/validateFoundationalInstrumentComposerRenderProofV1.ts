import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type Goal = 'sleep' | 'calm' | 'focus';
type Instrument = 'piano' | 'guitar' | 'rhodes' | 'bass';

type Render = {
  id: string;
  label: string;
  prompt: string;
  goal: Goal;
  scene: string;
  admissionSourceId?: string;
  admissionStatus: 'controlled_composer_combination_proof';
  renderStatus: 'internal_render_proof_ready' | 'internal_render_proof_needs_adjustment';
  instrumentLayer: {
    id: string;
    instrument: Instrument;
    audioUrl: string;
    routeTier: 'reserve_candidate';
    humanListeningStatus: 'pending';
    productionAllowed: false;
    formalUsable: false;
  };
  supportLayers: Array<{
    id: string;
    recipeRole: string;
    audioUrl: string;
    productionAllowed: false;
    formalUsable: false;
  }>;
  selectedInstrumentId: string;
  selectedSupportMaterialIds: string[];
  preparedAudioUrl: string;
  reviewAudioSrc: string;
  durationSeconds: number;
  analysis: {
    integratedLufs: number;
    peakDbfs: number;
    humanVoiceProbability: string;
    drumProbability: string;
  };
  machineStatus: 'pass' | 'review_required';
  failures: string[];
  internalListeningStatus: 'pending';
  quickCreateRouterAllowed: false;
  productionAllowed: false;
  publicReleaseAllowed: false;
  offlineReleaseAllowed: false;
  formalUsable: false;
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  sourceAdmissionProof: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  quickCreateRouterAllowed: boolean;
  offlineReleaseAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  hardRules: string[];
  counts: {
    renders: number;
    machinePass: number;
    sleep: number;
    calm: number;
    focus: number;
    quickCreateRouterAllowed: number;
    productionAllowed: number;
    publicReleaseAllowed: number;
    formalUsable: number;
  };
  reviewUrl: string;
  renders: Render[];
};

type AdmissionProof = {
  batchId: string;
  renderedMixesProduced: boolean;
  counts: { cases: number };
  cases: Array<{
    id: string;
    goal: Goal;
    instrumentLayer: { id: string; audioUrl: string };
    supportLayers: Array<{ id: string; audioUrl: string }>;
    quickCreateRouterAllowed: false;
    productionAllowed: false;
    publicReleaseAllowed: false;
    formalUsable: false;
  }>;
};

const root = process.cwd();
const batchId = 'foundational-instrument-composer-render-proof-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational instrument composer render proof v1 validation failed: ${message}`);
};

const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');

for (const file of [manifestPath, reportJsonPath, reportPath, reviewPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const reportJson = JSON.parse(readFileSync(reportJsonPath, 'utf8')) as Manifest;
if (JSON.stringify(reportJson.counts) !== JSON.stringify(manifest.counts)) fail('report JSON counts differ from manifest');

if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.batchId !== batchId) fail(`unexpected batch id ${manifest.batchId}`);
if (manifest.status !== 'foundational_instrument_composer_render_proof_ready') fail(`unexpected status ${manifest.status}`);
if (manifest.sourceAdmissionProof !== 'reports/foundational-instrument-composer-admission-proof-v1.json') fail('unexpected source admission proof');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('unexpected review URL');
if (
  manifest.productionAllowed
  || manifest.publicReleaseAllowed
  || manifest.quickCreateRouterAllowed
  || manifest.offlineReleaseAllowed
  || manifest.formalUsablePromotionAllowed
) {
  fail('manifest-level promotion flags must remain blocked');
}

for (const rule of [
  'Rendered files are internal proof mixes, not foundational elements.',
  'Rendered files are not finished seed content and not public release content.',
  'No reserve candidate is promoted to consumer Quick Create by this proof.',
  'Every render uses exactly one admitted instrument candidate and three mapped support ingredients.',
  'No Lyria single-element reserve item may be used.',
  'The consumer is never asked to choose these materials.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.renders.length !== 6 || manifest.counts.renders !== 6) fail('expected six rendered proof mixes');
if (manifest.counts.machinePass !== 6) fail('all rendered proof mixes must machine pass');
if (manifest.counts.sleep !== 2 || manifest.counts.calm !== 2 || manifest.counts.focus !== 2) fail('goal distribution must be 2/2/2');
if (
  manifest.counts.quickCreateRouterAllowed !== 0
  || manifest.counts.productionAllowed !== 0
  || manifest.counts.publicReleaseAllowed !== 0
  || manifest.counts.formalUsable !== 0
) {
  fail('render-level promotion counts must remain zero');
}

const sourcePath = path.join(root, manifest.sourceAdmissionProof);
if (!existsSync(sourcePath)) fail('source admission proof missing');
const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as AdmissionProof;
if (source.batchId !== 'foundational-instrument-composer-admission-proof-v1') fail('source admission proof batch mismatch');
if (source.renderedMixesProduced) fail('source admission proof must stay unrendered');
if (source.counts.cases !== 6 || source.cases.length !== 6) fail('source admission proof must contain six cases');

const sourceById = new Map(source.cases.map((item) => [item.id, item]));
const ids = new Set<string>();
const instruments = new Set<string>();

for (const item of manifest.renders) {
  if (ids.has(item.id)) fail(`duplicate render id ${item.id}`);
  ids.add(item.id);
  const sourceCase = sourceById.get(item.admissionSourceId ?? item.id);
  if (!sourceCase) fail(`${item.id}: missing source admission case`);
  if (sourceCase.goal !== item.goal) fail(`${item.id}: source goal mismatch`);
  if (
    sourceCase.quickCreateRouterAllowed
    || sourceCase.productionAllowed
    || sourceCase.publicReleaseAllowed
    || sourceCase.formalUsable
  ) {
    fail(`${item.id}: source case has invalid promotion flag`);
  }

  if (!item.label || !item.prompt) fail(`${item.id}: missing label or prompt`);
  if (item.admissionStatus !== 'controlled_composer_combination_proof') fail(`${item.id}: admission status changed`);
  if (item.renderStatus !== 'internal_render_proof_ready') fail(`${item.id}: render is not ready`);
  if (item.machineStatus !== 'pass') fail(`${item.id}: machine status ${item.machineStatus}`);
  if (item.failures.length !== 0) fail(`${item.id}: unexpected failures`);
  if (item.internalListeningStatus !== 'pending') fail(`${item.id}: listening status should remain pending`);
  if (
    item.quickCreateRouterAllowed
    || item.productionAllowed
    || item.publicReleaseAllowed
    || item.offlineReleaseAllowed
    || item.formalUsable
  ) {
    fail(`${item.id}: render promotion flags must remain false`);
  }

  if (item.selectedInstrumentId !== item.instrumentLayer.id) fail(`${item.id}: selected instrument mismatch`);
  if (item.instrumentLayer.id !== sourceCase.instrumentLayer.id) fail(`${item.id}: source instrument mismatch`);
  if (item.instrumentLayer.audioUrl !== sourceCase.instrumentLayer.audioUrl) fail(`${item.id}: source instrument audio mismatch`);
  if (item.instrumentLayer.routeTier !== 'reserve_candidate') fail(`${item.id}: instrument must remain reserve candidate`);
  if (item.instrumentLayer.humanListeningStatus !== 'pending') fail(`${item.id}: instrument human listening status must remain pending`);
  if (item.instrumentLayer.productionAllowed || item.instrumentLayer.formalUsable) fail(`${item.id}: instrument promotion flag changed`);
  instruments.add(item.instrumentLayer.instrument);

  if (item.supportLayers.length !== 3 || item.selectedSupportMaterialIds.length !== 3) fail(`${item.id}: expected three support layers`);
  const sourceSupportIds = sourceCase.supportLayers.map((support) => support.id).sort().join('|');
  const renderSupportIds = item.selectedSupportMaterialIds.slice().sort().join('|');
  if (sourceSupportIds !== renderSupportIds) fail(`${item.id}: support selection changed`);
  for (const support of item.supportLayers) {
    if (support.productionAllowed || support.formalUsable) fail(`${item.id}: support promotion flag changed`);
    if (support.id.toLowerCase().includes('lyria') || support.audioUrl.toLowerCase().includes('lyria')) {
      fail(`${item.id}: Lyria reserve source leaked into render`);
    }
  }

  const audioPath = path.join(root, 'public', item.preparedAudioUrl.replace(/^\//, ''));
  if (!existsSync(audioPath)) fail(`${item.id}: rendered MP3 missing`);
  if (statSync(audioPath).size < 100_000) fail(`${item.id}: rendered MP3 too small`);
  if (!item.reviewAudioSrc.includes(item.preparedAudioUrl.replace(/^\//, ''))) fail(`${item.id}: review audio src mismatch`);
  if (item.durationSeconds < 59 || item.durationSeconds > 61) fail(`${item.id}: unexpected duration ${item.durationSeconds}`);
  if (item.analysis.peakDbfs > -7) fail(`${item.id}: peak too hot`);
  if (item.analysis.integratedLufs > -24 || item.analysis.integratedLufs < -32) fail(`${item.id}: loudness outside internal proof range`);
  if (!item.analysis.humanVoiceProbability.includes('not_applicable')) fail(`${item.id}: voice boundary missing`);
  if (!item.analysis.drumProbability.includes('not_applicable')) fail(`${item.id}: drum boundary missing`);
}

for (const instrument of ['piano', 'guitar', 'rhodes', 'bass'] as const) {
  if (!instruments.has(instrument)) fail(`missing instrument family ${instrument}`);
}

const html = readFileSync(reviewPath, 'utf8');
if ((html.match(/<audio /g) ?? []).length !== 6) fail('review page must expose six rendered audio controls');
if (/<input|<select|<textarea/i.test(html)) fail('review page must not ask for material choices');
if (!html.includes('不是基础元素')) fail('review page missing foundational-element boundary');
if (!html.includes('不是 Quick Create 路由素材')) fail('review page missing Quick Create boundary');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('Six controlled instrument-composer admission combinations were rendered')) fail('report missing verdict');
if (!report.includes('does not promote reserve')) fail('report missing promotion boundary');

console.log(JSON.stringify({
  passed: true,
  batchId,
  renders: manifest.counts.renders,
  machinePass: manifest.counts.machinePass,
  quickCreateRouterAllowed: manifest.counts.quickCreateRouterAllowed,
  productionAllowed: manifest.counts.productionAllowed,
  reviewUrl: manifest.reviewUrl,
}, null, 2));
