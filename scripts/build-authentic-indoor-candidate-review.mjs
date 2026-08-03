#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-14';
const BATCH = 'batch-09';
const candidateDir = resolve(ROOT, `public/audio/candidates/${BATCH}/authentic-indoor`);
const reviewDir = resolve(ROOT, `public/audio/authentic-indoor-review/${DATE}`);
const snapshotDir = resolve(ROOT, `docs/license-snapshots/${BATCH}`);
const python = resolve(ROOT, '.venv-audio/bin/python');
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');

const candidates = [
  {
    id: 'room_apartment_small', title: 'Small Apartment Room Tone', family: 'room_tone', role: 'environment.scene',
    sourcePlatform: 'Freesound via Openverse', sourceCreator: 'leonelmail',
    sourceUrl: 'https://freesound.org/people/leonelmail/sounds/329568',
    downloadUrl: 'https://cdn.freesound.org/previews/329/329568_4437257-hq.mp3',
    licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
  },
  {
    id: 'room_bedroom_night', title: 'Bedroom Night Room Tone', family: 'room_tone', role: 'environment.scene',
    sourcePlatform: 'Freesound via Openverse', sourceCreator: 'franciscopcoutinho',
    sourceUrl: 'https://freesound.org/people/franciscopcoutinho/sounds/466123',
    downloadUrl: 'https://cdn.freesound.org/previews/466/466123_5547533-hq.mp3',
    licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
  },
  {
    id: 'room_office_distant_traffic', title: 'Office Room Tone with Distant Traffic', family: 'room_tone', role: 'environment.scene',
    sourcePlatform: 'Freesound via Openverse', sourceCreator: 'mzui',
    sourceUrl: 'https://freesound.org/people/mzui/sounds/135097',
    downloadUrl: 'https://cdn.freesound.org/previews/135/135097_658546-hq.mp3',
    licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
  },
  {
    id: 'fan_ceiling_roomtone', title: 'Old Ceiling Fan with Room Tone', family: 'fan', role: 'environment.scene',
    sourcePlatform: 'Freesound via Openverse', sourceCreator: 'seventhsamurai',
    sourceUrl: 'https://freesound.org/people/seventhsamurai/sounds/327449',
    downloadUrl: 'https://cdn.freesound.org/previews/327/327449_3288322-hq.mp3',
    licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
  },
  {
    id: 'fan_deep_ventilation', title: 'Deep Ventilation Room Tone', family: 'fan', role: 'environment.scene',
    sourcePlatform: 'Freesound via Openverse', sourceCreator: 'Kinoton',
    sourceUrl: 'https://freesound.org/people/Kinoton/sounds/503255',
    downloadUrl: 'https://cdn.freesound.org/previews/503/503255_2247456-hq.mp3',
    licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
  },
  {
    id: 'fan_mine_ventilation', title: 'Mine Ventilation Fan', family: 'fan', role: 'environment.scene',
    sourcePlatform: 'Wikimedia Commons', sourceCreator: 'Work With Sounds / Technical Museum of Slovenia',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:WWS_Ventilationfan.ogg',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/db/WWS_Ventilationfan.ogg',
    licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', attributionRequired: true,
  },
  {
    id: 'train_taiwan_ep727', title: 'Taiwan Rail Car EP727 Interior', family: 'train_carriage', role: 'environment.scene',
    sourcePlatform: 'Wikimedia Commons', sourceCreator: 'Jidanni',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Taiwan_railways_EP727_train_cars_sounds.ogg',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/83/Taiwan_railways_EP727_train_cars_sounds.ogg',
    licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
  },
  {
    id: 'air_conditioner_hum_1', title: 'Air Conditioner Hum 1', family: 'air_conditioner', role: 'environment.scene',
    sourcePlatform: 'Wikimedia Commons', sourceCreator: 'Gravity Sound',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Air_conditioner_hum_(Gravity_Sound).wav',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/99/Air_conditioner_hum_%28Gravity_Sound%29.wav',
    licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', attributionRequired: true,
  },
  {
    id: 'air_conditioner_hum_2', title: 'Air Conditioner Hum 2', family: 'air_conditioner', role: 'environment.scene',
    sourcePlatform: 'Wikimedia Commons', sourceCreator: 'Gravity Sound',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Air_conditioner_hum_2_(Gravity_Sound).wav',
    downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/dc/Air_conditioner_hum_2_%28Gravity_Sound%29.wav',
    licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0', attributionRequired: true,
  },
];

mkdirSync(candidateDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });
mkdirSync(snapshotDir, { recursive: true });

const run = (command, args, capture = false) => {
  const result = execFileSync(command, args, { cwd: ROOT, encoding: capture ? 'utf8' : undefined, stdio: capture ? 'pipe' : 'inherit', maxBuffer: 50 * 1024 * 1024 });
  return capture ? result : '';
};

const download = (url, output) => run('curl', [
  '--fail', '--location', '--silent', '--show-error', '--retry', '3',
  '--connect-timeout', '15', '--max-time', '90', '--output', output, url,
]);

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const analyze = (file) => JSON.parse(run(python, [analyzer, file], true));
const clean = (value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ');

download('https://creativecommons.org/publicdomain/zero/1.0/', resolve(snapshotDir, 'cc0-1.0.license.html'));
download('https://creativecommons.org/licenses/by/4.0', resolve(snapshotDir, 'cc-by-4.0.license.html'));

const results = candidates.map((candidate) => {
  const extension = extname(new URL(candidate.downloadUrl).pathname) || '.audio';
  const sourcePath = resolve(candidateDir, `${candidate.id}${extension}`);
  const sourceSnapshot = resolve(snapshotDir, `${candidate.id}.source.html`);
  download(candidate.downloadUrl, sourcePath);
  download(candidate.sourceUrl, sourceSnapshot);

  const sourceAnalysis = analyze(sourcePath);
  const loudnessGain = -30 - sourceAnalysis.integratedLufs;
  const peakGain = -8 - sourceAnalysis.samplePeakDbfs;
  const reviewGainDb = Math.round(Math.min(loudnessGain, peakGain) * 100) / 100;
  const reviewPath = resolve(reviewDir, `${candidate.id}.mp3`);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath,
    '-af', `volume=${reviewGainDb}dB`, '-ar', '48000', '-ac', '2',
    '-codec:a', 'libmp3lame', '-b:a', '256k', reviewPath,
  ]);
  const reviewAnalysis = analyze(reviewPath);
  const failures = [
    ...(reviewAnalysis.durationSeconds < 10 ? ['duration_under_10s'] : []),
    ...(reviewAnalysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(reviewAnalysis.channels !== 2 ? ['channels'] : []),
    ...(reviewAnalysis.samplePeakDbfs > -6 ? ['peak_above_-6_dbfs'] : []),
    ...(reviewAnalysis.clippedSampleCount > 0 ? ['clipping'] : []),
    ...(reviewAnalysis.max100msRmsJumpDb > 12 ? ['sudden_rms_jump'] : []),
  ];
  return {
    ...candidate,
    batchId: BATCH,
    localPath: sourcePath.replace(`${ROOT}/`, ''),
    reviewUrl: `/audio/authentic-indoor-review/${DATE}/${candidate.id}.mp3`,
    sourceSha256: sha256(sourcePath),
    sourceAnalysis,
    reviewGainDb,
    reviewAnalysis,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    semanticListeningStatus: 'pending',
    noHumanListeningStatus: 'pending',
    loopQaStatus: 'pending',
    promotionAllowed: false,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  batchId: BATCH,
  purpose: 'authentic_indoor_transport_source_identity_review',
  candidateCount: results.length,
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  promotionAllowed: false,
  remainingGates: ['semantic_identity_listening', 'no_human_voice_listening', 'scene_fit', 'loop_fatigue', 'license_snapshot_review', 'recipe_v2_combination_qa'],
  results,
};

writeFileSync(resolve(ROOT, `reports/authentic-indoor-source-review-${DATE}.json`), `${JSON.stringify(report, null, 2)}\n`);
const rows = results.map((item) => `| ${item.title} | ${item.family} | ${item.licenseName} | ${item.reviewAnalysis.durationSeconds} | ${item.reviewAnalysis.integratedLufs} | ${item.reviewAnalysis.samplePeakDbfs} | ${item.machineStatus} | [试听](http://localhost:5174${item.reviewUrl}) |`);
writeFileSync(resolve(ROOT, `reports/authentic-indoor-source-review-${DATE}.md`), `# Authentic Indoor And Transport Source Review\n\nDate: ${DATE}  \nStatus: candidate-only internal review. Nothing in this batch is approved or matchable.  \nProcessing: source-only linear gain, 48 kHz stereo, one MP3 review encode. No added noise, music, EQ, compression, or effects.\n\n| Candidate | Claimed family | License | Seconds | LUFS | Peak | Machine | Review |\n| --- | --- | --- | ---: | ---: | ---: | --- | --- |\n${rows.join('\n')}\n\n## Listening decision\n\nFor each candidate confirm: the claimed source is unmistakable; there is no speech or human activity; there are no startling mechanical events; it can remain comfortable at low volume; and it does not sound like water or generic synthetic noise. A semantic pass does not approve production use.\n`);

const headers = ['batch_id', 'candidate_id', 'title', 'family', 'role', 'source_platform', 'source_creator', 'source_url', 'download_url', 'license_name', 'license_url', 'attribution_required', 'local_path', 'source_sha256', 'duration_seconds', 'sample_rate', 'channels', 'integrated_lufs', 'sample_peak_dbfs', 'max_100ms_rms_jump_db', 'machine_status', 'semantic_listening_status', 'no_human_listening_status', 'loop_qa_status', 'promotion_allowed'];
const tsv = [headers.join('\t'), ...results.map((item) => [
  BATCH, item.id, item.title, item.family, item.role, item.sourcePlatform, item.sourceCreator,
  item.sourceUrl, item.downloadUrl, item.licenseName, item.licenseUrl, item.attributionRequired,
  item.localPath, item.sourceSha256, item.sourceAnalysis.durationSeconds, item.sourceAnalysis.sampleRate,
  item.sourceAnalysis.channels, item.sourceAnalysis.integratedLufs, item.sourceAnalysis.samplePeakDbfs,
  item.sourceAnalysis.max100msRmsJumpDb, item.machineStatus, item.semanticListeningStatus,
  item.noHumanListeningStatus, item.loopQaStatus, item.promotionAllowed,
].map(clean).join('\t'))].join('\n');
writeFileSync(resolve(ROOT, `docs/asset-${BATCH}-authentic-indoor-candidates.tsv`), `${tsv}\n`);

console.log(JSON.stringify({
  report: `reports/authentic-indoor-source-review-${DATE}.md`,
  candidateManifest: `docs/asset-${BATCH}-authentic-indoor-candidates.tsv`,
  candidateCount: report.candidateCount,
  machinePassCount: report.machinePassCount,
  promotionAllowed: report.promotionAllowed,
}, null, 2));
