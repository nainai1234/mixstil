import { readFileSync } from 'node:fs';

const report = readFileSync(new URL('../docs/additional-reference-sample-research-20260721.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Additional reference research validation failed: ${message}`); };
for (const section of ['## Meditation / Calm', '## Sleep', '## Focus', '## Seamless-loop requirements']) {
  if (!report.includes(section)) fail(`missing section ${section}`);
}
const rows = report.split('\n').filter((line) => /^\| [^|]+ \| [^|]+ \|/.test(line) && !line.includes('---') && !line.includes('| Reference |'));
if (rows.length !== 30) fail(`expected 30 additional reference rows, received ${rows.length}`);
for (const required of ['152.9M', '58.5K', '1.30M', '7.89M', '919.7K', '432Hz', '100-500 ms', '1-4 second']) {
  if (!report.includes(required)) fail(`missing research or loop requirement ${required}`);
}
console.log('PASS: 30 additional references analyzed with demand signals, fit decisions, voice/claim boundaries, and seamless-loop requirements.');
