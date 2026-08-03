import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Download, Library, Loader2, Play, Search, Settings, Share2, Sparkles, Trash2, WifiOff } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import ShareVisibilityDialog from '../components/ShareVisibilityDialog';
import { api } from '../lib/api';
import type { Mix, ProductGoal } from '../lib/domain';
import { readOfflineLibrary, removeOfflineMix, saveMixForOffline } from '../lib/offlineLibrary';
import { useI18n, type I18nTranslate } from '../lib/i18n';
import type { ResolvedLanguage } from '../lib/languagePreference';

const sceneLabelCopy: Record<string, Partial<Record<ResolvedLanguage, string>>> = {
  bedtime: { zh: '睡前入睡', en: 'bedtime', hi: 'सोने से पहले', es: 'al acostarse', ar: 'وقت النوم', bn: 'ঘুমানোর আগে', pt: 'ao deitar', ru: 'перед сном', ja: '就寝前', id: 'sebelum tidur' },
  bedtime_sleep: { zh: '睡前入睡', en: 'bedtime sleep', hi: 'सोने से पहले नींद', es: 'sueño al acostarse', ar: 'النوم قبل السرير', bn: 'ঘুমানোর আগে', pt: 'sono ao deitar', ru: 'сон перед сном', ja: '就寝前の睡眠', id: 'tidur sebelum malam' },
  return_to_sleep: { zh: '夜醒回睡', en: 'return to sleep', hi: 'फिर से सोना', es: 'volver a dormir', ar: 'العودة للنوم', bn: 'আবার ঘুম', pt: 'voltar a dormir', ru: 'снова уснуть', ja: '再入眠', id: 'tidur lagi' },
  breathing: { zh: '呼吸放松', en: 'breathing', hi: 'श्वास', es: 'respiración', ar: 'تنفس', bn: 'শ্বাস', pt: 'respiração', ru: 'дыхание', ja: '呼吸', id: 'napas' },
  deep_focus: { zh: '深度专注', en: 'deep focus', hi: 'गहरा फोकस', es: 'foco profundo', ar: 'تركيز عميق', bn: 'গভীর ফোকাস', pt: 'foco profundo', ru: 'глубокий фокус', ja: '深い集中', id: 'fokus mendalam' },
  focus_work: { zh: '专注工作', en: 'focus work', hi: 'फोकस काम', es: 'trabajo con foco', ar: 'عمل بتركيز', bn: 'ফোকাস কাজ', pt: 'trabalho com foco', ru: 'работа с фокусом', ja: '集中作業', id: 'kerja fokus' },
  emotional_settling: { zh: '情绪安定', en: 'emotional settling', hi: 'भावनात्मक शांति', es: 'calma emocional', ar: 'تهدئة عاطفية', bn: 'মন শান্ত করা', pt: 'acalmar emoções', ru: 'эмоциональное успокоение', ja: '気持ちを落ち着ける', id: 'menenangkan emosi' },
  meditation_breath: { zh: '冥想呼吸', en: 'meditation breath', hi: 'ध्यान श्वास', es: 'respiración meditativa', ar: 'تنفس تأملي', bn: 'ধ্যানের শ্বাস', pt: 'respiração meditativa', ru: 'медитативное дыхание', ja: '瞑想呼吸', id: 'napas meditasi' },
};
const localizedSceneLabel = (mix: Mix, locale: ResolvedLanguage, fallback: string) => {
  const scene = mix.recipeData.audioIntent?.scene ?? '';
  if (!scene) return fallback;
  return sceneLabelCopy[scene]?.[locale] ?? fallback;
};
const goalForMix = (mix: Mix): ProductGoal | '' => mix.recipeData.audioIntent?.goal ?? '';
const effectiveScoreForMix = (mix: Mix) => mix.playsCount + (mix.completion50Count * 2) + (mix.completion90Count * 3);
const createSimilarPrompt = (mix: Mix, t: I18nTranslate, goalLabel: (goal: ProductGoal) => string, scene: string) => {
  const goal = goalForMix(mix);
  const goalName = goal ? goalLabel(goal) : goalLabel('sleep');
  const exclusions = mix.recipeData.audioIntent?.excludedSounds?.length
    ? t('create.prompt.avoid', { sounds: mix.recipeData.audioIntent.excludedSounds.join(', ') })
    : '';
  return t('create.prompt.similar', { title: mix.title, goal: goalName, scene, exclusions }).slice(0, 420);
};

const StudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale, t, goalLabel, formatMinutes } = useI18n();
  const searchMySoundsLabel = t('sounds.search');
  const filterMySoundsByGoalLabel = t('sounds.filterGoal');
  const loadMoreLabel = t('sounds.loadMore');
  const offlineFallbackLabel = t('home.offlineFallback');
  const sceneLabelForUi = useCallback((mix: Mix) => localizedSceneLabel(mix, locale, t('sounds.personalSound')), [locale, t]);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [shareMix, setShareMix] = useState<Mix | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [goal, setGoal] = useState<ProductGoal | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offlineIds, setOfflineIds] = useState<Set<string>>(() => new Set(readOfflineLibrary().map((record) => record.mixId)));
  const [offlineBusyId, setOfflineBusyId] = useState<string | null>(null);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const requestedShareMixId = searchParams.get('share') || location.state?.shareMixId;
  const activeShareMix = shareMix ?? mixes.find((mix) => mix.id === requestedShareMixId) ?? null;
  const publishedMixId = location.state?.publishedMixId as string | undefined;
  const recentlyPublishedMix = mixes.find((mix) => mix.id === publishedMixId);
  const recentlyPublishedIsPreparing = Boolean(publishedMixId && (!recentlyPublishedMix || recentlyPublishedMix.renderStatus === 'rendering'));

  const visibleMixes = useMemo(() => mixes.filter((mix) => {
    if (goal && goalForMix(mix) !== goal) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return (
      mix.title.toLowerCase().includes(needle)
      || mix.description.toLowerCase().includes(needle)
      || sceneLabelForUi(mix).toLowerCase().includes(needle)
      || mix.recipeData.audioIntent?.goal?.includes(needle) === true
    );
  }), [goal, mixes, query, sceneLabelForUi]);

  const groupedMixes = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...visibleMixes].sort((left, right) => {
      const scoreDelta = effectiveScoreForMix(right) - effectiveScoreForMix(left);
      if (scoreDelta !== 0) return scoreDelta;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
    const recent = ordered.slice(0, 6);
    const byGoal = {
      sleep: ordered.filter((mix) => goalForMix(mix) === 'sleep'),
      calm: ordered.filter((mix) => goalForMix(mix) === 'calm'),
      focus: ordered.filter((mix) => goalForMix(mix) === 'focus'),
      offline: ordered.filter((mix) => offlineIds.has(mix.id)),
    };
    return {
      recent,
      byGoal,
      remaining: ordered.filter((mix) => {
        if (seen.has(mix.id)) return false;
        seen.add(mix.id);
        return true;
      }),
    };
  }, [offlineIds, visibleMixes]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;

    const loadSounds = async () => {
      const dashboard = await api.getStudioDashboard({ query, goal: goal || undefined, page, pageSize: 20 });
      if (cancelled) return;
      setMixes((current) => {
        const next = page === 1 ? dashboard.mixes : [...current, ...dashboard.mixes];
        return [...new Map(next.map((mix) => [mix.id, mix])).values()]
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
      });
      setTotal(dashboard.pagination.total);
      setHasMore(dashboard.pagination.hasMore);
      setOfflineFallback(false);
      setLoading(false);
      if (dashboard.mixes.some((mix) => mix.status !== 'draft' && mix.renderStatus === 'rendering')) {
        pollTimer = window.setTimeout(loadSounds, 1800);
      }
    };

    loadSounds().catch((error) => {
      console.warn('Failed to load My Sounds:', error);
      const offlineMixes = readOfflineLibrary().map((record) => record.payload.mix);
      if (page === 1) {
        setMixes(offlineMixes);
        setTotal(offlineMixes.length);
        setHasMore(false);
        setOfflineFallback(offlineMixes.length > 0);
      } else {
        setOfflineError(error instanceof Error ? error.message : t('sounds.loadMoreFailed'));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [goal, page, query, t]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
    setLoading(true);
  };

  const updateGoal = (value: ProductGoal | '') => {
    setGoal(value);
    setPage(1);
    setLoading(true);
  };

  const closeShare = () => {
    setShareMix(null);
    if (searchParams.has('share')) {
      const next = new URLSearchParams(searchParams);
      next.delete('share');
      setSearchParams(next, { replace: true });
      return;
    }
    if (location.state?.shareMixId) navigate('/sounds', { replace: true });
  };

  const refreshOfflineIds = () => setOfflineIds(new Set(readOfflineLibrary().map((record) => record.mixId)));

  const saveOffline = async (mixId: string) => {
    if (offlineBusyId) return;
    setOfflineBusyId(mixId);
    setOfflineError(null);
    try {
      let payload = await api.getMix(mixId);
      if (payload.mix.status !== 'draft' && payload.mix.renderStatus !== 'ready') {
        await api.renderMix(mixId);
        payload = await api.getMix(mixId);
      }
      await saveMixForOffline(payload);
      refreshOfflineIds();
    } catch (error) {
      setOfflineError(error instanceof Error ? error.message : t('sounds.saveOfflineFailed'));
    } finally {
      setOfflineBusyId(null);
    }
  };

  const removeOffline = async (mixId: string) => {
    if (offlineBusyId) return;
    setOfflineBusyId(mixId);
    setOfflineError(null);
    try {
      await removeOfflineMix(mixId);
      refreshOfflineIds();
    } catch (error) {
      setOfflineError(error instanceof Error ? error.message : t('sounds.removeOfflineFailed'));
    } finally {
      setOfflineBusyId(null);
    }
  };

  const startSimilarCreate = (mix: Mix) => {
    setActionMessage('');
    setActionError('');
    const goal = goalForMix(mix) || 'sleep';
    const params = new URLSearchParams({
      goal,
      duration: String(mix.recipeData.durationSeconds),
      prompt: createSimilarPrompt(mix, t, goalLabel, sceneLabelForUi(mix)),
    });
    navigate(`/create?${params.toString()}`);
  };

  const setAsDefault = async (mix: Mix) => {
    setActionMessage('');
    setActionError('');
    try {
      const goal = goalForMix(mix);
      if (!goal) throw new Error(t('sounds.defaultGoalMissing'));
      await api.updateSoundProfile({
        defaultGoal: goal,
        defaultDurationSeconds: mix.recipeData.durationSeconds,
      });
      setActionMessage(t('sounds.defaultUpdated', { goal: goalLabel(goal), duration: formatMinutes(mix.recipeData.durationSeconds) }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('sounds.defaultUpdateFailed'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <main style={{ flex: 1, padding: '28px var(--space-6) 116px', overflowY: 'auto' }}>
        <header style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div className="ambient-glow" />
          <div>
            <p className="text-sm text-secondary" style={{ marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>{t('sounds.kicker')}</p>
            <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.15 }}>{t('sounds.title')}</h1>
          </div>
          <button type="button" className="btn-icon interactive-card" onClick={() => navigate('/profile')} aria-label={t('sounds.settings')} style={{ width: 44, height: 44, background: 'var(--surface-1)' }}><Settings size={20} /></button>
        </header>

        <button
          type="button"
          onClick={() => navigate('/create')}
          className="crystal-card interactive-card"
          style={{
            width: '100%',
            minHeight: 88,
            padding: '20px 22px',
            marginBottom: 24,
            border: '1px solid rgba(148, 116, 255, 0.45)',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.22) 0%, rgba(168, 85, 247, 0.12) 100%)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            textAlign: 'left',
            cursor: 'pointer',
            boxShadow: '0 10px 30px -6px rgba(124, 58, 237, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124, 58, 237, 0.6)', flexShrink: 0 }}>
              <Sparkles size={24} color="#FFFFFF" />
            </span>
            <div>
              <strong style={{ display: 'block', fontSize: 18, marginBottom: 3, fontWeight: 800 }}>{t('sounds.create.title')}</strong>
              <span className="text-xs text-secondary" style={{ fontSize: 13 }}>{t('sounds.create.subtitle')}</span>
            </div>
          </div>
          <span style={{ padding: '8px 18px', borderRadius: 'var(--radius-pill)', background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', color: '#FFFFFF', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.5)' }}>
            + {t('sounds.create.action')}
          </span>
        </button>

        {(actionMessage || actionError) && (
          <div role={actionError ? 'alert' : 'status'} style={{ marginBottom: 18, padding: 12, borderRadius: 8, border: `1px solid ${actionError ? 'rgba(255,131,131,0.35)' : 'rgba(140,106,255,0.28)'}`, background: actionError ? 'rgba(255,131,131,0.08)' : 'rgba(140,106,255,0.08)', color: actionError ? '#ffd3d3' : 'var(--text-primary)', fontSize: 13 }}>
            {actionError || actionMessage}
          </div>
        )}

        <section aria-label={filterMySoundsByGoalLabel} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {([
              ['' as ProductGoal | '', t('sounds.filter.all')],
              ['sleep' as ProductGoal, goalLabel('sleep')],
              ['calm' as ProductGoal, goalLabel('calm')],
              ['focus' as ProductGoal, goalLabel('focus')],
            ] as Array<[ProductGoal | '', string]>).map(([value, label]) => (
              <button
                key={label}
                type="button"
                className="interactive-card"
                onClick={() => updateGoal(value)}
                aria-pressed={goal === value}
                style={{
                  minHeight: 36,
                  padding: '0 16px',
                  borderRadius: 'var(--radius-pill)',
                  border: goal === value ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                  background: goal === value ? 'rgba(148,116,255,0.18)' : 'var(--surface-1)',
                  color: goal === value ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: goal === value ? '0 4px 14px var(--primary-glow)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {!loading && !query.trim() && !goal && (
          <section style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            <div className="glass-panel" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h2 style={{ fontSize: 16 }}>{t('sounds.replayed.title')}</h2>
                <span className="text-xs text-secondary">{t('sounds.replayed.subtitle')}</span>
              </div>
              {groupedMixes.recent.length === 0 ? (
                <p className="text-sm text-secondary">{t('sounds.replayed.empty')}</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {groupedMixes.recent.slice(0, 3).map((item) => (
                    <button key={item.id} type="button" onClick={() => navigate(`/player?mixId=${encodeURIComponent(item.id)}`, { state: { mixId: item.id } })} style={{ display: 'grid', gridTemplateColumns: '54px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                      <span style={{ width: 54, height: 54, borderRadius: 8, background: `url(${item.coverImageUrl}) center/cover`, display: 'block' }} />
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
                        <span className="text-xs text-secondary">{goalForMix(item) ? goalLabel(goalForMix(item) as ProductGoal) : t('common.saved')} · {sceneLabelForUi(item)}</span>
                      </span>
                      <span className="text-xs text-secondary">{item.playsCount}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="glass-panel" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <h2 style={{ fontSize: 16 }}>{t('sounds.useCase.title')}</h2>
                <span className="text-xs text-secondary">{t('sounds.useCase.subtitle')}</span>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {(['sleep', 'calm', 'focus'] as ProductGoal[]).map((itemGoal) => {
                  const bucket = groupedMixes.byGoal[itemGoal];
                  return (
                    <div key={itemGoal} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-1)' }}>
                      <strong style={{ display: 'block', marginBottom: 4 }}>{goalLabel(itemGoal)}</strong>
                      <p className="text-xs text-secondary" style={{ margin: '0 0 10px' }}>{t(`sounds.goal.${itemGoal}.description`)}</p>
                      {bucket.length === 0 ? (
                        <p className="text-xs text-secondary" style={{ margin: 0 }}>{t('sounds.none')}</p>
                      ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {bucket.slice(0, 2).map((item) => (
                            <button key={item.id} type="button" onClick={() => navigate(`/player?mixId=${encodeURIComponent(item.id)}`, { state: { mixId: item.id } })} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr)', gap: 10, alignItems: 'center', border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                              <span style={{ width: 42, height: 42, borderRadius: 8, background: `url(${item.coverImageUrl}) center/cover`, display: 'block' }} />
                              <span style={{ minWidth: 0 }}>
                                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
                                <span className="text-xs text-secondary">{sceneLabelForUi(item)} · {formatMinutes(item.recipeData.durationSeconds)}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {recentlyPublishedIsPreparing && (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: 12, border: '1px solid rgba(140,106,255,0.28)', borderRadius: 8, background: 'rgba(140,106,255,0.1)', fontSize: 13 }}>
            <Loader2 size={17} className="animate-spin" color="var(--primary)" />
            <span>{t('sounds.savedPreparing')}</span>
          </div>
        )}

        <label className="glass-panel" aria-label={searchMySoundsLabel} style={{ minHeight: 50, padding: '0 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 'var(--radius-pill)' }}>
          <Search size={19} color="var(--primary)" />
          <input
            type="search"
            aria-label={searchMySoundsLabel}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder={t('sounds.search')}
            style={{ width: '100%', minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text-primary)', fontSize: 15 }}
          />
        </label>

        <section aria-label={filterMySoundsByGoalLabel}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 18 }}>{t('sounds.savedRecent')}</h2>
            {!loading && <span className="text-xs text-secondary">{t('sounds.count', { count: total })}</span>}
          </div>
          {offlineFallback && <p role="status" aria-label={offlineFallbackLabel} className="text-sm text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}><WifiOff size={15} /> {t('home.offlineFallback')}</p>}
          {offlineError && <p role="alert" style={{ color: '#ffd3d3', fontSize: 13, marginBottom: 10 }}>{offlineError}</p>}
          {loading ? (
            <p className="text-sm text-secondary">{t('common.loadingSounds')}</p>
          ) : visibleMixes.length === 0 ? (
            <div className="glass-panel" style={{ padding: 24, textAlign: 'center' }}>
              <Library size={28} color="var(--text-secondary)" style={{ marginBottom: 10 }} />
              <p className="text-sm text-secondary">{t('sounds.empty')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {visibleMixes.map((item) => {
                const duration = item.recipeData.durationSeconds;
                const scene = sceneLabelForUi(item);
                return (
                  <div key={item.id} className="glass-panel interactive-card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '68px minmax(0, 1fr) auto', alignItems: 'center', gap: 12 }}>
                    <button type="button" onClick={() => navigate(`/player?mixId=${encodeURIComponent(item.id)}`, { state: { mixId: item.id } })} aria-label={`${t('common.play')} ${item.title}`} style={{ width: 68, height: 68, border: 0, borderRadius: 8, background: `linear-gradient(rgba(0,0,0,0.16), rgba(0,0,0,0.35)), url(${item.coverImageUrl}) center/cover`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Play size={21} fill="white" /></button>
                    <div style={{ minWidth: 0 }}>
                      <button type="button" onClick={() => navigate(`/player?mixId=${encodeURIComponent(item.id)}`, { state: { mixId: item.id } })} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                        <strong style={{ display: 'block', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
                        <span className="text-xs text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}><Clock3 size={12} /> {formatMinutes(duration)} · {scene}</span>
                      </button>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => startSimilarCreate(item)} style={{ minHeight: 30, padding: '0 10px', borderRadius: 999, border: '1px solid rgba(140,106,255,0.24)', background: 'rgba(140,106,255,0.12)', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          {t('sounds.createSimilar')}
                        </button>
                        <button type="button" onClick={() => void setAsDefault(item)} style={{ minHeight: 30, padding: '0 10px', borderRadius: 999, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          {t('sounds.setDefault')}
                        </button>
                      </div>
                      {offlineIds.has(item.id) && <span className="text-xs" style={{ display: 'block', marginTop: 5, color: 'var(--primary)' }}>{t('sounds.availableOffline')}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <button
                        type="button"
                        onClick={() => offlineIds.has(item.id) ? removeOffline(item.id) : saveOffline(item.id)}
                        aria-label={offlineIds.has(item.id) ? t('sounds.removeOffline', { title: item.title }) : t('sounds.saveOffline', { title: item.title })}
                        disabled={offlineBusyId === item.id}
                        style={{ width: 38, height: 38, border: '1px solid var(--surface-border)', borderRadius: '50%', background: 'var(--surface-1)', color: offlineIds.has(item.id) ? 'var(--primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: offlineBusyId === item.id ? 'default' : 'pointer' }}
                      >
                        {offlineBusyId === item.id ? <Loader2 size={17} className="animate-spin" /> : offlineIds.has(item.id) ? <Trash2 size={16} /> : <Download size={17} />}
                      </button>
                      {!offlineFallback && item.status !== 'draft' && (
                        <button type="button" onClick={() => setShareMix(item)} aria-label={t('sounds.share', { title: item.title })} style={{ width: 38, height: 38, border: '1px solid var(--surface-border)', borderRadius: '50%', background: 'var(--surface-1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Share2 size={17} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <button type="button" className="btn btn-secondary" aria-label={loadMoreLabel} onClick={() => { setLoading(true); setPage((current) => current + 1); }} disabled={loading} style={{ width: '100%', marginTop: 4 }}>
                  {loading ? <Loader2 size={17} className="animate-spin" /> : null}
                  {loading ? t('sounds.loadingMore') : t('sounds.loadMore')}
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {activeShareMix && <ShareVisibilityDialog mix={activeShareMix} onClose={closeShare} journeyId={location.state?.journeyId} journeyStartedAt={location.state?.journeyStartedAt} />}
      <BottomNav activeTab="sounds" />
    </div>
  );
};

export default StudioPage;
