import React, { useState } from 'react';
import { Globe2, Loader2, LockKeyhole, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Mix, ShareVisibility } from '../lib/domain';

type ShareVisibilityDialogProps = {
  mix: Mix;
  onClose: () => void;
  journeyId?: string;
  journeyStartedAt?: number;
};

const ShareVisibilityDialog: React.FC<ShareVisibilityDialogProps> = ({
  mix,
  onClose,
  journeyId,
  journeyStartedAt,
}) => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState<ShareVisibility | null>(null);
  const [error, setError] = useState('');
  const isPrivateWork = mix.status === 'private';

  const createShare = async (visibility: ShareVisibility) => {
    setCreating(visibility);
    setError('');
    try {
      if (visibility === 'public' && isPrivateWork) {
        await api.updateMix(mix.id, { status: 'published' });
      }
      const shareLink = await api.createShareLink(mix.id, {
        intent: visibility === 'public' ? 'tonight' : 'gift',
        visibility,
        title: mix.title,
        description: mix.description,
      });

      if (journeyId) {
        const elapsedMs = Number.isFinite(journeyStartedAt)
          ? Math.max(0, Date.now() - Number(journeyStartedAt))
          : 0;
        api.recordPlaybackEvents(mix.id, journeyId, [{
          type: 'share_created',
          elapsedMs,
          details: { visibility, slug: shareLink.slug },
        }]).catch((metricsError) => console.warn('Could not record share creation:', metricsError));
      }

      const creatorPreview = shareLink.creatorPreviewToken
        ? `&creatorPreviewToken=${encodeURIComponent(shareLink.creatorPreviewToken)}`
        : '';
      navigate(`/s/${shareLink.slug}?share=1${creatorPreview}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create this share link.');
      setCreating(null);
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-visibility-title"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(100%, 440px)', maxHeight: '90dvh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, background: 'rgba(30,30,35,0.85)', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(24px)', animation: 'fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 id="share-visibility-title" style={{ fontSize: 18, fontWeight: 600 }}>Who can listen?</h2>
          <button aria-label="Close" className="btn-icon" onClick={onClose} style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.1)' }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ display: 'grid', gap: 12 }}>
          <button
            className="btn"
            disabled={creating !== null}
            onClick={() => createShare('unlisted')}
            style={{ minHeight: 72, borderRadius: 16, justifyContent: 'flex-start', padding: '16px', background: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {creating === 'unlisted' ? <Loader2 size={22} className="animate-spin" /> : <LockKeyhole size={22} />}
            <span style={{ display: 'grid', gap: 4, textAlign: 'left', marginLeft: 6 }}>
              <strong style={{ fontSize: 15 }}>Private</strong>
              <span className="text-xs text-secondary">One link, one registered listener</span>
            </span>
          </button>

          <button
            className="btn"
            disabled={creating !== null}
            onClick={() => createShare('public')}
            style={{ minHeight: 72, borderRadius: 16, justifyContent: 'flex-start', padding: '16px', background: 'rgba(232,240,106,0.1)', color: 'var(--text-primary)', border: '1px solid rgba(232,240,106,0.3)' }}
          >
            {creating === 'public' ? <Loader2 size={22} className="animate-spin" /> : <Globe2 size={22} />}
            <span style={{ display: 'grid', gap: 4, textAlign: 'left', marginLeft: 6 }}>
              <strong style={{ fontSize: 15 }}>Public</strong>
              <span className="text-xs text-secondary">{isPrivateWork ? 'Make this sound public so anyone can listen' : 'Anyone can listen'}</span>
            </span>
          </button>
        </div>

        {error && <p role="alert" style={{ marginTop: 16, color: '#FFB1B1', fontSize: 13, textAlign: 'center' }}>{error}</p>}
      </section>
    </div>
  );
};

export default ShareVisibilityDialog;
