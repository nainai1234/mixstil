import React, { useEffect, useState } from 'react';
import { Layers3, Play, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { api } from '../lib/api';
import { summarizeSupplyDecision } from '../lib/generationSupply';
import { useI18n } from '../lib/i18n';

type AiRecipeResult = Awaited<ReturnType<typeof api.quickCreate>>;

interface AudioRecipeModalProps {
  onClose: () => void;
  prompt: string;
  result: AiRecipeResult;
  journey?: { id: string; startedAt: number } | null;
}

const AudioRecipeModal: React.FC<AudioRecipeModalProps> = ({ onClose, prompt, result, journey }) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowContent(true), 50);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
      zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface-1)', borderTopLeftRadius: 8, borderTopRightRadius: 8,
        width: '100%', maxWidth: 500, padding: 'var(--space-6)', borderTop: '1px solid var(--surface-border)',
        transform: showContent ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s ease',
        maxHeight: '88vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <div>
            <p className="text-xs text-secondary" style={{ marginBottom: 4 }}>{t('create.generatedSummary')}</p>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>{result.mix.title}</h2>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: 'var(--space-5)' }}>
          <p className="text-xs text-secondary" style={{ marginBottom: 8 }}>{prompt}</p>
          <p className="text-secondary text-sm">{t('create.whyApprovedFallback')}</p>
        </div>

        <div
          aria-label={t('player.supplyTitle')}
          style={{
            marginBottom: 'var(--space-5)',
            padding: 13,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          {(() => {
            const supply = summarizeSupplyDecision(result.generationDecision, t);
            return (
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontSize: 14 }}>{t('player.supplyTitle')}: {supply.label}</strong>
                <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
                  {supply.description}
                </p>
              </div>
            );
          })()}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
          {result.mix.recipeData.moodTags.map((tag) => (
            <span key={tag} style={{ fontSize: 12, padding: '5px 9px', background: 'var(--surface-2)', borderRadius: 4 }}>
              {tag}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-6)' }}>
          {result.tracks.map((track) => (
            <div key={track.id} className="glass-panel" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 38, height: 38, background: 'rgba(140,106,255,0.14)', color: 'var(--primary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers3 size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{track.name}</h4>
                <p className="text-xs text-secondary">{t('player.layerVolume', { name: track.name })} {track.volume}%</p>
              </div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: 16, borderRadius: 8, fontWeight: 700, fontSize: 16, display: 'flex', gap: 8, justifyContent: 'center' }}
          onClick={() => {
            onClose();
            const params = new URLSearchParams({ mixId: result.mix.id });
            if (journey?.id) params.set('journeyId', journey.id);
            if (journey?.startedAt) params.set('journeyStartedAt', String(journey.startedAt));
            navigate(`/player?${params.toString()}`, { state: { mixId: result.mix.id, journeyId: journey?.id, journeyStartedAt: journey?.startedAt } });
          }}
        >
          <Play size={20} /> {t('common.play')}
        </button>
        <button
          style={{ width: '100%', marginTop: 10, padding: 12, border: 0, background: 'transparent', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center', gap: 7 }}
          onClick={() => navigate(`/creator/mix?mixId=${encodeURIComponent(result.mix.id)}${journey ? `&journeyId=${encodeURIComponent(journey.id)}&startedAt=${journey.startedAt}` : ''}`, { state: { fromAi: true } })}
        >
          <Sparkles size={16} /> {t('player.advanced')}
        </button>
      </div>
    </div>
  );
};

export default AudioRecipeModal;
