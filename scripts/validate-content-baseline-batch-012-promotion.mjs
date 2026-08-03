import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const promotionPath = path.join(root, 'data/content-baseline/content-baseline-batch-012-promotion.json');
const reportPath = path.join(root, 'reports/content-baseline-batch-012-promotion-2026-07-17.md');
const promotion = JSON.parse(fs.readFileSync(promotionPath, 'utf8'));
const report = fs.readFileSync(reportPath, 'utf8');
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(promotion.version.includes('content-baseline-batch-012-promotion'), 'Promotion manifest version must identify Batch 012');
assert(promotion.decision === 'promote_as_internal_audible_product_baseline_seed', 'Decision must be internal baseline seed promotion');
assert(promotion.decisionReason.includes('save and replay'), 'Decision reason must preserve save/replay evidence');
assert(promotion.promoted.length === 3, 'Exactly 3 Batch 012 candidates should be promoted');
assert(new Set(promotion.promoted.map((item) => item.goal)).size === 3, 'Promoted set must cover Sleep, Calm, and Focus');
assert(promotion.acceptedContentFormula.rejectedPatterns.some((item) => item.includes('mechanical')), 'Rejected mechanical pattern must be recorded');
assert(promotion.acceptedContentFormula.rejectedPatterns.some((item) => item.includes('hellish')), 'Rejected hellish resonance pattern must be recorded');
assert(promotion.nextProductionStep.target.includes('30 finished-content items'), 'Next step must target 30 finished-content items');

for (const item of promotion.promoted) {
  assert(item.promotionStatus === 'internal_audible_product_baseline_seed', `${item.id} must be marked as internal baseline seed`);
  assert(item.ownerListeningVerdict === 'save_and_replay_worthy', `${item.id} must carry save/replay verdict`);
  assert(item.ownerListeningQuote.includes('保存'), `${item.id} must preserve owner quote`);
  assert(item.notForUseAs.includes('foundational basic sound'), `${item.id} must not be used as foundational basic sound`);
  assert(item.requiredBeforePublicRelease.length >= 4, `${item.id} must list remaining public-release gates`);
  assert(fs.existsSync(path.join(root, item.outputPath)), `${item.id} audio file must exist`);
  assert(/^[a-f0-9]{64}$/.test(item.sha256), `${item.id} must have a SHA-256`);
}

assert(report.includes('promoted as Internal Audible Product Baseline seed'), 'Report must state internal baseline seed status');
assert(report.includes('Remaining before public release'), 'Report must preserve public-release boundary');

if (failures.length) {
  throw new Error(`Batch 012 promotion validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  promoted: promotion.promoted.length,
  decision: promotion.decision,
}, null, 2));
