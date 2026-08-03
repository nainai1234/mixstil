import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = resolve(root, 'docs/open-self-hosted-audio-route-candidates-2026-07-17.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const requiredEvidence = [
  '.local-models/audiocraft/LICENSE_weights',
  '.local-models/AudioLDM2/LICENSE',
  '.local-models/TangoFlux/LICENSE.md',
  '.local-models/ACE-Step/LICENSE'
];

const missingEvidence = requiredEvidence.filter((relativePath) => !existsSync(resolve(root, relativePath)));
const active = manifest.candidates.find((candidate) => candidate.status === 'active_next_route');
const blockedExternal = manifest.candidates.filter((candidate) => candidate.status === 'blocked_pending_terms');
const rejected = manifest.candidates.filter((candidate) => candidate.status.startsWith('rejected'));

console.log('SNOOZE open/self-hosted audio route gate');
console.log(`Manifest: ${manifestPath}`);
console.log(`Rejected model routes: ${rejected.map((candidate) => candidate.name).join(', ')}`);
console.log(`Blocked external candidates: ${blockedExternal.map((candidate) => candidate.name).join(', ') || 'none'}`);
console.log(`Active next route: ${active?.name || 'none'}`);

if (missingEvidence.length > 0) {
  console.error(`Missing local evidence files: ${missingEvidence.join(', ')}`);
  process.exit(1);
}

if (!active) {
  console.error('No active next route is selected.');
  process.exit(1);
}

if (active.name !== 'SNOOZE controlled stem factory') {
  console.error(`Unexpected active route: ${active.name}`);
  process.exit(1);
}

console.log('Gate result: pass. Do not run rejected song-prior model batches as product content.');
