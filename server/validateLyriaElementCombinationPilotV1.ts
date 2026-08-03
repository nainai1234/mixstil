import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batchId = 'lyria-element-combination-pilot-v1';
const batchRoot = path.join(root, 'public/audio/music/local-review', batchId);
const manifestPath = path.join(batchRoot, 'manifest.json');
const analysisPath = path.join(batchRoot, 'analysis.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => { throw new Error(`Lyria element combination validation failed: ${message}`); };

for (const file of [manifestPath, analysisPath, reviewPath]) if (!existsSync(file)) fail(`missing ${file}`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
const html = readFileSync(reviewPath, 'utf8');
if (manifest.batchId !== batchId || manifest.sourceBatchId !== 'lyria-single-element-pilot-v1') fail('batch lineage changed');
if (manifest.productionAllowed !== false || manifest.status !== 'candidate_pending_human_combination_review') fail('pilot must remain blocked from production');
if (!Array.isArray(analysis.candidates) || analysis.candidates.length !== 24) fail('expected acoustic analysis for 24 candidates');
if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length !== 3) fail('expected three scenario mixes');
const expectedGoals = ['sleep', 'calm', 'focus'];
for (const [index, scenario] of manifest.scenarios.entries()) {
  if (scenario.goal !== expectedGoals[index]) fail(`scenario ${index} goal changed`);
  if (scenario.productionAllowed !== false) fail(`${scenario.id} is unexpectedly production-allowed`);
  if (scenario.selection?.selected?.length !== 3) fail(`${scenario.id} must use three independently identified elements`);
  const audioPath = path.join(root, 'public', String(scenario.render?.audioUrl ?? '').replace(/^\//, ''));
  if (!existsSync(audioPath) || statSync(audioPath).size < 5_000_000) fail(`${scenario.id} render is missing or too small`);
  if (scenario.render.durationSeconds < 599 || ![44100, 48000].includes(scenario.render.sampleRate) || scenario.render.codec !== 'mp3') fail(`${scenario.id} render metrics are invalid`);
}
for (const contract of [':harmony"', ':repetition"', ':fit"', ':decision"', 'productionAllowed=false', 'localStorage', '元素是否真的能够组成不同内容']) if (!html.includes(contract)) fail(`review contract missing ${contract}`);
if (/selected(?:=|\s)/.test(html)) fail('review page must not preselect human decisions');
console.log('PASS: 24 Lyria candidates were acoustically analyzed and three 10-minute compatibility mixes are ready for human review; production remains blocked.');
