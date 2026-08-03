import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batch = 'music-kit-batch-003';
const sourceDir = path.join(root, 'public/audio/music/local-review', batch);
const targetDir = path.join(root, 'public/audio/music/music-kits-v1');
const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
const rights = JSON.parse(fs.readFileSync(path.join(root, 'reports', `${batch}-rights-manifest.json`), 'utf8'));
const rightsByStem = new Map(rights.records.map((record: any) => [record.stemId, record]));

fs.mkdirSync(targetDir, { recursive: true });
const kits = manifest.kits.map((kit: any) => {
  const kitDir = path.join(targetDir, kit.id);
  fs.mkdirSync(kitDir, { recursive: true });
  const stems = kit.stems.map((stem: any) => {
    const stemId = `${kit.id}__${stem.role}`;
    const source = path.join(sourceDir, kit.id, `${stem.role}.mp3`);
    const target = path.join(kitDir, `${stem.role}.mp3`);
    fs.copyFileSync(source, target);
    const right = rightsByStem.get(stemId) as any;
    if (!right) throw new Error(`Missing rights record for ${stemId}`);
    return {
      id: stemId,
      name: `${kit.profileId.replaceAll('_', ' ')} - ${stem.role}`,
      role: stem.role,
      audioUrl: `/audio/music/music-kits-v1/${kit.id}/${stem.role}.mp3`,
      defaultVolume: stem.defaultVolume,
      durationSeconds: stem.metrics.durationSeconds,
      fileSha256: right.fileSha256,
      sourcePlatform: right.upstream.includes('VCSL') ? 'VCSL' : 'Discord SFZ GM Bank',
      sourceUrl: right.upstream,
      sourceItemId: `${right.pinnedCommit}:${kit.profileId}:${stem.role}`,
      sourceCreator: 'MixStil arrangement using pinned CC0 instrument samples',
      licenseName: right.licenseName,
      licenseUrl: right.licenseUrl,
      sourceRecord: right.sourceRecord,
    };
  });
  return {
    id: kit.id,
    version: kit.version,
    profileId: kit.profileId,
    goal: kit.goal,
    form: kit.form,
    durationSeconds: kit.mixMetrics.durationSeconds,
    loopCrossfadeSeconds: kit.loopCrossfadeSeconds,
    status: 'approved',
    stems,
  };
});

const output = {
  schemaVersion: '1.0.0',
  sourceBatch: batch,
  promotedOn: '2026-07-20',
  status: 'approved_foundational_music',
  humanListening: 'passed_by_project_owner',
  machineQa: 'passed',
  kits,
};
const target = path.join(root, 'config/music-kit-production-v1.json');
fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`PASS: promoted ${kits.length} MusicKits and ${kits.flatMap((kit: any) => kit.stems).length} stems to stable production paths`);
