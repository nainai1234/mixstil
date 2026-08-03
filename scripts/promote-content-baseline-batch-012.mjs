import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceManifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-012-manifest.json');
const promotionManifestPath = path.join(root, 'data/content-baseline/content-baseline-batch-012-promotion.json');
const reportPath = path.join(root, 'reports/content-baseline-batch-012-promotion-2026-07-17.md');
const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));

const sha256 = (filePath) => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const promoted = sourceManifest.candidates.map((candidate) => {
  const absolutePath = path.join(root, candidate.outputPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing promoted audio: ${candidate.outputPath}`);
  return {
    id: candidate.id,
    title: candidate.title,
    goal: candidate.goal,
    scene: candidate.scene,
    contentClass: candidate.contentClass,
    outputPath: candidate.outputPath,
    outputUrl: candidate.outputUrl,
    sha256: sha256(absolutePath),
    durationSeconds: candidate.probe.durationSeconds,
    promotionStatus: 'internal_audible_product_baseline_seed',
    ownerListeningVerdict: 'save_and_replay_worthy',
    ownerListeningQuote: '我愿意保存下来，下次还会打开',
    acceptedFormula: 'music bed as main content plus micro organic texture below attention',
    notForUseAs: [
      'foundational basic sound',
      'white-noise/noise-bed variant',
      'standalone proof of paid beta inventory depth',
    ],
    requiredBeforePublicRelease: [
      'longer duration family or loop/extension QA',
      'source and derivative rights chain confirmation for every ingredient',
      'Recipe V2 registration or release-catalog wiring',
      'broader internal audible baseline expansion to at least 30 finished items',
    ],
  };
});

const promotion = {
  version: '2026-07-17.content-baseline-batch-012-promotion',
  generatedAt: new Date().toISOString(),
  sourceManifest: 'data/content-baseline/content-baseline-batch-012-manifest.json',
  reviewPage: sourceManifest.reviewPage,
  decision: 'promote_as_internal_audible_product_baseline_seed',
  decisionReason: 'Owner listening confirmed Batch 012 contains content they would save and replay. This is the first successful finished-content direction after repeated noise-bed, mechanical, hellish-resonance, and pure-music failures.',
  acceptedContentFormula: {
    primaryLayer: 'quiet music bed',
    secondaryLayer: 'micro organic texture or musical release below attention',
    rejectedPatterns: [
      'white/pink/brown noise as main content',
      'mechanical/electric/pulse engine substrate',
      'hellish, horror-like, dark ritual resonance',
      'obvious wind/rain/room texture as foreground',
      'music bed too loud or too busy',
      'pure music with no soundscape character',
    ],
  },
  promoted,
  nextProductionStep: {
    target: 'expand to 30 finished-content items for Internal Audible Product Baseline',
    batchSize: 6,
    method: 'derive close variants from the Batch 012 formula across bedtime sleep, quiet relaxation, and deep focus while preserving save/replay listening gates',
  },
};

fs.writeFileSync(promotionManifestPath, `${JSON.stringify(promotion, null, 2)}\n`, 'utf8');

const rows = promoted.map((item) => `| ${item.goal} | ${item.title} | \`${item.id}\` | ${item.durationSeconds.toFixed(0)}s | \`${item.sha256.slice(0, 12)}…\` |`).join('\n');
fs.writeFileSync(reportPath, `# Content Baseline Batch 012 Promotion

Date: 2026-07-17  
Status: **promoted as Internal Audible Product Baseline seed**, not public release.

Owner verdict: “我愿意保存下来，下次还会打开”.

## Promoted candidates

| Goal | Title | ID | Duration | SHA-256 |
| --- | --- | --- | ---: | --- |
${rows}

## Accepted formula

- Quiet music bed remains the main content.
- Micro organic texture or musical release stays below attention.
- The result is judged as finished music-led soundscape content, not as foundational basic sound.

## Do not regress to

- White/pink/brown noise as main content.
- Mechanical/electric/pulse engine substrates.
- Hellish, horror-like, dark ritual resonance.
- Obvious wind/rain/room texture as foreground.
- Music beds that are too loud, busy, or merely pure music without soundscape character.

## Remaining before public release

- Longer duration family or loop/extension QA.
- Rights chain confirmation for every ingredient and derivative output.
- Recipe V2/release-catalog wiring.
- Expansion to at least 30 finished items for the Internal Audible Product Baseline.
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  promoted: promoted.length,
  promotionManifest: path.relative(root, promotionManifestPath),
  report: path.relative(root, reportPath),
}, null, 2));
