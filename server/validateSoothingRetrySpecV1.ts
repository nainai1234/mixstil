import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Soothing retry spec validation failed: ${message}`); };
const docPath = path.join(root, 'docs/soothing-light-music-and-meditation-structure-v1.md');
const configPath = path.join(root, 'config/foundational-element-soothing-retry-v1.json');

if (!existsSync(docPath)) fail('soothing structure document is missing');
if (!existsSync(configPath)) fail('soothing retry config is missing');

const doc = readFileSync(docPath, 'utf8');
const config = JSON.parse(readFileSync(configPath, 'utf8')) as {
  schemaVersion: string;
  batchId: string;
  productionAllowed: boolean;
  variantsPerFamily: number;
  targetFamilyCount: number;
  targetCandidateCount: number;
  soothingProfile: {
    preferredPreparedOnsetDensityPerSecondMax: Record<string, number>;
    preferredSpectralCentroidHzMax: Record<string, number>;
    promptRequirements: string[];
    globalPromptSuffix: string;
  };
  families: Array<{
    id: string;
    category: 'environment' | 'texture' | 'instrument' | 'accent';
    role: string;
    goals: string[];
    loopMode: 'crossfade' | 'one_shot';
    prompt: string;
  }>;
};

if (config.schemaVersion !== '1.0.0') fail(`unexpected schema ${config.schemaVersion}`);
if (config.batchId !== 'lyria-foundational-soothing-retry-v1') fail('batch id changed');
if (config.productionAllowed !== false) fail('soothing retry batch must not be production allowed');
if (config.variantsPerFamily !== 3 || config.targetFamilyCount !== 12 || config.targetCandidateCount !== 36 || config.families.length !== 12) fail('retry batch size drifted');

for (const required of [
  'no drums',
  'no percussion',
  'no beat',
  'no rhythmic pulse',
  'no groove',
  'no kick',
  'no snare',
  'no hi-hat',
  'no tabla',
  'no crisp transient',
  'no bright sparkle',
]) {
  if (!doc.toLowerCase().includes(required)) fail(`document missing hard rule ${required}`);
  if (!config.soothingProfile.promptRequirements.some((item) => item.toLowerCase() === required)) fail(`config missing hard rule ${required}`);
  if (!config.soothingProfile.globalPromptSuffix.toLowerCase().includes(required)) fail(`global prompt suffix missing ${required}`);
}

const forbiddenPositiveRhythm = [
  /\bdrums?\b/i,
  /\bpercussion\b/i,
  /\bbeat\b/i,
  /\bpulse\b/i,
  /\bgroove\b/i,
  /\bkick\b/i,
  /\bsnare\b/i,
  /\bhi-?hat\b/i,
  /\btabla\b/i,
  /\bhand drum\b/i,
];

const ids = new Set<string>();
for (const family of config.families) {
  if (ids.has(family.id)) fail(`duplicate family id ${family.id}`);
  ids.add(family.id);
  if (family.goals.length === 0) fail(`${family.id} missing goals`);
  const prompt = family.prompt.toLowerCase();
  const effectivePrompt = `${prompt} ${config.soothingProfile.globalPromptSuffix.toLowerCase()}`;
  for (const rule of config.soothingProfile.promptRequirements) {
    if (!effectivePrompt.includes(rule.toLowerCase())) fail(`${family.id} effective prompt missing ${rule}`);
  }
  if (!/intensity 0\.5\/10/.test(prompt)) fail(`${family.id} must use intensity 0.5/10`);
  if (!/low brightness|dark|warm/.test(prompt)) fail(`${family.id} does not specify low-brightness/dark/warm timbre`);
  for (const pattern of forbiddenPositiveRhythm) {
    const match = effectivePrompt.match(pattern);
    if (match && !new RegExp(`no(?:\\s+\\w+){0,2}\\s+${match[0].replace('-', '-?')}`, 'i').test(effectivePrompt)) {
      fail(`${family.id} contains positive rhythm/percussion term ${match[0]}`);
    }
  }
  if (family.category === 'accent' && family.loopMode !== 'one_shot') fail(`${family.id} accent must be one-shot`);
  if (family.category !== 'accent' && family.loopMode !== 'crossfade') fail(`${family.id} bed/texture/instrument must be crossfade`);
}

for (const [category, max] of Object.entries(config.soothingProfile.preferredPreparedOnsetDensityPerSecondMax)) {
  if (!Number.isFinite(max) || max <= 0 || max > 2.2) fail(`${category} onset density max is too loose`);
}
for (const [category, max] of Object.entries(config.soothingProfile.preferredSpectralCentroidHzMax)) {
  if (!Number.isFinite(max) || max <= 0 || max > 1800) fail(`${category} centroid max is too loose`);
}

console.log(JSON.stringify({
  passed: true,
  batchId: config.batchId,
  families: config.families.length,
  candidates: config.targetCandidateCount,
  hardNoDrumRules: true,
  productionAllowed: config.productionAllowed,
}, null, 2));
