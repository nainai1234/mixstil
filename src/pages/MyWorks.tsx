import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, Play, Headset, Share2 } from 'lucide-react';
import ShareVisibilityDialog from '../components/ShareVisibilityDialog';
import { api } from '../lib/api';
import type { Mix } from '../lib/domain';

const MyWorks: React.FC = () => {
  const [works, setWorks] = useState<Mix[]>([]);
  const [shareMix, setShareMix] = useState<Mix | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getStudioDashboard({ all: true }).then((dashboard) => setWorks(dashboard.mixes));
  }, []);

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <Link to="/profile" className="btn-icon" style={{ background: 'transparent' }}>
          <ArrowLeft size={24} />
        </Link>
        <h2 style={{ fontSize: '20px' }}>My Works</h2>
      </header>

      {works.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <Headset size={48} className="text-secondary" style={{ marginBottom: 'var(--space-4)' }} />
          <h3 style={{ marginBottom: 'var(--space-2)' }}>No works yet</h3>
          <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-6)', maxWidth: 200 }}>Start your first soundscape creation.</p>
          <button className="btn btn-primary" onClick={() => navigate('/ai-heal')}>Create Soundscape</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {works.map((w) => (
            <div key={w.id} className="glass-panel" style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: 'pointer' }} onClick={() => w.status !== 'draft' ? navigate(`/player?mixId=${encodeURIComponent(w.id)}`, { state: { mixId: w.id } }) : navigate('/creator/mix', { state: { mixId: w.id } })}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', background: `url(${w.coverImageUrl}) center/cover`, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '16px', marginBottom: 2 }}>{w.title}</h4>
                <p className="text-xs text-secondary">
                  {Math.round(w.recipeData.durationSeconds / 60)} min • <span style={{color: '#00FF94'}}>{w.playsCount} Plays</span> • {w.status}
                  {w.status !== 'draft' ? ` • ${w.status === 'private' ? 'Private' : 'Public'} • MP3 ${w.renderStatus === 'ready' ? 'ready' : 'not rendered'}` : ''}
                </p>
              </div>
              {w.status !== 'draft' ? (
                <button aria-label="Share" className="btn-icon" style={{ width: 36, height: 36, background: 'var(--surface-2)' }} onClick={(event) => { event.stopPropagation(); setShareMix(w); }}>
                  <Share2 size={16} />
                </button>
              ) : (
                <button className="btn-icon" style={{ width: 36, height: 36, background: 'var(--surface-2)' }}>
                  <Play size={16} fill="white" style={{ marginLeft: 2 }} />
                </button>
              )}
              <button className="btn-icon" style={{ width: 36, height: 36, background: 'transparent' }} onClick={(event) => { event.stopPropagation(); navigate(`/creator/analytics/${w.id}`); }}>
                <MoreHorizontal size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {shareMix && <ShareVisibilityDialog mix={shareMix} onClose={() => setShareMix(null)} />}
    </div>
  );
};

export default MyWorks;
