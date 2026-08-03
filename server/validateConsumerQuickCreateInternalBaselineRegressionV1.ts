import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type RegressionReport = {
  schemaVersion: string;
  regressionId: string;
  status: string;
  requiredRuntimeFlag: string;
  ownerDecisionSource: string;
  sourceMap: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  hardRules: string[];
  counts: {
    cases: number;
    sleep: number;
    calm: number;
    focus: number;
    distinctSelections: number;
    savedReplayProofs: number;
    runtimeExternalApiUsed: number;
    productionAllowed: number;
  };
  savedReplayProof: Record<string, any>;
  results: Array<{
    id: string;
    goal: string;
    scene: string;
    selectedEligibilityIds: string[];
    selectedRecipeRoles: string[];
    selectedRiskTags: string[];
    selectedSymbolicRuleIds: string[];
    trackCount: number;
    trackStemIds: string[];
    audioTrackUrls: string[];
    runtimeExternalApiUsed: boolean;
    productionAllowed: boolean;
  }>;
};

const root = process.cwd();
const regressionId = 'consumer-quick-create-internal-baseline-regression-v1';
const fail = (message: string): never => {
  throw new Error(`Consumer Quick Create internal baseline regression v1 validation failed: ${message}`);
};

const reportPath = path.join(root, 'reports', `${regressionId}.md`);
const jsonReportPath = path.join(root, 'reports', `${regressionId}.json`);
const ownerDecisionPath = path.join(root, 'config/foundational-eligibility-coverage-render-v1-owner-decision.json');
const eligibilityMapPath = path.join(root, 'config/foundational-recipe-eligibility-map-v1.json');

for (const file of [reportPath, jsonReportPath, ownerDecisionPath, eligibilityMapPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const report = JSON.parse(readFileSync(jsonReportPath, 'utf8')) as RegressionReport;
const ownerDecision = JSON.parse(readFileSync(ownerDecisionPath, 'utf8')) as {
  ownerDecision: string;
  quickCreateInternalBaselineAllowed: boolean;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
};

if (report.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (report.regressionId !== regressionId) fail('regression id mismatch');
if (report.status !== 'passed') fail(`unexpected status ${report.status}`);
if (report.requiredRuntimeFlag !== 'FOUNDATIONAL_RECIPE_ELIGIBILITY_MAP_V1=1') fail('runtime flag mismatch');
if (report.ownerDecisionSource !== 'config/foundational-eligibility-coverage-render-v1-owner-decision.json') fail('owner decision source mismatch');
if (report.sourceMap !== 'config/foundational-recipe-eligibility-map-v1.json') fail('source map mismatch');
if (ownerDecision.ownerDecision !== 'passed_for_internal_audible_product_baseline_regression') fail('owner decision does not allow this regression');
if (ownerDecision.quickCreateInternalBaselineAllowed !== true) fail('owner decision did not allow Quick Create internal baseline');
if (report.productionAllowed !== false || ownerDecision.productionAllowed !== false) fail('production must remain blocked');
if (report.formalUsablePromotionAllowed !== false || ownerDecision.formalUsablePromotionAllowed !== false) fail('formal usable promotion must remain blocked');

for (const rule of [
  'User-facing Quick Create must use foundational_recipe_eligibility_map_v1.',
  'Coverage proof renders must not be used as source assets.',
  'Rendered proof files remain route proofs, not foundational materials.',
  'Runtime external full-track generation must not be used.',
  'Explicit no-music, no-melody, no-water, no-road, no-voice, and no-drum constraints must survive routing.',
  'Production and formal usable promotion remain blocked.',
]) {
  if (!report.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (report.counts.cases !== 4 || report.results.length !== 4) fail('expected four regression cases');
if (report.counts.sleep !== 2) fail('expected two sleep cases');
if (report.counts.calm !== 1) fail('expected one calm case');
if (report.counts.focus !== 1) fail('expected one focus case');
if (report.counts.distinctSelections < 3) fail('goal selections collapsed into too few combinations');
if (report.counts.savedReplayProofs !== 1 || !report.savedReplayProof?.mixId) fail('missing saved replay proof');
if (report.counts.runtimeExternalApiUsed !== 0) fail('runtime external API was used');
if (report.counts.productionAllowed !== 0) fail('production was allowed');

const byId = new Map(report.results.map((item) => [item.id, item]));
for (const id of ['sleep_bedtime_warm_sparse', 'sleep_no_music_dark_hush', 'calm_breathing_space', 'focus_no_melody_masking']) {
  if (!byId.has(id)) fail(`missing case ${id}`);
}

for (const item of report.results) {
  if (item.productionAllowed !== false) fail(`${item.id} productionAllowed must be false`);
  if (item.runtimeExternalApiUsed !== false) fail(`${item.id} used runtime external API`);
  if (item.trackCount < 2) fail(`${item.id} has too few tracks`);
  if (item.selectedEligibilityIds.length < 2) fail(`${item.id} selected too few eligibility ids`);
  if (item.selectedSymbolicRuleIds.length < 4) fail(`${item.id} missing symbolic rules`);
  if (item.trackStemIds.some((stemId) => stemId.includes('mixkit_music') || stemId.includes('music-kit'))) fail(`${item.id} used fixed music content`);
  if (item.audioTrackUrls.some((url) => url.includes('foundational-eligibility-coverage-render-v1') || url.includes('foundational-eligibility-quick-create-review-v1'))) {
    fail(`${item.id} used review/proof render as source audio`);
  }
}

{
  const item = byId.get('sleep_bedtime_warm_sparse')!;
  if (!item.selectedRecipeRoles.some((role) => ['harmony_cell', 'playable_note_source', 'bass_support'].includes(role))) {
    fail('sleep_bedtime_warm_sparse collapsed into non-musical support only');
  }
}

{
  const item = byId.get('sleep_no_music_dark_hush')!;
  if (item.selectedRecipeRoles.some((role) => ['harmony_cell', 'playable_note_source', 'melodic_motif', 'bass_support'].includes(role))) {
    fail('sleep_no_music_dark_hush selected music roles despite no-music request');
  }
  if (item.selectedEligibilityIds.some((id) => /ocean|rain|water|sea|room_air|pine_air|far_ocean/i.test(id))) {
    fail('sleep_no_music_dark_hush selected water/air/road-like identity');
  }
  if (item.selectedRiskTags.includes('water_association_review') || item.selectedRiskTags.includes('road_like_or_hvac_like_review')) {
    fail('sleep_no_music_dark_hush retained water/road risk tags');
  }
}

{
  const item = byId.get('focus_no_melody_masking')!;
  if (item.selectedRecipeRoles.includes('melodic_motif')) fail('focus_no_melody_masking selected a melodic motif');
  if (!item.selectedEligibilityIds.includes('atom_bass_focus_low_pulse_free_anchor')) fail('focus_no_melody_masking missing non-melodic focus anchor');
  if (item.selectedEligibilityIds.some((id) => /ocean|rain|water|sea|room_air|pine_air|far_ocean/i.test(id))) {
    fail('focus_no_melody_masking selected water/air/road-like identity');
  }
  if (item.selectedRiskTags.includes('water_association_review') || item.selectedRiskTags.includes('road_like_or_hvac_like_review')) {
    fail('focus_no_melody_masking retained water/road risk tags');
  }
}

const markdown = readFileSync(reportPath, 'utf8');
if (!markdown.includes('The owner-approved foundational eligibility route passed')) fail('markdown missing verdict');
if (!markdown.includes('not new foundational materials and not production')) fail('markdown missing boundary');
if (!markdown.includes('Sprint 1 playback reliability')) fail('markdown missing next step');

console.log(JSON.stringify({
  passed: true,
  regressionId,
  status: report.status,
  counts: report.counts,
  productionAllowed: report.productionAllowed,
  next: 'Sprint 1 playback reliability gates',
}, null, 2));
