import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, Edit3, Loader2, Pause, Play, QrCode, RefreshCw, RotateCw, Video, Lock } from 'lucide-react';
import type { AudioTrackDef } from '../context/AudioContext';
import { api, getCreditsJsonDownloadUrl, getCreditsTextDownloadUrl, getDownloadUrl } from '../lib/api';
import type { ExportCheck, Mix } from '../lib/domain';

const ShareTools: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mix, setMix] = useState<Mix | null>(null);
  const [mixTracks, setMixTracks] = useState<AudioTrackDef[]>([]);
  const [isPreviewingMix, setIsPreviewingMix] = useState(false);
  const [mixPreviewError, setMixPreviewError] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exportCheck, setExportCheck] = useState<ExportCheck | null>(null);
  const [replacingStemId, setReplacingStemId] = useState<string | null>(null);
  const [previewingAlternativeId, setPreviewingAlternativeId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const mixPreviewRefs = useRef<HTMLAudioElement[]>([]);

  const shareUrl = `${window.location.origin}/work/${id}`;
  const renderState = isRendering ? 'rendering' : mix?.renderStatus ?? 'not_rendered';
  const renderLabel = renderState === 'ready'
    ? 'Download MP3'
    : renderState === 'failed'
      ? 'Retry MP3 Render'
      : renderState === 'rendering'
        ? 'Rendering MP3...'
        : 'Render Downloadable MP3';
  const renderDescription = renderState === 'ready'
    ? 'Export-ready audio is available for this work'
    : renderState === 'failed'
      ? 'The last render failed. Review the message below and retry after fixing it.'
      : renderState === 'rendering'
        ? 'Freezing the live mix into a downloadable audio file'
        : 'Create a frozen audio file from approved stems';

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getMix(id), api.getExportCheck(id)])
      .then(([mixResult, check]) => {
        setMix(mixResult.mix);
        setMixTracks(mixResult.tracks);
        setExportCheck(check);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load this work.'));
  }, [id]);

  useEffect(() => () => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    mixPreviewRefs.current.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    mixPreviewRefs.current = [];
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setMessage('Share link copied.');
    setError('');
  };

  const handleDownload = async () => {
    if (!id) return;
    setError('');
    setMessage('');

    if (mix?.renderStatus === 'ready' && mix.renderedAudioUrl) {
      window.location.href = getDownloadUrl(id);
      return;
    }

    setIsRendering(true);
    try {
      const result = await api.renderMix(id);
      setMix(result.mix);
      setExportCheck(result.exportCheck ?? { exportReady: true, audibleTrackCount: result.mix.recipeData.tracks.length, blockedStems: [] });
      setMessage('MP3 is ready. Download should start automatically.');
      window.location.href = getDownloadUrl(id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not render this MP3.');
      const payload = (requestError as any)?.payload;
      if (payload?.mix) setMix(payload.mix);
      if (payload?.exportCheck) setExportCheck(payload.exportCheck);
    } finally {
      setIsRendering(false);
    }
  };

  const handleLockedFeature = (tier: string) => {
    setMessage(`${tier} sharing tools are not available in the current beta.`);
  };

  const handleReplaceBlocked = async (stemId?: string, replacementStemId?: string) => {
    if (!id) return;
    setError('');
    setMessage('');
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    stopFixedMixPreview();
    setPreviewingAlternativeId(null);
    setReplacingStemId(stemId ?? 'all');
    try {
      const result = await api.replaceBlockedStems(id, stemId ? { stemId, replacementStemId } : {});
      setMix(result.mix);
      setExportCheck(result.exportCheck);
      const refreshed = await api.getMix(id);
      setMixTracks(refreshed.tracks);
      setMessage(result.replacements.map((item) => `Replaced ${item.fromName} with ${item.toName}.`).join(' '));
    } catch (requestError) {
      const payload = (requestError as any)?.payload;
      if (payload?.exportCheck) setExportCheck(payload.exportCheck);
      setError(requestError instanceof Error ? requestError.message : 'Could not replace blocked stems.');
    } finally {
      setReplacingStemId(null);
    }
  };

  const handlePreviewAlternative = (alternativeId: string, audioUrl: string) => {
    stopFixedMixPreview();
    if (previewingAlternativeId === alternativeId) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewingAlternativeId(null);
      return;
    }

    previewAudioRef.current?.pause();
    const audio = new Audio(audioUrl);
    audio.volume = 0.55;
    audio.loop = true;
    audio.onended = () => setPreviewingAlternativeId(null);
    audio.play()
      .then(() => {
        previewAudioRef.current = audio;
        setPreviewingAlternativeId(alternativeId);
      })
      .catch((playError) => {
        console.warn('Alternative preview failed:', playError);
        setError('Could not preview this audio in the browser.');
        setPreviewingAlternativeId(null);
      });
  };

  const stopFixedMixPreview = () => {
    mixPreviewRefs.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    });
    mixPreviewRefs.current = [];
    setIsPreviewingMix(false);
  };

  const handlePreviewFixedMix = () => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPreviewingAlternativeId(null);
    setMixPreviewError('');

    if (isPreviewingMix) {
      stopFixedMixPreview();
      return;
    }
    if (mixTracks.length === 0) {
      setMixPreviewError('No playable tracks are available for this mix.');
      return;
    }

    const audios = mixTracks
      .filter((track) => !track.isMuted && track.volume > 0)
      .map((track) => {
        const audio = new Audio(track.url);
        audio.loop = typeof track.loop === 'boolean' ? track.loop : track.loop?.enabled ?? true;
        audio.volume = Math.max(0, Math.min(1, track.volume / 100));
        return audio;
      });
    if (audios.length === 0) {
      setMixPreviewError('This mix has no audible tracks to preview.');
      return;
    }

    Promise.allSettled(audios.map((audio) => audio.play())).then((results) => {
      const played = results.some((result) => result.status === 'fulfilled');
      if (!played) {
        audios.forEach((audio) => audio.pause());
        setMixPreviewError('Playback was blocked by the browser. Tap Preview again.');
        return;
      }
      mixPreviewRefs.current = audios;
      setIsPreviewingMix(true);
    });
  };

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'transparent' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '20px' }}>Share & Export</h2>
      </header>

      {/* Card Preview */}
      <div style={{ background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-8)', border: '1px solid var(--surface-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        {/* Cover image hidden temporarily as requested */}
        <div style={{ width: 140, height: 140, borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', background: 'linear-gradient(135deg, #8C6AFF 0%, #00F0FF 100%)', opacity: 0.8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
           <span style={{color: 'rgba(255,255,255,0.8)', fontWeight: 'bold'}}>Soundscape</span>
        </div>
        <h3 style={{ fontSize: '18px', textAlign: 'center', marginBottom: 4 }}>{mix?.title ?? 'My Custom Soundscape'}</h3>
        <p className="text-sm text-secondary">by Local Creator</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)' }}>
          {(mix?.recipeData.moodTags ?? ['Soundscape']).slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs" style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 12 }}>{tag}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {exportCheck?.exportReady && (
          <button
            className="glass-panel"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'left', cursor: 'pointer' }}
            onClick={handlePreviewFixedMix}
            disabled={!mix || mixTracks.length === 0}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(140, 106, 255, 0.18)', color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {isPreviewingMix ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
            </div>
            <div>
              <h4 style={{ fontSize: '16px' }}>{isPreviewingMix ? 'Stop Fixed Mix Preview' : 'Preview Fixed Mix'}</h4>
              <p className="text-xs text-secondary">Listen to the current approved mix before rendering MP3</p>
            </div>
          </button>
        )}

        <button 
          className="glass-panel" 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'left', cursor: 'pointer' }}
          onClick={handleDownload}
          disabled={isRendering || !mix}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0, 240, 255, 0.16)', color: 'var(--accent)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {renderState === 'rendering'
              ? <Loader2 size={20} className="animate-spin" />
              : renderState === 'ready'
                ? <CheckCircle2 size={20} />
                : renderState === 'failed'
                  ? <RotateCw size={20} />
                  : <Download size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px' }}>{renderLabel}</h4>
            <p className="text-xs text-secondary">{renderDescription}</p>
          </div>
        </button>

        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Download size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px' }}>Copyright & Credits</h4>
            <p className="text-xs text-secondary">Download the attribution matched to the frozen soundscape</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn" href={id ? getCreditsTextDownloadUrl(id) : '#'} download style={{ padding: '7px 10px', textDecoration: 'none' }}>TXT</a>
            <a className="btn" href={id ? getCreditsJsonDownloadUrl(id) : '#'} download style={{ padding: '7px 10px', textDecoration: 'none' }}>JSON</a>
          </div>
        </div>

        <button 
          className="glass-panel" 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'left', cursor: 'pointer' }}
          onClick={handleCopy}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(140, 106, 255, 0.2)', color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Copy size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '16px' }}>Get Web Link</h4>
            <p className="text-xs text-secondary">Share a listening link to anyone on the web</p>
          </div>
        </button>

        <button 
          className="glass-panel" 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'left', cursor: 'pointer', position: 'relative' }}
          onClick={() => handleLockedFeature('PLUS')}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <QrCode size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              Export Instagram Poster
              <span style={{ background: 'var(--primary)', color: 'white', padding: '1px 6px', fontSize: '9px', borderRadius: 4 }}>PLUS</span>
            </h4>
            <p className="text-xs text-secondary">Generate a beautiful image for IG Stories</p>
          </div>
          <Lock size={16} className="text-secondary" />
        </button>

        <button 
          className="glass-panel" 
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => handleLockedFeature('PRO')}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Video size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: 6 }}>
              Export TikTok Video
              <span style={{ background: 'var(--accent)', color: 'white', padding: '1px 6px', fontSize: '9px', borderRadius: 4 }}>PRO</span>
            </h4>
            <p className="text-xs text-secondary">Generate a 15s Audiogram for Reels & TikTok</p>
          </div>
          <Lock size={16} className="text-secondary" />
        </button>
      </div>

      {(message || error || mix?.renderStatus === 'failed') && (
        <div style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${error || mix?.renderStatus === 'failed' ? 'rgba(255, 75, 75, 0.35)' : 'rgba(0, 240, 255, 0.25)'}`,
          background: error || mix?.renderStatus === 'failed' ? 'rgba(255, 75, 75, 0.12)' : 'rgba(0, 240, 255, 0.08)',
          color: error || mix?.renderStatus === 'failed' ? '#FFB2B2' : 'var(--text-secondary)',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {error || mix?.renderError || message}
        </div>
      )}

      {mixPreviewError && (
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 190, 90, 0.35)', background: 'rgba(255, 190, 90, 0.08)', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
          {mixPreviewError}
        </div>
      )}

      {mix?.recipeData.audit && (
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Audit Trail</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(mix.recipeData.audit.replacements ?? []).slice(-3).map((item) => (
              <div key={`${item.fromStemId}-${item.toStemId}-${item.createdAt}`} className="text-xs text-secondary" style={{ lineHeight: 1.45 }}>
                Replaced {item.fromName} with {item.toName}
              </div>
            ))}
            {(mix.recipeData.audit.renders ?? []).slice(-2).map((item) => (
              <div key={`${item.status}-${item.createdAt}`} className="text-xs text-secondary" style={{ lineHeight: 1.45 }}>
                Render {item.status === 'ready' ? 'completed' : 'failed'}{item.error ? `: ${item.error}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {exportCheck && !exportCheck.exportReady && (
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 190, 90, 0.35)', background: 'rgba(255, 190, 90, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={18} color="#FFBE5A" />
            <h4 style={{ fontSize: 15, fontWeight: 700 }}>Export needs attention</h4>
          </div>
          <p className="text-xs text-secondary" style={{ lineHeight: 1.5, marginBottom: 12 }}>
            Replace or mute the blocked stems below before creating a downloadable MP3.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {exportCheck.blockedStems.map((stem) => (
              <div key={stem.stemId} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{stem.name}</span>
                  <span className="text-xs text-secondary">{stem.category}</span>
                </div>
                <p className="text-xs text-secondary" style={{ lineHeight: 1.45 }}>
                  {stem.reasons.map((reason) => reason.replaceAll('_', ' ')).join(', ')}
                </p>
                {stem.alternatives.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {stem.alternatives.map((alternative) => (
                      <div
                        key={alternative.id}
                        style={{ padding: 9, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0, 240, 255, 0.08)', border: '1px solid rgba(0, 240, 255, 0.14)', borderRadius: 8 }}
                      >
                        <button
                          aria-label={previewingAlternativeId === alternative.id ? `Stop ${alternative.name}` : `Preview ${alternative.name}`}
                          className="btn-icon"
                          style={{ width: 30, height: 30, flexShrink: 0, background: 'rgba(255,255,255,0.08)' }}
                          onClick={() => handlePreviewAlternative(alternative.id, alternative.audioUrl)}
                        >
                          {previewingAlternativeId === alternative.id ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                        </button>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>{alternative.name}</span>
                          <span className="text-xs text-secondary">{alternative.defaultVolume}% default volume</span>
                        </span>
                        <button
                          className="btn"
                          style={{ padding: '7px 10px', flexShrink: 0, background: 'rgba(0, 240, 255, 0.14)', color: 'var(--accent)' }}
                          onClick={() => handleReplaceBlocked(stem.stemId, alternative.id)}
                          disabled={replacingStemId !== null}
                        >
                          {replacingStemId === stem.stemId ? <Loader2 size={14} className="animate-spin" /> : 'Select'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="btn"
                  style={{ marginTop: 10, width: '100%', padding: 9, display: 'flex', justifyContent: 'center', gap: 8, background: 'rgba(140, 106, 255, 0.14)', color: 'var(--primary)' }}
                  onClick={() => handleReplaceBlocked(stem.stemId)}
                  disabled={replacingStemId !== null}
                >
                  {replacingStemId === stem.stemId ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Auto-pick Approved Alternative
                </button>
              </div>
            ))}
          </div>
          {exportCheck.blockedStems.length > 1 && (
            <button
              className="btn"
              style={{ width: '100%', padding: 12, display: 'flex', justifyContent: 'center', gap: 8, background: 'rgba(0, 240, 255, 0.12)', color: 'var(--accent)', marginBottom: 10 }}
              onClick={() => handleReplaceBlocked()}
              disabled={replacingStemId !== null}
            >
              {replacingStemId === 'all' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Replace All Blocked Stems
            </button>
          )}
          <button
            className="btn"
            style={{ width: '100%', padding: 12, display: 'flex', justifyContent: 'center', gap: 8, background: 'rgba(140, 106, 255, 0.18)', color: 'var(--primary)' }}
            onClick={() => navigate('/creator/mix', { state: { mixId: id } })}
          >
            <Edit3 size={16} /> Open Mixer to Fix
          </button>
        </div>
      )}
      
      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', boxShadow: '0 8px 24px rgba(140, 106, 255, 0.4)' }}
          onClick={() => navigate(`/work/${id}`)}
        >
          View Live Page (Listener View)
        </button>
      </div>
    </div>
  );
};

export default ShareTools;
