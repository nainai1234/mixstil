import fs from 'node:fs';
import path from 'node:path';

export type ApprovedAudioAssetRow = {
  id: string;
  name: string;
  category: string;
  audio_url: string;
  file_sha256: string;
};

export const approvedAudioAssetLocation = (root: string, row: ApprovedAudioAssetRow) => {
  if (!row.audio_url.startsWith('/audio/')) return null;
  const key = row.audio_url.replace(/^\/+/, '');
  return {
    key,
    filePath: path.join(root, 'public', key),
    exists: fs.existsSync(path.join(root, 'public', key)),
  };
};

export const audioContentType = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.ogg') return 'audio/ogg';
  if (extension === '.m4a' || extension === '.mp4') return 'audio/mp4';
  return 'audio/mpeg';
};
