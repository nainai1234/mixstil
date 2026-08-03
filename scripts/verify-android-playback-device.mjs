import { execFileSync } from 'node:child_process';

const DEFAULT_ADB = '/opt/homebrew/share/android-commandlinetools/platform-tools/adb';
const PACKAGE_NAME = 'com.snooze.soundscapes';

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.length ? value.join('=') : true];
}));

if (options.help) {
  console.log(`Usage:
  node scripts/verify-android-playback-device.mjs --serial=<adb serial>
  node scripts/verify-android-playback-device.mjs --serial=<adb serial> --background-seconds=15
  node scripts/verify-android-playback-device.mjs --serial=<adb serial> --lock-seconds=15

The app must already be playing from a real user tap. The default command is read-only.
Background and lock checks change device state only when their flags are supplied.`);
  process.exit(0);
}

const adb = String(process.env.ADB ?? DEFAULT_ADB);
const serial = String(options.serial ?? process.env.ANDROID_SERIAL ?? '').trim();
const backgroundSeconds = Number(options['background-seconds'] ?? 0);
const lockSeconds = Number(options['lock-seconds'] ?? 0);

const adbArgs = (...args) => serial ? ['-s', serial, ...args] : args;
const runAdb = (...args) => execFileSync(adb, adbArgs(...args), { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const shell = (...args) => runAdb('shell', ...args);
const shellSafe = (...args) => {
  try {
    return shell(...args);
  } catch {
    return '';
  }
};
const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000));

const connectedDevices = runAdb('devices', '-l')
  .split('\n')
  .slice(1)
  .filter((line) => /\sdevice\b/.test(line));
if (connectedDevices.length === 0) throw new Error('No authorized Android device is connected.');
if (!serial && connectedDevices.length > 1) throw new Error('More than one Android device is connected. Pass --serial=<serial>.');
if (serial && !connectedDevices.some((line) => line.startsWith(`${serial} `))) {
  throw new Error(`Android device ${serial} is not connected and authorized.`);
}

const collect = (stage) => {
  const packageDump = shell('dumpsys', 'package', PACKAGE_NAME);
  const processId = shellSafe('pidof', PACKAGE_NAME);
  const uid = packageDump.match(/(?:userId|uid|appId)=(\d+)/)?.[1] ?? '';
  const audioDump = shell('dumpsys', 'audio');
  const mediaSessionDump = shell('dumpsys', 'media_session');
  const serviceDump = shell('dumpsys', 'activity', 'services', PACKAGE_NAME);
  const notificationDump = shell('dumpsys', 'notification', '--noredact');
  const windowDump = shell('dumpsys', 'window');
  const powerDump = shell('dumpsys', 'power');
  const audioPlayerPattern = uid && processId
    ? new RegExp(`u/pid:${uid}/${processId} state:started`)
    : /$a/;
  const checks = {
    processAlive: Boolean(processId),
    audioOutputStarted: audioPlayerPattern.test(audioDump),
    audioFocusHeld: audioDump.includes(`pack: ${PACKAGE_NAME}`) && audioDump.includes('loss: none'),
    systemMediaSession: mediaSessionDump.includes('SNOOZE playback')
      && /Sessions Stack - have [1-9]\d* sessions/.test(mediaSessionDump),
    foregroundPlaybackService: serviceDump.includes('MediaPlaybackService')
      && (/isForeground=true/.test(serviceDump) || /foregroundId=2101/.test(serviceDump) || /startForegroundCount=[1-9]/.test(serviceDump)),
    mediaNotification: new RegExp(`NotificationRecord[^\\n]*${PACKAGE_NAME.replaceAll('.', '\\.')}`).test(notificationDump)
      && notificationDump.includes('snooze_playback'),
  };
  return {
    stage,
    capturedAt: new Date().toISOString(),
    device: {
      serial: serial || connectedDevices[0].trim().split(/\s+/)[0],
      model: shell('getprop', 'ro.product.model'),
      androidVersion: shell('getprop', 'ro.build.version.release'),
      sdk: shell('getprop', 'ro.build.version.sdk'),
    },
    app: { packageName: PACKAGE_NAME, processId, uid },
    state: {
      wakefulness: powerDump.match(/mWakefulness=([^\s]+)/)?.[1] ?? 'unknown',
      currentFocus: windowDump.match(/mCurrentFocus=([^\n]+)/)?.[1]?.trim() ?? 'unknown',
    },
    checks,
    passed: Object.values(checks).every(Boolean),
  };
};

const evidence = [collect('foreground')];
if (backgroundSeconds > 0) {
  shell('input', 'keyevent', '3');
  await wait(backgroundSeconds);
  evidence.push(collect(`background_${backgroundSeconds}s`));
}
if (lockSeconds > 0) {
  shell('input', 'keyevent', '26');
  await wait(lockSeconds);
  evidence.push(collect(`screen_off_${lockSeconds}s`));
}

const result = {
  passed: evidence.every((item) => item.passed),
  evidence,
  limits: [
    'This proves system state only; it does not replace headphone listening.',
    'A 30/60/90/120 minute row passes only after its full elapsed run and checkpoint telemetry are verified.',
    'Call, notification, and headphone interruption recovery require their own physical-device actions.',
  ],
};

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
