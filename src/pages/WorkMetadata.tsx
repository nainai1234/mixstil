import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Lock, AlertTriangle, Sparkles, Loader2, Globe2, LockKeyhole, MoreVertical, Check, X } from 'lucide-react';
import { useAudioMixer } from '../context/AudioMixerContext';
import { api, tracksToRecipe } from '../lib/api';
import type { Mix, User } from '../lib/domain';

const WorkMetadata: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tracks, loadCustomTracks } = useAudioMixer();
  const [navigationContext] = useState(() => ({
    mixId: location.state?.mixId ?? localStorage.getItem('draft_mix_id'),
    journeyId: location.state?.journeyId as string | undefined,
    journeyStartedAt: Number(location.state?.journeyStartedAt),
  }));
  const currentMixId = navigationContext.mixId;
  const journeyId = navigationContext.journeyId;
  const journeyStartedAt = navigationContext.journeyStartedAt;
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishAccess, setPublishAccess] = useState<'public' | 'private'>('public');
  const [complianceError, setComplianceError] = useState('');
  const [currentMix, setCurrentMix] = useState<Mix | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const savesAsNewWork = Boolean(currentMixId && currentMix && currentUser && currentMix.creatorId !== currentUser.id);
  const isReleased = currentMix?.status === 'published' || currentMix?.status === 'private';
  const isOwnedReleased = Boolean(isReleased && currentUser && currentMix?.creatorId === currentUser.id);

  useEffect(() => {
    api.getCurrentUser()
      .then(setCurrentUser)
      .catch((error) => {
        console.warn('Failed to load current user:', error);
      });
  }, []);

  useEffect(() => {
    if (!currentMixId) return;

    api.getMix(currentMixId)
      .then((result) => {
        setCurrentMix(result.mix);
        loadCustomTracks(result.tracks);
        setTitle(result.mix.title);
        setDescription(result.mix.description);
        if (result.mix.status === 'private') setPublishAccess('private');
      })
      .catch((error) => {
        console.warn('Failed to load draft mix metadata:', error);
      });
  }, [currentMixId, loadCustomTracks]);

  useEffect(() => {
    if (currentMixId) return;
    const primaryTrack = tracks[0]?.name || 'Layered Audio';
    setTitle(`${primaryTrack} Soundscape`);
    setDescription(`An editable ambient soundscape featuring ${tracks.map(t => t.name.toLowerCase()).join(', ')}. Mixed for gentle listening and wind-down routines.`);
  }, [currentMixId, tracks]);

  const handleAIAutoGenerate = () => {
    // Simulate AI LLM generation
    setTitle(`Deep Serenity: ${tracks[0]?.name || 'Ambient'} Soundscape`);
    setDescription(`Let the soothing sounds of ${tracks.map(t => t.name.toLowerCase()).join(' and ')} create a calm bedtime atmosphere. This custom audio journey is arranged for gentle relaxation and mindful listening.`);
  };

  const handleSave = async (nextAccess = publishAccess) => {
    if (!title) {
      alert("Please enter a title");
      return;
    }
    const unsafePattern = /\b(cure|treat|treatment|clinically proven|insomnia cure|anxiety cure|heal anxiety|guaranteed sleep)\b/i;
    if (unsafePattern.test(`${title} ${description}`)) {
      setComplianceError('Please avoid medical claims such as cure, treat, clinically proven, or guaranteed sleep.');
      return;
    }

    setIsSaving(true);
    try {
      const user = currentUser ?? await api.getCurrentUser();
      if (!currentUser) setCurrentUser(user);
      const stems = await api.listAudioStems();
      const payload = {
        title,
        description,
        status: nextAccess === 'public' ? 'published' as const : 'private' as const,
        recipeData: tracksToRecipe(tracks, stems, currentMix?.recipeData),
        coverImageUrl: currentMix?.coverImageUrl || '/share-visuals/scene-sleep.jpg',
      };
      const canUpdateCurrentMix = Boolean(currentMixId && currentMix?.creatorId === user.id);
      let saved = canUpdateCurrentMix
        ? await api.updateMix(currentMixId, payload)
        : await api.saveMix(payload);

      if (journeyId) {
        const elapsedMs = Number.isFinite(journeyStartedAt) ? Math.max(0, Date.now() - journeyStartedAt) : 0;
        const events: Parameters<typeof api.recordPlaybackEvents>[2] = [
          { type: 'work_saved', elapsedMs, details: { status: saved.status } },
        ];
        if (saved.status === 'published' || saved.status === 'private') {
          events.push({ type: 'work_published', elapsedMs, details: { publishedVersionId: saved.publishedVersionId, access: nextAccess } });
        }
        api.recordPlaybackEvents(saved.id, journeyId, events)
          .catch((metricsError) => console.warn('Could not record save outcome:', metricsError));
      }

      if (saved.status !== 'draft') localStorage.removeItem('draft_mix_id');
      void api.renderMix(saved.id).catch((renderError) => {
        console.warn('Published work is saved, but background rendering failed:', renderError);
      });
      navigate('/studio', {
        state: {
          publishedMixId: saved.id,
          publishedAccess: nextAccess,
          journeyId,
          journeyStartedAt,
        },
      });
    } catch (requestError) {
      setComplianceError(requestError instanceof Error ? requestError.message : 'Could not save this work.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrimaryAction = () => {
    if (isOwnedReleased) {
      void handleSave();
      return;
    }
    setPublishDialogOpen(true);
  };

  const choosePublishAccess = (nextAccess: 'public' | 'private') => {
    setPublishAccess(nextAccess);
    setMoreMenuOpen(false);
  };

  const handleCoverClick = () => {
    setComplianceError('Custom covers are not available in the current beta.');
  };

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 8, marginBottom: 'var(--space-8)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'transparent' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '18px', textAlign: 'center' }}>Save & Publish</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, position: 'relative' }}>
          <button className="btn" style={{ background: 'transparent', color: 'var(--primary)', padding: '0 4px' }} onClick={handlePrimaryAction} disabled={isSaving}>
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : isOwnedReleased ? 'Save' : 'Publish'}
          </button>
          {isOwnedReleased && (
            <button aria-label="More publishing options" title="More publishing options" className="btn-icon" onClick={() => setMoreMenuOpen((open) => !open)} style={{ width: 36, height: 36, background: 'transparent' }}>
              <MoreVertical size={19} />
            </button>
          )}
          {moreMenuOpen && (
            <div role="menu" style={{ position: 'absolute', right: 0, top: 42, zIndex: 30, width: 188, padding: 6, border: '1px solid var(--surface-border)', borderRadius: 8, background: '#202126', boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
              <button role="menuitem" className="btn" onClick={() => { setMoreMenuOpen(false); setPublishDialogOpen(true); }} style={{ width: '100%', minHeight: 42, justifyContent: 'flex-start', borderRadius: 6, background: 'transparent', color: 'var(--text-primary)' }}>
                {publishAccess === 'public' ? <Globe2 size={17} /> : <LockKeyhole size={17} />}
                Change visibility
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Cover Image */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
        <div 
          className="glass-panel"
          style={{ width: 120, height: 120, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
          onClick={handleCoverClick}
        >
          <ImageIcon size={32} className="text-secondary" />
          <span className="text-xs text-secondary" style={{ marginTop: 'var(--space-2)' }}>Add Cover</span>
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--surface-2)', padding: 4, borderRadius: '50%' }}>
            <Lock size={12} className="text-secondary" />
          </div>
        </div>
      </div>

      {/* Form Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {savesAsNewWork && (
          <div style={{ background: 'rgba(140, 106, 255, 0.12)', border: '1px solid rgba(140, 106, 255, 0.32)', color: '#C7B8FF', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.4 }}>
            This is a shared example mix. Publishing will save it as your own new work.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
          <button 
            onClick={handleAIAutoGenerate}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(140, 106, 255, 0.15)', color: 'var(--primary)', border: '1px solid rgba(140, 106, 255, 0.3)', padding: '4px 12px', borderRadius: 16, fontSize: '12px', cursor: 'pointer' }}
          >
            <Sparkles size={14} /> AI Auto-Write
          </button>
        </div>
        
        <div>
          <label className="text-xs text-secondary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Title</label>
          <input 
            type="text" 
            placeholder="e.g. Gentle Rain & Deep Forest" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', background: 'var(--surface-1)', border: '1px solid var(--surface-border)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none' }}
          />
        </div>

        <div>
          <label className="text-xs text-secondary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Description</label>
          <textarea 
            placeholder="Describe the mood of your soundscape..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', height: 100, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', color: 'white', outline: 'none', resize: 'none' }}
          />
        </div>

        {/* Compliance Warning */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', background: 'rgba(255, 75, 75, 0.1)', border: '1px solid rgba(255, 75, 75, 0.3)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
          <AlertTriangle size={16} style={{ color: '#FF4B4B', flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs" style={{ color: '#FF4B4B', lineHeight: 1.4 }}>
            <strong>Compliance Note:</strong> Do not use medicalized expressions like "cures insomnia" or "treats anxiety". Use terms like "suitable for pre-sleep relaxation".
          </p>
        </div>
        {complianceError && (
          <div style={{ background: 'rgba(255, 75, 75, 0.14)', border: '1px solid rgba(255, 75, 75, 0.35)', color: '#FF8A8A', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {complianceError}
          </div>
        )}
      </div>

      {publishDialogOpen && (
        <div role="presentation" onClick={() => !isSaving && setPublishDialogOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(8px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="publish-visibility-title" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 440px)', padding: 20, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, background: '#202126', boxShadow: '0 -12px 40px rgba(0,0,0,0.45)' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 id="publish-visibility-title" style={{ fontSize: 18 }}>{isOwnedReleased ? 'Change visibility' : 'Publish as'}</h2>
              <button aria-label="Close visibility options" className="btn-icon" disabled={isSaving} onClick={() => setPublishDialogOpen(false)} style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.08)' }}><X size={18} /></button>
            </header>
            <div style={{ display: 'grid', gap: 10 }}>
              <button className="btn" aria-pressed={publishAccess === 'public'} disabled={isSaving} onClick={() => choosePublishAccess('public')} style={{ minHeight: 66, borderRadius: 8, justifyContent: 'flex-start', padding: '11px 13px', background: publishAccess === 'public' ? 'rgba(232,240,106,0.1)' : 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: publishAccess === 'public' ? '1px solid rgba(232,240,106,0.45)' : '1px solid var(--surface-border)' }}>
                <Globe2 size={19} />
                <span style={{ display: 'grid', gap: 2, textAlign: 'left', flex: 1 }}><strong>Public</strong><span className="text-xs text-secondary">Everyone in the app can listen</span></span>
                {publishAccess === 'public' && <Check size={18} />}
              </button>
              <button className="btn" aria-pressed={publishAccess === 'private'} disabled={isSaving} onClick={() => choosePublishAccess('private')} style={{ minHeight: 66, borderRadius: 8, justifyContent: 'flex-start', padding: '11px 13px', background: publishAccess === 'private' ? 'rgba(140,106,255,0.14)' : 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: publishAccess === 'private' ? '1px solid rgba(140,106,255,0.5)' : '1px solid var(--surface-border)' }}>
                <LockKeyhole size={19} />
                <span style={{ display: 'grid', gap: 2, textAlign: 'left', flex: 1 }}><strong>Private</strong><span className="text-xs text-secondary">Only you, unless you create a private share</span></span>
                {publishAccess === 'private' && <Check size={18} />}
              </button>
            </div>
            <button type="button" className="btn btn-primary" disabled={isSaving} onClick={() => void handleSave(publishAccess)} style={{ width: '100%', minHeight: 48, marginTop: 16, justifyContent: 'center' }}>
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : publishAccess === 'public' ? <Globe2 size={18} /> : <LockKeyhole size={18} />}
              {isSaving ? 'Publishing...' : publishAccess === 'public' ? 'Publish publicly' : 'Save privately'}
            </button>
          </section>
        </div>
      )}

    </div>
  );
};

export default WorkMetadata;
