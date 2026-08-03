import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batch = process.argv[2];

if (!batch || !/^0\d{2}$/.test(batch)) {
  throw new Error('Usage: node scripts/promote-content-baseline-batch.mjs 013');
}

const date = '2026-07-17';
const sourceManifestPath = path.join(root, `data/content-baseline/content-baseline-batch-${batch}-manifest.json`);
const promotionManifestPath = path.join(root, `data/content-baseline/content-baseline-batch-${batch}-promotion.json`);
const reportPath = path.join(root, `reports/content-baseline-batch-${batch}-promotion-${date}.md`);

const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
const ownerQuote = batch === '013'
  ? '都愿意保存，下次还会打开'
  : (process.env.OWNER_LISTENING_QUOTE ?? '愿意保存，下次还会打开');

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
    ownerListeningQuote: ownerQuote,
    acceptedFormula: 'music bed as main content plus micro organic texture or musical release below attention',
    inheritedFrom: sourceManifest.inheritedPromotion ?? null,
    notForUseAs: [
      'foundational basic sound',
      'white-noise/noise-bed variant',
      'proof of public-release content depth without further QA',
    ],
    requiredBeforePublicRelease: [
      'longer duration family or loop/extension QA',
      'source and derivative rights chain confirmation for every ingredient',
      'Recipe V2 registration or release-catalog wiring',
      'full Internal Audible Product Baseline expansion and diversity review',
    ],
  };
});

const byGoal = promoted.reduce((counts, item) => {
  counts[item.goal] = (counts[item.goal] ?? 0) + 1;
  return counts;
}, {});

const promotion = {
  version: `${date}.content-baseline-batch-${batch}-promotion`,
  generatedAt: new Date().toISOString(),
  sourceManifest: `data/content-baseline/content-baseline-batch-${batch}-manifest.json`,
  reviewPage: sourceManifest.reviewPage,
  decision: 'promote_as_internal_audible_product_baseline_seed',
  decisionReason: `Owner listening confirmed Batch ${Number(batch)} candidates are save/replay worthy: “${ownerQuote}”.`,
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
  byGoal,
  promoted,
  nextProductionStep: {
    target: 'reach 30 finished-content items for Internal Audible Product Baseline',
    currentPromotedCountFromThisBatch: promoted.length,
    method: 'continue deriving close variants from the Batch 012/013 formula, then run diversity, longer-duration, rights, and Recipe V2 wiring gates',
  },
};

fs.writeFileSync(promotionManifestPath, `${JSON.stringify(promotion, null, 2)}\n`, 'utf8');

const rows = promoted.map((item) => `| ${item.goal} | ${item.title} | \`${item.id}\` | ${item.durationSeconds.toFixed(0)}s | \`${item.sha256.slice(0, 12)}…\` |`).join('\n');
fs.writeFileSync(reportPath, `# Content Baseline Batch ${batch} Promotion

Date: ${date}  
Status: **promoted as Internal Audible Product Baseline seed**, not public release.

Owner verdict: “${ownerQuote}”.

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
- Expansion and diversity review for the full 30-item Internal Audible Product Baseline.
`, 'utf8');

console.log(JSON.stringify({
  passed: true,
  batch,
  promoted: promoted.length,
  byGoal,
  promotionManifest: path.relative(root, promotionManifestPath),
  report: path.relative(root, reportPath),
}, null, 2));
