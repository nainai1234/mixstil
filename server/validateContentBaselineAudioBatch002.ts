import fs from 'node:fs';
import path from 'node:path';

type Candidate = {
  id: string;
  title: string;
  goal: 'sleep' | 'calm' | 'focus';
  scene: string;
  outputPath: string;
  outputUrl: string;
  productionStatus: string;
  productionCorrection: string;
  musicalGate: string;
  sources: Array<{
    role: string;
    path: string;
  }>;
  probe: {
    durationSeconds: number;
    sizeBytes: number;
  };
};

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-002-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-002/index.html');
const reviewHtml = fs.readFileSync(reviewPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  purpose: string;
  hardGates: string[];
  candidates: Candidate[];
  reviewPage: string;
};
const failures: string[] = [];

const assert = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const countByGoal = manifest.candidates.reduce<Record<string, number>>((counts, item) => {
  counts[item.goal] = (counts[item.goal] ?? 0) + 1;
  return counts;
}, {});

assert(manifest.candidates.length === 9, 'Batch 002 must include 9 audio candidates');
assert(countByGoal.sleep === 3, 'Batch 002 must include 3 sleep candidates');
assert(countByGoal.calm === 3, 'Batch 002 must include 3 calm candidates');
assert(countByGoal.focus === 3, 'Batch 002 must include 3 focus candidates');
assert(manifest.reviewPage === '/review/content-baseline-batch-002/index.html', 'Batch 002 review page path must be stable');
assert(fs.existsSync(reviewPath), 'Batch 002 review page must exist');
assert(!reviewHtml.includes('src="/audio/content-baseline/batch-002/'), 'Batch 002 review page must use file-open-safe relative audio paths');
assert(manifest.purpose.includes('white-noise') || manifest.purpose.includes('noise-bed'), 'Batch 002 must document the Batch 001 correction');
assert(manifest.hardGates.some((gate) => gate.includes('melody') || gate.includes('chord')), 'Batch 002 must include a musical hard gate');

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  assert(candidate.outputUrl.startsWith('/audio/content-baseline/batch-002/'), `${candidate.id} must use batch output URL`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain a candidate preview`);
  assert(candidate.productionCorrection === 'batch_001_noise_bed_rejected_batch_002_music_forward', `${candidate.id} must carry the correction marker`);
  assert(candidate.probe.durationSeconds >= 119 && candidate.probe.durationSeconds <= 121, `${candidate.id} must be a 120 second preview`);
  assert(candidate.probe.sizeBytes > 500000, `${candidate.id} must not be an empty or tiny MP3`);
  assert(candidate.title.trim().length > 0, `${candidate.id} must have a title`);
  assert(candidate.scene.trim().length > 0, `${candidate.id} must have a scene`);
  assert(candidate.musicalGate.trim().length >= 24, `${candidate.id} must define a musical listening gate`);
  assert(candidate.sources.some((source) => source.role === 'music_main'), `${candidate.id} must include a music_main source`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-001')), `${candidate.id} must not reuse Batch 001 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('/noise/')), `${candidate.id} must not use the noise asset folder`);
  const relativeReviewSrc = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${relativeReviewSrc}"`), `${candidate.id} review audio must use a relative file-open-safe src`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 002 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  candidates: manifest.candidates.length,
  byGoal: countByGoal,
  reviewPage: manifest.reviewPage,
}, null, 2));
