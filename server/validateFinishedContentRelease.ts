import fs from 'node:fs';
import path from 'node:path';
import { pool, query } from './db';

const root = process.cwd();
const release = JSON.parse(fs.readFileSync(path.join(root, 'reports/content-baseline-30-longform-release.json'), 'utf8'));
const fail = (message: string): never => { throw new Error(`Finished content release validation failed: ${message}`); };

if (release.status !== 'ready_to_publish' || release.count !== 30) fail('release manifest is not 30-item ready state');
for (const item of release.items) {
  const file = path.join(root, item.releasePath);
  if (!fs.existsSync(file) || fs.statSync(file).size < 100_000) fail(`${item.id} release file missing or empty`);
  const expected = item.goal === 'sleep' ? 1800 : item.goal === 'calm' ? 1200 : 1500;
  if (Math.abs(item.releaseDurationSeconds - expected) > 1) fail(`${item.id} duration mismatch`);
}

const run = async () => {
  const result = await query<any>(`select id, status, render_status, published_version_id, rendered_audio_url from mixes where id like 'mix_finished_%'`);
  if (result.rows.length !== 30) fail(`database has ${result.rows.length}/30 published finished mixes`);
  if (result.rows.some((row) => row.status !== 'published' || row.render_status !== 'ready' || !row.published_version_id || !row.rendered_audio_url)) {
    fail('one or more finished mixes are not published and rendered');
  }
  const versions = await query<any>(`select count(*)::int as count from mix_recipe_versions where mix_id like 'mix_finished_%'`);
  if (versions.rows[0].count !== 30) fail(`database has ${versions.rows[0].count}/30 frozen recipe versions`);
  const assets = await query<any>(`select count(*)::int as count from audio_stems where id like 'stem_content_baseline_%' and qa_status='approved' and commercial_use_allowed=true and derivative_use_allowed=true`);
  if (assets.rows[0].count !== 30) fail(`database has ${assets.rows[0].count}/30 approved finished content stems`);
  console.log('PASS: 30 long-form masters, 30 approved finished stems, 30 published Discover mixes, and 30 frozen Recipe V2 versions validated.');
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
