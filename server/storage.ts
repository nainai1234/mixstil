import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { incrementMetric, observeMetric } from './observability';

export type StorageConfig = {
  driver: 'local' | 's3';
  localDirectory: string;
  localPublicPath: string;
  bucket: string;
  region: string;
  endpoint?: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
  maxObjectBytes: number;
  maxLocalBytes: number;
  retentionDays: number;
};

export type StoredObject = { key: string; url: string; bytes: number };
export type PruneResult = { scanned: number; deleted: number; reclaimedBytes: number };

const normalizeBase = (value: string) => value.replace(/\/+$/, '');
const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

export const getStorageConfig = (env: NodeJS.ProcessEnv, projectRoot: string): StorageConfig => {
  const driver = env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
  return {
    driver,
    localDirectory: path.resolve(env.STORAGE_LOCAL_DIRECTORY ?? path.join(projectRoot, 'public', 'exports')),
    localPublicPath: normalizeBase(env.STORAGE_LOCAL_PUBLIC_PATH ?? '/exports'),
    bucket: String(env.STORAGE_BUCKET ?? ''),
    region: String(env.STORAGE_REGION ?? ''),
    endpoint: env.STORAGE_ENDPOINT || undefined,
    publicBaseUrl: normalizeBase(env.STORAGE_PUBLIC_BASE_URL ?? ''),
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
    maxObjectBytes: Number(env.EXPORT_MAX_OBJECT_BYTES ?? 300 * 1024 * 1024),
    maxLocalBytes: Number(env.EXPORT_MAX_LOCAL_BYTES ?? 10 * 1024 * 1024 * 1024),
    retentionDays: Number(env.EXPORT_RETENTION_DAYS ?? 30),
  };
};

export const validateStorageConfig = (config: StorageConfig, production: boolean) => {
  const errors: string[] = [];
  if (production && config.driver !== 's3') errors.push('STORAGE_DRIVER must be s3 in production.');
  if (config.driver === 's3') {
    if (!config.bucket) errors.push('STORAGE_BUCKET is required for s3 storage.');
    if (!config.region) errors.push('STORAGE_REGION is required for s3 storage.');
    if (!/^https:\/\//.test(config.publicBaseUrl)) errors.push('STORAGE_PUBLIC_BASE_URL must be an HTTPS CDN or object-storage URL.');
  }
  if (!Number.isFinite(config.maxObjectBytes) || config.maxObjectBytes < 1) errors.push('EXPORT_MAX_OBJECT_BYTES must be positive.');
  if (!Number.isFinite(config.maxLocalBytes) || config.maxLocalBytes < config.maxObjectBytes) errors.push('EXPORT_MAX_LOCAL_BYTES must be at least EXPORT_MAX_OBJECT_BYTES.');
  if (!Number.isFinite(config.retentionDays) || config.retentionDays < 1) errors.push('EXPORT_RETENTION_DAYS must be at least 1.');
  if (errors.length) throw new Error(`Invalid storage configuration:\n- ${errors.join('\n- ')}`);
};

const validateKey = (key: string) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key) || key.includes('..')) throw new Error('Unsafe storage object key.');
};

const directoryBytes = async (directory: string): Promise<number> => {
  if (!existsSync(directory)) return 0;
  const entries = await readdir(directory, { withFileTypes: true });
  const sizes: number[] = await Promise.all(entries.map(async (entry): Promise<number> => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? directoryBytes(target) : (await stat(target)).size;
  }));
  return sizes.reduce((total, size) => total + size, 0);
};

export class ExportStorage {
  private readonly s3: S3Client | null;

  constructor(readonly config: StorageConfig) {
    this.s3 = config.driver === 's3'
      ? new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: config.forcePathStyle })
      : null;
  }

  async putFile(key: string, filePath: string, contentType: string): Promise<StoredObject> {
    validateKey(key);
    const startedAt = process.hrtime.bigint();
    try {
      const file = await stat(filePath);
      if (file.size > this.config.maxObjectBytes) throw new Error(`Storage object exceeds ${this.config.maxObjectBytes} byte limit.`);
      if (this.config.driver === 'local') {
        const usedBytes = await directoryBytes(this.config.localDirectory);
        if (usedBytes + file.size > this.config.maxLocalBytes) throw new Error('Local export storage capacity limit exceeded.');
        const destination = path.join(this.config.localDirectory, key);
        await mkdir(path.dirname(destination), { recursive: true });
        const { copyFile } = await import('node:fs/promises');
        await copyFile(filePath, destination);
        return { key, bytes: file.size, url: `${this.config.localPublicPath}/${encodeKey(key)}` };
      }
      await this.s3!.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: file.size,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { key, bytes: file.size, url: `${this.config.publicBaseUrl}/${encodeKey(key)}` };
    } catch (error) {
      incrementMetric('snooze_storage_failures_total', { operation: 'put', driver: this.config.driver });
      throw error;
    } finally {
      observeMetric('snooze_storage_operation_duration_seconds', Number(process.hrtime.bigint() - startedAt) / 1_000_000_000, { operation: 'put', driver: this.config.driver });
    }
  }

  keyFromUrl(url: string) {
    const base = this.config.driver === 'local' ? this.config.localPublicPath : this.config.publicBaseUrl;
    if (!url.startsWith(`${base}/`)) return null;
    const key = decodeURIComponent(url.slice(base.length + 1));
    validateKey(key);
    return key;
  }

  async deleteUrl(url: string) {
    const key = this.keyFromUrl(url);
    if (!key) return false;
    try {
      if (this.config.driver === 'local') {
        await rm(path.join(this.config.localDirectory, key), { force: true });
      } else {
        await this.s3!.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
      }
      return true;
    } catch (error) {
      incrementMetric('snooze_storage_failures_total', { operation: 'delete', driver: this.config.driver });
      throw error;
    }
  }

  localPathForUrl(url: string) {
    if (this.config.driver !== 'local') return null;
    const key = this.keyFromUrl(url);
    return key ? path.join(this.config.localDirectory, key) : null;
  }

  async pruneUnreferenced(activeUrls: Set<string>, now = Date.now()): Promise<PruneResult> {
    const cutoff = now - this.config.retentionDays * 86_400_000;
    let scanned = 0;
    let deleted = 0;
    let reclaimedBytes = 0;
    if (this.config.driver === 'local') {
      if (!existsSync(this.config.localDirectory)) return { scanned, deleted, reclaimedBytes };
      for (const entry of await readdir(this.config.localDirectory, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        scanned += 1;
        const target = path.join(this.config.localDirectory, entry.name);
        const info = await stat(target);
        const url = `${this.config.localPublicPath}/${encodeKey(entry.name)}`;
        if (!activeUrls.has(url) && info.mtimeMs < cutoff) {
          await rm(target, { force: true });
          deleted += 1;
          reclaimedBytes += info.size;
        }
      }
      return { scanned, deleted, reclaimedBytes };
    }
    let continuationToken: string | undefined;
    do {
      const page = await this.s3!.send(new ListObjectsV2Command({ Bucket: this.config.bucket, ContinuationToken: continuationToken }));
      for (const object of page.Contents ?? []) {
        if (!object.Key) continue;
        scanned += 1;
        const url = `${this.config.publicBaseUrl}/${encodeKey(object.Key)}`;
        if (!activeUrls.has(url) && (object.LastModified?.getTime() ?? now) < cutoff) {
          await this.s3!.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: object.Key }));
          deleted += 1;
          reclaimedBytes += object.Size ?? 0;
        }
      }
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);
    return { scanned, deleted, reclaimedBytes };
  }
}
