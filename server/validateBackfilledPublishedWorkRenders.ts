import { pool, query } from './db';

try {
  const result = await query<any>(
    `select m.id,m.title,m.render_status,m.rendered_audio_url,m.published_version_id,
            q.id as qa_id,q.passed,q.recipe_version_id,q.rendered_audio_url as qa_rendered_audio_url
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
  const failures: string[] = [];
  for (const mix of result.rows) {
    if (mix.render_status !== 'ready' || !mix.rendered_audio_url) failures.push(`${mix.id} is not render-ready.`);
    if (!mix.qa_id || !mix.passed) failures.push(`${mix.id} has no passing render QA.`);
    if (mix.recipe_version_id !== mix.published_version_id) failures.push(`${mix.id} QA is not bound to the frozen Recipe.`);
    if (mix.qa_rendered_audio_url !== mix.rendered_audio_url) failures.push(`${mix.id} QA URL does not match the current render.`);
  }
  if (failures.length) throw new Error(`Backfilled published render validation failed:\n- ${failures.join('\n- ')}`);
  console.log(JSON.stringify({
    passed: true,
    backfilledPublishedWorks: result.rows.length,
    rendersReady: result.rows.length,
    qaBoundToFrozenRecipe: result.rows.length,
  }, null, 2));
} finally {
  await pool.end();
}
