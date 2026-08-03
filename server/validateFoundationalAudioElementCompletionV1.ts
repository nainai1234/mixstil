import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type CompletionItem = {
  id: string;
  sourceKind: 'recipe_integrated_audio' | 'instrument_composition_candidate' | 'lyria_single_element_reserve';
  sourceBatchId: string;
  role: string;
  goals: Array<'sleep' | 'calm' | 'focus'>;
  audioUrl: string;
  routeTier: 'router_integrated' | 'reserve_candidate';
  machineStatus: string;
  humanListeningStatus: 'pending';
  productionAllowed: false;
  formalUsable: false;
  reason: string;
  riskTags: string[];
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  productionAllowed: boolean;
  publicReleaseAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  purpose: string;
  hardRules: string[];
  sourceInputs: Record<string, string>;
  counts: Record<string, number>;
  items: CompletionItem[];
};

const root = process.cwd();
const batchId = 'foundational-audio-element-completion-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational audio element completion v1 validation failed: ${message}`);
};

const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
for (const file of [reportJsonPath, reportPath, reviewPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(reportJsonPath, 'utf8')) as Manifest;
if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema');
if (manifest.batchId !== batchId) fail('unexpected batch id');
if (manifest.status !== 'internal_foundational_audio_elements_filled_to_80_candidate_baseline') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed || manifest.publicReleaseAllowed || manifest.formalUsablePromotionAllowed) {
  fail('production/public/formal usable promotion must remain blocked');
}
for (const rule of [
  'Router proof renders are excluded.',
  'Finished content and long-form seeds are excluded.',
  'The current Quick Create router may use the 45 router-integrated items only.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.items.length !== 80) fail(`expected 80 items, got ${manifest.items.length}`);
if (manifest.counts.totalAudioItems !== 80) fail('total count mismatch');
if (manifest.counts.routerIntegrated !== 45) fail('router-integrated count mismatch');
if (manifest.counts.reserveCandidates !== 35) fail('reserve count mismatch');
if (manifest.counts.instrumentCompositionReserve !== 30) fail('composition reserve count mismatch');
if (manifest.counts.lyriaSingleElementReserve !== 5) fail('Lyria reserve count mismatch');
if (manifest.counts.productionAllowed !== 0 || manifest.counts.formalUsable !== 0) fail('no item can be production/formal usable here');
if (manifest.counts.sleep < 25 || manifest.counts.calm < 25 || manifest.counts.focus < 20) fail('goal coverage is too narrow');

const ids = new Set<string>();
for (const item of manifest.items) {
  if (ids.has(item.id)) fail(`duplicate item id ${item.id}`);
  ids.add(item.id);
  if (!item.audioUrl.startsWith('/audio/')) fail(`${item.id} audio URL must be local public audio`);
  if (!existsSync(path.join(root, 'public', item.audioUrl.replace(/^\//, '')))) fail(`${item.id} audio file missing`);
  if (item.productionAllowed || item.formalUsable) fail(`${item.id} must not be production/formal usable`);
  if (item.humanListeningStatus !== 'pending') fail(`${item.id} must remain pending human listening`);
  if (item.routeTier === 'reserve_candidate' && !item.riskTags.includes('reserve_not_router_integrated')) {
    fail(`${item.id} reserve item missing route boundary risk tag`);
  }
  if (item.audioUrl.includes('composer-result-render-proof-v1') || item.audioUrl.includes('atomic-composer-router-proof-v1')) {
    fail(`${item.id} incorrectly counts a router proof render`);
  }
  if (item.audioUrl.includes('/content-baseline/') || item.audioUrl.includes('/exports/')) {
    fail(`${item.id} incorrectly counts finished content/export audio`);
  }
}

const integrated = manifest.items.filter((item) => item.routeTier === 'router_integrated');
const reserve = manifest.items.filter((item) => item.routeTier === 'reserve_candidate');
if (!integrated.every((item) => item.sourceKind === 'recipe_integrated_audio')) fail('router tier must only contain recipe-integrated audio');
if (reserve.some((item) => item.sourceKind === 'recipe_integrated_audio')) fail('reserve tier cannot contain router-integrated items');

const review = readFileSync(reviewPath, 'utf8');
if ((review.match(/<audio /g) ?? []).length !== 80) fail('review must expose 80 audio controls');
if (!review.includes('45 router-integrated items plus 35 reserve candidates')) fail('review missing tier boundary');
if (review.includes('composer-result-render-proof-v1')) fail('review must not count composer result proof renders');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('80-item candidate')) fail('report missing 80 candidate verdict');
if (!report.includes('not a production or formal-usable promotion')) fail('report missing production boundary');

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
