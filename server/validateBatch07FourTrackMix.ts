import { pool, query } from './db';
import { planRecipeRenderTracks } from './renderRecipeV2';

try {
  const result = await query<any>(
    `select m.*, q.passed, q.abnormal_silence_count, q.recipe_version_id as qa_recipe_version_id,
            q.rendered_audio_url as qa_rendered_audio_url
     from mixes m
     left join lateral (
       select * from render_qa_reports where mix_id = m.id order by created_at desc limit 1
     ) q on true
     where m.id = 'mix_m9sxkb1t'`,
  );
  const mix = result.rows[0];
  if (!mix) throw new Error('Batch 07 four-track Mix was not found.');
  const tracks = planRecipeRenderTracks(mix.recipe_data);
  const expectedStemIds = [
    'stem_batch07_fma_holizna_meditation_01',
    'stem_batch07_fma_holizna_dreamscape',
    'stem_batch07_fma_holizna_rain_sleep',
    'stem_batch07_fma_holizna_cosmic_waves',
  ];
  const failures: string[] = [];
  if (tracks.length !== 4) failures.push(`Expected 4 audible tracks, found ${tracks.length}.`);
  if (tracks.some((track) => track.role !== 'music')) failures.push('Every audible track must remain a separate Music track.');
  if (JSON.stringify(tracks.map((track) => track.stemId)) !== JSON.stringify(expectedStemIds)) {
    failures.push('The four approved Batch 07 Music Stems are not preserved in their expected track order.');
  }
  if (tracks.some((track) => Number(track.startTime) !== 0 || Number(track.duration) !== 1800)) {
    failures.push('Every Batch 07 Music track must cover the full 1800-second timeline.');
  }
  if (mix.render_status !== 'ready' || !mix.rendered_audio_url) failures.push('The repaired Mix is not rendered and ready.');
  if (!mix.passed || Number(mix.abnormal_silence_count) !== 0) failures.push('The repaired Mix does not have passing zero-silence acoustic QA.');
  if (mix.qa_recipe_version_id !== mix.published_version_id) failures.push('The latest QA is not bound to the current frozen Recipe.');
  if (mix.qa_rendered_audio_url !== mix.rendered_audio_url) failures.push('The latest QA does not match the current rendered audio URL.');
  if (failures.length) throw new Error(`Batch 07 four-track validation failed:\n- ${failures.join('\n- ')}`);
  console.log(JSON.stringify({
    passed: true,
    mixId: mix.id,
    frozenVersionId: mix.published_version_id,
    trackCount: tracks.length,
    durationSeconds: mix.recipe_data.durationSeconds,
    renderedAudioUrl: mix.rendered_audio_url,
    abnormalSilenceCount: Number(mix.abnormal_silence_count),
  }, null, 2));
} finally {
  await pool.end();
}
