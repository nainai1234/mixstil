export const demandCoverAssets = {
  'sleep-ready': '/share-visuals/scene-bedtime.png',
  'return-to-sleep': '/share-visuals/scene-return-to-sleep.png',
  'light-music': '/share-visuals/scene-light-music.png',
  'noise-masking': '/share-visuals/scene-noise-masking.png',
  'quiet-nature': '/share-visuals/scene-midnight-forest.png',
  'asmr-texture': '/share-visuals/scene-ocean-calm.png',
  'calm-reset': '/share-visuals/scene-short-reset.png',
  focus: '/share-visuals/scene-deep-focus.png',
  minimal: '/share-visuals/scene-low-stimulation.png',
  exclusions: '/share-visuals/scene-strict-exclusions.png',
} as const;

export type DemandCoverId = keyof typeof demandCoverAssets;

export const generatedCoverAssets = [
  '/share-visuals/scene-ocean-calm.png',
  '/share-visuals/scene-midnight-forest.png',
  '/share-visuals/scene-deep-focus.png',
  '/share-visuals/scene-bedtime.png',
  '/share-visuals/scene-return-to-sleep.png',
  '/share-visuals/scene-low-stimulation.png',
  '/share-visuals/scene-noise-masking.png',
  '/share-visuals/scene-short-reset.png',
  '/share-visuals/scene-light-music.png',
  '/share-visuals/scene-strict-exclusions.png',
] as const;

export const coverForDemand = (demandTypeId: string, goal: string) => {
  if (demandTypeId in demandCoverAssets) {
    return demandCoverAssets[demandTypeId as DemandCoverId];
  }
  if (goal === 'focus') return demandCoverAssets.focus;
  if (goal === 'calm') return demandCoverAssets['calm-reset'];
  return demandCoverAssets['sleep-ready'];
};
