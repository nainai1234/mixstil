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
  stateArc: string;
  listeningQuestion: string;
  sources: Array<{
    role: string;
    path: string;
    note: string;
  }>;
  probe: {
    durationSeconds: number;
    sizeBytes: number;
  };
};

const root = process.cwd();
const manifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-003-manifest.json');
const reviewPath = path.join(root, 'public/review/content-baseline-batch-003/index.html');
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

assert(manifest.candidates.length === 5, 'Batch 003 must include 5 arrangement candidates');
assert(countByGoal.sleep === 2, 'Batch 003 must include 2 sleep candidates');
assert(countByGoal.calm === 2, 'Batch 003 must include 2 calm candidates');
assert(countByGoal.focus === 1, 'Batch 003 must include 1 focus candidate');
assert(manifest.reviewPage === '/review/content-baseline-batch-003/index.html', 'Batch 003 review page path must be stable');
assert(fs.existsSync(reviewPath), 'Batch 003 review page must exist');
assert(!reviewHtml.includes('src="/audio/content-baseline/batch-003/'), 'Batch 003 review page must use file-open-safe relative audio paths');
assert(manifest.purpose.includes('Batch 002') && manifest.purpose.includes('whole mix'), 'Batch 003 must document the Batch 002 correction');
assert(manifest.hardGates.some((gate) => gate.includes('full mix')), 'Batch 003 must include a full-mix hard gate');
assert(manifest.hardGates.some((gate) => gate.includes('ordinary listening')), 'Batch 003 must include a state-change hard gate');

for (const candidate of manifest.candidates) {
  const filePath = path.join(root, candidate.outputPath);
  assert(fs.existsSync(filePath), `${candidate.id} audio file must exist`);
  assert(candidate.outputUrl.startsWith('/audio/content-baseline/batch-003/'), `${candidate.id} must use batch output URL`);
  assert(candidate.productionStatus === 'candidate_preview', `${candidate.id} must remain a candidate preview`);
  assert(candidate.productionCorrection === 'batch_002_music_source_attractive_but_mix_not_stateful', `${candidate.id} must carry the correction marker`);
  assert(candidate.probe.durationSeconds >= 149 && candidate.probe.durationSeconds <= 151, `${candidate.id} must be a 150 second preview`);
  assert(candidate.probe.sizeBytes > 700000, `${candidate.id} must not be an empty or tiny MP3`);
  assert(candidate.stateArc.includes('->'), `${candidate.id} must define a state-transition arc`);
  assert(candidate.listeningQuestion.trim().length >= 40, `${candidate.id} must define a useful listening question`);
  assert(candidate.sources.length >= 3, `${candidate.id} must use at least three arranged layers`);
  assert(candidate.sources.some((source) => {
    const role = source.role.toLowerCase();
    return role.includes('mask')
      || role.includes('room')
      || role.includes('air')
      || role.includes('brown')
      || role.includes('carriage')
      || role.includes('environment')
      || role.includes('edge')
      || role.includes('suspension');
  }), `${candidate.id} must include a non-music support layer`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-001')), `${candidate.id} must not reuse Batch 001 render output`);
  assert(candidate.sources.every((source) => !source.path.includes('content-baseline/batch-002')), `${candidate.id} must not reuse Batch 002 render output`);
  const relativeReviewSrc = `../../${candidate.outputUrl.replace(/^\//, '')}`;
  assert(reviewHtml.includes(`src="${relativeReviewSrc}"`), `${candidate.id} review audio must use a relative file-open-safe src`);
}

if (failures.length) {
  throw new Error(`Content baseline audio batch 003 validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  candidates: manifest.candidates.length,
  byGoal: countByGoal,
  reviewPage: manifest.reviewPage,
}, null, 2));
