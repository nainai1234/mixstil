import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const audioContext = fs.readFileSync(path.join(root, 'src/context/AudioContext.tsx'), 'utf8');
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');

const requiredAudioContextContracts = [
  'intentionalPauseRef',
  'interruptedPlaybackRef',
  "audioContext.state === 'suspended'",
  "document.visibilityState === 'hidden'",
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('focus'",
  "window.addEventListener('pagehide'",
  "setPlaybackError('Playback was interrupted. Tap Play to resume.')",
  'commitPlaybackPosition(currentTimelinePosition())',
  'audioContext.resume()',
];

const requiredPlayerContracts = [
  "register('seekto'",
  "register('seekbackward'",
  "register('seekforward'",
  'details.seekTime',
  'details.seekOffset',
  'seekTo(progress - offset)',
  'seekTo(progress + offset)',
];

const missing = [
  ...requiredAudioContextContracts.filter((value) => !audioContext.includes(value)).map((value) => `AudioProvider: ${value}`),
  ...requiredPlayerContracts.filter((value) => !player.includes(value)).map((value) => `PlayerPage: ${value}`),
];

if (missing.length) throw new Error(`Playback interruption contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  contracts: [
    'intentional-pause-vs-system-interruption',
    'interruption-position-commit',
    'foreground-safe-resume-attempt',
    'media-session-seek-controls',
  ],
  remainingDeviceGates: ['background-playback', 'real-device-audio-interruption', 'long-session'],
}, null, 2));
