import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const planPath = path.join(root, 'docs/content-baseline-rebuild-plan.md');
const plan = fs.readFileSync(planPath, 'utf8');

const required = [
  [plan, 'Stable device playback\ndoes not create paid value', 'plan separates playback reliability from paid content value'],
  [plan, 'Layer A: Finished Content', 'finished content layer is defined'],
  [plan, 'Layer B: Foundational Sounds', 'foundational sound layer is defined'],
  [plan, '80-100 finished content items', 'paid beta finished-content target exists'],
  [plan, '150-250 foundational sounds', 'paid beta foundational-sound target exists'],
  [plan, '30 finished content items', 'internal audible baseline finished-content target exists'],
  [plan, '80-100 foundational sounds', 'internal audible baseline foundational-sound target exists'],
  [plan, 'Content Factory', 'content factory flow exists'],
  [plan, 'human listening QA', 'human listening gate exists'],
  [plan, 'audible identity gate', 'audible identity gate exists'],
  [plan, 'scene-fit gate', 'scene-fit gate exists'],
  [plan, 'Pause:', 'explicit pause list exists'],
  [plan, 'Android 30/90/120 long-session QA', 'device QA is paused as noncritical content work'],
  [plan, 'Subscription, trials, entitlements, and payment', 'payment work remains deferred'],
  [plan, 'Immediate Next Work', 'immediate execution list exists'],
  [plan, 'data/content-baseline/finished-content-briefs-v1.json', 'Batch 001 finished-content briefs are linked'],
  [plan, 'data/content-baseline/foundational-sound-gaps-v1.json', 'Batch 001 foundational sound gaps are linked'],
  [plan, 'content-baseline-batch-001-manifest.json', 'Batch 001 manifest is linked'],
  [plan, '/review/content-baseline-batch-001/index.html', 'Batch 001 review page is linked'],
  [plan, 'content-baseline-batch-002-manifest.json', 'Batch 002 correction manifest is linked'],
  [plan, '/review/content-baseline-batch-002/index.html', 'Batch 002 review page is linked'],
  [plan, 'ordinary music rather than therapeutic, meditation, focus, or personalized\nsoundscape content', 'Batch 002 owner listening failure is documented'],
  [plan, 'reject any candidate that still primarily feels like white/pink/brown noise', 'Batch 002 musical correction gate exists'],
  [plan, 'Internal Audible Product Baseline completion note', 'internal audible baseline completion is documented'],
  [plan, '30 promoted seeds', '30 promoted internal seeds are documented'],
  [plan, 'music-led finished soundscape first', 'accepted music-led product formula is documented'],
  [plan, 'white-noise foreground', 'rejected white-noise foreground direction remains blocked'],
  [plan, 'scenario-diverse first results', 'scenario-diverse first-result routing is documented'],
  [plan, 'visible match explanation', 'visible match explanation is documented'],
  [plan, 'private My Sounds\n  save/freeze', 'private My Sounds save and freeze loop is documented'],
  [plan, 'publish publicly only when selected', 'public publishing is explicit opt-in after save correction'],
] as const;

const missing = required
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length) {
  throw new Error(`Content baseline rebuild plan validation failed:\n- ${missing.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  plan: 'docs/content-baseline-rebuild-plan.md',
  contentFocus: 'finished-content-and-foundational-sounds',
  paidBetaTargets: {
    finishedContent: '80-100',
    foundationalSounds: '150-250',
  },
  pausedUntilContentBaseline: [
    'noncritical device-release testing',
    'store-submission preparation',
    'subscription and payment',
    'machine-only audio diversity tuning',
  ],
  currentProductLoop: [
    '30 promoted internal baseline seeds',
    'scenario-diverse quick create selection',
    'visible Why this sound explanation',
    'private My Sounds save and frozen replay metadata',
  ],
}, null, 2));
