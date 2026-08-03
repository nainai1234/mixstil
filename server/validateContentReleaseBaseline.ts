import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';
const baselinePath = path.join(root, `reports/content-release-baseline-${date}.json`);
const manifestPath = path.join(root, `reports/content-release-manifest-${date}.json`);
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');

const fingerprintPayload = (item: any) => ({
  id: item.id,
  category: item.category,
  audioUrl: item.audioUrl,
  fileSha256: item.fileSha256,
  source: item.source,
  license: item.license,
  rightsEvidence: item.rightsEvidence,
  metadataV3: {
    version: item.metadataV3?.version,
    roles: item.metadataV3?.roles,
    concepts: item.metadataV3?.concepts,
    review: item.metadataV3?.review,
  },
});

const ensure = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  const [baseline, manifest] = await Promise.all([
    readFile(baselinePath, 'utf8').then(JSON.parse),
    readFile(manifestPath, 'utf8').then(JSON.parse),
  ]);

  ensure(baseline.status === 'frozen', 'Content release baseline is not frozen.');
  ensure(manifest.status === 'pass', 'Current content release manifest is not passing.');
  ensure(manifest.counts?.releaseStems === 111, 'Current release pool is not exactly 111 Stems.');
  ensure(manifest.failures?.length === 0, 'Current content release manifest has failures.');
  ensure(Object.values(manifest.gates ?? {}).every(Boolean), 'One or more current content release gates failed.');

  const allowedCategories = new Set(baseline.allowedCategories);
  ensure(
    manifest.items.every((item: any) => allowedCategories.has(item.category) && item.category !== 'Voice'),
    'Current release pool contains a prohibited or unknown category.',
  );

  const items = manifest.items
    .map(fingerprintPayload)
    .sort((left: any, right: any) => left.id.localeCompare(right.id));
  const currentFingerprint = sha256(JSON.stringify(items));
  ensure(
    currentFingerprint === baseline.contentFingerprint,
    `Content fingerprint drifted: expected ${baseline.contentFingerprint}, received ${currentFingerprint}.`,
  );

  for (const item of manifest.items) {
    const audioPath = path.join(root, 'public', item.audioUrl.replace(/^\//, ''));
    const audioSha256 = sha256(await readFile(audioPath));
    ensure(audioSha256 === item.fileSha256, `${item.id} audio file hash drifted.`);
  }
  for (const evidence of baseline.evidenceSnapshots) {
    const evidenceSha256 = sha256(await readFile(path.join(root, evidence.path)));
    ensure(evidenceSha256 === evidence.sha256, `${evidence.path} rights-evidence hash drifted.`);
  }

  console.log(JSON.stringify({
    passed: true,
    releaseChannel: baseline.releaseChannel,
    releaseStems: manifest.counts.releaseStems,
    contentFingerprint: currentFingerprint,
    rightsEvidenceSnapshots: baseline.evidenceSnapshots.length,
  }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
