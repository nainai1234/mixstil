import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidManifest = readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const androidDebugManifest = readFileSync(path.join(root, 'android/app/src/debug/AndroidManifest.xml'), 'utf8');
const extractionRules = readFileSync(path.join(root, 'android/app/src/main/res/xml/data_extraction_rules.xml'), 'utf8');
const iosManifest = readFileSync(path.join(root, 'ios/App/App/PrivacyInfo.xcprivacy'), 'utf8');
const iosProject = readFileSync(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
const iosDebugInfo = readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');
const iosReleaseInfo = readFileSync(path.join(root, 'ios/App/App/Info-Release.plist'), 'utf8');
const privacyPage = readFileSync(path.join(root, 'src/pages/PrivacyPage.tsx'), 'utf8');
const baseline = readFileSync(path.join(root, 'docs/mobile-privacy-disclosure-baseline.md'), 'utf8');

const contracts: Array<[boolean, string]> = [
  [androidManifest.includes('android:allowBackup="false"'), 'Android cloud backup is disabled'],
  [androidManifest.includes('android:fullBackupContent="false"'), 'Legacy Android full backup is disabled'],
  [androidManifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"'), 'Android data extraction rules are attached'],
  [androidManifest.includes('android:usesCleartextTraffic="false"'), 'Android release manifest blocks cleartext traffic'],
  [androidDebugManifest.includes('android:usesCleartextTraffic="true"'), 'Android debug manifest preserves local-device HTTP QA'],
  [['root', 'file', 'database', 'sharedpref', 'external'].every((domain) => extractionRules.includes(`domain="${domain}"`)), 'Android backup excludes local personal-data domains'],
  [iosManifest.includes('<key>NSPrivacyTracking</key>\n    <false/>'), 'iOS manifest declares no tracking'],
  [iosManifest.includes('NSPrivacyCollectedDataTypeEmailAddress'), 'iOS manifest declares account contact data'],
  [iosManifest.includes('NSPrivacyCollectedDataTypeOtherUserContent'), 'iOS manifest declares sound-request user content'],
  [iosManifest.includes('NSPrivacyCollectedDataTypeProductInteraction'), 'iOS manifest declares playback product interaction'],
  [iosProject.includes('PrivacyInfo.xcprivacy in Resources'), 'iOS target packages the app privacy manifest'],
  [iosProject.includes('INFOPLIST_FILE = "App/Info-Release.plist";'), 'iOS Release uses a dedicated production Info.plist'],
  [iosDebugInfo.includes('NSAllowsLocalNetworking') && iosDebugInfo.includes('NSLocalNetworkUsageDescription'), 'iOS Debug preserves local-device QA networking'],
  [!iosReleaseInfo.includes('NSAllowsLocalNetworking') && !iosReleaseInfo.includes('NSLocalNetworkUsageDescription'), 'iOS Release excludes local-network development permissions'],
  [iosReleaseInfo.includes('<string>audio</string>'), 'iOS Release keeps background audio enabled'],
  [privacyPage.includes('MixStil does not sell personal information'), 'In-app privacy page states the no-sale boundary'],
  [baseline.includes('Apple App Privacy Baseline') && baseline.includes('Google Play Data Safety Baseline'), 'Store disclosure baselines exist'],
  [baseline.includes('privacy_data_safety_forms') && baseline.includes('stays pending'), 'Store disclosure evidence remains honestly pending'],
];

const failures = contracts.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) throw new Error(`Native privacy contract failed:\n- ${failures.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  checks: contracts.map(([, message]) => message),
  releaseBoundary: 'voice-free-beta',
  storeForms: 'pending-production-provider-reconciliation',
}, null, 2));
