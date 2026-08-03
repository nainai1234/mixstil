import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const destinations = ['public', 'public-mobile'].map((directory) => path.join(root, directory, 'icons'));

await Promise.all(destinations.map(async (destination) => {
  await mkdir(destination, { recursive: true });
  await Promise.all([192, 512].map((size) => copyFile(
    path.join(root, 'icons', `icon-${size}.webp`),
    path.join(destination, `icon-${size}.png`),
  )));
}));

console.log('Synced app icons to public and public-mobile.');
