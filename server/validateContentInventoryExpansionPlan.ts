import { readFileSync } from 'node:fs';

type Goal = 'sleep' | 'calm' | 'focus';
type Category = 'masking' | 'environment' | 'organic_texture' | 'safe_accent';

const payload = JSON.parse(readFileSync(new URL('../config/content-inventory-expansion-v2.json', import.meta.url), 'utf8')) as any;
const fail = (message: string): never => { throw new Error(`Content inventory expansion plan invalid: ${message}`); };
const assert = (condition: unknown, message: string) => { if (!condition) fail(message); };

assert(payload.schemaVersion === '2.0.0', 'unexpected schema version');
assert(payload.routingPolicy?.fullTrackExternalGenerationAllowed === false, 'external full-track generation must remain blocked');
assert(payload.routingPolicy?.externalGenerationScope === 'one_missing_stem_only', 'external generation must be limited to one missing Stem');
assert(payload.routingPolicy?.inventoryOnlyTargetRatio >= 0.85, 'inventory-only target must be at least 85%');
assert(payload.routingPolicy?.paidApiMaximumRatio <= 0.05, 'paid API target must not exceed 5%');

const kits = Array.isArray(payload.musicKits) ? payload.musicKits : [];
assert(kits.length === payload.targets.musicKits, `expected ${payload.targets.musicKits} kits, received ${kits.length}`);
assert(new Set(kits.map((kit: any) => kit.id)).size === kits.length, 'duplicate MusicKit profile ids');

const goals: Goal[] = ['sleep', 'calm', 'focus'];
for (const goal of goals) {
  const count = kits.filter((kit: any) => kit.goal === goal).length;
  assert(count === payload.targets.goalDistribution[goal], `${goal} expected ${payload.targets.goalDistribution[goal]} kits, received ${count}`);
}

const allowedSources = new Set([
  'approved_cc0',
  'source_acquisition_required',
  'commissioned_recording_required',
]);
for (const kit of kits) {
  assert(['approved', 'planned'].includes(kit.status), `${kit.id} has invalid status`);
  assert(allowedSources.has(kit.sourceRoute), `${kit.id} has invalid source route`);
  assert(Array.isArray(kit.tempoRange) && kit.tempoRange.length === 2 && kit.tempoRange[0] <= kit.tempoRange[1], `${kit.id} has invalid tempo range`);
  assert(Array.isArray(kit.environmentCompatibility) && kit.environmentCompatibility.length > 0, `${kit.id} lacks environment compatibility`);
  assert(Array.isArray(kit.forbidden) && kit.forbidden.length >= 4, `${kit.id} lacks forbidden-feature gates`);
}

const families = Array.isArray(payload.materialFamilies) ? payload.materialFamilies : [];
const expected: Record<Category, number> = {
  masking: payload.targets.maskingBeds,
  environment: payload.targets.environmentBeds,
  organic_texture: payload.targets.organicTextures,
  safe_accent: payload.targets.safeAccents,
};
for (const [category, target] of Object.entries(expected)) {
  const count = families.filter((item: any) => item.category === category).reduce((total: number, item: any) => total + Number(item.targetCount), 0);
  assert(count === target, `${category} expected ${target} assets, received ${count}`);
}
for (const family of families) {
  assert(Number.isInteger(family.targetCount) && family.targetCount > 0, `${family.id} has invalid target count`);
  assert(Array.isArray(family.requirements) && family.requirements.length >= 3, `${family.id} lacks QA requirements`);
}

const expectedStemCount = payload.targets.musicKits * payload.targets.musicStemRoles.length;
assert(payload.targets.musicStems === expectedStemCount, `music stem target must be ${expectedStemCount}`);

console.log(JSON.stringify({
  passed: true,
  musicKits: kits.length,
  musicStems: payload.targets.musicStems,
  approvedKits: kits.filter((kit: any) => kit.status === 'approved').length,
  plannedKits: kits.filter((kit: any) => kit.status === 'planned').length,
  nonMusicAssets: Object.values(expected).reduce((total, count) => total + count, 0),
  goalDistribution: payload.targets.goalDistribution,
  inventoryOnlyTargetRatio: payload.routingPolicy.inventoryOnlyTargetRatio,
  paidApiMaximumRatio: payload.routingPolicy.paidApiMaximumRatio,
}, null, 2));
