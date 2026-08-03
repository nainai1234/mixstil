import { readFileSync } from 'node:fs';

const shortlist = JSON.parse(readFileSync(new URL('../config/reference-music-shortlist-v1.json', import.meta.url), 'utf8'));
const fail = (message: string): never => { throw new Error(`Reference music shortlist validation failed: ${message}`); };
if (shortlist.references.length !== 24) fail(`expected 24 references, received ${shortlist.references.length}`);
if (new Set(shortlist.references.map((item: any) => item.id)).size !== 24) fail('duplicate reference ids');
if (new Set(shortlist.references.map((item: any) => item.sourceUrl)).size !== 24) fail('duplicate source URLs');
for (const [goal, expected] of Object.entries(shortlist.goalDistribution)) {
  const actual = shortlist.references.filter((item: any) => item.goal === goal).length;
  if (actual !== expected) fail(`${goal} expected ${expected}, received ${actual}`);
}
for (const item of shortlist.references) {
  for (const field of ['title', 'creator', 'sourceUrl', 'visibleViews', 'instrumentHypothesis', 'study', 'risks', 'status']) {
    if (!item[field] || (Array.isArray(item[field]) && item[field].length === 0)) fail(`${item.id} missing ${field}`);
  }
  if (item.visibleViews < 1) fail(`${item.id} has no visible demand signal`);
  if (item.status !== 'validated_reference') fail(`${item.id} is not validated by listening`);
}
if (shortlist.status !== 'validated_reference_set') fail('reference set is not validated');
if (!shortlist.audioProductionAllowed) fail('atomic-material production gate should be open after reference validation');
if (shortlist.humanListening?.decision !== 'all_24_references_accepted' || shortlist.humanListening?.approvedBy !== 'project_owner') {
  fail('project-owner listening decision is missing');
}
console.log('PASS: 24 exact sourced references (10 Sleep, 8 Calm, 6 Focus) are accepted by the project owner for high-level analysis; atomic-material planning gate is open.');
