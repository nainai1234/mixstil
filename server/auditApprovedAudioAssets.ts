import fs from 'node:fs';
import { pool } from './db';
import { approvedAudioAssetLocation, type ApprovedAudioAssetRow } from './approvedAudioAssetSync';

type AuditRow = ApprovedAudioAssetRow & {
  production_allowed: boolean;
  roles: string[] | null;
  duration_seconds: number | null;
  verified_concepts: number;
};

const root = process.cwd();
const publicBase = String(process.env.STORAGE_PUBLIC_BASE_URL ?? process.env.AUDIO_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');

const isOnline = async (url: string) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${url}?audit=${Date.now()}-${attempt}`, {
        headers: { Range: 'bytes=0-1023', 'Cache-Control': 'no-cache' },
      });
      if ((response.status === 200 || response.status === 206) && String(response.headers.get('content-type')).startsWith('audio/')) return true;
    } catch {
      // Transient CDN or network failures are retried before declaring the object offline.
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  return false;
};

const run = async () => {
  if (!publicBase.startsWith('https://')) throw new Error('STORAGE_PUBLIC_BASE_URL or AUDIO_PUBLIC_BASE_URL is required.');
  const result = await pool.query<AuditRow>(
    `select s.id, s.name, s.category, s.audio_url, s.file_sha256, a.production_allowed,
       m.roles, f.duration_seconds,
       (select count(*)::int from stem_concepts sc where sc.stem_id=s.id and sc.verified=true) verified_concepts
     from audio_stems s
     join audio_assets a on a.id=s.asset_id
     left join stem_metadata_v3 m on m.stem_id=s.id and m.metadata_version=3
     left join stem_acoustic_features f on f.stem_id=s.id
     where s.qa_status='approved' and a.production_allowed=true
     order by s.id`,
  );
  let cursor = 0;
  const online = new Set<string>();
  const worker = async () => {
    while (cursor < result.rows.length) {
      const row = result.rows[cursor++];
      const location = approvedAudioAssetLocation(root, row);
      if (!location) continue;
      if (await isOnline(`${publicBase}/${location.key}`)) online.add(row.id);
    }
  };
  await Promise.all(Array.from({ length: 12 }, () => worker()));

  const missingLocal = result.rows.filter((row) => !approvedAudioAssetLocation(root, row)?.exists).map((row) => row.id);
  const missingOnline = result.rows.filter((row) => !online.has(row.id)).map((row) => row.id);
  const missingMetadata = result.rows.filter((row) => !row.roles?.length).map((row) => row.id);
  const missingAcoustics = result.rows.filter((row) => row.duration_seconds === null).map((row) => row.id);
  const missingConcepts = result.rows.filter((row) => Number(row.verified_concepts) === 0).map((row) => row.id);

  console.log(JSON.stringify({
    approved: result.rowCount,
    local: result.rows.length - missingLocal.length,
    online: online.size,
    metadataV3: result.rows.length - missingMetadata.length,
    acousticFeatures: result.rows.length - missingAcoustics.length,
    verifiedConcepts: result.rows.length - missingConcepts.length,
    missingLocal,
    missingOnline,
    missingMetadataCount: missingMetadata.length,
    missingAcousticsCount: missingAcoustics.length,
    missingConceptsCount: missingConcepts.length,
  }, null, 2));
  if (missingOnline.length) process.exitCode = 1;
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
