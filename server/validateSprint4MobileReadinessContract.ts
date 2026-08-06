import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const packageJson = read('package.json');
const capacitor = read('capacitor.config.ts');
const mobileBundleValidator = read('server/validateMobileBundleAssets.ts');
const api = read('src/lib/api.ts');
const audio = read('src/context/AudioContext.tsx');
const offline = read('src/lib/offlineLibrary.ts');
const mobileEnv = read('.env.mobile.example');
const app = read('src/App.tsx');
const profile = read('src/pages/ProfilePage.tsx');
const privacy = read('src/pages/PrivacyPage.tsx');
const support = read('src/pages/SupportPage.tsx');
const server = read('server/index.ts');
const iosInfo = read('ios/App/App/Info.plist');
const iosReleaseInfo = read('ios/App/App/Info-Release.plist');
const iosProject = read('ios/App/App.xcodeproj/project.pbxproj');
const androidManifest = read('android/app/src/main/AndroidManifest.xml');
const androidMediaService = read('android/app/src/main/java/com/mixstil/soundscapes/MediaPlaybackService.java');
const androidBuild = read('android/app/build.gradle');
const iosMediaPlugin = read('ios/App/App/NativeMediaSessionPlugin.swift');
const onboarding = read('src/pages/OnboardingPage.tsx');
const storeListing = read('docs/mobile-store-listing.md');

const required = [
  [packageJson, '@capacitor/core', 'Capacitor runtime is installed'],
  [packageJson, '@capacitor/ios', 'iOS platform is installed'],
  [packageJson, '@capacitor/android', 'Android platform is installed'],
  [packageJson, 'mobile:sync', 'A repeatable native sync command exists'],
  [packageJson, 'pnpm mobile:build && pnpm validate:mobile-bundle-assets && cap sync', 'Native sync validates the isolated mobile bundle'],
  [packageJson, 'mobile:assets', 'Native brand assets are reproducible'],
  [packageJson, 'mobile:build:android', 'Android debug build command exists'],
  [capacitor, "appId: 'com.mixstil.soundscapes'", 'A stable mobile application ID exists'],
  [capacitor, "webDir: 'dist-mobile'", 'Capacitor packages the isolated mobile build'],
  [mobileBundleValidator, "path.join(root, 'dist-mobile')", 'Mobile bundle validation checks the same isolated directory'],
  [api, 'VITE_API_BASE_URL', 'Native builds can target a deployed API'],
  [packageJson, 'mobile:sync:android:local', 'Android local-device builds have an explicit API-origin workflow'],
  [packageJson, 'VITE_API_BASE_URL=http://localhost:8788', 'Android local-device builds embed the ADB-reversed API origin'],
  [packageJson, 'CAPACITOR_LOCAL_DEV=1', 'Android local-device builds enable the cleartext debug origin'],
  [packageJson, 'vite build --mode mobile && BUNDLE_DIR=dist-mobile pnpm validate:frontend-bundle-split && pnpm validate:mobile-bundle-assets && CAPACITOR_LOCAL_DEV=1 cap sync android', 'Android local-device sync validates its mobile bundle'],
  [audio, 'resolveServiceUrl(url)', 'Audio tracks use the configured service origin'],
  [offline, 'resolveServiceUrl(url)', 'Offline resources use the configured service origin'],
  [mobileEnv, 'https://api.example.com', 'Mobile API configuration is documented'],
  [app, 'path="privacy"', 'Privacy disclosure has an in-app route'],
  [app, 'path="support"', 'Public support has an in-app route'],
  [privacy, 'Account deletion', 'Privacy disclosure explains account deletion'],
  [profile, "navigate('/support')", 'Profile links to public support'],
  [support, 'VITE_SUPPORT_EMAIL', 'Support contact is supplied by release configuration'],
  [support, 'Copy diagnostic details', 'Support includes privacy-safe diagnostic details'],
  [profile, 'Type DELETE to confirm', 'Account deletion requires explicit user confirmation'],
  [profile, 'clearLocalListeningData', 'Account deletion clears local listening data'],
  [server, "app.delete('/api/me'", 'Authenticated account deletion endpoint exists'],
  [server, "getAuthenticatedUser(req)", 'Account deletion requires an authenticated account'],
  [iosInfo, '<string>audio</string>', 'iOS declares the audio background mode'],
  [iosReleaseInfo, '<string>audio</string>', 'iOS Release declares the audio background mode'],
  [iosProject, 'INFOPLIST_FILE = "App/Info-Release.plist";', 'iOS Release uses its production Info.plist'],
  [iosReleaseInfo.includes('NSAllowsLocalNetworking') ? '' : 'release-network-hardened', 'release-network-hardened', 'iOS Release excludes local-network development permissions'],
  [iosProject, 'PRODUCT_BUNDLE_IDENTIFIER = com.mixstil.soundscapes;', 'iOS uses the canonical application ID'],
  [iosMediaPlugin, 'MPRemoteCommandCenter.shared()', 'iOS provides native lock-screen media controls'],
  [iosMediaPlugin, 'AVAudioSession.sharedInstance()', 'iOS activates a background playback audio session'],
  [androidManifest, 'android.permission.WAKE_LOCK', 'Android can keep an active listening session awake'],
  [androidManifest, 'android:foregroundServiceType="mediaPlayback"', 'Android declares a media playback foreground service'],
  [androidMediaService, 'new MediaSession(this, "MixStil playback")', 'Android provides a native system media session'],
  [androidMediaService, 'new ExoPlayer.Builder(this)', 'Android foreground service owns long-session playback'],
  [androidMediaService, '.setWakeMode(C.WAKE_MODE_LOCAL)', 'Android long-session playback holds a wake lock'],
  [androidBuild, 'androidx.media3:media3-exoplayer', 'Android includes the native playback engine'],
  [app, 'path="onboarding"', 'Consumer onboarding has a route'],
  [onboarding, 'Anything to avoid?', 'Onboarding captures explicit exclusions'],
  [onboarding, 'Default session', 'Onboarding captures a default duration'],
  [storeListing, '## Store Metadata', 'Store listing metadata is drafted'],
  [storeListing, '## Data Safety', 'Store privacy disclosures are mapped'],
];

const missing = required
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (!fs.existsSync(path.join(root, 'ios'))) missing.push('iOS native project exists');
if (!fs.existsSync(path.join(root, 'android'))) missing.push('Android native project exists');
if (!fs.existsSync(path.join(root, 'public/icons/icon-192.png'))) missing.push('PWA 192 px icon exists');
if (!fs.existsSync(path.join(root, 'public/icons/icon-512.png'))) missing.push('PWA 512 px icon exists');

if (missing.length) {
  throw new Error(`Sprint 4 mobile readiness contract failed:\n- ${missing.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  contract: 'sprint-4-mobile-readiness-implementation',
  releaseApproved: false,
  releaseVerdict: 'NO-GO',
  platforms: ['ios', 'android'],
  completedImplementation: [
    'Capacitor iOS and Android projects',
    'native media controls',
    'Android foreground Media3 playback service',
    'iOS background audio session',
    'privacy, support, and account deletion surfaces',
    'store-listing repository baseline',
  ],
  remainingReleaseGates: [
    'Android 30/90/120 physical-device playback rows',
    'Android complete-session audible-continuity confirmation',
    'Android headphone or Bluetooth-change recovery',
    'production HTTPS service origin',
    'store signing and release channels',
    'public support and privacy URLs',
    'native store screenshots and final submission assets',
    'production-like account creation, sign-in, and deletion checks',
    'offline playback on both platforms with API and network unavailable',
  ],
  fullReleaseGate: 'pnpm release:check',
}, null, 2));
