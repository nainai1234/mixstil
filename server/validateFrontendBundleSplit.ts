import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const bundleDirectory = String(process.env.BUNDLE_DIR ?? 'dist');
const assetsDirectory = path.join(root, bundleDirectory, 'assets');
const maximumEntryBytes = 300_000;

if (!fs.existsSync(path.join(root, bundleDirectory, 'index.html')) || !fs.existsSync(assetsDirectory)) {
  throw new Error(`Frontend bundle validation requires a completed build in ${bundleDirectory}.`);
}

const javascriptFiles = fs.readdirSync(assetsDirectory)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, bytes: fs.statSync(path.join(assetsDirectory, file)).size }));
const entryChunks = javascriptFiles.filter(({ file }) => /^index-[\w-]+\.js$/.test(file));
const routeChunkPrefixes = ['ConsumerHome-', 'AIHealPage-', 'DiscoverPage-', 'StudioPage-', 'ProfilePage-', 'PlayerPage-'];
const missingRouteChunks = routeChunkPrefixes.filter((prefix) => !javascriptFiles.some(({ file }) => file.startsWith(prefix)));
const oversizedEntries = entryChunks.filter(({ bytes }) => bytes > maximumEntryBytes);

if (entryChunks.length !== 1 || missingRouteChunks.length || oversizedEntries.length) {
  throw new Error(`Frontend bundle split validation failed:\n- ${[
    ...(entryChunks.length !== 1 ? [`expected one entry chunk, found ${entryChunks.length}`] : []),
    ...(missingRouteChunks.length ? [`missing route chunks: ${missingRouteChunks.join(', ')}`] : []),
    ...(oversizedEntries.length ? [`entry chunk exceeds ${maximumEntryBytes} bytes: ${oversizedEntries.map(({ file, bytes }) => `${file} (${bytes})`).join(', ')}`] : []),
  ].join('\n- ')}`);
}

const entry = entryChunks[0];
console.log(JSON.stringify({
  passed: true,
  bundleDirectory,
  entryChunk: entry.file,
  entryBytes: entry.bytes,
  maximumEntryBytes,
  javascriptChunkCount: javascriptFiles.length,
  verifiedRouteChunks: routeChunkPrefixes.map((prefix) => prefix.slice(0, -1)),
}, null, 2));
