import { pool } from './db';
import { finishedContentLoudnessMeasurements, finishedContentSourceGainDb } from './finishedContentLoudness';

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const mixes = await client.query<{
      id: string;
      published_version_id: string;
      recipe_data: any;
    }>(`select id, published_version_id, recipe_data from mixes where id like 'mix_finished_%' order by id`);
    if (mixes.rowCount !== 30) throw new Error(`Expected 30 finished mixes, found ${mixes.rowCount}`);

    for (const mix of mixes.rows) {
      const contentId = mix.id.replace(/^mix_finished_/, '');
      const recipe = structuredClone(mix.recipe_data);
      const track = recipe.tracks?.find((item: any) => item.stemId === `stem_content_baseline_${contentId}`);
      if (!track || !mix.published_version_id || !finishedContentLoudnessMeasurements[contentId]) {
        throw new Error(`Incomplete frozen recipe or loudness metadata for ${contentId}`);
      }
      track.sourceGainDb = finishedContentSourceGainDb(contentId, recipe.audioIntent?.goal ?? contentId.split('_')[0], Number(track.volume));
      await client.query(
        `update mixes set recipe_data=$2::jsonb, updated_at=now() where id=$1`,
        [mix.id, JSON.stringify(recipe)],
      );
      await client.query(
        `update mix_recipe_versions set recipe_data=$2::jsonb where id=$1 and mix_id=$3`,
        [mix.published_version_id, JSON.stringify(recipe), mix.id],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  console.log('PASS: applied peak-limited loudness compensation to 30 published frozen soundscapes.');
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
