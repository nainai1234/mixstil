import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';
import { ExportStorage, getStorageConfig, validateStorageConfig } from './storage';

type ReleaseItem = {
  id: string;
  releasePath: string;
  releaseSha256: string;
};

const root = process.cwd();
const release = JSON.parse(fs.readFileSync(path.join(root, 'reports/content-baseline-30-longform-release.json'), 'utf8')) as {
  status: string;
  items: ReleaseItem[];
};

const uploadWithRetry = async (storage: ExportStorage, key: string, filePath: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await storage.putFile(key, filePath, 'audio/mpeg');
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
};

const run = async () => {
  if (release.status !== 'ready_to_publish' || release.items.length !== 30) {
    throw new Error('Long-form release manifest is incomplete.');
  }
  const config = getStorageConfig(process.env, root);
  validateStorageConfig(config, true);
  const storage = new ExportStorage(config);
  const uploaded = new Map<string, string>();

  for (let offset = 0; offset < release.items.length; offset += 4) {
    const batch = release.items.slice(offset, offset + 4);
    const results = await Promise.all(batch.map(async (item) => {
      const filePath = path.join(root, item.releasePath);
      if (!fs.existsSync(filePath)) throw new Error(`Missing long-form master: ${item.releasePath}`);
      const key = `finished-content/v1/${path.basename(item.releasePath)}`;
      const bytes = fs.statSync(filePath).size;
      const url = `${config.publicBaseUrl}/${key}`;
      const stored = await storage.hasObject(key, bytes)
        ? { key, bytes, url }
        : await uploadWithRetry(storage, key, filePath);
      const response = await fetch(stored.url, { headers: { Range: 'bytes=0-1023' } });
      if (response.status !== 200 && response.status !== 206) {
        throw new Error(`Public master verification failed (${response.status}): ${stored.url}`);
      }
      return { id: item.id, url: stored.url, bytes: stored.bytes };
    }));
    for (const result of results) uploaded.set(result.id, result.url);
    console.log(`Uploaded and verified ${Math.min(offset + batch.length, release.items.length)}/${release.items.length} long-form masters.`);
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const item of release.items) {
      const url = uploaded.get(item.id);
      if (!url) throw new Error(`Uploaded URL missing for ${item.id}`);
      const result = await client.query(
        `update mixes set rendered_audio_url=$2, rendered_at=now(), render_status='ready',
           render_error='', updated_at=now()
         where id=$1 and status='published' and published_version_id is not null
         returning id`,
        [`mix_finished_${item.id}`, url],
      );
      if (result.rowCount !== 1) throw new Error(`Published mix is missing for ${item.id}`);
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }

  console.log('PASS: 30 long-form masters are public in R2 and their published mixes now reference verified URLs.');
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
