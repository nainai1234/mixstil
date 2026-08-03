import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Plus, Volume2, VolumeX, X, Mic, Upload, Cloud, Music, Sparkles, LayoutList, Trash2, Check, Loader2, Languages, Wand2, CircleAlert, RotateCcw } from 'lucide-react';
import { useAudioMixer } from '../context/AudioMixerContext';
import VoiceRecorder from '../components/VoiceRecorder';
import { api, tracksToRecipe } from '../lib/api';
import type { AudioStem, Mix } from '../lib/domain';
import type { AudioTrackDef } from '../context/AudioContext';
import VolumeAutomationEditor from '../components/VolumeAutomationEditor';
import { normalizeVolumeAutomation } from '../lib/volumeAutomation';

const MixerWorkbench: React.FC = () => {
  const { tracks, isPlaying, playbackError, togglePlay, toggleMute, updateVolume, updateVolumeAutomation, refreshPlayback, stopAll, updateTrackTime, addTrack, removeTrack, loadCustomTracks } = useAudioMixer();
  const navigate = useNavigate();
  const location = useLocation();
  const routeParams = new URLSearchParams(location.search);
  const shouldAutoplay = routeParams.get('autoplay') === '1' || location.state?.autoplay === true;
  const mixId = routeParams.get('mixId') ?? location.state?.mixId ?? localStorage.getItem('draft_mix_id');
  const journeyId = routeParams.get('journeyId');
  const journeyStartedAt = Number(routeParams.get('startedAt'));

  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('nature');
  const [stems, setStems] = useState<AudioStem[]>([]);
  const [currentMix, setCurrentMix] = useState<Mix | null>(null);
  const [guidedVoiceEnabled, setGuidedVoiceEnabled] = useState(false);
  const [loadedMixId, setLoadedMixId] = useState<string | null>(null);
  const [voiceTab, setVoiceTab] = useState<'tts' | 'lib' | 'upload' | 'record'>('tts');
  const [voiceLanguage, setVoiceLanguage] = useState<'en' | 'zh'>('zh');
  const [voiceScriptText, setVoiceScriptText] = useState('');
  const [voiceScriptStatus, setVoiceScriptStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [voicePreviewStatus, setVoicePreviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [automaticVoiceStatus, setAutomaticVoiceStatus] = useState<'off' | 'preparing' | 'ready' | 'fallback'>('off');
  const [pendingVoiceTracks, setPendingVoiceTracks] = useState<Awaited<ReturnType<typeof api.getMix>>['tracks'] | null>(null);
  const [voicePreset, setVoicePreset] = useState('default');
  const [voiceBlocks, setVoiceBlocks] = useState<Array<{ id: string; role: string; text: string; pauseAfterSeconds: number }>>([]);
  const [editingTrack, setEditingTrack] = useState<AudioTrackDef | null>(null);
  const [workbenchSaveStatus, setWorkbenchSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [workbenchSaveError, setWorkbenchSaveError] = useState('');
  const [previewStemId, setPreviewStemId] = useState<string | null>(null);
  const [recipeEditText, setRecipeEditText] = useState('');
  const [recipeEditStatus, setRecipeEditStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [recipeEditMessage, setRecipeEditMessage] = useState('');
  const autoplayAttemptedRef = useRef(false);
  const automaticVoiceAttemptedRef = useRef(false);
  const playbackRequestedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const playbackFailedRef = useRef(false);
  const clipDragMovedRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const [firstPlaybackRequested, setFirstPlaybackRequested] = useState(false);
  
  // Track Editor Local State
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = React.useRef<HTMLAudioElement | null>(null);
  const automaticVoiceRequested = guidedVoiceEnabled && Boolean(
    (currentMix?.recipeData.audioIntent as any)?.guidedVoice?.enabled
    || (currentMix?.recipeData as any)?.quickCreate?.guidedVoiceRequested,
  );
  const automaticVoiceAlreadyReady = Boolean(currentMix?.recipeData.tracks.some((track) => track.role === 'voice' && !track.isMuted));

  const stopTrackPreview = React.useCallback(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
      audioPreviewRef.current = null;
    }
    setIsPlayingPreview(false);
    setPreviewStemId(null);
  }, []);

  // Stop preview audio when modal closes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!editingTrack) {
      stopTrackPreview();
    }
  }, [editingTrack, stopTrackPreview]);

  useEffect(() => {
    if (!isAddTrackOpen) stopTrackPreview();
  }, [isAddTrackOpen, stopTrackPreview]);

  const maxTracks = 6;
  const baseSlots = [
    { title: 'Environment (环境音)', icon: <Cloud size={16}/>, category: 'nature' },
    { title: 'Melody (音乐)', icon: <Music size={16}/>, category: 'music' },
  ];
  const categoryTabs = [
    { id: 'nature', label: 'Nature', icon: Cloud },
    { id: 'noise', label: 'Noise', icon: Volume2 },
    { id: 'music', label: 'Music', icon: Music },
    ...(guidedVoiceEnabled ? [{ id: 'voice', label: 'Voice', icon: Mic }] : []),
    { id: 'accent', label: 'Accent', icon: Sparkles },
  ];

  useEffect(() => {
    let cancelled = false;
    const loadMix = async () => {
      try {
        const capabilities = await api.getProductCapabilities().catch(() => ({ releaseChannel: 'voice-free-beta' as const, guidedVoice: false }));
        if (cancelled) return;
        setGuidedVoiceEnabled(capabilities.guidedVoice);
        if (mixId) {
          const result = await api.getMix(mixId);
          if (cancelled) return;
          setCurrentMix(result.mix);
          localStorage.setItem('draft_mix_id', result.mix.id);
          loadCustomTracks(capabilities.guidedVoice ? result.tracks : result.tracks.filter((track) => track.role !== 'voice'));
          setLoadedMixId(result.mix.id);
          return;
        }
        navigate('/ai-heal', { replace: true });
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to load the current mix:', error);
        navigate('/ai-heal', { replace: true });
      }
    };
    void loadMix();
    
    // Stop playing when leaving the mixer workbench
    return () => {
      cancelled = true;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!guidedVoiceEnabled) {
      setAutomaticVoiceStatus('off');
      return;
    }
    if (!currentMix?.id || automaticVoiceAttemptedRef.current) return;
    if (!automaticVoiceRequested) {
      setAutomaticVoiceStatus('off');
      return;
    }
    if (automaticVoiceAlreadyReady) {
      setAutomaticVoiceStatus('ready');
      return;
    }
    automaticVoiceAttemptedRef.current = true;
    setAutomaticVoiceStatus('preparing');

    const applyReadyVoice = async (audioUrl?: string) => {
      const refreshed = await api.getMix(currentMix.id);
      setCurrentMix(refreshed.mix);
      setVoicePreviewUrl(audioUrl ?? null);
      if (isPlayingRef.current) setPendingVoiceTracks(refreshed.tracks);
      else loadCustomTracks(refreshed.tracks);
      setAutomaticVoiceStatus('ready');
    };

    const waitForReady = async () => {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const status = await api.getVoicePreviewStatus(currentMix.id);
        if (status.status === 'ready') {
          await applyReadyVoice(status.audioUrl);
          return;
        }
        if (status.status === 'failed') throw new Error(status.error || 'Controlled voice preview failed.');
      }
      throw new Error('Controlled voice preview timed out.');
    };

    api.ensureVoicePreview(currentMix.id)
      .then(async (result) => {
        if (result.status === 'ready') await applyReadyVoice(result.audioUrl);
        else await waitForReady();
      })
      .catch((error) => {
        console.warn('Automatic guided voice fell back to voice-off:', error);
        setAutomaticVoiceStatus('fallback');
      });
  }, [automaticVoiceAlreadyReady, automaticVoiceRequested, currentMix?.id, guidedVoiceEnabled, loadCustomTracks]);

  useEffect(() => {
    if (isPlaying || !pendingVoiceTracks) return;
    loadCustomTracks(pendingVoiceTracks);
    setPendingVoiceTracks(null);
  }, [isPlaying, loadCustomTracks, pendingVoiceTracks]);

  const elapsedFromJourneyStart = useCallback(() => Number.isFinite(journeyStartedAt)
    ? Math.max(0, Date.now() - journeyStartedAt)
    : 0, [journeyStartedAt]);

  const recordPlaybackEvent = useCallback((type: 'playback_requested' | 'playback_started' | 'playback_failed', details?: Record<string, unknown>) => {
    if (!mixId || !journeyId) return;
    api.recordPlaybackEvents(mixId, journeyId, [{ type, elapsedMs: elapsedFromJourneyStart(), details }])
      .catch((metricsError) => console.warn(`Could not record ${type}:`, metricsError));
  }, [elapsedFromJourneyStart, journeyId, mixId]);

  const handleLiveMixToggle = useCallback(() => {
    if (!isPlaying && !playbackRequestedRef.current) {
      playbackRequestedRef.current = true;
      setFirstPlaybackRequested(true);
      recordPlaybackEvent('playback_requested', { trigger: shouldAutoplay ? 'quick_create_autoplay' : 'manual' });
    }
    togglePlay();
  }, [isPlaying, recordPlaybackEvent, shouldAutoplay, togglePlay]);

  useEffect(() => {
    if (!shouldAutoplay || !mixId || loadedMixId !== mixId || tracks.length === 0 || autoplayAttemptedRef.current) return;
    autoplayAttemptedRef.current = true;
    handleLiveMixToggle();
  }, [handleLiveMixToggle, loadedMixId, mixId, shouldAutoplay, tracks.length]);

  useEffect(() => {
    if (!firstPlaybackRequested || !isPlaying || playbackStartedRef.current) return;
    playbackStartedRef.current = true;
    recordPlaybackEvent('playback_started', { trackCount: tracks.length });
  }, [firstPlaybackRequested, isPlaying, recordPlaybackEvent, tracks.length]);

  useEffect(() => {
    if (!firstPlaybackRequested || !playbackError || playbackFailedRef.current) return;
    playbackFailedRef.current = true;
    recordPlaybackEvent('playback_failed', { reason: playbackError });
  }, [firstPlaybackRequested, playbackError, recordPlaybackEvent]);

  useEffect(() => {
    if (!firstPlaybackRequested || isPlaying || playbackFailedRef.current) return;
    const timeout = window.setTimeout(() => {
      if (playbackStartedRef.current || playbackFailedRef.current) return;
      playbackFailedRef.current = true;
      recordPlaybackEvent('playback_failed', { reason: 'startup_timeout', timeoutMs: 10000 });
    }, 10000);
    return () => window.clearTimeout(timeout);
  }, [firstPlaybackRequested, isPlaying, recordPlaybackEvent]);

  const persistWorkbenchRecipe = async (nextTracks: AudioTrackDef[] = tracks) => {
    if (!currentMix?.id) return null;
    setWorkbenchSaveStatus('saving');
    setWorkbenchSaveError('');
    try {
      const saved = await api.updateMix(currentMix.id, {
        recipeData: tracksToRecipe(nextTracks, stems, currentMix.recipeData),
      });
      setCurrentMix(saved);
      setWorkbenchSaveStatus('idle');
      return saved;
    } catch (error) {
      setWorkbenchSaveStatus('error');
      setWorkbenchSaveError(error instanceof Error ? error.message : 'Could not save the mix changes.');
      return null;
    }
  };

  const handleSave = async () => {
    const saved = await persistWorkbenchRecipe();
    if (!saved) return;
    navigate('/creator/save', { state: { mixId: saved.id } });
  };

  const openModalFor = (category: string) => {
    const normalizedCategory = category.toLowerCase();
    setActiveCategory(categoryTabs.some((tab) => tab.id === normalizedCategory) ? normalizedCategory : 'nature');
    setIsAddTrackOpen(true);
  };

  useEffect(() => {
    api.listAudioStems().then(setStems).catch((error) => {
      console.warn('Failed to load audio stems:', error);
      setStems([]);
    });
  }, []);

  useEffect(() => {
    if (!currentMix?.id || activeCategory !== 'voice' || voiceTab !== 'tts') return;
    setVoiceScriptStatus('loading');
    api.getVoiceScript(currentMix.id, voiceLanguage).then((result) => {
      setVoiceBlocks(result.blocks);
      setVoiceScriptText(result.script);
      setVoiceScriptStatus('ready');
    }).catch((error) => {
      console.warn('Failed to load voice script:', error);
      setVoiceScriptStatus('error');
      setVoicePreviewError(error instanceof Error ? error.message : 'Failed to load voice script.');
    });
  }, [activeCategory, currentMix?.id, voiceLanguage, voiceTab]);

  const handleGenerateVoicePreview = async () => {
    if (!currentMix?.id) return;
    setVoicePreviewStatus('loading');
    setVoicePreviewError(null);
    try {
      const result = await api.generateVoicePreview(currentMix.id, {
        language: voiceLanguage,
        scriptText: voiceScriptText,
        voice: voicePreset === 'default' ? undefined : voicePreset,
      });
      setVoicePreviewUrl(result.audioUrl);
      setCurrentMix(result.mix);
      const refreshed = await api.getMix(result.mix.id);
      loadCustomTracks(refreshed.tracks);
      setVoicePreviewStatus('ready');
      setIsAddTrackOpen(false);
    } catch (error) {
      setVoicePreviewStatus('error');
      setVoicePreviewError(error instanceof Error ? error.message : 'Voice preview generation failed.');
    }
  };

  const handleRecipeEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentMix?.id || !recipeEditText.trim()) return;
    setRecipeEditStatus('loading');
    setRecipeEditMessage('');
    try {
      const result = await api.applyRecipeEdit(currentMix.id, recipeEditText.trim());
      setCurrentMix(result.mix);
      loadCustomTracks(result.tracks);
      setRecipeEditText('');
      setRecipeEditStatus('idle');
      setRecipeEditMessage('Updated. Preview the mix or open the track to fine-tune the curve.');
    } catch (error) {
      setRecipeEditStatus('error');
      setRecipeEditMessage(error instanceof Error ? error.message : 'Could not apply this edit.');
    }
  };

  const handleUndoRecipeEdit = async () => {
    if (!currentMix?.id) return;
    setRecipeEditStatus('loading');
    setRecipeEditMessage('');
    try {
      const result = await api.undoRecipeEdit(currentMix.id);
      setCurrentMix(result.mix);
      loadCustomTracks(result.tracks);
      setRecipeEditStatus('idle');
      setRecipeEditMessage('Undid the last deterministic edit.');
    } catch (error) {
      setRecipeEditStatus('error');
      setRecipeEditMessage(error instanceof Error ? error.message : 'No edit is available to undo.');
    }
  };

  const openTrackEditor = (track: AudioTrackDef) => {
    const volumeAutomation = normalizeVolumeAutomation(track.volumeAutomation, track.duration, track.volume);
    updateVolumeAutomation(track.id, volumeAutomation);
    setEditingTrack({ ...track, volumeAutomation });
  };

  const activeCategoryStems = stems.filter((stem) => stem.category.toLowerCase() === activeCategory);

  const addStemToCurrentMix = (stem: AudioStem, index = 0) => {
    stopTrackPreview();
    addTrack({
      id: Date.now() + index,
      stemId: stem.id,
      name: stem.name,
      url: stem.audioUrl,
      volume: stem.defaultVolume,
      isMuted: false,
      startTime: 0,
      duration: 1800,
      sourceDuration: 1800,
      trimStart: 0,
      trimEnd: 0,
      tags: stem.tags,
      loop: stem.category !== 'Accent',
    });
    setIsAddTrackOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-gradient)' }}>
      {/* Top Bar */}
      <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button 
            className="btn-icon" 
            style={{ width: 40, height: 40, background: 'transparent' }}
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ fontSize: '20px' }}>Mixer Workbench</h2>
        </div>
        <button 
          className="btn" 
          onClick={handleSave}
          style={{ background: 'rgba(140, 106, 255, 0.2)', color: 'var(--primary)', border: '1px solid var(--primary)', padding: 'var(--space-2) var(--space-4)' }}
        >
          Publish
        </button>
      </div>

      <form
        onSubmit={handleRecipeEdit}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          padding: '0 var(--space-6) var(--space-4)',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 12, padding: '10px 12px' }}>
          <Wand2 size={16} className="text-primary" />
          <input
            value={recipeEditText}
            onChange={(event) => setRecipeEditText(event.target.value)}
            placeholder="Try: 音乐晚一点进入 / 雨声中间小一点 / 整体更安静"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 14 }}
          />
        </div>
        <button
          className="btn btn-primary"
          disabled={recipeEditStatus === 'loading' || !recipeEditText.trim()}
          style={{ padding: '11px 16px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          {recipeEditStatus === 'loading' ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
          Apply
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleUndoRecipeEdit}
          disabled={recipeEditStatus === 'loading'}
          style={{ padding: '11px 14px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)' }}
        >
          <RotateCcw size={16} />
          Undo
        </button>
      </form>
      {recipeEditMessage && (
        <div
          role={recipeEditStatus === 'error' ? 'alert' : 'status'}
          style={{
            margin: '-8px var(--space-6) var(--space-4)',
            color: recipeEditStatus === 'error' ? '#FFB2B2' : 'var(--text-secondary)',
            fontSize: 12,
          }}
        >
          {recipeEditMessage}
        </div>
      )}
      {workbenchSaveError && (
        <div role="alert" style={{ margin: '-8px var(--space-6) var(--space-4)', color: '#FFB2B2', fontSize: 12 }}>
          {workbenchSaveError}
        </div>
      )}

      {/* Visualizer Area (Preview Half) */}
      <div style={{ flex: '0 0 35%', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: 'var(--space-4)' }}>
        <div style={{ 
          width: 200, height: 200, 
          borderRadius: '50%', 
          border: isPlaying ? '2px solid rgba(0, 240, 255, 0.6)' : '2px solid rgba(0, 240, 255, 0.1)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          position: 'relative',
          boxShadow: isPlaying ? '0 0 80px rgba(0, 240, 255, 0.2), inset 0 0 60px rgba(140, 106, 255, 0.3)' : '0 0 60px rgba(0, 240, 255, 0.05)',
          transition: 'all 0.5s ease'
        }}>
          {/* Animated ring placeholder */}
          <div style={{ 
            position: 'absolute', width: '100%', height: '100%', border: '4px solid var(--accent)', borderRadius: '50%', 
            borderLeftColor: 'transparent', borderBottomColor: 'transparent', 
            transform: 'rotate(45deg)', opacity: isPlaying ? 0.8 : 0.2, transition: 'all 0.5s ease'
          }} />
          
          <h3 style={{ fontSize: '18px', textAlign: 'center', marginBottom: 'var(--space-4)', maxWidth: 160 }}>
            {currentMix?.title ?? 'Live Mix'}
          </h3>
          {automaticVoiceStatus !== 'off' && (
            <p style={{ fontSize: 11, color: automaticVoiceStatus === 'fallback' ? '#ffd3d3' : 'var(--text-secondary)', textAlign: 'center', maxWidth: 176, margin: '-8px 0 10px' }}>
              {automaticVoiceStatus === 'preparing' && 'Preparing controlled guide...'}
              {automaticVoiceStatus === 'ready' && (pendingVoiceTracks ? 'Guide ready for next play' : 'Guide preview ready')}
              {automaticVoiceStatus === 'fallback' && 'Guide unavailable · voice-free mix is ready'}
            </p>
          )}
          
          <button 
            className="btn-icon" 
            aria-label={isPlaying ? 'Pause Live Mix' : 'Play Live Mix'}
            style={{ width: 56, height: 56, background: 'var(--primary)', marginBottom: 'var(--space-4)' }}
            onClick={handleLiveMixToggle}
          >
            {isPlaying ? <Pause fill="white" size={24} /> : <Play fill="white" size={24} style={{ marginLeft: 4 }} />}
          </button>
          {playbackError && (
            <p role="alert" style={{ position: 'absolute', top: 'calc(100% + 10px)', width: 280, textAlign: 'center', color: '#ffd3d3', fontSize: 12 }}>
              Playback needs your attention: {playbackError}
            </p>
          )}
        </div>
      </div>

      {/* Timeline / Tracks Area (Editor Half) */}
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto', overflowX: 'hidden', background: 'rgba(0,0,0,0.3)', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', position: 'sticky', top: 0, zIndex: 20 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', fontWeight: 600 }}>
             <LayoutList size={16} className="text-primary" /> Composition Timeline (30 Min Max)
           </div>
           <span className="text-xs text-secondary">{tracks.length}/{maxTracks} Tracks</span>
        </div>

        {/* Scrollable Canvas Container */}
        <div style={{ width: '100%', overflowX: 'auto', paddingBottom: 16 }}>
          {/* Inner Canvas (300% width means 100% = 10 minutes, 300% = 30 minutes -> exactly 3 screens) */}
          <div style={{ position: 'relative', width: '300%', minHeight: 400, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            {/* Time Ruler (0m - 30m) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
              <span>0m</span>
              <span>5m</span>
              <span>10m</span>
              <span>15m</span>
              <span>20m</span>
              <span>25m</span>
              <span>30m</span>
            </div>

            {/* 1. Render Actual Filled Tracks on Absolute Timeline */}
            {tracks.map((track) => {
               const TOTAL_DURATION = 1800; // 30 minutes in seconds
               const leftPercent = (track.startTime / TOTAL_DURATION) * 100;
               const widthPercent = (track.duration / TOTAL_DURATION) * 100;

               return (
                 <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, position: 'relative' }}>
                    
                    {/* Track Controls (Fixed on left visually) */}
                    <div style={{ width: 150, display: 'flex', alignItems: 'center', background: '#12121A', borderRight: '1px solid var(--surface-border)', padding: '4px 8px', gap: 8, zIndex: 20, position: 'sticky', left: 0 }}>
                      <button 
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: track.isMuted ? 'var(--text-tertiary)' : 'var(--primary)', padding: 0, flexShrink: 0 }}
                        onClick={() => toggleMute(track.id)}
                      >
                        {track.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</span>
                        {track.tags && track.tags[0] && (
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{track.tags[0]}</span>
                        )}
                      </div>
                    </div>

                    {/* The Timeline Canvas for this track */}
                    <div style={{ flex: 1, position: 'relative', height: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                      
                      {/* The "Clip" Block (Draggable Representation) */}
                      <div 
                        data-testid={`track-clip-${track.id}`}
                        style={{ 
                          position: 'absolute', 
                          left: `${leftPercent}%`, 
                          width: `${widthPercent}%`, 
                          height: '100%', 
                          background: track.isMuted ? 'var(--surface-2)' : 'linear-gradient(90deg, rgba(140, 106, 255, 0.4) 0%, rgba(0, 240, 255, 0.2) 100%)', 
                          borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 8,
                          border: track.isMuted ? '1px solid gray' : '1px solid var(--primary)', 
                          cursor: 'ew-resize',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                          overflow: 'hidden', whiteSpace: 'nowrap'
                        }}
                        onClick={() => {
                          if (clipDragMovedRef.current) {
                            clipDragMovedRef.current = false;
                            return;
                          }
                          openTrackEditor(track);
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const initialDuration = track.duration;
                          const parentEl = e.currentTarget.parentElement;
                          if (!parentEl) return;
                          const containerWidth = parentEl.offsetWidth;
                          
                          const handlePointerMove = (moveEvent: PointerEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            if (Math.abs(deltaX) > 3) clipDragMovedRef.current = true;
                            const deltaSeconds = (deltaX / containerWidth) * TOTAL_DURATION;
                            const maxDuration = TOTAL_DURATION - track.startTime;
                            const newDuration = Math.max(1, Math.min(maxDuration, initialDuration + deltaSeconds));
                            updateTrackTime(track.id, track.startTime, newDuration, track.trimStart, Math.max(track.trimStart + 1, track.trimStart + newDuration));
                          };
                          
                          const handlePointerUp = () => {
                            window.removeEventListener('pointermove', handlePointerMove);
                            window.removeEventListener('pointerup', handlePointerUp);
                          };
                          
                          window.addEventListener('pointermove', handlePointerMove);
                          window.addEventListener('pointerup', handlePointerUp);
                        }}
                      >
                        <div
                          aria-hidden="true"
                          title="Drag to adjust start"
                          style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0, width: 12,
                            cursor: 'ew-resize', background: 'rgba(255,255,255,0.16)',
                            borderRight: '1px solid rgba(255,255,255,0.32)', zIndex: 3,
                          }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const startX = event.clientX;
                            const initialStartTime = track.startTime;
                            const initialDuration = track.duration;
                            const initialTrimStart = track.trimStart;
                            const parentEl = event.currentTarget.parentElement?.parentElement;
                            if (!parentEl) return;
                            const containerWidth = parentEl.offsetWidth;

                            const handlePointerMove = (moveEvent: PointerEvent) => {
                              const deltaX = moveEvent.clientX - startX;
                              if (Math.abs(deltaX) > 3) clipDragMovedRef.current = true;
                              const deltaSeconds = (deltaX / containerWidth) * TOTAL_DURATION;
                              let newStartTime = initialStartTime + deltaSeconds;
                              newStartTime = Math.max(0, Math.min(initialStartTime + initialDuration - 1, newStartTime));
                              const consumed = newStartTime - initialStartTime;
                              const newDuration = Math.max(1, initialDuration - consumed);
                              const newTrimStart = Math.max(0, initialTrimStart + consumed);
                              updateTrackTime(track.id, newStartTime, newDuration, newTrimStart, track.trimEnd);
                            };

                            const handlePointerUp = () => {
                              window.removeEventListener('pointermove', handlePointerMove);
                              window.removeEventListener('pointerup', handlePointerUp);
                            };

                            window.addEventListener('pointermove', handlePointerMove);
                            window.addEventListener('pointerup', handlePointerUp);
                          }}
                        />
                        <div
                          aria-hidden="true"
                          title="Drag to adjust duration"
                          style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0, width: 12,
                            cursor: 'ew-resize', background: 'rgba(255,255,255,0.16)',
                            borderLeft: '1px solid rgba(255,255,255,0.32)', zIndex: 3,
                          }}
                        />
                        {(track.volumeAutomation?.length ?? 0) > 1 && (
                          <svg viewBox={`0 0 ${Math.max(1, track.duration)} 100`} preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 4, width: 'calc(100% - 8px)', height: 'calc(100% - 8px)', opacity: track.isMuted ? 0.2 : 0.8, pointerEvents: 'none' }}>
                            <polyline
                              points={[...(track.volumeAutomation ?? [])].sort((a, b) => a.atSeconds - b.atSeconds).map((point) => `${Math.max(0, Math.min(track.duration, point.atSeconds))},${100 - Math.max(0, Math.min(100, point.volume))}`).join(' ')}
                              fill="none"
                              stroke="rgba(255,255,255,0.8)"
                              strokeWidth="1.5"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        )}
                        <span style={{ fontSize: '12px', fontWeight: 600, opacity: track.isMuted ? 0.5 : 1, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                          {track.name} ({track.duration < 60 ? Math.round(track.duration) + 's' : (track.duration/60).toFixed(1) + 'm'})
                        </span>
                        {track.tags && track.tags.map((tag: string, i: number) => (
                          <span key={i} style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', display: widthPercent < 5 ? 'none' : 'inline-block' }}>
                            {tag}
                          </span>
                        ))}
                      </div>

                    </div>
                 </div>
               );
            })}

            {/* 2. Render Explicit Empty Track Slots (Full Width) */}
            {Array.from({ length: maxTracks - tracks.length }).map((_, idx) => {
               const isBaseSlot = idx < (baseSlots.length - tracks.length);
               const slotType = isBaseSlot ? baseSlots[tracks.length + idx].category : 'env';
               const slotTitle = isBaseSlot ? baseSlots[tracks.length + idx].title : 'Custom Track';

               return (
                 <div key={`empty-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, position: 'relative' }}>
                    {/* Empty Slot Button (Fixed on left) */}
                    <div style={{ width: 120, display: 'flex', alignItems: 'center', zIndex: 10, position: 'sticky', left: 0 }}>
                      <button 
                        style={{ 
                          width: '100%', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          background: 'var(--surface-1)', borderRadius: 8, border: '1px dashed var(--surface-border)',
                          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer'
                        }}
                        onClick={() => openModalFor(slotType)}
                      >
                        <Plus size={14} /> Add {slotTitle}
                      </button>
                    </div>

                    {/* Empty Slot Track Area (Dashed full width) */}
                    <div style={{ flex: 1, position: 'relative', height: '100%', borderBottom: '1px dashed rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.1)' }}>Empty Track Lane</span>
                    </div>
                 </div>
               );
            })}

          </div>
        </div>
      </div>

      {/* Add Track Modal */}
      {isAddTrackOpen && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ 
            background: 'linear-gradient(180deg, rgba(30, 30, 42, 0.95) 0%, rgba(15, 15, 20, 1) 100%)',
            borderTopLeftRadius: 24, borderTopRightRadius: 24, 
            padding: 'var(--space-6)', height: '75vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.1)', 
            borderTop: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Add Track to Mix</h3>
              <button 
                className="btn-icon" 
                style={{ background: 'var(--surface-2)', borderRadius: '50%', width: 32, height: 32 }} 
                onClick={() => setIsAddTrackOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 12 }}>
              {/* Categories stay visible while the selected library scrolls. */}
              <nav aria-label="Track categories" style={{ width: 72, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categoryTabs.map(({ id, label, icon: Icon }) => {
                  const isActive = activeCategory === id;
                  return (
                    <button
                      key={id}
                      aria-pressed={isActive}
                      aria-label={label}
                      style={{
                        width: '100%', minHeight: 62, padding: '8px 4px', borderRadius: 10,
                        background: isActive ? 'rgba(140, 106, 255, 0.18)' : 'transparent',
                        color: isActive ? 'white' : 'var(--text-secondary)',
                        border: isActive ? '1px solid rgba(140, 106, 255, 0.55)' : '1px solid transparent',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                        fontSize: 10, fontWeight: isActive ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      onClick={() => setActiveCategory(id)}
                    >
                      <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Selected category content */}
              <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '0 2px var(--space-6) 0' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700 }}>{categoryTabs.find((tab) => tab.id === activeCategory)?.label}</h4>
                  {activeCategory !== 'voice' && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {activeCategoryStems.length} sounds
                    </span>
                  )}
                </div>
              
              {/* Sound Library */}
              {(activeCategory === 'nature' || activeCategory === 'music' || activeCategory === 'noise' || activeCategory === 'accent') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeCategoryStems.map((stem, i) => (
                    <div 
                      key={stem.id} 
                      style={{ 
                        background: 'var(--surface-1)', borderRadius: 12, padding: '12px', 
                        display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--surface-border)',
                        cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.background = 'var(--surface-2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'var(--surface-border)';
                        e.currentTarget.style.background = 'var(--surface-1)';
                      }}
                      onClick={() => {
                        addStemToCurrentMix(stem, i);
                      }}
                    >
                      <button
                        type="button"
                        aria-label={previewStemId === stem.id && isPlayingPreview ? `Pause preview of ${stem.name}` : `Preview ${stem.name}`}
                        style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', border: '1px solid transparent', cursor: 'pointer' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (previewStemId === stem.id && isPlayingPreview) {
                            stopTrackPreview();
                            return;
                          }

                          stopTrackPreview();
                          const previewAudio = new Audio(stem.audioUrl);
                          audioPreviewRef.current = previewAudio;
                          setPreviewStemId(stem.id);
                          previewAudio.onended = () => {
                            setIsPlayingPreview(false);
                            setPreviewStemId(null);
                            audioPreviewRef.current = null;
                          };
                          previewAudio.play().then(() => {
                            setIsPlayingPreview(true);
                          }).catch((error) => {
                            console.warn('Stem preview failed:', error);
                            stopTrackPreview();
                          });
                        }}
                      >
                        {previewStemId === stem.id && isPlayingPreview ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                      </button>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, overflowWrap: 'anywhere' }}>
                          {stem.name} 
                          {stem.isPremium && <span style={{ fontSize: 10, background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>PRO</span>}
                        </h4>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stem.description || 'High-quality local audio'}</p>
                      </div>

                      <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        {stem.tags && stem.tags[0] && (
                          <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 12 }}>
                            {stem.tags[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {activeCategoryStems.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Sparkles size={28} style={{ marginBottom: 12, opacity: 0.55 }} />
                      <p style={{ color: 'white', fontWeight: 600, marginBottom: 6 }}>No approved accent sounds yet</p>
                      <p style={{ fontSize: 13, lineHeight: 1.5 }}>Bell, water drop, leaves and distant thunder assets are still in licensing and listening review.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Voice Sub-tabs */}
              {activeCategory === 'voice' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 'var(--space-6)' }}>
                    {['tts', 'record', 'lib', 'upload'].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => setVoiceTab(tab as any)}
                        style={{ 
                          background: 'transparent', border: 'none', 
                          color: voiceTab === tab ? 'white' : 'var(--text-secondary)', 
                          borderBottom: voiceTab === tab ? '2px solid var(--primary)' : '2px solid transparent', 
                          paddingBottom: 8, fontWeight: voiceTab === tab ? 600 : 400,
                          textTransform: 'capitalize', transition: 'all 0.2s'
                        }}
                      >
                        {tab === 'tts' ? 'AI TTS' : tab === 'lib' ? 'Library' : tab}
                      </button>
                    ))}
                  </div>

                  {/* TTS Tab */}
                  {voiceTab === 'tts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                          <Languages size={16} />
                          <span>Controlled voice script</span>
                        </div>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          {(['zh', 'en'] as const).map((lang) => (
                            <button
                              key={lang}
                              className="btn"
                              onClick={() => setVoiceLanguage(lang)}
                              style={{
                                padding: '8px 14px',
                                borderRadius: 999,
                                background: voiceLanguage === lang ? 'var(--primary)' : 'var(--surface-2)',
                                color: 'white',
                              }}
                            >
                              {lang.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <select
                        className="glass-panel"
                        value={voicePreset}
                        onChange={(e) => setVoicePreset(e.target.value)}
                        style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', color: 'white', padding: '12px', borderRadius: '12px', fontSize: 14 }}
                      >
                        <option value="default">System default for language</option>
                        {voiceLanguage === 'zh' ? (
                          <option value="Tingting">Tingting</option>
                        ) : (
                          <option value="Samantha">Samantha</option>
                        )}
                      </select>
                      <textarea
                        className="glass-panel"
                        rows={5}
                        value={voiceScriptText}
                        onChange={(e) => setVoiceScriptText(e.target.value)}
                        placeholder="Load the approved script, then make small edits."
                        style={{ resize: 'none', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', color: 'white', padding: '16px', borderRadius: '12px', fontSize: 15 }}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {voiceBlocks.map((block) => (
                          <button
                            key={block.id}
                            className="btn"
                            onClick={() => setVoiceScriptText((current) => `${current}${current ? '\\n\\n' : ''}${block.text}`)}
                            style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--surface-2)', color: 'white' }}
                          >
                            {block.role}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                         <div style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                           {voiceScriptStatus === 'loading' ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
                           <span>{voiceScriptStatus === 'ready' ? 'Approved script loaded' : voiceScriptStatus === 'error' ? 'Script unavailable' : 'Loading approved script'}</span>
                         </div>
                         <button
                           className="btn btn-primary"
                           style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                           onClick={handleGenerateVoicePreview}
                           disabled={voicePreviewStatus === 'loading' || voiceScriptStatus === 'loading' || !voiceScriptText.trim()}
                         >
                           {voicePreviewStatus === 'loading' ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                           Generate Preview
                         </button>
                      </div>
                      {voicePreviewError && (
                        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#FFB2B2', background: 'rgba(255, 75, 75, 0.12)', border: '1px solid rgba(255, 75, 75, 0.35)', borderRadius: 12, padding: 12, fontSize: 13 }}>
                          <CircleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                          <span>{voicePreviewError}</span>
                        </div>
                      )}
                      {voicePreviewUrl && (
                        <div className="glass-panel" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'rgba(140, 106, 255, 0.08)' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Preview ready</div>
                            <div className="text-xs text-secondary">The generated voice track was inserted into the mix. Export stays gated until voice QA is complete.</div>
                          </div>
                          <a href={voicePreviewUrl} target="_blank" rel="noreferrer" className="btn" style={{ padding: '10px 14px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                            Open
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Library Tab */}
                  {voiceTab === 'lib' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                       {['5 Min Body Scan', 'Sleep Countdown', 'Anxiety Relief Guide'].map((name, i) => (
                         <div key={i} className="glass-panel" style={{ padding: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 500 }}>{name}</div>
                              <div className="text-xs text-secondary">By Serenity Staff</div>
                            </div>
                            <button className="btn-icon" style={{ background: 'var(--primary)', width: 32, height: 32 }} onClick={() => setIsAddTrackOpen(false)}>
                               <Plus size={16} fill="white" />
                            </button>
                         </div>
                       ))}
                    </div>
                  )}

                  {/* Uploads Tab */}
                  {voiceTab === 'upload' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) 0', gap: 'var(--space-4)' }}>
                       <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed var(--surface-border)' }}>
                         <Upload size={24} className="text-secondary" />
                       </div>
                       <div style={{ textAlign: 'center' }}>
                         <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Import Local Audio</p>
                         <p className="text-xs text-secondary" style={{ maxWidth: 200, margin: '0 auto' }}>Upload your own guidance or custom sounds. (MP3, WAV)</p>
                       </div>
                       <button className="btn" style={{ background: 'rgba(140, 106, 255, 0.15)', color: 'var(--primary)', padding: '10px 24px', borderRadius: 20 }} onClick={() => alert("Opening file picker...")}>Select File</button>
                    </div>
                  )}

                  {/* Record Tab */}
                  {voiceTab === 'record' && (
                    <VoiceRecorder onAdded={() => setIsAddTrackOpen(false)} />
                  )}

                </div>
              )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Track Editor Modal */}
      {editingTrack && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ 
            background: '#12121A', 
            borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)', 
            padding: 'var(--space-6)', height: 'min(86vh, 760px)', display: 'flex', flexDirection: 'column',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.8)', borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn-icon" aria-label="Close track editor" onClick={() => setEditingTrack(null)} style={{ background: 'var(--surface-1)' }}>
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3 style={{ fontSize: '20px', lineHeight: 1 }}>Edit: {editingTrack.name}</h3>
                  {editingTrack.tags && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {editingTrack.tags.map((tag: string, i: number) => (
                        <span key={i} style={{ fontSize: '10px', color: 'var(--primary)', background: 'rgba(140, 106, 255, 0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(140, 106, 255, 0.2)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn-icon" style={{ background: 'transparent' }} onClick={() => setEditingTrack(null)}>
                <X size={24} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', overflowY: 'auto', paddingRight: 2 }}>
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* Recipe-aware mix preview */}
                <button 
                  className="btn-icon" 
                  aria-label={isPlaying ? 'Pause Mix Preview' : 'Play Mix Preview'}
                  style={{ width: 56, height: 56, background: 'var(--primary)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLiveMixToggle();
                  }}
                >
                  {isPlaying ? <Pause fill="white" size={24} /> : <Play fill="white" size={24} style={{ marginLeft: 4 }} />}
                </button>
                <div style={{ flex: 1 }}>
                  <p className="text-sm font-bold">Mix Preview</p>
                  <p className="text-xs text-secondary">Recipe V2 · volume curve enabled</p>
                </div>
              </div>

              {/* Visual Trimming Area (CapCut Style) */}
              <div style={{ marginBottom: 'var(--space-2)' }}>
                {(() => {
                  const sourceDur = editingTrack.sourceDuration || 600;
                  const trimStart = editingTrack.trimStart || 0;
                  const trimEnd = editingTrack.trimEnd || sourceDur;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Visual Trimming</span>
                        <span className="text-xs font-bold text-primary">
                          Selected: {(trimEnd - trimStart).toFixed(1)}s 
                          <span className="text-secondary" style={{marginLeft: 4, fontWeight: 400}}>/ {(sourceDur / 60).toFixed(1)}m</span>
                        </span>
                      </div>

                      <div 
                        id="waveform-container"
                        style={{ height: 80, background: 'var(--surface-2)', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0', border: '1px solid var(--surface-border)', position: 'relative', overflow: 'hidden' }}
                      >
                         {/* Background Waveform (Full Source) */}
                         <div style={{ display: 'flex', gap: 2, height: '40%', flex: 1, alignItems: 'center', padding: '0 16px', opacity: 0.3 }}>
                            {Array.from({length: 60}).map((_, i) => (
                              <div key={i} style={{ flex: 1, background: 'var(--primary)', height: `${Math.max(10, Math.random() * 100)}%`, borderRadius: 2 }} />
                            ))}
                         </div>

                         {/* Active Trimmed Region */}
                         <div style={{ 
                           position: 'absolute', top: 0, bottom: 0, 
                           left: `${(trimStart / sourceDur) * 100}%`,
                           width: `${((trimEnd - trimStart) / sourceDur) * 100}%`,
                           background: 'rgba(140, 106, 255, 0.15)'
                         }}>
                            {/* Active Waveform Highlight */}
                            <div style={{ display: 'flex', gap: 2, height: '40%', width: '100%', alignItems: 'center', padding: '0 16px', position: 'absolute', top: '30%' }}>
                              {Array.from({length: 20}).map((_, i) => (
                                <div key={i} style={{ flex: 1, background: 'var(--primary)', height: `${Math.max(20, Math.random() * 100)}%`, borderRadius: 2, opacity: 0.8 }} />
                              ))}
                            </div>

                            {/* Left Handle (Trim Start) */}
                            <div 
                              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: 'var(--primary)', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 4, borderBottomRightRadius: 4, transform: 'translateX(-50%)', zIndex: 10 }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const startX = e.clientX;
                                const initialTrim = trimStart;
                                const initialStartTime = editingTrack.startTime;
                                const container = document.getElementById('waveform-container');
                                if (!container) return;
                                const containerWidth = container.offsetWidth;

                                const handleMove = (moveEvent: any) => {
                                  const deltaX = moveEvent.clientX - startX;
                                  const deltaSeconds = (deltaX / containerWidth) * sourceDur;
                                  let newTrim = initialTrim + deltaSeconds;
                                  if (newTrim < 0) newTrim = 0;
                                  if (newTrim >= trimEnd - 1) newTrim = trimEnd - 1; // min 1s gap
                                  
                                  const newDuration = trimEnd - newTrim;
                                  const newStartTime = initialStartTime + (newTrim - initialTrim);
                                  updateTrackTime(editingTrack.id, newStartTime, newDuration, newTrim, trimEnd);
                                  setEditingTrack({...editingTrack, trimStart: newTrim, duration: newDuration, startTime: newStartTime});
                                };

                                const handleUp = () => {
                                  window.removeEventListener('pointermove', handleMove);
                                  window.removeEventListener('pointerup', handleUp);
                                };
                                window.addEventListener('pointermove', handleMove);
                                window.addEventListener('pointerup', handleUp);
                              }}
                            >
                              <div style={{ width: 2, height: 16, background: 'white', borderRadius: 1 }} />
                            </div>

                            {/* Right Handle (Trim End) */}
                            <div 
                              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, background: 'var(--primary)', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 4, borderBottomLeftRadius: 4, transform: 'translateX(50%)', zIndex: 10 }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                const startX = e.clientX;
                                const initialTrim = trimEnd;
                                const container = document.getElementById('waveform-container');
                                if (!container) return;
                                const containerWidth = container.offsetWidth;

                                const handleMove = (moveEvent: any) => {
                                  const deltaX = moveEvent.clientX - startX;
                                  const deltaSeconds = (deltaX / containerWidth) * sourceDur;
                                  let newTrim = initialTrim + deltaSeconds;
                                  if (newTrim > sourceDur) newTrim = sourceDur;
                                  if (newTrim <= trimStart + 1) newTrim = trimStart + 1; // min 1s gap
                                  
                                  const newDuration = newTrim - trimStart;
                                  updateTrackTime(editingTrack.id, editingTrack.startTime, newDuration, trimStart, newTrim);
                                  setEditingTrack({...editingTrack, trimEnd: newTrim, duration: newDuration});
                                };

                                const handleUp = () => {
                                  window.removeEventListener('pointermove', handleMove);
                                  window.removeEventListener('pointerup', handleUp);
                                };
                                window.addEventListener('pointermove', handleMove);
                                window.addEventListener('pointerup', handleUp);
                              }}
                            >
                              <div style={{ width: 2, height: 16, background: 'white', borderRadius: 1 }} />
                            </div>
                         </div>
                      </div>
                    </>
                  );
                })()}
                <p className="text-xs text-secondary" style={{ marginTop: 8 }}>Drag the left and right handles to crop this audio clip directly.</p>
              </div>

              {/* Volume Control */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>Mix Volume</span>
                  <span className="text-secondary">{editingTrack.volume}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={editingTrack.volume} 
                  onInput={(e) => {
                     const nextVolume = parseInt(e.currentTarget.value);
                     const ratio = editingTrack.volume > 0 ? nextVolume / editingTrack.volume : 1;
                     updateVolume(editingTrack.id, nextVolume);
                     setEditingTrack({
                       ...editingTrack,
                       volume: nextVolume,
                       volumeAutomation: editingTrack.volumeAutomation?.map((point) => ({ ...point, volume: Math.max(0, Math.min(100, Math.round(point.volume * ratio))) })),
                     });
                  }}
                  style={{ width: '100%', height: 6 }}
                />
              </div>

              <VolumeAutomationEditor
                duration={editingTrack.duration}
                maximumVolume={editingTrack.volume}
                points={editingTrack.volumeAutomation}
                onChange={(points) => {
                  updateVolumeAutomation(editingTrack.id, points);
                  setEditingTrack({ ...editingTrack, volumeAutomation: points });
                }}
                onCommit={refreshPlayback}
              />

              <div style={{ marginTop: 'auto', display: 'flex', gap: 'var(--space-4)' }}>
                 <button 
                   className="btn" 
                   style={{ background: 'rgba(255, 60, 60, 0.1)', color: '#ff4444', flex: 1, padding: '12px' }}
                   disabled={tracks.length <= 1 || workbenchSaveStatus === 'saving'}
                   title={tracks.length <= 1 ? 'A mix must keep at least one track.' : 'Delete this track'}
                   onClick={async () => {
                     const remainingTracks = tracks.filter((track) => track.id !== editingTrack.id);
                     removeTrack(editingTrack.id);
                     const saved = await persistWorkbenchRecipe(remainingTracks);
                     if (saved) setEditingTrack(null);
                   }}
                 >
                   <Trash2 size={18} style={{ marginRight: 8 }} /> Delete
                 </button>
                 <button 
                   className="btn btn-primary" 
                   style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', fontWeight: 600, fontSize: 15 }}
                   disabled={workbenchSaveStatus === 'saving'}
                   onClick={async () => {
                     const saved = await persistWorkbenchRecipe();
                     if (saved) setEditingTrack(null);
                   }}
                 >
                   {workbenchSaveStatus === 'saving' ? <Loader2 size={18} className="spin" style={{ marginRight: 8 }} /> : <Check size={18} style={{ marginRight: 8 }} />} Done
                 </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default MixerWorkbench;
