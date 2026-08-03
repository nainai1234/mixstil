import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/licensed-reference-audio-analysis-v1.json', import.meta.url), 'utf8'));
const fail = (message: string): never => { throw new Error(`Licensed reference analysis validation failed: ${message}`); };
if (manifest.records.length < 3) fail(`expected at least 3 pilot records, got ${manifest.records.length}`);
for (const record of manifest.records) {
  if (record.source?.accessClass !== 'licensed_file') fail(`${record.referenceId} is not licensed_file`);
  if (!String(record.source?.licenseEvidence ?? '').includes('creativecommons.org/')) fail(`${record.referenceId} has no license evidence`);
  if (Number(record.audio?.analyzedDurationSeconds) < 1800) fail(`${record.referenceId} is below the 30-minute gate`);
  if (record.analysisProvenance?.analyzedFromExactAudio !== true) fail(`${record.referenceId} is not exact-audio analysis`);
  const reviewer = record.analysisProvenance?.humanReviewer;
  if (reviewer !== 'pending' && reviewer !== 'owner') fail(`${record.referenceId} has an invalid human reviewer state`);
  if (reviewer === 'owner' && !['keep', 'contrast_only', 'reject'].includes(record.humanListening?.decision)) fail(`${record.referenceId} owner review has no valid decision`);
  if (record.analysisProvenance?.approvedForAtomicMaterialPlanning !== false) fail(`${record.referenceId} cannot authorize production`);
}
if (manifest.productionAllowed) fail('productionAllowed must remain false');
console.log(`PASS: ${manifest.records.length} licensed exact-audio records validated; human listening and owner approval remain required.`);
