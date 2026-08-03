#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const INPUT_TSV = 'docs/no-human-audio-candidate-pool.tsv';
const OUTPUT_TSV = 'docs/no-human-audio-candidate-machine-qa.tsv';
const REPORT_MD = 'reports/no-human-audio-candidate-machine-qa.md';

const parseTsv = (content) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
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
    channels: Number(audio.channels ?? 0),
  };
};

const volumeDetect = async (path) => {
  const { stderr } = await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i', path,
    '-af', 'volumedetect',
    '-f', 'null',
    '-',
  ], { maxBuffer: 10 * 1024 * 1024 });
  const mean = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  const max = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  return {
    meanVolumeDb: mean ? Number(mean[1]) : null,
    maxVolumeDb: max ? Number(max[1]) : null,
  };
};

const humanVoicePolicy = 'Manual listening must confirm no speech, singing, laughter, crowd noise, children, applause, or conversation.';

const classify = (row, probe, volume, hashMatches) => {
  const warnings = [];
  const failures = [];

  if (!hashMatches) failures.push('sha256 mismatch');
  if (!probe.durationSeconds || probe.durationSeconds <= 0) failures.push('decode duration missing');
  if (!probe.codec) failures.push('audio codec missing');
  if (!probe.sampleRate) warnings.push('sample rate missing');
  if (probe.channels < 1) failures.push('channel count missing');

  if (row.category === 'Nature' && probe.durationSeconds < 20) warnings.push('nature bed is short; loop fatigue QA required');
  if (row.category === 'Nature' && probe.durationSeconds < 5) failures.push('nature bed is too short for routing');
  if (row.category === 'Accent' && probe.durationSeconds > 30) warnings.push('accent is long; trim or event-window QA required');
  if (row.category === 'Accent' && probe.durationSeconds > 90) failures.push('accent is too long for event use');

  if (volume.maxVolumeDb !== null && volume.maxVolumeDb > -0.5) warnings.push('peak close to 0 dBFS; clipping/transient QA required');
  if (volume.meanVolumeDb !== null && volume.meanVolumeDb > -10) warnings.push('high mean volume for sleep mix; lower default volume likely needed');
  if (volume.meanVolumeDb !== null && volume.meanVolumeDb < -55) warnings.push('very quiet source; silence/noise-floor QA required');

  if (row.title_voice_risk !== 'clear') failures.push('title-level human voice risk');

  return {
    machineStatus: failures.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    failures,
    warnings,
  };
};

const escapeTsv = (value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ');

const main = async () => {
  const rows = parseTsv(await readFile(INPUT_TSV, 'utf8'));
  const audited = [];

  for (const row of rows) {
    if (!existsSync(row.local_path)) {
      audited.push({
        ...row,
        machine_status: 'fail',
        hash_matches: 'false',
        measured_duration_seconds: '',
        measured_codec: '',
        measured_sample_rate: '',
        measured_channels: '',
        mean_volume_db: '',
        max_volume_db: '',
        machine_warnings: '',
        machine_failures: 'missing local file',
        human_voice_policy: humanVoicePolicy,
      });
      continue;
    }

    const [actualHash, probe, volume] = await Promise.all([
      sha256File(row.local_path),
      ffprobe(row.local_path),
      volumeDetect(row.local_path),
    ]);
    const hashMatches = actualHash === row.file_sha256;
    const result = classify(row, probe, volume, hashMatches);
    audited.push({
      ...row,
      machine_status: result.machineStatus,
      hash_matches: String(hashMatches),
      measured_duration_seconds: probe.durationSeconds.toFixed(2),
      measured_codec: probe.codec,
      measured_sample_rate: String(probe.sampleRate),
      measured_channels: String(probe.channels),
      mean_volume_db: volume.meanVolumeDb ?? '',
      max_volume_db: volume.maxVolumeDb ?? '',
      machine_warnings: result.warnings.join('; '),
      machine_failures: result.failures.join('; '),
      human_voice_policy: humanVoicePolicy,
    });
  }

  const headers = [
    ...Object.keys(rows[0]),
    'machine_status',
    'hash_matches',
    'measured_duration_seconds',
    'measured_codec',
    'measured_sample_rate',
    'measured_channels',
    'mean_volume_db',
    'max_volume_db',
    'machine_warnings',
    'machine_failures',
    'human_voice_policy',
  ];
  const tsv = [
    headers.join('\t'),
    ...audited.map((row) => headers.map((header) => escapeTsv(row[header])).join('\t')),
  ].join('\n');
  await writeFile(OUTPUT_TSV, `${tsv}\n`, 'utf8');

  const counts = audited.reduce((acc, row) => {
    acc[row.machine_status] = (acc[row.machine_status] ?? 0) + 1;
    return acc;
  }, {});
  const byCategory = audited.reduce((acc, row) => {
    const key = `${row.category}/${row.machine_status}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const warnings = audited.filter((row) => row.machine_status === 'warn');
  const failures = audited.filter((row) => row.machine_status === 'fail');

  const report = [
    '# No-Human Audio Candidate Machine QA',
    '',
    `Date: ${new Date().toISOString()}`,
    'Status: machine QA only; this does not approve assets and cannot replace no-human-voice listening QA.',
    '',
    `Total candidates: ${audited.length}`,
    `Pass: ${counts.pass ?? 0}`,
    `Warn: ${counts.warn ?? 0}`,
    `Fail: ${counts.fail ?? 0}`,
    '',
    '## Category Status',
    '',
    ...Object.entries(byCategory).sort().map(([key, count]) => `- ${key}: ${count}`),
    '',
    '## Warnings',
    '',
    warnings.length
      ? '| Candidate | Title | Duration | Mean dB | Max dB | Warnings |\n|---|---|---:|---:|---:|---|\n'
        + warnings.map((row) => `| ${row.candidate_id} | ${row.source_title} | ${row.measured_duration_seconds}s | ${row.mean_volume_db} | ${row.max_volume_db} | ${row.machine_warnings} |`).join('\n')
      : 'None.',
    '',
    '## Failures',
    '',
    failures.length
      ? '| Candidate | Title | Failures |\n|---|---|---|\n'
        + failures.map((row) => `| ${row.candidate_id} | ${row.source_title} | ${row.machine_failures} |`).join('\n')
      : 'None.',
    '',
    '## Required Listening Gate',
    '',
    humanVoicePolicy,
    'Any audible human voice is an automatic rejection, even when machine QA passes.',
  ].join('\n');
  await writeFile(REPORT_MD, `${report}\n`, 'utf8');

  console.log(`audited=${audited.length}`);
  console.log(`pass=${counts.pass ?? 0} warn=${counts.warn ?? 0} fail=${counts.fail ?? 0}`);
  console.log(`output=${OUTPUT_TSV}`);
  console.log(`report=${REPORT_MD}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
