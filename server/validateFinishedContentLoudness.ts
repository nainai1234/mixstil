import { internalBaselineSeeds, recipeForInternalBaselineSeed } from './internalBaselineCatalog';
import { finishedContentLoudnessMeasurements } from './finishedContentLoudness';

if (internalBaselineSeeds.length !== 30 || Object.keys(finishedContentLoudnessMeasurements).length !== 30) {
  throw new Error('Finished-content loudness coverage must remain exactly 30/30.');
}

for (const seed of internalBaselineSeeds) {
  const recipe = recipeForInternalBaselineSeed(seed, 900);
  const track = recipe.tracks.find((item) => item.stemId === seed.stemId);
  const measurement = finishedContentLoudnessMeasurements[seed.id];
  if (!track || !measurement || !Number.isFinite(track.sourceGainDb)) throw new Error(`${seed.id}: missing compensation`);
  const volumeDb = 20 * Math.log10(track.volume / 100);
  const estimatedLufs = measurement.integratedLufs + Number(track.sourceGainDb) + volumeDb;
  const estimatedPeak = measurement.truePeakDb + Number(track.sourceGainDb) + volumeDb;
  if (estimatedLufs < -30 || estimatedLufs > -26.5) throw new Error(`${seed.id}: estimated loudness ${estimatedLufs.toFixed(1)} LUFS`);
  if (estimatedPeak > -6) throw new Error(`${seed.id}: estimated peak ${estimatedPeak.toFixed(1)} dBFS`);
}

console.log('PASS: 30/30 finished soundscapes have bounded loudness compensation and at least 6 dB peak headroom.');
