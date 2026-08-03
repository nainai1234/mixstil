import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const importDir = path.resolve(process.argv[2] ?? path.join(root, 'imports/reference-youtube'));
const concurrency = Math.max(1, Number(process.env.REFERENCE_ANALYSIS_JOBS ?? 3));
const extensions = ['mp3', 'm4a', 'wav', 'flac', 'webm', 'opus', 'ogg'];
const shortlist = JSON.parse(fs.readFileSync(path.join(root, 'config/reference-music-shortlist-v1.json'), 'utf8'));
const analysis = JSON.parse(fs.readFileSync(path.join(root, 'config/reference-audio-analysis-v1.json'), 'utf8'));
const completed = new Set(analysis.records.map((record) => record.referenceId));
const pending = shortlist.references.filter((reference) => !completed.has(reference.id));
const outputDir = '/tmp/snooze-reference-analysis';
fs.mkdirSync(importDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

const findInput = (id) => extensions.map((extension) => path.join(importDir, `${id}.${extension}`)).find(fs.existsSync);
const jobs = pending.map((reference) => ({ reference, input: findInput(reference.id) }));
const available = jobs.filter((job) => job.input);
const missing = jobs.filter((job) => !job.input).map((job) => job.reference.id);

const run = (job) => new Promise((resolve, reject) => {
  const { reference, input } = job;
  const args = [
    'run', '--with', 'librosa', '--with', 'numpy', '--with', 'scipy', '--with', 'soundfile',
    'scripts/analyze-reference-audio.py', input,
    '--reference-id', reference.id,
    '--title', reference.title,
    '--creator', reference.creator,
    '--source-url', reference.sourceUrl,
    '--analysis-source-url', reference.sourceUrl,
    '--first30-method', 'direct_source',
    '--first30-title', reference.title,
    '--first30-creator', reference.creator,
    '--output', path.join(outputDir, `${reference.id}-analysis.json`),
  ];
  const child = spawn('uv', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve(reference.id) : reject(new Error(`${reference.id} failed (${code}): ${stderr.slice(-1200)}`)));
});

let cursor = 0;
const succeeded = [];
const failed = [];
const worker = async () => {
  while (cursor < available.length) {
    const job = available[cursor++];
    try {
      succeeded.push(await run(job));
    } catch (error) {
      failed.push({ id: job.reference.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
};
await Promise.all(Array.from({ length: Math.min(concurrency, available.length) }, worker));

console.log(JSON.stringify({ importDir, concurrency, analyzed: succeeded, failed, missing }, null, 2));
if (failed.length) process.exitCode = 1;
