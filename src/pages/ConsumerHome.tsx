import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Brain, Crown, Download, EarOff, Moon, PersonStanding, Play, Settings, Sparkles, Waves, WifiOff, Wind } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { api } from '../lib/api';
import type { Mix, ProductGoal, UserSoundProfile } from '../lib/domain';
import { useI18n } from '../lib/i18n';
import type { ResolvedLanguage } from '../lib/languagePreference';
import { readOfflineLibrary, readPlaybackSnapshots, type OfflineMixRecord, type PlaybackSnapshot } from '../lib/offlineLibrary';

const dailyNeeds = [
  {
    titleKey: 'home.need.sleep.tag',
    subtitleKey: 'create.prompt.sleep',
    icon: Moon,
    goal: 'sleep',
    promptKey: 'create.prompt.sleep',
    duration: 1800,
    tagKey: 'home.need.sleep.tag',
    bgGradient: 'linear-gradient(135deg, rgba(28, 17, 59, 0.9) 0%, rgba(13, 9, 28, 0.95) 100%)',
    borderColor: 'rgba(148, 116, 255, 0.35)',
  },
  {
    titleKey: 'home.need.calm.tag',
    subtitleKey: 'create.prompt.calm',
    icon: Waves,
    goal: 'calm',
    promptKey: 'create.prompt.calm',
    duration: 1200,
    tagKey: 'home.need.calm.tag',
    bgGradient: 'linear-gradient(135deg, rgba(14, 45, 60, 0.9) 0%, rgba(6, 20, 30, 0.95) 100%)',
    borderColor: 'rgba(46, 229, 245, 0.35)',
  },
  {
    titleKey: 'home.need.focus.tag',
    subtitleKey: 'create.prompt.focus',
    icon: Brain,
    goal: 'focus',
    promptKey: 'create.prompt.focus',
    duration: 2700,
    tagKey: 'home.need.focus.tag',
    bgGradient: 'linear-gradient(135deg, rgba(40, 20, 60, 0.9) 0%, rgba(15, 8, 26, 0.95) 100%)',
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
] as const;

const avoidShortcuts = [
  { labelKey: 'avoid.water', term: 'water', icon: Wind },
  { labelKey: 'avoid.voices', term: 'voices', icon: EarOff },
  { labelKey: 'avoid.birds', term: 'birds', icon: PersonStanding },
  { labelKey: 'avoid.music', term: 'music', icon: Brain },
] as const;

const avoidShortcutCopy: Partial<Record<ResolvedLanguage, Record<(typeof avoidShortcuts)[number]['term'], string>>> = {
  hi: { water: 'पानी नहीं', voices: 'आवाज़ नहीं', birds: 'पक्षी नहीं', music: 'संगीत नहीं' }, bn: { water: 'পানি নয়', voices: 'কণ্ঠ নয়', birds: 'পাখি নয়', music: 'সঙ্গীত নয়' },
  pt: { water: 'Sem água', voices: 'Sem vozes', birds: 'Sem pássaros', music: 'Sem música' }, ru: { water: 'Без воды', voices: 'Без голосов', birds: 'Без птиц', music: 'Без музыки' },
  id: { water: 'Tanpa air', voices: 'Tanpa suara manusia', birds: 'Tanpa burung', music: 'Tanpa musik' }, fr: { water: 'Sans eau', voices: 'Sans voix', birds: 'Sans oiseaux', music: 'Sans musique' },
  ko: { water: '물 소리 없음', voices: '목소리 없음', birds: '새 소리 없음', music: '음악 없음' }, it: { water: 'Senza acqua', voices: 'Senza voci', birds: 'Senza uccelli', music: 'Senza musica' },
  nl: { water: 'Geen water', voices: 'Geen stemmen', birds: 'Geen vogels', music: 'Geen muziek' }, tr: { water: 'Su yok', voices: 'İnsan sesi yok', birds: 'Kuş yok', music: 'Müzik yok' },
  pl: { water: 'Bez wody', voices: 'Bez głosów', birds: 'Bez ptaków', music: 'Bez muzyki' }, sv: { water: 'Inget vatten', voices: 'Inga röster', birds: 'Inga fåglar', music: 'Ingen musik' },
  th: { water: 'ไม่มีเสียงน้ำ', voices: 'ไม่มีเสียงพูด', birds: 'ไม่มีเสียงนก', music: 'ไม่มีดนตรี' }, vi: { water: 'Không có nước', voices: 'Không có giọng nói', birds: 'Không có chim', music: 'Không có nhạc' },
  ms: { water: 'Tanpa air', voices: 'Tanpa suara manusia', birds: 'Tanpa burung', music: 'Tanpa muzik' }, he: { water: 'בלי מים', voices: 'בלי קולות', birds: 'בלי ציפורים', music: 'בלי מוזיקה' },
  da: { water: 'Intet vand', voices: 'Ingen stemmer', birds: 'Ingen fugle', music: 'Ingen musik' }, no: { water: 'Ikke vann', voices: 'Ingen stemmer', birds: 'Ingen fugler', music: 'Ingen musikk' },
  fi: { water: 'Ei vettä', voices: 'Ei ääniä', birds: 'Ei lintuja', music: 'Ei musiikkia' },
};

const goalMeta: Record<ProductGoal, { icon: typeof Moon; promptKey: 'create.prompt.sleep' | 'create.prompt.calm' | 'create.prompt.focus'; subtitleKey: 'home.defaults.sleep' | 'home.defaults.calm' | 'home.defaults.focus' }> = {
  sleep: { icon: Moon, promptKey: 'create.prompt.sleep', subtitleKey: 'home.defaults.sleep' },
  calm: { icon: Waves, promptKey: 'create.prompt.calm', subtitleKey: 'home.defaults.calm' },
  focus: { icon: Brain, promptKey: 'create.prompt.focus', subtitleKey: 'home.defaults.focus' },
};

const defaultPromptForProfile = (profile: UserSoundProfile, t: ReturnType<typeof useI18n>['t']) => {
  const avoids = profile.excludedSounds.length ? ` ${t('create.prompt.avoid', { sounds: profile.excludedSounds.join(', ') })}` : '';
  const likes = profile.likedSounds.length ? ` ${t('create.prompt.like', { sounds: profile.likedSounds.join(', ') })}` : '';
  return `${t(goalMeta[profile.defaultGoal].promptKey)}${likes}${avoids}`;
};

const ConsumerHome: React.FC = () => {
  const navigate = useNavigate();
  const { locale, t, goalLabel, formatMinutes } = useI18n();
  const continueListeningLabel = t('home.continue.title');
  const [searchParams] = useSearchParams();
  const [daily, setDaily] = useState<Mix | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Mix[]>([]);
  const [offlineRecords, setOfflineRecords] = useState<OfflineMixRecord[]>(() => readOfflineLibrary());
  const [playbackSnapshots, setPlaybackSnapshots] = useState<PlaybackSnapshot[]>(() => readPlaybackSnapshots());
  const [soundProfile, setSoundProfile] = useState<UserSoundProfile | null>(null);
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof api.getBilling>> | null>(null);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const offline = readOfflineLibrary();
    const localSnapshots = readPlaybackSnapshots();
    setOfflineRecords(offline);
    setPlaybackSnapshots(localSnapshots);
    Promise.all([
      api.getHomeFeed(),
      api.getPlaybackStates().catch(() => []),
      api.getSoundProfile().catch(() => null),
      api.getBilling().catch(() => null),
    ])
      .then(([feed, remoteSnapshots, profilePayload, billingData]) => {
        setDaily(feed.daily);
        setRecentlyPlayed(feed.recentlyPlayed);
        if (profilePayload?.profile) setSoundProfile(profilePayload.profile);
        if (billingData) setBilling(billingData);
        const merged = new Map<string, PlaybackSnapshot>();
        [...localSnapshots, ...remoteSnapshots].forEach((snapshot) => {
          const current = merged.get(snapshot.mixId);
          if (!current || Date.parse(snapshot.updatedAt) > Date.parse(current.updatedAt)) merged.set(snapshot.mixId, snapshot);
        });
        setPlaybackSnapshots([...merged.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)));
        setOfflineFallback(false);
      })
      .catch((error) => {
        console.warn('Failed to load listening home:', error);
        if (offline.length > 0) {
          setDaily(offline[0].payload.mix);
          setRecentlyPlayed(offline.slice(1, 5).map((record) => record.payload.mix));
          setOfflineFallback(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const offlineMixIds = new Set(offlineRecords.map((record) => record.mixId));
  const knownMixes = [daily, ...recentlyPlayed, ...offlineRecords.map((record) => record.payload.mix)]
    .filter((mix): mix is Mix => Boolean(mix));
  const trustedSnapshot = playbackSnapshots.find((snapshot) => knownMixes.some((mix) => mix.id === snapshot.mixId));
  const trustedMix = trustedSnapshot
    ? knownMixes.find((mix) => mix.id === trustedSnapshot.mixId) ?? daily
    : daily;
  const trustedProgressLabel = trustedSnapshot && trustedSnapshot.positionSeconds >= 30
    ? t('home.continue.progress', { count: Math.max(1, Math.round(trustedSnapshot.positionSeconds / 60)) })
    : t('home.continue.oneTap');
  const defaultGoal = soundProfile?.defaultGoal ?? 'sleep';
  const DefaultIcon = goalMeta[defaultGoal].icon;
  const personalizedAvoids = soundProfile?.excludedSounds ?? [];
  const pilotParams = useMemo(() => {
    const cohort = searchParams.get('cohort')?.trim();
    const participant = searchParams.get('participant')?.trim();
    const params = new URLSearchParams();
    if (cohort) params.set('cohort', cohort);
    if (participant) params.set('participant', participant);
    return params;
  }, [searchParams]);

  const openPlayer = (mix: Mix) => {
    const snapshot = playbackSnapshots.find((item) => item.mixId === mix.id);
    const params = new URLSearchParams({ mixId: mix.id, returnTo: '/listen' });
    if (snapshot?.positionSeconds) params.set('resume', String(snapshot.positionSeconds));
    navigate(`/player?${params.toString()}`, { state: { mixId: mix.id, resumePositionSeconds: snapshot?.positionSeconds, returnTo: '/listen' } });
  };
  const startFromNeed = (goal: string, prompt: string, duration: number) => {
    const params = new URLSearchParams({
      goal,
      duration: String(duration),
      prompt,
    });
    pilotParams.forEach((value, key) => params.set(key, value));
    navigate(`/create?${params.toString()}`);
  };
  const startFromDefaults = () => {
    if (!soundProfile) {
      navigate(pilotParams.size > 0 ? `/create?${pilotParams.toString()}` : '/create');
      return;
    }
    startFromNeed(soundProfile.defaultGoal, defaultPromptForProfile(soundProfile, t), soundProfile.defaultDurationSeconds);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px var(--space-6) 100px', position: 'relative' }}>
        {/* Deep Space Ambient Aurora Lighting Backdrop */}
        <div className="aurora-backdrop" />

        {/* Top Header with Reactive PRO Badge & Gear Settings */}
        <header style={{ position: 'relative', zIndex: 1, padding: '8px 0 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.7) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                MixStil
              </h1>
              {billing?.tier === 'pro' ? (
                <span className="pro-badge-yellow">
                  <Crown size={12} fill="#000000" /> PRO
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/creator/upgrade')}
                  className="interactive-card"
                  title={t('home.upgradeTitle')}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Crown size={12} /> PRO
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label={t('home.settingsProfile')}
              style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Settings size={18} />
            </button>
          </div>
          <p className="text-sm text-secondary" style={{ fontSize: 14, maxWidth: '92%', lineHeight: 1.45 }}>{t('home.subtitle')}</p>
        </header>

        {offlineFallback && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: 11, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', fontSize: 13 }}>
            <WifiOff size={16} color="var(--primary)" />
            <span>{t('home.offlineFallback')}</span>
          </div>
        )}

        {/* Hero Prompt Portal */}
        <button
          type="button"
          onClick={() => navigate(pilotParams.size > 0 ? `/create?${pilotParams.toString()}` : '/create')}
          className="crystal-card interactive-card"
          style={{
            width: '100%',
            minHeight: 104,
            padding: 20,
            marginBottom: 24,
            border: '1px solid rgba(148, 116, 255, 0.4)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            textAlign: 'left',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(148, 116, 255, 0.12) 0%, rgba(46, 229, 245, 0.06) 100%)',
          }}
        >
          <span style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124, 58, 237, 0.5)' }}>
            <Sparkles size={24} />
          </span>
          <span style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: 18, marginBottom: 4, fontWeight: 750 }}>{t('home.describe.title')}</strong>
            <span className="text-sm text-secondary" style={{ fontSize: 13, lineHeight: 1.4 }}>{t('home.describe.subtitle')}</span>
          </span>
          <ArrowRight size={20} color="var(--primary)" />
        </button>

        {/* Quick Need Natural Crystal Cards */}
        <section aria-label={t('home.checkin.title')} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <h2 style={{ fontSize: 19, fontWeight: 750 }}>{t('home.checkin.title')}</h2>
            <span className="text-xs text-secondary">{t('home.checkin.subtitle')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {dailyNeeds.map(({ titleKey, subtitleKey, icon: Icon, goal, promptKey, duration, tagKey, bgGradient, borderColor }) => (
              <button
                key={titleKey}
                type="button"
                onClick={() => startFromNeed(goal, t(promptKey), duration)}
                className="crystal-card interactive-card"
                style={{
                  minHeight: 152,
                  padding: '16px 12px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: `1px solid ${borderColor}`,
                  background: bgGradient,
                }}
              >
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={19} />
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', color: 'var(--text-secondary)' }}>
                    {t(tagKey)}
                  </span>
                </div>
                <span style={{ minWidth: 0, marginTop: 8 }}>
                  <strong style={{ display: 'block', fontSize: 15, lineHeight: 1.25, marginBottom: 4, fontWeight: 700 }}>{t(titleKey)}</strong>
                  <span className="text-xs text-secondary" style={{ display: 'block', lineHeight: 1.35, fontSize: 11 }}>{t(subtitleKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Personalized Defaults Section */}
        <section aria-label={t('home.defaults.kicker')} style={{ marginBottom: 32 }}>
          <button type="button" onClick={startFromDefaults} className="crystal-card interactive-card" style={{ width: '100%', minHeight: 88, padding: '16px 20px', border: '1px solid rgba(148,116,255,0.3)', color: 'var(--text-primary)', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(148,116,255,0.18)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DefaultIcon size={22} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="text-xs text-secondary" style={{ display: 'block', marginBottom: 3, fontWeight: 600, letterSpacing: '0.05em' }}>{t('home.defaults.kicker')}</span>
              <strong style={{ display: 'block', fontSize: 16, marginBottom: 2, fontWeight: 700 }}>{goalLabel(defaultGoal)} · {formatMinutes(soundProfile?.defaultDurationSeconds ?? 900)}</strong>
              <span className="text-xs text-secondary" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {soundProfile ? t(goalMeta[defaultGoal].subtitleKey) : t('home.defaults.empty')}
              </span>
            </span>
            <ArrowRight size={18} color="var(--primary)" />
          </button>
        </section>

        {/* Avoid Rules Shortcuts */}
        <section aria-label={t('home.avoid.title')} style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 750 }}>{t('home.avoid.title')}</h2>
            <span className="text-xs text-secondary">{t('home.avoid.subtitle')}</span>
          </div>
          {personalizedAvoids.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {personalizedAvoids.slice(0, 4).map((term) => (
                <button
                  key={term}
                  type="button"
                  className="interactive-card"
                  onClick={() => {
                    const params = new URLSearchParams({ prompt: `${t('create.avoidIntro')} ${term}` });
                    pilotParams.forEach((value, key) => params.set(key, value));
                    navigate(`/create?${params.toString()}`);
                  }}
                  style={{ minHeight: 40, padding: '0 14px', border: '1px solid rgba(255,100,100,0.4)', borderRadius: 'var(--radius-pill)', background: 'rgba(255,100,100,0.12)', color: '#ff8095', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <EarOff size={15} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{t('avoid.water').replace('水声', term)}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {avoidShortcuts.map(({ labelKey, term, icon: Icon }) => (
              <button
                key={labelKey}
                type="button"
                className="interactive-card crystal-card"
                onClick={() => {
                  const params = new URLSearchParams({ prompt: `${t('create.avoidIntro')} ${avoidShortcutCopy[locale]?.[term] ?? t(labelKey)}` });
                  pilotParams.forEach((value, key) => params.set(key, value));
                  navigate(`/create?${params.toString()}`);
                }}
                style={{ minHeight: 40, padding: '0 14px', borderRadius: 'var(--radius-pill)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: '1px solid var(--surface-border)' }}
              >
                <Icon size={15} color="var(--primary)" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{avoidShortcutCopy[locale]?.[term] ?? t(labelKey)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Continue Listening Player Card with Waveform */}
        {trustedMix && (
          <section aria-label={continueListeningLabel} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h2 style={{ fontSize: 19, fontWeight: 750 }}>{t('home.continue.title')}</h2>
              <span className="text-xs text-secondary">{trustedProgressLabel}</span>
            </div>
            <button type="button" onClick={() => openPlayer(trustedMix)} className="crystal-card interactive-card" style={{ width: '100%', padding: 0, overflow: 'hidden', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>
              <div style={{ minHeight: 176, padding: 20, background: `linear-gradient(to top, rgba(3,3,8,0.96), rgba(3,3,8,0.25)), url(${trustedMix.coverImageUrl}) center/cover`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ minWidth: 0 }}>
                  {/* Dynamic Equalizer Waveform Bars */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 16, marginBottom: 8 }}>
                    <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--primary)', animation: 'auroraGlow 1.2s ease-in-out infinite' }} />
                    <span style={{ width: 3, height: 10, borderRadius: 2, background: 'var(--accent)', animation: 'auroraGlow 1.6s ease-in-out infinite 0.2s' }} />
                    <span style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--primary)', animation: 'auroraGlow 1.4s ease-in-out infinite 0.4s' }} />
                    <span style={{ width: 3, height: 8, borderRadius: 2, background: 'var(--accent)', animation: 'auroraGlow 1.8s ease-in-out infinite 0.6s' }} />
                  </div>
                  <strong style={{ display: 'block', fontSize: 22, marginBottom: 5, fontWeight: 800 }}>{trustedMix.title}</strong>
                  <span className="text-sm text-secondary" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trustedMix.description}</span>
                  {offlineMixIds.has(trustedMix.id) && <span className="text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, color: 'var(--primary)', fontWeight: 600 }}><Download size={12} /> {t('common.readyOffline')}</span>}
                </span>
                <span style={{ width: 50, height: 50, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124, 58, 237, 0.6)' }}>
                  <Play size={20} fill="white" style={{ marginLeft: 2 }} />
                </span>
              </div>
            </button>
          </section>
        )}

        {/* Recently Played Carousel */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ fontSize: 19, fontWeight: 750 }}>{t('home.recent.title')}</h2>
            <button type="button" onClick={() => navigate('/sounds')} style={{ border: 0, background: 'transparent', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('home.recent.viewAll')}</button>
          </div>
          {loading ? (
            <p className="text-sm text-secondary">{t('common.loadingSounds')}</p>
          ) : recentlyPlayed.length === 0 ? (
            <p className="text-sm text-secondary">{t('home.recent.empty')}</p>
          ) : (
            <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 8, scrollbarWidth: 'none' }}>
              {recentlyPlayed.map((item, index) => (
                <button key={`${item.id}-${index}`} type="button" onClick={() => openPlayer(item)} style={{ width: 136, flexShrink: 0, border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ width: 136, aspectRatio: '1', borderRadius: 'var(--radius-md)', background: `url(${item.coverImageUrl}) center/cover`, display: 'block', marginBottom: 10, boxShadow: '0 6px 16px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }} />
                  <strong style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{item.title}</strong>
                  {offlineMixIds.has(item.id) && <span className="text-xs" style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('common.offline')}</span>}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav activeTab="home" />
    </div>
  );
};

export default ConsumerHome;
