import { readFileSync } from 'node:fs';

const report = readFileSync(new URL('../docs/eastern-indian-reference-sample-research-20260721.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Eastern/Indian reference research validation failed: ${message}`); };
for (const section of ['## Meditation', '## Sleep', '## Focus', '## Findings', '## Looping implication']) {
  if (!report.includes(section)) fail(`missing section ${section}`);
}
const rows = report.split('\n').filter((line) => /^\| [^|]+ \| [^|]+ \|/.test(line) && !line.includes('---') && !line.includes('| Reference |'));
if (rows.length !== 30) fail(`expected 30 additional reference rows, received ${rows.length}`);
for (const required of ['422,496', '3,922,118', '35,063,827', 'exact title not found', 'replace or verify', '100-500 ms', '2-8']) {
  if (!report.includes(required)) fail(`missing evidence or boundary ${required}`);
}
console.log('PASS: 30 Eastern/Indian reference candidates researched with demand signals, source-mismatch flags, cultural/rights boundaries, and loop requirements.');
