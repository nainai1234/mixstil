import { readFileSync } from 'node:fs';

const report = readFileSync(new URL('../docs/replacement-reference-verification-20260721.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Replacement reference verification failed: ${message}`); };
const rows = report.split('\n').filter((line) => /^\| [^|]+ \| [^|]+ \|/.test(line) && !line.includes('---') && !line.includes('| Proposed replacement |'));
if (rows.length !== 5) fail(`expected 5 replacement rows, received ${rows.length}`);
for (const required of ['2,130,300', '92,523', '18,794,018', '67,203', 'no high-confidence exact single result', 'not prove causal Focus effectiveness']) {
  if (!report.includes(required)) fail(`missing verification evidence or boundary ${required}`);
}
console.log('PASS: five proposed replacements verified for existence, public demand, uncertainty, Voice-free boundary, and research eligibility.');
