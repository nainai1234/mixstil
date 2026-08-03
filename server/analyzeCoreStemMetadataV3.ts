import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchableStemMetadataV3 } from './audioKnowledgeV3';
import { pool, query } from './db';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const analysisVersion = 'ffmpeg-loudnorm-v1';
const missingOnly = process.argv.includes('--missing-only');

const runCommand = (command: string, args: string[]) => {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return { stdout: result.stdout, stderr: result.stderr };
};

const parseLoudnorm = (stderr: string) => {
  const matches = [...stderr.matchAll(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)];
  if (!matches.length) return { integratedLufs: null, truePeakDb: null, details: {} };
  const details = JSON.parse(matches[matches.length - 1][0]);
  const numberOrNull = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    integratedLufs: numberOrNull(details.input_i),
    truePeakDb: numberOrNull(details.input_tp),
    details,
  };
};

const parseVolume = (stderr: string) => ({
  meanVolumeDb: Number(stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1] ?? Number.NaN),
  maxVolumeDb: Number(stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1] ?? Number.NaN),
});

const run = async () => {
  const matchableStemIds = matchableStemMetadataV3.map((item) => item.stemId);
  const result = await query<{ id: string; audio_url: string; category: string; qa_status: string }>(
    `select s.id, s.audio_url, s.category, s.qa_status from audio_stems s
     left join stem_acoustic_features f on f.stem_id = s.id
     where (s.id = any($1) or (s.category in ('Music', 'Nature') and s.qa_status = 'needs_review'))
       and ($2::boolean = false or f.stem_id is null)
     order by s.id`,
    [matchableStemIds, missingOnly],
  );
  const expectedIds = new Set(matchableStemIds);
  if (result.rows.some((row) => !expectedIds.has(row.id) && !(row.category === 'Music' || row.category === 'Nature') && row.qa_status === 'needs_review')) {
    throw new Error('Acoustic analysis query returned an unexpected stem.');
  }

  for (const stem of result.rows) {
    const filePath = path.join(projectRoot, 'public', stem.audio_url.replace(/^\//, ''));
    const probe = JSON.parse(runCommand('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', filePath,
    ]).stdout);
    const stream = probe.streams?.find((item: any) => item.sample_rate && item.channels) ?? {};
    const loudnormResult = runCommand('ffmpeg', [
      '-hide_banner', '-nostats', '-i', filePath, '-af', 'loudnorm=I=-24:TP=-2:LRA=7:print_format=json', '-f', 'null', '-',
    ]);
    const volumeResult = runCommand('ffmpeg', [
      '-hide_banner', '-nostats', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-',
    ]);
    const loudness = parseLoudnorm(loudnormResult.stderr);
    const volume = parseVolume(volumeResult.stderr);
    await query(
      `insert into stem_acoustic_features (
         stem_id, analysis_version, duration_seconds, sample_rate, channels,
         integrated_lufs, true_peak_db, mean_volume_db, max_volume_db, details, analyzed_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       on conflict (stem_id) do update set analysis_version = excluded.analysis_version,
         duration_seconds = excluded.duration_seconds, sample_rate = excluded.sample_rate,
         channels = excluded.channels, integrated_lufs = excluded.integrated_lufs,
         true_peak_db = excluded.true_peak_db, mean_volume_db = excluded.mean_volume_db,
         max_volume_db = excluded.max_volume_db, details = excluded.details, analyzed_at = now()`,
      [stem.id, analysisVersion, Number(probe.format?.duration ?? 0), Number(stream.sample_rate ?? 0), Number(stream.channels ?? 0),
        loudness.integratedLufs, loudness.truePeakDb,
        Number.isFinite(volume.meanVolumeDb) ? volume.meanVolumeDb : null,
        Number.isFinite(volume.maxVolumeDb) ? volume.maxVolumeDb : null,
        JSON.stringify(loudness.details)],
    );
    console.log(`${stem.id}: ${Number(probe.format?.duration ?? 0).toFixed(1)}s, ${loudness.integratedLufs ?? 'n/a'} LUFS, ${loudness.truePeakDb ?? 'n/a'} dBTP`);
  }
};

run()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
