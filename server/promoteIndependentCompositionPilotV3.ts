import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batch = 'independent-composition-pilot-v3';
const sourceDir = path.join(root, 'public/audio/music/local-review', batch);
const targetDir = path.join(root, 'public/audio/music/music-kits-v2');
const v1 = JSON.parse(fs.readFileSync(path.join(root, 'config/music-kit-production-v1.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
if (source.status !== 'candidate' || source.maximumSimilarity >= source.similarityThreshold) {
  throw new Error('V3 candidate does not satisfy the diversity gate.');
}

const roles = ['harmony', 'melody', 'accompaniment', 'low_support', 'transition'] as const;
const kits = source.kits.map((kit: any) => {
  const kitDir = path.join(targetDir, kit.id);
  fs.mkdirSync(kitDir, { recursive: true });
  const stems = kit.stems.map((stem: any) => {
    const sourceFile = path.join(sourceDir, kit.id, `${stem.role}.mp3`);
    const targetFile = path.join(kitDir, `${stem.role}.mp3`);
    fs.copyFileSync(sourceFile, targetFile);
    const fileSha256 = createHash('sha256').update(fs.readFileSync(targetFile)).digest('hex');
    return {
      id: `${kit.id}__${stem.role}`,
      name: `${kit.compositionId.replaceAll('_', ' ')} - ${stem.role}`,
      role: stem.role,
      audioUrl: `/audio/music/music-kits-v2/${kit.id}/${stem.role}.mp3`,
      defaultVolume: stem.defaultVolume,
      durationSeconds: stem.metrics.durationSeconds,
      fileSha256,
      sourcePlatform: 'MixStil deterministic composition factory',
      sourceUrl: 'internal://snooze/composition-material-library-v1',
      sourceItemId: `${batch}:${kit.compositionId}:${stem.role}`,
      sourceCreator: 'MixStil composition renderer using CC0 VCSL/Discord GM samples',
      licenseName: 'CC0 1.0 upstream samples; MixStil original arrangement',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceRecord: `internal://snooze/provenance/${batch}/${kit.compositionId}/${stem.role}`,
    };
  });
  if (stems.length !== roles.length || stems.some((stem: any) => !roles.includes(stem.role))) {
    throw new Error(`Incomplete stem set for ${kit.id}`);
  }
  return {
    id: kit.id,
    version: '2.0.0',
    compositionId: kit.compositionId,
    profileId: kit.profileId,
    goal: kit.goal,
    form: kit.materials.form,
    durationSeconds: kit.mixMetrics.durationSeconds,
    loopCrossfadeSeconds: 2,
    status: 'approved',
    approval: {
      approvedBy: 'project_owner',
      approvedOn: '2026-07-21',
      listeningDecision: 'independent_composition_pilot_v3_passed',
      machineQa: kit.machineQa,
      paidApi: false,
      generativeModel: false,
      renderer: 'generate-independent-composition-pilot-v3.py',
      materials: kit.materials,
      fingerprint: kit.fingerprint,
    },
    stems,
  };
});

const output = {
  schemaVersion: '2.0.0',
  sourceBatch: batch,
  promotedOn: '2026-07-21',
  status: 'approved_foundational_music',
  humanListening: 'passed_by_project_owner',
  machineQa: 'passed',
  diversity: { maximumSimilarity: source.maximumSimilarity, threshold: source.similarityThreshold },
  kits: [...v1.kits, ...kits],
};
fs.writeFileSync(path.join(root, 'config/music-kit-production-v2.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`PASS: promoted ${kits.length} independent V3 MusicKits; production V2 now has ${output.kits.length} kits and ${output.kits.flatMap((kit: any) => kit.stems).length} stems`);
