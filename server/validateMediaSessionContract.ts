import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const audioContext = [
  fs.readFileSync(path.join(root, 'src/context/AudioContext.tsx'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/context/AudioMixerContext.ts'), 'utf8'),
].join('\n');
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');

const requiredAudioContextContracts = [
  'pause: () => void',
  "register('play', play)",
  "register('pause', pause)",
  "register('stop', stopAll)",
  'endMarkerRef',
  'audioContext.suspend()',
  'existingContext.resume()',
  'playbackPosition: number',
  'seekTo: (positionSeconds: number) => void',
];
const requiredPlayerContracts = [
  'prepareNativeAudio({',
  'new MediaMetadata',
  'navigator.mediaSession.playbackState',
  'navigator.mediaSession.setPositionState',
];

const missing = [
  ...requiredAudioContextContracts.filter((value) => !audioContext.includes(value)).map((value) => `AudioProvider: ${value}`),
  ...requiredPlayerContracts.filter((value) => !player.includes(value)).map((value) => `PlayerPage: ${value}`),
];

if (missing.length) throw new Error(`Media session contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  contracts: ['pause-resume', 'media-session-actions', 'lock-screen-metadata', 'position-state', 'session-end-state'],
  remainingDeviceGates: ['background-playback', 'audio-interruption', 'long-session'],
}, null, 2));
