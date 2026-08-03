#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const SEARCH_MANIFEST = join(ROOT, 'docs/asset-batch-05-open-audio-searches.tsv');
const OUTPUT_DIR = join(ROOT, 'public/audio/candidates/batch-05/open-audio');
const CANDIDATE_TSV = join(ROOT, 'docs/asset-batch-05-open-audio-candidates.tsv');
const REPORT_MD = join(ROOT, 'reports/batch-05-open-audio-download-report.md');

const MAX_DOWNLOADS = Number(process.env.BATCH05_MAX_DOWNLOADS ?? 12);
const MAX_BYTES = Number(process.env.BATCH05_MAX_BYTES ?? 40 * 1024 * 1024);
const USER_AGENT = 'SNOOZE sleep-audio candidate discovery/0.1 (local review; https://commons.wikimedia.org/)';
const CURL_TIMEOUT_SECONDS = String(Number(process.env.BATCH05_CURL_TIMEOUT_SECONDS ?? 45));
const COMMONS_PUBLIC_DOMAIN_URL = 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/General_public_domain';

const allowedLicense = (license = '') => {
  const normalized = license.toLowerCase();
  return normalized.includes('public domain') || normalized.includes('cc0');
};

const allowedMime = (mime = '') => mime.startsWith('audio/') || mime === 'application/ogg';

const blockedTitle = (title = '') => {
  const normalized = title.toLowerCase();
  return [
    'song', 'anthem', 'speech', 'interview', 'lecture', 'podcast', 'radio',
    'hymn', 'orchestra', 'choir', 'voice', 'spoken', 'vocal', 'lyrics',
    'performed by', 'recorded by', 'go back to', 'laughter', 'laugh',
    'taco', 'church', 'school', 'classroom', 'crowd', 'people', 'children',
    'child', 'man', 'woman', 'applause', 'audience', 'conversation',
  ].some((term) => normalized.includes(term));
};

const titleMatchesScene = (title = '', sceneFamily = '') => {
  const normalized = title.toLowerCase();
  const family = sceneFamily.toLowerCase();
  const keywords = {
    bowl: ['bowl', 'singingbowl', 'singing bowl', 'tibetan'],
    bell: ['bell', 'chime', 'handbell', 'tubebell', 'gong'],
    forest: ['forest', 'wood', 'bird', 'blackbird', 'nightingale', 'turdus', 'luscinia'],
    nature: ['nature', 'forest', 'rain', 'water', 'ocean', 'river', 'bird'],
  }[family] ?? [family];
  return keywords.some((keyword) => normalized.includes(keyword));
};

const slugify = (input) => input
  .toLowerCase()
  .replace(/^file:/, '')
  .replace(/\.[a-z0-9]+$/i, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 80);

const parseTsv = (content) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const curl = async (args) => {
  const { stdout } = await execFileAsync('curl', [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--retry', '3',
    '--retry-delay', '1',
    '--connect-timeout', '12',
    '--max-time', CURL_TIMEOUT_SECONDS,
    '--user-agent', USER_AGENT,
    ...args,
  ], { maxBuffer: 50 * 1024 * 1024 });
  return stdout;
};

const commonsSearch = async (query, limit = 12) => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: String(limit),
    gsrsearch: query,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    origin: '*',
  });
  const stdout = await curl([`https://commons.wikimedia.org/w/api.php?${params}`]);
  const data = JSON.parse(stdout);
  return Object.values(data.query?.pages ?? {});
};

const headSize = async (url) => {
  const stdout = await curl(['--head', url]);
  const match = stdout.match(/content-length:\s*(\d+)/i);
  return Number(match?.[1] ?? 0);
};

const downloadFile = async (url, outputPath) => {
  await curl(['--output', outputPath, url]);
};

const sha256File = async (path) => {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
};

const ffprobe = async (path) => {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_name,codec_type,sample_rate,channels',
    '-of', 'json',
    path,
  ]);
  const parsed = JSON.parse(stdout);
  const audio = (parsed.streams ?? []).find((stream) => stream.codec_type === 'audio') ?? {};
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    codec: audio.codec_name ?? '',
    sampleRate: audio.sample_rate ?? '',
    channels: audio.channels ?? '',
  };
};

const candidatePath = (title, url, index) => {
  const originalExt = extname(new URL(url).pathname) || extname(title) || '.audio';
  return join(OUTPUT_DIR, `${String(index).padStart(2, '0')}_${slugify(title)}${originalExt}`);
};

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(join(ROOT, 'reports'), { recursive: true });

  const rows = parseTsv(await readFile(SEARCH_MANIFEST, 'utf8'));
  const commonsRows = rows
    .filter((row) => row.source_platform === 'Wikimedia Commons')
    .filter((row) => row.license_filter === 'public-domain');

  const accepted = [];
  const rejected = [];
  const seenUrls = new Set();

  for (const job of commonsRows) {
    if (accepted.length >= MAX_DOWNLOADS) break;
    let pages = [];
    try {
      pages = await commonsSearch(job.query, 16);
    } catch (error) {
      rejected.push({ searchId: job.search_id, title: job.query, reason: `search failed: ${error.message}` });
      continue;
    }
    for (const page of pages) {
      if (accepted.length >= MAX_DOWNLOADS) break;
      const image = page.imageinfo?.[0];
      const meta = image?.extmetadata ?? {};
      const title = page.title ?? '';
      const licenseName = meta.LicenseShortName?.value ?? meta.UsageTerms?.value ?? '';
      const sourceUrl = `https://commons.wikimedia.org/wiki/${title.replaceAll(' ', '_')}`;
      const url = image?.url ?? '';
      const reject = (reason) => rejected.push({ searchId: job.search_id, title, reason });

      if (!url || seenUrls.has(url)) { reject('missing or duplicate url'); continue; }
      if (!allowedMime(image.mime)) { reject(`blocked mime ${image.mime ?? 'unknown'}`); continue; }
      if (!allowedLicense(licenseName)) { reject(`blocked license ${licenseName || 'unknown'}`); continue; }
      if (blockedTitle(title)) { reject('title suggests song, speech, or vocals'); continue; }
      if (!titleMatchesScene(title, job.scene_family)) { reject(`title does not match scene family ${job.scene_family}`); continue; }

      let size = Number(image.size ?? 0);
      try {
        if (!size) size = await headSize(url);
      } catch (error) {
        reject(`size check failed: ${error.message}`);
        continue;
      }
      if (size > MAX_BYTES) { reject(`too large ${size}`); continue; }

      const outputPath = candidatePath(title, url, accepted.length + 1);
      try {
        await downloadFile(url, outputPath);
        const probe = await ffprobe(outputPath);
        const minDuration = job.category === 'Accent' ? 0.2 : 3;
        const maxDuration = job.category === 'Accent' ? 120 : 1800;
        if (!probe.durationSeconds || probe.durationSeconds < minDuration) {
          reject(`duration too short ${probe.durationSeconds}`);
          continue;
        }
        if (probe.durationSeconds > maxDuration) {
          reject(`duration too long ${probe.durationSeconds}`);
          continue;
        }
        seenUrls.add(url);
        accepted.push({
          batch_id: 'batch-05',
          candidate_id: `b05_commons_${String(accepted.length + 1).padStart(3, '0')}`,
          search_id: job.search_id,
          source_platform: 'Wikimedia Commons',
          source_title: title,
          source_url: sourceUrl,
          download_url: url,
          local_path: outputPath.replace(`${ROOT}/`, ''),
          source_creator: meta.Artist?.value?.replace(/<[^>]*>/g, '').trim() || '',
          license_name: licenseName,
          license_url: meta.LicenseUrl?.value ?? (licenseName.toLowerCase().includes('public domain') ? COMMONS_PUBLIC_DOMAIN_URL : ''),
          category: job.category,
          scene_family: job.scene_family,
          recommended_scene: job.recommended_scene,
          commercial_use_allowed: 'true',
          derivative_use_allowed: 'true',
          attribution_required: 'false',
          raw_redistribution_allowed: 'true',
          file_sha256: await sha256File(outputPath),
          file_size_bytes: String(size),
          duration_seconds: probe.durationSeconds.toFixed(2),
          codec: probe.codec,
          sample_rate: String(probe.sampleRate),
          channels: String(probe.channels),
          qa_status: 'candidate',
          qa_notes: 'Downloaded for candidate review only. Needs source snapshot, license snapshot, loudness/transient QA, and human listening before any seed or route.',
        });
      } catch (error) {
        reject(`download/probe failed: ${error.message}`);
      }
    }
  }

  const tsvHeaders = [
    'batch_id', 'candidate_id', 'search_id', 'source_platform', 'source_title',
    'source_url', 'download_url', 'local_path', 'source_creator', 'license_name',
    'license_url', 'category', 'scene_family', 'recommended_scene',
    'commercial_use_allowed', 'derivative_use_allowed', 'attribution_required',
    'raw_redistribution_allowed', 'file_sha256', 'file_size_bytes',
    'duration_seconds', 'codec', 'sample_rate', 'channels', 'qa_status', 'qa_notes',
  ];
  const escapeTsv = (value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ');
  const tsv = [
    tsvHeaders.join('\t'),
    ...accepted.map((row) => tsvHeaders.map((header) => escapeTsv(row[header])).join('\t')),
  ].join('\n');
  await writeFile(CANDIDATE_TSV, `${tsv}\n`, 'utf8');

  const report = [
    '# Batch 05 Open Audio Download Report',
    '',
    `Date: ${new Date().toISOString()}`,
    `Status: candidate downloads only; nothing is approved or seeded.`,
    '',
    `Accepted candidates: ${accepted.length}`,
    `Rejected search results: ${rejected.length}`,
    '',
    '## Accepted',
    '',
    '| Candidate | Category | Family | Duration | License | Local file |',
    '|---|---|---|---:|---|---|',
    ...accepted.map((row) => `| ${row.candidate_id} ${row.source_title} | ${row.category} | ${row.scene_family} | ${row.duration_seconds}s | ${row.license_name} | ${row.local_path} |`),
    '',
    '## Rejection Summary',
    '',
    ...Object.entries(rejected.reduce((counts, item) => {
      counts[item.reason] = (counts[item.reason] ?? 0) + 1;
      return counts;
    }, {})).map(([reason, count]) => `- ${reason}: ${count}`),
    '',
    '## Required Before Seed',
    '',
    '- Source and license snapshots.',
    '- Loudness, clipping, silence, and sudden-transient QA.',
    '- Human listening QA with safe scene routing.',
    '- Manual check that Public domain or CC0 metadata is valid on the source page.',
  ].join('\n');
  await writeFile(REPORT_MD, `${report}\n`, 'utf8');

  console.log(`accepted=${accepted.length}`);
  console.log(`candidates=${CANDIDATE_TSV}`);
  console.log(`report=${REPORT_MD}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
