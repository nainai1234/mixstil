import { readFileSync } from 'node:fs';
import { getRuntimeConfig } from './runtimeSecurity';

const server = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const runbook = readFileSync(new URL('../docs/production-deployment-runbook.md', import.meta.url), 'utf8');

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const expectInvalid = (env: NodeJS.ProcessEnv, expected: string) => {
  let message = '';
  try {
    getRuntimeConfig(env);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message.includes(expected), `Expected configuration error containing "${expected}", received "${message || 'no error'}".`);
};

const monitoringEnv = {
  MONITORING_LIVE_URL: 'https://api.snooze.example/api/health/live',
  MONITORING_READY_URL: 'https://api.snooze.example/api/health/ready',
  MONITORING_METRICS_URL: 'https://api.snooze.example/internal/metrics',
};

expectInvalid({ NODE_ENV: 'production' }, 'DATABASE_URL');
expectInvalid({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://snooze:snooze@localhost:5432/snooze',
  SHARE_CREATOR_PREVIEW_SECRET: 'a'.repeat(48),
  CORS_ALLOWED_ORIGINS: 'https://app.snooze.example',
  METRICS_BEARER_TOKEN: 'm'.repeat(48),
  ...monitoringEnv,
}, 'DATABASE_URL');
expectInvalid({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://managed.example/snooze',
  SHARE_CREATOR_PREVIEW_SECRET: 'short',
  CORS_ALLOWED_ORIGINS: 'https://app.snooze.example',
  METRICS_BEARER_TOKEN: 'm'.repeat(48),
  ...monitoringEnv,
}, 'SHARE_CREATOR_PREVIEW_SECRET');
expectInvalid({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://managed.example/snooze',
  SHARE_CREATOR_PREVIEW_SECRET: 'a'.repeat(48),
  METRICS_BEARER_TOKEN: 'm'.repeat(48),
  ...monitoringEnv,
}, 'CORS_ALLOWED_ORIGINS');

const valid = getRuntimeConfig({
  NODE_ENV: 'production',
  API_PORT: '8788',
  DATABASE_URL: 'postgres://managed.example/snooze',
  SHARE_CREATOR_PREVIEW_SECRET: 'production-secret-value-that-is-long-and-unique',
  CORS_ALLOWED_ORIGINS: 'https://app.snooze.example,capacitor://localhost',
  TRUST_PROXY: '1',
  METRICS_BEARER_TOKEN: 'production-metrics-token-that-is-long-and-unique',
  ...monitoringEnv,
});
assert(valid.production, 'Valid production configuration did not enable production mode.');
assert(valid.corsAllowedOrigins.size === 2, 'Production CORS origins were not parsed.');
assert(valid.trustProxy === 1, 'Production proxy trust was not parsed.');
assert(valid.monitoringUrls.metrics.endsWith('/internal/metrics'), 'Production monitoring targets were not parsed.');

const corsOptions = (await import('./runtimeSecurity')).createCorsOptions(valid);
const checkOrigin = (origin: string) => new Promise<boolean>((resolve, reject) => {
  corsOptions.origin(origin, (error, allowed) => error ? reject(error) : resolve(Boolean(allowed)));
});
assert(await checkOrigin('capacitor://localhost'), 'Production CORS must always allow the fixed iOS app origin.');
assert(await checkOrigin('http://localhost'), 'Production CORS must always allow the fixed Android app origin.');

const contracts: Array<[boolean, string]> = [
  [server.includes("app.disable('x-powered-by')"), 'Express identity header is disabled'],
  [server.includes('securityHeaders'), 'Security headers are installed'],
  [server.includes('createRateLimiter'), 'Rate limiting is installed'],
  [readFileSync(new URL('./runtimeSecurity.ts', import.meta.url), 'utf8').includes("'X-SNOOZE-Internal-QA'"), 'Internal QA request header is explicitly allowed by CORS'],
  [server.includes("app.get('/api/health/ready'"), 'Database readiness endpoint exists'],
  [server.includes("app.get('/api/health/live'"), 'Liveness endpoint exists'],
  [server.includes("runtimeConfig.production ? 'Internal server error'"), 'Production errors are redacted'],
  [server.includes("runtimeConfig.production\n  ? query('select 1')"), 'Production startup does not mutate or seed the database'],
  [server.includes("if (!runtimeConfig.production) await syncDiscoverPlacements(await loadDiscoverConfig())"), 'Production startup does not mutate Discover placements'],
  [packageJson.scripts['db:bootstrap'] === 'tsx server/bootstrapDatabase.ts', 'Database bootstrap is explicit'],
  [Boolean(packageJson.scripts['db:backup']), 'Database backup command exists'],
  [Boolean(packageJson.scripts['db:restore']), 'Database restore command exists'],
  [envExample.includes('CORS_ALLOWED_ORIGINS='), 'Environment template documents CORS origins'],
  [envExample.includes('SHARE_CREATOR_PREVIEW_SECRET='), 'Environment template documents the share secret'],
  [envExample.includes('METRICS_BEARER_TOKEN='), 'Environment template documents metrics authentication'],
  [envExample.includes('MONITORING_READY_URL='), 'Environment template documents external monitoring targets'],
  [runbook.includes('pnpm db:bootstrap'), 'Deployment runbook includes explicit database bootstrap'],
  [runbook.includes('pnpm db:backup'), 'Deployment runbook includes backup verification'],
];

const missing = contracts.filter(([passed]) => !passed).map(([, message]) => message);
if (missing.length) throw new Error(`Production security validation failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  checks: contracts.map(([, message]) => message),
}, null, 2));
