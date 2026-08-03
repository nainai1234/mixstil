import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  routeFlag: string;
  sourceMap: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  hardRules: string[];
  counts: {
    cases: number;
    rendered: number;
    sleep: number;
    calm: number;
    focus: number;
    distinctSelections: number;
    runtimeExternalApiUsed: number;
  };
  results: Array<{
    id: string;
    goal: string;
    scene: string;
    preparedAudioUrl: string;
    renderQa: { passed?: boolean; durationSeconds?: number };
    contentMode?: string;
    selected: Array<{
      eligibilityId: string;
      recipeRole: string;
      routeStatus: string;
      sourceKind: string;
      riskTags?: string[];
    }>;
    selectedSymbolicRuleIds: string[];
    tracks: Array<{ stemId: string; role: string; volume: number }>;
    runtimeExternalApiUsed: boolean;
    productionAllowed: boolean;
  }>;
};

const root = process.cwd();
const batchId = 'foundational-eligibility-coverage-render-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational eligibility coverage render v1 validation failed: ${message}`);
};

const manifestPath = path.join(root, 'public/review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const reportPath = path.join(root, 'reports', `${batchId}.md`);
const reportJsonPath = path.join(root, 'reports', `${batchId}.json`);

for (const file of [manifestPath, reviewPath, reportPath, reportJsonPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const reportJson = JSON.parse(readFileSync(reportJsonPath, 'utf8')) as Manifest;
if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema');
if (manifest.batchId !== batchId) fail('batch id mismatch');
if (manifest.status !== 'coverage_render_review_ready') fail(`unexpected status ${manifest.status}`);
if (manifest.routeFlag !== 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1') fail('route flag mismatch');
if (manifest.sourceMap !== 'config/foundational-recipe-eligibility-map-v1.json') fail('source map mismatch');
if (manifest.productionAllowed !== false) fail('production must remain false');
if (manifest.formalUsablePromotionAllowed !== false) fail('formal usable promotion must remain false');
if (JSON.stringify(manifest.counts) !== JSON.stringify(reportJson.counts)) fail('report json counts drift');

for (const rule of [
  'Rendered coverage outputs are product-route proofs, not foundational elements.',
  'Do not count these renders as new materials or production release assets.',
  'No runtime full-track generation API may be used.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.counts.cases !== 9 || manifest.results.length !== 9) fail('expected nine rendered cases');
if (manifest.counts.rendered !== 9) fail('all nine cases must be rendered');
if (manifest.counts.sleep !== 3 || manifest.counts.calm !== 3 || manifest.counts.focus !== 3) fail('expected three cases per goal');
if (manifest.counts.distinctSelections < 6) fail('coverage collapsed into too few distinct selections');
if (manifest.counts.runtimeExternalApiUsed !== 0) fail('runtime external API must not be used');

for (const item of manifest.results) {
  if (item.productionAllowed !== false) fail(`${item.id} productionAllowed must be false`);
  if (item.runtimeExternalApiUsed !== false) fail(`${item.id} used runtime external API`);
  if (!Array.isArray(item.selected) || item.selected.length < 2) fail(`${item.id} selected too few foundational elements`);
  if (!Array.isArray(item.selectedSymbolicRuleIds) || item.selectedSymbolicRuleIds.length < 4) fail(`${item.id} missing symbolic rules`);
  if (!item.selected.every((entry) => entry.eligibilityId && entry.recipeRole && entry.routeStatus && entry.sourceKind)) fail(`${item.id} missing eligibility metadata`);
  if (!item.tracks.every((track) => !track.stemId.includes('mixkit_music') && !track.stemId.includes('music-kit'))) fail(`${item.id} fell back to fixed music content`);
  if (!item.renderQa?.passed) fail(`${item.id} render QA did not pass`);
  if (Number(item.renderQa.durationSeconds ?? 0) < 60) fail(`${item.id} render duration too short`);
  const audioPath = path.join(root, 'public', item.preparedAudioUrl.replace(/^\//, ''));
  if (!existsSync(audioPath)) fail(`${item.id} missing copied rendered audio`);
  if (statSync(audioPath).size < 100_000) fail(`${item.id} copied rendered audio too small`);
}

const byId = new Map(manifest.results.map((item) => [item.id, item]));
const selectedIds = (id: string) => byId.get(id)?.selected.map((item) => item.eligibilityId) ?? [];
const selectedRoles = (id: string) => byId.get(id)?.selected.map((item) => item.recipeRole) ?? [];
const selectedRiskTags = (id: string) => byId.get(id)?.selected.flatMap((item) => item.riskTags ?? []) ?? [];
const selectedStemIds = (id: string) => byId.get(id)?.tracks.map((item) => item.stemId) ?? [];
const hasAny = (values: string[], pattern: RegExp) => values.some((value) => pattern.test(value));

{
  const id = 'sleep_bedtime_warm_sparse';
  const ids = selectedIds(id);
  const roles = selectedRoles(id);
  if (!byId.has(id)) fail(`${id} missing`);
  if (!roles.some((role) => ['harmony_cell', 'playable_note_source', 'bass_support'].includes(role))) {
    fail(`${id} collapsed into noise-only texture stack`);
  }
  if (!hasAny(ids, /piano|chord|note|bass/i)) {
    fail(`${id} missing warm sparse musical support`);
  }
}

{
  const id = 'sleep_no_music_dark_hush';
  const ids = selectedIds(id);
  const riskTags = selectedRiskTags(id);
  if (!byId.has(id)) fail(`${id} missing`);
  if (byId.get(id)?.contentMode !== 'pure_soundscape') fail(`${id} must remain pure soundscape`);
  if (hasAny(ids, /ocean|rain|water|sea|room_air|pine_air|far_ocean/i)) {
    fail(`${id} selected water/room-air-like bed despite explicit no-water/no-road intent`);
  }
  if (riskTags.includes('water_association_review') || riskTags.includes('road_like_or_hvac_like_review')) {
    fail(`${id} retained water/road/HVAC risk tags`);
  }
  if (selectedRoles(id).some((role) => ['harmony_cell', 'playable_note_source', 'melodic_motif', 'bass_support'].includes(role))) {
    fail(`${id} selected music roles despite explicit no-music intent`);
  }
}

{
  const id = 'focus_no_melody_masking';
  const ids = selectedIds(id);
  const riskTags = selectedRiskTags(id);
  const stems = selectedStemIds(id);
  if (!byId.has(id)) fail(`${id} missing`);
  if (selectedRoles(id).includes('melodic_motif')) fail(`${id} selected melodic motif despite explicit no-melody intent`);
  if (hasAny([...ids, ...stems], /ocean|rain|water|sea|room_air|pine_air|far_ocean/i)) {
    fail(`${id} selected water/room-air-like bed despite masking/no-water intent`);
  }
  if (riskTags.includes('water_association_review') || riskTags.includes('road_like_or_hvac_like_review')) {
    fail(`${id} retained water/road/HVAC risk tags`);
  }
  if (!ids.includes('atom_bass_focus_low_pulse_free_anchor')) {
    fail(`${id} missing non-melodic focus bass anchor`);
  }
}

const review = readFileSync(reviewPath, 'utf8');
if (!review.includes('基础素材库 + eligibility map + Quick Create')) fail('review page missing coverage framing');
if (!review.includes('不是新增基础元素，也不是生产发布资产')) fail('review page must keep boundary clear');
if ((review.match(/<audio /g) ?? []).length !== 9) fail('review page must expose nine audio controls');
if ((review.match(/data-key=/g) ?? []).length < 60) fail('review page must include checklist controls');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('rendered route coverage outputs')) fail('report missing boundary');
if (!report.includes(`/review/${batchId}/index.html`)) fail('report missing review URL');

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
