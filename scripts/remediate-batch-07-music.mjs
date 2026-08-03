#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const INPUT_TSV = join(ROOT, 'docs/asset-batch-07-downloaded-music.tsv');
const OUTPUT_DIR = join(ROOT, 'public/audio/candidates/batch-07/remediated-music');
const OUTPUT_TSV = join(ROOT, 'docs/asset-batch-07-remediated-music.tsv');
const OUTPUT_JSON = join(ROOT, 'reports/batch-07-remediated-music-machine-qa.json');
const OUTPUT_MD = join(ROOT, 'reports/batch-07-remediated-music-machine-qa.md');
const PYTHON = join(ROOT, '.venv-audio/bin/python');
const ANALYZER = join(ROOT, 'scripts/analyze-music-candidate.py');

const parseTsv = (text) => {
  const [headerLine, ...lines] = text.trimEnd().split('\n');
  const headers = headerLine.split('\t');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
};

const run = async (command, args) => execFileAsync(command, args, { maxBuffer: 64 * 1024 * 1024 });
const sha256File = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const slugPath = (path) => path.split('/').at(-1)?.replace(/\.mp3$/i, '.remediated.mp3') ?? 'remediated.mp3';

const machineNotes = (analysis) => {
  const warnings = [];
  if (analysis.clippedSampleCount > 0) warnings.push(`${analysis.clippedSampleCount} clipped samples`);
  if (analysis.samplePeakDbfs > -0.5) warnings.push(`peak ${analysis.samplePeakDbfs} dBFS`);
  if (analysis.max100msRmsJumpDb > 18) warnings.push(`100ms jump ${analysis.max100msRmsJumpDb} dB`);
  if (analysis.interiorSilence100msFrames > 50) warnings.push(`${analysis.interiorSilence100msFrames} interior silence frames`);
  return { status: warnings.length ? 'warn' : 'pass', notes: warnings.join('; ') || 'No machine threshold warnings' };
};

const main = async () => {
  await Promise.all([
    mkdir(OUTPUT_DIR, { recursive: true }),
    mkdir(join(ROOT, 'reports'), { recursive: true }),
  ]);

  const sourceRows = parseTsv(await readFile(INPUT_TSV, 'utf8'));
  const results = [];

  for (const row of sourceRows) {
    const inputPath = join(ROOT, row.local_path);
    const outputPath = join(OUTPUT_DIR, slugPath(row.local_path));
    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-vn',
      '-af', 'loudnorm=I=-18:LRA=10:TP=-2,aresample=48000',
      '-ac', '2',
      '-codec:a', 'libmp3lame',
      '-q:a', '2',
      outputPath,
    ]);

    const [{ stdout: probeText }, { stdout: analysisText }, outputStat] = await Promise.all([
      run('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,sample_rate,channels',
        '-of', 'json', outputPath,
      ]),
      run(PYTHON, [ANALYZER, outputPath]),
      stat(outputPath),
    ]);
    const probe = JSON.parse(probeText);
    const analysis = JSON.parse(analysisText);
    const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio') ?? {};
    const qa = machineNotes(analysis);

    results.push({
      batch_id: 'batch-07',
      candidate_id: row.candidate_id,
      title: row.title,
      creator: row.creator,
      source_local_path: row.local_path,
      remediated_local_path: relative(ROOT, outputPath),
      source_sha256: row.file_sha256,
      remediated_sha256: await sha256File(outputPath),
      remediated_file_size_bytes: outputStat.size,
      duration_seconds: Number(probe.format?.duration ?? 0),
      codec: audioStream.codec_name ?? '',
      sample_rate: Number(audioStream.sample_rate ?? 0),
      channels: Number(audioStream.channels ?? 0),
      original_machine_qa: row.machine_qa,
      original_machine_qa_notes: row.machine_qa_notes,
      integrated_lufs: analysis.integratedLufs,
      sample_peak_dbfs: analysis.samplePeakDbfs,
      opening_20s_peak_dbfs: analysis.opening20sPeakDbfs,
      max_100ms_rms_jump_db: analysis.max100msRmsJumpDb,
      clipped_sample_count: analysis.clippedSampleCount,
      interior_silence_100ms_frames: analysis.interiorSilence100msFrames,
      remediation_action: 'ffmpeg loudnorm I=-18 LRA=10 TP=-2, stereo, 48kHz MP3 review copy',
      machine_qa: qa.status,
      machine_qa_notes: qa.notes,
      qa_status: 'candidate_remediation_review',
    });
  }

  const headers = Object.keys(results[0] ?? {});
  await writeFile(OUTPUT_TSV, [
    headers.join('\t'),
    ...results.map((row) => headers.map((header) => String(row[header] ?? '').replaceAll('\t', ' ')).join('\t')),
  ].join('\n') + '\n');
  await writeFile(OUTPUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const counts = results.reduce((memo, row) => {
    memo[row.machine_qa] = (memo[row.machine_qa] ?? 0) + 1;
    return memo;
  }, {});
  const lines = [
    '# Batch 07 Remediated Music Machine QA',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Status: normalized review copies only. These files are not approved, seeded, routed, rendered, public, or counted as production inventory.',
    '',
    `- Candidates: ${results.length}`,
    `- Machine pass after remediation: ${counts.pass ?? 0}`,
    `- Machine warn after remediation: ${counts.warn ?? 0}`,
    `- Output folder: \`${relative(ROOT, OUTPUT_DIR)}/\``,
    '',
    '| Candidate | LUFS | Peak | Jump | Clipped | Silence | Machine QA |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...results.map((row) => `| ${row.candidate_id} ${row.title} | ${row.integrated_lufs} | ${row.sample_peak_dbfs} | ${row.max_100ms_rms_jump_db} | ${row.clipped_sample_count} | ${row.interior_silence_100ms_frames} | ${row.machine_qa}: ${row.machine_qa_notes} |`),
    '',
    'Remediation can remove clipping and peak risk, but jump and silence warnings may still require editorial acceptance or manual trimming.',
    '',
  ];
  await writeFile(OUTPUT_MD, lines.join('\n'));

  console.log(JSON.stringify({
    candidates: results.length,
    passed: counts.pass ?? 0,
    warned: counts.warn ?? 0,
    output: relative(ROOT, OUTPUT_MD),
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
