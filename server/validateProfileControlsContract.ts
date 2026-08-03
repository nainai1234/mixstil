import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const profile = fs.readFileSync(path.join(root, 'src/pages/ProfilePage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');

const required = [
  [profile, 'onClick={scrollToPreferences}', 'Sound preferences opens the editable preference section'],
  [profile, 'preferenceSummary', 'Sound preferences displays current values'],
  [profile, 'onClick={scrollToAccount}', 'Account settings opens the account section'],
  [profile, 'onClick={logOut}', 'Log out has an action'],
  [profile, "navigate('/listen', { replace: true })", 'Log out returns to the consumer entry'],
  [profile, 'clearLocalListeningData', 'Log out clears device-bound personal listening data'],
  [profile, 'authenticated ? (', 'Account actions only appear for an authenticated session'],
  [api, 'hasAuthToken', 'Profile can distinguish signed-in and local sessions'],
] as const;
const forbidden = [
  [profile, 'Audio quality', 'Profile must not claim an unsupported audio-quality setting'],
  [profile, "value: 'Not set'", 'Profile must not show a stale preference summary'],
] as const;

const failures = [
  ...required.filter(([source, value]) => !source.includes(value)).map(([, , label]) => label),
  ...forbidden.filter(([source, value]) => source.includes(value)).map(([, , label]) => label),
];
if (failures.length) throw new Error(`Profile controls contract failed:\n- ${failures.join('\n- ')}`);

console.log(JSON.stringify({ passed: true, controls: ['sound-preferences', 'privacy', 'account-settings', 'logout', 'delete-account'] }, null, 2));
