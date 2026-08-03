import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type OwnerDecision = {
  schemaVersion: string;
  decisionId: string;
  batchId: string;
  reviewer: string;
  ownerFeedback: string;
  decision: string;
  productionAllowed: boolean;
  formalUsablePromotionAllowed: boolean;
  meaning: string;
  approvedDirection: string[];
  notApprovedYet: string[];
  currentEvidence: Record<string, string>;
  nextProductionStep: {
    id: string;
    description: string;
    minimumBeforeProductionRouting: string[];
  };
};

type Manifest = {
  batchId: string;
  status: string;
  productionAllowed: boolean;
  renderedCandidateCount: number;
  machinePassCount: number;
  humanPassCount: number;
  formalUsableCount: number;
  sourceResults: Array<{ sourceId: string; runtimeProofStatus: string; renderedCandidateCount: number }>;
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Instrument runtime owner decision validation failed: ${message}`);
};

const decisionPath = path.join(root, 'config/instrument-runtime-render-proof-v1-owner-decision.json');
const manifestPath = path.join(root, 'public/audio/music/local-review/instrument-runtime-render-proof-v1/manifest.json');

if (!existsSync(decisionPath)) fail('owner decision file missing');
if (!existsSync(manifestPath)) fail('runtime proof manifest missing');

const decision = JSON.parse(readFileSync(decisionPath, 'utf8')) as OwnerDecision;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

if (decision.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (decision.decisionId !== 'instrument-runtime-render-proof-v1-owner-decision') fail('unexpected decision id');
if (decision.batchId !== manifest.batchId) fail('decision batch id does not match manifest');
if (decision.reviewer !== 'project_owner') fail('reviewer must be project_owner');
if (decision.ownerFeedback !== '方向正确。') fail('owner feedback must preserve exact decision text');
if (decision.decision !== 'direction_accepted_item_review_pending') fail('decision must be direction accepted with item review pending');
if (decision.productionAllowed !== false) fail('direction approval must not allow production');
if (decision.formalUsablePromotionAllowed !== false) fail('direction approval must not allow formal usable promotion');
if (!decision.meaning.includes('does not mean every rendered candidate is individually approved')) fail('meaning must separate direction approval from item approval');

for (const required of [
  'Use playable local instrument sources instead of fixed finished songs as the core music foundation.',
  'Use harmony, motif, form, grammar, tempo, seed, and instrument choice as separate controllable inputs.',
]) {
  if (!decision.approvedDirection.includes(required)) fail(`missing approved direction: ${required}`);
}

for (const required of [
  'No individual rendered candidate is formal usable yet.',
  'No candidate may enter public Recipe routing until item-level human listening passes.',
  'The two FluidR3 SoundFont sources are still blocked until a runtime loader or replacement source is verified.',
]) {
  if (!decision.notApprovedYet.includes(required)) fail(`missing not-approved boundary: ${required}`);
}

if (manifest.productionAllowed !== false) fail('manifest productionAllowed must remain false');
if (manifest.humanPassCount !== 0) fail('manifest human pass count must remain 0');
if (manifest.formalUsableCount !== 0) fail('manifest formal usable count must remain 0');
if (manifest.renderedCandidateCount < 14 || manifest.machinePassCount < 14) fail('runtime proof evidence is incomplete');

const machinePassedSources = manifest.sourceResults.filter((source) => source.runtimeProofStatus === 'machine_passed_candidate');
if (machinePassedSources.length < 4) fail('expected at least four machine-passed local instrument sources');
for (const sourceId of ['fluidr3_gm_soundfont', 'fluidr3_woodwinds_fallback']) {
  const source = manifest.sourceResults.find((item) => item.sourceId === sourceId);
  if (!source || source.runtimeProofStatus !== 'runtime_loader_blocked') fail(`${sourceId} must remain runtime_loader_blocked`);
}

for (const gate of [
  'item_identity_human_review',
  'comfort_or_soothing_review',
  'no_voice_no_drum_confirmation',
  'loop_or_long_session_strategy',
  'gain_range_metadata',
  'recipe_role_metadata',
]) {
  if (!decision.nextProductionStep.minimumBeforeProductionRouting.includes(gate)) fail(`missing next-step gate ${gate}`);
}

console.log(JSON.stringify({
  passed: true,
  decisionId: decision.decisionId,
  decision: decision.decision,
  productionAllowed: decision.productionAllowed,
  renderedCandidateCount: manifest.renderedCandidateCount,
  machinePassedSources: machinePassedSources.map((source) => source.sourceId),
  blockedSources: manifest.sourceResults.filter((source) => source.runtimeProofStatus === 'runtime_loader_blocked').map((source) => source.sourceId),
  nextProductionStep: decision.nextProductionStep.id,
}, null, 2));
