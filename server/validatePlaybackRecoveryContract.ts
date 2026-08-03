import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const audioContext = [
  fs.readFileSync(path.join(root, 'src/context/AudioContext.tsx'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/context/AudioMixerContext.ts'), 'utf8'),
].join('\n');
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');

const requiredAudioContextContracts = [
  'playbackPosition: number',
  'sessionDuration: number',
  'playFrom: (positionSeconds: number) => void',
  'seekTo: (positionSeconds: number) => void',
  'currentTimelinePosition',
  'playbackTimelineOffsetRef',
  'trackElapsed',
  'sourceOffset',
  'commitPlaybackPosition(currentTimelinePosition())',
];

const requiredPlayerContracts = [
  'playbackStorageKey',
  "searchParams.get('mixId')",
  'window.localStorage.setItem(playbackStorageKey',
  'window.localStorage.getItem(playbackStorageKey)',
  'const seekPlaybackTo = useCallback((positionSeconds: number) => {',
  'const nextPosition = Math.min(Math.max(0, positionSeconds), duration)',
  'type="range"',
  "aria-label={t('player.seekPlayback')}",
  'onChange={(event) => seekPlaybackTo(Number(event.currentTarget.value))}',
  'seekNativeAudio(nextPosition)',
  'nativeAudioRef.current.currentTime = nextPosition',
  'seekTo(nextPosition)',
  'navigator.mediaSession.setPositionState',
];

const forbiddenPlayerContracts = [
  'setProgress((current)',
  'const [progress, setProgress]',
];

const missing = [
  ...requiredAudioContextContracts.filter((value) => !audioContext.includes(value)).map((value) => `AudioProvider: ${value}`),
  ...requiredPlayerContracts.filter((value) => !player.includes(value)).map((value) => `PlayerPage: ${value}`),
];
const forbidden = forbiddenPlayerContracts
  .filter((value) => player.includes(value))
  .map((value) => `PlayerPage still uses local progress simulation: ${value}`);

if (missing.length || forbidden.length) {
  throw new Error(`Playback recovery contract failed:\n- ${[...missing, ...forbidden].join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  contracts: [
    'recipe-position-state',
    'offset-aware-scheduling',
    'draggable-seek-controls-audio-engine',
    'native-seek-position-sync',
    'local-playback-snapshot',
    'media-session-position-from-audio-clock',
  ],
  remainingDeviceGates: ['background-playback', 'audio-interruption', 'long-session'],
}, null, 2));
