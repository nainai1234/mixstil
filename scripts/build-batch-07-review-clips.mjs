#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const INPUT_TSV = join(ROOT, 'docs/asset-batch-07-downloaded-music.tsv');
const OUTPUT_DIR = join(ROOT, 'public/audio/candidates/batch-07/review-clips');
const OUTPUT_TSV = join(ROOT, 'docs/asset-batch-07-review-clips.tsv');
const OUTPUT_REPORT = join(ROOT, 'reports/batch-07-review-clips.md');
const CLIP_SECONDS = 30;

const parseTsv = (text) => {
  const [headerLine, ...lines] = text.trimEnd().split('\n');
  const headers = headerLine.split('\t');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
};

const run = (command, args) => execFileAsync(command, args, { maxBuffer: 32 * 1024 * 1024 });

const formatSeconds = (value) => {
  const seconds = Math.max(0, Math.round(Number(value)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const clipPlanFor = (durationSeconds) => {
  const duration = Number(durationSeconds);
  const clipLength = Math.min(CLIP_SECONDS, Math.max(1, duration));
  return [
    { label: 'intro', start: 0 },
    { label: 'middle', start: Math.max(0, (duration / 2) - (clipLength / 2)) },
    { label: 'outro', start: Math.max(0, duration - clipLength) },
  ].map((clip) => ({
    ...clip,
    start: Number(clip.start.toFixed(3)),
    duration: Number(clipLength.toFixed(3)),
  }));
};

const main = async () => {
  await Promise.all([
    mkdir(OUTPUT_DIR, { recursive: true }),
    mkdir(join(ROOT, 'reports'), { recursive: true }),
  ]);

  const candidates = parseTsv(await readFile(INPUT_TSV, 'utf8'));
  const rows = [];

  for (const candidate of candidates) {
    const inputPath = join(ROOT, candidate.local_path);
    for (const clip of clipPlanFor(candidate.duration_seconds)) {
      const outputPath = join(OUTPUT_DIR, `${candidate.candidate_id}_${clip.label}.mp3`);
      const fadeOutStart = Math.max(0, clip.duration - 0.12).toFixed(3);
      await run('ffmpeg', [
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-ss', String(clip.start),
        '-i', inputPath,
        '-t', String(clip.duration),
        '-vn',
        '-ac', '2',
        '-af', `aformat=sample_fmts=s16:channel_layouts=stereo,afade=t=in:st=0:d=0.08,afade=t=out:st=${fadeOutStart}:d=0.12`,
        '-codec:a', 'libmp3lame',
        '-q:a', '4',
        outputPath,
      ]);

      rows.push({
        batch_id: 'batch-07',
        candidate_id: candidate.candidate_id,
        title: candidate.title,
        clip_label: clip.label,
        source_start_seconds: clip.start,
        source_start_timecode: formatSeconds(clip.start),
        clip_duration_seconds: clip.duration,
        source_duration_seconds: Number(candidate.duration_seconds),
        clip_path: relative(ROOT, outputPath),
        source_path: candidate.local_path,
        machine_qa: candidate.machine_qa,
        machine_qa_notes: candidate.machine_qa_notes,
      });
    }
  }

  const headers = [
    'batch_id',
    'candidate_id',
    'title',
    'clip_label',
    'source_start_seconds',
    'source_start_timecode',
    'clip_duration_seconds',
    'source_duration_seconds',
    'clip_path',
    'source_path',
    'machine_qa',
    'machine_qa_notes',
  ];
  const tsv = [
    headers.join('\t'),
    ...rows.map((row) => headers.map((header) => String(row[header]).replaceAll('\t', ' ')).join('\t')),
  ].join('\n') + '\n';
  await writeFile(OUTPUT_TSV, tsv);

  const report = [
    '# Batch 07 Review Clips',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Status: review clips only. These excerpts are not approved assets, seeds, routes, renders, or public downloads.',
    '',
    `- Source candidates: ${candidates.length}`,
    `- Clips generated: ${rows.length}`,
    `- Clip length: ${CLIP_SECONDS}s each unless the source is shorter`,
    `- Output folder: \`${relative(ROOT, OUTPUT_DIR)}/\``,
    `- Clip TSV: \`${relative(ROOT, OUTPUT_TSV)}\``,
    '',
    '## Clip Set',
    '',
    '| Candidate | Intro | Middle | Outro |',
    '| --- | ---: | ---: | ---: |',
    ...candidates.map((candidate) => {
      const clips = rows.filter((row) => row.candidate_id === candidate.candidate_id);
      const byLabel = Object.fromEntries(clips.map((clip) => [clip.clip_label, clip.source_start_timecode]));
      return `| ${candidate.candidate_id} ${candidate.title} | ${byLabel.intro} | ${byLabel.middle} | ${byLabel.outro} |`;
    }),
    '',
    'Use these clips for fast triage only. Promotion still requires full-track listening, rights review, technical warning resolution, attribution-path validation, and platform claim checks.',
    '',
  ].join('\n');
  await writeFile(OUTPUT_REPORT, report);

  console.log(JSON.stringify({
    candidates: candidates.length,
    clips: rows.length,
    outputDir: relative(ROOT, OUTPUT_DIR),
    outputTsv: relative(ROOT, OUTPUT_TSV),
    outputReport: relative(ROOT, OUTPUT_REPORT),
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
