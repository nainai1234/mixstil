import { pool } from './db';
import { decideGeneration } from './generationDecision';

const fail = (message: string): never => { throw new Error(`GenerationDecision validation failed: ${message}`); };

const run = async () => {
  const inventory = await decideGeneration({
    prompt: 'gentle piano sleep music', goal: 'sleep', scene: 'bedtime', contentMode: 'functional_music',
  });
  if (inventory.kind !== 'inventory_only' || inventory.generationSpec || inventory.fullTrackProviderAllowed) fail('approved music request did not stay inventory-only');

  const oneGap = await decideGeneration({
    prompt: 'quiet harp sleep music', goal: 'sleep', scene: 'bedtime', contentMode: 'functional_music',
    requiredConceptIds: ['source.music.harp'],
  });
  if (oneGap.kind !== 'inventory_plus_missing_stem' || oneGap.generationSpec?.role !== 'music.bed' || oneGap.generationSpec.providerPolicy !== 'local_musickit_factory_only') {
    fail('single missing music layer did not produce a local-only Stem spec');
  }

  const multiGap = await decideGeneration({
    prompt: 'harp in a desert with rare bells', goal: 'calm', scene: 'emotional_settling', contentMode: 'sound_journey',
    requiredConceptIds: ['source.music.harp', 'source.natural.desert', 'source.accent.bell'],
  });
  if (multiGap.kind !== 'unsupported_multi_gap' || multiGap.generationSpec || multiGap.fullTrackProviderAllowed) fail('multi-gap request was incorrectly routed to a provider');

  console.log('PASS: GenerationDecision covers inventory-only, one missing Stem, and multi-gap blocking without full-track providers.');
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
