import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const inputDir = process.argv[2] ?? '/tmp/snooze-reference-analysis';
const outputDir = path.join(root, 'reports/reference-audio-analysis');
const manifestPath = path.join(root, 'config/reference-audio-analysis-v1.json');
const shortlist = JSON.parse(readFileSync(path.join(root, 'config/reference-music-shortlist-v1.json'), 'utf8')) as {
  references: Array<{ id: string }>;
};
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  records: Array<{ referenceId: string }>;
  status?: string;
  productionAllowed?: boolean;
};
const expectedIds = new Set(shortlist.references.map((item) => item.id));

mkdirSync(outputDir, { recursive: true });
const records = new Map<string, { referenceId: string }>(manifest.records.map((record) => [record.referenceId, record]));
const files = readdirSync(inputDir).filter((name) => name.endsWith('-analysis.json'));

for (const name of files) {
  const sourcePath = path.join(inputDir, name);
  const record = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (!expectedIds.has(record.referenceId)) throw new Error(`Unknown referenceId in ${name}: ${record.referenceId}`);
  if (record.referenceId !== name.slice(0, -'-analysis.json'.length)) {
    throw new Error(`Filename/referenceId mismatch: ${name}`);
  }
  const duration = Number(record.audio?.analyzedDurationSeconds);
  const sourceDuration = Number(record.audio?.sourceDurationSeconds);
  if (duration + 1 < Math.min(sourceDuration, 1800)) throw new Error(`${record.referenceId} failed duration gate`);
  const identity = record.source?.alternateSourceIdentity as { first30SecondsMatch?: boolean } | undefined;
  if (record.source?.sourceUrl !== record.source?.analysisSourceUrl && !identity?.first30SecondsMatch) {
    throw new Error(`${record.referenceId} failed first-30-second identity gate`);
  }
  records.set(record.referenceId, record);
  copyFileSync(sourcePath, path.join(outputDir, `${record.referenceId}.json`));
}

manifest.records = [...records.values()].sort((left, right) => left.referenceId.localeCompare(right.referenceId));
manifest.status = manifest.records.length === expectedIds.size ? 'machine_analysis_complete_pending_parameter_approval' : 'machine_analysis_in_progress';
manifest.productionAllowed = false;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const unresolved = [...expectedIds].filter((id) => !records.has(id));
console.log(JSON.stringify({ merged: files.length, formalRecords: records.size, unresolved }, null, 2));
