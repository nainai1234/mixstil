import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type InfoPlist = {
  CFBundleIdentifier?: string;
  CFBundleShortVersionString?: string;
  CFBundleVersion?: string;
  NSAppTransportSecurity?: {
    NSAllowsLocalNetworking?: boolean;
  };
  NSLocalNetworkUsageDescription?: string;
  UIBackgroundModes?: string[];
};

type CapacitorConfig = {
  appId?: string;
  server?: {
    cleartext?: boolean;
    url?: string;
  };
};

const root = process.cwd();
const defaultAppPath = path.join(
  root,
  'ios/DerivedData/release-config-check/Build/Products/Release-iphonesimulator/App.app',
);
const appPath = path.resolve(process.env.IOS_APP_PATH || defaultAppPath);
const failures: string[] = [];
const checks: string[] = [];

const assert = (condition: boolean, message: string) => {
  if (condition) checks.push(message);
  else failures.push(message);
};

assert(fs.existsSync(appPath), 'iOS release app artifact exists');
if (fs.existsSync(appPath)) {
  const infoPath = path.join(appPath, 'Info.plist');
  const privacyPath = path.join(appPath, 'PrivacyInfo.xcprivacy');
  const capacitorPath = path.join(appPath, 'capacitor.config.json');

  assert(fs.existsSync(infoPath), 'Release artifact contains Info.plist');
  assert(fs.existsSync(privacyPath), 'Release artifact contains PrivacyInfo.xcprivacy');
  assert(fs.existsSync(capacitorPath), 'Release artifact contains capacitor.config.json');

  if (fs.existsSync(infoPath)) {
    const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', infoPath], { encoding: 'utf8' })) as InfoPlist;
    assert(info.CFBundleIdentifier === 'com.snooze.soundscapes', 'Release artifact uses the canonical bundle identifier');
    assert(Boolean(info.CFBundleShortVersionString), 'Release artifact contains a marketing version');
    assert(Boolean(info.CFBundleVersion), 'Release artifact contains a build number');
    assert(info.UIBackgroundModes?.includes('audio') === true, 'Release artifact enables background audio');
    assert(info.NSAppTransportSecurity?.NSAllowsLocalNetworking !== true, 'Release artifact does not allow local networking');
    assert(!info.NSLocalNetworkUsageDescription, 'Release artifact excludes local-network permission text');
  }

  if (fs.existsSync(capacitorPath)) {
    const capacitor = JSON.parse(fs.readFileSync(capacitorPath, 'utf8')) as CapacitorConfig;
    assert(capacitor.appId === 'com.snooze.soundscapes', 'Bundled Capacitor config uses the canonical app identifier');
    assert(capacitor.server?.cleartext !== true, 'Bundled Capacitor config disables cleartext traffic');
    if (capacitor.server?.url) {
      assert(new URL(capacitor.server.url).protocol === 'https:', 'Bundled remote service URL uses HTTPS');
    }
  }
}

if (failures.length) {
  throw new Error(`iOS release artifact validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  appPath: path.relative(root, appPath),
  checks,
}, null, 2));
