import { readFileSync } from 'node:fs';

const analysis = readFileSync(new URL('../docs/reference-music-preliminary-analysis-v1.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Reference preliminary analysis validation failed: ${message}`); };
const rows = analysis.match(/^\| (sleep_ref|calm_ref|focus_ref)_[^|]+ \|/gm) ?? [];
if (rows.length !== 24) fail(`expected 24 analysis rows, received ${rows.length}`);
for (const [prefix, expected] of Object.entries({ sleep_ref: 10, calm_ref: 8, focus_ref: 6 })) {
  const actual = rows.filter((row) => row.includes(`| ${prefix}_`)).length;
  if (actual !== expected) fail(`${prefix} expected ${expected}, received ${actual}`);
}
for (const required of ['Instrument hypothesis', 'Register', 'Tempo / pulse', 'Density', 'Harmony', 'Dynamics / space', 'Main risk to test']) {
  if (!analysis.includes(required)) fail(`missing analysis dimension ${required}`);
}
if (!analysis.includes('not authorize API prompts or material generation yet')) fail('missing production boundary');
console.log('PASS: 24 preliminary reference analyses cover instrument, register, tempo, density, harmony, dynamics, space, and risk without authorizing production.');
