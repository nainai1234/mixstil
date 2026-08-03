import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';

type StemRow = {
  id: string;
  name: string;
  category: string;
  audio_url: string;
  qa_status: string;
  file_sha256: string;
  commercial_use_allowed: boolean;
  derivative_use_allowed: boolean;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioRoot = path.join(projectRoot, 'public', 'audio');
const reportRoot = path.join(projectRoot, 'reports');

const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(fullPath) : [fullPath];
});

const inspectAudio = (filePath: string) => {
  const raw = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels,codec_name:format=duration',
    '-of', 'json', filePath,
  ], { encoding: 'utf8' });
  const payload = JSON.parse(raw);
  return {
    durationSeconds: Number(payload.format?.duration ?? 0),
    sampleRate: Number(payload.streams?.[0]?.sample_rate ?? 0),
    channels: Number(payload.streams?.[0]?.channels ?? 0),
    codec: String(payload.streams?.[0]?.codec_name ?? ''),
  };
};

const run = async () => {
  const files = walk(audioRoot).filter((filePath) => /\.(mp3|wav|ogg|oga)$/i.test(filePath));
  const stemResult = await query<StemRow>('select * from audio_stems order by id');
  const stemsByUrl = new Map(stemResult.rows.map((stem) => [stem.audio_url, stem]));

  const fileRows = files.map((filePath) => {
    const audioUrl = `/${path.relative(path.join(projectRoot, 'public'), filePath).split(path.sep).join('/')}`;
    const bytes = readFileSync(filePath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const stem = stemsByUrl.get(audioUrl);
    return {
      audioUrl,
      bytes: bytes.length,
      sha256,
      ...inspectAudio(filePath),
      stemId: stem?.id ?? null,
      qaStatus: stem?.qa_status ?? null,
      hashMatchesDatabase: stem ? stem.file_sha256 === sha256 : null,
    };
  });

  const fileUrls = new Set(fileRows.map((file) => file.audioUrl));
  const databaseFilesMissing = stemResult.rows.filter((stem) => stem.audio_url.startsWith('/audio/') && !fileUrls.has(stem.audio_url));
  const unregisteredFiles = fileRows.filter((file) => !file.stemId);
  const stemsWithVerifiableHashes = new Set(stemResult.rows
    .filter((stem) => /^[a-f0-9]{64}$/i.test(stem.file_sha256))
    .map((stem) => stem.id));
  const stemById = new Map(stemResult.rows.map((stem) => [stem.id, stem]));
  const allHashMismatches = fileRows.filter((file) => file.hashMatchesDatabase === false && file.stemId && stemsWithVerifiableHashes.has(file.stemId));
  const hashMismatches = allHashMismatches.filter((file) => file.stemId && stemById.get(file.stemId)?.qa_status !== 'rejected');
  const rejectedHashMismatches = allHashMismatches.filter((file) => file.stemId && stemById.get(file.stemId)?.qa_status === 'rejected');
  const unverifiableHashes = stemResult.rows.filter((stem) => !/^[a-f0-9]{64}$/i.test(stem.file_sha256));
  const approvedFilesMissing = databaseFilesMissing.filter((stem) => stem.qa_status === 'approved');
  const approvalCounts = Object.entries(stemResult.rows.reduce<Record<string, number>>((counts, stem) => {
    const key = `${stem.category}/${stem.qa_status}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {})).sort(([a], [b]) => a.localeCompare(b));

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      audioFiles: fileRows.length,
      databaseStems: stemResult.rows.length,
      unregisteredFiles: unregisteredFiles.length,
      databaseFilesMissing: databaseFilesMissing.length,
      approvedFilesMissing: approvedFilesMissing.length,
      hashMismatches: hashMismatches.length,
      rejectedHashMismatches: rejectedHashMismatches.length,
      unverifiableHashes: unverifiableHashes.length,
    },
    approvalCounts: Object.fromEntries(approvalCounts),
    unregisteredFiles: unregisteredFiles.map((file) => file.audioUrl),
    databaseFilesMissing: databaseFilesMissing.map((stem) => ({ id: stem.id, audioUrl: stem.audio_url })),
    hashMismatches: hashMismatches.map((file) => ({ stemId: file.stemId, audioUrl: file.audioUrl })),
    rejectedHashMismatches: rejectedHashMismatches.map((file) => ({ stemId: file.stemId, audioUrl: file.audioUrl })),
    unverifiableHashes: unverifiableHashes.map((stem) => ({ id: stem.id, fileSha256: stem.file_sha256, qaStatus: stem.qa_status })),
    files: fileRows,
  };

  mkdirSync(reportRoot, { recursive: true });
  writeFileSync(path.join(reportRoot, 'asset-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    '# Asset Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Audio files: ${report.totals.audioFiles}`,
    `- Database stems: ${report.totals.databaseStems}`,
    `- Unregistered files: ${report.totals.unregisteredFiles}`,
    `- Missing database files: ${report.totals.databaseFilesMissing}`,
    `- Missing approved files: ${report.totals.approvedFilesMissing}`,
    `- Hash mismatches: ${report.totals.hashMismatches}`,
    `- Rejected legacy hash mismatches: ${report.totals.rejectedHashMismatches}`,
    `- Unverifiable legacy hashes: ${report.totals.unverifiableHashes}`,
    '',
    '## Approval Counts',
    '',
    ...approvalCounts.map(([key, count]) => `- ${key}: ${count}`),
    '',
    '## Unregistered Files',
    '',
    ...(unregisteredFiles.length ? unregisteredFiles.map((file) => `- ${file.audioUrl}`) : ['- None']),
    '',
    '## Missing Database Files',
    '',
    ...(databaseFilesMissing.length ? databaseFilesMissing.map((stem) => `- ${stem.id}: ${stem.audio_url}`) : ['- None']),
    '',
    '## Hash Mismatches',
    '',
    ...(hashMismatches.length ? hashMismatches.map((file) => `- ${file.stemId}: ${file.audioUrl}`) : ['- None']),
    '',
    '## Unverifiable Legacy Hashes',
    '',
    ...(unverifiableHashes.length ? unverifiableHashes.map((stem) => `- ${stem.id}: ${stem.file_sha256} (${stem.qa_status})`) : ['- None']),
    '',
  ].join('\n');
  writeFileSync(path.join(reportRoot, 'asset-audit.md'), markdown);

  console.log(JSON.stringify(report.totals));
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
