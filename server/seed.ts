import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pool, query } from './db';
import { seedAudioKnowledgeV3 } from './audioKnowledgeV3';
import { seedAudioIntentGoldSetV3 } from './audioIntentGoldSetV3';
import { createSchema } from './schema';
import { productionMusicKitStems } from './musicKitProduction';
import { foundationalElements } from './foundationalElementProduction';
import { internalBaselineSeeds } from './internalBaselineCatalog';

type StemSeed = {
  id: string;
  name: string;
  category: 'Nature' | 'Music' | 'Noise' | 'Voice' | 'Accent';
  audioUrl: string;
  tags: string[];
  defaultVolume: number;
  description: string;
  sourceItemId: string;
  sourcePath: string;
  fileSha256: string;
  qaNotes: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  sourceCreator?: string;
  licenseName?: string;
  licenseUrl?: string;
  commercialUseAllowed?: boolean;
  derivativeUseAllowed?: boolean;
  attributionRequired?: boolean;
  rawRedistributionAllowed?: boolean;
  qaStatus?: 'candidate' | 'approved' | 'needs_review' | 'rejected';
  acousticFeatures?: {
    analysisVersion: string;
    durationSeconds: number;
    sampleRate: number;
    channels: number;
    integratedLufs: number;
    truePeakDb: number;
    meanVolumeDb?: number | null;
    maxVolumeDb: number;
    details: Record<string, unknown>;
  };
};

const MIXKIT_LICENSE_URL = 'https://mixkit.co/license/';
const COMMONS_PUBLIC_DOMAIN_URL = 'https://commons.wikimedia.org/wiki/Commons:Copyright_tags/General_public_domain';

const publicAudioBytes = (audioUrl: string) => {
  const fileUrl = new URL(`../public${audioUrl}`, import.meta.url);
  if (!existsSync(fileUrl)) return null;
  return readFileSync(fileUrl);
};

const approvedMusicKitStems: StemSeed[] = productionMusicKitStems.map(({ kit, stem }) => ({
  id: stem.id,
  name: stem.name,
  category: 'Music',
  audioUrl: stem.audioUrl,
  tags: [kit.goal, kit.profileId, stem.role, 'MusicKit', 'Voice-free'],
  defaultVolume: stem.defaultVolume,
  description: `${stem.role} layer from approved ${kit.profileId} MusicKit.`,
  sourceItemId: stem.sourceItemId,
  sourcePath: stem.audioUrl,
  fileSha256: stem.fileSha256,
  qaNotes: `Approved MusicKit foundation on 2026-07-20. Human listening, rights, synchronized reconstruction, and loop crossfade QA passed. Kit ${kit.id}@${kit.version}; part ${stem.role}.`,
  sourcePlatform: stem.sourcePlatform,
  sourceUrl: stem.sourceUrl,
  sourceCreator: stem.sourceCreator,
  licenseName: stem.licenseName,
  licenseUrl: stem.licenseUrl,
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  attributionRequired: false,
  rawRedistributionAllowed: true,
  qaStatus: 'approved',
}));

const approvedFoundationalElementStems: StemSeed[] = foundationalElements.map((element) => ({
  id: element.id,
  name: element.name,
  category: 'Music',
  audioUrl: element.audioUrl,
  tags: [...element.goals, element.family, element.elementRole, ...element.tags],
  defaultVolume: element.defaultVolume,
  description: `Reusable ${element.elementRole} element from the approved ${element.family} family.`,
  sourceItemId: element.source.sourceCandidateId,
  sourcePath: element.audioUrl,
  fileSha256: element.sha256,
  qaNotes: `${element.qa.ownerReviewEvidence} ${element.qa.machineWarningsResolved.join(', ')}.`,
  sourcePlatform: 'Google Cloud Vertex AI Lyria',
  sourceUrl: `internal://snooze/lyria/${element.source.sourceCandidateId}`,
  sourceCreator: element.rights.sourceCreator,
  licenseName: element.rights.licenseName,
  licenseUrl: element.rights.licenseUrl,
  commercialUseAllowed: element.rights.commercialUseAllowed,
  derivativeUseAllowed: element.rights.derivativeUseAllowed,
  attributionRequired: element.rights.attributionRequired,
  rawRedistributionAllowed: element.rights.rawRedistributionAllowed,
  qaStatus: element.qa.status,
  acousticFeatures: {
    analysisVersion: 'foundational-element-v1',
    durationSeconds: element.acoustic.durationSeconds,
    sampleRate: element.acoustic.sampleRate,
    channels: element.acoustic.channels,
    integratedLufs: element.acoustic.integratedLufs,
    truePeakDb: element.acoustic.truePeakDb,
    meanVolumeDb: null,
    maxVolumeDb: element.acoustic.truePeakDb,
    details: { family: element.family, elementRole: element.elementRole, key: element.key, loop: element.loop },
  },
}));

const approvedFinishedContentStems: StemSeed[] = internalBaselineSeeds.map((seed) => ({
  id: seed.stemId,
  name: seed.title.replace(/\s+[—-]\s+(Sleep|Calm|Focus)$/i, ''),
  category: 'Music',
  audioUrl: seed.outputUrl,
  tags: ['Finished Content', 'Save Replay Worthy', seed.goal, seed.scene, ...seed.keywords],
  defaultVolume: seed.goal === 'focus' ? 64 : 54,
  description: `Owner-approved finished soundscape for ${seed.goal}/${seed.scene}.`,
  sourceItemId: seed.id,
  sourcePath: seed.outputPath,
  fileSha256: seed.sha256,
  qaNotes: `Owner save/replay listening passed. Rights lineage and long-form packaging passed on 2026-07-20. Raw redistribution is blocked.`,
  sourcePlatform: 'MixStil content factory',
  sourceUrl: `internal://snooze/content-baseline/${seed.id}`,
  sourceCreator: 'MixStil',
  licenseName: 'MixStil derivative work with documented embedded source licenses',
  licenseUrl: 'internal://snooze/content-baseline-rights-2026-07-20',
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  attributionRequired: false,
  rawRedistributionAllowed: false,
  qaStatus: 'approved',
}));

const parseTsv = (content: string) => {
  const [headerLine, ...rows] = content.trim().split('\n');
  const headers = headerLine.split('\t');
  return rows.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const noHumanMachineQaRows = parseTsv(readFileSync(new URL('../docs/no-human-audio-candidate-machine-qa.tsv', import.meta.url), 'utf8'));
const noHumanListeningRows = parseTsv(readFileSync(new URL('../docs/no-human-audio-listening-qa-queue.tsv', import.meta.url), 'utf8'));
const noHumanListeningApprovedIds = new Set(
  noHumanListeningRows
    .filter((row) => row.listening_status === 'approved_no_human_voice')
    .map((row) => row.candidate_id),
);
const noHumanMachinePassIds = new Set(
  noHumanMachineQaRows
    .filter((row) => row.machine_status === 'pass' && noHumanListeningApprovedIds.has(row.candidate_id))
    .map((row) => row.candidate_id),
);
const noHumanMachineFailIds = new Set(
  noHumanMachineQaRows
    .filter((row) => row.machine_status === 'fail')
    .map((row) => row.candidate_id),
);

const mixkitStems: StemSeed[] = [
  {
    id: 'stem_mixkit_rain_2394',
    name: 'Rain Long Loop',
    category: 'Nature',
    audioUrl: '/audio/nature/mixkit_rain_long_loop.wav',
    tags: ['Rain', 'Sleep', 'Focus'],
    defaultVolume: 15,
    description: 'A steady rain bed for bedtime and focus soundscapes.',
    sourceItemId: '2394',
    sourcePath: 'rain/',
    fileSha256: 'e3da725d40cf7f2bb71ca3e6eba755f725d472d6727551c6f75436ab833a9854',
    qaNotes: 'Valid stereo 44.1 kHz WAV; 57.07 seconds. Source and Mixkit license recorded.',
  },
  {
    id: 'stem_mixkit_ocean_1195',
    name: 'Close Sea Waves Loop',
    category: 'Nature',
    audioUrl: '/audio/nature/mixkit_close_sea_waves_loop.wav',
    tags: ['Ocean', 'Waves', 'Sleep'],
    defaultVolume: 16,
    description: 'Close sea waves suitable for quiet ocean soundscapes.',
    sourceItemId: '1195',
    sourcePath: 'ocean/',
    fileSha256: '697fb6ce535ee9ebd2deb536900cb394e8d53bfcc38f6ce629856e2e6bc642e4',
    qaNotes: 'Valid stereo PCM 44.1 kHz WAV; 29.00 seconds. Source and Mixkit license recorded.',
  },
  {
    id: 'stem_mixkit_pond_1783',
    name: 'Pond Ambience with Crickets',
    category: 'Nature',
    audioUrl: '/audio/nature/mixkit_pond_crickets.wav',
    tags: ['Pond', 'Crickets', 'Night'],
    defaultVolume: 12,
    description: 'A long nocturnal pond ambience for low-volume night scenes.',
    sourceItemId: '1783',
    sourcePath: 'crickets/',
    fileSha256: '7bbd4b0b98d1372130dbd13f992b7eae4b2dc4ffdf944e06175d615b216a434c',
    qaNotes: 'Valid stereo 44.1 kHz WAV; 148.06 seconds. Source and Mixkit license recorded.',
  },
  {
    id: 'stem_mixkit_forest_1210',
    name: 'Forest Birds Ambience',
    category: 'Nature',
    audioUrl: '/audio/nature/mixkit_forest_birds_ambience.wav',
    tags: ['Forest', 'Birds', 'Morning'],
    defaultVolume: 12,
    description: 'A daytime forest ambience for morning calm and light meditation.',
    sourceItemId: '1210',
    sourcePath: 'forest/',
    fileSha256: '1ac6dc58fd762f980ece682293e264ca10f0be9a21894166a34edfe2281e5d0a',
    qaNotes: 'Valid stereo PCM 44.1 kHz WAV; 151.56 seconds. Intended for daytime scenes.',
  },
  {
    id: 'stem_mixkit_waterfall_2517',
    name: 'Waterfall in the Woods',
    category: 'Nature',
    audioUrl: '/audio/nature/mixkit_waterfall_in_woods.wav',
    tags: ['Waterfall', 'Forest', 'Focus'],
    defaultVolume: 13,
    description: 'A broad water texture for relaxation and sound masking.',
    sourceItemId: '2517',
    sourcePath: 'waterfall/',
    fileSha256: '0ae0e7a48592bb5a847fab05ea5aeb1777bb3277cc5b28fb003153b8e3381f70',
    qaNotes: 'Valid stereo PCM 44.1 kHz WAV; 82.76 seconds. Keep default volume low.',
  },
  {
    id: 'stem_fire',
    name: 'Synthetic Fire-like Noise (Rejected)',
    category: 'Nature',
    audioUrl: '/audio/campfire.wav',
    tags: ['Fire', 'Cozy', 'Night'],
    defaultVolume: 20,
    description: 'A noise-based fire simulation. It does not contain an authentic recorded fireplace scene.',
    sourceItemId: 'local_fire',
    sourcePath: 'campfire.wav',
    fileSha256: createHash('sha256').update(readFileSync(new URL('../public/audio/campfire.wav', import.meta.url))).digest('hex'),
    qaNotes: 'Rejected semantic simulation: decode and hash validity do not establish authentic fire identity.',
    qaStatus: 'rejected',
    sourcePlatform: 'Internal Synthetic',
    sourceUrl: 'internal://snooze/campfire-v1',
    sourceCreator: 'MixStil',
    licenseName: 'MixStil Internal Generated Asset',
    licenseUrl: 'internal://snooze/asset-policy',
  },
  {
    id: 'stem_bowl',
    name: 'Meditation Bowl',
    category: 'Music',
    audioUrl: '/audio/bowl.wav',
    tags: ['Meditation', 'Bell', 'Zen'],
    defaultVolume: 20,
    description: 'Soft tonal accents for breath practice.',
    sourceItemId: 'local_bowl',
    sourcePath: 'bowl.wav',
    fileSha256: createHash('sha256').update(readFileSync(new URL('../public/audio/bowl.wav', import.meta.url))).digest('hex'),
    qaNotes: 'Internal WAV; decode and hash verified.',
    sourcePlatform: 'Internal Synthetic',
    sourceUrl: 'internal://snooze/bowl-v1',
    sourceCreator: 'MixStil',
    licenseName: 'MixStil Internal Generated Asset',
    licenseUrl: 'internal://snooze/asset-policy',
  }
];

const reviewedAuthenticStems: StemSeed[] = [
  {
    id: 'stem_commons_pine_forest_wind',
    name: 'Wind in Pine Forest',
    category: 'Nature',
    audioUrl: '/audio/nature/approved/pine_forest_wind_cc_by_3.mp3',
    tags: ['Wind', 'Pine Forest', 'Field Recording', 'No Water'],
    defaultVolume: 16,
    description: 'Authentic wind moving through a pine forest, approved for calm, sleep, and focus soundscapes.',
    sourceItemId: 'commons_wind_pine_forest_luc_de_bruijn',
    sourcePath: 'nature/approved/pine_forest_wind_cc_by_3.mp3',
    fileSha256: 'fe192e5bb0ac96e703a9edc9eb3da19f88f5da6c2d94bf7234486848d0a9b755',
    qaNotes: 'Semantic identity, license, 10-minute loop, transient, fatigue, Recipe V2 combination, and collection-diversity listening passed on 2026-07-14.',
    sourcePlatform: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Wind_in_a_pine_forest.ogg',
    sourceCreator: 'luc de bruijn',
    licenseName: 'Creative Commons Attribution 3.0 Unported',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    commercialUseAllowed: true,
    derivativeUseAllowed: true,
    attributionRequired: true,
    rawRedistributionAllowed: true,
    qaStatus: 'approved',
  },
];

const internalNoiseSpecs = [
  ['white_soft', 'Soft White Noise', ['White Noise', 'Soft', 'Sleep'], 28, '7db2778e5b48b2a544cd4a8b9bee320f845a13d45bb26f33d72f969f2de9b10b'],
  ['white_deep', 'Deep White Noise', ['White Noise', 'Masking', 'Focus'], 26, '068fa5d11c650783ddb89e0c05e72dbc7a78fc38193e60161cf215a76d82af95'],
  ['pink_balanced', 'Balanced Pink Noise', ['Pink Noise', 'Balanced', 'Sleep'], 30, 'ec0eb208ba79da2048236057dc6e1b46c6f8ca4127eb1613144a888e3d79e2c7'],
  ['pink_soft', 'Soft Pink Noise', ['Pink Noise', 'Soft', 'Relax'], 28, 'd355d23827398c967a36f836a503470027aaa1a1d4ef0fcc89b715669eb4f059'],
  ['brown_deep', 'Deep Brown Noise', ['Brown Noise', 'Deep', 'Masking'], 32, '8ae568f609f247e73964c232065b80ae58b4a4cd92fdece0e96ae70bc70f6e53'],
  ['brown_soft', 'Soft Brown Noise', ['Brown Noise', 'Soft', 'Sleep'], 30, '4c2cdd5ec63796e424be3b5727fb7e1b7daec05a9d9717c41213a71a0331c855'],
  ['fan_low', 'Low Fan', ['Fan', 'Low', 'Bedroom'], 32, '5bb17eeae4ec017c7c38b068cb1a3b0a7b052264b29d2396c323ccf72d37c3ac'],
  ['fan_medium', 'Medium Fan', ['Fan', 'Steady', 'Bedroom'], 30, 'ec080e17162b997e449d4c98771cddb352ddc568e77bd32dc1444778a5176129'],
  ['fan_high', 'High Fan', ['Fan', 'Air', 'Masking'], 27, '4f6526d5923f9cbdb52740438227e05bff5da9454f489dc2fd2887850602da03'],
  ['airplane_cabin', 'Airplane Cabin', ['Cabin', 'Travel', 'Low Hum'], 29, '4ddfbf9a3da585de3e76c7e4aa8ef0eee55578db9dc87a4d121e05fa5d442de1'],
  ['train_carriage', 'Train Carriage', ['Train', 'Travel', 'Rhythm'], 27, 'ce36197e62631f4a8add51a226036258cf22595ba8a06daf6806cc42e6863629'],
  ['air_conditioner', 'Air Conditioner', ['Air Conditioner', 'Room', 'Hum'], 30, '4b6beb2d4d55d403d9693b587ab54db8053f07cd2283dad2e1d0ee00fd2cbb0c'],
  ['humidifier', 'Humidifier', ['Humidifier', 'Air', 'Soft'], 25, '31db0f778c09f73ea55cd3cde0bc5bcb3e07c25da72f39a5fd7ab2e17494af43'],
  ['distant_highway', 'Distant Highway', ['Highway', 'Distant', 'Low Hum'], 24, '4cdd71fbc049758c4603e448e4064ed8832f9c084da9bcf821956765d27a9580'],
  ['quiet_room', 'Quiet Room Tone', ['Room Tone', 'Quiet', 'Background'], 24, '1037e61c5723ab2a75b2dac190766c6cbb4b627cd240093f7739073008a723ba'],
] as const;

const rejectedSemanticSimulationNames: Record<string, string> = {
  fan_low: 'Low Modulated Pink Noise',
  fan_medium: 'Medium Modulated Pink Noise',
  fan_high: 'Bright Modulated White Noise',
  airplane_cabin: 'Low Modulated Brown Noise',
  train_carriage: 'Rhythmic Modulated Pink Noise',
  air_conditioner: 'Low Modulated Brown Noise II',
  humidifier: 'Soft Modulated White Noise',
  distant_highway: 'Low Modulated Brown Noise III',
  quiet_room: 'Filtered Pink Noise',
};

const internalNoiseStems: StemSeed[] = internalNoiseSpecs.map(([slug, name, tags, defaultVolume, fileSha256]) => ({
  id: `stem_internal_${slug}`,
  name: rejectedSemanticSimulationNames[slug] ?? name,
  category: 'Noise',
  audioUrl: `/audio/noise/internal/${slug}.mp3`,
  tags: rejectedSemanticSimulationNames[slug] ? ['Synthetic Noise', 'Semantic Simulation Rejected'] : [...tags],
  defaultVolume,
  description: rejectedSemanticSimulationNames[slug]
    ? `${rejectedSemanticSimulationNames[slug]} generated from FFmpeg anoisesrc. It is not a real-world recording and must not be matched as ${name}.`
    : `${name} generated by MixStil for layering in sleep and relaxation soundscapes.`,
  sourceItemId: `internal_noise_${slug}_v1`,
  sourcePath: `noise/internal/${slug}.mp3`,
  fileSha256,
  qaNotes: rejectedSemanticSimulationNames[slug]
    ? `Rejected semantic simulation: FFmpeg anoisesrc output does not contain authentic ${name} events. Decode and hash validity do not establish scene identity.`
    : 'Internally generated 90-second stereo colored-noise MP3; decode, duration, and hash verified.',
  qaStatus: rejectedSemanticSimulationNames[slug] ? 'rejected' : 'approved',
  sourcePlatform: 'MixStil Internal Synthesis',
  sourceUrl: 'internal://snooze/noise-generator-v1',
  sourceCreator: 'MixStil',
  licenseName: 'MixStil Internal Generated Asset',
  licenseUrl: 'internal://snooze/asset-policy',
}));

const proceduralMusicSpecs: Array<[string, string, string[], number, string]> = [
  ['night_neutral_drone', 'Night Neutral Drone', ['Music', 'Drone', 'Sleep', 'No Rhythm', 'Low Stimulation'], 72, 'de69e635dc05298892c73610cae4a45ca41a9bb658dd4120faa07b18156a88a7'],
  ['deep_sleep_low', 'Deep Sleep Low', ['Music', 'Drone', 'Deep Sleep', 'No Rhythm', 'Low Stimulation'], 70, '20d37f992e0ff4d6d1c185a4cb19f7da2ba21fa2237f4eaf0a5c5f34fc8f0352'],
  ['return_to_sleep_soft', 'Return to Sleep Soft', ['Music', 'Drone', 'Return to Sleep', 'No Rhythm', 'Low Stimulation'], 70, '9846072f9b1d62ffad77ee2ba5e6e001e4e56f51b1cbaee86bd0c91c221332b0'],
];

const proceduralMusicStems: StemSeed[] = proceduralMusicSpecs.map(([slug, name, tags, defaultVolume, fileSha256]) => ({
  id: `stem_local_procedural_${slug}`,
  name,
  category: 'Music',
  audioUrl: `/audio/music/procedural-approved-2026-07-13/procedural_${slug}.mp3`,
  tags: [...tags],
  defaultVolume: Number(defaultVolume),
  description: `${name}, a deterministic low-stimulation music bed for sleep soundscapes.`,
  sourceItemId: `snooze_procedural_${slug}_v1`,
  sourcePath: `music/procedural-approved-2026-07-13/procedural_${slug}.mp3`,
  fileSha256,
  qaNotes: 'Locally synthesized with the deterministic MixStil foundation-pad renderer. Fixed seed, 60-second WAV master retained, 10-minute loop QA passed, Recipe V2 combination QA passed, and project-owner listening QA passed 2026-07-13. No third-party recording or sample used.',
  sourcePlatform: 'MixStil Deterministic Foundation Renderer',
  sourceUrl: 'internal://snooze/procedural-foundation-pads-v1',
  sourceCreator: 'MixStil',
  licenseName: 'MixStil Internal Generated Asset Policy',
  licenseUrl: 'internal://snooze/asset-policy',
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  attributionRequired: false,
  rawRedistributionAllowed: false,
  qaStatus: 'approved',
} satisfies StemSeed));

const supplyGapBatch01Stems: StemSeed[] = [
  {
    id: 'stem_batch09_room_apartment_small',
    name: 'Small Apartment Room Tone',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/room_apartment_small.mp3',
    tags: ['Room Tone', 'Indoor', 'Apartment', 'No Human Voice', 'Batch 09'],
    defaultVolume: 22,
    description: 'Authentic low-event-density room tone recorded inside a small apartment.',
    sourceItemId: 'room_apartment_small',
    sourcePath: 'authentic-indoor-review/2026-07-14/room_apartment_small.mp3',
    fileSha256: 'ea95a25bfec33a1d37375418f842b5f875b77b1eb460c1d8dced055a83a6d718',
    qaNotes: 'CC0 source hash 7fed2f5ab6ea19de51f0de71e31e124dee7399364d8e5821b87c31fdb4a9b0fb. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Freesound via Openverse',
    sourceUrl: 'https://freesound.org/people/leonelmail/sounds/329568',
    sourceCreator: 'leonelmail',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 46.068, sampleRate: 48000, channels: 2, integratedLufs: -33.88, truePeakDb: -19.52, maxVolumeDb: -19.52, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: '7fed2f5ab6ea19de51f0de71e31e124dee7399364d8e5821b87c31fdb4a9b0fb', loopQaLufs: -29.96 } },
  },
  {
    id: 'stem_batch09_room_bedroom_night',
    name: 'Bedroom Night Room Tone',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/room_bedroom_night.mp3',
    tags: ['Room Tone', 'Bedroom', 'Night', 'No Human Voice', 'Batch 09'],
    defaultVolume: 22,
    description: 'Authentic quiet bedroom room tone with faint distant exterior movement.',
    sourceItemId: 'room_bedroom_night',
    sourcePath: 'authentic-indoor-review/2026-07-14/room_bedroom_night.mp3',
    fileSha256: '78ff1edd3566da4d37d6a3e90d43ba0ab0c24559de8b970432616cba9811c505',
    qaNotes: 'CC0 source hash 994ad9ddd65aec5615cd88c2450d39b8cbf2e44cf1a6171ececbd9014fc51af2. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Freesound via Openverse',
    sourceUrl: 'https://freesound.org/people/franciscopcoutinho/sounds/466123',
    sourceCreator: 'franciscopcoutinho',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 180.353, sampleRate: 48000, channels: 2, integratedLufs: -67.62, truePeakDb: -50.21, maxVolumeDb: -50.21, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: '994ad9ddd65aec5615cd88c2450d39b8cbf2e44cf1a6171ececbd9014fc51af2', loopQaLufs: -32.38 } },
  },
  {
    id: 'stem_batch09_room_office_distant_traffic',
    name: 'Office Room Tone with Distant Traffic',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/room_office_distant_traffic.mp3',
    tags: ['Room Tone', 'Office', 'Distant Traffic', 'Focus', 'No Human Voice', 'Batch 09'],
    defaultVolume: 23,
    description: 'Authentic office room tone with a diffuse distant-road bed.',
    sourceItemId: 'room_office_distant_traffic',
    sourcePath: 'authentic-indoor-review/2026-07-14/room_office_distant_traffic.mp3',
    fileSha256: '6b15ba20588fcae2891db2415133fabc37c45812e0a0c15ac02d14dc1f087d3c',
    qaNotes: 'CC0 source hash 7e8060be99b6afb0049e1a5aab9cb41054c3bfc6d835ea16f37a2f2de4425d97. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Freesound via Openverse',
    sourceUrl: 'https://freesound.org/people/mzui/sounds/135097',
    sourceCreator: 'mzui',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 66.327, sampleRate: 48000, channels: 2, integratedLufs: -49.37, truePeakDb: -35.94, maxVolumeDb: -35.94, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: '7e8060be99b6afb0049e1a5aab9cb41054c3bfc6d835ea16f37a2f2de4425d97', loopQaLufs: -30.03 } },
  },
  {
    id: 'stem_batch09_fan_deep_ventilation',
    name: 'Deep Ventilation Room Tone',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/fan_deep_ventilation.mp3',
    tags: ['Fan', 'Ventilation', 'Indoor', 'Masking', 'No Human Voice', 'Batch 09'],
    defaultVolume: 25,
    description: 'Authentic deep, steady indoor ventilation and fan room tone.',
    sourceItemId: 'fan_deep_ventilation',
    sourcePath: 'authentic-indoor-review/2026-07-14/fan_deep_ventilation.mp3',
    fileSha256: '6865b80d5db6379e3799f27f1dd3520b1c40ead00f1c162a0c43519058fe637e',
    qaNotes: 'CC0 source hash db2dff0746a90178be31e751b64d4f5ec368b177d852129ca5149d17d7c90420. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Freesound via Openverse',
    sourceUrl: 'https://freesound.org/people/Kinoton/sounds/503255',
    sourceCreator: 'Kinoton',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 185.415, sampleRate: 48000, channels: 2, integratedLufs: -41.31, truePeakDb: -28.63, maxVolumeDb: -28.63, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: 'db2dff0746a90178be31e751b64d4f5ec368b177d852129ca5149d17d7c90420', loopQaLufs: -30.04 } },
  },
  {
    id: 'stem_batch09_fan_mine_ventilation',
    name: 'Mine Ventilation Fan',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/fan_mine_ventilation.mp3',
    tags: ['Fan', 'Ventilation', 'Industrial', 'Focus', 'No Human Voice', 'Batch 09'],
    defaultVolume: 23,
    description: 'Authentic steady mine ventilation-fan recording with a mechanical airflow texture.',
    sourceItemId: 'fan_mine_ventilation',
    sourcePath: 'authentic-indoor-review/2026-07-14/fan_mine_ventilation.mp3',
    fileSha256: '27564fd49b58bb50ef674c608ae9cfa4c538e3d86cc2cf67b32ff5565cef1d46',
    qaNotes: 'CC BY source hash 02e12351aac5300df5b6b668ac6e9e0baf690632532f1673464d10c8d9a802b1. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:WWS_Ventilationfan.ogg',
    sourceCreator: 'Work With Sounds / Technical Museum of Slovenia',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: true, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 72.997, sampleRate: 48000, channels: 2, integratedLufs: -13.01, truePeakDb: -1.41, maxVolumeDb: -1.41, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: '02e12351aac5300df5b6b668ac6e9e0baf690632532f1673464d10c8d9a802b1', loopQaLufs: -29.97 } },
  },
  {
    id: 'stem_batch09_train_taiwan_ep727',
    name: 'Taiwan Rail Car EP727 Interior',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/train_taiwan_ep727.mp3',
    tags: ['Train', 'Rail Carriage', 'Interior', 'Focus', 'No Human Voice', 'Batch 09'],
    defaultVolume: 22,
    description: 'Authentic interior Taiwan rail-car ambience with steady carriage movement.',
    sourceItemId: 'train_taiwan_ep727',
    sourcePath: 'authentic-indoor-review/2026-07-14/train_taiwan_ep727.mp3',
    fileSha256: '6c6786aefec674dfa7f6e01e09b28a78b975ed0a4858621f38db62583e3806b6',
    qaNotes: 'CC0 source hash 014f05f4424fcaa0c72899e40414d87d39c6fbe85bb79142f6df61548826c172. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Taiwan_railways_EP727_train_cars_sounds.ogg',
    sourceCreator: 'Jidanni',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 148.561, sampleRate: 48000, channels: 2, integratedLufs: -28.44, truePeakDb: -5.33, maxVolumeDb: -5.33, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: '014f05f4424fcaa0c72899e40414d87d39c6fbe85bb79142f6df61548826c172', loopQaLufs: -31.17 } },
  },
  {
    id: 'stem_batch09_air_conditioner_hum_1',
    name: 'Air Conditioner Hum 1',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/air_conditioner_hum_1.mp3',
    tags: ['Air Conditioner', 'Hum', 'Indoor', 'Masking', 'No Human Voice', 'Batch 09'],
    defaultVolume: 24,
    description: 'Authentic steady air-conditioner hum for indoor masking and focus scenes.',
    sourceItemId: 'air_conditioner_hum_1',
    sourcePath: 'authentic-indoor-review/2026-07-14/air_conditioner_hum_1.mp3',
    fileSha256: '8be38fea02dd9464b56a160a16b64b4c303b9c3e522dedf042ee3a2728d2711a',
    qaNotes: 'CC BY source hash bac546ddd06be356facb3dd9c842635afad312412fe058e14d7e2fb07e4f34d0. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Air_conditioner_hum_(Gravity_Sound).wav',
    sourceCreator: 'Gravity Sound',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: true, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 14, sampleRate: 48000, channels: 2, integratedLufs: -19.5, truePeakDb: -6.98, maxVolumeDb: -6.98, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: 'bac546ddd06be356facb3dd9c842635afad312412fe058e14d7e2fb07e4f34d0', loopQaLufs: -29.83 } },
  },
  {
    id: 'stem_batch09_air_conditioner_hum_2',
    name: 'Air Conditioner Hum 2',
    category: 'Nature',
    audioUrl: '/audio/authentic-indoor-review/2026-07-14/air_conditioner_hum_2.mp3',
    tags: ['Air Conditioner', 'Hum', 'Indoor', 'Focus', 'No Human Voice', 'Batch 09'],
    defaultVolume: 24,
    description: 'A second authentic air-conditioner hum with a distinct steady spectral balance.',
    sourceItemId: 'air_conditioner_hum_2',
    sourcePath: 'authentic-indoor-review/2026-07-14/air_conditioner_hum_2.mp3',
    fileSha256: '766525b191cf4f2871ccd45fe3c3b1b8e53d4e94d1649f1481acf4c35df4899d',
    qaNotes: 'CC BY source hash bb9e9358e2b7041cab8f35d93e712727ddccc3490d075ef907b0923bbb0a1861. Basic/no-voice, 10-minute loop, Recipe V2 combination, diversity, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Air_conditioner_hum_2_(Gravity_Sound).wav',
    sourceCreator: 'Gravity Sound',
    licenseName: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: true, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-loop-qa-v1', durationSeconds: 18, sampleRate: 48000, channels: 2, integratedLufs: -27.04, truePeakDb: -16.8, maxVolumeDb: -16.8, details: { batch: 'supply_gap_batch_01', sourceMasterSha256: 'bb9e9358e2b7041cab8f35d93e712727ddccc3490d075ef907b0923bbb0a1861', loopQaLufs: -30.05 } },
  },
  {
    id: 'stem_local_procedural_focus_neutral_clean',
    name: 'Focus Neutral Clean',
    category: 'Music',
    audioUrl: '/audio/music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3',
    tags: ['Focus', 'Ambient Pad', 'Neutral', 'No Beat', 'No Human Voice'],
    defaultVolume: 24,
    description: 'A deterministic neutral ambient pad designed for unobtrusive deep focus.',
    sourceItemId: 'procedural_focus_neutral_clean_seed_75101',
    sourcePath: 'music/local-review/2026-07-15/procedural_focus_neutral_clean.mp3',
    fileSha256: '52e6aebd50826233116d8397d1c5190b4cae43553e7cd2fe2c687c27caa92b25',
    qaNotes: 'Project-owned deterministic synthesis, profile focus_neutral, seed 75101, WAV master hash f8b69b663fbafc60e086fdaaaf3927880da7d0c6cd314ffdcb7ff44d2a3e8930. Machine, diversity, loop, Recipe V2 combination, no-voice, and listening gates passed 2026-07-15.',
    sourcePlatform: 'MixStil Deterministic Foundation Renderer', sourceUrl: 'internal://snooze/procedural-foundation-pads-v1', sourceCreator: 'MixStil',
    licenseName: 'MixStil Internal Generated Asset Policy', licenseUrl: 'internal://snooze/asset-policy',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-focus-qa-v1', durationSeconds: 60, sampleRate: 48000, channels: 2, integratedLufs: -25, truePeakDb: -18.63, maxVolumeDb: -18.63, details: { batch: 'supply_gap_batch_01', profile: 'focus_neutral', seed: 75101, wavMasterSha256: 'f8b69b663fbafc60e086fdaaaf3927880da7d0c6cd314ffdcb7ff44d2a3e8930' } },
  },
  {
    id: 'stem_local_procedural_focus_warm_mid',
    name: 'Focus Warm Mid',
    category: 'Music',
    audioUrl: '/audio/music/local-review/2026-07-15/procedural_focus_warm_mid.mp3',
    tags: ['Focus', 'Ambient Pad', 'Warm', 'No Beat', 'No Human Voice'],
    defaultVolume: 23,
    description: 'A deterministic warm midrange ambient pad for calm, sustained focus.',
    sourceItemId: 'procedural_focus_warm_mid_seed_75201',
    sourcePath: 'music/local-review/2026-07-15/procedural_focus_warm_mid.mp3',
    fileSha256: '76e8053d04b37a34d6033a43ac574f5210cb6ebe5c5702f5ce82ec6365b3ef8b',
    qaNotes: 'Project-owned deterministic synthesis, profile focus_warm_mid, seed 75201, WAV master hash b30291e4d1c48a1c37dbd17adc1329aaa815c7f43274c76ea235cb6700d5dc5e. Machine, diversity, loop, Recipe V2 combination, no-voice, and listening gates passed 2026-07-15.',
    sourcePlatform: 'MixStil Deterministic Foundation Renderer', sourceUrl: 'internal://snooze/procedural-foundation-pads-v1', sourceCreator: 'MixStil',
    licenseName: 'MixStil Internal Generated Asset Policy', licenseUrl: 'internal://snooze/asset-policy',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-focus-qa-v1', durationSeconds: 60, sampleRate: 48000, channels: 2, integratedLufs: -25, truePeakDb: -18.89, maxVolumeDb: -18.89, details: { batch: 'supply_gap_batch_01', profile: 'focus_warm_mid', seed: 75201, wavMasterSha256: 'b30291e4d1c48a1c37dbd17adc1329aaa815c7f43274c76ea235cb6700d5dc5e' } },
  },
  {
    id: 'stem_local_procedural_focus_low_anchor',
    name: 'Focus Low Anchor',
    category: 'Music',
    audioUrl: '/audio/music/local-review/2026-07-15/procedural_focus_low_anchor.mp3',
    tags: ['Focus', 'Ambient Pad', 'Low Anchor', 'No Beat', 'No Human Voice'],
    defaultVolume: 22,
    description: 'A deterministic low-register ambient anchor without pulse or melodic hooks.',
    sourceItemId: 'procedural_focus_low_anchor_seed_75301',
    sourcePath: 'music/local-review/2026-07-15/procedural_focus_low_anchor.mp3',
    fileSha256: '04cacad3bb05679c861b2b9770f2391b3cd2966318bb6e089d3d402add3bd5bc',
    qaNotes: 'Project-owned deterministic synthesis, profile focus_low_anchor, seed 75301, WAV master hash cf3291d63413df68e0c7c0a2dbe34eb5c74a3aea434c9698e5ecd804c82380cf. Machine, diversity, loop, Recipe V2 combination, no-voice, and listening gates passed 2026-07-15.',
    sourcePlatform: 'MixStil Deterministic Foundation Renderer', sourceUrl: 'internal://snooze/procedural-foundation-pads-v1', sourceCreator: 'MixStil',
    licenseName: 'MixStil Internal Generated Asset Policy', licenseUrl: 'internal://snooze/asset-policy',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-focus-qa-v1', durationSeconds: 60, sampleRate: 48000, channels: 2, integratedLufs: -25, truePeakDb: -18.78, maxVolumeDb: -18.78, details: { batch: 'supply_gap_batch_01', profile: 'focus_low_anchor', seed: 75301, wavMasterSha256: 'cf3291d63413df68e0c7c0a2dbe34eb5c74a3aea434c9698e5ecd804c82380cf' } },
  },
  {
    id: 'stem_local_procedural_focus_open_air',
    name: 'Focus Open Air',
    category: 'Music',
    audioUrl: '/audio/music/local-review/2026-07-15/procedural_focus_open_air.mp3',
    tags: ['Focus', 'Ambient Pad', 'Spacious', 'No Beat', 'No Human Voice'],
    defaultVolume: 22,
    description: 'A deterministic spacious ambient pad kept soft enough for sustained focus.',
    sourceItemId: 'procedural_focus_open_air_seed_75401',
    sourcePath: 'music/local-review/2026-07-15/procedural_focus_open_air.mp3',
    fileSha256: '90089c51706d60051089a4249f17accf223fae4b3c10d799c571d4cb5077bb17',
    qaNotes: 'Project-owned deterministic synthesis, profile focus_open_air, seed 75401, WAV master hash 0cca2217325f65b90424410ddad4e42d238a25d8fe6d1e86fe808f77afca12a2. Machine, diversity, loop, Recipe V2 combination, no-voice, and listening gates passed 2026-07-15.',
    sourcePlatform: 'MixStil Deterministic Foundation Renderer', sourceUrl: 'internal://snooze/procedural-foundation-pads-v1', sourceCreator: 'MixStil',
    licenseName: 'MixStil Internal Generated Asset Policy', licenseUrl: 'internal://snooze/asset-policy',
    commercialUseAllowed: true, derivativeUseAllowed: true, attributionRequired: false, rawRedistributionAllowed: false, qaStatus: 'approved',
    acousticFeatures: { analysisVersion: 'supply-gap-batch-01-focus-qa-v1', durationSeconds: 60, sampleRate: 48000, channels: 2, integratedLufs: -25, truePeakDb: -19.06, maxVolumeDb: -19.06, details: { batch: 'supply_gap_batch_01', profile: 'focus_open_air', seed: 75401, wavMasterSha256: '0cca2217325f65b90424410ddad4e42d238a25d8fe6d1e86fe808f77afca12a2' } },
  },
];

const supplyGapBatch02Stems: StemSeed[] = [
  {
    id: 'stem_supply_gap_02_aircraft_cabin_csnmedia_381174',
    name: 'Steady Jet Cabin Rumble',
    category: 'Nature',
    audioUrl: '/audio/supply-gap-batch-02/review/2026-07-15/aircraft_cabin_csnmedia_381174.mp3',
    tags: ['Aircraft Cabin', 'Jet', 'Travel', 'Focus', 'Masking', 'No Human Voice', 'Supply Gap Batch 02'],
    defaultVolume: 24,
    description: 'Authentic steady aircraft-cabin rumble for distraction masking and sustained focus.',
    sourceItemId: 'aircraft_cabin_csnmedia_381174',
    sourcePath: 'supply-gap-batch-02/review/2026-07-15/aircraft_cabin_csnmedia_381174.mp3',
    fileSha256: 'bf833f605bec07e8e20d8f7b477c2cd5ffbaf0bcd1447184395d3ddc80977a61',
    qaNotes: 'CC0 source hash e2c2a8e10b731c904fe1c3e9c1f002f20ffacc5607b1efff852c707bd8d89e7b. Linear-gain review master, semantic identity, no-human-voice, low-stimulation, 10-minute loop, Recipe V2 combination, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Freesound',
    sourceUrl: 'https://freesound.org/people/csnmedia/sounds/381174/',
    sourceCreator: 'csnmedia',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true,
    derivativeUseAllowed: true,
    attributionRequired: false,
    rawRedistributionAllowed: false,
    qaStatus: 'approved',
    acousticFeatures: {
      analysisVersion: 'supply-gap-batch-02-source-and-loop-qa-v1',
      durationSeconds: 102.231,
      sampleRate: 48000,
      channels: 2,
      integratedLufs: -30,
      truePeakDb: -13.18,
      maxVolumeDb: -13.18,
      details: {
        batch: 'supply_gap_batch_02',
        sourceSha256: 'e2c2a8e10b731c904fe1c3e9c1f002f20ffacc5607b1efff852c707bd8d89e7b',
        normalizedFileSha256: 'bf833f605bec07e8e20d8f7b477c2cd5ffbaf0bcd1447184395d3ddc80977a61',
        loopQaLufs: -30.02,
        loopJoinRmsDeltaDb: 1.81,
        loopDigitalSilence100msFrames: 0,
      },
    },
  },
  {
    id: 'stem_supply_gap_02_airbus_a330_cabin_fillsoko_456092',
    name: 'Airbus A330 Cabin Ambience',
    category: 'Nature',
    audioUrl: '/audio/supply-gap-batch-02/review/2026-07-15/airbus_a330_cabin_fillsoko_456092.mp3',
    tags: ['Aircraft Cabin', 'Airbus A330', 'Travel', 'Focus', 'Masking', 'No Human Voice', 'Supply Gap Batch 02'],
    defaultVolume: 24,
    description: 'Authentic Airbus A330 interior ambience with a restrained, steady broadband cabin texture.',
    sourceItemId: 'airbus_a330_cabin_fillsoko_456092',
    sourcePath: 'supply-gap-batch-02/review/2026-07-15/airbus_a330_cabin_fillsoko_456092.mp3',
    fileSha256: '3068f4fb4c87a9435f5ede014680efda78566708ccb42dde734239e536fdbabb',
    qaNotes: 'CC0 source hash 09d5148b025596e4b182b04fb1b97c6add7a1e46224f6a467c7bfa30e469f4f2. Linear-gain review master, semantic identity, no-human-voice, low-stimulation, 10-minute loop, Recipe V2 combination, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Freesound',
    sourceUrl: 'https://freesound.org/people/FillSoko/sounds/456092/',
    sourceCreator: 'FillSoko',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true,
    derivativeUseAllowed: true,
    attributionRequired: false,
    rawRedistributionAllowed: false,
    qaStatus: 'approved',
    acousticFeatures: {
      analysisVersion: 'supply-gap-batch-02-source-and-loop-qa-v1',
      durationSeconds: 154.786,
      sampleRate: 48000,
      channels: 2,
      integratedLufs: -30,
      truePeakDb: -18.23,
      maxVolumeDb: -18.23,
      details: {
        batch: 'supply_gap_batch_02',
        sourceSha256: '09d5148b025596e4b182b04fb1b97c6add7a1e46224f6a467c7bfa30e469f4f2',
        normalizedFileSha256: '3068f4fb4c87a9435f5ede014680efda78566708ccb42dde734239e536fdbabb',
        loopQaLufs: -30.07,
        loopJoinRmsDeltaDb: 0.35,
        loopDigitalSilence100msFrames: 0,
      },
    },
  },
  {
    id: 'stem_supply_gap_02_train_taiwan_all_night_variant',
    name: 'Taiwan Rail Car All-night',
    category: 'Nature',
    audioUrl: '/audio/supply-gap-batch-02/review/2026-07-15/train_taiwan_all_night_variant.mp3',
    tags: ['Train', 'Rail Carriage', 'All Night', 'Sleep', 'Low Stimulation', 'No Human Voice', 'Supply Gap Batch 02'],
    defaultVolume: 22,
    description: 'A lower-brightness, low-stimulation variant of an authentic Taiwan rail-car interior recording for all-night masking.',
    sourceItemId: 'train_taiwan_all_night_variant',
    sourcePath: 'supply-gap-batch-02/review/2026-07-15/train_taiwan_all_night_variant.mp3',
    fileSha256: '21af53d1323cbc9f3bf3db5da59968f02d50ae7a3ba62a32d34c06dc8c6a6d4e',
    qaNotes: 'CC0 source hash 014f05f4424fcaa0c72899e40414d87d39c6fbe85bb79142f6df61548826c172. High-pass, low-pass, soft-compression variant; semantic identity, no-human-voice, low-stimulation, 10-minute loop, Recipe V2 combination, and project-owner listening gates passed 2026-07-15.',
    sourcePlatform: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Taiwan_railways_EP727_train_cars_sounds.ogg',
    sourceCreator: 'Jidanni',
    licenseName: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true,
    derivativeUseAllowed: true,
    attributionRequired: false,
    rawRedistributionAllowed: false,
    qaStatus: 'approved',
    acousticFeatures: {
      analysisVersion: 'supply-gap-batch-02-source-and-loop-qa-v1',
      durationSeconds: 148.561,
      sampleRate: 48000,
      channels: 2,
      integratedLufs: -33.83,
      truePeakDb: -16.94,
      maxVolumeDb: -16.94,
      details: {
        batch: 'supply_gap_batch_02',
        sourceSha256: '014f05f4424fcaa0c72899e40414d87d39c6fbe85bb79142f6df61548826c172',
        normalizedFileSha256: '21af53d1323cbc9f3bf3db5da59968f02d50ae7a3ba62a32d34c06dc8c6a6d4e',
        processing: 'highpass_35_lowpass_2400_soft_compression',
        loopQaLufs: -33.86,
        loopJoinRmsDeltaDb: 0.11,
        loopDigitalSilence100msFrames: 0,
      },
    },
  },
];

const rejectedBatch02Ids = new Set(['1330']);

const batch02Stems: StemSeed[] = readFileSync(new URL('../docs/asset-batch-02.tsv', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .flatMap((line) => {
    const [itemId, slug, name, category, sourcePath, tags, defaultVolume, recommendedScene] = line.split('\t');
    const isRejected = rejectedBatch02Ids.has(itemId);
    const audioUrl = category === 'Accent'
      ? `/audio/accent/batch-02/${slug}.wav`
      : `/audio/nature/batch-02/${slug}.wav`;
    const audioBytes = publicAudioBytes(audioUrl);
    if (!audioBytes) return [];

    return [{
      id: `stem_mixkit_${itemId}`,
      name,
      category: category as StemSeed['category'],
      audioUrl,
      tags: tags.split(','),
      defaultVolume: Number(defaultVolume),
      description: `${name} for ${recommendedScene} soundscape layers.`,
      sourceItemId: itemId,
      sourcePath,
      fileSha256: createHash('sha256').update(audioBytes).digest('hex'),
      qaStatus: isRejected ? 'rejected' : 'approved',
      qaNotes: isRejected
        ? 'Rejected 2026-07-13 after human listening: sustained whooshing content is inconsistent with the Campfire Crackles label and can be perceived as water or wind. Do not route or export.'
        : `Official Mixkit WAV; decode and hash verified. Recommended scene: ${recommendedScene}.`,
    }];
  });

const approvedMusicItemIds = new Set(['614', '587', '584', '109', '127', '493', '441', '251']);
const rejectedMusicItemIds = new Set(['588', '593', '522']);
const pendingAudioProductionRows = parseTsv(readFileSync(new URL('../docs/pending-audio-remediated-production-2026-07-13.tsv', import.meta.url), 'utf8'));
const approvedPendingAudioProductionByStemId = new Map(pendingAudioProductionRows
  .filter((row) => row.promotion_status === 'approved')
  .map((row) => [row.stem_id, row]));

const batch03MusicStems: StemSeed[] = readFileSync(new URL('../docs/asset-batch-03-music.tsv', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .flatMap((line) => {
    const [itemId, slug, name, family, tags, defaultVolume, recommendedScene] = line.split('\t');
    const stemId = `stem_mixkit_music_${itemId}`;
    const production = approvedPendingAudioProductionByStemId.get(stemId);
    const isApproved = approvedMusicItemIds.has(itemId);
    const isRejected = rejectedMusicItemIds.has(itemId);
    const audioUrl = production?.final_audio_url ?? (isApproved
      ? `/audio/music/reviewed-2026-07-11/${slug}.mp3`
      : `/audio/music/batch-03/${slug}.mp3`);
    const audioBytes = publicAudioBytes(audioUrl);
    if (!audioBytes) return [];

    return [{
      id: stemId,
      name,
      category: 'Music',
      audioUrl,
      tags: tags.split(','),
      defaultVolume: Number(defaultVolume),
      description: `${name}, a ${family} layer for ${recommendedScene}.`,
      sourceItemId: itemId,
      sourcePath: production?.final_local_path?.replace(/^public\/audio\//, '') ?? `music/${itemId}/${itemId}.mp3`,
      fileSha256: createHash('sha256').update(audioBytes).digest('hex'),
      qaNotes: production
        ? `Official Mixkit MP3; project-owner production listening QA approved 2026-07-13, then remediated to production MP3 with machine QA pass. Decode, hash, license metadata, and final production URL verified. Derivative mixes only; raw redistribution prohibited. Original blocker: ${production.original_blocker}.`
        : isApproved
        ? `Official Mixkit MP3; normalized review copy at 48kHz with -2 dBTP target. Decode, hash, license metadata, and project-owner listening QA verified 2026-07-11. Derivative mixes only; raw redistribution prohibited. Content ID claims remain a monitored platform risk.`
        : isRejected
          ? itemId === '522'
            ? `Rejected 2026-07-13 after production listening QA: project owner explicitly rejected Relaxing Nature Guitar while approving the rest of the pending production QA queue. Do not route or export.`
            : `Rejected 2026-07-13 after project-owner listening QA: the opening has a dark, suspenseful character that can feel frightening at night and is unsuitable for sleep, calm, or low-stimulation focus. Do not route or export.`
        : `Official Mixkit MP3; decode and hash verified. Recommended scene: ${recommendedScene}. Content ID and listening QA are still required before publication.`,
      sourcePlatform: 'Mixkit',
      sourceUrl: `https://mixkit.co/free-stock-music/?q=${encodeURIComponent(name)}`,
      sourceCreator: 'Mixkit contributor',
      licenseName: 'Mixkit Stock Music Free License',
      licenseUrl: MIXKIT_LICENSE_URL,
      commercialUseAllowed: true,
      derivativeUseAllowed: true,
      attributionRequired: false,
      rawRedistributionAllowed: false,
      qaStatus: production || isApproved ? 'approved' : isRejected ? 'rejected' : 'needs_review',
    } satisfies StemSeed];
  });

const batch07BusinessPassRows = parseTsv(readFileSync(new URL('../docs/batch-07-music-business-qa-result.tsv', import.meta.url), 'utf8'));
const batch07BusinessPassIds = new Set(
  batch07BusinessPassRows
    .filter((row) => row.business_fit_status === 'business_fit_pass')
    .map((row) => row.candidate_id),
);
const batch07ProductionRows = parseTsv(readFileSync(new URL('../docs/asset-batch-07-production-promotion.tsv', import.meta.url), 'utf8'));
const batch07ProductionById = new Map(batch07ProductionRows
  .filter((row) => row.promotion_status === 'approved')
  .map((row) => [row.candidate_id, row]));

const batch07MusicStems: StemSeed[] = parseTsv(readFileSync(new URL('../docs/asset-batch-07-remediated-music.tsv', import.meta.url), 'utf8'))
  .filter((row) => batch07BusinessPassIds.has(row.candidate_id))
  .flatMap((row) => {
    const sourceRows = parseTsv(readFileSync(new URL('../docs/asset-batch-07-downloaded-music.tsv', import.meta.url), 'utf8'));
    const source = sourceRows.find((item) => item.candidate_id === row.candidate_id);
    if (!source) throw new Error(`Missing Batch 07 source row for ${row.candidate_id}`);
    const production = batch07ProductionById.get(row.candidate_id);
    const audioUrl = production?.final_audio_url ?? `/${row.remediated_local_path.replace(/^public\//, '')}`;
    const audioBytes = publicAudioBytes(audioUrl);
    if (!audioBytes) return [];
    const isCcBy = source.attribution_required === 'true';
    const goals = source.target_goals.split(',').map((goal) => goal.trim()).filter(Boolean);
    const tags = [...goals.map((goal) => goal === 'calm' ? 'Calm' : goal === 'sleep' ? 'Sleep' : goal === 'focus' ? 'Focus' : goal), 'Music', 'Batch 07', production ? 'Production Approved' : 'Business Fit Passed'];

    return [{
      id: `stem_batch07_${row.candidate_id.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`,
      name: row.title,
      category: 'Music',
      audioUrl,
      tags,
      defaultVolume: goals.includes('sleep') ? 22 : goals.includes('focus') ? 24 : 23,
      description: `${row.title}, a Batch 07 music candidate for ${goals.join(', ')} scenes.`,
      sourceItemId: row.candidate_id,
      sourcePath: (production?.final_local_path ?? row.remediated_local_path).replace(/^public\/audio\//, ''),
      fileSha256: createHash('sha256').update(audioBytes).digest('hex'),
      qaNotes: production
        ? `Batch 07 FMA/CC0 production promotion approved 2026-07-13. Individual track CC0 evidence, user listening, business-fit review, normalized review copy, hash, and editorial warning acceptance recorded. Residual platform claim risk is monitored; raw third-party download remains disabled. Accepted warning: ${production.warning_acceptance}`
        : `Batch 07 music candidate. Rights evidence passed 2026-07-13 and business-fit listening passed 2026-07-13. Normalized review copy is seeded for internal review only. Remaining blockers before approval: editorial acceptance or manual edits for machine warnings (${row.machine_qa_notes}), platform claim/Content ID check, final routing metadata, and final qa_status approval.`,
      sourcePlatform: source.source_platform,
      sourceUrl: source.source_url,
      sourceCreator: source.creator,
      licenseName: source.license_name,
      licenseUrl: source.license_url,
      commercialUseAllowed: source.commercial_use_allowed === 'true',
      derivativeUseAllowed: source.derivative_use_allowed === 'true',
      attributionRequired: isCcBy,
      rawRedistributionAllowed: false,
      qaStatus: production ? 'approved' : 'needs_review',
    } satisfies StemSeed];
  });

const batch04NatureCandidates: StemSeed[] = readFileSync(new URL('../docs/asset-batch-04-nature.tsv', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .flatMap((line) => {
    const [itemId, slug, name, sourcePath, tags, defaultVolume, recommendedScene] = line.split('\t');
    const candidateId = `b04_mixkit_${itemId}`;
    const stemId = `stem_mixkit_${itemId}`;
    const production = approvedPendingAudioProductionByStemId.get(stemId);
    const isApproved = noHumanMachinePassIds.has(candidateId);
    const isRejected = noHumanMachineFailIds.has(candidateId);
    const audioUrl = production?.final_audio_url ?? `/audio/nature/batch-04/${slug}.wav`;
    const audioBytes = publicAudioBytes(audioUrl);
    if (!audioBytes) return [];

    return [{
      id: stemId,
      name,
      category: 'Nature',
      audioUrl,
      tags: tags.split(','),
      defaultVolume: Number(defaultVolume),
      description: `${name}, a candidate nature layer for ${recommendedScene}.`,
      sourceItemId: itemId,
      sourcePath: production?.final_local_path?.replace(/^public\/audio\//, '') ?? sourcePath,
      fileSha256: createHash('sha256').update(audioBytes).digest('hex'),
      qaNotes: production
        ? `Official Mixkit WAV source; no-human listening QA passed, project-owner production listening QA approved 2026-07-13, then remediated to production MP3 with machine QA pass. Decode, hash, license metadata, and final production URL verified. Raw redistribution prohibited; use only as an internal ingredient or rendered derivative mix. Original blocker: ${production.original_blocker}.`
        : isApproved
        ? `Official Mixkit WAV; decode, hash, machine QA, and no-human-voice listening QA passed 2026-07-13. Recommended scene: ${recommendedScene}. Raw redistribution prohibited; use only as an internal ingredient or rendered derivative mix.`
        : isRejected
          ? `Rejected by machine QA 2026-07-13 after no-human candidate review. Recommended scene was ${recommendedScene}; do not route or export until remediated.`
          : `Official Mixkit WAV; decode and hash verified. Recommended scene: ${recommendedScene}. No-human-voice listening gate passed, but technical warning remains; loop, peak, trim, or noise-floor QA is still required before publication.`,
      sourcePlatform: 'Mixkit',
      sourceUrl: `https://mixkit.co/free-sound-effects/${sourcePath}`,
      sourceCreator: 'Mixkit contributor',
      licenseName: 'Mixkit Sound Effects Free License',
      licenseUrl: MIXKIT_LICENSE_URL,
      commercialUseAllowed: true,
      derivativeUseAllowed: true,
      attributionRequired: false,
      rawRedistributionAllowed: false,
      qaStatus: production || isApproved ? 'approved' : isRejected ? 'rejected' : 'needs_review',
    } satisfies StemSeed];
  });

const batch05SourceById = new Map(parseTsv(readFileSync(new URL('../docs/asset-batch-05-open-audio-candidates.tsv', import.meta.url), 'utf8'))
  .map((row) => [row.candidate_id, row]));

const batch05OpenAudioStems: StemSeed[] = noHumanMachineQaRows
  .filter((row) => row.source_batch === 'batch-05' && noHumanMachinePassIds.has(row.candidate_id))
  .flatMap((row) => {
    const source = batch05SourceById.get(row.candidate_id);
    if (!source) throw new Error(`Missing Batch 05 source row for ${row.candidate_id}`);
    const sourceTitle = row.source_title.replace(/^File:/, '').replace(/\.[^.]+$/, '');
    const displayName = sourceTitle.replaceAll('_', ' ');
    const isBowl = row.scene_family === 'bowl';
    const approvedFileName = `${sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}.ogg`;
    const audioUrl = `/audio/accent/batch-05/${approvedFileName}`;
    const audioBytes = publicAudioBytes(audioUrl);
    if (!audioBytes) return [];
    const snapshotName = row.candidate_id === 'b05_commons_001'
      ? 'singingbowl1.source.html'
      : row.candidate_id === 'b05_commons_002'
        ? 'singingbowl2.source.html'
        : 'synthetic_bell_sound.source.html';

    return [{
      id: `stem_${row.candidate_id}`,
      name: displayName,
      category: 'Accent',
      audioUrl,
      tags: [row.scene_family, 'Accent', isBowl ? 'Meditation Bowl' : 'Bell', 'No Human Voice'],
      defaultVolume: isBowl ? 12 : 10,
      description: `${displayName}, a public-domain or CC0 accent for meditation soundscapes.`,
      sourceItemId: row.candidate_id,
      sourcePath: `accent/batch-05/${approvedFileName}`,
      fileSha256: createHash('sha256').update(audioBytes).digest('hex'),
      qaNotes: `Wikimedia Commons open-audio source; decode, hash, machine QA, and no-human-voice listening QA passed 2026-07-13. Source and license snapshots recorded 2026-07-15 at docs/license-snapshots/batch-05/${snapshotName} and ${row.license_name === 'CC0' ? 'docs/license-snapshots/batch-05/cc0-1.0.license.html' : 'docs/license-snapshots/batch-05/public-domain.license.html'}. Product policy serves it as an ingredient in mixes rather than a public raw asset pack.`,
      sourcePlatform: row.source_platform,
      sourceUrl: row.source_url,
      sourceCreator: source.source_creator,
      licenseName: row.license_name,
      licenseUrl: row.license_name === 'CC0'
        ? 'https://creativecommons.org/publicdomain/zero/1.0/'
        : row.license_url || COMMONS_PUBLIC_DOMAIN_URL,
      commercialUseAllowed: true,
      derivativeUseAllowed: true,
      attributionRequired: false,
      rawRedistributionAllowed: true,
      qaStatus: 'approved',
    } satisfies StemSeed];
  });

const batch03VoiceCandidates: StemSeed[] = readFileSync(new URL('../docs/asset-batch-03-voice-candidates.tsv', import.meta.url), 'utf8')
  .trim()
  .split('\n')
  .slice(1)
  .flatMap((line) => {
    const [sourceId, slug, name, language, sourceFile, tags, defaultVolume, reviewNote] = line.split('\t');
    const audioUrl = `/audio/voice/candidates/${slug}.mp3`;
    const audioBytes = publicAudioBytes(audioUrl);
    if (!audioBytes) return [];

    return [{
      id: `stem_liaoyu_voice_${slug}`,
      name,
      category: 'Voice',
      audioUrl,
      tags: [...tags.split(','), language],
      defaultVolume: Number(defaultVolume),
      description: `${language} guided voice candidate for internal review.`,
      sourceItemId: sourceId,
      sourcePath: sourceFile,
      fileSha256: createHash('sha256').update(audioBytes).digest('hex'),
      qaNotes: `${reviewNote}. Decode, uniqueness, hash, and prohibited medical-claim scan passed.`,
      sourcePlatform: 'Liaoyu Edge TTS Pipeline',
      sourceUrl: `internal://liaoyu/generated/vocal/${sourceFile}`,
      sourceCreator: 'MixStil / Liaoyu',
      licenseName: 'Pending Edge TTS Output Rights Review',
      licenseUrl: 'internal://snooze/legal-review/edge-tts',
      commercialUseAllowed: false,
      derivativeUseAllowed: false,
      attributionRequired: true,
      rawRedistributionAllowed: false,
      qaStatus: 'needs_review',
    } satisfies StemSeed];
  });

export async function seedDatabase() {
  await createSchema();

  await query(
    `insert into users (id, username, email, avatar_url, role, subscription_tier)
     values
       ('user_alex', 'Alex R.', 'alex@snooze.local', '', 'creator', 'free'),
       ('user_serenity', 'Serenity Sounds', 'serenity@snooze.local', '', 'creator', 'pro')
     on conflict (id) do update set
       username = excluded.username,
       email = excluded.email,
       role = excluded.role,
       subscription_tier = excluded.subscription_tier,
       updated_at = now()`,
  );

  const stems = [
    ...approvedFinishedContentStems,
    ...approvedFoundationalElementStems,
    ...approvedMusicKitStems,
    ...mixkitStems,
    ...reviewedAuthenticStems,
    ...internalNoiseStems,
    ...proceduralMusicStems,
    ...supplyGapBatch01Stems,
    ...supplyGapBatch02Stems,
    ...batch02Stems,
    ...batch03MusicStems,
    ...batch07MusicStems,
    ...batch04NatureCandidates,
    ...batch05OpenAudioStems,
    ...batch03VoiceCandidates,
  ];

  for (const stem of stems) {
    await query(
      `insert into audio_stems (
         id, name, category, audio_url, is_premium, tags, default_volume, description,
         source_platform, source_url, source_item_id, source_creator,
         license_name, license_url, commercial_use_allowed, derivative_use_allowed,
         attribution_required, raw_redistribution_allowed, qa_status, qa_notes,
         file_sha256, imported_at
       ) values (
         $1, $2, $3, $4, false, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19, $20, now()
       )
       on conflict (id) do update set
         name = excluded.name,
         category = excluded.category,
         audio_url = excluded.audio_url,
         tags = excluded.tags,
         default_volume = excluded.default_volume,
         description = excluded.description,
         source_platform = excluded.source_platform,
         source_url = excluded.source_url,
         source_item_id = excluded.source_item_id,
         source_creator = excluded.source_creator,
         license_name = excluded.license_name,
         license_url = excluded.license_url,
         commercial_use_allowed = excluded.commercial_use_allowed,
         derivative_use_allowed = excluded.derivative_use_allowed,
         attribution_required = excluded.attribution_required,
         raw_redistribution_allowed = excluded.raw_redistribution_allowed,
         qa_status = excluded.qa_status,
         qa_notes = excluded.qa_notes,
         file_sha256 = excluded.file_sha256,
         imported_at = excluded.imported_at`,
      [
        stem.id,
        stem.name,
        stem.category,
        stem.audioUrl,
        stem.tags,
        stem.defaultVolume,
        stem.description,
        stem.sourcePlatform ?? 'Mixkit',
        stem.sourceUrl ?? `https://mixkit.co/free-sound-effects/${stem.sourcePath}`,
        stem.sourceItemId,
        stem.sourceCreator ?? 'Mixkit contributor',
        stem.licenseName ?? 'Mixkit Sound Effects Free License',
        stem.licenseUrl ?? MIXKIT_LICENSE_URL,
        stem.commercialUseAllowed ?? true,
        stem.derivativeUseAllowed ?? true,
        stem.attributionRequired ?? false,
        stem.rawRedistributionAllowed ?? false,
        stem.qaStatus ?? 'approved',
        stem.qaNotes,
        stem.fileSha256,
      ],
    );
    if (stem.acousticFeatures) {
      const features = stem.acousticFeatures;
      await query(
        `insert into stem_acoustic_features (
           stem_id, analysis_version, duration_seconds, sample_rate, channels,
           integrated_lufs, true_peak_db, mean_volume_db, max_volume_db, details, analyzed_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         on conflict (stem_id) do update set analysis_version = excluded.analysis_version,
           duration_seconds = excluded.duration_seconds, sample_rate = excluded.sample_rate,
           channels = excluded.channels, integrated_lufs = excluded.integrated_lufs,
           true_peak_db = excluded.true_peak_db, mean_volume_db = excluded.mean_volume_db,
           max_volume_db = excluded.max_volume_db, details = excluded.details, analyzed_at = now()`,
        [stem.id, features.analysisVersion, features.durationSeconds, features.sampleRate, features.channels,
          features.integratedLufs, features.truePeakDb, features.meanVolumeDb ?? null,
          features.maxVolumeDb, JSON.stringify(features.details)],
      );
    }
  }

  await query(
    `update audio_stems
     set qa_status = 'approved',
         qa_notes = case
           when qa_notes like '%Extended authentic-scene QA passed:%' then qa_notes
           else coalesce(qa_notes, '') || ' Extended authentic-scene QA passed: semantic identity, license evidence, 10-minute loop, Recipe V2 combination, and collection listening on 2026-07-14.'
         end
     where id = any($1)`,
    [['stem_mixkit_1213', 'stem_mixkit_1736', 'stem_mixkit_2414', 'stem_mixkit_2475', 'stem_mixkit_2658']],
  );

  await query(
    `update audio_stems
     set qa_status = 'rejected',
         commercial_use_allowed = false,
         derivative_use_allowed = false,
         qa_notes = 'Rejected: downloaded file is an XML error response rather than decodable audio.'
     where id = any($1)`,
    [['stem_crickets', 'stem_ocean', 'stem_piano', 'stem_rain', 'stem_synth', 'stem_white']],
  );

  await query(
    `update audio_stems
     set source_platform = 'Internal Synthetic',
         source_url = 'internal://snooze/river-v1',
         source_item_id = 'local_river',
         source_creator = 'MixStil',
         license_name = 'MixStil Internal Generated Asset',
         license_url = 'internal://snooze/asset-policy',
         commercial_use_allowed = true,
         derivative_use_allowed = true,
         attribution_required = false,
         raw_redistribution_allowed = true,
         qa_notes = case
           when qa_notes like '%Internal generation provenance normalized%' then qa_notes
           else coalesce(qa_notes, '') || ' Internal generation provenance normalized to generate_sounds.py and the MixStil asset policy on 2026-07-15.'
         end
     where id = 'stem_river'
       and audio_url = '/audio/river.wav'`,
  );

  await query(
    `update mixes
     set recipe_data = replace(
       replace(
         replace(recipe_data::text, '"stem_ocean"', '"stem_mixkit_ocean_1195"'),
         '"stem_rain"', '"stem_mixkit_rain_2394"'
       ),
       '"stem_crickets"', '"stem_mixkit_pond_1783"'
     )::jsonb,
     render_status = 'not_rendered',
     rendered_audio_url = '',
     rendered_at = null,
     render_error = '',
     updated_at = now()
     where recipe_data::text ~ '"stem_(ocean|rain|crickets)"'`,
  );

  const rejectedSemanticSimulationStemIds = [
    ...Object.keys(rejectedSemanticSimulationNames).map((slug) => `stem_internal_${slug}`),
    'stem_wind',
    'stem_fire',
  ];
  await query(`delete from stem_concepts where stem_id = any($1)`, [rejectedSemanticSimulationStemIds]);
  await query(`delete from stem_metadata_v3 where stem_id = any($1)`, [rejectedSemanticSimulationStemIds]);
  await query(
    `update audio_stems set qa_status = 'rejected',
       qa_notes = 'Rejected semantic simulation: noise synthesis does not establish authentic real-world scene identity.'
     where id = any($1)`,
    [rejectedSemanticSimulationStemIds],
  );

  await seedAudioKnowledgeV3();
  await seedAudioIntentGoldSetV3();
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedDatabase()
    .then(() => console.log(
      `Seeded ${mixkitStems.length + batch02Stems.length} approved licensed stems, `
      + `${internalNoiseStems.length} internal noise stems, ${batch03MusicStems.length + batch04NatureCandidates.length + batch05OpenAudioStems.length} expanded catalog items, `
      + `and ${batch03VoiceCandidates.length} voice candidates.`,
    ))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
