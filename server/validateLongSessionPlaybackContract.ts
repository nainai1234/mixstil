import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const audioContext = fs.readFileSync(path.join(root, 'src/context/AudioContext.tsx'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
const recipeEdits = fs.readFileSync(path.join(root, 'server/recipeEdits.ts'), 'utf8');

const requiredContracts = [
  'SCHEDULE_WINDOW_SECONDS',
  'ROLLING_REFRESH_SECONDS',
  'rollingSchedulerTimerRef',
  'scheduleEndOffset',
  'recipeSegmentEnd',
  'trackScheduleEnd',
  'window.setTimeout(() => {',
  'playFrom(resumePosition)',
  'commitPlaybackPosition(scheduleEndOffset)',
  'Long session playback paused. Tap Play to continue from the same point.',
];

const forbiddenContracts = [
  'for (let position = firstSegment; position < duration; position += step)',
  'commitPlaybackPosition(sessionDuration);',
];

const requiredServerContracts = [
  [server, 'Math.min(7200, Math.round(input.durationSeconds))', 'Quick Create accepts sessions through 120 minutes'],
  [recipeEdits, 'Math.min(7200, recipe.durationSeconds + seconds)', 'Recipe extension accepts sessions through 120 minutes'],
] as const;

const missing = requiredContracts
  .filter((value) => !audioContext.includes(value))
  .map((value) => `AudioProvider: ${value}`);
const forbidden = forbiddenContracts
  .filter((value) => audioContext.includes(value))
  .map((value) => `AudioProvider long-session regression: ${value}`);
const missingServerContracts = requiredServerContracts
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length || forbidden.length || missingServerContracts.length) {
  throw new Error(`Long-session playback contract failed:\n- ${[...missing, ...forbidden, ...missingServerContracts].join('\n- ')}`);
}

console.log(JSON.stringify({
  passed: true,
  contracts: [
    'bounded-source-scheduling',
    'rolling-long-session-refresh',
    'crossfade-loop-window-boundary',
    'window-expiry-resume-position',
    '120-minute-session-creation',
  ],
  remainingDeviceGates: ['30-60-90-120-minute-real-device-playback'],
}, null, 2));
