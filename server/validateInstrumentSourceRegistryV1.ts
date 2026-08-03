import { readFileSync } from 'node:fs';
import path from 'node:path';

type Registry = {
  schemaVersion: string;
  registryId: string;
  status: string;
  productionAllowed: boolean;
  targets: { instrumentSourceCount: number; instrumentTypes: string[] };
  sources: Array<{
    id: string;
    label: string;
    instrumentType: string;
    sourceType: string;
    status: string;
    assetPath: string;
    sourceRecord: string;
    license?: { name: string; url: string };
    candidateInstruments: string[];
    verifiedNoteRange: string;
    runtimeLoader: string;
    notes: string;
  }>;
};

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Instrument source registry validation failed: ${message}`); };
const registry = JSON.parse(readFileSync(path.join(root, 'config/instrument-source-registry-v1.json'), 'utf8')) as Registry;

if (registry.schemaVersion !== '1.0.0') fail(`unexpected schema version ${registry.schemaVersion}`);
if (registry.registryId !== 'instrument-source-registry-v1') fail('registry id changed');
if (registry.status !== 'formal_gate_defined') fail(`unexpected registry status ${registry.status}`);
if (registry.productionAllowed !== false) fail('registry must remain non-production');
if (registry.targets.instrumentSourceCount !== 6) fail(`expected 6 sources, received ${registry.targets.instrumentSourceCount}`);

const ids = new Set<string>();
const instrumentTypes = new Set<string>();
for (const source of registry.sources) {
  if (ids.has(source.id)) fail(`duplicate source ${source.id}`);
  ids.add(source.id);
  instrumentTypes.add(source.instrumentType);
  if (!source.assetPath.startsWith('assets/')) fail(`${source.id} must point to a local asset path`);
  if (!source.sourceRecord.startsWith('docs/')) fail(`${source.id} must have a source record`);
  if (!source.runtimeLoader) fail(`${source.id} is missing runtime loader`);
  if (!source.verifiedNoteRange) fail(`${source.id} is missing verified note range`);
  if (!Array.isArray(source.candidateInstruments) || source.candidateInstruments.length === 0) fail(`${source.id} is missing candidate instruments`);
  if (source.status !== 'formal_candidate') fail(`${source.id} must remain a formal candidate until runtime audition and license verification pass`);
}

if (registry.sources.length !== 6) fail(`expected 6 sources, received ${registry.sources.length}`);

for (const requiredType of ['piano', 'electric_piano', 'nylon_guitar', 'steel_string_guitar', 'bass', 'woodwinds']) {
  if (!registry.targets.instrumentTypes.includes(requiredType)) fail(`missing target instrument type ${requiredType}`);
}

console.log(JSON.stringify({
  passed: true,
  registryId: registry.registryId,
  sourceCount: registry.sources.length,
  instrumentTypes: [...instrumentTypes],
  productionAllowed: registry.productionAllowed,
  formalCandidateCount: registry.sources.filter((source) => source.status === 'formal_candidate').length,
}, null, 2));
