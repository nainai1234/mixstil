import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist-mobile');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  throw new Error('Mobile bundle validation requires a completed mobile Vite build.');
}

const files = fs.readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name));
const relativeFiles = files.map((file) => path.relative(dist, file));
const forbidden = relativeFiles.filter((file) => /^(audio|exports|review)(\/|$)/.test(file));
const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
const maximumBytes = 25 * 1024 * 1024;

if (forbidden.length > 0 || bytes > maximumBytes) {
  throw new Error(`Mobile bundle asset boundary failed:\n- ${[
    ...(forbidden.length ? [`forbidden packaged files: ${forbidden.slice(0, 10).join(', ')}`] : []),
    ...(bytes > maximumBytes ? [`bundle is ${(bytes / 1024 / 1024).toFixed(1)} MB; maximum is 25 MB`] : []),
  ].join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  bundleDirectory: path.relative(root, dist),
  fileCount: relativeFiles.length,
  bundleMegabytes: Number((bytes / 1024 / 1024).toFixed(2)),
  excludedRoots: ['audio', 'exports', 'review'],
}, null, 2));
