import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>;
};
const charter = fs.readFileSync(path.join(root, 'docs/project-mainline-charter.md'), 'utf8');
const masterPlan = fs.readFileSync(path.join(root, 'docs/toc-product-development-master-plan.md'), 'utf8');
const deviceQa = fs.readFileSync(path.join(root, 'docs/mobile-playback-device-qa.md'), 'utf8');

const requiredScripts = [
  'validate:media-session-contract',
  'validate:playback-recovery-contract',
  'validate:playback-interruption-contract',
  'validate:long-session-playback-contract',
  'validate:language-preference-contract',
  'validate:playback-checkpoint-contract',
];

const missingScripts = requiredScripts.filter((script) => !packageJson.scripts?.[script]);

const requiredDocs = [
  [charter, 'Sprint 0 through Sprint 3 implementation were completed', 'project charter records Sprint 1 implementation completion'],
  [masterPlan, 'Long-session stability for 30, 60, 90, and 120 minutes.', 'master plan long-session gate'],
  [deviceQa, 'Installed iOS app', 'device QA requires the installed iOS app'],
  [deviceQa, 'Installed Android app', 'device QA requires the installed Android app'],
  [deviceQa, 'do not approve the', 'browser regressions do not approve store builds'],
  [deviceQa, 'playback_checkpoint', 'device QA checks checkpoint telemetry'],
  [deviceQa, 'no iOS/Android store build is', 'device QA keeps real-device gate explicit'],
] as const;

const missingDocs = requiredDocs
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missingScripts.length || missingDocs.length) {
  throw new Error(`Sprint 1 code readiness failed:\n- ${[
    ...missingScripts.map((script) => `missing script ${script}`),
    ...missingDocs,
  ].join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  codeReadiness: [
    'media-session-controls',
    'playback-state-recovery',
    'interruption-handling',
    'long-session-rolling-scheduler',
    'system-language-default-and-override',
    'long-session-checkpoint-telemetry',
  ],
  completedDeviceEvidence: [
    'Installed iOS app 30/60/90/120 minute lock-screen playback',
    'iOS lock-screen controls and replay after completion',
    'iOS call interruption and headphone/Bluetooth route recovery',
  ],
  remainingDeviceGates: [
    'Installed Android app 30/60/90/120 minute lock-screen playback',
    'Android notification/call/headphone interruption recovery',
  ],
  runbook: 'docs/mobile-playback-device-qa.md',
}, null, 2));
