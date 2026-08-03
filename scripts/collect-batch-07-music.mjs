#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'public/audio/candidates/batch-07/music');
const SNAPSHOT_DIR = join(ROOT, 'docs/license-snapshots/batch-07');
const OUTPUT_TSV = join(ROOT, 'docs/asset-batch-07-downloaded-music.tsv');
const REPORT_JSON = join(ROOT, 'reports/batch-07-music-machine-qa.json');
const REPORT_MD = join(ROOT, 'reports/batch-07-music-machine-qa.md');
const PYTHON = join(ROOT, '.venv-audio/bin/python');
const ANALYZER = join(ROOT, 'scripts/analyze-music-candidate.py');
const USER_AGENT = 'SNOOZE sleep-audio candidate review/0.1';

const candidates = [
  {
    candidateId: 'fma-holizna-meditation-01',
    title: '20 Minute Meditation 1',
    creator: 'HoliznaCC0',
    sourcePlatform: 'Free Music Archive',
    sourceUrl: 'https://freemusicarchive.org/music/holiznacc0/space-sleep-meditation/20-minute-meditation-1/',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    downloadUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/l2voOrqtnup186CFblGiKMvKziL9LmSR26D3INpG.mp3',
    filename: 'fma_holizna_20_minute_meditation_1.mp3',
    targetGoals: 'calm,sleep',
    role: 'music.bed',
    attributionRequired: false,
    rightsStatus: 'album_license_verified_individual_recheck',
  },
  {
    candidateId: 'fma-holizna-dreamscape',
    title: 'DreamScape',
    creator: 'HoliznaCC0',
    sourcePlatform: 'Free Music Archive',
    sourceUrl: 'https://freemusicarchive.org/music/holiznacc0/space-sleep-meditation/dreamscape/',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    downloadUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/F8rsaDXQBxNNiQQSNmpO2RBULw8LxtHpjQPY8Gpi.mp3',
    filename: 'fma_holizna_dreamscape.mp3',
    targetGoals: 'sleep,calm',
    role: 'music.bed',
    attributionRequired: false,
    rightsStatus: 'album_license_verified_individual_recheck',
  },
  {
    candidateId: 'fma-holizna-rain-sleep',
    title: 'Rain / Sleep / Meditation',
    creator: 'HoliznaCC0',
    sourcePlatform: 'Free Music Archive',
    sourceUrl: 'https://freemusicarchive.org/music/holiznacc0/space-sleep-meditation/rain-sleep-meditation/',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    downloadUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/vDmea5mQNa3Q6MYw4uHfU1rh93apZ2YlfGQxM18v.mp3',
    filename: 'fma_holizna_rain_sleep_meditation.mp3',
    targetGoals: 'sleep,calm',
    role: 'music.bed',
    attributionRequired: false,
    rightsStatus: 'album_license_verified_individual_recheck',
  },
  {
    candidateId: 'fma-holizna-cosmic-waves',
    title: 'Cosmic Waves',
    creator: 'HoliznaCC0',
    sourcePlatform: 'Free Music Archive',
    sourceUrl: 'https://freemusicarchive.org/music/holiznacc0/space-sleep-meditation/cosmic-waves/',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    downloadUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/Ezl0hehTpT9uZOQSob72CXcbH1TSnfCpUG0khDQG.mp3',
    filename: 'fma_holizna_cosmic_waves.mp3',
    targetGoals: 'sleep,calm',
    role: 'music.bed',
    attributionRequired: false,
    rightsStatus: 'album_license_verified_individual_recheck',
  },
  ...[
    ['01', 'USUAN1100163', '3:32'],
    ['02', 'USUAN1100162', '4:09'],
    ['03', 'USUAN1100161', '4:15'],
  ].map(([part, isrc]) => ({
    candidateId: `incompetech-meditation-impromptu-${part}`,
    title: `Meditation Impromptu ${part}`,
    creator: 'Kevin MacLeod',
    sourcePlatform: 'Incompetech',
    sourceUrl: `https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=${isrc}`,
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    downloadUrl: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/Meditation%20Impromptu%20${part}.mp3`,
    filename: `incompetech_meditation_impromptu_${part}.mp3`,
    targetGoals: 'calm,sleep',
    role: 'music.bed',
    attributionRequired: true,
    rightsStatus: 'item_license_verified',
  })),
  {
    candidateId: 'scott-buckley-solace',
    title: 'Solace',
    creator: 'Scott Buckley',
    sourcePlatform: 'Scott Buckley',
    sourceUrl: 'https://www.scottbuckley.com.au/library/solace/',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    downloadUrl: 'https://www.scottbuckley.com.au/library/wp-content/uploads/2020/05/sb_solace.mp3',
    filename: 'scott_buckley_solace.mp3',
    targetGoals: 'calm,focus',
    role: 'music.bed',
    attributionRequired: true,
    rightsStatus: 'item_license_verified',
  },
];

const run = async (command, args, options = {}) => execFileAsync(command, args, {
  maxBuffer: 64 * 1024 * 1024,
  ...options,
});

const curl = async (url, outputPath) => run('curl', [
  '--fail', '--location', '--silent', '--show-error',
  '--retry', '3', '--retry-delay', '1',
  '--connect-timeout', '15', '--max-time', '600',
  '--user-agent', USER_AGENT,
  '--output', outputPath,
  url,
]);

const sha256File = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

const walkAudio = async (dir) => {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walkAudio(path));
    else if (['.mp3', '.wav', '.ogg', '.opus', '.m4a', '.aac', '.flac'].includes(extname(entry.name).toLowerCase())) paths.push(path);
  }
  return paths;
};

const snapshotName = (candidate) => `${candidate.candidateId}.source.html`;

const main = async () => {
  await Promise.all([
    mkdir(OUTPUT_DIR, { recursive: true }),
    mkdir(SNAPSHOT_DIR, { recursive: true }),
    mkdir(join(ROOT, 'reports'), { recursive: true }),
  ]);

  const licenseSnapshots = new Map();
  for (const candidate of candidates) {
    const sourceSnapshot = join(SNAPSHOT_DIR, snapshotName(candidate));
    await curl(candidate.sourceUrl, sourceSnapshot);
    if (!licenseSnapshots.has(candidate.licenseUrl)) {
      const licenseSlug = candidate.licenseName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const licenseSnapshot = join(SNAPSHOT_DIR, `${licenseSlug}.license.html`);
      await curl(candidate.licenseUrl, licenseSnapshot);
      licenseSnapshots.set(candidate.licenseUrl, licenseSnapshot);
    }
  }

  const existingPaths = (await walkAudio(join(ROOT, 'public/audio')))
    .filter((path) => !path.startsWith(OUTPUT_DIR));
  const existingHashes = new Map();
  for (const path of existingPaths) existingHashes.set(await sha256File(path), relative(ROOT, path));

  const results = [];
  for (const candidate of candidates) {
    const outputPath = join(OUTPUT_DIR, candidate.filename);
    try {
      const current = await stat(outputPath).catch(() => null);
      if (!current?.size) await curl(candidate.downloadUrl, outputPath);

      const [{ stdout: probeText }, { stdout: analysisText }] = await Promise.all([
        run('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,sample_rate,channels',
          '-of', 'json', outputPath,
        ]),
        run(PYTHON, [ANALYZER, outputPath]),
      ]);
      const probe = JSON.parse(probeText);
      const analysis = JSON.parse(analysisText);
      const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio') ?? {};
      const hash = await sha256File(outputPath);
      const duplicateOf = existingHashes.get(hash) ?? '';
      const warnings = [];
      if (analysis.clippedSampleCount > 0) warnings.push(`${analysis.clippedSampleCount} clipped samples`);
      if (analysis.samplePeakDbfs > -0.5) warnings.push(`peak ${analysis.samplePeakDbfs} dBFS`);
      if (analysis.max100msRmsJumpDb > 18) warnings.push(`100ms jump ${analysis.max100msRmsJumpDb} dB`);
      if (analysis.interiorSilence100msFrames > 50) warnings.push(`${analysis.interiorSilence100msFrames} interior silence frames`);
      if (duplicateOf) warnings.push(`duplicate of ${duplicateOf}`);
      results.push({
        ...candidate,
        localPath: relative(ROOT, outputPath),
        sourceSnapshotPath: relative(ROOT, join(SNAPSHOT_DIR, snapshotName(candidate))),
        licenseSnapshotPath: relative(ROOT, licenseSnapshots.get(candidate.licenseUrl)),
        importedAt: new Date().toISOString(),
        fileSha256: hash,
        fileSizeBytes: Number(probe.format?.size ?? 0),
        durationSeconds: Number(probe.format?.duration ?? 0),
        codec: audioStream.codec_name ?? '',
        sampleRate: Number(audioStream.sample_rate ?? 0),
        channels: Number(audioStream.channels ?? 0),
        integratedLufs: analysis.integratedLufs,
        samplePeakDbfs: analysis.samplePeakDbfs,
        opening20sPeakDbfs: analysis.opening20sPeakDbfs,
        max100msRmsJumpDb: analysis.max100msRmsJumpDb,
        clippedSampleCount: analysis.clippedSampleCount,
        interiorSilence100msFrames: analysis.interiorSilence100msFrames,
        duplicateOf,
        machineQa: warnings.length ? 'warn' : 'pass',
        machineQaNotes: warnings.join('; ') || 'No machine threshold warnings',
        qaStatus: 'candidate',
      });
    } catch (error) {
      results.push({
        ...candidate,
        localPath: relative(ROOT, outputPath),
        sourceSnapshotPath: relative(ROOT, join(SNAPSHOT_DIR, snapshotName(candidate))),
        licenseSnapshotPath: relative(ROOT, licenseSnapshots.get(candidate.licenseUrl)),
        machineQa: 'fail',
        machineQaNotes: error.message,
        qaStatus: 'candidate',
      });
    }
  }

  const headers = [
    'batch_id', 'candidate_id', 'title', 'creator', 'source_platform', 'source_url',
    'source_snapshot_path', 'license_name', 'license_url', 'license_snapshot_path',
    'attribution_required', 'commercial_use_allowed', 'derivative_use_allowed',
    'raw_redistribution_allowed', 'rights_status', 'download_url', 'local_path',
    'imported_at', 'file_sha256', 'file_size_bytes', 'duration_seconds', 'codec',
    'sample_rate', 'channels', 'integrated_lufs', 'sample_peak_dbfs',
    'opening_20s_peak_dbfs', 'max_100ms_rms_jump_db', 'clipped_sample_count',
    'interior_silence_100ms_frames', 'duplicate_of', 'target_goals', 'suggested_role',
    'machine_qa', 'machine_qa_notes', 'qa_status',
  ];
  const toRow = (item) => ({
    batch_id: 'batch-07', candidate_id: item.candidateId, title: item.title,
    creator: item.creator, source_platform: item.sourcePlatform, source_url: item.sourceUrl,
    source_snapshot_path: item.sourceSnapshotPath, license_name: item.licenseName,
    license_url: item.licenseUrl, license_snapshot_path: item.licenseSnapshotPath,
    attribution_required: String(item.attributionRequired), commercial_use_allowed: 'true',
    derivative_use_allowed: 'true', raw_redistribution_allowed: 'false',
    rights_status: item.rightsStatus, download_url: item.downloadUrl,
    local_path: item.localPath, imported_at: item.importedAt ?? '',
    file_sha256: item.fileSha256 ?? '', file_size_bytes: item.fileSizeBytes ?? '',
    duration_seconds: item.durationSeconds?.toFixed?.(2) ?? '', codec: item.codec ?? '',
    sample_rate: item.sampleRate ?? '', channels: item.channels ?? '',
    integrated_lufs: item.integratedLufs ?? '', sample_peak_dbfs: item.samplePeakDbfs ?? '',
    opening_20s_peak_dbfs: item.opening20sPeakDbfs ?? '',
    max_100ms_rms_jump_db: item.max100msRmsJumpDb ?? '',
    clipped_sample_count: item.clippedSampleCount ?? '',
    interior_silence_100ms_frames: item.interiorSilence100msFrames ?? '',
    duplicate_of: item.duplicateOf ?? '', target_goals: item.targetGoals,
    suggested_role: item.role, machine_qa: item.machineQa,
    machine_qa_notes: item.machineQaNotes, qa_status: item.qaStatus,
  });
  const escapeTsv = (value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ');
  const tsv = [
    headers.join('\t'),
    ...results.map((item) => {
      const row = toRow(item);
      return headers.map((header) => escapeTsv(row[header])).join('\t');
    }),
  ].join('\n');
  await writeFile(OUTPUT_TSV, `${tsv}\n`, 'utf8');
  await writeFile(REPORT_JSON, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');

  const passed = results.filter((item) => item.machineQa === 'pass').length;
  const warned = results.filter((item) => item.machineQa === 'warn').length;
  const failed = results.filter((item) => item.machineQa === 'fail').length;
  const report = [
    '# Batch 07 Music Machine QA', '',
    `Generated: ${new Date().toISOString()}`, '',
    'Status: downloaded candidates only. No item is approved, seeded, routed, rendered, or public.', '',
    `- Candidates: ${results.length}`,
    `- Machine pass: ${passed}`,
    `- Machine warn: ${warned}`,
    `- Machine fail: ${failed}`,
    `- Duplicate hashes against the existing audio library: ${results.filter((item) => item.duplicateOf).length}`,
    '', '## Results', '',
    '| Candidate | Goals | Duration | LUFS | Peak | Jump | Clipped | Duplicate | Machine QA |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...results.map((item) => `| ${item.candidateId} ${item.title} | ${item.targetGoals} | ${item.durationSeconds?.toFixed?.(1) ?? '-'}s | ${item.integratedLufs ?? '-'} | ${item.samplePeakDbfs ?? '-'} | ${item.max100msRmsJumpDb ?? '-'} | ${item.clippedSampleCount ?? '-'} | ${item.duplicateOf || '-'} | ${item.machineQa}: ${item.machineQaNotes} |`),
    '', '## Required Human Review', '',
    '- Listen to every candidate in full for speech, vocals, frightening tone, abrupt changes, and watermark artifacts.',
    '- Check whether piano or melodic motion competes with guided meditation or hypnosis-style voice.',
    '- Check 30- and 60-minute repetition, edit points, and fade behavior.',
    '- Confirm every FMA individual track page still carries CC0 despite the album-level license.',
    '- Verify Published Work attribution for the Incompetech and Scott Buckley candidates.',
    '- Run Content ID/platform claim checks before promotion.',
    '', 'Only after rights review, machine remediation, and human listening pass may `qa_status` change from `candidate`.', '',
  ].join('\n');
  await writeFile(REPORT_MD, report, 'utf8');
  console.log(JSON.stringify({ candidates: results.length, passed, warned, failed, output: relative(ROOT, REPORT_MD) }, null, 2));
};

await main();
