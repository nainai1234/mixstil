import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, MoreHorizontal, Check, History, Volume2, VolumeX, SlidersHorizontal, Trash2, Sparkles, Send, X, LoaderCircle, Globe2, LockKeyhole } from 'lucide-react';
import { api, resolveServiceUrl } from '../lib/api';
import type { Mix, ProductGoal } from '../lib/domain';
import { useAudioMixer } from '../context/AudioMixerContext';
import { getVerifiedOfflineMixRecord } from '../lib/offlineLibrary';
import {
  addNativeMediaActionListener,
  getNativeAudioState,
  hasNativeAudioPlayback,
  hasNativeMediaSession,
  pauseNativeAudio,
  playNativeAudio,
  prepareNativeAudio,
  seekNativeAudio,
  updateNativeMediaSession,
} from '../lib/nativeMediaSession';
import {
  SOUND_GROUPS,
  defaultSoundGroupVolumes,
  scaledTrackVolume,
  soundGroupForRole,
  type AdjustableRole,
  type SoundGroupId,
} from '../lib/soundGroupVolumes';
import PaywallModal, { type PaywallReason } from '../components/PaywallModal';
import { useI18n } from '../lib/i18n';
import { summarizeSupplyDecision } from '../lib/generationSupply';

const PLAYBACK_CHECKPOINT_SECONDS = [300, 1800, 3600, 5400, 7200] as const;
const inferGoalForMix = (mix: Mix): ProductGoal | null => {
  const recipeGoal = mix.recipeData.audioIntent?.goal;
  if (recipeGoal === 'sleep' || recipeGoal === 'calm' || recipeGoal === 'focus') return recipeGoal;
  const text = `${mix.title} ${mix.description} ${mix.recipeData.moodTags.join(' ')}`.toLowerCase();
  if (/\bfocus|work|study|deep work\b/.test(text)) return 'focus';
  if (/\bcalm|relax|settle|breath/.test(text)) return 'calm';
  if (/\bsleep|bedtime|night|snooze\b/.test(text)) return 'sleep';
  return null;
};
const FIT_FEEDBACK_OPTIONS = [
  { value: 'fits_me' },
  { value: 'too_loud' },
  { value: 'too_bright' },
  { value: 'too_plain' },
  { value: 'do_not_use' },
] as const;
type FitFeedbackValue = typeof FIT_FEEDBACK_OPTIONS[number]['value'];

const PlayerPage: React.FC = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { t, goalLabel: i18nGoalLabel, formatMinutes } = useI18n();
  const [searchParams] = useSearchParams();
  const { tracks, isPlaying, playbackError, playbackPosition, sessionDuration, play, togglePlay, loadCustomTracks, removeTrack, stopAll, updateVolume, seekTo } = useAudioMixer();
  const [mix, setMix] = useState<Mix | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const playbackRequestedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const playbackFailedRef = useRef(false);
  const nativeMediaSessionReadyRef = useRef(false);
  const nativeMediaSessionFailedRef = useRef(false);
  const playRecordedRef = useRef(false);
  const midpointRecordedRef = useRef(false);
  const playbackCheckpointRef = useRef<Set<number>>(new Set());
  const playbackSyncPositionRef = useRef(0);
  const overallBaseVolumesRef = useRef<Map<number, number>>(new Map());
  const pendingOverallVolumesRef = useRef<Map<number, number>>(new Map());
  const [firstPlaybackRequested, setFirstPlaybackRequested] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [autoplayAfterUpdate, setAutoplayAfterUpdate] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [overallVolume, setOverallVolume] = useState(100);
  const [soundGroupVolumes, setSoundGroupVolumes] = useState<Record<SoundGroupId, number>>(defaultSoundGroupVolumes);
  const [showAiAdjust, setShowAiAdjust] = useState(false);
  const [adjustmentText, setAdjustmentText] = useState('');
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [adjustmentResult, setAdjustmentResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishAccess, setPublishAccess] = useState<'public' | 'private'>('private');
  const [offlineMode, setOfflineMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [nativeAudioUrl, setNativeAudioUrl] = useState('');
  const [nativeIsPlaying, setNativeIsPlaying] = useState(false);
  const [nativePlaybackPosition, setNativePlaybackPosition] = useState(0);
  const [nativePlaybackError, setNativePlaybackError] = useState<string | null>(null);
  const [playbackMaxSeconds, setPlaybackMaxSeconds] = useState<number | null>(null);
  const [isPreviewPlayback, setIsPreviewPlayback] = useState(false);
  const [mobileRenderPending, setMobileRenderPending] = useState(false);
  const [fitFeedback, setFitFeedback] = useState<FitFeedbackValue | null>(null);
  const [fitFeedbackSaving, setFitFeedbackSaving] = useState(false);
  const [fitFeedbackMessage, setFitFeedbackMessage] = useState<string | null>(null);
  const [fitFeedbackError, setFitFeedbackError] = useState<string | null>(null);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [defaultMessage, setDefaultMessage] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);
  const [startingPlayback, setStartingPlayback] = useState(false);

  const mixId = state?.mixId || searchParams.get('mixId') || 'mix_ocean_calm';
  const returnTo = (state?.returnTo as string | undefined) || searchParams.get('returnTo') || '/listen';
  const journeyId = (state?.journeyId as string | undefined) || searchParams.get('journeyId') || undefined;
  const journeyStartedAt = Number(state?.journeyStartedAt ?? searchParams.get('journeyStartedAt'));
  const validationCohort = (state?.validationCohort as string | undefined) || searchParams.get('cohort') || undefined;
  const validationParticipant = (state?.validationParticipant as string | undefined) || searchParams.get('participant') || undefined;
  const resumePositionSeconds = Number(state?.resumePositionSeconds ?? searchParams.get('resume'));
  const playbackStorageKey = `snooze:playback:${mixId}`;
  const isMobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const useNativeMobilePlayback = isMobileBrowser && Boolean(nativeAudioUrl);
  const useNativeAudioPlayback = hasNativeAudioPlayback() && Boolean(nativeAudioUrl);
  const fullDuration = sessionDuration || mix?.recipeData.durationSeconds || 1800;
  const duration = playbackMaxSeconds ? Math.min(fullDuration, playbackMaxSeconds) : fullDuration;
  const progress = useNativeMobilePlayback
    ? Math.min(nativePlaybackPosition, duration)
    : Math.min(playbackPosition, duration);
  const playerIsPlaying = useNativeMobilePlayback ? nativeIsPlaying : isPlaying;
  const playerPlaybackError = nativePlaybackError ?? playbackError;
  const trackName = mix?.title || t('player.customSoundscape');
  const internalBaselineSeed = typeof mix?.recipeData.quickCreate?.recipeId === 'string' && mix.recipeData.quickCreate.recipeId.startsWith('content-baseline-')
    ? mix.recipeData.quickCreate.recipeId.replace(/^content-baseline-/, '')
    : null;
  const internalBaselineMatch = mix?.recipeData.quickCreate?.internalBaselineMatch;
  const supplyDecision = mix?.recipeData.quickCreate?.supply;
  const isInternalBaselineResult = Boolean(internalBaselineSeed);
  const nativeProgressSecond = Math.floor(progress);
  const adjustableTracks = tracks;
  const selectedTrack = adjustableTracks.find((track) => track.id === selectedTrackId) ?? adjustableTracks[0] ?? null;
  const isOwnedSound = Boolean(mix && currentUserId && mix.creatorId === currentUserId);
  const isSavedSound = Boolean(mix && isOwnedSound && (mix.status === 'published' || mix.status === 'private'));
  const saveButtonLabel = isSavedSound ? t('player.savedToSounds') : t('player.saveToSounds');
  const currentGoal = mix ? inferGoalForMix(mix) : null;
  const supplySummary = supplyDecision ? summarizeSupplyDecision(supplyDecision, t) : null;

  const goBackToListeningHome = useCallback(() => {
    if (returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      navigate(returnTo, { replace: true });
      return;
    }
    navigate('/listen', { replace: true });
  }, [navigate, returnTo]);

  useEffect(() => {
    if (!mix || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const artwork = mix.coverImageUrl
      ? [{ src: new URL(mix.coverImageUrl, window.location.origin).href, sizes: '512x512' }]
      : undefined;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: mix.title,
      artist: 'MixStil',
      album: 'My Sounds',
      artwork,
    });
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [mix]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playerIsPlaying ? 'playing' : 'paused';
    if (!('setPositionState' in navigator.mediaSession) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(Math.max(0, progress), Math.max(0, duration - 0.01)),
      });
    } catch { /* position state is optional */ }
  }, [duration, playerIsPlaying, progress]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const register = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* action unsupported */ }
    };
    register('seekto', (details) => {
      if (typeof details.seekTime !== 'number') return;
      if (useNativeAudioPlayback) {
        seekNativeAudio(details.seekTime).catch(() => undefined);
        setNativePlaybackPosition(details.seekTime);
        return;
      }
      if (useNativeMobilePlayback && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = details.seekTime;
        setNativePlaybackPosition(details.seekTime);
        return;
      }
      seekTo(details.seekTime);
    });
    register('seekbackward', (details) => {
      const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 15;
      if (useNativeAudioPlayback) {
        const next = Math.max(0, progress - offset);
        seekNativeAudio(next).catch(() => undefined);
        setNativePlaybackPosition(next);
        return;
      }
      if (useNativeMobilePlayback && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = Math.max(0, progress - offset);
        return;
      }
      seekTo(progress - offset);
    });
    register('seekforward', (details) => {
      const offset = typeof details.seekOffset === 'number' ? details.seekOffset : 15;
      if (useNativeAudioPlayback) {
        const next = Math.min(duration, progress + offset);
        seekNativeAudio(next).catch(() => undefined);
        setNativePlaybackPosition(next);
        return;
      }
      if (useNativeMobilePlayback && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = Math.min(duration, progress + offset);
        return;
      }
      seekTo(progress + offset);
    });
    return () => {
      register('seekto', null);
      register('seekbackward', null);
      register('seekforward', null);
    };
  }, [duration, progress, seekTo, useNativeAudioPlayback, useNativeMobilePlayback]);

  useEffect(() => {
    let cancelled = false;
    setOfflineMode(false);
    setLoadError(null);
    setNativeAudioUrl('');
    setNativeIsPlaying(false);
    setNativePlaybackPosition(0);
    setNativePlaybackError(null);
    Promise.all([
      api.getMix(mixId, { internalMobilePlaybackQa: validationCohort === 'deviceqa' }).catch(async () => {
        const offline = await getVerifiedOfflineMixRecord(mixId);
        if (!offline) throw new Error(t('player.offlineUnavailable'));
        setOfflineMode(true);
        return offline.payload;
      }),
      api.getProductCapabilities().catch(() => ({ releaseChannel: 'voice-free-beta' as const, guidedVoice: false })),
      api.getCurrentUser().catch(() => null),
    ]).then(([result, capabilities, user]) => {
      if (cancelled || !result) return;
      setCurrentUserId(user?.id ?? null);
      const playableTracks = capabilities.guidedVoice ? result.tracks : result.tracks.filter((track) => track.role !== 'voice');
      playbackCheckpointRef.current = new Set();
      midpointRecordedRef.current = false;
      setMix(result.mix);
      const playbackPolicy = 'playbackPolicy' in result ? result.playbackPolicy : null;
      setPlaybackMaxSeconds(playbackPolicy?.maxSessionSeconds ?? null);
      setIsPreviewPlayback(Boolean(playbackPolicy?.isPreview));
      overallBaseVolumesRef.current = new Map(playableTracks.map((track) => [track.id, track.volume]));
      pendingOverallVolumesRef.current = new Map(playableTracks.map((track) => [track.id, track.volume]));
      setOverallVolume(100);
      setSoundGroupVolumes(defaultSoundGroupVolumes());
      loadCustomTracks(playableTracks);
      let savedPosition = Number.isFinite(resumePositionSeconds) ? resumePositionSeconds : 0;
      try {
        if (savedPosition <= 0) {
          const savedPlayback = window.localStorage.getItem(playbackStorageKey);
          savedPosition = savedPlayback ? Number(JSON.parse(savedPlayback).positionSeconds) : 0;
        }
      } catch {
        savedPosition = 0;
      }
      if (Number.isFinite(savedPosition) && savedPosition > 0) {
        setNativePlaybackPosition(savedPosition);
        window.setTimeout(() => seekTo(savedPosition), 0);
      }
    }).catch((error) => {
      console.warn('Could not load mix:', error);
      if (!cancelled) setLoadError(error instanceof Error ? error.message : t('player.loadFailed'));
    });
    return () => {
      cancelled = true;
      stopAll();
    };
  }, [loadCustomTracks, mixId, playbackStorageKey, resumePositionSeconds, seekTo, stopAll, t, validationCohort]);

  useEffect(() => {
    if (!isPreviewPlayback || !playbackMaxSeconds || !playerIsPlaying || progress < playbackMaxSeconds) return;
    nativeAudioRef.current?.pause();
    setNativeIsPlaying(false);
    stopAll();
    setPaywallReason('community_preview');
  }, [isPreviewPlayback, playbackMaxSeconds, playerIsPlaying, progress, stopAll]);

  useEffect(() => {
    if (!mix || !isMobileBrowser || offlineMode) return;
    let cancelled = false;
    const existingUrl = mix.renderStatus === 'ready' && mix.renderedAudioUrl
      ? resolveServiceUrl(mix.renderedAudioUrl)
      : '';
    if (existingUrl) {
      setMobileRenderPending(false);
      setNativeAudioUrl(existingUrl);
      return;
    }
    setMobileRenderPending(true);
    setNativePlaybackError(null);
    api.renderMix(mixId)
      .then((result) => {
        if (cancelled) return;
        setMix(result.mix);
        setNativeAudioUrl(resolveServiceUrl(result.renderedAudioUrl));
      })
      .catch((error) => {
        if (cancelled) return;
        setNativePlaybackError(error instanceof Error ? error.message : t('player.mobilePrepareFailed'));
      })
      .finally(() => {
        if (!cancelled) setMobileRenderPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMobileBrowser, mix, mixId, offlineMode, t]);

  useEffect(() => {
    if (!mix || duration <= 0) return;
    const positionSeconds = Math.min(Math.max(0, playbackPosition), duration);
    window.localStorage.setItem(playbackStorageKey, JSON.stringify({
      mixId,
      positionSeconds,
      durationSeconds: duration,
      updatedAt: new Date().toISOString(),
    }));
    const shouldSync = Math.abs(positionSeconds - playbackSyncPositionRef.current) >= 15
      || positionSeconds >= duration - 1;
    if (shouldSync && navigator.onLine) {
      playbackSyncPositionRef.current = positionSeconds;
      api.updatePlaybackState(mixId, { positionSeconds, durationSeconds: duration })
        .catch((error) => console.warn('Could not sync playback position:', error));
    }
  }, [duration, mix, mixId, playbackPosition, playbackStorageKey]);

  useEffect(() => {
    if (adjustableTracks.length === 0) {
      setSelectedTrackId(null);
      return;
    }
    if (!adjustableTracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(adjustableTracks[0].id);
    }
  }, [adjustableTracks, selectedTrackId]);

  const recordPlaybackEvent = useCallback((type: 'playback_requested' | 'playback_started' | 'playback_failed' | 'playback_checkpoint' | 'native_media_session_ready' | 'native_media_session_failed' | 'result_accepted' | 'result_adjust_requested' | 'result_adjust_applied' | 'result_adjust_failed' | 'result_retry_requested', details?: Record<string, unknown>) => {
    if (!journeyId) return;
    const elapsedMs = Number.isFinite(journeyStartedAt) ? Math.max(0, Date.now() - journeyStartedAt) : 0;
    api.recordPlaybackEvents(mixId, journeyId, [{ type, elapsedMs, details }])
      .catch((metricsError) => console.warn(`Could not record ${type}:`, metricsError));
  }, [journeyId, journeyStartedAt, mixId]);

  const syncNativePlaybackPosition = useCallback((positionSeconds: number) => {
    const next = Math.min(Math.max(0, positionSeconds), duration);
    setNativePlaybackPosition(next);
    window.localStorage.setItem(playbackStorageKey, JSON.stringify({
      mixId,
      positionSeconds: next,
      durationSeconds: duration,
      updatedAt: new Date().toISOString(),
    }));
    if (navigator.onLine && Math.abs(next - playbackSyncPositionRef.current) >= 15) {
      playbackSyncPositionRef.current = next;
      api.updatePlaybackState(mixId, { positionSeconds: next, durationSeconds: duration })
        .catch((error) => console.warn('Could not sync native playback position:', error));
    }
    for (const checkpointSeconds of PLAYBACK_CHECKPOINT_SECONDS) {
      if (!journeyId || duration < checkpointSeconds || next < checkpointSeconds || playbackCheckpointRef.current.has(checkpointSeconds)) continue;
      playbackCheckpointRef.current.add(checkpointSeconds);
      recordPlaybackEvent('playback_checkpoint', {
        checkpointSeconds,
        playbackPositionSeconds: Math.round(next),
        durationSeconds: duration,
        visibilityState: document.visibilityState,
        playbackEngine: 'native-audio',
      });
    }
  }, [duration, journeyId, mixId, playbackStorageKey, recordPlaybackEvent]);

  const handleNativeTimeUpdate = useCallback(() => {
    const audio = nativeAudioRef.current;
    if (!audio) return;
    syncNativePlaybackPosition(audio.currentTime);
  }, [syncNativePlaybackPosition]);

  const seekPlaybackTo = useCallback((positionSeconds: number) => {
    const nextPosition = Math.min(Math.max(0, positionSeconds), duration);
    if (useNativeAudioPlayback) {
      syncNativePlaybackPosition(nextPosition);
      seekNativeAudio(nextPosition).catch(() => undefined);
      return;
    }
    if (useNativeMobilePlayback && nativeAudioRef.current) {
      nativeAudioRef.current.currentTime = nextPosition;
      syncNativePlaybackPosition(nextPosition);
      return;
    }
    seekTo(nextPosition);
  }, [duration, seekTo, syncNativePlaybackPosition, useNativeAudioPlayback, useNativeMobilePlayback]);

  const handleNativeTogglePlay = useCallback(() => {
    if (mobileRenderPending) return;
    const firstNativeStart = !playbackRequestedRef.current;
    if (!nativeIsPlaying) {
      setStartingPlayback(true);
    }
    if (!nativeIsPlaying && firstNativeStart) {
      playbackRequestedRef.current = true;
      setFirstPlaybackRequested(true);
      recordPlaybackEvent('playback_requested', { trigger: 'manual_player', playbackEngine: 'native-audio' });
    }
    if (useNativeAudioPlayback) {
      setNativePlaybackError(null);
      const action = nativeIsPlaying
        ? pauseNativeAudio()
        : getNativeAudioState()
          .catch(() => null)
          .then((nativeState) => {
            const playbackEnded = progress >= Math.max(0, duration - 0.5)
              || Boolean(nativeState && nativeState.durationSeconds > 0
                && nativeState.positionSeconds >= nativeState.durationSeconds - 0.5);
            const positionSeconds = playbackEnded ? 0 : progress;
            const mustPrepare = firstNativeStart
              || !nativeState?.prepared
              || nativeState.audioUrl !== nativeAudioUrl
              || playbackEnded;

            if (playbackEnded) syncNativePlaybackPosition(0);
            return mustPrepare
              ? prepareNativeAudio({
                  audioUrl: nativeAudioUrl,
                  title: trackName,
                  playing: true,
                  durationSeconds: duration,
                  positionSeconds,
                })
              : playNativeAudio();
          });
      action.then(() => {
        setStartingPlayback(false);
        if (!firstNativeStart || nativeMediaSessionReadyRef.current) return;
        nativeMediaSessionReadyRef.current = true;
        recordPlaybackEvent('native_media_session_ready', { bridge: 'NativeMediaSession', playbackOwner: 'native-player' });
      }).catch((error) => {
        setStartingPlayback(false);
        setNativePlaybackError(error instanceof Error ? error.message : t('player.nativeStartFailed'));
        if (!playbackFailedRef.current) {
          playbackFailedRef.current = true;
          recordPlaybackEvent('playback_failed', { reason: 'native_audio_start_failed' });
        }
      });
      return;
    }
    const audio = nativeAudioRef.current;
    if (!audio) return;
    if (nativeIsPlaying) {
      setStartingPlayback(false);
      audio.pause();
      return;
    }
    setNativePlaybackError(null);
    setStartingPlayback(true);
    audio.play().catch(() => {
      setStartingPlayback(false);
      setNativePlaybackError(t('player.browserBlocked'));
      if (!playbackFailedRef.current) {
        playbackFailedRef.current = true;
        recordPlaybackEvent('playback_failed', { reason: 'native_audio_start_failed' });
      }
    });
  }, [duration, mobileRenderPending, nativeAudioUrl, nativeIsPlaying, progress, recordPlaybackEvent, syncNativePlaybackPosition, t, trackName, useNativeAudioPlayback]);

  const handleTogglePlay = useCallback(() => {
    if (useNativeMobilePlayback) {
      handleNativeTogglePlay();
      return;
    }
    if (!isPlaying) {
      setStartingPlayback(true);
    }
    if (!isPlaying && !playbackRequestedRef.current) {
      playbackRequestedRef.current = true;
      setFirstPlaybackRequested(true);
      recordPlaybackEvent('playback_requested', { trigger: 'manual_player' });
    }
    if (isPlaying) {
      setStartingPlayback(false);
      togglePlay();
      return;
    }
    play();
  }, [handleNativeTogglePlay, isPlaying, play, recordPlaybackEvent, togglePlay, useNativeMobilePlayback]);

  useEffect(() => {
    if (!useNativeMobilePlayback || useNativeAudioPlayback || !('mediaSession' in navigator)) return;
    const register = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* action unsupported */ }
    };
    register('play', () => {
      nativeAudioRef.current?.play().catch(() => {
        setNativePlaybackError(t('player.browserBlocked'));
      });
    });
    register('pause', () => {
      nativeAudioRef.current?.pause();
    });
    register('stop', () => {
      nativeAudioRef.current?.pause();
      setNativeIsPlaying(false);
    });
    return () => {
      register('play', null);
      register('pause', null);
      register('stop', null);
    };
  }, [t, useNativeAudioPlayback, useNativeMobilePlayback]);

  useEffect(() => {
    if (!useNativeMobilePlayback || !hasNativeMediaSession()) return;
    let listener: Awaited<ReturnType<typeof addNativeMediaActionListener>> | null = null;
    addNativeMediaActionListener((event) => {
      if (useNativeAudioPlayback) {
        if (event.positionSeconds >= 0) syncNativePlaybackPosition(event.positionSeconds);
        if (typeof event.playing === 'boolean') setNativeIsPlaying(event.playing);
        if (event.action === 'error') {
          setNativePlaybackError(event.error || t('player.nativePlaybackFailed'));
          if (!playbackFailedRef.current) {
            playbackFailedRef.current = true;
            recordPlaybackEvent('playback_failed', { reason: event.error || 'native_playback_error' });
          }
        }
        if (event.playing && playbackRequestedRef.current && !playbackStartedRef.current) {
          playbackStartedRef.current = true;
          recordPlaybackEvent('playback_started', { playbackEngine: 'native-player' });
          if (!playRecordedRef.current) {
            playRecordedRef.current = true;
            api.recordPlay(mixId).catch((error) => console.warn('Could not record native play start:', error));
          }
        }
        if (event.action === 'ended') {
          setNativeIsPlaying(false);
          syncNativePlaybackPosition(duration);
        }
        return;
      }
      const audio = nativeAudioRef.current;
      if (!audio) return;
      if (event.action === 'play') {
        audio.play().catch((error) => setNativePlaybackError(error instanceof Error ? error.message : t('player.resumeFailed')));
      } else if (event.action === 'pause') {
        audio.pause();
      } else if (event.action === 'stop') {
        audio.pause();
        audio.currentTime = 0;
        syncNativePlaybackPosition(0);
      } else if (event.action === 'seek' && event.positionSeconds >= 0) {
        audio.currentTime = event.positionSeconds;
        syncNativePlaybackPosition(event.positionSeconds);
      }
    }).then((handle) => { listener = handle; }).catch((error) => {
      if (nativeMediaSessionFailedRef.current) return;
      nativeMediaSessionFailedRef.current = true;
      recordPlaybackEvent('native_media_session_failed', {
        stage: 'action_listener',
        reason: error instanceof Error ? error.message : 'listener_registration_failed',
      });
    });
    return () => {
      listener?.remove();
    };
  }, [duration, mixId, recordPlaybackEvent, syncNativePlaybackPosition, t, useNativeAudioPlayback, useNativeMobilePlayback]);

  useEffect(() => {
    if (!useNativeAudioPlayback || !nativeAudioUrl) return;
    const refreshNativeState = () => {
      getNativeAudioState().then((state) => {
        if (!state.audioUrl || state.audioUrl !== nativeAudioUrl) return;
        syncNativePlaybackPosition(state.positionSeconds);
        setNativeIsPlaying(state.playing);
        if (state.playing) {
          playbackRequestedRef.current = true;
          setFirstPlaybackRequested(true);
        }
      }).catch(() => undefined);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshNativeState();
    };
    refreshNativeState();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshNativeState);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshNativeState);
    };
  }, [nativeAudioUrl, syncNativePlaybackPosition, useNativeAudioPlayback]);

  useEffect(() => {
    if (!useNativeMobilePlayback || useNativeAudioPlayback || !hasNativeMediaSession() || !firstPlaybackRequested) return;
    updateNativeMediaSession({
      title: trackName,
      playing: nativeIsPlaying,
      durationSeconds: duration,
      positionSeconds: nativeProgressSecond,
    }).then(() => {
      if (nativeMediaSessionReadyRef.current) return;
      nativeMediaSessionReadyRef.current = true;
      recordPlaybackEvent('native_media_session_ready', { bridge: 'NativeMediaSession' });
    }).catch((error) => {
      console.warn('Could not update native media session:', error);
      if (nativeMediaSessionFailedRef.current) return;
      nativeMediaSessionFailedRef.current = true;
      recordPlaybackEvent('native_media_session_failed', {
        stage: 'session_update',
        reason: error instanceof Error ? error.message : 'session_update_failed',
      });
    });
  }, [duration, firstPlaybackRequested, nativeIsPlaying, nativeProgressSecond, recordPlaybackEvent, trackName, useNativeAudioPlayback, useNativeMobilePlayback]);

  useEffect(() => {
    if (!isPlaying) return;
    if (!playRecordedRef.current) {
      playRecordedRef.current = true;
      api.recordPlay(mixId).catch((error) => console.warn('Could not record play start:', error));
    }
    setStartingPlayback(false);
    if (firstPlaybackRequested && !playbackStartedRef.current) {
      playbackStartedRef.current = true;
      recordPlaybackEvent('playback_started');
    }
  }, [firstPlaybackRequested, isPlaying, mixId, recordPlaybackEvent]);

  useEffect(() => {
    if (!firstPlaybackRequested || !playbackError || playbackFailedRef.current) return;
    playbackFailedRef.current = true;
    setStartingPlayback(false);
    recordPlaybackEvent('playback_failed', { reason: playbackError });
  }, [firstPlaybackRequested, playbackError, recordPlaybackEvent]);

  useEffect(() => {
    if (playerIsPlaying || playerPlaybackError) setStartingPlayback(false);
  }, [playerIsPlaying, playerPlaybackError]);

  useEffect(() => {
    if (!firstPlaybackRequested || playerIsPlaying || playbackFailedRef.current) return;
    const timeout = window.setTimeout(() => {
      if (playbackStartedRef.current || playbackFailedRef.current) return;
      playbackFailedRef.current = true;
      setStartingPlayback(false);
      recordPlaybackEvent('playback_failed', { reason: 'startup_timeout', timeoutMs: 10000 });
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [firstPlaybackRequested, playerIsPlaying, recordPlaybackEvent]);

  useEffect(() => {
    if (!isPlaying || duration <= 0) return;
    if (midpointRecordedRef.current) return;
    if (Math.round(playbackPosition) === Math.round(duration * 0.5)) {
      midpointRecordedRef.current = true;
      api.recordPlay(mixId, playbackPosition).catch((error) => console.warn('Could not record midpoint play:', error));
    }
  }, [duration, isPlaying, mixId, playbackPosition]);

  useEffect(() => {
    if (!isPlaying || !journeyId) return;
    for (const checkpointSeconds of PLAYBACK_CHECKPOINT_SECONDS) {
      if (duration < checkpointSeconds || playbackPosition < checkpointSeconds || playbackCheckpointRef.current.has(checkpointSeconds)) continue;
      playbackCheckpointRef.current.add(checkpointSeconds);
      recordPlaybackEvent('playback_checkpoint', {
        checkpointSeconds,
        playbackPositionSeconds: Math.round(playbackPosition),
        durationSeconds: duration,
        visibilityState: document.visibilityState,
      });
    }
  }, [duration, isPlaying, journeyId, playbackPosition, recordPlaybackEvent]);

  useEffect(() => {
    if (!autoplayAfterUpdate || isPlaying) return;
    // Wait for the updated track state to commit, then start from the latest mix.
    const timer = window.setTimeout(() => {
      play();
      setAutoplayAfterUpdate(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoplayAfterUpdate, isPlaying, play]);

  const handleResultAction = (type: 'result_accepted' | 'result_adjust_requested' | 'result_retry_requested') => {
    recordPlaybackEvent(type, { listenedSeconds: progress });
    if (type === 'result_adjust_requested') return;
    if (type === 'result_accepted') return;
    const validationQuery = validationCohort && validationParticipant
      ? `?cohort=${encodeURIComponent(validationCohort)}&participant=${encodeURIComponent(validationParticipant)}`
      : '';
    navigate(`/ai-heal${validationQuery}`);
  };

  const submitFitFeedback = async (feedback: FitFeedbackValue) => {
    if (!mix || fitFeedbackSaving) return;
    setFitFeedback(feedback);
    setFitFeedbackSaving(true);
    setFitFeedbackMessage(null);
    setFitFeedbackError(null);
    if (feedback === 'fits_me') recordPlaybackEvent('result_accepted', { listenedSeconds: progress, feedback });
    if (feedback !== 'fits_me') recordPlaybackEvent('result_adjust_requested', { listenedSeconds: progress, feedback });
    try {
      await api.recordFitFeedback(mixId, {
        feedback,
        listenedSeconds: progress,
        journeyId,
      });
      setFitFeedbackMessage(feedback === 'fits_me'
        ? t('player.fitSaved')
        : feedback === 'do_not_use'
          ? t('player.fitAvoid')
          : t('player.fitSession'));
    } catch (error) {
      setFitFeedbackError(error instanceof Error ? error.message : t('player.feedbackSaveFailed'));
    } finally {
      setFitFeedbackSaving(false);
    }
  };

  const saveToMySounds = async (access: 'public' | 'private') => {
    if (!mix || saving) return;
    setSaving(true);
    setSaveError(null);
    handleResultAction('result_accepted');
    try {
      const saved = isOwnedSound
        ? await api.updateMix(mixId, {
          status: access === 'public' ? 'published' : 'private',
          recipeData: mix.recipeData,
        })
        : await api.saveMix({
          title: mix.title,
          description: mix.description,
          coverImageUrl: mix.coverImageUrl,
          status: access === 'public' ? 'published' : 'private',
          recipeData: mix.recipeData,
        });
      if (journeyId) {
        const elapsedMs = Number.isFinite(journeyStartedAt) ? Math.max(0, Date.now() - journeyStartedAt) : 0;
        await api.recordPlaybackEvents(mixId, journeyId, [{
          type: 'work_saved',
          elapsedMs,
          details: { destination: 'my_sounds', access, validationCohort, validationParticipant, internalBaselineSeed },
        }]);
      }
      void api.renderMix(saved.id).catch((renderError) => {
        console.warn('Saved sound is frozen, but background rendering failed:', renderError);
      });
      navigate('/sounds', {
        state: {
          publishedMixId: saved.id,
          publishedAccess: access,
          journeyId,
          journeyStartedAt,
        },
      });
    } catch (error) {
      const code = (error as { payload?: { code?: string } })?.payload?.code;
      if (code === 'saved_sound_limit_reached') setPaywallReason('saved_sounds');
      setSaveError(error instanceof Error ? error.message : t('player.soundSaveFailed'));
      setSaving(false);
    }
  };

  const openPublishDialog = () => {
    if (isSavedSound) return;
    setPublishAccess('private');
    setSaveError(null);
    setPublishDialogOpen(true);
  };

  const setCurrentSoundAsDefault = async () => {
    if (!mix || defaultSaving) return;
    setDefaultSaving(true);
    setDefaultMessage(null);
    setDefaultError(null);
    try {
      const inferredGoal = inferGoalForMix(mix);
      if (!inferredGoal) throw new Error(t('player.goalUnrecognized'));
      await api.updateSoundProfile({
        defaultGoal: inferredGoal,
        defaultDurationSeconds: mix.recipeData.durationSeconds,
      });
      setDefaultMessage(t('player.defaultSaved', { goal: i18nGoalLabel(inferredGoal), duration: formatMinutes(mix.recipeData.durationSeconds) }));
    } catch (error) {
      setDefaultError(error instanceof Error ? error.message : t('player.defaultSaveFailed'));
    } finally {
      setDefaultSaving(false);
    }
  };

  const persistTrackVolume = async (trackId: number, volume: number) => {
    const source = tracks.find((track) => track.id === trackId);
    if (!source || !mix) return;
    const nextRecipe = {
      ...mix.recipeData,
      tracks: mix.recipeData.tracks.map((track) => track.stemId === source.stemId && track.role === source.role && track.startTime === source.startTime
        ? { ...track, volume, isMuted: volume === 0 }
        : track),
      versionState: 'live' as const,
    };
    setMix((current) => current ? { ...current, recipeData: nextRecipe } : current);
    const details = { kind: 'volume', targetRole: source.role ?? 'background', stemId: source.stemId, volume };
    recordPlaybackEvent('result_adjust_requested', details);
    try {
      await api.updateMix(mixId, { recipeData: nextRecipe });
      recordPlaybackEvent('result_adjust_applied', details);
    } catch (error) {
      recordPlaybackEvent('result_adjust_failed', { ...details, reason: error instanceof Error ? error.message : 'update_failed' });
      console.warn('Could not save volume adjustment:', error);
    }
  };

  const requestAdjustmentPlayback = (trigger: 'overall_adjustment' | 'layer_adjustment' | 'layer_mute') => {
    if (isPlaying) return;
    if (!playbackRequestedRef.current) {
      playbackRequestedRef.current = true;
      setFirstPlaybackRequested(true);
      recordPlaybackEvent('playback_requested', { trigger });
    }
    setAutoplayAfterUpdate(true);
  };

  const persistOverallVolume = async () => {
    if (!mix || pendingOverallVolumesRef.current.size === 0) return;
    const volumeByTrackId = pendingOverallVolumesRef.current;
    const nextRecipe = {
      ...mix.recipeData,
      tracks: mix.recipeData.tracks.map((recipeTrack) => {
        const source = tracks.find((track) => (
          track.stemId === recipeTrack.stemId
          && track.role === recipeTrack.role
          && track.startTime === recipeTrack.startTime
        ));
        if (!source) return recipeTrack;
        const volume = volumeByTrackId.get(source.id);
        return volume === undefined ? recipeTrack : { ...recipeTrack, volume, isMuted: volume === 0 };
      }),
      versionState: 'live' as const,
    };
    setMix((current) => current ? { ...current, recipeData: nextRecipe } : current);
    const details = { kind: 'volume', targetRole: 'all', volume: overallVolume };
    recordPlaybackEvent('result_adjust_requested', details);
    try {
      await api.updateMix(mixId, { recipeData: nextRecipe });
      recordPlaybackEvent('result_adjust_applied', details);
    } catch (error) {
      recordPlaybackEvent('result_adjust_failed', { ...details, reason: error instanceof Error ? error.message : 'update_failed' });
      console.warn('Could not save overall volume:', error);
    }
  };

  const applyScaledVolumes = (nextOverall: number, nextGroups: Record<SoundGroupId, number>) => {
    const nextVolumes = new Map<number, number>();
    tracks.forEach((track) => {
      const baseVolume = overallBaseVolumesRef.current.get(track.id) ?? track.volume;
      const groupVolume = nextGroups[soundGroupForRole(track.role)];
      const nextVolume = scaledTrackVolume(baseVolume, nextOverall, groupVolume);
      nextVolumes.set(track.id, nextVolume);
      updateVolume(track.id, nextVolume);
    });
    pendingOverallVolumesRef.current = nextVolumes;
    return nextVolumes;
  };

  const handleOverallVolumeChange = (volume: number) => {
    applyScaledVolumes(volume, soundGroupVolumes);
    setOverallVolume(volume);
    requestAdjustmentPlayback('overall_adjustment');
  };

  const handleSoundGroupChange = (group: SoundGroupId, volume: number) => {
    const nextGroups = { ...soundGroupVolumes, [group]: volume };
    applyScaledVolumes(overallVolume, nextGroups);
    setSoundGroupVolumes(nextGroups);
    requestAdjustmentPlayback('layer_adjustment');
  };

  const handleVolumeChange = (trackId: number, volume: number) => {
    const nextBaseVolumes = new Map(tracks.map((track) => [track.id, track.id === trackId ? volume : track.volume]));
    overallBaseVolumesRef.current = nextBaseVolumes;
    pendingOverallVolumesRef.current = nextBaseVolumes;
    setOverallVolume(100);
    setSoundGroupVolumes(defaultSoundGroupVolumes());
    updateVolume(trackId, volume);
    requestAdjustmentPlayback('layer_adjustment');
  };

  const toggleLayerMute = (trackId: number) => {
    const source = tracks.find((track) => track.id === trackId);
    if (!source || !mix) return;
    const nextVolume = source.isMuted || source.volume === 0 ? Math.max(1, source.volume || 24) : 0;
    updateVolume(trackId, nextVolume);
    const details = { kind: 'mute', targetRole: source.role ?? 'background', stemId: source.stemId, muted: nextVolume === 0 };
    recordPlaybackEvent('result_adjust_requested', details);
    const nextRecipe = {
      ...mix.recipeData,
      tracks: mix.recipeData.tracks.map((track) => track.stemId === source.stemId && track.role === source.role && track.startTime === source.startTime
        ? { ...track, volume: nextVolume, isMuted: nextVolume === 0 }
        : track),
      versionState: 'live' as const,
    };
    setMix((current) => current ? { ...current, recipeData: nextRecipe } : current);
    api.updateMix(mixId, { recipeData: nextRecipe })
      .then(() => recordPlaybackEvent('result_adjust_applied', details))
      .catch((error) => {
        recordPlaybackEvent('result_adjust_failed', { ...details, reason: error instanceof Error ? error.message : 'update_failed' });
        console.warn('Could not save mute adjustment:', error);
      });
    overallBaseVolumesRef.current.set(trackId, nextVolume);
    pendingOverallVolumesRef.current.set(trackId, nextVolume);
    setOverallVolume(100);
    setSoundGroupVolumes(defaultSoundGroupVolumes());
    requestAdjustmentPlayback('layer_mute');
  };

  const removeLayer = (trackId: number) => {
    const source = tracks.find((track) => track.id === trackId);
    if (!source || !mix) return;
    const matchesSource = (track: Mix['recipeData']['tracks'][number]) => (
      track.stemId === source.stemId
      && track.role === source.role
      && track.startTime === source.startTime
    );
    const nextRecipe = {
      ...mix.recipeData,
      tracks: mix.recipeData.tracks.filter((track) => !matchesSource(track)),
      versionState: 'live' as const,
    };
    const nextSelectedTrack = tracks.find((track) => track.id !== trackId)?.id ?? null;
    overallBaseVolumesRef.current.delete(trackId);
    pendingOverallVolumesRef.current.delete(trackId);
    setOverallVolume(100);
    setSoundGroupVolumes(defaultSoundGroupVolumes());
    removeTrack(trackId);
    setSelectedTrackId(nextSelectedTrack);
    setMix((current) => current ? { ...current, recipeData: nextRecipe } : current);
    const details = { kind: 'remove', targetRole: source.role ?? 'background', stemId: source.stemId };
    recordPlaybackEvent('result_adjust_requested', details);
    api.updateMix(mixId, { recipeData: nextRecipe })
      .then(() => recordPlaybackEvent('result_adjust_applied', details))
      .catch((error) => {
        recordPlaybackEvent('result_adjust_failed', { ...details, reason: error instanceof Error ? error.message : 'update_failed' });
        console.warn('Could not remove sound layer:', error);
      });
    if (tracks.length > 1) setAutoplayAfterUpdate(true);
  };

  const roleLabel = (role: string | undefined) => {
    if (role === 'environment') return t('player.role.environment');
    if (role === 'music') return t('player.role.music');
    if (role === 'voice') return t('player.role.voice');
    if (role === 'accent') return t('player.role.accent');
    return t('player.role.background');
  };

  const applyAiAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const instruction = adjustmentText.trim();
    if (!instruction || adjustmentLoading) return;
    setAdjustmentLoading(true);
    setAdjustmentError(null);
    setAdjustmentResult(null);
    const adjustmentDetails = { kind: 'natural_language', instruction };
    recordPlaybackEvent('result_adjust_requested', adjustmentDetails);
    try {
      stopAll();
      const result = await api.applyRecipeEdit(mixId, instruction);
      setMix(result.mix);
      loadCustomTracks(result.tracks);
      overallBaseVolumesRef.current = new Map(result.tracks.map((track) => [track.id, track.volume]));
      pendingOverallVolumesRef.current = new Map(result.tracks.map((track) => [track.id, track.volume]));
      setSelectedTrackId(result.tracks[0]?.id ?? null);
      setOverallVolume(100);
      setSoundGroupVolumes(defaultSoundGroupVolumes());
      setAdjustmentText('');
      setAdjustmentResult(t('player.updated'));
      setAutoplayAfterUpdate(result.tracks.some((track) => !track.isMuted && track.volume > 0));
      recordPlaybackEvent('result_adjust_applied', adjustmentDetails);
    } catch (error) {
      recordPlaybackEvent('result_adjust_failed', { ...adjustmentDetails, reason: error instanceof Error ? error.message : 'adjustment_failed' });
      setAdjustmentError(error instanceof Error ? error.message : t('player.changeFailed'));
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {nativeAudioUrl && !useNativeAudioPlayback && (
        <audio
          ref={nativeAudioRef}
          src={nativeAudioUrl}
          preload="auto"
          playsInline
          onPlay={() => {
            setStartingPlayback(false);
            setNativeIsPlaying(true);
            setNativePlaybackError(null);
            if (!playRecordedRef.current) {
              playRecordedRef.current = true;
              api.recordPlay(mixId).catch((error) => console.warn('Could not record native play start:', error));
            }
            if (firstPlaybackRequested && !playbackStartedRef.current) {
              playbackStartedRef.current = true;
              recordPlaybackEvent('playback_started', { playbackEngine: 'native-audio' });
            }
          }}
          onPause={() => setNativeIsPlaying(false)}
          onEnded={() => {
            setNativeIsPlaying(false);
            syncNativePlaybackPosition(duration);
          }}
          onTimeUpdate={handleNativeTimeUpdate}
          onError={() => setNativePlaybackError(t('player.renderedPlayFailed'))}
          style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', transform: 'translate(-9999px, -9999px)' }}
        />
      )}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overscrollBehavior: 'contain', padding: 'var(--space-6)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
          <button className="btn-icon" aria-label={t('player.back')} title={t('player.back')} onClick={goBackToListeningHome} style={{ background: 'rgba(255,255,255,0.1)' }}>
            <ArrowLeft size={24} color="white" />
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
            {t('player.nowPlaying')}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {offlineMode && <span style={{ alignSelf: 'center', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{t('common.offline')}</span>}
            <button className="btn-icon" aria-label={t('player.history')} title={t('player.history')} onClick={() => setShowHistory((current) => !current)} style={{ background: 'rgba(255,255,255,0.1)' }}>
              <MoreHorizontal size={24} color="white" />
            </button>
          </div>
        </div>

        {showHistory && (
          <section className="player-history-popover" aria-label={t('player.history')}>
            <div className="player-history-title"><History size={16} /> {t('player.history')}</div>
            {((mix?.recipeData.audit as { edits?: Array<{ instruction?: string; operation?: string; createdAt?: string }> } | undefined)?.edits ?? []).length === 0
              ? <p className="text-xs text-secondary">{t('player.noChanges')}</p>
              : ((mix?.recipeData.audit as { edits?: Array<{ instruction?: string; operation?: string; createdAt?: string }> } | undefined)?.edits ?? []).slice().reverse().map((edit, index) => (
                <div className="player-history-item" key={`${edit.createdAt ?? edit.operation}-${index}`}>
                  <span>{edit.instruction ?? edit.operation ?? t('player.updatedSoundscape')}</span>
                  <small>{edit.createdAt ? new Date(edit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small>
                </div>
              ))}
          </section>
        )}

        {/* Info & Controls */}
        <div style={{ marginTop: 'var(--space-4)', paddingBottom: 'calc(var(--space-8) + env(safe-area-inset-bottom))' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{trackName}</h2>
            <p className="text-secondary">{t('player.personalSound')}</p>
          </div>

          {loadError && (
            <div role="alert" style={{ marginBottom: 22, padding: 12, borderRadius: 8, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(100,20,20,0.24)', color: '#ffd3d3', fontSize: 13 }}>
              <p style={{ marginBottom: 10 }}>{loadError}</p>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/sounds')}>{t('player.openMySounds')}</button>
            </div>
          )}

          {/* Progress Bar */}
          <div style={{ marginBottom: 32 }}>
            <div className="player-progress-control" style={{ height: 44, position: 'relative' }}>
              <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${(progress / duration) * 100 || 0}%`, background: 'var(--primary)', borderRadius: 2 }} />
                <div className="player-progress-thumb" style={{ position: 'absolute', top: '50%', left: `${(progress / duration) * 100 || 0}%`, width: 14, height: 14, background: 'white', borderRadius: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={progress}
                aria-label={t('player.seekPlayback')}
                disabled={duration <= 0}
                onChange={(event) => seekPlaybackTo(Number(event.currentTarget.value))}
                style={{ position: 'absolute', inset: 0, width: '100%', height: 44, margin: 0, opacity: 0, cursor: 'pointer', touchAction: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{formatTime(progress)}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>-{formatTime(duration - progress)}</span>
            </div>
          </div>

          {/* Main Controls */}
          {playerPlaybackError && (
            <p role="alert" style={{ margin: '-16px 0 18px', color: '#ffd3d3', fontSize: 13, textAlign: 'center' }}>
              {playerPlaybackError}
            </p>
          )}
          {(mobileRenderPending || startingPlayback) && (
            <p role="status" style={{ margin: '-16px 0 18px', color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center' }}>
              {mobileRenderPending ? t('player.mobilePreparing') : t('player.startingPlayback')}
            </p>
          )}
          <div className="player-main-controls">
              <button className="player-control-side player-ai-adjust-link" onClick={() => setShowAiAdjust(true)}>
                <Sparkles size={16} /> <span>{t('player.refineAi')}</span>
              </button>
	              <button
	                onClick={handleTogglePlay}
	                aria-label={playerIsPlaying ? t('player.pause') : t('common.play')}
	                disabled={!mix || Boolean(loadError) || mobileRenderPending || startingPlayback}
                style={{ 
                  width: 72, height: 72, borderRadius: 36, 
                  background: 'var(--primary)', border: 'none', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(140, 106, 255, 0.4)',
                  cursor: 'pointer'
                }}
              >
	                {startingPlayback ? <LoaderCircle size={30} color="white" className="animate-spin" /> : playerIsPlaying ? <Pause size={32} color="white" fill="white" /> : <Play size={32} color="white" fill="white" style={{ marginLeft: 4 }} />}
	              </button>
              <button className="player-control-side player-advanced-link" onClick={() => navigate(`/creator/mix?mixId=${encodeURIComponent(mixId)}`, { state: { mixId, fromAi: true } })}>
                <SlidersHorizontal size={16} /> <span>{t('player.advanced')}</span>
              </button>
          </div>

          {isInternalBaselineResult && (
            <section
              aria-label={t('player.whyTitle')}
              style={{
                margin: '18px 0 20px',
                padding: '13px 14px',
                borderRadius: 14,
                border: '1px solid rgba(232,240,106,0.28)',
                background: 'linear-gradient(135deg, rgba(232,240,106,0.10), rgba(140,106,255,0.10))',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,240,106,0.16)', color: '#e8f06a', flex: '0 0 auto' }}>
                  <Check size={15} />
                </span>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 14 }}>{t('player.whyTitle')}</strong>
                  <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
                    {internalBaselineMatch?.matchReason ?? t('player.whyFallback')}
                  </p>
                  <span className="text-xs text-secondary">
                    {internalBaselineMatch?.title ? t('player.seedWithTitle', { title: internalBaselineMatch.title, seed: internalBaselineSeed ?? '' }) : t('player.seed', { seed: internalBaselineSeed ?? '' })}
                  </span>
                </div>
              </div>
            </section>
          )}

          {supplyDecision && supplySummary && (
            <section
              aria-label={t('player.supplyDecision')}
              style={{
                margin: '18px 0 20px',
                padding: '13px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontSize: 14 }}>
                  {t('player.supplyTitle')}: {supplyDecision.kind === 'inventory_only'
                    ? t('player.supplyInventory')
                    : supplyDecision.kind === 'inventory_plus_missing_stem'
                      ? t('player.supplyOneMissing')
                      : t('player.supplyBlocked')}
                </strong>
                <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
                  {supplySummary.description}
                </p>
              </div>
            </section>
          )}

          <section
              aria-label={t('player.fitTitle')}
            style={{
              margin: '18px 0 20px',
              padding: '14px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.07)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 11 }}>
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 3 }}>{t('player.fitTitle')}</h3>
                <p className="text-xs text-secondary" style={{ margin: 0 }}>{t('player.fitSubtitle')}</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FIT_FEEDBACK_OPTIONS.map((option) => {
                const selected = fitFeedback === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={fitFeedbackSaving}
                    aria-pressed={selected}
                    onClick={() => void submitFitFeedback(option.value)}
                    style={{
                      minHeight: 36,
                      padding: '0 11px',
                      borderRadius: 999,
                      border: selected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.14)',
                      background: selected ? 'rgba(140,106,255,0.18)' : 'rgba(255,255,255,0.06)',
                      color: selected ? 'var(--primary)' : 'rgba(255,255,255,0.78)',
                      cursor: fitFeedbackSaving ? 'default' : 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {t(`player.fit.${option.value}`)}
                  </button>
                );
              })}
            </div>
            {fitFeedbackMessage && <p role="status" className="text-xs" style={{ margin: '10px 0 0', color: 'var(--primary)' }}>{fitFeedbackMessage}</p>}
            {fitFeedbackError && <p role="alert" style={{ margin: '10px 0 0', color: '#ffd3d3', fontSize: 12 }}>{fitFeedbackError}</p>}
          </section>

          <section className="player-adjust-panel" aria-label={t('player.adjustTitle')}>
            <div className="player-adjust-heading">
              <div>
                <h3>{t('player.adjustTitle')}</h3>
                <p>{t('player.adjustSubtitle')}</p>
              </div>
            </div>
            <div className="player-layer-editor">
              <div className="player-overall-volume">
                <div className="player-overall-volume-heading">
                  <div>
                    <strong>{t('player.overallVolume')}</strong>
                    <small>{t('player.overallHelp')}</small>
                  </div>
                  <output>{overallVolume}%</output>
                </div>
                <div className="player-layer-row-controls">
                  <VolumeX size={15} aria-hidden="true" />
                  <input type="range" min="0" max="100" value={overallVolume} aria-label={t('player.overallVolume')} onChange={(event) => handleOverallVolumeChange(Number(event.target.value))} onPointerUp={persistOverallVolume} onBlur={persistOverallVolume} />
                  <Volume2 size={17} aria-hidden="true" />
                </div>
              </div>
              <div className="player-sound-groups" aria-label={t('player.soundGroups')}>
                {SOUND_GROUPS.map((group) => {
                  const available = adjustableTracks.some((track) => group.roles.includes(track.role as AdjustableRole));
                  if (!available) return null;
                  return (
                    <div className="player-sound-group" key={group.id}>
                      <div className="player-sound-group-heading">
                        <div><strong>{t(`player.group.${group.id}.title`)}</strong><small>{t(`player.group.${group.id}.description`)}</small></div>
                        <output>{soundGroupVolumes[group.id]}%</output>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundGroupVolumes[group.id]}
                        aria-label={t('player.groupVolume', { group: t(`player.group.${group.id}.title`) })}
                        onChange={(event) => handleSoundGroupChange(group.id, Number(event.target.value))}
                        onPointerUp={persistOverallVolume}
                        onBlur={persistOverallVolume}
                      />
                    </div>
                  );
                })}
              </div>
              <p>{t('player.selectLayer')}</p>
              {adjustableTracks.length === 0 && <p className="text-xs text-secondary">{t('player.noLayers')}</p>}
              <div className="player-layer-selector" role="listbox" aria-label={t('player.selectLayer')}>
                {adjustableTracks.map((track) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedTrack?.id === track.id}
                    className={`player-layer-option${selectedTrack?.id === track.id ? ' is-selected' : ''}`}
                    key={track.id}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <span className="player-layer-option-check">{selectedTrack?.id === track.id && <Check size={13} />}</span>
                    <span className="player-layer-option-copy">
                      <strong>{track.name}</strong>
                      <small>{roleLabel(track.role)}</small>
                    </span>
                    <span>{track.isMuted || track.volume === 0 ? t('player.off') : `${Math.round(track.volume)}%`}</span>
                  </button>
                ))}
              </div>

              {selectedTrack && (
                <div className="player-selected-layer" aria-label={t('player.adjustLayer', { name: selectedTrack.name })}>
                  <div className="player-selected-layer-heading">
                    <div>
                      <small>{t('player.adjusting')}</small>
                      <strong>{selectedTrack.name}</strong>
                    </div>
                    <button className="player-remove-layer" onClick={() => removeLayer(selectedTrack.id)} aria-label={`${t('player.remove')} ${selectedTrack.name}`}>
                      <Trash2 size={15} /> {t('player.remove')}
                    </button>
                  </div>
                  <div className="player-layer-row-controls">
                    <button className="player-layer-mute" aria-label={`${selectedTrack.isMuted || selectedTrack.volume === 0 ? t('player.enable') : t('player.mute')} ${selectedTrack.name}`} onClick={() => toggleLayerMute(selectedTrack.id)}>
                      {selectedTrack.isMuted || selectedTrack.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <span className="player-layer-range-label">{t('player.low')}</span>
                    <input type="range" min="0" max="100" value={selectedTrack.isMuted ? 0 : selectedTrack.volume} aria-label={t('player.layerVolume', { name: selectedTrack.name })} onChange={(event) => handleVolumeChange(selectedTrack.id, Number(event.target.value))} onPointerUp={(event) => persistTrackVolume(selectedTrack.id, Number((event.currentTarget as HTMLInputElement).value))} onBlur={(event) => persistTrackVolume(selectedTrack.id, Number(event.currentTarget.value))} />
                    <span className="player-layer-range-label">{t('player.high')}</span>
                    <output>{Math.round(selectedTrack.volume)}%</output>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="player-save-actions">
            <button className="btn btn-primary" aria-label={saveButtonLabel} onClick={openPublishDialog} disabled={saving || isSavedSound}><Check size={18} /> {isSavedSound ? t('player.savedToSounds') : t('player.saveToSounds')}</button>
            {currentGoal && (
              <button type="button" className="btn btn-secondary" onClick={() => void setCurrentSoundAsDefault()} disabled={defaultSaving} style={{ marginTop: 10 }}>
                <History size={17} />
                {defaultSaving ? t('player.savingDefault') : t('player.useDefault')}
              </button>
            )}
          {defaultMessage && <p role="status" className="text-xs" style={{ color: 'var(--primary)', marginTop: 10 }}>{defaultMessage}</p>}
          {defaultError && <p role="alert" style={{ color: '#ffd3d3', fontSize: 13, marginTop: 10 }}>{defaultError}</p>}
          {saveError && <p role="alert" style={{ color: '#ffd3d3', fontSize: 13, marginTop: 10 }}>{saveError}</p>}
          {offlineMode && <p className="text-xs text-secondary" style={{ marginTop: 10 }}>{t('player.cachedCopy')}</p>}
        </div>

        </div>
      </div>

      {publishDialogOpen && (
        <div role="presentation" onClick={() => !saving && setPublishDialogOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="player-publish-title" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 440px)', padding: 20, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, background: '#202126', boxShadow: '0 -12px 40px rgba(0,0,0,0.45)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 id="player-publish-title" style={{ fontSize: 18, marginBottom: 4 }}>{t('player.saveDialogTitle')}</h2>
                <p className="text-xs text-secondary">{t('player.saveDialogHelp')}</p>
              </div>
              <button aria-label={t('player.closeSave')} className="btn-icon" disabled={saving} onClick={() => setPublishDialogOpen(false)} style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.08)' }}><X size={18} /></button>
            </header>
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" className="btn" aria-pressed={publishAccess === 'public'} disabled={saving} onClick={() => setPublishAccess('public')} style={{ minHeight: 66, borderRadius: 8, justifyContent: 'flex-start', padding: '11px 13px', background: publishAccess === 'public' ? 'rgba(232,240,106,0.1)' : 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: publishAccess === 'public' ? '1px solid rgba(232,240,106,0.45)' : '1px solid var(--surface-border)' }}>
                <Globe2 size={19} />
                <span style={{ display: 'grid', gap: 2, textAlign: 'left', flex: 1 }}><strong>{t('player.public')}</strong><span className="text-xs text-secondary">{t('player.publicHelp')}</span></span>
                {publishAccess === 'public' && <Check size={18} />}
              </button>
              <button type="button" className="btn" aria-pressed={publishAccess === 'private'} disabled={saving} onClick={() => setPublishAccess('private')} style={{ minHeight: 66, borderRadius: 8, justifyContent: 'flex-start', padding: '11px 13px', background: publishAccess === 'private' ? 'rgba(140,106,255,0.14)' : 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: publishAccess === 'private' ? '1px solid rgba(140,106,255,0.5)' : '1px solid var(--surface-border)' }}>
                <LockKeyhole size={19} />
                <span style={{ display: 'grid', gap: 2, textAlign: 'left', flex: 1 }}><strong>{t('player.private')}</strong><span className="text-xs text-secondary">{t('player.privateHelp')}</span></span>
                {publishAccess === 'private' && <Check size={18} />}
              </button>
            </div>
            {saveError && <p role="alert" style={{ color: '#ffd3d3', fontSize: 13, marginTop: 12 }}>{saveError}</p>}
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveToMySounds(publishAccess)} style={{ width: '100%', minHeight: 48, marginTop: 16, justifyContent: 'center' }}>
              {saving ? <LoaderCircle size={18} className="animate-spin" /> : publishAccess === 'public' ? <Globe2 size={18} /> : <LockKeyhole size={18} />}
              {saving ? t('player.saving') : publishAccess === 'public' ? t('player.savePublic') : t('player.savePrivate')}
            </button>
          </section>
        </div>
      )}

      {showAiAdjust && (
        <div className="adjust-sheet-backdrop" onClick={() => setShowAiAdjust(false)}>
          <section className="adjust-sheet" role="dialog" aria-modal="true" aria-labelledby="ai-adjust-title" onClick={(event) => event.stopPropagation()}>
            <div className="adjust-sheet-handle" />
            <div className="ai-adjust-header">
              <div>
                <h3 id="ai-adjust-title">{t('player.aiTitle')}</h3>
                <p>{t('player.aiHelp')}</p>
              </div>
              <button className="ai-adjust-close" onClick={() => setShowAiAdjust(false)} aria-label={t('player.closeAi')}>
                <X size={18} />
              </button>
            </div>

            <div className="ai-adjust-conversation" aria-live="polite">
              {((mix?.recipeData.audit as { edits?: Array<{ instruction?: string; operation?: string }> } | undefined)?.edits ?? []).slice(-4).map((edit, index) => (
                <div className="ai-adjust-message" key={`${edit.instruction ?? edit.operation}-${index}`}>
                  <span>{t('player.you')}</span>
                  <p>{edit.instruction ?? t('player.updatedSoundscape')}</p>
                </div>
              ))}
              {adjustmentResult && <div className="ai-adjust-response"><Sparkles size={14} /><p>{adjustmentResult}</p></div>}
              {adjustmentError && <p className="ai-adjust-error" role="alert">{adjustmentError}</p>}
            </div>

            <form className="ai-adjust-form" onSubmit={applyAiAdjustment}>
              <textarea
                value={adjustmentText}
                onChange={(event) => setAdjustmentText(event.target.value)}
                placeholder={t('player.aiPlaceholder')}
                aria-label={t('player.describeChange')}
                rows={3}
                autoFocus
              />
              <button type="submit" disabled={!adjustmentText.trim() || adjustmentLoading}>
                {adjustmentLoading ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}
                {adjustmentLoading ? t('player.updating') : t('player.applyChange')}
              </button>
            </form>
          </section>
        </div>
      )}
      {paywallReason && <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />}

    </div>
  );
};

export default PlayerPage;
