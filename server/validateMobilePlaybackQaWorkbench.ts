import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/pages/MobilePlaybackQaPage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
const androidDeviceQa = fs.readFileSync(path.join(root, 'scripts/verify-android-playback-device.mjs'), 'utf8');
const androidMatrix = fs.readFileSync(path.join(root, 'scripts/report-android-playback-matrix.mjs'), 'utf8');

const requiredContracts = [
  [app, 'MobilePlaybackQaPage', 'App imports mobile playback QA page'],
  [app, 'internal/mobile-playback-qa', 'App exposes internal mobile playback QA route'],
  [page, "id: 'ios30'", 'iOS 30 run exists'],
  [page, "id: 'ios60'", 'iOS 60 run exists'],
  [page, "id: 'ios90'", 'iOS 90 run exists'],
  [page, "id: 'ios120'", 'iOS 120 run exists'],
  [page, "id: 'android30'", 'Android 30 run exists'],
  [page, "id: 'android60'", 'Android 60 run exists'],
  [page, "id: 'android90'", 'Android 90 run exists'],
  [page, "id: 'android120'", 'Android 120 run exists'],
  [page, "runtime: 'Installed iOS app'", 'iOS rows validate the installed app'],
  [page, "runtime: 'Installed Android app'", 'Android rows validate the installed app'],
  [page, 'checkpointRecorded', 'QA records checkpoint status'],
  [page, 'nativeMediaSessionReady', 'QA records native media-session readiness'],
  [page, 'recipePositionStable', 'QA records recipe-position stability'],
  [page, 'deviceVerifierEvidence', 'QA preserves physical-device verifier evidence in the saved report'],
  [page, 'api.saveListeningQaResults', 'QA report can be saved'],
  [page, 'navigator.clipboard.writeText', 'QA report can be copied'],
  [page, 'openSelectedPlayer', 'QA can open a direct player URL for the selected run'],
  [page, 'createSelectedMix', 'QA can create a duration-specific mix for the selected run'],
  [page, 'verifyTelemetry', 'QA can verify persisted journey telemetry'],
  [page, 'api.getPlaybackJourneyEvents', 'QA reads persisted journey events instead of relying on manual claims'],
  [page, 'selectedRun.durationMinutes * 60', 'QA creates mixes at the selected run duration'],
  [page, 'internalMobilePlaybackQa: true', 'QA requests the internal long-session creation path'],
  [api, "'X-SNOOZE-Internal-QA': 'mobile-playback'", 'QA request carries the internal marker'],
  [server, '!runtimeConfig.production', 'Internal QA entitlement bypass is disabled in production'],
  [server, "req.header('x-snooze-internal-qa') === 'mobile-playback'", 'Server validates the internal QA marker'],
  [server, 'return { maxSessionSeconds: null, isPreview: false }', 'Owned internal QA playback is not truncated by free-tier duration'],
  [player, "validationCohort === 'deviceqa'", 'Device QA player requests the internal playback policy'],
  [page, 'journeyStartedAt', 'Direct player URL preserves journey timing'],
  [packageJson.scripts?.['qa:android-playback-matrix'] ?? '', 'report-android-playback-matrix.mjs', 'Android playback matrix reporter is runnable'],
  [packageJson.scripts?.['qa:android-playback-device'] ?? '', 'verify-android-playback-device.mjs', 'Android physical-device verifier is runnable'],
  [androidMatrix, 'releaseVerdict', 'Android matrix reporter states the release verdict'],
  [androidMatrix, 'connectedDevices', 'Android matrix reporter checks connected ADB devices'],
  [androidMatrix, 'nextRun', 'Android matrix reporter identifies the next open row'],
  [androidMatrix, 'workbench', 'Android matrix reporter points back to the QA workbench'],
  [androidDeviceQa, 'systemMediaSession', 'Android verifier requires a real system media session'],
  [androidDeviceQa, 'audioOutputStarted', 'Android verifier requires active audio output'],
  [androidDeviceQa, '(?:userId|uid|appId)', 'Android verifier recognizes current and vendor-specific package UID formats'],
  [androidDeviceQa, 'foregroundPlaybackService', 'Android verifier requires the foreground playback service'],
  [androidDeviceQa, 'mediaNotification', 'Android verifier requires the media notification'],
  [androidDeviceQa, '30/60/90/120 minute row passes only', 'Android verifier preserves the long-session evidence boundary'],
] as const;

const missing = requiredContracts
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length) throw new Error(`Mobile playback QA workbench contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  route: '/internal/mobile-playback-qa',
  runs: ['ios30', 'ios60', 'ios90', 'ios120', 'android30', 'android60', 'android90', 'android120'],
  evidence: ['mixId', 'journeyId', 'nativeMediaSessionReady', 'checkpointRecorded', 'recipePositionStable', 'deviceVerifierEvidence', 'verdict', 'notes'],
  androidMatrixReporter: 'pnpm qa:android-playback-matrix',
}, null, 2));
