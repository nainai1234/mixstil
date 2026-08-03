import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Eligibility = {
  id: string;
  sourceKind: 'atomic_audio' | 'deterministic_audio' | 'dsp_config' | 'symbolic_rule';
  sourceBatchId: string;
  recipeRole: string;
  goalSuitability: Record<'sleep' | 'calm' | 'focus', string>;
  foregroundAllowed: boolean;
  supportOnly: boolean;
  defaultGainDb: number | null;
  minGainDb: number | null;
  maxGainDb: number | null;
  maxSimultaneousInstances: number;
  loopPolicy: string;
  routeStatus: string;
  hardExclusions: string[];
  riskTags: string[];
  formalUsable: boolean;
  productionAllowed: boolean;
  audioUrl?: string;
};

type Manifest = {
  schemaVersion: string;
  mapId: string;
  status: string;
  ownerDecisionSource: string;
  ownerDecision: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  hardRules: string[];
  counts: Record<string, number>;
  byRole: Record<string, number>;
  eligibilities: Eligibility[];
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Foundational recipe eligibility map v1 validation failed: ${message}`);
};

const configPath = path.join(root, 'config/foundational-recipe-eligibility-map-v1.json');
const reportPath = path.join(root, 'reports/foundational-recipe-eligibility-map-v1.md');
const jsonReportPath = path.join(root, 'reports/foundational-recipe-eligibility-map-v1.json');
const reviewPath = path.join(root, 'public/review/foundational-recipe-eligibility-map-v1/index.html');
const ownerDecisionPath = path.join(root, 'config/foundational-material-complete-v1-owner-decision.json');

for (const file of [configPath, reportPath, jsonReportPath, reviewPath, ownerDecisionPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(configPath, 'utf8')) as Manifest;
const jsonReport = JSON.parse(readFileSync(jsonReportPath, 'utf8')) as Manifest;
const ownerDecision = JSON.parse(readFileSync(ownerDecisionPath, 'utf8')) as {
  ownerDecision: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  nextAllowedStage: string;
};

if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.mapId !== 'foundational_recipe_eligibility_map_v1') fail('map id changed');
if (manifest.status !== 'recipe_eligibility_mapping_ready_for_router_integration') fail(`unexpected status ${manifest.status}`);
if (manifest.ownerDecisionSource !== 'config/foundational-material-complete-v1-owner-decision.json') fail('owner decision source mismatch');
if (manifest.ownerDecision !== ownerDecision.ownerDecision) fail('owner decision mismatch');
if (ownerDecision.nextAllowedStage !== 'foundational_recipe_eligibility_map_v1') fail('owner did not allow this stage');
if (manifest.productionAllowed !== false || ownerDecision.productionAllowed !== false) fail('production must remain blocked');
if (manifest.formalUsablePromotionAllowed !== false || ownerDecision.formalUsablePromotionAllowed !== false) fail('formal promotion must remain blocked');
if (JSON.stringify(manifest.counts) !== JSON.stringify(jsonReport.counts)) fail('json report counts differ');

for (const rule of [
  'This map does not promote any item to production.',
  'Finished content and router proof renders are not foundational inputs.',
  'Noise, air, technical tone, and binaural-offset layers are support-only by default.',
  'Medical, healing, brainwave, frequency-effect, and guaranteed-outcome claims remain forbidden.',
]) {
  if (!manifest.hardRules.includes(rule)) fail(`missing hard rule: ${rule}`);
}

if (manifest.eligibilities.length !== 103) fail(`expected 103 mappings, got ${manifest.eligibilities.length}`);
if (manifest.counts.totalMappings !== 103) fail('total mapping count mismatch');
if (manifest.counts.atomicAudio !== 27) fail('atomic audio count mismatch');
if (manifest.counts.deterministicAudio !== 18) fail('deterministic audio count mismatch');
if (manifest.counts.dspConfigs !== 8) fail('DSP count mismatch');
if (manifest.counts.symbolicRules !== 50) fail('symbolic count mismatch');
if (manifest.counts.productionAllowed !== 0) fail('no mapping can be production allowed');
if (manifest.counts.formalUsable !== 0) fail('no mapping can be formal usable yet');

const ids = new Set<string>();
const roleCounts: Record<string, number> = {};
let audioUrlCount = 0;
for (const item of manifest.eligibilities) {
  if (ids.has(item.id)) fail(`duplicate id ${item.id}`);
  ids.add(item.id);
  roleCounts[item.recipeRole] = (roleCounts[item.recipeRole] ?? 0) + 1;
  if (item.productionAllowed !== false) fail(`${item.id} productionAllowed must be false`);
  if (item.formalUsable !== false) fail(`${item.id} formalUsable must be false`);
  if (item.maxSimultaneousInstances < 1) fail(`${item.id} invalid maxSimultaneousInstances`);
  for (const goal of ['sleep', 'calm', 'focus'] as const) {
    if (!['primary', 'secondary', 'avoid', 'not_applicable'].includes(item.goalSuitability[goal])) fail(`${item.id} invalid ${goal} suitability`);
  }
  for (const exclusion of ['voice', 'medical_or_healing_claim']) {
    if (!item.hardExclusions.includes(exclusion)) fail(`${item.id} missing hard exclusion ${exclusion}`);
  }
  if ((item.goalSuitability.sleep === 'primary' || item.goalSuitability.calm === 'primary') && !item.hardExclusions.includes('drums')) {
    fail(`${item.id} missing Sleep/Calm drum exclusion`);
  }
  if (item.supportOnly && item.foregroundAllowed) fail(`${item.id} is support-only but foregroundAllowed`);
  if (['masking_support', 'technical_reference_signal'].includes(item.recipeRole) && (!item.supportOnly || item.foregroundAllowed)) {
    fail(`${item.id} ${item.recipeRole} must remain support-only foreground-blocked`);
  }
  if (item.sourceKind === 'dsp_config' && !['support_only', 'blocked_from_foreground'].includes(item.routeStatus)) {
    fail(`${item.id} DSP route status must be support_only or blocked_from_foreground`);
  }
  if (item.sourceKind !== 'symbolic_rule') {
    if (typeof item.defaultGainDb !== 'number' || typeof item.minGainDb !== 'number' || typeof item.maxGainDb !== 'number') fail(`${item.id} missing gain limits`);
    const defaultGainDb = item.defaultGainDb as number;
    const minGainDb = item.minGainDb as number;
    const maxGainDb = item.maxGainDb as number;
    if (minGainDb > defaultGainDb || defaultGainDb > maxGainDb) fail(`${item.id} gain range invalid`);
  }
  if (item.audioUrl) {
    audioUrlCount += 1;
    if (!existsSync(path.join(root, 'public', item.audioUrl.replace(/^\//, '')))) fail(`${item.id} missing audio file`);
  }
}

if (audioUrlCount !== 45) fail(`expected 45 audio URLs, got ${audioUrlCount}`);
for (const [role, count] of Object.entries(roleCounts)) {
  if (manifest.byRole[role] !== count) fail(`role count mismatch for ${role}`);
}
for (const requiredRole of [
  'playable_note_source',
  'harmony_cell',
  'melodic_motif',
  'bass_support',
  'environment_identity_bed',
  'organic_texture',
  'accent_transition',
  'masking_support',
  'technical_reference_signal',
  'symbolic_harmony_template',
  'symbolic_motif_template',
  'symbolic_form_rule',
  'symbolic_arrangement_grammar',
]) {
  if (!manifest.byRole[requiredRole]) fail(`missing role ${requiredRole}`);
}

const review = readFileSync(reviewPath, 'utf8');
if (!review.includes('它不是生产批准')) fail('review page must keep production boundary');
if ((review.match(/<article/g) ?? []).length !== 103) fail('review page must show 103 cards');
if ((review.match(/<audio /g) ?? []).length !== 45) fail('review page must expose 45 audio controls');
if (review.includes('atomic-composer-router-proof-v1')) fail('router proof renders must not appear');
if (review.includes('soothing-deterministic-combination-v1')) fail('rejected combination must not appear');

const report = readFileSync(reportPath, 'utf8');
if (!report.includes('The 103 accepted foundational material items have been translated')) fail('report missing verdict');
if (!report.includes('productionAllowed=false')) fail('report missing production boundary');

console.log(JSON.stringify({
  passed: true,
  mapId: manifest.mapId,
  status: manifest.status,
  counts: manifest.counts,
  byRole: manifest.byRole,
  productionAllowed: manifest.productionAllowed,
  reviewUrl: '/review/foundational-recipe-eligibility-map-v1/index.html',
}, null, 2));
