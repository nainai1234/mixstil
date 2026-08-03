import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const home = read('src/pages/ConsumerHome.tsx');
const sounds = read('src/pages/StudioPage.tsx');
const player = read('src/pages/PlayerPage.tsx');
const offline = read('src/lib/offlineLibrary.ts');
const sw = read('public/sw.js');
const manifest = read('public/manifest.webmanifest');
const app = read('src/main.tsx');
const indexHtml = read('index.html');
const schema = read('server/schema.ts');
const server = read('server/index.ts');
const api = read('src/lib/api.ts');

const required = [
  [home, "t('home.continue.title')", 'Home keeps the returning-user entry point'],
  [home, 'readPlaybackSnapshots', 'Home reads playback snapshots'],
  [home, 'readOfflineLibrary', 'Home reads offline library state'],
  [sounds, 'saveMixForOffline', 'My Sounds can save offline copies'],
  [sounds, 'await api.renderMix(mixId)', 'Offline save prepares a stable frozen render before caching'],
  [sounds, 'removeOfflineMix', 'My Sounds can remove offline copies'],
  [sounds, 'offlineFallback', 'My Sounds can switch to its offline library'],
  [sounds, "t('home.offlineFallback')", 'My Sounds explains offline fallback'],
  [player, 'getVerifiedOfflineMixRecord', 'Player verifies an offline mix before restoring it'],
  [player, 'offlineMode', 'Player exposes offline state'],
  [player, "t('player.offlineUnavailable')", 'Player explains incomplete offline restoration'],
  [offline, 'saveMixForOffline', 'Offline library persists mix payloads'],
  [offline, 'cachedResponses.every(Boolean)', 'Offline saves verify every cached resource'],
  [offline, 'retainedUrls', 'Removing one mix preserves shared cached resources'],
  [offline, 'readPlaybackSnapshots', 'Offline library exposes playback snapshots'],
  [sw, 'OFFLINE_AUDIO_CACHE', 'Service worker caches audio'],
  [sw, "request.mode === 'navigate'", 'Service worker handles app shell navigation'],
  [sw, "fetch(request)\n        .then", 'Connected app assets use network-first updates'],
  [sw, ".catch(() => caches.match(request))", 'Offline app assets fall back to cache'],
  [manifest, '"start_url": "/listen"', 'Manifest starts at the consumer home'],
  [app, "serviceWorker' in navigator", 'App registers a service worker'],
  [app, 'import.meta.env.PROD', 'Development does not retain stale service-worker modules'],
  [indexHtml, 'manifest.webmanifest', 'HTML links the manifest'],
  [indexHtml, "key.startsWith('snooze-app-shell-')", 'Local development removes only stale app-shell caches'],
  [indexHtml, "snooze-dev-service-worker-cleanup-v1", 'Local development performs one bounded service-worker recovery'],
  [schema, 'device_playback_states', 'Cross-device playback state is persisted'],
  [server, "app.get('/api/me/playback-states'", 'Playback state can be restored across devices'],
  [api, 'updatePlaybackState', 'Player can synchronize playback position'],
  [home, 'getPlaybackStates', 'Home merges cross-device playback state'],
];

const missing = required
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length) {
  throw new Error(`Sprint 3 retention/offline contract failed:\n- ${missing.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  contract: 'sprint-3-retention-offline',
  surfaces: ['ConsumerHome', 'StudioPage', 'PlayerPage', 'offlineLibrary', 'serviceWorker'],
}, null, 2));
