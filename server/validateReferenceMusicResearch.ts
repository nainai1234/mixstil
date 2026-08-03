import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/reference-music-research-v1.json', import.meta.url), 'utf8'));
const fail = (message: string): never => { throw new Error(`Reference music research validation failed: ${message}`); };
if (manifest.slots.length !== 24) fail(`expected 24 slots, received ${manifest.slots.length}`);
if (new Set(manifest.slots.map((slot: any) => slot.id)).size !== 24) fail('slot ids are not unique');
for (const [goal, count] of Object.entries({ sleep: 10, calm: 8, focus: 6 })) {
  const actual = manifest.slots.filter((slot: any) => slot.goal === goal).length;
  if (actual !== count) fail(`${goal} expected ${count}, received ${actual}`);
}
const validated = manifest.slots.filter((slot: any) => slot.status === 'validated');
const candidates = manifest.identifiedCandidates ?? [];
if (new Set(candidates.map((candidate: any) => candidate.id)).size !== candidates.length) fail('candidate ids are not unique');
for (const candidate of candidates) {
  for (const field of ['title', 'creator', 'sourcePlatform', 'sourceUrl', 'candidateGoals', 'study', 'mustNotInherit', 'rightsBoundary', 'status']) {
    if (!candidate[field] || (Array.isArray(candidate[field]) && candidate[field].length === 0)) fail(`${candidate.id} is missing ${field}`);
  }
  if (candidate.status !== 'candidate_identified') fail(`${candidate.id} must remain candidate_identified until assigned and analyzed`);
}
for (const slot of validated) {
  for (const field of manifest.requiredFieldsBeforeValidation) {
    if (slot[field] === undefined || slot[field] === null || slot[field] === '') fail(`${slot.id} is validated without ${field}`);
  }
}
if (manifest.audioProductionAllowed && validated.length !== 24) fail('audio production cannot start before all 24 references are validated');
console.log(`PASS: 24 research slots (${manifest.requiredCounts.sleep} Sleep, ${manifest.requiredCounts.calm} Calm, ${manifest.requiredCounts.focus} Focus); ${candidates.length} identified candidates; ${validated.length} validated; audio production allowed=${manifest.audioProductionAllowed}.`);
