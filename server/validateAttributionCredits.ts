import { buildAttributionCredits } from './attributionCredits';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const credits = buildAttributionCredits([
  {
    id: 'stem_cc0',
    name: 'CC0 Bed',
    sourcePlatform: 'Free Music Archive',
    sourceUrl: 'https://example.test/cc0',
    sourceCreator: 'HoliznaCC0',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionRequired: false,
  },
  {
    id: 'stem_cc_by',
    name: 'Meditation Impromptu 02',
    sourcePlatform: 'Incompetech',
    sourceUrl: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100162',
    sourceCreator: 'Kevin MacLeod',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
  },
], ['stem_cc0', 'stem_cc_by']);

if (credits.length !== 1) throw new Error(`Expected one attribution credit, received ${credits.length}.`);
if (credits[0].stemId !== 'stem_cc_by') throw new Error('CC BY stem credit missing.');
if (!credits[0].attributionText.includes('Kevin MacLeod') || !credits[0].licenseUrl.includes('/by/4.0/')) {
  throw new Error('Attribution credit text or license URL is incomplete.');
}
if (!credits[0].adaptationNotice.includes('looping') || !credits[0].adaptationNotice.includes('layering')) {
  throw new Error('Attribution credit must disclose likely adaptation in a MixStil mix.');
}

const manifest = JSON.parse(readFileSync(path.join(root, 'reports/content-release-manifest-2026-07-15.json'), 'utf8'));
if (manifest.status !== 'pass') throw new Error('Content release manifest must pass before validating release credits.');
const releaseCredits = buildAttributionCredits(manifest.items.map((item: any) => ({
  id: item.id,
  name: item.name,
  sourcePlatform: item.source.platform,
  sourceUrl: item.source.url,
  sourceCreator: item.source.creator,
  licenseName: item.license.name,
  licenseUrl: item.license.url,
  attributionRequired: item.license.attributionRequired,
})));
const requiredItems = manifest.items.filter((item: any) => item.license.attributionRequired);
if (requiredItems.length !== 8) throw new Error(`Expected 8 attribution-required release Stems, received ${requiredItems.length}.`);
if (releaseCredits.length !== requiredItems.length) throw new Error(`Expected ${requiredItems.length} release credits, received ${releaseCredits.length}.`);
const releaseCreditIds = new Set(releaseCredits.map((credit) => credit.stemId));
for (const item of requiredItems) {
  if (!releaseCreditIds.has(item.id)) throw new Error(`${item.id} missing from release attribution credits.`);
}
for (const credit of releaseCredits) {
  if (!credit.creator || !credit.sourceUrl || !credit.licenseUrl || !credit.adaptationNotice) {
    throw new Error(`${credit.stemId} release attribution credit is incomplete.`);
  }
}
const publicCredits = JSON.parse(readFileSync(path.join(root, 'public/content/voice-free-beta-attribution-credits.json'), 'utf8'));
if (publicCredits.status !== 'pass' || publicCredits.creditCount !== releaseCredits.length) {
  throw new Error('Public/mobile attribution artifact is missing or out of sync.');
}
if (publicCredits.credits.map((credit: any) => credit.stemId).sort().join(',') !== [...releaseCreditIds].sort().join(',')) {
  throw new Error('Public/mobile attribution artifact contains the wrong release Stem set.');
}

console.log(JSON.stringify({
  attributionCredits: credits.length,
  releaseAttributionCredits: releaseCredits.length,
  publicArtifactCredits: publicCredits.creditCount,
  validated: true,
}, null, 2));
