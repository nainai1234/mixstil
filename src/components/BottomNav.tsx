import React from 'react';
import { Compass, Home, Library, Plus, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

interface BottomNavProps {
  activeTab: 'home' | 'explore' | 'sounds' | 'profile';
}

const items = [
  { id: 'home', label: 'Home', labelKey: 'nav.home', path: '/listen', icon: Home },
  { id: 'explore', label: 'Explore', labelKey: 'nav.explore', path: '/explore', icon: Compass },
  { id: 'sounds', label: 'My Sounds', labelKey: 'nav.sounds', path: '/sounds', icon: Library },
  { id: 'profile', label: 'Profile', labelKey: 'nav.profile', path: '/profile', icon: User },
] as const;

const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
      <nav aria-label={t('nav.home')} style={{
      position: 'fixed',
      bottom: 12,
      left: 12,
      right: 12,
      maxWidth: 456,
      margin: '0 auto',
      zIndex: 100,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 64px 1fr 1fr',
      alignItems: 'center',
      gap: 4,
      padding: '8px 12px calc(8px + env(safe-area-inset-bottom))',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderTopColor: 'rgba(255, 255, 255, 0.2)',
      background: 'rgba(12, 12, 18, 0.88)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    }}>
      {items.slice(0, 2).map(({ id, labelKey, path, icon: Icon }) => {
        const isActive = activeTab === id;
        const label = t(labelKey);
        return (
          <button
            key={id}
            type="button"
            onClick={() => navigate(path)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              border: 0,
              background: 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 0',
              cursor: 'pointer',
              position: 'relative',
              transition: 'color 0.2s ease, transform 0.2s ease',
            }}
          >
            <Icon size={21} style={{ filter: isActive ? 'drop-shadow(0 0 8px var(--primary-glow))' : 'none' }} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>{label}</span>
            {isActive && (
              <span style={{
                position: 'absolute',
                bottom: -2,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--primary)',
                boxShadow: '0 0 8px var(--primary)',
              }} />
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => navigate('/create')}
        aria-label={t('nav.create')}
        title={t('nav.create')}
        className="interactive-card"
        style={{
          width: 50,
          height: 50,
          justifySelf: 'center',
          border: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary) 0%, #2EE5F5 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(148, 116, 255, 0.5), 0 0 12px rgba(46, 229, 245, 0.3)',
          transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), boxShadow 0.2s ease',
        }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {items.slice(2).map(({ id, labelKey, path, icon: Icon }) => {
        const isActive = activeTab === id;
        const label = t(labelKey);
        return (
          <button
            key={id}
            type="button"
            onClick={() => navigate(path)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              border: 0,
              background: 'transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 0',
              cursor: 'pointer',
              position: 'relative',
              transition: 'color 0.2s ease, transform 0.2s ease',
            }}
          >
            <Icon size={21} style={{ filter: isActive ? 'drop-shadow(0 0 8px var(--primary-glow))' : 'none' }} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>{label}</span>
            {isActive && (
              <span style={{
                position: 'absolute',
                bottom: -2,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--primary)',
                boxShadow: '0 0 8px var(--primary)',
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
