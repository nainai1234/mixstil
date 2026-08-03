import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { foundationalElements } from './foundationalElementProduction';

type Baseline = {
  schemaVersion: string;
  baselineId: string;
  status: string;
  productionAllowed: boolean;
  targets: Record<string, number>;
  sourceRegisters: {
    existingLyriaElements: { path: string };
    lyriaExpansionCandidates: { path: string; requiredProductionAllowed: boolean; expectedCandidates: number };
    compositionMaterialLibrary: { path: string };
    formalNonMusicElements: { path: string };
    localInstrumentSources: { items: Array<{ id: string; path: string; sourceType: string }> };
  };
  promotionGates: Record<string, string[]>;
};

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Foundational elements formal baseline validation failed: ${message}`); };
const baseline = JSON.parse(readFileSync(path.join(root, 'config/foundational-elements-formal-baseline-v1.json'), 'utf8')) as Baseline;

if (baseline.schemaVersion !== '1.0.0') fail(`unexpected schema version ${baseline.schemaVersion}`);
if (baseline.baselineId !== 'foundational-elements-formal-baseline-v1') fail('baseline id changed');
if (baseline.status !== 'formal_gate_defined') fail(`unexpected baseline status ${baseline.status}`);
if (baseline.productionAllowed !== false) fail('baseline must not be production allowed');

const targets = baseline.targets;
const requiredTargets = ['instrument_source', 'music_template', 'motif', 'pad_drone', 'environment_bed', 'organic_texture', 'accent_one_shot', 'deterministic_acoustic_config'] as const;
for (const key of requiredTargets) {
  if (!Number.isInteger(targets[key]) || targets[key] <= 0) fail(`target ${key} is invalid`);
}

const sourcePaths = [
  baseline.sourceRegisters.existingLyriaElements.path,
  baseline.sourceRegisters.lyriaExpansionCandidates.path,
  baseline.sourceRegisters.compositionMaterialLibrary.path,
  baseline.sourceRegisters.formalNonMusicElements.path,
  ...baseline.sourceRegisters.localInstrumentSources.items.map((item) => item.path),
];
for (const relative of sourcePaths) {
  if (!existsSync(path.join(root, relative))) fail(`missing source path ${relative}`);
}

if (baseline.sourceRegisters.lyriaExpansionCandidates.expectedCandidates !== 60) fail('lyria expansion candidate count drifted');
if (baseline.sourceRegisters.lyriaExpansionCandidates.requiredProductionAllowed !== false) fail('lyria expansion candidates must remain non-production');

if (foundationalElements.length !== 24) fail(`expected 24 formal Lyria elements, received ${foundationalElements.length}`);

const formalCounts = {
  instrument_source: 0,
  music_template: 0,
  motif: 0,
  pad_drone: 0,
  environment_bed: 0,
  organic_texture: 0,
  accent_one_shot: 0,
  deterministic_acoustic_config: 0,
};

const compositionLibrary = JSON.parse(readFileSync(path.join(root, 'config/composition-material-library-v1.json'), 'utf8')) as {
  harmonyPool?: Array<any>;
  motifPool?: Array<any>;
  formPool?: Array<any>;
  grammarPool?: Array<any>;
};
const instrumentRegistry = JSON.parse(readFileSync(path.join(root, 'config/instrument-source-registry-v1.json'), 'utf8')) as {
  productionAllowed: boolean;
  sources?: Array<{ status: string }>;
};
const deterministicConfigs = JSON.parse(readFileSync(path.join(root, 'config/deterministic-acoustic-configs-v1.json'), 'utf8')) as {
  productionAllowed: boolean;
  configs?: Array<any>;
};
const nonMusicRegistry = JSON.parse(readFileSync(path.join(root, baseline.sourceRegisters.formalNonMusicElements.path), 'utf8')) as {
  productionAllowed: boolean;
  targetsFilledByRegistry?: Partial<Record<'pad_drone' | 'environment_bed' | 'organic_texture' | 'accent_one_shot', number>>;
};

const harmonyCount = Array.isArray(compositionLibrary.harmonyPool) ? compositionLibrary.harmonyPool.length : 0;
const motifCount = Array.isArray(compositionLibrary.motifPool) ? compositionLibrary.motifPool.length : 0;
if (harmonyCount !== targets.music_template) fail(`expected ${targets.music_template} harmony templates, received ${harmonyCount}`);
if (motifCount !== targets.motif) fail(`expected ${targets.motif} motifs, received ${motifCount}`);

formalCounts.music_template = harmonyCount;
formalCounts.motif = motifCount;

const categories = new Map<string, number>();
for (const element of foundationalElements) {
  const family = element.family;
  if (/pad/.test(family) || /drone/.test(family)) formalCounts.pad_drone += 1;
  if (/wind|rain|ocean|embers|forest|ventilation/.test(family)) formalCounts.environment_bed += 1;
  if (/mist|glass|harmonics|wood/.test(family)) formalCounts.organic_texture += 1;
  if (/singing_bowl|temple_bell|wood_chime/.test(family)) formalCounts.accent_one_shot += 1;
  categories.set(element.elementRole, (categories.get(element.elementRole) ?? 0) + 1);
  if (!element.tags.includes('voice_free')) fail(`${element.id} is not voice-free`);
}

formalCounts.instrument_source = instrumentRegistry.sources?.filter((source) => source.status === 'formal_candidate').length ?? 0;
formalCounts.deterministic_acoustic_config = deterministicConfigs.configs?.length ?? 0;
if (nonMusicRegistry.productionAllowed !== false) fail('formal non-music registry must remain non-production');
formalCounts.pad_drone += nonMusicRegistry.targetsFilledByRegistry?.pad_drone ?? 0;
formalCounts.environment_bed += nonMusicRegistry.targetsFilledByRegistry?.environment_bed ?? 0;
formalCounts.organic_texture += nonMusicRegistry.targetsFilledByRegistry?.organic_texture ?? 0;
formalCounts.accent_one_shot += nonMusicRegistry.targetsFilledByRegistry?.accent_one_shot ?? 0;

for (const key of requiredTargets) {
  if (formalCounts[key] < targets[key]) fail(`formal target ${key} is not filled: ${formalCounts[key]}/${targets[key]}`);
}

if ([...categories.values()].reduce((total, count) => total + count, 0) !== 24) fail('legacy Lyria role count drifted');

console.log(JSON.stringify({
  passed: true,
  formalTargets: targets,
  currentFormalCounts: formalCounts,
  legacyLyriaRoleCounts: Object.fromEntries(categories),
  formalGap: {
    instrument_source: targets.instrument_source - formalCounts.instrument_source,
    music_template: targets.music_template - formalCounts.music_template,
    motif: targets.motif - formalCounts.motif,
    pad_drone: targets.pad_drone - formalCounts.pad_drone,
    environment_bed: targets.environment_bed - formalCounts.environment_bed,
    organic_texture: targets.organic_texture - formalCounts.organic_texture,
    accent_one_shot: targets.accent_one_shot - formalCounts.accent_one_shot,
    deterministic_acoustic_config: targets.deterministic_acoustic_config - formalCounts.deterministic_acoustic_config,
  },
}, null, 2));
