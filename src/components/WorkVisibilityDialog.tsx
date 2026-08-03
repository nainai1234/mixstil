import React, { useState } from 'react';
import { Check, Globe2, Loader2, LockKeyhole, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Mix } from '../lib/domain';

type WorkVisibilityDialogProps = {
  mix: Mix;
  onClose: () => void;
  onUpdated: (mix: Mix) => void;
};

const WorkVisibilityDialog: React.FC<WorkVisibilityDialogProps> = ({ mix, onClose, onUpdated }) => {
  const currentVisibility = mix.status === 'private' ? 'private' : 'public';
  const [selected, setSelected] = useState<'public' | 'private'>(currentVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveVisibility = async () => {
    if (selected === currentVisibility) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMix(mix.id, {
        status: selected === 'public' ? 'published' : 'private',
      });
      onUpdated(updated);
      onClose();

      if (selected === 'public' && updated.renderStatus !== 'ready') {
        void api.renderMix(updated.id)
          .then((result) => onUpdated(result.mix))
          .catch((renderError) => console.warn('Visibility changed, but audio rendering failed:', renderError));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not change visibility.');
      setSaving(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={() => !saving && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-visibility-title"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(100%, 440px)', maxHeight: '90dvh', overflowY: 'auto', padding: 24, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, background: 'rgba(30,30,35,0.85)', backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'fadeSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 id="work-visibility-title" style={{ fontSize: 18, fontWeight: 600 }}>Change visibility</h2>
          <button aria-label="Close visibility settings" className="btn-icon" disabled={saving} onClick={onClose} style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.1)' }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ display: 'grid', gap: 12 }}>
          <button
            className="btn"
            disabled={saving}
            onClick={() => setSelected('public')}
            style={{ minHeight: 72, borderRadius: 16, justifyContent: 'flex-start', padding: '16px', background: selected === 'public' ? 'rgba(232,240,106,0.1)' : 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: selected === 'public' ? '1px solid rgba(232,240,106,0.3)' : '1px solid rgba(255,255,255,0.05)' }}
          >
            <Globe2 size={22} />
            <span style={{ display: 'grid', gap: 4, textAlign: 'left', flex: 1, marginLeft: 6 }}><strong style={{ fontSize: 15 }}>Public</strong><span className="text-xs text-secondary">Everyone in the app can listen</span></span>
            {selected === 'public' && <Check size={20} />}
          </button>
          <button
            className="btn"
            disabled={saving}
            onClick={() => setSelected('private')}
            style={{ minHeight: 72, borderRadius: 16, justifyContent: 'flex-start', padding: '16px', background: selected === 'private' ? 'rgba(140,106,255,0.1)' : 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: selected === 'private' ? '1px solid rgba(140,106,255,0.3)' : '1px solid rgba(255,255,255,0.05)' }}
          >
            <LockKeyhole size={22} />
            <span style={{ display: 'grid', gap: 4, textAlign: 'left', flex: 1, marginLeft: 6 }}><strong style={{ fontSize: 15 }}>Private</strong><span className="text-xs text-secondary">Only you and recipients of private links</span></span>
            {selected === 'private' && <Check size={20} />}
          </button>
        </div>

        {selected === 'private' && currentVisibility === 'public' && (
          <p className="text-xs text-secondary" style={{ marginTop: 16, lineHeight: 1.5, textAlign: 'center' }}>Existing public links will stop working.</p>
        )}
        {error && <p role="alert" style={{ marginTop: 16, color: '#FFB1B1', fontSize: 13, textAlign: 'center' }}>{error}</p>}

        <button className="btn btn-primary" disabled={saving} onClick={saveVisibility} style={{ width: '100%', minHeight: 52, marginTop: 24, borderRadius: 16, justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>
          {saving ? <><Loader2 size={20} className="animate-spin" style={{ marginRight: 8 }} /> Saving...</> : selected === currentVisibility ? 'Done' : 'Save visibility'}
        </button>
      </section>
    </div>
  );
};

export default WorkVisibilityDialog;
