import React, { useCallback, useEffect, useRef, useState } from 'react';
import { resolveServiceUrl } from '../lib/api';
import { MixerAudioContext } from './AudioMixerContext';

export interface AudioTrackDef {
  id: number;
  stemId?: string;
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  startTime: number;
  duration: number;
  sourceDuration: number;
  trimStart: number;
  trimEnd: number;
  tags?: string[];
  role?: 'base' | 'environment' | 'music' | 'voice' | 'accent';
  eventId?: string;
  phaseIds?: string[];
  playbackRate?: number;
  sourceGainDb?: number;
  musicKitId?: string;
  musicKitVersion?: string;
  musicPart?: 'harmony' | 'melody' | 'accompaniment' | 'low_support' | 'transition';
  fade?: { inSeconds: number; outSeconds: number };
  loop?: boolean | { enabled: boolean; crossfadeSeconds: number };
  duckingRules?: Array<{
    triggerRole: 'voice';
    targetRoles: Array<'base' | 'environment' | 'music' | 'voice' | 'accent'>;
    reductionDb: number;
    attackSeconds: number;
    releaseSeconds: number;
  }>;
  volumeAutomation?: Array<{ atSeconds: number; volume: number }>;
}

const loopConfig = (track: AudioTrackDef) => typeof track.loop === 'boolean'
  ? { enabled: track.loop, crossfadeSeconds: track.loop ? 3 : 0 }
  : track.loop ?? { enabled: track.role !== 'accent', crossfadeSeconds: track.role === 'accent' ? 0 : 3 };

const playbackRateFor = (track: AudioTrackDef) =>
  Math.max(0.5, Math.min(2, Number.isFinite(Number(track.playbackRate)) ? Number(track.playbackRate) : 1));

const sourceGainFor = (track: AudioTrackDef) => Math.pow(10, Math.max(-24, Math.min(18, Number(track.sourceGainDb ?? 0))) / 20);

const SCHEDULE_WINDOW_SECONDS = 20 * 60;
const ROLLING_REFRESH_SECONDS = 10 * 60;

const trackWindow = (track: AudioTrackDef) => {
  const startTime = Math.max(0, Number(track.startTime ?? 0));
  const duration = Math.max(0.01, Number(track.duration ?? 0.01));
  return { startTime, duration, endTime: startTime + duration };
};

const sessionDurationFor = (tracks: AudioTrackDef[]) =>
  tracks.reduce((maximum, track) => Math.max(maximum, trackWindow(track).endTime), 0);

const clampPosition = (position: number, duration: number) =>
  Math.max(0, Math.min(Math.max(0, duration), Number.isFinite(position) ? position : 0));

const createSilentCarrierUrl = () => {
  const sampleRate = 8000;
  const samples = sampleRate;
  const bytesPerSample = 2;
  const dataBytes = samples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < samples; index += 1) {
    view.setInt16(44 + index * bytesPerSample, index % 2 === 0 ? 1 : -1, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const automatedVolumeAt = (
  points: Array<{ atSeconds: number; volume: number }>,
  trackVolume: number,
  atSeconds: number,
) => {
  if (points.length === 0) return 1;
  const sorted = [...points].sort((a, b) => a.atSeconds - b.atSeconds);
  let current = sorted[0].volume;
  for (const point of sorted) {
    if (point.atSeconds > atSeconds) break;
    current = point.volume;
  }
  return trackVolume > 0 ? Math.max(0, current / trackVolume) : 0;
};

const scheduleDucking = (
  gain: GainNode,
  track: AudioTrackDef,
  audibleTracks: AudioTrackDef[],
  timelineStart: number,
) => {
  const rules = audibleTracks.find((item) => item.duckingRules?.length)?.duckingRules ?? [];
  if (!track.role || rules.length === 0) return;
  for (const rule of rules) {
    if (!rule.targetRoles.includes(track.role)) continue;
    const duckGain = Math.pow(10, -Math.max(0, rule.reductionDb) / 20);
    const currentTime = gain.context.currentTime;
    for (const voiceTrack of audibleTracks.filter((item) => item.role === rule.triggerRole)) {
      const { startTime, endTime } = trackWindow(voiceTrack);
      const attack = Math.max(0.01, Math.min(5, Number(rule.attackSeconds ?? 0.2)));
      const release = Math.max(0.01, Math.min(8, Number(rule.releaseSeconds ?? 0.8)));
      const absoluteStart = timelineStart + startTime;
      const absoluteEnd = timelineStart + endTime;
      if (absoluteEnd <= currentTime) continue;
      const attackEnd = Math.min(absoluteEnd, absoluteStart + attack);
      const releaseStart = Math.max(attackEnd, absoluteEnd - release);
      gain.gain.setValueAtTime(absoluteStart < currentTime ? duckGain : 1, Math.max(currentTime, absoluteStart));
      if (attackEnd > currentTime) gain.gain.linearRampToValueAtTime(duckGain, attackEnd);
      if (releaseStart > currentTime) gain.gain.setValueAtTime(duckGain, releaseStart);
      gain.gain.linearRampToValueAtTime(1, absoluteEnd);
    }
  }
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<AudioTrackDef[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const webAudioRef = useRef<globalThis.AudioContext | null>(null);
  const mediaElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaElementUrlRef = useRef<string | null>(null);
  const bufferPromisesRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const endMarkerRef = useRef<OscillatorNode | null>(null);
  const trackGainsRef = useRef<Map<number, GainNode>>(new Map());
  const tracksRef = useRef<AudioTrackDef[]>([]);
  const isPlayingRef = useRef(false);
  const playbackPositionRef = useRef(0);
  const playbackStartedAtRef = useRef(0);
  const playbackTimelineOffsetRef = useRef(0);
  const playbackRequestIdRef = useRef(0);
  const intentionalPauseRef = useRef(false);
  const interruptedPlaybackRef = useRef(false);
  const rollingSchedulerTimerRef = useRef<number | null>(null);
  tracksRef.current = tracks;
  isPlayingRef.current = isPlaying;
  playbackPositionRef.current = playbackPosition;
  const sessionDuration = sessionDurationFor(tracks);

  const commitPlaybackPosition = useCallback((position: number) => {
    const duration = sessionDurationFor(tracksRef.current);
    const next = clampPosition(position, duration);
    playbackPositionRef.current = next;
    setPlaybackPosition(next);
    return next;
  }, []);

  const currentTimelinePosition = useCallback(() => {
    const audioContext = webAudioRef.current;
    if (!audioContext || activeSourcesRef.current.length === 0 || !isPlayingRef.current) {
      return clampPosition(playbackPositionRef.current, sessionDurationFor(tracksRef.current));
    }
    const elapsed = Math.max(0, audioContext.currentTime - playbackStartedAtRef.current);
    return clampPosition(playbackTimelineOffsetRef.current + elapsed, sessionDurationFor(tracksRef.current));
  }, []);

  const getWebAudio = useCallback(() => {
    if (!webAudioRef.current) {
      const audioContext = new window.AudioContext();
      audioContext.onstatechange = () => {
        if (audioContext.state === 'running' && activeSourcesRef.current.length > 0) {
          interruptedPlaybackRef.current = false;
          isPlayingRef.current = true;
          setIsPlaying(true);
          setPlaybackError(null);
          return;
        }
        if (audioContext.state === 'suspended' && activeSourcesRef.current.length > 0) {
          commitPlaybackPosition(currentTimelinePosition());
          if (!intentionalPauseRef.current) {
            interruptedPlaybackRef.current = true;
            setPlaybackError('Playback was interrupted. Tap Play to resume.');
          }
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      };
      webAudioRef.current = audioContext;
    }
    return webAudioRef.current;
  }, [commitPlaybackPosition, currentTimelinePosition]);

  const getPlaybackOutput = useCallback((audioContext: globalThis.AudioContext): AudioNode => {
    if (mediaElementRef.current) return audioContext.destination;
    const audio = document.createElement('audio');
    const carrierUrl = createSilentCarrierUrl();
    mediaElementUrlRef.current = carrierUrl;
    audio.src = carrierUrl;
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('aria-hidden', 'true');
    audio.style.position = 'fixed';
    audio.style.width = '1px';
    audio.style.height = '1px';
    audio.style.opacity = '0';
    audio.style.pointerEvents = 'none';
    audio.style.transform = 'translate(-9999px, -9999px)';
    document.body.appendChild(audio);
    mediaElementRef.current = audio;
    return audioContext.destination;
  }, []);

  const ensureMediaElementPlayback = useCallback(async (audioContext: globalThis.AudioContext) => {
    getPlaybackOutput(audioContext);
    const audio = mediaElementRef.current;
    if (!audio || !audio.paused) return;
    await audio.play();
  }, [getPlaybackOutput]);

  const unlockWebAudio = useCallback(() => {
    const audioContext = getWebAudio();
    const output = getPlaybackOutput(audioContext);
    const silentBuffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
    const silentSource = audioContext.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(output);
    silentSource.start();
    void audioContext.resume();
    ensureMediaElementPlayback(audioContext).catch((error) => {
      console.warn('Could not prepare media element playback:', error);
    });
    return audioContext;
  }, [ensureMediaElementPlayback, getPlaybackOutput, getWebAudio]);

  const preparePlayback = useCallback(() => {
    unlockWebAudio().resume().catch((error) => {
      console.warn('Could not prepare Web Audio playback:', error);
    });
  }, [unlockWebAudio]);

  const resumeForPlayback = useCallback(async () => {
    const audioContext = unlockWebAudio();
    try {
      await ensureMediaElementPlayback(audioContext);
    } catch {
      throw new Error('Browser blocked audio startup. Tap Play again to allow sound.');
    }
    if (audioContext.state === 'running') return audioContext;
    await Promise.race([
      audioContext.resume(),
      new Promise<never>((_, reject) => window.setTimeout(
        () => reject(new Error('Browser blocked audio startup. Tap Play to allow sound.')),
        3000,
      )),
    ]);
    if (webAudioRef.current?.state !== 'running') {
      throw new Error('Browser blocked audio startup. Tap Play to allow sound.');
    }
    await ensureMediaElementPlayback(audioContext);
    return audioContext;
  }, [ensureMediaElementPlayback, unlockWebAudio]);

  const getBuffer = useCallback((url: string) => {
    const cached = bufferPromisesRef.current.get(url);
    if (cached) return cached;
    const promise = fetch(resolveServiceUrl(url))
      .then((response) => {
        if (!response.ok) throw new Error(`Audio request failed (${response.status})`);
        return response.arrayBuffer();
      })
      .then((bytes) => getWebAudio().decodeAudioData(bytes));
    bufferPromisesRef.current.set(url, promise);
    return promise;
  }, [getWebAudio]);

  const stopAll = useCallback(() => {
    playbackRequestIdRef.current += 1;
    intentionalPauseRef.current = true;
    interruptedPlaybackRef.current = false;
    if (rollingSchedulerTimerRef.current !== null) {
      window.clearTimeout(rollingSchedulerTimerRef.current);
      rollingSchedulerTimerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.onended = null;
      try { endMarkerRef.current.stop(); } catch { /* already stopped */ }
      endMarkerRef.current.disconnect();
      endMarkerRef.current = null;
    }
    activeSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    activeSourcesRef.current = [];
    trackGainsRef.current.clear();
    mediaElementRef.current?.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
    playbackStartedAtRef.current = 0;
    playbackTimelineOffsetRef.current = 0;
  }, []);

  const pause = useCallback(() => {
    const audioContext = webAudioRef.current;
    if (!audioContext || activeSourcesRef.current.length === 0) return;
    intentionalPauseRef.current = true;
    commitPlaybackPosition(currentTimelinePosition());
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (audioContext.state === 'running') {
      audioContext.suspend().catch((error) => {
        console.warn('Could not pause Web Audio playback:', error);
      });
    }
    mediaElementRef.current?.pause();
  }, [commitPlaybackPosition, currentTimelinePosition]);

  const loadCustomTracks = useCallback((newTracks: AudioTrackDef[]) => {
    stopAll();
    setPlaybackError(null);
    commitPlaybackPosition(0);
    setTracks(newTracks);
  }, [commitPlaybackPosition, stopAll]);

  const scheduleSource = useCallback((input: {
    audioContext: globalThis.AudioContext;
    buffer: AudioBuffer;
    destination: AudioNode;
    startAt: number;
    offset: number;
    sourceDuration: number;
    outputDuration: number;
    playbackRate: number;
    cycleFadeIn: number;
    cycleFadeOut: number;
  }) => {
    const source = input.audioContext.createBufferSource();
    const gain = input.audioContext.createGain();
    source.buffer = input.buffer;
    source.playbackRate.setValueAtTime(input.playbackRate, input.startAt);
    source.connect(gain).connect(input.destination);
    if (input.cycleFadeIn > 0) {
      gain.gain.setValueAtTime(0, input.startAt);
      gain.gain.linearRampToValueAtTime(1, input.startAt + input.cycleFadeIn);
    } else {
      gain.gain.setValueAtTime(1, input.startAt);
    }
    if (input.cycleFadeOut > 0) {
      gain.gain.setValueAtTime(1, input.startAt + input.outputDuration - input.cycleFadeOut);
      gain.gain.linearRampToValueAtTime(0, input.startAt + input.outputDuration);
    }
    source.start(input.startAt, input.offset, input.sourceDuration);
    activeSourcesRef.current.push(source);
  }, []);

  const playFrom = useCallback((positionSeconds: number) => {
    if (isPlayingRef.current) return;
    const audibleTracks = tracksRef.current.filter((track) => !track.isMuted && track.volume > 0);
    if (audibleTracks.length === 0) {
      setPlaybackError('This soundscape has no playable audio tracks.');
      return;
    }
    setPlaybackError(null);
    stopAll();
    intentionalPauseRef.current = false;
    interruptedPlaybackRef.current = false;
    const requestId = playbackRequestIdRef.current;

    const startPlayback = async () => {
      const audioContext = await resumeForPlayback();
      const output = getPlaybackOutput(audioContext);
      const sessionDuration = sessionDurationFor(audibleTracks);
      const startOffset = clampPosition(positionSeconds, sessionDuration);
      const scheduleEndOffset = Math.min(sessionDuration, startOffset + SCHEDULE_WINDOW_SECONDS);
      const buffers = await Promise.all(audibleTracks.map((track) => getBuffer(track.url)));
      if (requestId !== playbackRequestIdRef.current) return;
      const timelineStart = audioContext.currentTime + 0.08;
      const timelineOrigin = timelineStart - startOffset;

      audibleTracks.forEach((track, trackIndex) => {
        const buffer = buffers[trackIndex];
        const { startTime, duration, endTime } = trackWindow(track);
        if (endTime <= startOffset) return;
        const recipeSegmentStart = Math.max(startTime, startOffset);
        const recipeSegmentEnd = Math.min(endTime, scheduleEndOffset);
        if (recipeSegmentEnd <= recipeSegmentStart) return;
        const trackElapsed = Math.max(0, startOffset - startTime);
        const remainingDuration = Math.max(0.01, recipeSegmentEnd - recipeSegmentStart);
        const trackStart = timelineStart + Math.max(0, startTime - startOffset);
        const offset = Math.max(0, Math.min(track.trimStart ?? 0, Math.max(0, buffer.duration - 0.01)));
        const available = Math.max(0.01, buffer.duration - offset);
        const playbackRate = playbackRateFor(track);
        const masterGain = audioContext.createGain();
        const automationGain = audioContext.createGain();
        const fadeGain = audioContext.createGain();
        const duckingGain = audioContext.createGain();
        const targetGain = Math.max(0, Math.min(8, (track.volume / 100) * sourceGainFor(track)));
        const fadeIn = Math.min(duration / 2, Math.max(0, track.fade?.inSeconds ?? 0));
        const fadeOut = Math.min(duration / 2, Math.max(0, track.fade?.outSeconds ?? 0));
        masterGain.gain.setValueAtTime(targetGain, trackStart);
        const automationPoints = [...(track.volumeAutomation ?? [])].sort((a, b) => a.atSeconds - b.atSeconds);
        automationGain.gain.setValueAtTime(automatedVolumeAt(automationPoints, track.volume, trackElapsed), trackStart);
        for (const point of automationPoints.filter((item) => item.atSeconds > trackElapsed)) {
          automationGain.gain.linearRampToValueAtTime(
            track.volume > 0 ? Math.max(0, point.volume / track.volume) : 0,
            timelineOrigin + startTime + Math.min(duration, Math.max(0, point.atSeconds)),
          );
        }
        const fadeInValue = fadeIn > 0 && trackElapsed < fadeIn ? Math.max(0, Math.min(1, trackElapsed / fadeIn)) : 1;
        fadeGain.gain.setValueAtTime(fadeInValue, trackStart);
        if (fadeIn > 0 && trackElapsed < fadeIn) fadeGain.gain.linearRampToValueAtTime(1, timelineOrigin + startTime + fadeIn);
        if (fadeOut > 0 && trackElapsed < duration) {
          const fadeOutStart = timelineOrigin + startTime + duration - fadeOut;
          if (fadeOutStart > trackStart) fadeGain.gain.setValueAtTime(1, fadeOutStart);
          fadeGain.gain.linearRampToValueAtTime(0, timelineOrigin + startTime + duration);
        }
        masterGain.connect(automationGain).connect(fadeGain).connect(duckingGain).connect(output);
        scheduleDucking(duckingGain, track, audibleTracks, timelineOrigin);
        trackGainsRef.current.set(track.id, masterGain);

        const loop = loopConfig(track);
        if (!loop.enabled || duration * playbackRate <= available) {
          const sourceOffset = Math.min(offset + trackElapsed * playbackRate, Math.max(offset, buffer.duration - 0.01));
          const sourceDuration = Math.min(remainingDuration * playbackRate, Math.max(0.01, buffer.duration - sourceOffset));
          scheduleSource({
            audioContext,
            buffer,
            destination: masterGain,
            startAt: trackStart,
            offset: sourceOffset,
            sourceDuration,
            outputDuration: sourceDuration / playbackRate,
            playbackRate,
            cycleFadeIn: 0,
            cycleFadeOut: 0,
          });
          return;
        }

        const crossfade = Math.min(Math.max(0, loop.crossfadeSeconds), available / 4);
        if (crossfade <= 0) {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.loopStart = offset;
          source.loopEnd = buffer.duration;
          source.connect(masterGain);
          source.start(trackStart, offset + (trackElapsed % available));
          source.stop(trackStart + remainingDuration);
          activeSourcesRef.current.push(source);
          return;
        }

        const step = available - crossfade;
        const firstSegment = Math.floor(trackElapsed / step) * step;
        const trackScheduleEnd = trackElapsed + remainingDuration;
        for (let position = firstSegment; position < trackScheduleEnd; position += step) {
          const segmentElapsed = Math.max(0, trackElapsed - position);
          const segmentDuration = Math.min(available - segmentElapsed, trackScheduleEnd - position - segmentElapsed);
          if (segmentDuration <= 0) continue;
          scheduleSource({
            audioContext,
            buffer,
            destination: masterGain,
            startAt: timelineOrigin + startTime + position + segmentElapsed,
            offset: offset + segmentElapsed,
            sourceDuration: segmentDuration,
            outputDuration: segmentDuration,
            playbackRate: 1,
            cycleFadeIn: position > 0 && segmentElapsed === 0 ? Math.min(crossfade, segmentDuration / 2) : 0,
            cycleFadeOut: position + segmentDuration < duration ? Math.min(crossfade, segmentDuration / 2) : 0,
          });
        }
      });

      const endMarker = audioContext.createOscillator();
      const silentGain = audioContext.createGain();
      silentGain.gain.setValueAtTime(0, timelineStart);
      endMarker.connect(silentGain).connect(output);
      endMarker.onended = () => {
        if (endMarkerRef.current !== endMarker) return;
        endMarker.disconnect();
        silentGain.disconnect();
        endMarkerRef.current = null;
        activeSourcesRef.current = [];
        trackGainsRef.current.clear();
        commitPlaybackPosition(scheduleEndOffset);
        if (scheduleEndOffset < sessionDuration) {
          setPlaybackError('Long session playback paused. Tap Play to continue from the same point.');
        }
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      endMarker.start(timelineStart);
      endMarker.stop(timelineStart + Math.max(0.1, scheduleEndOffset - startOffset));
      endMarkerRef.current = endMarker;

      if (scheduleEndOffset < sessionDuration) {
        rollingSchedulerTimerRef.current = window.setTimeout(() => {
          if (!isPlayingRef.current || playbackRequestIdRef.current !== requestId) return;
          const resumePosition = currentTimelinePosition();
          stopAll();
          playFrom(resumePosition);
        }, ROLLING_REFRESH_SECONDS * 1000);
      }

      setPlaybackError(null);
      playbackStartedAtRef.current = timelineStart;
      playbackTimelineOffsetRef.current = startOffset;
      commitPlaybackPosition(startOffset);
      isPlayingRef.current = true;
      setIsPlaying(true);
    };

    startPlayback().catch((error) => {
      stopAll();
      console.warn('Web Audio playback failed:', error);
      setPlaybackError(error instanceof Error ? error.message : 'This audio could not be played.');
    });
  }, [commitPlaybackPosition, currentTimelinePosition, getBuffer, getPlaybackOutput, resumeForPlayback, scheduleSource, stopAll]);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;
    const existingContext = webAudioRef.current;
    if (existingContext && activeSourcesRef.current.length > 0 && existingContext.state === 'suspended') {
      intentionalPauseRef.current = false;
      ensureMediaElementPlayback(existingContext).catch((error) => {
        console.warn('Could not resume media element playback:', error);
      });
      existingContext.resume()
        .then(() => {
          interruptedPlaybackRef.current = false;
          isPlayingRef.current = true;
          setIsPlaying(true);
          setPlaybackError(null);
        })
        .catch((error) => {
          console.warn('Could not resume Web Audio playback:', error);
          setPlaybackError('Playback was interrupted. Tap Play to resume.');
        });
      return;
    }
    playFrom(playbackPositionRef.current);
  }, [ensureMediaElementPlayback, playFrom]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
      return;
    }
    play();
  }, [pause, play]);

  const seekTo = useCallback((positionSeconds: number) => {
    const nextPosition = commitPlaybackPosition(positionSeconds);
    if (!isPlayingRef.current) return;
    stopAll();
    playFrom(nextPosition);
  }, [commitPlaybackPosition, playFrom, stopAll]);

  const refreshPlayback = useCallback(() => {
    if (!isPlayingRef.current) return;
    const resumePosition = currentTimelinePosition();
    stopAll();
    window.setTimeout(() => playFrom(resumePosition), 0);
  }, [currentTimelinePosition, playFrom, stopAll]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      commitPlaybackPosition(currentTimelinePosition());
    }, 500);
    return () => window.clearInterval(timer);
  }, [commitPlaybackPosition, currentTimelinePosition, isPlaying]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        commitPlaybackPosition(currentTimelinePosition());
        return;
      }
      const audioContext = webAudioRef.current;
      if (!audioContext || audioContext.state !== 'suspended' || !interruptedPlaybackRef.current) return;
      intentionalPauseRef.current = false;
      audioContext.resume()
        .then(() => {
          interruptedPlaybackRef.current = false;
          setPlaybackError(null);
        })
        .catch(() => {
          setPlaybackError('Playback was interrupted. Tap Play to resume.');
        });
    };
    const handlePageHide = () => {
      commitPlaybackPosition(currentTimelinePosition());
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [commitPlaybackPosition, currentTimelinePosition]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const register = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* action unsupported */ }
    };
    register('play', play);
    register('pause', pause);
    register('stop', stopAll);
    return () => {
      register('play', null);
      register('pause', null);
      register('stop', null);
    };
  }, [pause, play, stopAll]);

  const toggleMute = useCallback((id: number) => {
    setTracks((current) => current.map((track) => track.id === id ? { ...track, isMuted: !track.isMuted } : track));
    const gain = trackGainsRef.current.get(id);
    if (gain) gain.gain.setTargetAtTime(gain.gain.value > 0 ? 0 : 1, gain.context.currentTime, 0.03);
  }, []);

  const updateVolume = useCallback((id: number, volume: number) => {
    setTracks((current) => current.map((track) => {
      if (track.id !== id) return track;
      const ratio = track.volume > 0 ? volume / track.volume : 1;
      return {
        ...track,
        volume,
        isMuted: volume > 0 ? false : track.isMuted,
        volumeAutomation: track.volumeAutomation?.map((point) => ({ ...point, volume: Math.max(0, Math.min(100, Math.round(point.volume * ratio))) })),
      };
    }));
    const gain = trackGainsRef.current.get(id);
    const track = tracks.find((item) => item.id === id);
    if (gain && track) gain.gain.setTargetAtTime(Math.max(0, Math.min(8, (volume / 100) * sourceGainFor(track))), gain.context.currentTime, 0.03);
  }, [tracks]);

  const updateVolumeAutomation = useCallback((id: number, points: Array<{ atSeconds: number; volume: number }>) => {
    setTracks((current) => current.map((track) => track.id === id ? { ...track, volumeAutomation: points } : track));
  }, []);

  const addTrack = useCallback((track: AudioTrackDef) => {
    if (isPlaying) stopAll();
    setTracks((current) => [...current, track]);
  }, [isPlaying, stopAll]);

  const removeTrack = useCallback((id: number) => {
    if (isPlayingRef.current) stopAll();
    setTracks((current) => current.filter((track) => track.id !== id));
  }, [stopAll]);

  const updateTrackTime = useCallback((id: number, startTime: number, duration: number, trimStart?: number, trimEnd?: number) => {
    if (isPlaying) stopAll();
    setTracks((current) => current.map((track) => track.id === id ? {
      ...track,
      startTime,
      duration,
      trimStart: trimStart ?? track.trimStart,
      trimEnd: trimEnd ?? track.trimEnd,
    } : track));
  }, [isPlaying, stopAll]);

  return (
    <MixerAudioContext.Provider value={{ tracks, isPlaying, playbackError, playbackPosition, sessionDuration, preparePlayback, play, playFrom, pause, seekTo, togglePlay, toggleMute, updateVolume, updateVolumeAutomation, refreshPlayback, updateTrackTime, addTrack, removeTrack, stopAll, loadCustomTracks }}>
      {children}
    </MixerAudioContext.Provider>
  );
};
