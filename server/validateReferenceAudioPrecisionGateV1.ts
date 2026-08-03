import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/reference-audio-analysis-v1.json', import.meta.url), 'utf8'));
const licensedManifest = JSON.parse(readFileSync(new URL('../config/licensed-reference-audio-analysis-v1.json', import.meta.url), 'utf8'));
const allowed = new Set(['licensed_file', 'public_domain_file']);
const eligible = manifest.records.filter((record: any) => {
  const accessClass = record.source?.accessClass;
  const hasRightsEvidence = typeof record.source?.licenseEvidence === 'string' && record.source.licenseEvidence.trim().length > 0;
  return allowed.has(accessClass) && hasRightsEvidence && record.analysisProvenance?.analyzedFromExactAudio === true && record.analysisProvenance?.approvedForAtomicMaterialPlanning === true;
});
if (manifest.productionAllowed) throw new Error('Precision analysis gate failed: productionAllowed must remain false');
const licensedMachineRecords = licensedManifest.records.filter((record: any) => record.source?.accessClass === 'licensed_file' && record.analysisProvenance?.analyzedFromExactAudio === true);
const licensedApprovedRecords = licensedMachineRecords.filter((record: any) => record.analysisProvenance?.approvedForAtomicMaterialPlanning === true && record.humanListening?.decision === 'keep');
if (eligible.length !== 0 || licensedApprovedRecords.length !== 0) throw new Error(`Precision analysis gate failed: production-eligible records found (historical=${eligible.length}, licensed=${licensedApprovedRecords.length})`);
console.log(`PASS: ${manifest.records.length} historical records excluded; ${licensedMachineRecords.length} licensed machine records pending human review; production-eligible precision records: 0.`);
