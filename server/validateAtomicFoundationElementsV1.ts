import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type AudioElement = {
  elementId: string;
  elementType: string;
  goal: string;
  instrument: string;
  instrumentSourceId: string;
  notes: string[];
  productionAllowed: boolean;
  formalUsable: boolean;
  humanListeningStatus: string;
  masterAudioPath: string;
  preparedAudioUrl: string;
  reviewAudioSrc: string;
  durationSeconds: number;
  machineStatus: string;
  failures: string[];
  analysis: {
    durationSeconds: number;
    peakDbfs: number;
    humanVoiceProbability: string;
    drumProbability: string;
  };
};

type SymbolicElement = {
  elementId: string;
  elementType: string;
  productionAllowed: boolean;
  formalUsable: boolean;
  humanReviewStatus: string;
};

type Manifest = {
  schemaVersion: string;
  batchId: string;
  status: string;
  productionAllowed: boolean;
  formalUsableCount: number;
  humanPassCount: number;
  purpose: string;
  hardRules: string[];
  counts: {
    audioElements: number;
    symbolicElements: number;
    totalElements: number;
    singleNotes: number;
    harmonyCells: number;
    shortMotifs: number;
    bassSupport: number;
  };
  reviewUrl: string;
  audioElements: AudioElement[];
  symbolicElements: SymbolicElement[];
};

const root = process.cwd();
const fail = (message: string): never => {
  throw new Error(`Atomic foundation elements v1 validation failed: ${message}`);
};

const batchId = 'atomic-foundation-elements-v1';
const manifestPath = path.join(root, `public/audio/music/local-review/${batchId}/manifest.json`);
const reviewPath = path.join(root, `public/review/${batchId}/index.html`);
const reportJsonPath = path.join(root, `reports/${batchId}.json`);
const reportMdPath = path.join(root, `reports/${batchId}.md`);

for (const file of [manifestPath, reviewPath, reportJsonPath, reportMdPath]) {
  if (!existsSync(file)) fail(`missing file ${file}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

if (manifest.schemaVersion !== '1.0.0') fail('unexpected schema version');
if (manifest.batchId !== batchId) fail(`unexpected batch id ${manifest.batchId}`);
if (manifest.status !== 'atomic_foundation_elements_pending_human_review') fail(`unexpected status ${manifest.status}`);
if (manifest.productionAllowed !== false) fail('productionAllowed must remain false before item QA');
if (manifest.formalUsableCount !== 0) fail('formal usable count must remain 0');
if (manifest.humanPassCount !== 0) fail('human pass count must remain 0');
if (manifest.reviewUrl !== `/review/${batchId}/index.html`) fail('review url mismatch');
if (!manifest.purpose.includes('foundational elements')) fail('purpose must state foundational-element intent');

if (!manifest.hardRules.some((rule) => rule.includes('No Lyria'))) fail('hard rules must explicitly exclude Lyria as the source for this page');
if (!manifest.hardRules.some((rule) => rule.includes('no voice'))) fail('hard rules must explicitly exclude voice');
if (!manifest.hardRules.some((rule) => rule.includes('no drums'))) fail('hard rules must explicitly exclude drums');

const elementPayloadText = JSON.stringify({
  purpose: manifest.purpose,
  audioElements: manifest.audioElements,
  symbolicElements: manifest.symbolicElements,
}).toLowerCase();
for (const forbidden of ['lyria', 'finished song', 'finished songs', 'choir']) {
  if (elementPayloadText.includes(forbidden)) fail(`element payload contains forbidden reference: ${forbidden}`);
}

if (manifest.counts.audioElements !== manifest.audioElements.length) fail('audio element count mismatch');
if (manifest.counts.symbolicElements !== manifest.symbolicElements.length) fail('symbolic element count mismatch');
if (manifest.counts.totalElements !== manifest.audioElements.length + manifest.symbolicElements.length) fail('total element count mismatch');
if (manifest.audioElements.length < 24) fail('expected at least 24 audio atom elements');
if (manifest.symbolicElements.length < 36) fail('expected at least 36 symbolic structure elements');

const requiredAudioTypes = ['single_note', 'harmony_cell', 'short_motif', 'bass_support'];
for (const type of requiredAudioTypes) {
  const count = manifest.audioElements.filter((item) => item.elementType === type).length;
  if (count < 1) fail(`missing required audio element type ${type}`);
}

if (manifest.counts.singleNotes !== manifest.audioElements.filter((item) => item.elementType === 'single_note').length) fail('single note count mismatch');
if (manifest.counts.harmonyCells !== manifest.audioElements.filter((item) => item.elementType === 'harmony_cell').length) fail('harmony cell count mismatch');
if (manifest.counts.shortMotifs !== manifest.audioElements.filter((item) => item.elementType === 'short_motif').length) fail('short motif count mismatch');
if (manifest.counts.bassSupport !== manifest.audioElements.filter((item) => item.elementType === 'bass_support').length) fail('bass support count mismatch');

const requiredSymbolicTypes = [
  'symbolic_harmony_template',
  'symbolic_motif_template',
  'symbolic_form_rule',
  'symbolic_arrangement_grammar',
];
for (const type of requiredSymbolicTypes) {
  if (!manifest.symbolicElements.some((item) => item.elementType === type)) fail(`missing required symbolic element type ${type}`);
}

const ids = new Set<string>();
for (const element of manifest.audioElements) {
  if (ids.has(element.elementId)) fail(`duplicate element id ${element.elementId}`);
  ids.add(element.elementId);
  if (!requiredAudioTypes.includes(element.elementType)) fail(`${element.elementId} has unsupported audio type ${element.elementType}`);
  if (!['sleep', 'calm', 'focus'].includes(element.goal)) fail(`${element.elementId} has unsupported goal ${element.goal}`);
  if (element.productionAllowed !== false) fail(`${element.elementId} must remain productionAllowed=false`);
  if (element.formalUsable !== false) fail(`${element.elementId} must not be formal usable`);
  if (element.humanListeningStatus !== 'pending') fail(`${element.elementId} must await human listening`);
  if (!Array.isArray(element.notes) || element.notes.length < 1) fail(`${element.elementId} missing notes`);
  if (element.durationSeconds <= 0 || element.durationSeconds > 20) fail(`${element.elementId} is not an atomic short element`);
  if (Math.abs(element.durationSeconds - element.analysis.durationSeconds) > 0.05) fail(`${element.elementId} duration mismatch`);
  if (element.analysis.peakDbfs > -3) fail(`${element.elementId} peak too hot`);
  if (!element.analysis.humanVoiceProbability.includes('not_applicable')) fail(`${element.elementId} voice gate not deterministic`);
  if (!element.analysis.drumProbability.includes('not_applicable')) fail(`${element.elementId} drum gate not deterministic`);
  if (!['pass', 'review_required'].includes(element.machineStatus)) fail(`${element.elementId} has invalid machine status ${element.machineStatus}`);
  if (!element.reviewAudioSrc.startsWith('../../audio/')) fail(`${element.elementId} review path must work from file://`);
  if (element.preparedAudioUrl.startsWith('http')) fail(`${element.elementId} must use local prepared audio`);
  if (!existsSync(path.join(root, element.masterAudioPath))) fail(`${element.elementId} missing master wav`);
  if (!existsSync(path.join(root, 'public', element.preparedAudioUrl.replace(/^\//, '')))) fail(`${element.elementId} missing prepared mp3`);
}

for (const element of manifest.symbolicElements) {
  if (ids.has(element.elementId)) fail(`duplicate element id ${element.elementId}`);
  ids.add(element.elementId);
  if (!requiredSymbolicTypes.includes(element.elementType)) fail(`${element.elementId} has unsupported symbolic type ${element.elementType}`);
  if (element.productionAllowed !== false) fail(`${element.elementId} must remain productionAllowed=false`);
  if (element.formalUsable !== false) fail(`${element.elementId} must not be formal usable`);
  if (element.humanReviewStatus !== 'pending') fail(`${element.elementId} must await human review`);
}

const review = readFileSync(reviewPath, 'utf8');
if (review.includes('src="/audio/')) fail('review page contains absolute audio src; file:// playback would fail');
if ((review.match(/<audio /g) ?? []).length !== manifest.audioElements.length) fail('review audio count mismatch');
for (const requiredText of ['这不是音乐候选页', '元素能不能用', '单音', '和声单元', '短动机', '结构规则元素']) {
  if (!review.includes(requiredText)) fail(`review page missing required framing: ${requiredText}`);
}

const report = readFileSync(reportMdPath, 'utf8');
if (!report.includes('atomic_foundation_elements_generated_human_review_required')) fail('report missing verdict');
if (!report.includes('not finished music candidates')) fail('report must reject finished-candidate framing');

console.log(JSON.stringify({
  passed: true,
  batchId: manifest.batchId,
  audioElements: manifest.counts.audioElements,
  symbolicElements: manifest.counts.symbolicElements,
  totalElements: manifest.counts.totalElements,
  audioTypes: Object.fromEntries(requiredAudioTypes.map((type) => [type, manifest.audioElements.filter((item) => item.elementType === type).length])),
  symbolicTypes: Object.fromEntries(requiredSymbolicTypes.map((type) => [type, manifest.symbolicElements.filter((item) => item.elementType === type).length])),
  productionAllowed: manifest.productionAllowed,
  reviewUrl: manifest.reviewUrl,
}, null, 2));
