import { spawn } from 'node:child_process';
import path from 'node:path';
import { loadMobileReleaseConfig, validateMobileReleaseConfig } from './mobileReleaseConfig';

const root = process.cwd();
const platform = process.argv[2];
if (platform !== 'ios' && platform !== 'android') {
  throw new Error('Usage: tsx server/buildMobileRelease.ts <ios|android>');
}

const config = validateMobileReleaseConfig(loadMobileReleaseConfig(root), {
  requireIosSigning: platform === 'ios',
  requireAndroidSigning: platform === 'android',
});
const releaseEnv = {
  ...process.env,
  VITE_API_BASE_URL: config.apiBaseUrl,
  SNOOZE_VERSION: config.versionName,
  SNOOZE_BUILD_NUMBER: String(config.buildNumber),
  IOS_DEVELOPMENT_TEAM: config.iosDevelopmentTeam,
  ANDROID_KEYSTORE_PATH: path.resolve(config.androidKeystorePath || root),
  ANDROID_KEYSTORE_PASSWORD: config.androidKeystorePassword,
  ANDROID_KEY_ALIAS: config.androidKeyAlias,
  ANDROID_KEY_PASSWORD: config.androidKeyPassword,
};

const run = (
  command: string,
  args: string[],
  cwd = root,
  extraEnv: NodeJS.ProcessEnv = {},
) => new Promise<void>((resolve, reject) => {
  const child = spawn(command, args, { cwd, env: { ...releaseEnv, ...extraEnv }, stdio: 'inherit' });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with status ${code ?? 'unknown'}.`)));
});

await run('pnpm', ['mobile:sync']);

if (platform === 'android') {
  await run('./gradlew', ['bundleRelease'], path.join(root, 'android'));
  console.log(JSON.stringify({
    passed: true,
    platform,
    artifact: 'android/app/build/outputs/bundle/release/app-release.aab',
    versionName: config.versionName,
    buildNumber: config.buildNumber,
  }, null, 2));
} else {
  const archivePath = path.join(root, 'artifacts', `MixStil-${config.versionName}-${config.buildNumber}.xcarchive`);
  await run('xcodebuild', [
    '-project', 'ios/App/App.xcodeproj',
    '-scheme', 'App',
    '-configuration', 'Release',
    '-destination', 'generic/platform=iOS',
    '-archivePath', archivePath,
    `DEVELOPMENT_TEAM=${config.iosDevelopmentTeam}`,
    `MARKETING_VERSION=${config.versionName}`,
    `CURRENT_PROJECT_VERSION=${config.buildNumber}`,
    'archive',
  ]);
  await run('pnpm', ['validate:ios-release-artifact'], root, {
    IOS_APP_PATH: path.join(archivePath, 'Products/Applications/App.app'),
  });
  console.log(JSON.stringify({
    passed: true,
    platform,
    artifact: path.relative(root, archivePath),
    versionName: config.versionName,
    buildNumber: config.buildNumber,
  }, null, 2));
}
