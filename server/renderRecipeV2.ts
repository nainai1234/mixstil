import type { RecipeTrackRole, RecipeV2Track } from './recipeV2';

type RenderEvent = {
  id: string;
  type: 'accent';
  stemId: string;
  atSeconds: number;
  volume: number;
};

export type PlannedRenderTrack = RecipeV2Track & {
  eventId?: string;
  sourceDurationSeconds?: number;
  sourceSampleRate?: number;
};

type RecipeDuckingRule = {
  triggerRole: 'voice';
  targetRoles: RecipeTrackRole[];
  reductionDb: number;
  attackSeconds: number;
  releaseSeconds: number;
};

type DuckingInterval = {
  startSeconds: number;
  endSeconds: number;
  reductionDb: number;
  attackSeconds: number;
  releaseSeconds: number;
};

export const usesCrossfadeLoop = (track: PlannedRenderTrack) =>
  Boolean(
    track.loop?.enabled
    && track.loop.crossfadeSeconds > 0
    && Number(track.sourceDurationSeconds) > 0
    && Number(track.sourceSampleRate) > 0,
  );

export const resolveTrimmedSourceDuration = (
  sourceDurationSeconds: number,
  trimStart: unknown,
  trimEnd: unknown,
) => {
  const sourceDuration = Math.max(0.01, Number(sourceDurationSeconds));
  const start = Math.max(0, Math.min(sourceDuration - 0.01, Number(trimStart ?? 0)));
  const requestedEnd = Number(trimEnd);
  const end = Number.isFinite(requestedEnd) && requestedEnd > start
    ? Math.min(sourceDuration, requestedEnd)
    : sourceDuration;
  return Math.max(0.01, end - start);
};

export const planRecipeRenderTracks = (recipe: {
  schemaVersion?: number;
  tracks: RecipeV2Track[];
  events?: RenderEvent[];
}) => {
  const audibleTracks = recipe.tracks.filter((track) => !track.isMuted && Number(track.volume ?? 0) > 0);
  if (recipe.schemaVersion !== 2 || !recipe.events?.length) return audibleTracks;

  const regularTracks = audibleTracks.filter((track) => track.role !== 'accent');
  const accentByStemId = new Map(
    audibleTracks
      .filter((track) => track.role === 'accent')
      .map((track) => [track.stemId, track]),
  );
  const eventTracks = recipe.events.flatMap((event) => {
    const sourceTrack = accentByStemId.get(event.stemId);
    if (!sourceTrack) return [];
    return [{
      ...sourceTrack,
      eventId: event.id,
      startTime: event.atSeconds,
      volume: event.volume,
      loop: { enabled: false, crossfadeSeconds: 0 },
    }];
  });
  return [...regularTracks, ...eventTracks];
};

const boundedSeconds = (value: unknown, fallback: number, maximum: number) =>
  Math.max(0, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : fallback));

const boundedPlaybackRate = (value: unknown) =>
  Math.max(0.5, Math.min(2, Number.isFinite(Number(value)) ? Number(value) : 1));

const volumeFilter = (track: PlannedRenderTrack) => {
  const sourceGain = Math.pow(10, Math.max(-24, Math.min(18, Number(track.sourceGainDb ?? 0))) / 20);
  const points = [...(track.volumeAutomation ?? [])]
    .filter((point) => Number.isFinite(point.atSeconds) && Number.isFinite(point.volume))
    .sort((a, b) => a.atSeconds - b.atSeconds);
  if (points.length < 2) return `volume=${Math.max(0, Math.min(8, (Number(track.volume ?? 0) / 100) * sourceGain))}`;
  let expression = `${Math.max(0, Math.min(8, (points.at(-1)!.volume / 100) * sourceGain))}`;
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const from = points[index];
    const to = points[index + 1];
    const fromGain = Math.max(0, Math.min(8, (from.volume / 100) * sourceGain));
    const toGain = Math.max(0, Math.min(8, (to.volume / 100) * sourceGain));
    const span = Math.max(0.001, to.atSeconds - from.atSeconds);
    const ramp = `${fromGain}+((${toGain}-${fromGain})*(t-${from.atSeconds})/${span})`;
    expression = `if(lt(t,${to.atSeconds}),${ramp},${expression})`;
  }
  return `volume='if(lt(t,0),0,${expression})':eval=frame`;
};

const trackStartAndDuration = (track: PlannedRenderTrack, mixDurationSeconds: number) => {
  const startTime = boundedSeconds(track.startTime, 0, mixDurationSeconds);
  const availableDuration = Math.max(0.01, mixDurationSeconds - startTime);
  const duration = Math.max(0.01, Math.min(Number(track.duration ?? availableDuration), availableDuration));
  return { startTime, duration };
};

export const getDuckingIntervalsForTrack = (
  track: PlannedRenderTrack,
  tracks: PlannedRenderTrack[],
  ducking: RecipeDuckingRule[] = [],
  mixDurationSeconds: number,
) => ducking.flatMap((rule) => {
  if (!rule.targetRoles.includes(track.role)) return [];
  const reductionDb = Math.max(0, Number(rule.reductionDb ?? 0));
  if (reductionDb <= 0) return [];
  return tracks
    .filter((candidate) => candidate.role === rule.triggerRole && !candidate.isMuted && Number(candidate.volume ?? 0) > 0)
    .map((voiceTrack) => {
      const { startTime, duration } = trackStartAndDuration(voiceTrack, mixDurationSeconds);
      return {
        startSeconds: startTime,
        endSeconds: Math.min(mixDurationSeconds, startTime + duration),
        reductionDb,
        attackSeconds: boundedSeconds(rule.attackSeconds, 0.2, 5),
        releaseSeconds: boundedSeconds(rule.releaseSeconds, 0.8, 8),
      };
    })
    .filter((interval) => interval.endSeconds > interval.startSeconds);
});

const buildDuckingVolumeFilters = (intervals: DuckingInterval[]) => intervals.flatMap((interval) => {
  const duckGain = Math.pow(10, -interval.reductionDb / 20);
  const attackStart = interval.startSeconds;
  const attackEnd = Math.min(interval.endSeconds, interval.startSeconds + interval.attackSeconds);
  const releaseStart = Math.max(interval.startSeconds, interval.endSeconds - interval.releaseSeconds);
  const releaseEnd = interval.endSeconds;
  const filters: string[] = [];

  if (attackEnd > attackStart) {
    filters.push(`volume='if(between(t,${attackStart},${attackEnd}),1-((1-${duckGain})*(t-${attackStart})/${Math.max(0.001, attackEnd - attackStart)}),1)':eval=frame`);
  }
  if (releaseStart > attackEnd) {
    filters.push(`volume='if(between(t,${attackEnd},${releaseStart}),${duckGain},1)':eval=frame`);
  }
  if (releaseEnd > releaseStart) {
    filters.push(`volume='if(between(t,${releaseStart},${releaseEnd}),${duckGain}+((1-${duckGain})*(t-${releaseStart})/${Math.max(0.001, releaseEnd - releaseStart)}),1)':eval=frame`);
  }
  return filters;
});

export const buildTrackFilter = (
  track: PlannedRenderTrack,
  index: number,
  mixDurationSeconds: number,
  duckingIntervals: DuckingInterval[] = [],
) => {
  const { startTime, duration } = trackStartAndDuration(track, mixDurationSeconds);
  const playbackRate = boundedPlaybackRate(track.playbackRate);
  const sourceTrimDuration = duration * playbackRate;
  const fadeIn = boundedSeconds(track.fade?.inSeconds, 0, duration / 2);
  const fadeOut = boundedSeconds(track.fade?.outSeconds, 0, duration / 2);
  const filters = [
    `atrim=0:${sourceTrimDuration}`,
    'asetpts=PTS-STARTPTS',
  ];
  if (playbackRate !== 1) filters.push(`atempo=${playbackRate}`);
  filters.push(volumeFilter(track));
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, duration - fadeOut)}:d=${fadeOut}`);
  if (startTime > 0) filters.push(`adelay=${Math.round(startTime * 1000)}:all=1`);
  filters.push(...buildDuckingVolumeFilters(duckingIntervals));
  if (!usesCrossfadeLoop(track)) return `[${index}:a]${filters.join(',')}[a${index}]`;

  const sourceDuration = Number(track.sourceDurationSeconds);
  const crossfadeSeconds = Math.min(Number(track.loop.crossfadeSeconds), sourceDuration / 4);
  const middleEnd = sourceDuration - crossfadeSeconds;
  const cycleDuration = sourceDuration - crossfadeSeconds;
  const cycleSamples = Math.max(1, Math.round(cycleDuration * Number(track.sourceSampleRate)));
  return [
    `[${index}:a]asplit=3[xh${index}][xm${index}][xt${index}]`,
    `[xh${index}]atrim=0:${crossfadeSeconds},asetpts=PTS-STARTPTS[xhead${index}]`,
    `[xm${index}]atrim=${crossfadeSeconds}:${middleEnd},asetpts=PTS-STARTPTS[xmid${index}]`,
    `[xt${index}]atrim=${middleEnd}:${sourceDuration},asetpts=PTS-STARTPTS[xtail${index}]`,
    `[xtail${index}][xhead${index}]acrossfade=d=${crossfadeSeconds}:c1=qsin:c2=qsin[xboundary${index}]`,
    `[xboundary${index}][xmid${index}]concat=n=2:v=0:a=1,aloop=loop=-1:size=${cycleSamples}[xloop${index}]`,
    `[xloop${index}]${filters.join(',')}[a${index}]`,
  ].join(';');
};

export const buildRecipeFilterComplex = (
  tracks: PlannedRenderTrack[],
  mixDurationSeconds: number,
  ducking: RecipeDuckingRule[] = [],
) => {
  const trackFilters = tracks.map((track, index) => buildTrackFilter(
    track,
    index,
    mixDurationSeconds,
    getDuckingIntervalsForTrack(track, tracks, ducking, mixDurationSeconds),
  ));
  const mixInputs = tracks.map((_, index) => `[a${index}]`).join('');
  return `${trackFilters.join(';')};${mixInputs}amix=inputs=${tracks.length}:duration=longest:normalize=0,atrim=0:${mixDurationSeconds}[out]`;
};
