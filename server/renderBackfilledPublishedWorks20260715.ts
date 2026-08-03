import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const TARGET_MIX_ID = process.env.MIX_ID ?? '';
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'backfilled-published-work-renders-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'backfilled-published-work-renders-2026-07-15.md');
const uid = (prefix: string) => `${prefix}_batch_${randomBytes(6).toString('hex')}`;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const requestRender = async (mixId: string, token: string) => {
  const response = await fetch(`${API_BASE}/api/mixes/${mixId}/render`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
  return body;
};

const results: any[] = [];
const sessions = new Map<string, string>();
try {
  const mixes = await query<any>(
    `select id,title,creator_id,render_status
     from mixes
     where status = 'published'
       and render_status = 'not_rendered'
       and recipe_data #>> '{audit,historicalBackfill,date}' = '2026-07-15'
       and ($1 = '' or id = $1)
     order by id`,
    [TARGET_MIX_ID],
  );

  for (const mix of mixes.rows) {
    let token = sessions.get(mix.creator_id);
    if (!token) {
      token = randomBytes(32).toString('hex');
      await query(
        `insert into auth_sessions (id, token_hash, user_id, expires_at)
         values ($1, $2, $3, now() + interval '1 hour')`,
        [uid('session'), hashToken(token), mix.creator_id],
      );
      sessions.set(mix.creator_id, token);
    }
    try {
      const rendered = await requestRender(mix.id, token);
      results.push({
        mixId: mix.id,
        title: mix.title,
        status: 'rendered',
        renderStatus: rendered.mix?.renderStatus ?? 'ready',
        renderedAudioUrl: rendered.renderedAudioUrl,
        qaReport: rendered.qaReport,
        bytes: rendered.bytes,
      });
      console.log(JSON.stringify({ mixId: mix.id, status: 'rendered', qa: rendered.qaReport }));
    } catch (error) {
      results.push({
        mixId: mix.id,
        title: mix.title,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(JSON.stringify({ mixId: mix.id, status: 'failed', error: error instanceof Error ? error.message : String(error) }));
    }
  }
} finally {
  for (const token of sessions.values()) {
    await query('delete from auth_sessions where token_hash = $1', [hashToken(token)]);
  }
}

const snapshotResult = await query<any>(
  `select m.id,m.title,m.render_status,m.rendered_audio_url,m.published_version_id,
          q.duration_seconds,q.peak_db,q.mean_db,q.integrated_lufs,q.true_peak_db,
          q.abnormal_silence_count,q.passed,q.recipe_version_id
   from mixes m
   left join lateral (
     select * from render_qa_reports
     where mix_id = m.id
     order by created_at desc
     limit 1
   ) q on true
   where m.status = 'published'
     and m.recipe_data #>> '{audit,historicalBackfill,date}' = '2026-07-15'
   order by m.id`,
);
const snapshotItems = snapshotResult.rows.map((row) => ({
  mixId: row.id,
  title: row.title,
  status: row.render_status === 'ready' && row.passed ? 'rendered' : row.render_status,
  renderStatus: row.render_status,
  renderedAudioUrl: row.rendered_audio_url,
  recipeVersionId: row.published_version_id,
  qaRecipeVersionId: row.recipe_version_id,
  qaReport: row.duration_seconds == null ? null : {
    durationSeconds: Number(row.duration_seconds),
    peakDb: row.peak_db == null ? null : Number(row.peak_db),
    meanDb: row.mean_db == null ? null : Number(row.mean_db),
    integratedLufs: row.integrated_lufs == null ? null : Number(row.integrated_lufs),
    truePeakDb: row.true_peak_db == null ? null : Number(row.true_peak_db),
    abnormalSilenceCount: Number(row.abnormal_silence_count),
    passed: Boolean(row.passed),
  },
}));
const report = {
  generatedAt: new Date().toISOString(),
  releaseChannel: 'voice-free-beta',
  runTargetMixId: TARGET_MIX_ID || null,
  runItems: results,
  targetCount: snapshotItems.length,
  renderedCount: snapshotItems.filter((item) => item.status === 'rendered').length,
  failedCount: snapshotItems.filter((item) => item.status !== 'rendered').length,
  items: snapshotItems,
};
await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Backfilled Published Work Render Report',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Release channel: ${report.releaseChannel}`,
  `- Targets: ${report.targetCount}`,
  `- Rendered and QA-passed: ${report.renderedCount}`,
  `- Failed: ${report.failedCount}`,
  '',
  '| Work | Result | Render URL | QA |',
  '| --- | --- | --- | --- |',
  ...snapshotItems.map((item) => `| ${item.title} (\`${item.mixId}\`) | ${item.status} | ${item.renderedAudioUrl ?? ''} | ${item.qaReport ? (item.qaReport.passed ? 'pass' : 'fail') : ''} |`),
  '',
].join('\n'));
await pool.end();
console.log(JSON.stringify(report, null, 2));
