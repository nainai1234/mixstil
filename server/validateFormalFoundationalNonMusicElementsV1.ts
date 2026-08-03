import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type CountAs = 'pad_drone' | 'environment_bed' | 'organic_texture' | 'accent_one_shot';
type LyriaFamily = {
  id: string;
  sourceManifest: 'lyriaSingleElementPilotV1' | 'lyriaFoundationalExpansionV2';
  countAs: CountAs;
  expectedVariants: number;
  includedVariants?: number[];
  status: 'formal_candidate';
  loopMode: 'crossfade' | 'one_shot';
  humanGate: 'required';
};
type DeterministicAccent = {
  id: string;
  countAs: 'accent_one_shot';
  status: 'formal_candidate';
  generator: 'deterministic_dsp';
  label: string;
  goals: string[];
  parameters: Record<string, unknown>;
  onsetPolicy: { expectedOnsets: number; tailSeconds: number; loopable: boolean };
  safety: { voiceFree: boolean; medicalClaimAllowed: boolean; maxTruePeakDb: number };
};
type DeterministicEnvironment = {
  id: string;
  countAs: 'environment_bed';
  status: 'formal_candidate';
  generator: 'deterministic_dsp';
  label: string;
  goals: string[];
  parameters: Record<string, unknown>;
  renderPolicy: { loopable: boolean; seeded: boolean; defaultDurationSeconds: number; crossfadeSeconds: number };
  safety: { voiceFree: boolean; medicalClaimAllowed: boolean; maxTruePeakDb: number };
};

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Formal foundational non-music element validation failed: ${message}`); };

const registry = JSON.parse(readFileSync(path.join(root, 'config/formal-foundational-non-music-elements-v1.json'), 'utf8')) as {
  schemaVersion: string;
  registryId: string;
  status: string;
  productionAllowed: boolean;
  sourceManifests: Record<string, string>;
  targetsFilledByRegistry: Record<CountAs, number>;
  lyriaCandidateFamilies: LyriaFamily[];
  deterministicEnvironmentConfigs: DeterministicEnvironment[];
  deterministicAccentConfigs: DeterministicAccent[];
};

if (registry.schemaVersion !== '1.0.0') fail(`unexpected schema ${registry.schemaVersion}`);
if (registry.registryId !== 'formal-foundational-non-music-elements-v1') fail('registry id changed');
if (registry.status !== 'formal_candidate_registry') fail(`unexpected status ${registry.status}`);
if (registry.productionAllowed !== false) fail('registry must remain non-production until human and runtime gates pass');

const manifests = Object.fromEntries(Object.entries(registry.sourceManifests).map(([key, relative]) => {
  const fullPath = path.join(root, relative);
  if (!existsSync(fullPath)) fail(`missing source manifest ${relative}`);
  return [key, JSON.parse(readFileSync(fullPath, 'utf8'))];
}));

const counts: Record<CountAs, number> = { pad_drone: 0, environment_bed: 0, organic_texture: 0, accent_one_shot: 0 };
const familyIds = new Set<string>();
const forbiddenPromptTerms = ['singing', 'spoken voice', 'human voice', 'choir', 'chanting'];

for (const family of registry.lyriaCandidateFamilies) {
  if (familyIds.has(family.id)) fail(`duplicate family ${family.id}`);
  familyIds.add(family.id);
  if (family.status !== 'formal_candidate' || family.humanGate !== 'required') fail(`${family.id} bypasses formal candidate gates`);
  const source = manifests[family.sourceManifest] as { productionAllowed: boolean; candidates: Array<any> } | undefined;
  if (!source) fail(`${family.id} references unknown source manifest ${family.sourceManifest}`);
  if (source.productionAllowed !== false) fail(`${family.id} source manifest unexpectedly allows production`);
  const candidates = source.candidates.filter((candidate) => candidate.id === family.id && (!family.includedVariants || family.includedVariants.includes(candidate.variant)));
  if (candidates.length !== family.expectedVariants) fail(`${family.id} expected ${family.expectedVariants} variants, received ${candidates.length}`);
  const variants = new Set(candidates.map((candidate) => candidate.variant));
  if (variants.size !== family.expectedVariants) fail(`${family.id} has duplicate variants`);
  for (const candidate of candidates) {
    if (candidate.productionAllowed !== false) fail(`${candidate.candidateId} is unexpectedly production allowed`);
    const prompt = String(candidate.prompt ?? '').toLowerCase();
    if (!forbiddenPromptTerms.some((term) => prompt.includes(term))) fail(`${candidate.candidateId} prompt lacks explicit voice-family exclusion`);
    const audioUrl = String(candidate.preparedAudioUrl ?? candidate.audioUrl ?? '');
    if (!audioUrl.startsWith('/audio/music/local-review/')) fail(`${candidate.candidateId} has invalid audio url`);
    const audioPath = path.join(root, 'public', audioUrl.replace(/^\//, ''));
    if (!existsSync(audioPath) || statSync(audioPath).size < 25_000) fail(`${candidate.candidateId} audio file missing or too small`);
    const analysis = candidate.preparedAnalysis ?? candidate.metrics;
    if (!analysis || !Number.isFinite(Number(analysis.durationSeconds)) || Number(analysis.durationSeconds) < 3) fail(`${candidate.candidateId} missing usable duration`);
    if (family.loopMode === 'crossfade' && Number(analysis.durationSeconds) < 20) fail(`${candidate.candidateId} is too short for a crossfaded bed`);
    if (family.loopMode === 'one_shot' && Number(analysis.durationSeconds) > 8) fail(`${candidate.candidateId} is too long for one-shot review`);
    if (candidate.preparedAnalysis) {
      if (candidate.preparedAnalysis.humanIdentityStatus !== 'pending' || candidate.preparedAnalysis.humanVoiceStatus !== 'pending') fail(`${candidate.candidateId} human gates changed unexpectedly`);
      if (!['pass', 'review'].includes(candidate.preparedAnalysis.technicalStatus)) fail(`${candidate.candidateId} has invalid technical status`);
      if (Number(candidate.preparedAnalysis.peakDbfs) > -3.5) fail(`${candidate.candidateId} prepared peak is unsafe`);
    }
  }
  counts[family.countAs] += family.expectedVariants;
}

for (const config of registry.deterministicEnvironmentConfigs) {
  if (familyIds.has(config.id)) fail(`duplicate deterministic id ${config.id}`);
  familyIds.add(config.id);
  if (config.status !== 'formal_candidate' || config.generator !== 'deterministic_dsp') fail(`${config.id} has invalid deterministic identity`);
  if (!config.safety.voiceFree || config.safety.medicalClaimAllowed !== false || config.safety.maxTruePeakDb > -3) fail(`${config.id} has unsafe safety policy`);
  if (!config.renderPolicy.loopable || !config.renderPolicy.seeded || config.renderPolicy.defaultDurationSeconds < 60) fail(`${config.id} has invalid environment render policy`);
  const defaultGainDb = Number(config.parameters.defaultGainDb);
  const maxGainDb = Number(config.parameters.maxGainDb);
  if (!Number.isFinite(defaultGainDb) || !Number.isFinite(maxGainDb) || defaultGainDb > maxGainDb || maxGainDb > -12) fail(`${config.id} has unsafe gain range`);
  const combined = `${config.id} ${config.label}`.toLowerCase();
  for (const forbidden of ['healing', 'treat', 'cure', 'diagnose', 'brainwave', 'heart rate']) {
    if (combined.includes(forbidden)) fail(`${config.id} contains forbidden claim term ${forbidden}`);
  }
  counts.environment_bed += 1;
}

for (const config of registry.deterministicAccentConfigs) {
  if (familyIds.has(config.id)) fail(`duplicate deterministic id ${config.id}`);
  familyIds.add(config.id);
  if (config.status !== 'formal_candidate' || config.generator !== 'deterministic_dsp') fail(`${config.id} has invalid deterministic identity`);
  if (!config.safety.voiceFree || config.safety.medicalClaimAllowed !== false || config.safety.maxTruePeakDb > -3) fail(`${config.id} has unsafe safety policy`);
  if (config.onsetPolicy.expectedOnsets !== 1 || config.onsetPolicy.loopable !== false || config.onsetPolicy.tailSeconds < 0.5) fail(`${config.id} has invalid one-shot policy`);
  const defaultGainDb = Number(config.parameters.defaultGainDb);
  const maxGainDb = Number(config.parameters.maxGainDb);
  if (!Number.isFinite(defaultGainDb) || !Number.isFinite(maxGainDb) || defaultGainDb > maxGainDb || maxGainDb > -12) fail(`${config.id} has unsafe gain range`);
  const combined = `${config.id} ${config.label}`.toLowerCase();
  for (const forbidden of ['healing', 'treat', 'cure', 'diagnose', 'brainwave', 'heart rate']) {
    if (combined.includes(forbidden)) fail(`${config.id} contains forbidden claim term ${forbidden}`);
  }
  counts.accent_one_shot += 1;
}

for (const [key, expected] of Object.entries(registry.targetsFilledByRegistry) as Array<[CountAs, number]>) {
  if (counts[key] !== expected) fail(`${key} expected ${expected}, received ${counts[key]}`);
}

console.log(JSON.stringify({
  passed: true,
  registryId: registry.registryId,
  productionAllowed: registry.productionAllowed,
  counts,
  lyriaFamilies: registry.lyriaCandidateFamilies.length,
  deterministicAccentConfigs: registry.deterministicAccentConfigs.length,
}, null, 2));
