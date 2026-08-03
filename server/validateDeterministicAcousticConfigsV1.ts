import { readFileSync } from 'node:fs';
import path from 'node:path';

type Config = {
  id: string;
  type: 'noise' | 'sine_tone' | 'binaural_offset';
  label: string;
  role: string;
  goals: string[];
  parameters: Record<string, unknown>;
  renderPolicy: { loopable: boolean; defaultDurationSeconds: number; crossfadeSeconds: number; seeded: boolean };
  safety: { voiceFree: boolean; maxTruePeakDb: number; medicalClaimAllowed: boolean; requiresStereoPlayback?: boolean };
  notes: string;
};

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Deterministic acoustic config validation failed: ${message}`); };
const payload = JSON.parse(readFileSync(path.join(root, 'config/deterministic-acoustic-configs-v1.json'), 'utf8')) as {
  schemaVersion: string;
  registryId: string;
  status: string;
  productionAllowed: boolean;
  claimPolicy: { forbidden: string[] };
  configs: Config[];
};

if (payload.schemaVersion !== '1.0.0') fail(`unexpected schema ${payload.schemaVersion}`);
if (payload.registryId !== 'deterministic-acoustic-configs-v1') fail('registry id changed');
if (payload.status !== 'formal_usable_parameters') fail(`unexpected status ${payload.status}`);
if (payload.productionAllowed !== false) fail('registry must remain non-production until renderer proof exists');
if (payload.configs.length !== 8) fail(`expected 8 configs, received ${payload.configs.length}`);

const ids = new Set<string>();
const typeCounts = new Map<string, number>();
const forbiddenText = ['healing', 'repair frequency', 'brainwave entrainment claim', 'lower heart rate', 'treat', 'cure', 'diagnose', 'guarantee', 'sleep induction'];

for (const config of payload.configs) {
  if (ids.has(config.id)) fail(`duplicate id ${config.id}`);
  ids.add(config.id);
  typeCounts.set(config.type, (typeCounts.get(config.type) ?? 0) + 1);
  if (!config.label || !config.role || config.goals.length === 0) fail(`${config.id} missing display or role metadata`);
  if (!config.safety.voiceFree) fail(`${config.id} must be voice-free`);
  if (config.safety.medicalClaimAllowed !== false) fail(`${config.id} allows medical claims`);
  if (!Number.isFinite(config.safety.maxTruePeakDb) || config.safety.maxTruePeakDb > -3) fail(`${config.id} unsafe true peak limit`);
  if (!config.renderPolicy.loopable || config.renderPolicy.defaultDurationSeconds < 30) fail(`${config.id} render policy is not loopable enough`);
  const combinedText = `${config.label} ${config.role} ${config.notes}`.toLowerCase();
  for (const forbidden of forbiddenText) {
    if (combinedText.includes(forbidden.toLowerCase())) fail(`${config.id} uses forbidden claim term ${forbidden}`);
  }
  const sampleRate = Number(config.parameters.sampleRate);
  if (sampleRate !== 44100 && sampleRate !== 48000) fail(`${config.id} unsupported sample rate ${sampleRate}`);
  const defaultGainDb = Number(config.parameters.defaultGainDb);
  const maxGainDb = Number(config.parameters.maxGainDb);
  if (!Number.isFinite(defaultGainDb) || !Number.isFinite(maxGainDb) || defaultGainDb > maxGainDb || maxGainDb > -12) fail(`${config.id} has unsafe gain settings`);
  if (config.type === 'noise') {
    if (!['white', 'pink', 'brown', 'pink_brown_hybrid', 'bandlimited_pink'].includes(String(config.parameters.color))) fail(`${config.id} has invalid noise color`);
  }
  if (config.type === 'sine_tone') {
    const frequency = Number(config.parameters.frequencyHz);
    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 12000) fail(`${config.id} invalid frequency`);
  }
  if (config.type === 'binaural_offset') {
    const left = Number(config.parameters.leftHz);
    const right = Number(config.parameters.rightHz);
    const offset = Number(config.parameters.offsetHz);
    if (config.safety.requiresStereoPlayback !== true) fail(`${config.id} must require stereo playback`);
    if (Math.abs(right - left - offset) > 0.001) fail(`${config.id} left/right frequencies do not match offset`);
  }
}

if ((typeCounts.get('noise') ?? 0) !== 6) fail('expected six noise configs');
if ((typeCounts.get('sine_tone') ?? 0) !== 1) fail('expected one sine tone config');
if ((typeCounts.get('binaural_offset') ?? 0) !== 1) fail('expected one binaural offset config');
if (!payload.claimPolicy.forbidden.some((item) => /healing/i.test(item))) fail('claim policy must explicitly forbid healing claims');

console.log(JSON.stringify({
  passed: true,
  registryId: payload.registryId,
  configCount: payload.configs.length,
  typeCounts: Object.fromEntries(typeCounts),
  productionAllowed: payload.productionAllowed,
}, null, 2));
