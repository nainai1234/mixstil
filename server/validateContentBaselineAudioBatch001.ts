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
  probe: {
    durationSeconds: number;
    sizeBytes: number;
  };
};

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-001-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-001/index.html');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
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

assert(manifest.candidates.length === 10, 'Batch 001 must include 10 audio candidates');
assert(countByGoal.sleep === 4, 'Batch 001 must include 4 sleep candidates');
assert(countByGoal.calm === 3, 'Batch 001 must include 3 calm candidates');
assert(countByGoal.focus === 3, 'Batch 001 must include 3 focus candidates');
assert(manifest.reviewPage === '/review/content-baseline-batch-001/index.html', 'Batch 001 review page path must be stable');
assert(fs.existsSync(reviewPath), 'Batch 001 review page must exist');

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  assert(candidate.outputUrl.startsWith('/audio/content-baseline/batch-001/'), `${candidate.id} must use batch output URL`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain a candidate preview`);
  assert(candidate.probe.durationSeconds >= 119 && candidate.probe.durationSeconds <= 121, `${candidate.id} must be a 120 second preview`);
  assert(candidate.probe.sizeBytes > 500000, `${candidate.id} must not be an empty or tiny MP3`);
  assert(candidate.title.trim().length > 0, `${candidate.id} must have a title`);
  assert(candidate.scene.trim().length > 0, `${candidate.id} must have a scene`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 001 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  candidates: manifest.candidates.length,
  byGoal: countByGoal,
  reviewPage: manifest.reviewPage,
}, null, 2));
