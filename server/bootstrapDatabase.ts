import { pool, query } from './db';
import { seedAudioIntentGoldSetV3 } from './audioIntentGoldSetV3';
import { seedAudioKnowledgeV3 } from './audioKnowledgeV3';
import { createSchema } from './schema';
import { seedDatabase } from './seed';

try {
  await createSchema();
  await seedDatabase();
  await seedAudioKnowledgeV3();
  await seedAudioIntentGoldSetV3();
  const result = await query<{ users: number; stems: number }>(
    `select
      (select count(*)::int from users) as users,
      (select count(*)::int from audio_stems) as stems`,
  );
  console.log(JSON.stringify({ bootstrapped: true, ...result.rows[0] }, null, 2));
} finally {
  await pool.end();
}
