import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from './db';

const REPORTS_DIR = path.resolve('reports');
const REPORT_JSON = path.join(REPORTS_DIR, 'private-content-render-readiness-2026-07-15.json');
const REPORT_MD = path.join(REPORTS_DIR, 'private-content-render-readiness-2026-07-15.md');

const contentResult = await query<any>(
  `select m.id, m.title, m.render_status, m.rendered_audio_url, m.published_version_id,
          q.recipe_version_id as qa_recipe_version_id,
          q.rendered_audio_url as qa_rendered_audio_url,
          q.duration_seconds, q.integrated_lufs, q.peak_db,
          q.abnormal_silence_count, q.passed as qa_passed, q.created_at as qa_created_at
   from mixes m
   left join lateral (
     select recipe_version_id, rendered_audio_url, duration_seconds, integrated_lufs,
            peak_db, abnormal_silence_count, passed, created_at
     from render_qa_reports
     where mix_id = m.id
     order by created_at desc
     limit 1
   ) q on true
   where m.status = 'private' and m.recipe_data->'quickCreate' is not null
   order by m.title, m.id`,
);

const fixtureResult = await query<any>(
  `select id, title, render_status
   from mixes
   where status = 'private' and recipe_data->'quickCreate' is null
   order by title, id`,
);
await pool.end();

const works = contentResult.rows.map((row) => ({
  mixId: row.id,
  title: row.title,
  renderStatus: row.render_status,
  frozenVersionId: row.published_version_id,
  renderedAudioUrl: row.rendered_audio_url,
  qa: {
    passed: row.qa_passed,
    recipeVersionId: row.qa_recipe_version_id,
    renderedAudioUrl: row.qa_rendered_audio_url,
    durationSeconds: row.duration_seconds,
    integratedLufs: row.integrated_lufs,
    peakDb: row.peak_db,
    abnormalSilenceCount: row.abnormal_silence_count,
    createdAt: row.qa_created_at,
  },
}));

const failures = works.flatMap((work) => {
  const reasons: string[] = [];
  if (work.renderStatus !== 'ready' || !work.renderedAudioUrl) reasons.push('stable render is not ready');
  if (!work.frozenVersionId) reasons.push('frozen version is missing');
  if (!work.qa.passed) reasons.push('latest acoustic QA did not pass');
  if (work.qa.recipeVersionId !== work.frozenVersionId) reasons.push('QA Recipe does not match frozen version');
  if (work.qa.renderedAudioUrl !== work.renderedAudioUrl) reasons.push('QA audio does not match stable render');
  return reasons.map((reason) => ({ mixId: work.mixId, title: work.title, reason }));
});

const fixtures = fixtureResult.rows.map((row) => ({
  mixId: row.id,
  title: row.title,
  renderStatus: row.render_status,
  exclusionReason: 'Internal fixture without a Quick Create content snapshot.',
}));

const report = {
  generatedAt: new Date().toISOString(),
  passed: failures.length === 0,
  selectionRule: "status = 'private' and recipe_data.quickCreate exists",
  privateContentWorkCount: works.length,
  readyWithMatchingFrozenQaCount: works.length - new Set(failures.map((failure) => failure.mixId)).size,
  excludedFixtureCount: fixtures.length,
  works,
  excludedFixtures: fixtures,
  failures,
};

await mkdir(REPORTS_DIR, { recursive: true });
await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(REPORT_MD, [
  '# Private Content Render Readiness',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Selection: ${report.selectionRule}`,
  `- Real private content: ${report.privateContentWorkCount}`,
  `- Ready with matching frozen QA: ${report.readyWithMatchingFrozenQaCount}`,
  `- Internal fixtures excluded: ${report.excludedFixtureCount}`,
  `- Aggregate result: ${report.passed ? 'passed' : 'failed'}`,
  '',
  '## Real Private Content',
  '',
  '| Work | Frozen version | Audio | Duration | Integrated loudness | Peak | Silence | QA |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
  ...works.map((work) => `| ${work.title} (\`${work.mixId}\`) | \`${work.frozenVersionId}\` | \`${work.renderedAudioUrl}\` | ${Number(work.qa.durationSeconds).toFixed(3)}s | ${Number(work.qa.integratedLufs).toFixed(1)} LUFS | ${Number(work.qa.peakDb).toFixed(1)} dB | ${work.qa.abnormalSilenceCount} | ${work.qa.passed ? 'passed' : 'failed'} |`),
  '',
  '## Explicitly Excluded Internal Fixtures',
  '',
  '| Fixture | Render status | Reason |',
  '| --- | --- | --- |',
  ...fixtures.map((fixture) => `| ${fixture.title} (\`${fixture.mixId}\`) | ${fixture.renderStatus} | ${fixture.exclusionReason} |`),
  '',
  ...(failures.length ? [
    '## Failures',
    '',
    ...failures.map((failure) => `- ${failure.title} (\`${failure.mixId}\`): ${failure.reason}`),
    '',
  ] : []),
].join('\n'));

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
