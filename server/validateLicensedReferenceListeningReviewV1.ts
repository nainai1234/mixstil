import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'config/licensed-reference-audio-analysis-v1.json'), 'utf8'));
const reviewDir = join(root, 'public/review/licensed-reference-listening-v1');
const htmlPath = join(reviewDir, 'index.html');
const fail = (message: string): never => { throw new Error(`Licensed reference listening review validation failed: ${message}`); };

if (!existsSync(htmlPath)) fail('review page is missing');
const html = readFileSync(htmlPath, 'utf8');
if (manifest.records.length !== 7) fail(`expected 7 records, got ${manifest.records.length}`);
for (const record of manifest.records) {
  if (Number(record.audio?.durationSeconds) < 1800) fail(`${record.referenceId} is below 30 minutes`);
  if (!html.includes(record.referenceId)) fail(`${record.referenceId} is missing from review page`);
  const expectedName = `legal_${record.referenceId.replace(/^licensed_/, '')}.mp3`;
  const audioPath = join(reviewDir, 'audio', expectedName);
  if (!existsSync(audioPath)) fail(`${expectedName} is not browser-playable`);
  if (statSync(audioPath).size < 1_000_000) fail(`${expectedName} is unexpectedly small`);
}
for (const required of ['data-seek="beginning"', 'data-seek="middle"', 'data-seek="end"', 'data-field="primaryFit"', 'data-field="voice"', 'data-field="strongBeat"', 'data-field="startleRisk"', 'data-field="loopFatigue"', 'data-field="decision"', 'localStorage', 'licensed-reference-listening-results-v1.json']) {
  if (!html.includes(required)) fail(`page contract is missing ${required}`);
}
if (/selected(?:=|\s)/.test(html)) fail('review page must not preselect an approval decision');
console.log('PASS: 7 long-form local recordings are playable and the human listening review contract is complete.');
