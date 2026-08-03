import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repo = 'ace-step/ACE-Step';
const ref = process.env.ACE_STEP_REF || 'main';
const destination = path.resolve(process.env.ACE_STEP_DIR || '.local-models/ACE-Step');
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'snooze-content-factory' };

const githubJson = async (url) => {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}): ${url}`);
  return response.json();
};

const commit = await githubJson(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`);
const tree = await githubJson(`https://api.github.com/repos/${repo}/git/trees/${commit.sha}?recursive=1`);
if (tree.truncated) throw new Error('GitHub returned a truncated ACE-Step tree.');

const rootFiles = new Set(['LICENSE', 'README.md', 'requirements.txt', 'setup.py']);
const files = tree.tree.filter((entry) => entry.type === 'blob' && (
  entry.path.startsWith('acestep/') || entry.path.startsWith('config/') || rootFiles.has(entry.path)
));

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const [index, entry] of files.entries()) {
  const blob = await githubJson(entry.url);
  const target = path.join(destination, entry.path);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(blob.content.replace(/\n/g, ''), 'base64'));
  process.stdout.write(`\rACE-Step source ${index + 1}/${files.length}`);
}

await writeFile(path.join(destination, '.source.json'), `${JSON.stringify({
  repository: `https://github.com/${repo}`,
  ref,
  commit: commit.sha,
  fetchedAt: new Date().toISOString(),
  license: 'Apache-2.0',
  files: files.length,
}, null, 2)}\n`);

process.stdout.write(`\nInstalled ACE-Step source at ${destination}\n`);
