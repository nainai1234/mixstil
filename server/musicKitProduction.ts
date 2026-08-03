import { readFileSync } from 'node:fs';

export type ProductionMusicPart = 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition';
export type ProductionMusicKit = {
  id: string;
  version: string;
  compositionId?: string;
  profileId: string;
  goal: 'sleep' | 'calm' | 'focus';
  form: string;
  durationSeconds: number;
  loopCrossfadeSeconds: number;
  status: 'approved';
  stems: Array<{
    id: string;
    name: string;
    role: ProductionMusicPart;
    audioUrl: string;
    defaultVolume: number;
    durationSeconds: number;
    fileSha256: string;
    sourcePlatform: string;
    sourceUrl: string;
    sourceItemId: string;
    sourceCreator: string;
    licenseName: string;
    licenseUrl: string;
    sourceRecord: string;
  }>;
};

const manifestName = process.env.MUSIC_KIT_PRODUCTION_MANIFEST ?? 'music-kit-production-v1.json';
const payload = JSON.parse(readFileSync(new URL(`../config/${manifestName}`, import.meta.url), 'utf8')) as {
  status: string;
  kits: ProductionMusicKit[];
};

if (payload.status !== 'approved_foundational_music' || payload.kits.length < 6) {
  throw new Error('Production MusicKit manifest is not approved or complete.');
}

export const productionMusicKits = payload.kits;
export const productionMusicKitStems = payload.kits.flatMap((kit) => kit.stems.map((stem) => ({ kit, stem })));
