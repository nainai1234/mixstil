import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const inputDir = process.argv[2] ?? '/tmp/licensed-reference-analysis';
const outputDir = path.join(root, 'reports/licensed-reference-audio-analysis');
const manifestPath = path.join(root, 'config/licensed-reference-audio-analysis-v1.json');
const files = readdirSync(inputDir).filter((name) => name.endsWith('-analysis.json')).sort();
if (files.length < 3) throw new Error(`Expected at least 3 licensed analysis files, got ${files.length}`);
mkdirSync(outputDir, { recursive: true });
const records = files.map((name) => {
  const sourcePath = path.join(inputDir, name);
  const record = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (record.source?.accessClass !== 'licensed_file') throw new Error(`${record.referenceId} is not licensed_file`);
  if (!String(record.source?.licenseEvidence ?? '').includes('creativecommons.org/')) throw new Error(`${record.referenceId} is missing Creative Commons evidence`);
  if (Number(record.audio?.analyzedDurationSeconds) < 1800) throw new Error(`${record.referenceId} is below the 30-minute gate`);
  if (record.analysisProvenance?.analyzedFromExactAudio !== true) throw new Error(`${record.referenceId} was not analyzed from exact audio`);
  if (record.analysisProvenance?.approvedForAtomicMaterialPlanning !== false) throw new Error(`${record.referenceId} must remain unapproved pending human review`);
  record.humanListening.decision = 'contrast_only';
  record.humanListening.notes = 'Machine analysis complete; browser listening and scene-fit review pending.';
  record.analysisProvenance.humanReviewer = 'pending';
  copyFileSync(sourcePath, path.join(outputDir, `${record.referenceId}.json`));
  return record;
});
writeFileSync(manifestPath, `${JSON.stringify({
  schemaVersion: '1.0.0',
  observedOn: '2026-07-21',
  status: 'machine_analysis_complete_pending_human_review',
  productionAllowed: false,
  records,
}, null, 2)}\n`);
console.log(`PASS: merged ${records.length} licensed files; all exceed 30 minutes; production approval remains blocked.`);
