import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batchId = 'lyria-multi-composition-pilot-v1';
const manifestPath = path.join(root, 'public/audio/music/local-review', batchId, 'manifest.json');
const reviewPath = path.join(root, 'public/review', batchId, 'index.html');
const fail = (message: string): never => { throw new Error(`Lyria multi-composition validation failed: ${message}`); };
if (!existsSync(manifestPath) || !existsSync(reviewPath)) fail('manifest or review page is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const html = readFileSync(reviewPath, 'utf8');
if (manifest.batchId !== batchId || manifest.sourceBatchId !== 'lyria-single-element-pilot-v1') fail('batch lineage changed');
if (manifest.productionAllowed !== false || manifest.status !== 'candidate_pending_human_multi_composition_review') fail('pilot must remain blocked from production');
if (manifest.compositionCount !== 12 || manifest.scenarios?.length !== 3) fail('expected 12 compositions across three goals');
const compositions = manifest.scenarios.flatMap((scenario: any) => scenario.compositions ?? []);
if (compositions.length !== 12) fail('composition records are incomplete');
for (const composition of compositions) {
  if (composition.productionAllowed !== false || composition.selected?.length !== 3) fail(`${composition.id} has invalid element contract`);
  if (!Array.isArray(composition.fingerprint) || composition.fingerprint.length < 40) fail(`${composition.id} fingerprint is missing`);
  const audioPath = path.join(root, 'public', String(composition.render?.audioUrl ?? '').replace(/^\//, ''));
  if (!existsSync(audioPath) || statSync(audioPath).size < 5_000_000) fail(`${composition.id} render is missing or too small`);
  if (composition.render.durationSeconds < 299 || composition.render.codec !== 'mp3' || ![44100, 48000].includes(composition.render.sampleRate)) fail(`${composition.id} render metrics are invalid`);
}
if (!manifest.diversity || !Array.isArray(manifest.diversity.pairs) || manifest.diversity.pairs.length !== 66) fail('collection diversity matrix is incomplete');
for (const contract of [':distinct"', ':fatigue"', ':fit"', ':decision"', 'productionAllowed:false', 'localStorage', '同一批元素能否生成不同曲目']) if (!html.includes(contract)) fail(`review contract missing ${contract}`);
if (/selected(?:=|\s)/.test(html)) fail('review page must not preselect human decisions');
console.log(`PASS: 12 five-minute compositions are ready for human diversity review; ${manifest.diversity.nearDuplicatePairs.length} machine near-duplicate pairs; production remains blocked.`);
