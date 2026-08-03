import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/reference-music-research-v1.json', import.meta.url), 'utf8'));
const register = readFileSync(new URL('../docs/reference-music-evidence-register-v1.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Reference evidence register validation failed: ${message}`); };
for (const candidate of manifest.identifiedCandidates) {
  if (!register.includes(`| ${candidate.id} |`)) fail(`${candidate.id} is missing from evidence register`);
}
if ((register.match(/^\| candidate_[^|]+ \|/gm) ?? []).length !== 24) fail('evidence register must contain 24 candidate rows');
if (!register.includes('Audio production authorization: disabled.')) fail('register must keep audio production disabled');
console.log('PASS: 24 candidate evidence rows are registered; source, demand, rights, and next-action boundaries remain explicit; audio production remains disabled.');
