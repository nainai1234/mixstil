import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'public/audio/music/local-review/lyria-demucs-pilot-v1/manifest.json');
const reviewPath = path.join(root, 'public/review/lyria-demucs-pilot-v1/index.html');
const fail = (message: string): never => { throw new Error(`Lyria Demucs pilot validation failed: ${message}`); };
if (!existsSync(manifestPath) || !existsSync(reviewPath)) fail('manifest or review page is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const html = readFileSync(reviewPath, 'utf8');
if (manifest.productionAllowed !== false || manifest.status !== 'candidate_pending_human_stem_review') fail('pilot must remain a blocked candidate');
if (manifest.provider !== 'google-cloud-vertex-ai' || manifest.sourceModel !== 'lyria-3-clip-preview') fail('source provider/model changed');
if (manifest.separator?.name !== 'Demucs' || manifest.separator?.model !== 'htdemucs_6s') fail('separator identity changed');
if (manifest.candidates?.length !== 3) fail(`expected 3 candidates, got ${manifest.candidates?.length}`);
for (const candidate of manifest.candidates) {
  if (candidate.originalMetrics?.durationSeconds < 27 || candidate.originalMetrics?.durationSeconds > 32) fail(`${candidate.id} original duration is outside the observed Clip range`);
  if (candidate.stems?.length !== 6) fail(`${candidate.id} does not have six stems`);
  for (const stem of candidate.stems) {
    const filePath = path.join(root, 'public', String(stem.audioUrl).replace(/^\//, ''));
    if (!existsSync(filePath) || statSync(filePath).size < 10_000) fail(`${candidate.id}/${stem.role} is missing or empty`);
    if (stem.metrics?.durationSeconds < 27) fail(`${candidate.id}/${stem.role} duration is incomplete`);
  }
}
for (const required of ['原曲质量', '分轨可用性', '人声污染', 'lyria-demucs-pilot-v1-review.json', 'localStorage']) if (!html.includes(required)) fail(`review contract missing ${required}`);
console.log('PASS: 3 real Lyria originals and 18 Demucs stems are ready for human quality review; production remains blocked.');
