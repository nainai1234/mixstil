import { readFileSync } from 'node:fs';

const snapshot = readFileSync(new URL('../docs/reference-market-search-snapshot-20260721.md', import.meta.url), 'utf8');
const fail = (message: string): never => { throw new Error(`Reference market snapshot validation failed: ${message}`); };
for (const section of ['Sleep / piano / rain / ocean', 'Calm / meditation / piano / guitar', 'Focus / study / instrumental']) {
  if (!snapshot.includes(`## ${section}`)) fail(`missing section ${section}`);
}
const rows = snapshot.match(/^\| \[[^\]]+\]\(https:\/\/www\.youtube\.com\/watch\?v=[^)]+\) \|/gm) ?? [];
if (rows.length !== 18) fail(`expected 18 exact video rows, received ${rows.length}`);
if (!snapshot.includes('523,708,340 views') || !snapshot.includes('2,846,527 likes')) fail('Flying direct-page demand snapshot missing');
if (!snapshot.includes('No audio is downloaded')) fail('rights boundary missing');
console.log('PASS: 18 exact public-market video records with dated visible view signals and explicit analysis-only rights boundary.');
