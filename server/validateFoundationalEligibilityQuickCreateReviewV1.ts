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
    distinctSelections: number;
    runtimeExternalApiUsed: number;
  };
  results: Array<{
    id: string;
    goal: string;
    scene: string;
    preparedAudioUrl: string;
    renderQa: { passed?: boolean; durationSeconds?: number };
    selected: Array<{ eligibilityId: string; recipeRole: string; routeStatus: string; sourceKind: string }>;
    selectedSymbolicRuleIds: string[];
    tracks: Array<{ stemId: string; role: string; volume: number }>;
    runtimeExternalApiUsed: boolean;
    productionAllowed: boolean;
  }>;
};

const root = process.cwd();
const batchId = 'foundational-eligibility-quick-create-review-v1';
const fail = (message: string): never => {
  throw new Error(`Foundational eligibility Quick Create review v1 validation failed: ${message}`);
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
if (manifest.status !== 'rendered_quick_create_review_ready') fail(`unexpected status ${manifest.status}`);
if (manifest.routeFlag !== 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1') fail('route flag mismatch');
if (manifest.sourceMap !== 'config/foundational-recipe-eligibility-map-v1.json') fail('source map mismatch');
if (manifest.productionAllowed !== false) fail('production must remain false');
if (manifest.formalUsablePromotionAllowed !== false) fail('formal usable promotion must remain false');
if (JSON.stringify(manifest.counts) !== JSON.stringify(reportJson.counts)) fail('report json counts drift');

for (const rule of [
  'These rendered review outputs are proof results, not foundational elements.',
  'They must not be counted as new materials or production release assets.',
  'No runtime full-track generation API may be used.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.counts.cases !== 3 || manifest.results.length !== 3) fail('expected three rendered cases');
if (manifest.counts.rendered !== 3) fail('all three cases must be rendered');
if (manifest.counts.distinctSelections !== 3) fail('Sleep, Calm, and Focus must not collapse to the same selection');
if (manifest.counts.runtimeExternalApiUsed !== 0) fail('runtime external API must not be used');

const goals = new Set<string>();
for (const item of manifest.results) {
  goals.add(item.goal);
  if (item.productionAllowed !== false) fail(`${item.id} productionAllowed must be false`);
  if (item.runtimeExternalApiUsed !== false) fail(`${item.id} used runtime external API`);
  if (!Array.isArray(item.selected) || item.selected.length < 2) fail(`${item.id} selected too few foundational elements`);
  if (!Array.isArray(item.selectedSymbolicRuleIds) || item.selectedSymbolicRuleIds.length < 4) fail(`${item.id} missing symbolic rule ids`);
  if (!item.selected.every((entry) => entry.eligibilityId && entry.recipeRole && entry.routeStatus && entry.sourceKind)) fail(`${item.id} missing eligibility metadata`);
  if (!item.tracks.every((track) => !track.stemId.includes('mixkit_music') && !track.stemId.includes('music-kit'))) fail(`${item.id} fell back to fixed music content`);
  if (!item.renderQa?.passed) fail(`${item.id} render QA did not pass`);
  if (Number(item.renderQa.durationSeconds ?? 0) < 60) fail(`${item.id} render duration too short`);
  const audioPath = path.join(root, 'public', item.preparedAudioUrl.replace(/^\//, ''));
  if (!existsSync(audioPath)) fail(`${item.id} missing copied rendered audio`);
  if (statSync(audioPath).size < 100_000) fail(`${item.id} copied rendered audio too small`);
}
for (const goal of ['sleep', 'calm', 'focus']) {
  if (!goals.has(goal)) fail(`missing goal ${goal}`);
}

const review = readFileSync(reviewPath, 'utf8');
if (!review.includes('用户一句话 -> eligibility map 选基础元素 -> Recipe V2 -> 完整混音 MP3')) fail('review page missing product proof framing');
if (!review.includes('不是新基础素材，也不是 production release')) fail('review page must keep boundary clear');
if ((review.match(/<audio /g) ?? []).length !== 3) fail('review page must expose three rendered audio controls');
if ((review.match(/data-key=/g) ?? []).length < 6) fail('review page must include decision and note controls');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('rendered proof outputs')) fail('report missing boundary');
if (!report.includes(`/review/${batchId}/index.html`)) fail('report missing review URL');

console.log(JSON.stringify({
  passed: true,
  batchId,
  status: manifest.status,
  counts: manifest.counts,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: `/review/${batchId}/index.html`,
}, null, 2));
