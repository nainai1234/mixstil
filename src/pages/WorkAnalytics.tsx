import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, TrendingUp, Play, Heart, Share } from 'lucide-react';
import { api } from '../lib/api';
import type { WorkAnalyticsSummary } from '../lib/domain';

const WorkAnalytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<WorkAnalyticsSummary | null>(null);

  useEffect(() => {
    api.getWorkAnalytics(id || 'mix_deep_work').then(setAnalytics);
  }, [id]);

  const progressPercent = analytics
    ? Math.min(100, Math.round(((analytics.curation.requiredPlays - analytics.curation.missingPlays) / analytics.curation.requiredPlays) * 100))
    : 0;

  if (!analytics) return null;

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 'var(--space-8)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ background: 'transparent' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ fontSize: '18px' }}>Analytics</h2>
      </header>

      {/* Milestone Banner */}
      <div style={{ background: 'linear-gradient(90deg, rgba(140,106,255,0.1) 0%, rgba(140,106,255,0.0) 100%)', borderLeft: '3px solid var(--primary)', padding: 'var(--space-3)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ fontSize: '14px', marginBottom: 4 }}>Curation Progress</h4>
        <p className="text-xs text-secondary">
          {analytics.curation.eligible
            ? 'This work can apply for Platform Curation.'
            : `Still needs ${analytics.curation.missingPlays} plays, ${analytics.curation.missingFavorites} favorites, and ${analytics.curation.requiredCompletionRate}% completion quality.`}
        </p>
        <div style={{ height: 4, background: 'var(--surface-border)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)' }} />
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div className="glass-panel" style={{ padding: 'var(--space-3)' }}>
          <Play size={16} className="text-secondary" style={{ marginBottom: 8 }} />
          <p className="text-xs text-secondary">Play Starts</p>
          <h3 style={{ fontSize: '20px' }}>{analytics.playStarts}</h3>
        </div>
        <div className="glass-panel" style={{ padding: 'var(--space-3)' }}>
          <TrendingUp size={16} className="text-secondary" style={{ marginBottom: 8 }} />
          <p className="text-xs text-secondary">50% Completed</p>
          <h3 style={{ fontSize: '20px' }}>{analytics.play50}</h3>
        </div>
        <div className="glass-panel" style={{ padding: 'var(--space-3)' }}>
          <Heart size={16} className="text-secondary" style={{ marginBottom: 8 }} />
          <p className="text-xs text-secondary">Favorites</p>
          <h3 style={{ fontSize: '20px' }}>{analytics.favorites}</h3>
        </div>
        <div className="glass-panel" style={{ padding: 'var(--space-3)' }}>
          <Share size={16} className="text-secondary" style={{ marginBottom: 8 }} />
          <p className="text-xs text-secondary">Shares</p>
          <h3 style={{ fontSize: '20px' }}>{analytics.shareClicks}</h3>
        </div>
      </div>

      {/* Funnel */}
      <h3 style={{ fontSize: '16px', marginBottom: 'var(--space-3)' }}>Listener Funnel</h3>
      <div className="glass-panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 80 }} className="text-xs text-secondary">Page Views</span>
          <div style={{ flex: 1, background: 'var(--surface-border)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', background: 'var(--surface-3)' }} />
          </div>
          <span style={{ width: 30, textAlign: 'right' }} className="text-xs">{analytics.pageViews}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 80 }} className="text-xs text-secondary">Started</span>
          <div style={{ flex: 1, background: 'var(--surface-border)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${analytics.pageViews > 0 ? (analytics.playStarts / analytics.pageViews) * 100 : 0}%`, height: '100%', background: 'var(--primary)' }} />
          </div>
          <span style={{ width: 30, textAlign: 'right' }} className="text-xs">{analytics.playStarts}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ width: 80 }} className="text-xs text-secondary">Completed</span>
          <div style={{ flex: 1, background: 'var(--surface-border)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${analytics.pageViews > 0 ? (analytics.play50 / analytics.pageViews) * 100 : 0}%`, height: '100%', background: 'var(--accent)' }} />
          </div>
          <span style={{ width: 30, textAlign: 'right' }} className="text-xs">{analytics.play50}</span>
        </div>
      </div>

      {/* PRO Locked Features */}
      <div 
        className="glass-panel" 
        style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', background: 'var(--surface-2)', opacity: 0.72 }}
        aria-disabled="true"
      >
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Lock size={20} className="text-secondary" />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            Traffic Sources
            <span style={{ background: 'var(--primary)', color: 'white', padding: '1px 6px', fontSize: '9px', borderRadius: 4 }}>PRO</span>
          </h4>
          <p className="text-xs text-secondary" style={{ marginTop: 2 }}>See where your listeners are coming from.</p>
        </div>
      </div>

    </div>
  );
};

export default WorkAnalytics;
