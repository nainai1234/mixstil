import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const DATE = '2026-07-14';
const outputDir = resolve(ROOT, `public/audio/authentic-scene-review/${DATE}`);
const python = resolve(ROOT, '.venv-audio/bin/python');
const analyzer = resolve(ROOT, 'scripts/analyze-music-candidate.py');
const candidates = [
  {
    id: 'authentic_open_wind', title: 'Open Wind Ambience', family: 'wind',
    input: 'public/audio/nature/batch-02/wind_blowing.wav', gainDb: -11,
    sourcePlatform: 'Mixkit', sourceUrl: 'https://mixkit.co/free-sound-effects/wind/', licenseStatus: 'mixkit_license_recorded',
  },
  {
    id: 'authentic_pine_forest_wind', title: 'Wind in Pine Forest', family: 'wind_forest',
    input: 'public/audio/candidates/batch-06/product-fit/b06pf_commons_wind_forest_018.ogg', gainDb: -7.5,
    sourcePlatform: 'Wikimedia Commons', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wind_in_sparren_in_het_Vijlenerbos_-_SoundCloud_-_luc_de_bruijn.ogg', licenseStatus: 'cc_by_3_0_confirmed_attribution_required',
    licenseName: 'Creative Commons Attribution 3.0 Unported', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', sourceCreator: 'luc de bruijn', attributionRequired: true,
  },
  {
    id: 'authentic_campfire_night', title: 'Campfire with Night Wind', family: 'fire',
    input: 'public/audio/nature/batch-04/campfire_night_wind.wav', gainDb: -8.5,
    sourcePlatform: 'Mixkit', sourceUrl: 'https://mixkit.co/free-sound-effects/fire/', licenseStatus: 'mixkit_license_recorded',
  },
  {
    id: 'authentic_european_forest', title: 'European Forest Ambience', family: 'forest',
    input: 'public/audio/nature/batch-02/european_forest.wav', gainDb: 0,
    sourcePlatform: 'Mixkit', sourceUrl: 'https://mixkit.co/free-sound-effects/forest/', licenseStatus: 'mixkit_license_recorded',
  },
  {
    id: 'authentic_night_forest_insects', title: 'Night Forest Insects', family: 'night_insects',
    input: 'public/audio/nature/batch-04/night_forest_insects.wav', gainDb: -10,
    sourcePlatform: 'Mixkit', sourceUrl: 'https://mixkit.co/free-sound-effects/forest/', licenseStatus: 'mixkit_license_recorded',
  },
  {
    id: 'authentic_crickets_at_night', title: 'Crickets at Night', family: 'crickets',
    input: 'public/audio/nature/batch-04/crickets_at_night.wav', gainDb: -2.5,
    sourcePlatform: 'Mixkit', sourceUrl: 'https://mixkit.co/free-sound-effects/crickets/', licenseStatus: 'mixkit_license_recorded',
  },
];

mkdirSync(outputDir, { recursive: true });
const run = (command, args, capture = false) => {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`${basename(command)} failed: ${result.stderr || result.stdout || result.error}`);
  return result.stdout ?? '';
};
const sha256 = (file) => createHash('sha256').update(readFileSync(resolve(ROOT, file))).digest('hex');

const results = candidates.map((candidate) => {
  const output = resolve(outputDir, `${candidate.id}.mp3`);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', resolve(ROOT, candidate.input),
    '-af', `volume=${candidate.gainDb}dB`, '-ar', '48000', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '256k', output,
  ]);
  const analysis = JSON.parse(run(python, [analyzer, output], true));
  const failures = [
    ...(analysis.sampleRate !== 48000 ? ['sample_rate'] : []),
    ...(analysis.channels !== 2 ? ['channels'] : []),
    ...(analysis.samplePeakDbfs > -6 ? ['peak'] : []),
    ...(analysis.clippedSampleCount > 0 ? ['clipping'] : []),
  ];
  return {
    ...candidate,
    sourceSha256: sha256(candidate.input),
    processing: `single linear gain ${candidate.gainDb} dB; one MP3 encode; no added noise, music, EQ, compression, or effects`,
    output: `/audio/authentic-scene-review/${DATE}/${candidate.id}.mp3`,
    analysis,
    machineStatus: failures.length ? 'fail' : 'pass',
    failures,
    semanticListeningStatus: 'pending',
    promotionAllowed: false,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  purpose: 'source_identity_review',
  machinePassCount: results.filter((item) => item.machineStatus === 'pass').length,
  promotionAllowed: false,
  remainingGates: ['semantic_identity_listening', 'scene_fit', 'loop_fatigue', 'license_confirmation'],
  results,
};
writeFileSync(resolve(ROOT, `reports/authentic-scene-source-review-${DATE}.json`), `${JSON.stringify(report, null, 2)}\n`);
const rows = results.map((item) => `| ${item.title} | ${item.family} | ${item.sourcePlatform} | ${item.analysis.integratedLufs} | ${item.analysis.samplePeakDbfs} | ${item.machineStatus} | [试听](http://localhost:5174${item.output}) |`);
writeFileSync(resolve(ROOT, `reports/authentic-scene-source-review-${DATE}.md`), `# Authentic Scene Source Review\n\nDate: ${DATE}  \nPurpose: verify what each source actually sounds like before any Recipe combination.  \nProcessing: source-only linear gain and one MP3 encode. No noise bed, music, EQ, compression, or effects were added.\n\n| Candidate | Claimed family | Source | LUFS | Peak | Machine | Review |\n| --- | --- | --- | ---: | ---: | --- | --- |\n${rows.join('\n')}\n\n## Decision rule\n\nApprove semantic identity only when the recording clearly sounds like its claimed source. Reject ambiguous broadband whoosh, mislabeled water-like sound, people, speech, distracting events, or unsafe transients. Semantic pass still does not grant production approval.\n`);
console.log(JSON.stringify({ report: `reports/authentic-scene-source-review-${DATE}.md`, machinePassCount: report.machinePassCount, candidateCount: results.length }, null, 2));
