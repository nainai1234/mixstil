import { pool, query } from './db';
import { productCapabilities } from './productCapabilities';
import { planRecipeRenderTracks } from './renderRecipeV2';

try {
  const mixes = await query<any>(
    `select m.*, v.recipe_data as frozen_recipe
     from mixes m
     left join mix_recipe_versions v on v.id = m.published_version_id and v.mix_id = m.id
     where m.status in ('published', 'private')
     order by m.id`,
  );
  const stemsResult = await query<any>('select * from audio_stems');
  const stems = new Map<string, any>(stemsResult.rows.map((stem: any) => [stem.id, stem]));
  const failures: string[] = [];

  for (const mix of mixes.rows) {
    if (!mix.published_version_id) {
      failures.push(`${mix.id} is ${mix.status} without published_version_id.`);
      continue;
    }
    const recipe = mix.frozen_recipe;
    if (!recipe || recipe.versionState !== 'frozen' || recipe.versionId !== mix.published_version_id) {
      failures.push(`${mix.id} does not resolve to its frozen Recipe V2 version.`);
      continue;
    }
    const audibleTracks = planRecipeRenderTracks(recipe);
    if (audibleTracks.length === 0) {
      failures.push(`${mix.id} is ${mix.status} without any audible tracks.`);
    }
    for (const track of audibleTracks) {
      const stem = stems.get(track.stemId);
      if (!stem) failures.push(`${mix.id} references missing audible Stem ${track.stemId}.`);
      else if (stem.qa_status !== 'approved' || !stem.commercial_use_allowed || !stem.derivative_use_allowed) {
        failures.push(`${mix.id} has release-blocked audible Stem ${track.stemId}.`);
      }
      if (!productCapabilities.guidedVoice && (track.role === 'voice' || stem?.category === 'Voice')) {
        failures.push(`${mix.id} has audible Voice Stem ${track.stemId} in Voice-free Beta.`);
      }
    }
    if (mix.status === 'published' && mix.render_status !== 'ready') {
      failures.push(`${mix.id} is published without a ready rendered audio file.`);
    }
    if (mix.render_status === 'ready') {
      const qa = await query<any>(
        `select id from render_qa_reports
         where mix_id = $1 and recipe_version_id = $2
           and rendered_audio_url = $3 and passed = true
         order by created_at desc limit 1`,
        [mix.id, mix.published_version_id, mix.rendered_audio_url],
      );
      if (!qa.rows[0]) failures.push(`${mix.id} ready render is not bound to passing QA for its frozen Recipe.`);
    }
  }

  if (failures.length) throw new Error(`Frozen Work release-state validation failed:\n- ${failures.join('\n- ')}`);
  console.log(JSON.stringify({
    passed: true,
    releaseChannel: productCapabilities.releaseChannel,
    frozenWorks: mixes.rows.length,
    published: mixes.rows.filter((mix) => mix.status === 'published').length,
    private: mixes.rows.filter((mix) => mix.status === 'private').length,
    readyRendersBoundToFrozenQa: mixes.rows.filter((mix) => mix.render_status === 'ready').length,
  }, null, 2));
} finally {
  await pool.end();
}
