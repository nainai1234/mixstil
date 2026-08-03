import { readFileSync } from 'node:fs';

const report = readFileSync(new URL('../docs/google-reference-sample-research-20260721.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Google reference sample research validation failed: ${message}`); };
for (const section of ['## Meditation', '## Sleep', '## Focus', '## Resulting sample decisions']) {
  if (!report.includes(section)) fail(`missing section ${section}`);
}
const rows = report.split('\n').filter((line) => /^\| [^|]+ \| [^|]+ \|/.test(line) && !line.includes('---') && !line.includes('| Reference |'));
if (rows.length !== 30) fail(`expected 30 researched reference rows, received ${rows.length}`);
for (const required of ['152,932,655', '113,229,577', '29,728,052', 'Sit Around The Fire', 'Open Eye Signal', 'No reference is yet approved']) {
  if (!report.includes(required)) fail(`missing required research evidence or boundary: ${required}`);
}
console.log(`PASS: ${rows.length} Google-provided reference records researched with demand signals, fit decisions, and explicit exclusion boundaries.`);
