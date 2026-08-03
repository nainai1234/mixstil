import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getStorageConfig, validateStorageConfig } from './storage';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const observability = readFileSync(new URL('./observability.ts', import.meta.url), 'utf8');
const storage = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../docs/production-deployment-runbook.md', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

let localProductionError = '';
try {
  validateStorageConfig(getStorageConfig({ STORAGE_DRIVER: 'local' }, projectRoot), true);
} catch (error) {
  localProductionError = error instanceof Error ? error.message : String(error);
}
assert(localProductionError.includes('STORAGE_DRIVER must be s3'), 'Production local storage did not fail closed.');

const productionStorage = getStorageConfig({
  STORAGE_DRIVER: 's3',
  STORAGE_BUCKET: 'snooze-production',
  STORAGE_REGION: 'us-west-2',
  STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com/exports',
  EXPORT_MAX_OBJECT_BYTES: '314572800',
  EXPORT_MAX_LOCAL_BYTES: '10737418240',
  EXPORT_RETENTION_DAYS: '30',
}, projectRoot);
validateStorageConfig(productionStorage, true);

const contracts: Array<[boolean, string]> = [
  [server.includes('new ExportStorage(storageConfig)'), 'API initializes the storage abstraction'],
  [server.includes("app.get('/internal/metrics'"), 'Protected metrics endpoint exists'],
  [server.includes('requestObservability'), 'Request logging and metrics middleware is installed'],
  [server.includes("observeOperation('generation'"), 'Generation timing and failures are measured'],
  [server.includes("observeOperation('render'"), 'Render timing and failures are measured'],
  [server.includes('snooze_playback_events_ingested_total'), 'Playback event ingestion is measured'],
  [observability.includes('request_id') && observability.includes('latency_ms'), 'Structured logs carry request ID and latency'],
  [!observability.includes('authorization:'), 'Structured logger does not serialize authorization headers'],
  [storage.includes('snooze_storage_failures_total'), 'Storage failures are measured'],
  [storage.includes('pruneUnreferenced'), 'Rendered export retention cleanup exists'],
  [packageJson.scripts['storage:prune'] === 'tsx server/pruneExports.ts', 'Export pruning command exists'],
  [envExample.includes('STORAGE_PUBLIC_BASE_URL='), 'Object storage delivery is documented in environment template'],
  [envExample.includes('METRICS_BEARER_TOKEN='), 'Metrics authentication is documented in environment template'],
  [runbook.includes('/internal/metrics'), 'Monitoring integration is documented in the runbook'],
  [runbook.includes('pnpm storage:prune'), 'Retention cleanup is documented in the runbook'],
];

const missing = contracts.filter(([passed]) => !passed).map(([, message]) => message);
if (missing.length) throw new Error(`Production operations validation failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({ passed: true, checks: contracts.map(([, message]) => message) }, null, 2));
