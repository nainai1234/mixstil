import { defaultSoundGroupVolumes, scaledTrackVolume, soundGroupForRole } from '../src/lib/soundGroupVolumes';

const groups = defaultSoundGroupVolumes();
groups.environment = 40;

if (soundGroupForRole('music') !== 'music') throw new Error('Music role did not map to Music group.');
if (soundGroupForRole('environment') !== 'environment') throw new Error('Environment role did not map to Environment group.');
if (soundGroupForRole('base') !== 'masking') throw new Error('Base role did not map to Masking group.');
if (soundGroupForRole('accent') !== 'details') throw new Error('Accent role did not map to Details group.');
if (scaledTrackVolume(84, 100, groups.environment) !== 34) throw new Error('Environment scaling is incorrect.');
if (scaledTrackVolume(60, 50, 50) !== 15) throw new Error('Combined overall and group scaling is incorrect.');
if (scaledTrackVolume(100, 100, 200) !== 100) throw new Error('Scaled volume must be clamped.');

console.log('PASS: sound groups map roles and scale only their target layer family.');
