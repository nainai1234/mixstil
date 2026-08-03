import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { coreStemIds, selectFoundationalElementRecipe, type ProductGoal, type ProductScene } from './contentCatalog';
import { foundationalElements } from './foundationalElementProduction';
import { upgradeRecipeToV2, validateRecipeV2 } from './recipeV2';

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Foundational element catalog validation failed: ${message}`); };
if (foundationalElements.length !== 24) fail(`expected 24 elements, received ${foundationalElements.length}`);
const ids = new Set<string>();
const families = new Map<string, number>();
for (const element of foundationalElements) {
  if (ids.has(element.id)) fail(`duplicate element ${element.id}`);
  ids.add(element.id);
  families.set(element.family, (families.get(element.family) ?? 0) + 1);
  const filePath = path.join(root, 'public', element.audioUrl.replace(/^\//, ''));
  if (!existsSync(filePath)) fail(`${element.id} audio is missing`);
  const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  if (hash !== element.sha256) fail(`${element.id} hash changed`);
  if (element.qa.status !== 'approved' || !element.rights.commercialUseAllowed || !element.rights.derivativeUseAllowed) fail(`${element.id} is not approved for the product`);
  if (element.acoustic.codec !== 'mp3' || element.acoustic.sampleRate !== 44100 || element.acoustic.channels !== 2) fail(`${element.id} format is invalid`);
  if (element.acoustic.durationSeconds < 19 || element.acoustic.truePeakDb > -3) fail(`${element.id} duration or peak is unsafe`);
  if (!coreStemIds.includes(element.id as any)) fail(`${element.id} is absent from the core catalog`);
}
if (families.size !== 8 || [...families.values()].some((count) => count !== 3)) fail('expected eight families with three variants each');

const cases: Array<{ goal: ProductGoal; scene: ProductScene; prompt: string }> = [
  { goal: 'sleep', scene: 'bedtime', prompt: 'Warm sleep music with sparse felt piano, no voice or drums.' },
  { goal: 'calm', scene: 'emotional_settling', prompt: 'Meditation music with warm Rhodes and open space.' },
  { goal: 'focus', scene: 'deep_focus', prompt: 'Steady focus music with soft nylon guitar and no vocals.' },
];
for (const item of cases) {
  const uniqueSelections = new Set<string>();
  for (let index = 0; index < 20; index += 1) {
    const selection = selectFoundationalElementRecipe({ ...item, contentMode: 'functional_music', excludedSounds: ['voice'], selectionKey: `request-${index}` });
    if (!selection) fail(`${item.goal} did not produce an element composition`);
    if (selection.plan.runtimeExternalApiUsed !== false || selection.plan.selected.length !== 3) fail(`${item.goal} plan contract is invalid`);
    if (selection.recipe.tracks.some((track) => !ids.has(track.stemId))) fail(`${item.goal} selected an unknown element`);
    const errors = validateRecipeV2(upgradeRecipeToV2(selection.recipe, `validation-${index}`));
    if (errors.length > 0) fail(`${item.goal} produced invalid Recipe V2: ${errors.join(', ')}`);
    uniqueSelections.add(selection.plan.selected.map((entry) => entry.stemId).sort().join('|'));
  }
  if (uniqueSelections.size < 4) fail(`${item.goal} only produced ${uniqueSelections.size} distinct combinations across 20 requests`);
}

const piano = selectFoundationalElementRecipe({ prompt: 'Sleep music with felt piano', goal: 'sleep', scene: 'bedtime', contentMode: 'functional_music', excludedSounds: [], selectionKey: 'piano' });
if (!piano?.plan.selected.some((entry) => entry.family === 'felt_piano_phrase')) fail('explicit piano request was ignored');
const withoutPiano = selectFoundationalElementRecipe({ prompt: 'Sleep music without piano', goal: 'sleep', scene: 'bedtime', contentMode: 'functional_music', excludedSounds: [], selectionKey: 'no-piano' });
if (!withoutPiano || withoutPiano.plan.selected.some((entry) => entry.family === 'felt_piano_phrase')) fail('explicit piano exclusion was ignored');
const withoutMusic = selectFoundationalElementRecipe({ prompt: 'Only steady rain, no music', goal: 'sleep', scene: 'bedtime', contentMode: 'pure_soundscape', excludedSounds: ['music'], selectionKey: 'no-music' });
if (withoutMusic !== null) fail('music exclusion must bypass foundational elements');

console.log('PASS: 24 approved foundational elements, eight families, deterministic compatibility selection, instrument requests and exclusions, runtime no-API policy, and Recipe V2 validity verified.');
