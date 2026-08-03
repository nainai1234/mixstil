import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ADB = '/opt/homebrew/share/android-commandlinetools/platform-tools/adb';
const root = process.cwd();
const adb = String(process.env.ADB ?? DEFAULT_ADB);
const deviceQaPath = path.join(root, 'docs/mobile-playback-device-qa.md');
const deviceQa = fs.readFileSync(deviceQaPath, 'utf8');

const runAdb = (...args) => {
  try {
    return execFileSync(adb, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
  } catch (error) {
    return String(error instanceof Error ? error.message : error);
  }
};

const connectedDevices = runAdb('devices', '-l')
  .split('\n')
  .slice(1)
  .filter((line) => /\sdevice\b/.test(line))
  .map((line) => line.trim());

const runs = [
  {
    id: 'android30',
    label: 'Android 30',
    durationMinutes: 30,
    checkpointSeconds: 1800,
    requiredInterruption: 'none',
    status: /Android 30[^\n|]*(?:\|[^\n]*){7}\|\s*pending\s*\|/.test(deviceQa) ? 'pending' : 'unknown',
    requiredHumanEvidence: [
      'lock-screen controls',
      'full-session audible continuity',
      'no unexplained silence',
      'recipe position stable after completion',
    ],
  },
  {
    id: 'android60',
    label: 'Android 60',
    durationMinutes: 60,
    checkpointSeconds: 3600,
    requiredInterruption: 'notification or call',
    status: deviceQa.includes('Android 60 still needs')
      ? 'partial_technical_pass_audible_continuity_pending'
      : 'unknown',
    requiredHumanEvidence: [
      'owner confirmation of uninterrupted audible output for the complete session',
      'notification or call interruption recovery',
    ],
  },
  {
    id: 'android90',
    label: 'Android 90',
    durationMinutes: 90,
    checkpointSeconds: 5400,
    requiredInterruption: 'headphone or Bluetooth change',
    status: /Android 90[^\n|]*(?:\|[^\n]*){7}\|\s*pending\s*\|/.test(deviceQa) ? 'pending' : 'unknown',
    requiredHumanEvidence: [
      'headphone or Bluetooth route-change recovery',
      'full-session audible continuity',
      'hidden checkpoint telemetry',
      'recipe position stable after route change',
    ],
  },
  {
    id: 'android120',
    label: 'Android 120',
    durationMinutes: 120,
    checkpointSeconds: 7200,
    requiredInterruption: 'none',
    status: /Android 120[^\n|]*(?:\|[^\n]*){7}\|\s*pending\s*\|/.test(deviceQa) ? 'pending' : 'unknown',
    requiredHumanEvidence: [
      'full-session audible continuity',
      'hidden 7200-second checkpoint',
      'no playback or native-session failure',
      'natural completion at endpoint',
    ],
  },
];

const openRuns = runs.filter((run) => run.status !== 'pass');
const nextRun = openRuns.find((run) => run.id === 'android30')
  ?? openRuns.find((run) => run.id === 'android60')
  ?? openRuns[0]
  ?? null;

const report = {
  generatedAt: new Date().toISOString(),
  passed: openRuns.length === 0,
  releaseVerdict: openRuns.length === 0 ? 'GO' : 'NO-GO',
  source: path.relative(root, deviceQaPath),
  connectedDevices,
  deviceReady: connectedDevices.length > 0,
  nextRun,
  runs,
  commands: {
    listDevices: 'adb devices -l',
    prepareLocalAndroidBuild: 'pnpm mobile:sync:android:local && pnpm mobile:build:android',
    installDebugApk: 'adb install -r android/app/build/outputs/apk/debug/app-debug.apk',
    reverseApiPort: 'adb reverse tcp:8788 tcp:8788',
    verifyActivePlayback: 'pnpm qa:android-playback-device -- --serial=<adb-serial>',
    verifyScreenOffPlayback: 'pnpm qa:android-playback-device -- --serial=<adb-serial> --lock-seconds=15',
    workbench: 'http://localhost:5174/internal/mobile-playback-qa',
  },
  nextActions: connectedDevices.length
    ? [
      'Open the workbench, select the next Android row, and create or reuse the row-specific QA mix.',
      'Start playback from a real physical tap in the installed Android app.',
      'Run the active-playback verifier while audio is playing.',
      'Lock the screen for the full required duration and keep headphone listening confirmation separate from machine telemetry.',
      'After completion, verify telemetry in the workbench and save the QA report.',
    ]
    : [
      'Connect and authorize an Android device with USB debugging enabled.',
      'Run adb devices -l and confirm the device appears as device, not unauthorized or offline.',
      'Then rerun pnpm qa:android-playback-matrix to get the row-specific next step.',
    ],
};

console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = connectedDevices.length ? 2 : 3;
