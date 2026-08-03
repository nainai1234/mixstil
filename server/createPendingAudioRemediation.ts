import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { query, pool } from './db';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = path.join(root, '.venv-audio/bin/python');
const analyzer = path.join(root, 'scripts/analyze-music-candidate.py');
const outputRoot = path.join(root, 'public/audio/production-remediated-2026-07-13');

type QueueRow = {
  stem_id: string;
  category: 'Music' | 'Nature';
  name: string;
  blocker?: string;
};

type StemRow = {
  id: string;
  name: string;
  category: 'Music' | 'Nature';
  audio_url: string;
  license_name: string;
  license_url: string;
  attribution_required: boolean;
  commercial_use_allowed: boolean;
  derivative_use_allowed: boolean;
  raw_redistribution_allowed: boolean;
};

const parseTsv = (content: string) => {
  const [headerLine, ...lines] = content.trimEnd().split('\n');
  const headers = headerLine.split('\t');
  return lines.filter(Boolean).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
};

const run = async (command: string, args: string[]) => execFileAsync(command, args, { maxBuffer: 64 * 1024 * 1024 });
const sha256File = async (filePath: string) => createHash('sha256').update(await readFile(filePath)).digest('hex');
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const cleanCell = (value: unknown) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ');

const machineNotes = (analysis: any) => {
  const warnings: string[] = [];
  if (analysis.clippedSampleCount > 0) warnings.push(`${analysis.clippedSampleCount} clipped samples`);
  if (analysis.samplePeakDbfs > -1) warnings.push(`peak ${analysis.samplePeakDbfs} dBFS`);
  if (analysis.max100msRmsJumpDb > 24) warnings.push(`100ms jump ${analysis.max100msRmsJumpDb} dB`);
  if (analysis.interiorSilence100msFrames > 80) warnings.push(`${analysis.interiorSilence100msFrames} interior silence frames`);
  return { status: warnings.length ? 'warn' : 'pass', notes: warnings.join('; ') || 'No machine threshold warnings' };
};

const main = async () => {
  await mkdir(outputRoot, { recursive: true });
  await mkdir(path.join(root, 'reports'), { recursive: true });

  const queueRows = parseTsv(await readFile(path.join(root, 'docs/pending-audio-technical-fix-queue-2026-07-13.tsv'), 'utf8')) as QueueRow[];
  const ids = queueRows.map((row) => row.stem_id).filter((id) => id !== 'stem_mixkit_music_522');
  const stems = await query<StemRow>(
    `select id, name, category, audio_url, license_name, license_url, attribution_required,
            commercial_use_allowed, derivative_use_allowed, raw_redistribution_allowed
       from audio_stems
      where id = any($1)
      order by array_position($1::text[], id)`,
    [ids],
  );
  const queueById = new Map(queueRows.map((row) => [row.stem_id, row]));
  const results: Record<string, unknown>[] = [];

  for (const stem of stems.rows) {
    const sourcePath = path.join(root, 'public', stem.audio_url.replace(/^\//, ''));
    const outputDir = path.join(outputRoot, stem.category.toLowerCase());
    await mkdir(outputDir, { recursive: true });
    const outputFile = `${slug(stem.name)}.mp3`;
    const outputPath = path.join(outputDir, outputFile);
    const targetSeconds = stem.category === 'Nature' ? 90 : null;
    const filter = stem.category === 'Nature'
      ? `loudnorm=I=-24:LRA=10:TP=-2,afade=t=in:st=0:d=0.05,afade=t=out:st=${Number(targetSeconds) - 0.75}:d=0.75,aresample=48000`
      : 'loudnorm=I=-18:LRA=10:TP=-2,aresample=48000';

    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      ...(targetSeconds ? ['-stream_loop', '-1'] : []),
      '-i', sourcePath,
      ...(targetSeconds ? ['-t', String(targetSeconds)] : []),
      '-vn',
      '-af', filter,
      '-ac', '2',
      '-codec:a', 'libmp3lame',
      '-q:a', '2',
      outputPath,
    ]);

    const [{ stdout: probeText }, { stdout: analysisText }, outputStat] = await Promise.all([
      run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,sample_rate,channels', '-of', 'json', outputPath]),
      run(python, [analyzer, outputPath]),
      stat(outputPath),
    ]);
    const probe = JSON.parse(probeText);
    const analysis = JSON.parse(analysisText);
    const stream = probe.streams?.find((item: any) => item.codec_type === 'audio') ?? {};
    const qa = machineNotes(analysis);
    const relativePath = path.relative(root, outputPath);
    const blocker = queueById.get(stem.id)?.['blocker'] ?? '';

    results.push({
      stem_id: stem.id,
      category: stem.category,
      name: stem.name,
      source_audio_url: stem.audio_url,
      final_local_path: relativePath,
      final_audio_url: `/${relativePath.replace(/^public\//, '')}`,
      file_sha256: await sha256File(outputPath),
      file_size_bytes: outputStat.size,
      duration_seconds: Number(probe.format?.duration ?? 0),
      codec: stream.codec_name ?? '',
      sample_rate: Number(stream.sample_rate ?? 0),
      channels: Number(stream.channels ?? 0),
      integrated_lufs: analysis.integratedLufs,
      sample_peak_dbfs: analysis.samplePeakDbfs,
      opening_20s_peak_dbfs: analysis.opening20sPeakDbfs,
      max_100ms_rms_jump_db: analysis.max100msRmsJumpDb,
      clipped_sample_count: analysis.clippedSampleCount,
      interior_silence_100ms_frames: analysis.interiorSilence100msFrames,
      machine_qa: qa.status,
      machine_qa_notes: qa.notes,
      remediation_action: stem.category === 'Nature'
        ? 'ffmpeg stream_loop to 90s, loudnorm I=-24 LRA=10 TP=-2, stereo, 48kHz MP3 production copy'
        : 'ffmpeg loudnorm I=-18 LRA=10 TP=-2, stereo, 48kHz MP3 production copy',
      original_blocker: blocker,
      license_name: stem.license_name,
      license_url: stem.license_url,
      attribution_required: stem.attribution_required,
      commercial_use_allowed: stem.commercial_use_allowed,
      derivative_use_allowed: stem.derivative_use_allowed,
      raw_redistribution_allowed: false,
      promotion_status: qa.status === 'pass' ? 'approved' : 'needs_editorial_acceptance',
    });
  }

  const headers = Object.keys(results[0] ?? {});
  await writeFile(
    path.join(root, 'docs/pending-audio-remediated-production-2026-07-13.tsv'),
    `${[headers.join('\t'), ...results.map((row) => headers.map((header) => cleanCell(row[header])).join('\t'))].join('\n')}\n`,
    'utf8',
  );
  await writeFile(
    path.join(root, 'reports/pending-audio-remediated-production-2026-07-13.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
    'utf8',
  );

  const passed = results.filter((row) => row.machine_qa === 'pass').length;
  const warned = results.length - passed;
  await writeFile(
    path.join(root, 'reports/pending-audio-remediated-production-2026-07-13.md'),
    [
      '# Pending Audio Remediated Production QA',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      `- Candidates remediated: ${results.length}`,
      `- Machine pass: ${passed}`,
      `- Machine warn: ${warned}`,
      `- Output folder: \`${path.relative(root, outputRoot)}/\``,
      '',
      '| Stem | LUFS | Peak | Jump | Silence | Machine QA |',
      '| --- | ---: | ---: | ---: | ---: | --- |',
      ...results.map((row) => `| ${row.stem_id} ${row.name} | ${row.integrated_lufs} | ${row.sample_peak_dbfs} | ${row.max_100ms_rms_jump_db} | ${row.interior_silence_100ms_frames} | ${row.machine_qa}: ${row.machine_qa_notes} |`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify({ remediated: results.length, passed, warned, output: 'docs/pending-audio-remediated-production-2026-07-13.tsv' }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
