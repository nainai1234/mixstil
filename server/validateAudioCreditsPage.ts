import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = read('src/App.tsx');
const profile = read('src/pages/ProfilePage.tsx');
const page = read('src/pages/AudioCreditsPage.tsx');
const publicCredits = JSON.parse(read('public/content/voice-free-beta-attribution-credits.json'));

const failures: string[] = [];
const requireText = (source: string, value: string, label: string) => {
  if (!source.includes(value)) failures.push(`${label} is missing ${JSON.stringify(value)}`);
};

requireText(app, "const AudioCreditsPage = lazy(() => import('./pages/AudioCreditsPage'))", 'App route lazy import');
requireText(app, 'path="audio-credits"', 'Audio credits route');
requireText(profile, "navigate('/audio-credits')", 'Profile audio credits entry');
requireText(profile, 'Audio credits', 'Profile audio credits label');
requireText(page, '/content/voice-free-beta-attribution-credits.json', 'Audio credits page bundled data fetch');
requireText(page, 'Voice-free Beta source material and licenses', 'Audio credits page subtitle');
requireText(page, 'Voice and TTS remain outside this Beta', 'Audio credits page Voice-free boundary');
requireText(page, 'adaptationNotice', 'Audio credits page adaptation notice');

if (publicCredits.status !== 'pass' || publicCredits.creditCount !== 8 || publicCredits.credits.length !== 8) {
  failures.push('Bundled public credits artifact must contain 8 passing credits.');
}
if (!publicCredits.credits.every((credit: any) => credit.sourceUrl && credit.licenseUrl && credit.adaptationNotice)) {
  failures.push('Every bundled credit must include source, license, and adaptation notice.');
}

if (failures.length) {
  throw new Error(`Audio credits page validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  route: '/audio-credits',
  profileEntry: true,
  bundledCredits: publicCredits.creditCount,
  releaseChannel: publicCredits.releaseChannel,
}, null, 2));
