export type SoundGroupId = 'music' | 'environment' | 'masking' | 'details';
export type AdjustableRole = 'music' | 'environment' | 'base' | 'accent';

export const SOUND_GROUPS: Array<{
  id: SoundGroupId;
  roles: AdjustableRole[];
}> = [
  { id: 'music', roles: ['music'] },
  { id: 'environment', roles: ['environment'] },
  { id: 'masking', roles: ['base'] },
  { id: 'details', roles: ['accent'] },
];

export const defaultSoundGroupVolumes = (): Record<SoundGroupId, number> => ({
  music: 100,
  environment: 100,
  masking: 100,
  details: 100,
});

export const soundGroupForRole = (role: string | undefined): SoundGroupId => {
  if (role === 'music') return 'music';
  if (role === 'environment') return 'environment';
  if (role === 'base') return 'masking';
  return 'details';
};

export const scaledTrackVolume = (
  baseVolume: number,
  overallVolume: number,
  groupVolume: number,
) => Math.max(0, Math.min(100, Math.round(baseVolume * overallVolume / 100 * groupVolume / 100)));
