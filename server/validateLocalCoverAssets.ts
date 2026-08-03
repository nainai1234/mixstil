import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';
import { demandCoverAssets, generatedCoverAssets } from './demandCoverAssets';

type CoverRow = {
  source: 'mix' | 'share';
  id: string;
  cover_url: string;
};

const root = process.cwd();
const failures: string[] = [];
const discoverConfig = JSON.parse(fs.readFileSync(path.join(root, 'data', 'discover-feed-config.json'), 'utf8')) as {
  sections: Array<{ id: string; enabled: boolean }>;
};

const publicRoot = path.join(root, 'public');
const checkLocalCover = (coverUrl: string, label: string) => {
  const localPath = path.resolve(publicRoot, coverUrl.replace(/^\/+/, ''));
  if (!localPath.startsWith(`${publicRoot}${path.sep}`)) {
    failures.push(`${label} escapes the public asset directory: ${coverUrl}`);
    return;
  }
  if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
    failures.push(`${label} references a missing or empty cover: ${coverUrl}`);
    return;
  }
  if (path.extname(localPath).toLowerCase() === '.png') {
    const image = fs.readFileSync(localPath);
    const isPng = image.length >= 24 && image.subarray(1, 4).toString('ascii') === 'PNG';
    const width = isPng ? image.readUInt32BE(16) : 0;
    const height = isPng ? image.readUInt32BE(20) : 0;
    if (!isPng || width !== 1024 || height !== 1024) {
      failures.push(`${label} must be a valid 1024x1024 PNG: ${coverUrl}`);
    }
  }
};

const result = await query<CoverRow>(`
  select 'mix'::text as source, id, cover_image_url as cover_url
  from mixes
  where cover_image_url <> ''
  union all
  select 'share'::text as source, id, cover_snapshot as cover_url
  from share_links
  where cover_snapshot <> ''
`);

for (const row of result.rows) {
  if (/^https?:\/\//i.test(row.cover_url)) {
    failures.push(`${row.source} ${row.id} uses an external cover: ${row.cover_url}`);
    continue;
  }
  if (!row.cover_url.startsWith('/')) {
    failures.push(`${row.source} ${row.id} has a non-root-relative cover: ${row.cover_url}`);
    continue;
  }
  checkLocalCover(row.cover_url, `${row.source} ${row.id}`);
}

const enabledDemandIds = discoverConfig.sections.filter((section) => section.enabled).map((section) => section.id);
const enabledDemandCovers: string[] = [];
for (const demandTypeId of enabledDemandIds) {
  const coverUrl = demandCoverAssets[demandTypeId as keyof typeof demandCoverAssets];
  if (!coverUrl) {
    failures.push(`enabled demand type has no local cover mapping: ${demandTypeId}`);
    continue;
  }
  enabledDemandCovers.push(coverUrl);
  checkLocalCover(coverUrl, `demand type ${demandTypeId}`);
}

if (new Set(enabledDemandCovers).size !== enabledDemandIds.length) {
  failures.push('enabled demand types must use distinct cover assets');
}

for (const coverUrl of generatedCoverAssets) checkLocalCover(coverUrl, 'required generated cover');

await pool.end();

if (failures.length) {
  throw new Error(`Local cover asset contract failed:\n- ${failures.join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  checkedReferences: result.rows.length,
  enabledDemandTypes: enabledDemandIds.length,
  mappedDemandTypes: Object.keys(demandCoverAssets).length,
  uniqueDemandCovers: new Set(enabledDemandCovers).size,
  requiredGeneratedCovers: generatedCoverAssets.length,
  externalCoverCount: 0,
}, null, 2));
