import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { pool } from './db';
import { approvedAudioAssetLocation, audioContentType, type ApprovedAudioAssetRow } from './approvedAudioAssetSync';
import { ExportStorage, getStorageConfig, validateStorageConfig } from './storage';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const concurrency = Math.max(1, Math.min(8, Number(process.env.AUDIO_UPLOAD_CONCURRENCY ?? 4)));
const onlyStemId = process.env.AUDIO_UPLOAD_STEM_ID?.trim();
const execFileAsync = promisify(execFile);

const uploadWithRetry = async (storage: ExportStorage, key: string, filePath: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await storage.putFile(key, filePath, audioContentType(filePath));
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
};

const uploadWithCurl = async (config: ReturnType<typeof getStorageConfig>, key: string, filePath: string) => {
  const contentType = audioContentType(filePath);
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const signedUrl = await getSignedUrl(client, new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }), { expiresIn: 3_600 });
  await execFileAsync('/usr/bin/curl', [
    '--fail', '--silent', '--show-error', '--retry', '3', '--retry-all-errors',
    '--connect-timeout', '20', '--max-time', '900', '--speed-limit', '1024', '--speed-time', '30',
    '--http1.1', '--request', 'PUT', '--header', 'Expect:',
    '--header', `Content-Type: ${contentType}`,
    '--header', 'Cache-Control: public, max-age=31536000, immutable',
    '--upload-file', filePath,
    signedUrl,
  ], { maxBuffer: 1024 * 1024 });
  return { key, bytes: fs.statSync(filePath).size, url: `${config.publicBaseUrl}/${key}` };
};

const run = async () => {
  const result = await pool.query<ApprovedAudioAssetRow>(
    `select s.id, s.name, s.category, s.audio_url, s.file_sha256
     from audio_stems s
     join audio_assets a on a.id=s.asset_id
     where s.qa_status='approved' and a.production_allowed=true
     order by s.id`,
  );
  const selectedRows = onlyStemId ? result.rows.filter((row) => row.id === onlyStemId) : result.rows;
  if (onlyStemId && selectedRows.length !== 1) throw new Error(`Approved Stem not found: ${onlyStemId}`);
  const local = selectedRows.map((row) => ({ row, location: approvedAudioAssetLocation(root, row) }));
  const uploadable = local.filter((item) => item.location?.exists) as Array<{
    row: ApprovedAudioAssetRow;
    location: NonNullable<ReturnType<typeof approvedAudioAssetLocation>>;
  }>;
  const missing = local.filter((item) => !item.location?.exists).map((item) => item.row.id);
  const bytes = uploadable.reduce((total, item) => total + fs.statSync(item.location.filePath).size, 0);

  console.log(JSON.stringify({
    dryRun,
    approved: result.rowCount,
    selected: selectedRows.length,
    uploadable: uploadable.length,
    missing: missing.length,
    bytes,
    missingIds: missing,
  }, null, 2));
  if (dryRun) return;

  const config = getStorageConfig(process.env, root);
  validateStorageConfig(config, true);
  const storage = new ExportStorage(config);
  let cursor = 0;
  let uploaded = 0;
  let skipped = 0;

  const worker = async () => {
    while (cursor < uploadable.length) {
      const item = uploadable[cursor++];
      const size = fs.statSync(item.location.filePath).size;
      if (await storage.hasObject(item.location.key, size)) {
        skipped += 1;
      } else {
        if (config.driver === 's3') await uploadWithCurl(config, item.location.key, item.location.filePath);
        else await uploadWithRetry(storage, item.location.key, item.location.filePath);
        uploaded += 1;
      }
      const publicUrl = `${config.publicBaseUrl}/${item.location.key}`;
      const response = await fetch(publicUrl, { headers: { Range: 'bytes=0-1023' } });
      if (response.status !== 200 && response.status !== 206) {
        throw new Error(`Public verification failed (${response.status}) for ${item.row.id}: ${publicUrl}`);
      }
      const completed = uploaded + skipped;
      if (completed % 20 === 0 || completed === uploadable.length) {
        console.log(`Uploaded or verified ${completed}/${uploadable.length} approved audio assets.`);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`PASS: ${uploaded} uploaded, ${skipped} already present, ${missing.length} missing locally.`);
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
