import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const REPORTS_DIR = path.resolve('reports');
const BATCH_ID = process.env.DEMAND_PRODUCTION_BATCH_ID ?? `demand-plus-variants-${new Date().toISOString().slice(0, 10)}`;
const BATCH_REPORT = path.join(REPORTS_DIR, `${BATCH_ID}.json`);
const RENDER_REPORT_JSON = path.join(REPORTS_DIR, `${BATCH_ID}-renders.json`);
const RENDER_REPORT_MD = path.join(REPORTS_DIR, `${BATCH_ID}-renders.md`);

const uid = (prefix: string) => `${prefix}_${randomBytes(6).toString('hex')}`;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const loadTargetIds = async () => {
  const report = JSON.parse(await readFile(BATCH_REPORT, 'utf8'));
  return (report.created ?? []).map((item: any) => String(item.mixId)).filter(Boolean);
};

const run = async () => {
  const targetIds = await loadTargetIds();
  if (targetIds.length === 0) throw new Error(`No created mixes found in ${BATCH_REPORT}`);
  const mixes = await query<any>(
    `select id, title, creator_id, render_status, published_version_id
     from mixes
     where id = any($1::text[])
       and status = 'private'
       and render_status <> 'ready'
       and recipe_data #>> '{audit,demandProductionBatch,batchId}' = $2
     order by id`,
    [targetIds, BATCH_ID],
  );
  const sessions = new Map<string, { id: string; token: string }>();
  const results: any[] = [];
  try {
    for (const mix of mixes.rows) {
      let session = sessions.get(mix.creator_id);
      if (!session) {
        session = { id: uid('session_demand_batch_render'), token: randomBytes(32).toString('hex') };
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
  }

  const failed = results.filter((item) => item.resultingRenderStatus !== 'ready' || !item.qaReport?.passed);
  const report = {
    batchId: BATCH_ID,
    generatedAt: new Date().toISOString(),
    policy: 'Rendered files are listening-review candidates only. Manual QA and release governance remain required.',
    targetCount: results.length,
    passedCount: results.length - failed.length,
    failedCount: failed.length,
    items: results,
  };
  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(RENDER_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(RENDER_REPORT_MD, [
    '# Demand Production Batch Renders',
    '',
    `- Batch: ${BATCH_ID}`,
    `- Generated: ${report.generatedAt}`,
    `- Policy: ${report.policy}`,
    `- Targets: ${report.targetCount}`,
    `- Rendered with passing machine QA: ${report.passedCount}`,
    `- Failed: ${report.failedCount}`,
    '',
    '| Work | Frozen version | Result | Audio | QA |',
    '| --- | --- | --- | --- | --- |',
    ...results.map((item) => `| ${item.title} (\`${item.mixId}\`) | \`${item.frozenVersionId}\` | ${item.resultingRenderStatus} | ${item.renderedAudioUrl ?? ''} | ${item.qaReport?.passed ? `passed; ${item.qaReport.abnormalSilenceCount} abnormal silences` : item.error ?? 'failed'} |`),
    '',
  ].join('\n'));
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exitCode = 1;
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
