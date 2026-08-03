import { seedAudioKnowledgeV3 } from './audioKnowledgeV3';
import { seedAudioIntentGoldSetV3 } from './audioIntentGoldSetV3';
import { pool } from './db';

const run = async () => {
  await seedAudioKnowledgeV3();
  await seedAudioIntentGoldSetV3();
  console.log('Seeded Audio Ontology V3, matchable Stem Metadata V3, and the current AudioIntent Gold Set.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
