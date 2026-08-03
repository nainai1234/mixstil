import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildAttributionCredits } from './attributionCredits';

const root = path.resolve(import.meta.dirname, '..');
const date = '2026-07-15';

const run = async () => {
  const manifest = JSON.parse(await readFile(path.join(root, `reports/content-release-manifest-${date}.json`), 'utf8'));
  if (manifest.status !== 'pass') throw new Error('Content release manifest must pass before building attribution credits.');

  const stems = manifest.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    sourcePlatform: item.source.platform,
    sourceUrl: item.source.url,
    sourceCreator: item.source.creator,
    licenseName: item.license.name,
    licenseUrl: item.license.url,
    attributionRequired: item.license.attributionRequired,
  }));
  const credits = buildAttributionCredits(stems);
  const requiredItems = manifest.items.filter((item: any) => item.license.attributionRequired);
  const creditIds = new Set(credits.map((credit) => credit.stemId));
  const missing = requiredItems.filter((item: any) => !creditIds.has(item.id)).map((item: any) => item.id);
  const malformed = credits.filter((credit) => !credit.creator || !credit.sourceUrl || !credit.licenseUrl || !credit.adaptationNotice);
  if (missing.length || malformed.length) {
    throw new Error(`Attribution credits incomplete: missing=${missing.join(',')}; malformed=${malformed.map((item) => item.stemId).join(',')}`);
  }

  const byLicense = credits.reduce<Record<string, number>>((counts, credit) => {
    counts[credit.licenseName] = (counts[credit.licenseName] ?? 0) + 1;
    return counts;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    releaseChannel: 'voice-free-beta',
    sourceManifest: `reports/content-release-manifest-${date}.json`,
    status: 'pass',
    requiredAttributionCount: requiredItems.length,
    creditCount: credits.length,
    byLicense,
    credits,
    policy: {
      publicDisplayRequired: 'Share pages, mobile public/about credits, and any exported public work metadata must preserve these credits when the corresponding Stem is active.',
      adaptationNoticeRequired: true,
      nonAttributionLicenses: 'CC0, public-domain, Mixkit, and MixStil internal assets remain in the manifest but do not require public byline display.',
    },
  };
  const markdown = [
    '# Voice-free Beta Release Attribution Credits',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: **${report.status}**`,
    '',
    `- Required attribution Stems: ${report.requiredAttributionCount}`,
    `- Generated credits: ${report.creditCount}`,
    `- Licenses: ${Object.entries(byLicense).map(([license, count]) => `${license} ${count}`).join(', ')}`,
    '',
    '## Credits',
    '',
    '| Stem | Title | Creator | Platform | License | Source |',
    '| --- | --- | --- | --- | --- | --- |',
    ...credits.map((credit) => `| \`${credit.stemId}\` | ${credit.title} | ${credit.creator} | ${credit.sourcePlatform} | [${credit.licenseName}](${credit.licenseUrl}) | [Source](${credit.sourceUrl}) |`),
    '',
    '## Required Adaptation Notice',
    '',
    credits[0]?.adaptationNotice ?? 'None',
    '',
    '## Release Rule',
    '',
    'When any listed Stem is active in a public share page, mobile public/about credits screen, or exported public work metadata, display the credit text, source link, license link, and adaptation notice.',
    '',
  ].join('\n');

  await mkdir(path.join(root, 'public', 'content'), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, `reports/release-attribution-credits-${date}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(path.join(root, `reports/release-attribution-credits-${date}.md`), markdown, 'utf8'),
    writeFile(path.join(root, 'public', 'content', 'voice-free-beta-attribution-credits.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  ]);
  console.log(JSON.stringify({
    status: report.status,
    requiredAttributionCount: report.requiredAttributionCount,
    creditCount: report.creditCount,
    byLicense,
    publicArtifact: 'public/content/voice-free-beta-attribution-credits.json',
  }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
