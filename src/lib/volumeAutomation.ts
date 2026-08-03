export type VolumeAutomationPoint = { atSeconds: number; volume: number };
export type VolumeAutomationPreset = 'steady' | 'rise' | 'fall' | 'dip' | 'peak';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export const normalizeVolumeAutomation = (
  points: VolumeAutomationPoint[] | undefined,
  duration: number,
  fallbackVolume: number,
): VolumeAutomationPoint[] => {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const safeVolume = clamp(Math.round(Number(fallbackVolume) || 0), 0, 100);
  const normalized = (points ?? [])
    .filter((point) => Number.isFinite(point.atSeconds) && Number.isFinite(point.volume))
    .map((point) => ({
      atSeconds: clamp(Number(point.atSeconds), 0, safeDuration),
      volume: clamp(Math.round(Number(point.volume)), 0, 100),
    }))
    .sort((a, b) => a.atSeconds - b.atSeconds)
    .filter((point, index, values) => index === values.length - 1 || Math.abs(point.atSeconds - values[index + 1].atSeconds) > 0.01);

  if (normalized.length === 0) return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ atSeconds: safeDuration * ratio, volume: safeVolume }));
  if (normalized[0].atSeconds > 0.01) normalized.unshift({ atSeconds: 0, volume: normalized[0].volume });
  else normalized[0].atSeconds = 0;
  if (normalized.at(-1)!.atSeconds < safeDuration - 0.01) normalized.push({ atSeconds: safeDuration, volume: normalized.at(-1)!.volume });
  else normalized[normalized.length - 1].atSeconds = safeDuration;
  if (normalized.length >= 5) return normalized;
  const volumeAt = (atSeconds: number) => {
    const toIndex = normalized.findIndex((point) => point.atSeconds >= atSeconds);
    if (toIndex <= 0) return normalized[0].volume;
    const from = normalized[toIndex - 1];
    const to = normalized[toIndex];
    const progress = (atSeconds - from.atSeconds) / Math.max(0.001, to.atSeconds - from.atSeconds);
    return Math.round(from.volume + (to.volume - from.volume) * progress);
  };
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const atSeconds = safeDuration * ratio;
    return { atSeconds, volume: volumeAt(atSeconds) };
  });
};

export const createVolumeAutomationPreset = (
  preset: VolumeAutomationPreset,
  duration: number,
  maximumVolume: number,
): VolumeAutomationPoint[] => {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const ceiling = clamp(Math.round(Number(maximumVolume) || 0), 0, 100);
  const ratiosByPreset: Record<VolumeAutomationPreset, number[]> = {
    steady: [1, 1, 1, 1, 1],
    rise: [0.18, 0.35, 0.55, 0.78, 1],
    fall: [1, 0.78, 0.55, 0.35, 0.18],
    dip: [1, 0.65, 0.28, 0.65, 1],
    peak: [0.28, 0.65, 1, 0.65, 0.28],
  };
  return ratiosByPreset[preset].map((ratio, index) => ({
    atSeconds: safeDuration * (index / 4),
    volume: Math.round(ceiling * ratio),
  }));
};

export const addVolumeAutomationPoint = (
  points: VolumeAutomationPoint[],
  duration: number,
): { points: VolumeAutomationPoint[]; selectedIndex: number } => {
  const normalized = normalizeVolumeAutomation(points, duration, points[0]?.volume ?? 50);
  let gapIndex = 0;
  for (let index = 1; index < normalized.length - 1; index += 1) {
    if (normalized[index + 1].atSeconds - normalized[index].atSeconds > normalized[gapIndex + 1].atSeconds - normalized[gapIndex].atSeconds) gapIndex = index;
  }
  const from = normalized[gapIndex];
  const to = normalized[gapIndex + 1];
  const point = {
    atSeconds: (from.atSeconds + to.atSeconds) / 2,
    volume: Math.round((from.volume + to.volume) / 2),
  };
  const next = [...normalized.slice(0, gapIndex + 1), point, ...normalized.slice(gapIndex + 1)];
  return { points: next, selectedIndex: gapIndex + 1 };
};

export const updateVolumeAutomationPoint = (
  points: VolumeAutomationPoint[],
  selectedIndex: number,
  patch: Partial<VolumeAutomationPoint>,
  duration: number,
): VolumeAutomationPoint[] => points.map((point, index) => {
  if (index !== selectedIndex) return point;
  const isEndpoint = index === 0 || index === points.length - 1;
  const minimumTime = index === 0 ? 0 : points[index - 1].atSeconds + Math.min(1, duration / 100);
  const maximumTime = index === points.length - 1 ? duration : points[index + 1].atSeconds - Math.min(1, duration / 100);
  return {
    atSeconds: isEndpoint ? point.atSeconds : clamp(Number(patch.atSeconds ?? point.atSeconds), minimumTime, maximumTime),
    volume: clamp(Math.round(Number(patch.volume ?? point.volume)), 0, 100),
  };
});
