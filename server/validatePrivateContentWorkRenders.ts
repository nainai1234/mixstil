import { pool, query } from './db';

try {
  const result = await query<any>(
    `select m.id, m.title, m.render_status, m.rendered_audio_url, m.published_version_id,
            q.passed, q.recipe_version_id, q.rendered_audio_url as qa_rendered_audio_url
     from mixes m
     left join lateral (
       select passed, recipe_version_id, rendered_audio_url
       from render_qa_reports where mix_id = m.id order by created_at desc limit 1
     ) q on true
     where m.status = 'private' and m.recipe_data->'quickCreate' is not null
     order by m.id`,
  );
  const failures: string[] = [];
  for (const mix of result.rows) {
    if (mix.render_status !== 'ready' || !mix.rendered_audio_url) {
      failures.push(`${mix.id} ${mix.title} does not have a ready stable render.`);
      continue;
    }
    if (!mix.passed || mix.recipe_version_id !== mix.published_version_id) {
      failures.push(`${mix.id} ${mix.title} does not have passing QA for its current frozen Recipe.`);
    }
    if (mix.qa_rendered_audio_url !== mix.rendered_audio_url) {
      failures.push(`${mix.id} ${mix.title} QA does not match its current rendered audio URL.`);
    }
  }
  if (failures.length) throw new Error(`Private content render validation failed:\n- ${failures.join('\n- ')}`);
  console.log(JSON.stringify({
    passed: true,
    privateContentWorks: result.rows.length,
    readyWithFrozenQa: result.rows.length,
    fixtureRule: 'quickCreate snapshot required',
  }, null, 2));
} finally {
  await pool.end();
}
