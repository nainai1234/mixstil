import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CheckResult = {
  id: string;
  command: string;
  status: 'passed' | 'failed';
  durationMs: number;
  summary: string;
};

type ExternalEvidence = {
  id: string;
  status: 'passed' | 'pending' | 'failed';
  evidence: string;
  verifiedAt?: string;
};

const root = process.cwd();
const codeOnly = process.argv.includes('--code-only');
const timestamp = new Date().toISOString();
const reportStamp = timestamp.replace(/[:.]/g, '-');
const reportDirectory = path.join(root, 'reports', 'release-candidate');
const evidenceFile = path.resolve(process.env.RELEASE_EVIDENCE_FILE ?? path.join(root, 'release-evidence.local.json'));
const results: CheckResult[] = [];
let apiProcess: ChildProcess | null = null;

const summarize = (output: string) => output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(-8)
  .join(' | ')
  .slice(0, 1000);

const run = (id: string, command: string, env: NodeJS.ProcessEnv = process.env) => new Promise<CheckResult>((resolve) => {
  const startedAt = Date.now();
  const child = spawn(command, {
    cwd: root,
    env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => { output += String(chunk); });
  child.stderr?.on('data', (chunk) => { output += String(chunk); });
  child.on('close', (code) => resolve({
    id,
    command,
    status: code === 0 ? 'passed' : 'failed',
    durationMs: Date.now() - startedAt,
    summary: summarize(output) || `Exited with status ${code ?? 'unknown'}`,
  }));
});

const reservePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

const waitForApi = async (baseUrl: string) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (apiProcess?.exitCode != null) throw new Error(`Release API exited with status ${apiProcess.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`);
      if (response.ok) return;
    } catch {
      // The isolated API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Release API did not become ready within 30 seconds.');
};

const staticChecks: Array<[string, string]> = [
  ['server-types', 'pnpm typecheck:server'],
  ['lint', 'pnpm lint'],
  ['production-security', 'pnpm validate:production-security'],
  ['production-operations', 'pnpm validate:production-operations'],
  ['content-release-baseline', 'pnpm audit:assets && pnpm report:effective-coverage-v3 && pnpm report:content-release-manifest && pnpm validate:content-release-baseline'],
  ['frozen-work-release-state', 'pnpm validate:frozen-work-release-state'],
  ['backfilled-published-renders', 'pnpm validate:backfilled-published-renders'],
  ['private-content-renders', 'pnpm validate:private-content-renders'],
  ['attribution-credits', 'pnpm report:release-attribution-credits && pnpm validate:attribution-credits'],
  ['audio-credits-page', 'pnpm validate:audio-credits-page'],
  ['share-visibility-ui', 'pnpm validate:share-visibility-ui'],
  ['publication-choice-ui', 'pnpm validate:publication-choice-ui'],
  ['export-attribution-sidecar', 'pnpm validate:export-attribution-sidecar'],
  ['web-build', 'pnpm build'],
  ['mobile-build', 'pnpm mobile:build && pnpm validate:mobile-bundle-assets'],
  ['consumer-routes', 'pnpm validate:consumer-route-contract'],
  ['sprint1-mobile-playback-release-gate', 'pnpm validate:sprint1-mobile-playback-release-gate'],
  ['sprint2-preferences', 'pnpm validate:sprint2-preference-memory'],
  ['sprint3-retention-offline', 'pnpm validate:sprint3-retention-offline'],
  ['sprint4-mobile-contract', 'pnpm validate:sprint4-mobile-readiness'],
  ['native-privacy', 'pnpm validate:native-privacy'],
  ['mobile-store-listing', 'pnpm validate:mobile-store-listing'],
  ['mobile-release-mechanism', 'pnpm validate:mobile-release:mechanism'],
  ['profile-controls', 'pnpm validate:profile-controls'],
];

const apiChecks: Array<[string, string]> = [
  ['mainline-journey', 'pnpm validate:mainline-journey'],
  ['multi-user-isolation', 'pnpm validate:multi-user-isolation'],
  ['playback-metrics', 'pnpm validate:playback-metrics'],
  ['explore-search', 'pnpm validate:explore-search'],
  ['my-sounds-pagination', 'pnpm validate:my-sounds-pagination'],
  ['voice-free-beta', 'pnpm validate:voice-free-beta'],
  ['share-visibility-transition', 'pnpm validate:share-visibility-transition'],
];

const requiredEvidenceIds = [
  'physical_device_playback_matrix',
  'production_https_origin',
  'managed_database_backup_restore',
  'object_storage_cdn',
  'monitoring_alert_delivery',
  'ios_store_signing',
  'android_store_signing',
  'store_listing_assets',
  'privacy_data_safety_forms',
  'production_account_deletion',
] as const;

const loadEvidence = async () => {
  try {
    const payload = JSON.parse(await readFile(evidenceFile, 'utf8')) as { evidence?: ExternalEvidence[] };
    return Array.isArray(payload.evidence) ? payload.evidence : [];
  } catch {
    return [];
  }
};

const stopApi = async () => {
  if (!apiProcess || apiProcess.exitCode != null) return;
  apiProcess.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      apiProcess?.kill('SIGKILL');
      resolve();
    }, 3_000);
    apiProcess?.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
};

try {
  for (const [id, command] of staticChecks) {
    const result = await run(id, command);
    results.push(result);
    console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${id} (${result.durationMs} ms)`);
    if (result.status === 'failed') break;
  }

  if (results.every((result) => result.status === 'passed')) {
    const port = await reservePort();
    const apiBase = `http://127.0.0.1:${port}`;
    const apiEnv = { ...process.env, API_PORT: String(port), AI_RECIPE_PROVIDER: 'rules' };
    apiProcess = spawn('pnpm', ['dev:api'], { cwd: root, env: apiEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    await waitForApi(apiBase);
    for (const [id, command] of apiChecks) {
      const result = await run(id, command, { ...apiEnv, API_BASE: apiBase });
      results.push(result);
      console.log(`${result.status === 'passed' ? 'PASS' : 'FAIL'} ${id} (${result.durationMs} ms)`);
      if (result.status === 'failed') break;
    }
  }
} catch (error) {
  results.push({
    id: 'release-gate-runner',
    command: 'internal',
    status: 'failed',
    durationMs: 0,
    summary: error instanceof Error ? error.message : String(error),
  });
} finally {
  await stopApi();
}

const evidence = await loadEvidence();
const evidenceById = new Map(evidence.map((item) => [item.id, item]));
const externalChecks = requiredEvidenceIds.map((id) => evidenceById.get(id) ?? {
  id,
  status: 'pending' as const,
  evidence: `No evidence supplied in ${path.basename(evidenceFile)}.`,
});
const codePassed = results.length === staticChecks.length + apiChecks.length
  && results.every((result) => result.status === 'passed');
const externalPassed = externalChecks.every((item) => item.status === 'passed' && item.evidence.trim().length > 0);
const verdict = codePassed && (codeOnly || externalPassed) ? 'GO' : 'NO-GO';
const report = {
  generatedAt: timestamp,
  mode: codeOnly ? 'code-only' : 'full-release',
  verdict,
  codePassed,
  externalEvidencePassed: externalPassed,
  codeChecks: results,
  externalChecks,
};

await mkdir(reportDirectory, { recursive: true });
const jsonPath = path.join(reportDirectory, `release-gate-${reportStamp}.json`);
const markdownPath = path.join(reportDirectory, `release-gate-${reportStamp}.md`);
const codeRows = results.map((item) => `| ${item.id} | ${item.status} | ${item.durationMs} | ${item.summary.replace(/\|/g, '\\|')} |`).join('\n');
const evidenceRows = externalChecks.map((item) => `| ${item.id} | ${item.status} | ${item.evidence.replace(/\|/g, '\\|')} |`).join('\n');
const markdown = `# MixStil Release Candidate Gate\n\nGenerated: ${timestamp}  \nMode: ${report.mode}  \nVerdict: **${verdict}**\n\n## Code Checks\n\n| Check | Status | Duration ms | Summary |\n| --- | --- | ---: | --- |\n${codeRows}\n\n## External Evidence\n\n| Gate | Status | Evidence |\n| --- | --- | --- |\n${evidenceRows}\n\n## Decision Rule\n\nCode-only GO proves repository readiness only. Store release requires every external evidence row to be passed with a concrete evidence reference. Sprint 5 is outside this gate.\n`;
await Promise.all([
  writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(markdownPath, markdown, 'utf8'),
]);

console.log(JSON.stringify({ verdict, codePassed, externalPassed, report: path.relative(root, markdownPath) }, null, 2));
if (verdict !== 'GO') process.exitCode = codePassed ? 2 : 1;
