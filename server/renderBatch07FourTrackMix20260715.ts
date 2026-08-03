import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const API_BASE = process.env.API_BASE ?? 'http://localhost:8788';
const MIX_ID = 'mix_m9sxkb1t';
const token = randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(token).digest('hex');
const sessionId = `session_batch07_render_${randomBytes(6).toString('hex')}`;
const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'batch-07-four-track-render-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'batch-07-four-track-render-2026-07-15.md');
let report: Record<string, any>;

try {
  const mix = await query<any>('select id, creator_id from mixes where id = $1', [MIX_ID]);
  if (!mix.rows[0]) throw new Error(`Mix ${MIX_ID} was not found.`);
  await query(
    `insert into auth_sessions (id, token_hash, user_id, expires_at)
     values ($1, $2, $3, now() + interval '2 hours')`,
    [sessionId, tokenHash, mix.rows[0].creator_id],
  );
  const response = await fetch(`${API_BASE}/api/mixes/${MIX_ID}/render`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`);
  report = {
    generatedAt: new Date().toISOString(),
    mixId: MIX_ID,
    renderStatus: body.mix?.renderStatus,
    renderedAudioUrl: body.renderedAudioUrl,
    bytes: body.bytes,
    qaReport: body.qaReport,
  };
} finally {
  await query('delete from auth_sessions where id = $1', [sessionId]);
  await pool.end();
}

await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Batch 07 Four-Track Render',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Work: \`${report.mixId}\``,
  `- Render status: ${report.renderStatus}`,
  `- Audio: \`${report.renderedAudioUrl}\``,
  `- Duration: ${report.qaReport?.durationSeconds} seconds`,
  `- Integrated loudness: ${report.qaReport?.integratedLufs} LUFS`,
  `- Peak: ${report.qaReport?.peakDb} dB`,
  `- Abnormal silences: ${report.qaReport?.abnormalSilenceCount}`,
  `- QA passed: ${report.qaReport?.passed ? 'yes' : 'no'}`,
  '',
].join('\n'));

console.log(JSON.stringify(report, null, 2));
