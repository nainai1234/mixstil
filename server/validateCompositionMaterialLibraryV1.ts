import { readFileSync } from 'node:fs';
import path from 'node:path';

type Harmony = { id: string; chords: string[][]; family: string };
type Motif = { id: string; notes: string[]; beats: number[]; contour: string };
type CompositionPlan = { id: string; harmonyId: string; motifId: string; formId: string; grammarId: string; tempo: number; seed: number };

const root = process.cwd();
const fail = (message: string): never => { throw new Error(`Composition material library validation failed: ${message}`); };
const payload = JSON.parse(readFileSync(path.join(root, 'config/composition-material-library-v1.json'), 'utf8')) as {
  schemaVersion: string;
  purpose: string;
  harmonyPool: Harmony[];
  motifPool: Motif[];
  formPool: Array<{ id: string }>;
  grammarPool: Array<{ id: string }>;
  compositionPlans: CompositionPlan[];
};

if (payload.schemaVersion !== '1.0.0') fail(`unexpected schema ${payload.schemaVersion}`);
if (payload.harmonyPool.length !== 24) fail(`expected 24 harmony templates, received ${payload.harmonyPool.length}`);
if (payload.motifPool.length !== 36) fail(`expected 36 motifs, received ${payload.motifPool.length}`);
if (payload.formPool.length < 12) fail('expected at least 12 form plans');
if (payload.grammarPool.length < 8) fail('expected at least 8 grammar plans');

const supportedNotes = new Set(['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5']);
const unique = (items: string[], label: string) => {
  const set = new Set(items);
  if (set.size !== items.length) fail(`duplicate ${label} ids`);
  return set;
};

const harmonyIds = unique(payload.harmonyPool.map((item) => item.id), 'harmony');
const motifIds = unique(payload.motifPool.map((item) => item.id), 'motif');
const formIds = unique(payload.formPool.map((item) => item.id), 'form');
const grammarIds = unique(payload.grammarPool.map((item) => item.id), 'grammar');

for (const harmony of payload.harmonyPool) {
  if (!harmony.family) fail(`${harmony.id} missing family`);
  if (harmony.chords.length < 3 || harmony.chords.length > 4) fail(`${harmony.id} must have 3-4 chord cells`);
  for (const chord of harmony.chords) {
    if (chord.length !== 3) fail(`${harmony.id} has a non-triad/open-triad cell`);
    for (const note of chord) if (!supportedNotes.has(note)) fail(`${harmony.id} uses unsupported note ${note}`);
  }
}

for (const motif of payload.motifPool) {
  if (!motif.contour) fail(`${motif.id} missing contour`);
  if (motif.notes.length !== motif.beats.length) fail(`${motif.id} note/beat mismatch`);
  if (motif.notes.length < 2 || motif.notes.length > 5) fail(`${motif.id} must have 2-5 notes`);
  for (const note of motif.notes) if (!supportedNotes.has(note)) fail(`${motif.id} uses unsupported note ${note}`);
  for (const beat of motif.beats) if (!Number.isFinite(beat) || beat < 0.7 || beat > 4.5) fail(`${motif.id} has unsafe beat ${beat}`);
}

for (const plan of payload.compositionPlans) {
  if (!harmonyIds.has(plan.harmonyId)) fail(`${plan.id} references missing harmony ${plan.harmonyId}`);
  if (!motifIds.has(plan.motifId)) fail(`${plan.id} references missing motif ${plan.motifId}`);
  if (!formIds.has(plan.formId)) fail(`${plan.id} references missing form ${plan.formId}`);
  if (!grammarIds.has(plan.grammarId)) fail(`${plan.id} references missing grammar ${plan.grammarId}`);
  if (!Number.isInteger(plan.seed) || plan.seed <= 0) fail(`${plan.id} has invalid seed`);
  if (!Number.isFinite(plan.tempo) || plan.tempo < 40 || plan.tempo > 76) fail(`${plan.id} has unsafe tempo`);
}

const motifGoalCounts = {
  sleep: payload.motifPool.filter((item) => item.id.startsWith('sleep_')).length,
  calm: payload.motifPool.filter((item) => item.id.startsWith('calm_')).length,
  focus: payload.motifPool.filter((item) => item.id.startsWith('focus_')).length,
};
if (motifGoalCounts.sleep < 11 || motifGoalCounts.calm < 11 || motifGoalCounts.focus < 11) fail(`motif goal spread too narrow: ${JSON.stringify(motifGoalCounts)}`);

console.log(JSON.stringify({
  passed: true,
  harmonyTemplates: payload.harmonyPool.length,
  motifs: payload.motifPool.length,
  forms: payload.formPool.length,
  grammars: payload.grammarPool.length,
  compositionPlans: payload.compositionPlans.length,
  motifGoalCounts,
}, null, 2));
