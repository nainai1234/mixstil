import { readFileSync } from 'node:fs';
import { loadMobileReleaseConfig, validateMobileReleaseConfig } from './mobileReleaseConfig';

const requireDeployment = process.argv.includes('--require-deployment');
const requireIosSigning = process.argv.includes('--ios');
const requireAndroidSigning = process.argv.includes('--android');

if (requireDeployment) {
  const config = validateMobileReleaseConfig(loadMobileReleaseConfig(), { requireIosSigning, requireAndroidSigning });
  console.log(JSON.stringify({
    passed: true,
    apiOrigin: new URL(config.apiBaseUrl).origin,
    versionName: config.versionName,
    buildNumber: config.buildNumber,
    iosSigning: requireIosSigning ? 'configured' : 'not-required',
    androidSigning: requireAndroidSigning ? 'configured' : 'not-required',
  }, null, 2));
} else {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const envTemplate = readFileSync(new URL('../.env.mobile.example', import.meta.url), 'utf8');
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const iosProject = readFileSync(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
  const iosReleaseInfo = readFileSync(new URL('../ios/App/App/Info-Release.plist', import.meta.url), 'utf8');
  const releaseBuilder = readFileSync(new URL('./buildMobileRelease.ts', import.meta.url), 'utf8');
  const capacitorConfig = readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  const contracts: Array<[boolean, string]> = [
    [envTemplate.includes('VITE_API_BASE_URL=https://api.example.com'), 'Mobile environment template uses an explicit placeholder HTTPS origin'],
    [envTemplate.includes('SNOOZE_VERSION=') && envTemplate.includes('SNOOZE_BUILD_NUMBER='), 'Mobile environment template documents version inputs'],
    [envTemplate.includes('IOS_DEVELOPMENT_TEAM='), 'Mobile environment template documents Apple signing input'],
    [envTemplate.includes('ANDROID_KEYSTORE_PATH=') && envTemplate.includes('ANDROID_KEY_ALIAS='), 'Mobile environment template documents Android signing inputs'],
    [String(packageJson.scripts['mobile:sync']).includes('validate:mobile-release'), 'Store sync validates release configuration'],
    [String(packageJson.scripts['mobile:sync:android:local']).includes('CAPACITOR_LOCAL_DEV=1'), 'Local Android sync remains explicitly debug-only'],
    [capacitorConfig.includes('CapacitorHttp: {') && capacitorConfig.includes('enabled: true'), 'Native builds route API requests through the platform HTTP stack'],
    [packageJson.scripts['mobile:release:android'] === 'tsx server/buildMobileRelease.ts android', 'Android release uses the validated native builder'],
    [packageJson.scripts['mobile:release:ios'] === 'tsx server/buildMobileRelease.ts ios', 'iOS release uses the validated native builder'],
    [gradle.includes('SNOOZE_BUILD_NUMBER') && gradle.includes('SNOOZE_VERSION'), 'Android release metadata comes from validated environment'],
    [gradle.includes('ANDROID_KEYSTORE_PATH') && gradle.includes('signingConfig signingConfigs.release'), 'Android release signing uses external credentials'],
    [iosProject.includes('INFOPLIST_FILE = "App/Info-Release.plist";'), 'iOS Release uses a dedicated production Info.plist'],
    [!iosReleaseInfo.includes('NSAllowsLocalNetworking') && !iosReleaseInfo.includes('NSLocalNetworkUsageDescription'), 'iOS Release excludes local-network development permissions'],
    [releaseBuilder.includes("requireIosSigning: platform === 'ios'") && releaseBuilder.includes("requireAndroidSigning: platform === 'android'"), 'Native builder validates platform signing before build'],
    [releaseBuilder.includes('MARKETING_VERSION=${config.versionName}') && releaseBuilder.includes('CURRENT_PROJECT_VERSION=${config.buildNumber}'), 'iOS archive receives the validated version and build number'],
    [releaseBuilder.includes("['validate:ios-release-artifact']") && releaseBuilder.includes('Products/Applications/App.app'), 'iOS archive validates the final app artifact'],
    [releaseBuilder.includes("await run('./gradlew', ['bundleRelease']"), 'Android release produces an AAB'],
  ];
  const failures = contracts.filter(([passed]) => !passed).map(([, message]) => message);
  if (failures.length) throw new Error(`Mobile release mechanism validation failed:\n- ${failures.join('\n- ')}`);
  console.log(JSON.stringify({ passed: true, checks: contracts.map(([, message]) => message), deploymentConfiguration: 'not-asserted' }, null, 2));
}
