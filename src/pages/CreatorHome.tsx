import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart2, Heart, Play, Sparkles } from 'lucide-react';
import BottomNav from '../components/BottomNav';

const CreatorHome: React.FC = () => {
  const [works, setWorks] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const list = JSON.parse(localStorage.getItem('my_works') || '[]');
    setWorks(list.slice(0, 3));
  }, []);

  return (
    <div style={{ padding: 'var(--space-6)', paddingBottom: '80px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800 }} className="text-gradient-primary">MixStil</h2>
          <span className="text-xs text-secondary" style={{ letterSpacing: '0.1em' }}>CREATOR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ textAlign: 'right' }}>
            <p className="text-sm" style={{ fontWeight: 600 }}>Local Creator</p>
            <span className="text-xs text-secondary">Workspace</span>
          </div>
          <div 
            style={{ 
              width: 40, height: 40, borderRadius: '50%', 
              background: 'linear-gradient(135deg, #8C6AFF 0%, #00F0FF 100%)',
              border: '2px solid var(--surface-border)'
            }} 
          />
        </div>
      </header>

      {/* Welcome & Create CTA */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: '28px', marginBottom: 'var(--space-6)' }}>Create a soundscape</h1>
        <Link to="/ai-heal" className="btn btn-primary" style={{ width: '100%', padding: 'var(--space-4)' }}>
          <Sparkles size={20} style={{ marginRight: 8 }} /> Create with AI Copilot
        </Link>
      </div>

      {/* Dashboard Overview */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ fontSize: '18px', marginBottom: 'var(--space-4)' }}>Dashboard Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          
          <Link to="/creator/analytics" className="glass-panel interactive-card" style={{ padding: 'var(--space-4)', display: 'block', color: 'inherit', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="text-sm text-secondary">Weekly Listens</span>
              <BarChart2 size={16} className="text-secondary" />
            </div>
            <p style={{ fontSize: '24px', fontWeight: 700 }}>{works.reduce((sum, work) => sum + Number(work.playsCount ?? 0), 0).toLocaleString()}</p>
            <p className="text-xs text-secondary" style={{ marginTop: 'var(--space-2)' }}>Recorded plays</p>
          </Link>

          <Link to="/creator/analytics" className="glass-panel interactive-card" style={{ padding: 'var(--space-4)', display: 'block', color: 'inherit', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="text-sm text-secondary">Favorites</span>
              <Heart size={16} className="text-secondary" />
            </div>
            <p style={{ fontSize: '24px', fontWeight: 700 }}>{works.reduce((sum, work) => sum + Number(work.favoritesCount ?? 0), 0).toLocaleString()}</p>
            <p className="text-xs text-secondary" style={{ marginTop: 'var(--space-2)' }}>Recorded favorites</p>
          </Link>
          
        </div>
      </div>

      {/* Platform Curation */}
      {/* Recent Works */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '18px' }}>Your Masterpieces (Library)</h3>
          <Link to="/creator/works" className="btn" style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--surface-2)', fontSize: '14px' }}>View All</Link>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {works.length === 0 ? (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' }}>
              No works yet. Create your first soundscape!
            </div>
          ) : works.map((w, idx) => (
            <div key={idx} className="glass-panel" style={{ padding: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: 'pointer' }} onClick={() => navigate(`/work/${w.id}`)}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #8C6AFF 0%, #00F0FF 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 24 }}>🎵</span>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '16px', marginBottom: 2 }}>{w.title}</h4>
                <p className="text-xs text-secondary">{w.duration} • {Number(w.playsCount ?? 0).toLocaleString()} plays</p>
              </div>
              <button className="btn-icon" style={{ width: 36, height: 36, background: 'var(--surface-2)' }}>
                <Play size={16} fill="white" style={{ marginLeft: 2 }} />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <BottomNav activeTab="sounds" />
    </div>
  );
};

export default CreatorHome;
