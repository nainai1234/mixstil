import type { Mix } from './domain';
import { resolveServiceUrl } from './api';

export type OfflineTrack = {
  id: number;
  stemId?: string;
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  startTime: number;
  duration: number;
  sourceDuration: number;
  trimStart: number;
  trimEnd: number;
  tags: string[];
  role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
  eventId?: string;
  phaseIds?: string[];
  playbackRate?: number;
  sourceGainDb?: number;
  fade?: { inSeconds: number; outSeconds: number };
  loop?: boolean | { enabled: boolean; crossfadeSeconds: number };
  volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
};

export type OfflineMixPayload = {
  mix: Mix;
  creatorName: string;
  stems: unknown[];
  tracks: OfflineTrack[];
};

export type OfflineMixRecord = {
  mixId: string;
  title: string;
  cachedAt: string;
  recipeVersionId: string;
  durationSeconds: number;
  audioUrls: string[];
  artworkUrl: string;
  payload: OfflineMixPayload;
};

export type PlaybackSnapshot = {
  mixId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
};

const OFFLINE_LIBRARY_KEY = 'snooze:offline:mixes';
const PLAYBACK_PREFIX = 'snooze:playback:';
const OFFLINE_CACHE_NAME = 'snooze-offline-audio-v1';
export const OFFLINE_LIBRARY_CHANGED_EVENT = 'snooze:offline-library-changed';

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
};

const writeLibrary = (records: OfflineMixRecord[]) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(OFFLINE_LIBRARY_KEY, JSON.stringify(records));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_LIBRARY_CHANGED_EVENT));
};

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

const cacheUrl = async (cache: Cache, url: string) => {
  const request = new Request(resolveServiceUrl(url), { credentials: 'same-origin' });
  const cached = await cache.match(request);
  if (cached) return;
  const response = await fetch(request);
  if (!response.ok) throw new Error(`Could not cache ${url} (${response.status})`);
  await cache.put(request, response);
};

const recordUrls = (record: OfflineMixRecord) => unique([...record.audioUrls, record.artworkUrl]);

export const readOfflineLibrary = () => readJson<OfflineMixRecord[]>(OFFLINE_LIBRARY_KEY, []);

export const getOfflineMixRecord = (mixId: string) =>
  readOfflineLibrary().find((record) => record.mixId === mixId) ?? null;

export const getVerifiedOfflineMixRecord = async (mixId: string) => {
  const record = getOfflineMixRecord(mixId);
  if (!record || typeof caches === 'undefined') return null;
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cachedResponses = await Promise.all(recordUrls(record).map((url) => cache.match(resolveServiceUrl(url))));
  return cachedResponses.every(Boolean) ? record : null;
};

export const isMixOffline = (mixId: string) => Boolean(getOfflineMixRecord(mixId));

export const readPlaybackSnapshots = () => {
  if (typeof localStorage === 'undefined') return [] as PlaybackSnapshot[];
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(PLAYBACK_PREFIX))
    .map((key) => readJson<PlaybackSnapshot | null>(key, null))
    .filter((snapshot): snapshot is PlaybackSnapshot => Boolean(snapshot?.mixId && snapshot.updatedAt))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
};

export const saveMixForOffline = async (payload: OfflineMixPayload) => {
  if (typeof caches === 'undefined') {
    throw new Error('Offline storage is not available in this browser.');
  }

  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const mix = payload.mix;
  const audioUrls = unique([
    ...payload.tracks.map((track) => track.url),
    mix.renderedAudioUrl,
  ]);
  if (audioUrls.length === 0) throw new Error('This sound has no audio to save offline.');

  await Promise.all(audioUrls.map((url) => cacheUrl(cache, url)));
  const cachedResponses = await Promise.all(audioUrls.map((url) => cache.match(resolveServiceUrl(url))));
  if (!cachedResponses.every(Boolean)) {
    throw new Error('The offline copy is incomplete. Check your connection and try again.');
  }
  let artworkUrl = '';
  if (mix.coverImageUrl) {
    try {
      await cacheUrl(cache, mix.coverImageUrl);
      artworkUrl = mix.coverImageUrl;
    } catch (error) {
      console.warn('Offline artwork could not be cached:', error);
    }
  }

  const nextRecord: OfflineMixRecord = {
    mixId: mix.id,
    title: mix.title,
    cachedAt: new Date().toISOString(),
    recipeVersionId: mix.publishedVersionId ?? mix.recipeData.versionId ?? 'live',
    durationSeconds: mix.recipeData.durationSeconds,
    audioUrls,
    artworkUrl,
    payload,
  };
  writeLibrary([nextRecord, ...readOfflineLibrary().filter((record) => record.mixId !== mix.id)]);
  return nextRecord;
};

export const removeOfflineMix = async (mixId: string) => {
  const current = readOfflineLibrary();
  const target = current.find((record) => record.mixId === mixId);
  const remaining = current.filter((record) => record.mixId !== mixId);
  writeLibrary(remaining);
  if (!target || typeof caches === 'undefined') return;
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const retainedUrls = new Set(remaining.flatMap(recordUrls));
  const unreferencedUrls = recordUrls(target).filter((url) => !retainedUrls.has(url));
  await Promise.all(unreferencedUrls.map((url) => cache.delete(resolveServiceUrl(url))));
};

export const clearLocalListeningData = async () => {
  if (typeof localStorage !== 'undefined') {
    Object.keys(localStorage)
      .filter((key) => key === OFFLINE_LIBRARY_KEY || key.startsWith(PLAYBACK_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  }
  if (typeof caches !== 'undefined') await caches.delete(OFFLINE_CACHE_NAME);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_LIBRARY_CHANGED_EVENT));
};
