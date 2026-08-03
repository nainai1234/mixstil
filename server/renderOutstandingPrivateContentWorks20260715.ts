import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'outstanding-private-content-renders-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'outstanding-private-content-renders-2026-07-15.md');
const uid = (prefix: string) => `${prefix}_${randomBytes(6).toString('hex')}`;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const sessions = new Map<string, { id: string; token: string }>();
const results: any[] = [];

try {
  const mixes = await query<any>(
    `select id, title, creator_id, render_status, published_version_id
     from mixes
     where status = 'private'
       and recipe_data->'quickCreate' is not null
       and render_status <> 'ready'
     order by updated_at, id`,
  );
  for (const mix of mixes.rows) {
    let session = sessions.get(mix.creator_id);
    if (!session) {
      session = { id: uid('session_private_content_render'), token: randomBytes(32).toString('hex') };
      await query(
        `insert into auth_sessions (id, token_hash, user_id, expires_at)
         values ($1, $2, $3, now() + interval '2 hours')`,
        [session.id, hashToken(session.token), mix.creator_id],
      );
      sessions.set(mix.creator_id, session);
    }
    try {
      const response = await fetch(`${API_BASE}/api/mixes/${mix.id}/render`, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
        body: '{}',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
      results.push({
        mixId: mix.id,
        title: mix.title,
        previousRenderStatus: mix.render_status,
        resultingRenderStatus: body.mix?.renderStatus,
        frozenVersionId: mix.published_version_id,
        renderedAudioUrl: body.renderedAudioUrl,
        bytes: body.bytes,
        qaReport: body.qaReport,
      });
    } catch (error) {
      results.push({
        mixId: mix.id,
        title: mix.title,
        previousRenderStatus: mix.render_status,
        resultingRenderStatus: 'failed',
        frozenVersionId: mix.published_version_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
} finally {
  for (const session of sessions.values()) await query('delete from auth_sessions where id = $1', [session.id]);
  await pool.end();
}

const failed = results.filter((item) => item.resultingRenderStatus !== 'ready' || !item.qaReport?.passed);
const report = {
  generatedAt: new Date().toISOString(),
  selectionRule: "status = private and quickCreate exists and render_status != ready",
  excludedInternalFixtures: ['Internal Render Smoke', 'Mixkit Export Smoke'],
  targetCount: results.length,
  passedCount: results.length - failed.length,
  failedCount: failed.length,
  items: results,
};
await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Outstanding Private Content Renders',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Selection: ${report.selectionRule}`,
  `- Internal fixtures excluded: ${report.excludedInternalFixtures.join(', ')}`,
  `- Targets: ${report.targetCount}`,
  `- Rendered with passing QA: ${report.passedCount}`,
  `- Failed: ${report.failedCount}`,
  '',
  '| Work | Frozen version | Result | QA |',
  '| --- | --- | --- | --- |',
  ...results.map((item) => `| ${item.title} (\`${item.mixId}\`) | \`${item.frozenVersionId}\` | ${item.resultingRenderStatus} | ${item.qaReport?.passed ? `passed; ${item.qaReport.abnormalSilenceCount} abnormal silences` : item.error ?? 'failed'} |`),
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exitCode = 1;
