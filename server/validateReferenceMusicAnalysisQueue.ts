import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../config/reference-music-research-v1.json', import.meta.url), 'utf8'));
const queue = readFileSync(new URL('../docs/reference-music-analysis-queue-v1.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Reference music analysis queue validation failed: ${message}`); };
const rows = (queue.match(/^\| [^|]+ \| [^|]+ \| (Sleep|Calm|Focus) \|/gm) ?? []).length;
if (rows !== 24) fail(`expected 24 queue rows, received ${rows}`);
for (const [goal, count] of Object.entries({ Sleep: 10, Calm: 8, Focus: 6 })) {
  const actual = (queue.match(new RegExp(`^\\| [^|]+ \\| [^|]+ \\| ${goal} \\|`, 'gm')) ?? []).length;
  if (actual !== count) fail(`${goal} expected ${count} queue rows, received ${actual}`);
}
if (/\| [^|]+ \| [^|]+ \| (Sleep|Calm|Focus) \| [^|]+ \| validated \|/m.test(queue)) fail('queue cannot mark a row validated before the research manifest is complete');
console.log(`PASS: ${rows} reference analysis tasks assigned; ${manifest.identifiedCandidates.length} candidates remain in the research manifest; no row is validated.`);
