import fs from 'node:fs';
import path from 'node:path';
import { buildWorkAttributionSidecar, formatWorkAttributionSidecarText } from './workAttributionSidecar';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const stems = [
  {
    id: 'stem_required',
    name: 'Meditation Impromptu 02',
    sourcePlatform: 'Incompetech',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100162',
    sourceCreator: 'Kevin MacLeod',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
  },
  {
    id: 'stem_muted',
    name: 'Muted Required Source',
    sourcePlatform: 'Example',
    sourceUrl: 'https://example.test/muted',
    sourceCreator: 'Muted Creator',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
  },
  {
    id: 'stem_zero',
    name: 'Zero Volume Required Source',
    sourcePlatform: 'Example',
    sourceUrl: 'https://example.test/zero',
    sourceCreator: 'Zero Creator',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
  },
  {
    id: 'stem_cc0',
    name: 'Public Domain Bed',
    sourcePlatform: 'Example',
    sourceUrl: 'https://example.test/cc0',
    sourceCreator: 'Archive',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
  },
];

const sidecar = buildWorkAttributionSidecar({
  mixId: 'mix_sidecar_validation',
  title: 'Validated Soundscape',
  recipeVersionId: 'recipev_frozen',
  generatedAt: '2026-07-15T00:00:00.000Z',
  recipe: {
    schemaVersion: 2,
    tracks: [
      { stemId: 'stem_required', role: 'music', volume: 30, isMuted: false, startTime: 0, duration: 60, trimStart: 0, trimEnd: 60 },
      { stemId: 'stem_muted', role: 'music', volume: 30, isMuted: true, startTime: 0, duration: 60, trimStart: 0, trimEnd: 60 },
      { stemId: 'stem_zero', role: 'music', volume: 0, isMuted: false, startTime: 0, duration: 60, trimStart: 0, trimEnd: 60 },
      { stemId: 'stem_cc0', role: 'environment', volume: 50, isMuted: false, startTime: 0, duration: 60, trimStart: 0, trimEnd: 60 },
    ],
  },
  stems,
});

if (sidecar.recipeVersionId !== 'recipev_frozen') throw new Error('Sidecar must identify the frozen Recipe version.');
if (sidecar.credits.length !== 1 || sidecar.credits[0].stemId !== 'stem_required') {
  throw new Error('Sidecar must include only audible attribution-required Stems.');
}
if (sidecar.activeStemIds.includes('stem_muted') || sidecar.activeStemIds.includes('stem_zero')) {
  throw new Error('Muted and zero-volume Stems must be excluded from the sidecar.');
}
const text = formatWorkAttributionSidecarText(sidecar, 'https://snooze.example');
for (const required of ['Kevin MacLeod', 'CC BY 4.0', stems[0].sourceUrl, stems[0].licenseUrl, 'looping', 'https://snooze.example/audio-credits']) {
  if (!text.includes(required)) throw new Error(`Text sidecar is missing ${required}.`);
}

const empty = buildWorkAttributionSidecar({
  mixId: 'mix_no_byline',
  title: 'No Public Byline Required',
  recipe: {
    schemaVersion: 2,
    tracks: [
      { stemId: 'stem_cc0', role: 'environment', volume: 50, isMuted: false, startTime: 0, duration: 60, trimStart: 0, trimEnd: 60 },
    ],
  },
  stems,
});
if (empty.attributionRequired || empty.credits.length !== 0 || !empty.attributionSummary.includes('No source')) {
  throw new Error('A no-attribution work must still receive a truthful non-empty sidecar.');
}

const server = read('server/index.ts');
const api = read('src/lib/api.ts');
const publicWork = read('src/pages/PublicWorkPage.tsx');
const shareTools = read('src/pages/ShareTools.tsx');
const requiredSourceChecks: Array<[string, string, string]> = [
  [server, "app.get('/api/mixes/:id/credits.json'", 'JSON credits route'],
  [server, "app.get('/api/mixes/:id/credits.txt'", 'text credits route'],
  [server, 'await getPublishedRecipe(mix)', 'frozen Recipe lookup'],
  [server, 'requireDownloadableMix(req, res)', 'download authorization reuse'],
  [api, 'getCreditsJsonDownloadUrl', 'JSON client URL helper'],
  [api, 'getCreditsTextDownloadUrl', 'text client URL helper'],
  [publicWork, 'getCreditsTextDownloadUrl(work.id)', 'public work credits action'],
  [shareTools, 'Download the attribution matched to the frozen soundscape', 'share tools credits action'],
];
for (const [source, needle, label] of requiredSourceChecks) {
  if (!source.includes(needle)) throw new Error(`${label} is missing.`);
}

console.log(JSON.stringify({
  passed: true,
  requiredCredits: sidecar.credits.length,
  mutedAndZeroExcluded: true,
  truthfulEmptySidecar: true,
  formats: ['json', 'txt'],
}, null, 2));
