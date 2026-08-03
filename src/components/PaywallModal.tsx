import React from 'react';
import { Check, Crown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

export type PaywallReason = 'generation_limit' | 'session_length' | 'saved_sounds' | 'community_preview';

type PaywallModalProps = { reason: PaywallReason; onClose: () => void };

const PaywallModal: React.FC<PaywallModalProps> = ({ reason, onClose }) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const benefits = [
    t('paywall.benefit.longer'),
    t(`paywall.${reason}.unlock`),
    t('paywall.benefit.variants'),
    t('paywall.benefit.offline'),
  ];
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
      <section role="dialog" aria-modal="true" aria-labelledby="paywall-title" onClick={(event) => event.stopPropagation()} style={{ width: 'min(100%, 440px)', padding: 22, border: '1px solid rgba(232,240,106,0.35)', borderRadius: 16, background: '#202126', boxShadow: '0 -12px 40px rgba(0,0,0,0.45)' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Crown size={22} color="var(--primary)" />
          <div style={{ flex: 1 }}>
            <h2 id="paywall-title" style={{ fontSize: 19, margin: 0 }}>{t(`paywall.${reason}.title`)}</h2>
            <p className="text-sm text-secondary" style={{ lineHeight: 1.5, margin: '7px 0 0' }}>{t(`paywall.${reason}.body`)}</p>
          </div>
          <button type="button" className="btn-icon" aria-label={t('common.close')} title={t('common.close')} onClick={onClose} style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)' }}><X size={17} /></button>
        </header>
        <div style={{ display: 'grid', gap: 9, margin: '20px 0' }}>
          {benefits.map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14 }}><Check size={16} color="var(--primary)" /><span>{item}</span></div>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/creator/upgrade')} style={{ width: '100%', minHeight: 48, justifyContent: 'center' }}>{t('paywall.seePlus')}</button>
        <button type="button" className="btn" onClick={onClose} style={{ width: '100%', minHeight: 40, marginTop: 8, justifyContent: 'center', background: 'transparent', color: 'var(--text-secondary)' }}>{t('paywall.maybeLater')}</button>
      </section>
    </div>
  );
};

export default PaywallModal;
