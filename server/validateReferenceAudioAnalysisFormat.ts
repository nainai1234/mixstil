import { readFileSync } from 'node:fs';

const format = readFileSync(new URL('../docs/reference-audio-analysis-format-v1.md', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../config/reference-audio-analysis-v1.json', import.meta.url), 'utf8'));
const fail = (message: string): never => { throw new Error(`Reference audio analysis format validation failed: ${message}`); };
for (const required of ['Access classes', 'Required analysis record', 'Analysis pipeline', 'Confidence rules', 'sourceDurationSeconds', 'analyzedDurationSeconds', 'analysisCoverage', 'analyzedFromExactAudio', 'approvedForAtomicMaterialPlanning']) {
  if (!format.includes(required)) fail(`missing ${required}`);
}
if (manifest.productionAllowed && manifest.records.length === 0) fail('production cannot be allowed without completed analysis records');
const policy = manifest.durationPolicy;
if (policy?.minimumAnalyzedSeconds !== 1800) fail('minimum analyzed duration must be 1800 seconds');
if (policy?.previewOnlyMaximumSeconds !== 30) fail('30-second previews must remain triage-only');
if (policy?.alternateSourceRequiresFirst30SecondsMatch !== true) fail('alternate sources must pass first-30-second identity verification');
if (JSON.stringify(policy?.requiredCoverageSegments) !== JSON.stringify(['beginning', 'middle', 'end'])) {
  fail('beginning, middle, and end coverage are required');
}
const validateDuration = (record: any): void => {
  const identity = record.source?.alternateSourceIdentity;
  if (identity && identity.analysisSourceUrl !== identity.referenceSourceUrl) {
    if (!identity.titleCreatorMatch || !identity.first30SecondsMatch) {
      fail(`${record.referenceId} alternate source identity is not verified`);
    }
    if (!['direct_source', 'acoustic_fingerprint', 'music_recognition', 'human_ab'].includes(identity.first30SecondsVerificationMethod)) {
      fail(`${record.referenceId} has an unsupported first-30-second verification method`);
    }
  }
  const sourceDuration = Number(record.audio?.sourceDurationSeconds);
  const analyzedDuration = Number(record.audio?.analyzedDurationSeconds);
  if (!Number.isFinite(sourceDuration) || !Number.isFinite(analyzedDuration) || sourceDuration <= 0) {
    fail(`${record.referenceId} is missing source/analyzed duration`);
  }
  const required = Math.min(sourceDuration, policy.minimumAnalyzedSeconds);
  if (analyzedDuration + 1 < required) fail(`${record.referenceId} does not meet the 30-minute/full-track duration gate`);
  for (const segment of policy.requiredCoverageSegments) {
    const window = record.audio?.analysisCoverage?.[segment];
    if (!window || !(Number(window.endSeconds) > Number(window.startSeconds))) {
      fail(`${record.referenceId} is missing ${segment} analysis coverage`);
    }
  }
  if (analyzedDuration <= policy.previewOnlyMaximumSeconds) {
    fail(`${record.referenceId} is preview-only and cannot be a formal analysis record`);
  }
};
const precisionRecords = manifest.records.filter((record: any) => ['licensed_file', 'public_domain_file'].includes(record.source?.accessClass));
for (const record of precisionRecords) {
  validateDuration(record);
}

let previewRejected = false;
try {
  validateDuration({
    referenceId: 'duration-policy-self-test',
    audio: {
      sourceDurationSeconds: 240,
      analyzedDurationSeconds: 30,
      analysisCoverage: {
        beginning: { startSeconds: 0, endSeconds: 10 },
        middle: { startSeconds: 110, endSeconds: 120 },
        end: { startSeconds: 230, endSeconds: 240 },
      },
    },
  });
} catch {
  previewRejected = true;
}
if (!previewRejected) fail('duration self-test accepted a 30-second preview');

const precisionEligible = manifest.records.filter((record: any) => {
  const accessClass = record.source?.accessClass;
  const hasRightsEvidence = typeof record.source?.licenseEvidence === 'string' && record.source.licenseEvidence.trim().length > 0;
  return ['licensed_file', 'public_domain_file'].includes(accessClass) && hasRightsEvidence && record.analysisProvenance?.analyzedFromExactAudio === true && record.analysisProvenance?.approvedForAtomicMaterialPlanning === true;
}).length;
console.log(`PASS: ${manifest.records.length} historical records retained; ${precisionRecords.length} licensed/public-domain records passed duration and structure format; production-eligible precision records: ${precisionEligible}.`);
