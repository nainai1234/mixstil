import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'config/business-required-audio-elements-v1.json');
const docPath = path.join(root, 'docs/business-required-audio-elements-plan-v1.md');
const fail = (message: string): never => {
  throw new Error(`Business required audio elements validation failed: ${message}`);
};

const config = JSON.parse(await readFile(configPath, 'utf8')) as {
  schemaVersion: string;
  planId: string;
  status: string;
  productionAllowed: boolean;
  scope: { goals: string[]; release: string; primaryUse: string; notPrimaryUse: string };
  milestoneTargets: any;
  hardBusinessRules: string[];
  elementFamilies: Array<{
    id: string;
    businessRole: string;
    runtimeRole: string;
    internalTarget: unknown;
    paidBetaTarget: unknown;
    v1Target: unknown;
    examples: string[];
    allowedSources: string[];
    notAllowedAsSource: string[];
    qa: string[];
  }>;
  defaultProductionOrder: string[];
  immediateCorrectionFromRecentQa: { rejectedBatch: string; ownerFeedback: string; businessInterpretation: string };
};

if (config.schemaVersion !== '1.0.0') fail('schema version changed');
if (config.planId !== 'business-required-audio-elements-v1') fail('plan id changed');
if (config.status !== 'business_inventory_contract') fail('status must be business_inventory_contract');
if (config.productionAllowed !== false) fail('business contract must not allow production by itself');
for (const goal of ['sleep', 'calm', 'focus']) {
  if (!config.scope.goals.includes(goal)) fail(`missing goal ${goal}`);
}
if (config.scope.release !== 'voice-free-beta') fail('release scope must stay voice-free beta');
if (!config.scope.notPrimaryUse.includes('finished song')) fail('scope must reject fixed finished-song generation as primary use');

const milestones = config.milestoneTargets;
if (milestones.internalAudibleBaseline.finishedContent !== 30) fail('internal finished-content target must be 30');
if (milestones.internalAudibleBaseline.foundationalElements.min !== 80 || milestones.internalAudibleBaseline.foundationalElements.max !== 100) fail('internal foundational target must be 80-100');
if (milestones.paidBetaBaseline.foundationalElements.min !== 150 || milestones.paidBetaBaseline.foundationalElements.max !== 250) fail('paid beta foundational target must be 150-250');
if (milestones.v1Library.foundationalElements.min !== 400 || milestones.v1Library.foundationalElements.max !== 600) fail('V1 foundational target must be 400-600');

for (const rule of [
  'Do not count a finished song as a foundational element.',
  'Do not let generic broadband noise become the main product identity.',
  'Do not use human voice, singing, chanting, choir, or human-like vocal texture in Voice-free Beta.',
  'Do not make medical, healing, brainwave, heart-rate, cure, or guaranteed-outcome claims.',
]) {
  if (!config.hardBusinessRules.includes(rule)) fail(`missing hard business rule: ${rule}`);
}

const requiredFamilies = [
  'playable_instrument_sources',
  'structured_composition_material',
  'music_beds_and_phrases',
  'environment_identity_beds',
  'masking_and_noise_support',
  'organic_textures',
  'accent_and_transition_events',
  'precise_dsp_configs',
  'finished_reference_and_seed_content',
];
const families = new Map(config.elementFamilies.map((family) => [family.id, family]));
for (const id of requiredFamilies) {
  const family = families.get(id);
  if (!family) fail(`missing family ${id}`);
  if (!family.businessRole || !family.runtimeRole) fail(`${id} missing business/runtime role`);
  if (!family.examples.length || !family.allowedSources.length || !family.notAllowedAsSource.length || !family.qa.length) fail(`${id} must define examples, sources, exclusions, and QA`);
}

const environment = families.get('environment_identity_beds')!;
if (!environment.notAllowedAsSource.some((item) => item.includes('highway-like'))) fail('environment family must block highway-like whoosh');
const masking = families.get('masking_and_noise_support')!;
if (!masking.notAllowedAsSource.some((item) => item.includes('default result'))) fail('masking/noise must not become default result');
const finished = families.get('finished_reference_and_seed_content')!;
if (!finished.notAllowedAsSource.some((item) => item.includes('basic element'))) fail('finished content must not be counted as basic element');

if (config.immediateCorrectionFromRecentQa.rejectedBatch !== 'soothing-deterministic-combination-v1') fail('recent rejected batch link missing');
if (!config.immediateCorrectionFromRecentQa.ownerFeedback.includes('cars on a highway')) fail('owner highway feedback missing');
if (!config.immediateCorrectionFromRecentQa.businessInterpretation.includes('generic continuous noise')) fail('business interpretation must mention generic continuous noise');

const doc = await readFile(docPath, 'utf8');
for (const text of [
  'We should not ask: "What sound should this failed batch become?"',
  'Required Element Families',
  'The product does not need generic continuous noise as the default main layer.',
  'Create an inventory audit against `business-required-audio-elements-v1`',
]) {
  if (!doc.includes(text)) fail(`document missing required text: ${text}`);
}

console.log(JSON.stringify({
  passed: true,
  planId: config.planId,
  familyCount: config.elementFamilies.length,
  goals: config.scope.goals,
  internalFoundationalTarget: config.milestoneTargets.internalAudibleBaseline.foundationalElements,
  paidBetaFoundationalTarget: config.milestoneTargets.paidBetaBaseline.foundationalElements,
  productionAllowed: config.productionAllowed,
}, null, 2));
