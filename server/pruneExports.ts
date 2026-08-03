import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from './db';
import { ExportStorage, getStorageConfig } from './storage';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storage = new ExportStorage(getStorageConfig(process.env, projectRoot));

try {
  const result = await query<{ rendered_audio_url: string }>(
    "select rendered_audio_url from mixes where render_status = 'ready' and rendered_audio_url <> ''",
  );
  const activeUrls = new Set(result.rows.map((row) => row.rendered_audio_url));
  const pruned = await storage.pruneUnreferenced(activeUrls);
  console.log(JSON.stringify({ ...pruned, retentionDays: storage.config.retentionDays, driver: storage.config.driver }, null, 2));
} finally {
  await pool.end();
}
