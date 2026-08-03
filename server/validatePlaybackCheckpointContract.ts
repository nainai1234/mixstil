import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'server/schema.ts'), 'utf8');

const requiredContracts = [
  [player, 'PLAYBACK_CHECKPOINT_SECONDS = [300, 1800, 3600, 5400, 7200]', 'Player defines 5/30/60/90/120 minute checkpoints'],
  [player, 'playbackCheckpointRef', 'Player keeps once-only checkpoint state'],
  [player, "recordPlaybackEvent('playback_checkpoint'", 'Player records checkpoint event'],
  [player, 'checkpointSeconds', 'Checkpoint details include checkpointSeconds'],
  [player, 'visibilityState: document.visibilityState', 'Checkpoint details include visibility state'],
  [api, "'playback_checkpoint'", 'API accepts playback checkpoint event'],
  [server, "'playback_checkpoint'", 'Server accepts playback checkpoint event'],
  [server, 'MAX_PLAYBACK_EVENT_ELAPSED_MS = 8 * 60 * 60 * 1000', 'Server accepts the complete long-session checkpoint window'],
  [schema, "'playback_checkpoint'", 'Database constraint accepts playback checkpoint event'],
] as const;

const missing = requiredContracts
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length) throw new Error(`Playback checkpoint contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  contracts: [
    'long-session-checkpoints',
    'playback-event-schema',
    'production-long-session-telemetry',
  ],
  checkpointsSeconds: [300, 1800, 3600, 5400, 7200],
}, null, 2));
