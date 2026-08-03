import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = read('src/App.tsx');
const nav = read('src/components/BottomNav.tsx');
const primarySurfaces = {
  home: read('src/pages/ConsumerHome.tsx'),
  explore: read('src/pages/DiscoverPage.tsx'),
  sounds: read('src/pages/StudioPage.tsx'),
  profile: read('src/pages/ProfilePage.tsx'),
  create: read('src/pages/AIHealPage.tsx'),
  player: read('src/pages/PlayerPage.tsx'),
};

const failures: string[] = [];
const requireText = (source: string, value: string, label: string) => {
  if (!source.includes(value)) failures.push(`${label} is missing ${JSON.stringify(value)}`);
};
const forbidText = (source: string, value: string, label: string) => {
  if (source.includes(value)) failures.push(`${label} still contains ${JSON.stringify(value)}`);
};

for (const route of ['listen', 'create', 'explore', 'sounds', 'profile', 'player']) {
  requireText(app, `path="${route}"`, 'App consumer routes');
}

for (const key of ['nav.home', 'nav.explore', 'nav.sounds', 'nav.profile']) {
  requireText(nav, `labelKey: '${key}'`, 'Primary navigation');
}
requireText(nav, 'useI18n', 'Primary navigation localization');
requireText(nav, "navigate('/create')", 'Primary Create action');
requireText(primarySurfaces.player, "t('player.saveToSounds')", 'Consumer player save action');
requireText(primarySurfaces.sounds, "t('sounds.search')", 'My Sounds search');
requireText(primarySurfaces.sounds, "t('sounds.filterGoal')", 'My Sounds goal filter');
requireText(primarySurfaces.sounds, "t('sounds.loadMore')", 'My Sounds pagination control');
requireText(primarySurfaces.explore, "t('explore.noMatch.title')", 'Explore empty search state');
requireText(primarySurfaces.explore, "t('explore.noMatch.action')", 'Explore empty search creation path');
requireText(primarySurfaces.explore, 'resultCount', 'Explore exact result count');
forbidText(primarySurfaces.player, "navigate('/creator/save'", 'Consumer player');

for (const [surface, source] of Object.entries(primarySurfaces)) {
  requireText(source, 'useI18n', `${surface} localization`);
}

const forbiddenPrimaryTerms = [
  'Creator Studio',
  'Creator workspace',
  'Pro Mixer',
  'AI Soundscape Co-Pilot',
  'Trending Today',
  "Editor's Choice",
  'Local Creator',
  'Free Plan',
  'Billing Details',
];

for (const [surface, source] of Object.entries({ nav, ...primarySurfaces })) {
  for (const term of forbiddenPrimaryTerms) forbidText(source, term, surface);
}

if (failures.length) {
  throw new Error(`Consumer route contract failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  canonicalRoutes: ['/listen', '/create', '/explore', '/sounds', '/profile', '/player'],
  primaryNavigation: ['Home', 'Explore', 'Create', 'My Sounds', 'Profile'],
  checkedSurfaces: ['BottomNav', 'ConsumerHome', 'DiscoverPage', 'StudioPage', 'ProfilePage', 'AIHealPage', 'PlayerPage'],
}, null, 2));
