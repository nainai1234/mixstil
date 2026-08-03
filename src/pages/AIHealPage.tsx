import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowLeft, Moon, Waves, Brain, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { ProductGoal } from '../lib/domain';
import { summarizeSupplyDecision } from '../lib/generationSupply';
import { readLanguagePreference, resolveLanguagePreference } from '../lib/languagePreference';
import { useI18n } from '../lib/i18n';
import PaywallModal, { type PaywallReason } from '../components/PaywallModal';

const quickNeeds = [
  {
    labelKey: 'create.quick.cantSleep',
    goal: 'sleep' as const,
    durationSeconds: 1800,
  },
  {
    labelKey: 'create.quick.wakeNight',
    goal: 'sleep' as const,
    durationSeconds: 1200,
  },
  {
    labelKey: 'create.quick.focus',
    goal: 'focus' as const,
    durationSeconds: 2700,
  },
  {
    labelKey: 'create.quick.calm',
    goal: 'calm' as const,
    durationSeconds: 1200,
  },
] as const;

const avoidShortcuts = [
  { labelKey: 'avoid.water' },
  { labelKey: 'avoid.rain' },
  { labelKey: 'avoid.wind' },
  { labelKey: 'avoid.voices' },
  { labelKey: 'avoid.birds' },
  { labelKey: 'avoid.music' },
] as const;

type GenerationPreview = {
  title: string;
  supplyLabel: string;
  supplyDescription: string;
  why: string;
  seedLabel: string;
};

const AIHealPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, goalLabel, formatMinutes } = useI18n();
  const [searchParams] = useSearchParams();
  const [prompt, setPrompt] = useState(() => searchParams.get('prompt')?.slice(0, 1200) ?? '');
  const [goal, setGoal] = useState<ProductGoal>(() => {
    const requestedGoal = searchParams.get('goal');
    return requestedGoal === 'calm' || requestedGoal === 'focus' ? requestedGoal : 'sleep';
  });
  const [durationSeconds, setDurationSeconds] = useState(() => {
    const requestedDuration = Number(searchParams.get('duration'));
    return [300, 600, 900, 1800, 3600].includes(requestedDuration) ? requestedDuration : 900;
  });
  const guidedVoice = false;
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPreview, setGenerationPreview] = useState<GenerationPreview | null>(null);
  const [error, setError] = useState('');
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [promptAttention, setPromptAttention] = useState(false);
  const validationCohort = searchParams.get('cohort')?.trim() ?? '';
  const validationParticipant = searchParams.get('participant')?.trim() ?? '';
  const validationContext = /^[a-zA-Z0-9_-]{2,64}$/.test(validationCohort)
    && /^[a-zA-Z0-9_-]{1,64}$/.test(validationParticipant)
    ? { validationCohort, validationParticipant }
    : {};

  const expectedGenerationSeconds = guidedVoice ? 15 : 12;
  const generationStep = generationProgress >= 100
    ? 5
    : generationProgress >= 78
      ? 4
      : generationProgress >= 50
        ? 3
        : generationProgress >= 25
          ? 2
          : 1;

  useEffect(() => {
    if (!isGenerating) return;

    const startedAt = Date.now();
    setGenerationProgress(6);
    const intervalId = window.setInterval(() => {
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const ratio = elapsedSeconds / expectedGenerationSeconds;
      let estimatedProgress: number;

      if (ratio <= 0.25) {
        estimatedProgress = 6 + (ratio / 0.25) * 24;
      } else if (ratio <= 0.58) {
        estimatedProgress = 30 + ((ratio - 0.25) / 0.33) * 32;
      } else if (ratio <= 1) {
        estimatedProgress = 62 + ((ratio - 0.58) / 0.42) * 26;
      } else {
        estimatedProgress = 88 + 8 * (1 - Math.exp(-(ratio - 1) * 0.8));
      }

      setGenerationProgress((current) => current >= 100 ? current : Math.min(96, estimatedProgress));
    }, 200);

    return () => window.clearInterval(intervalId);
  }, [expectedGenerationSeconds, isGenerating]);

  const applyQuickNeed = (need: typeof quickNeeds[number]) => {
    setGoal(need.goal);
    setDurationSeconds(need.durationSeconds);
    setPrompt(`${t('create.avoidIntro')} ${t(need.labelKey)}`);
    setError('');
    promptRef.current?.focus();
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isGenerating) {
      setError(t('create.error.empty'));
      setPromptAttention(true);
      promptRef.current?.focus();
      window.setTimeout(() => setPromptAttention(false), 700);
      return;
    }
    const journeyId = `qc_${crypto.randomUUID()}`;
    const journeyStartedAt = Date.now();
    setIsGenerating(true);
    setGenerationProgress(6);
    setGenerationPreview(null);
    setError('');
    try {
      const soundProfile = await api.getSoundProfile().catch(() => null);
      const languagePreference = readLanguagePreference();
      const resolvedLanguage = resolveLanguagePreference(languagePreference);
      const generationStartedAt = Date.now();
      const generatedPromise = api.quickCreate({
        prompt: trimmedPrompt,
        goal,
        durationSeconds,
        guidedVoice,
        languagePreference,
        resolvedLanguage,
        stableExcludedSounds: soundProfile?.profile.excludedSounds,
        stableLikedSounds: soundProfile?.profile.likedSounds,
      });
      const generated = await generatedPromise;
      const supplySummary = summarizeSupplyDecision(generated.generationDecision, t);
      const baselineMatch = generated.mix.recipeData.quickCreate?.internalBaselineMatch;
      setGenerationPreview({
        title: generated.mix.title,
        supplyLabel: supplySummary.label,
        supplyDescription: supplySummary.description,
        why: baselineMatch?.matchReason
          ?? t('create.whyApprovedFallback'),
        seedLabel: baselineMatch?.title
          ? (generated.planning.internalBaselineSeed ? t('create.seedWithTitle', { title: baselineMatch.title, seed: generated.planning.internalBaselineSeed }) : baselineMatch.title)
          : generated.planning.internalBaselineSeed
            ? t('create.seed', { seed: generated.planning.internalBaselineSeed })
            : t('create.recipeArrangement'),
      });
      if (generated.mix.recipeData.audioIntent?.guidedVoice.enabled) {
        setGenerationProgress((current) => Math.max(current, 82));
        await api.ensureVoicePreview(generated.mix.id);
      }
      const remainingMs = Math.max(0, 250 - (Date.now() - generationStartedAt));
      if (remainingMs > 0) await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
      api.recordPlaybackEvents(generated.mix.id, journeyId, [
        {
          type: 'quick_create_started',
          elapsedMs: 0,
          details: { source: 'ai_heal', prompt: trimmedPrompt, goal, durationSeconds, guidedVoice, languagePreference, resolvedLanguage, ...validationContext },
        },
        {
          type: 'recipe_ready',
          elapsedMs: Date.now() - journeyStartedAt,
          details: {
            trackCount: generated.tracks.length,
            contentMode: generated.mix.recipeData.contentMode,
            scene: generated.mix.recipeData.audioIntent?.scene,
            excludedSounds: generated.mix.recipeData.audioIntent?.excludedSounds ?? [],
            provider: generated.planning.provider,
            model: generated.planning.model,
            internalBaselineSeed: generated.planning.internalBaselineSeed,
            generationDecision: generated.generationDecision.kind,
            missingSupplyRoles: generated.generationDecision.missing.map((item) => item.role),
          },
        },
      ]).catch((metricsError) => console.warn('Could not record AI Quick Create timing:', metricsError));
      setGenerationProgress(100);
      const playerParams = new URLSearchParams({
        mixId: generated.mix.id,
        journeyId,
        journeyStartedAt: String(journeyStartedAt),
        returnTo: '/listen',
      });
      if (validationContext.validationCohort) playerParams.set('cohort', validationContext.validationCohort);
      if (validationContext.validationParticipant) playerParams.set('participant', validationContext.validationParticipant);
      navigate(`/player?${playerParams.toString()}`, {
        state: {
          mixId: generated.mix.id,
          journeyId,
          journeyStartedAt,
          returnTo: '/listen',
          validationCohort: validationContext.validationCohort,
          validationParticipant: validationContext.validationParticipant,
        },
      });
    } catch (requestError) {
      setGenerationPreview(null);
      const code = (requestError as { payload?: { code?: string } })?.payload?.code;
      if (code === 'generation_limit_reached') setPaywallReason('generation_limit');
      if (code === 'session_length_requires_plus') setPaywallReason('session_length');
      setError(requestError instanceof Error
        ? requestError.message
        : t('create.error.failed'));
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Top Nav */}
      <div style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} style={{ background: 'var(--surface-1)' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{t('create.title')}</h2>
      </div>

      {isGenerating ? (
        <div style={{ flex: 1, padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(140,106,255,0.18)', color: 'var(--primary)' }}>
              <Loader2 size={32} className="animate-spin" />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{t('create.generating.title')}</h1>
            <p className="text-secondary">{t('create.generating.subtitle')}</p>
          </div>
          {generationPreview && (
            <section
              aria-live="polite"
              aria-label={t('create.generatedSummary')}
              style={{
                maxWidth: 420,
                width: '100%',
                margin: '0 auto 24px',
                padding: 16,
                borderRadius: 16,
                border: '1px solid rgba(232,240,106,0.28)',
                background: 'linear-gradient(135deg, rgba(232,240,106,0.10), rgba(140,106,255,0.10))',
                boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 28, height: 28, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,240,106,0.16)', color: '#e8f06a', flex: '0 0 auto' }}>
                  <CheckCircle2 size={17} />
                </span>
                <div style={{ display: 'grid', gap: 7 }}>
                  <div>
                    <p className="text-xs text-secondary" style={{ margin: '0 0 3px' }}>{t('create.ready')}</p>
                    <strong style={{ fontSize: 16 }}>{generationPreview.title}</strong>
                  </div>
                  <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>{generationPreview.why}</p>
                  <div style={{ padding: '9px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <strong style={{ display: 'block', fontSize: 12, marginBottom: 3 }}>{generationPreview.supplyLabel}</strong>
                    <p className="text-xs text-secondary" style={{ margin: 0, lineHeight: 1.45 }}>{generationPreview.supplyDescription}</p>
                  </div>
                  <span className="text-xs text-secondary">{generationPreview.seedLabel}</span>
                </div>
              </div>
            </section>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 360, width: '100%', margin: '0 auto' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
                <span aria-live="polite" style={{ fontSize: 14, fontWeight: 700 }}>
                  {generationProgress >= 100 ? t('create.ready') : `${Math.round(generationProgress)}%`}
                </span>
                <span className="text-secondary" style={{ fontSize: 13, textAlign: 'right' }}>
                  {generationProgress >= 100
                    ? t('create.opening')
                    : generationProgress < 12
                      ? t('create.usuallyReady', { range: guidedVoice ? '12-15' : '8-12' })
                      : generationProgress < 88
                        ? t('create.remaining', { count: Math.max(1, Math.ceil(expectedGenerationSeconds * (1 - generationProgress / 88))) })
                        : t('create.finishing')}
                </span>
              </div>
              <div
                className="generation-progress-track"
                role="progressbar"
                aria-label={t('create.generationProgress')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(generationProgress)}
              >
                <div className="generation-progress-fill" style={{ width: `${generationProgress}%` }} />
              </div>
            </div>
            {[t('create.step.intent'), t('create.step.layers'), t('create.step.arrange'), t('create.step.player')].map((label, index) => {
              const complete = generationStep > index + 1;
              const active = generationStep === index + 1;
              return <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: generationStep >= index + 1 ? 1 : 0.35 }}>{complete ? <CheckCircle2 size={18} color="var(--primary)" /> : active ? <Loader2 size={18} color="var(--primary)" className="animate-spin" /> : <span style={{ width: 18, height: 18, border: '1px solid var(--surface-border)', borderRadius: '50%' }} />}<span style={{ fontSize: 14 }}>{label}</span></div>;
            })}
          </div>
        </div>
      ) : <div style={{ flex: 1, padding: 'var(--space-6) var(--space-6) 20vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
        <div className="ambient-glow" />
        
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 'var(--space-2)', lineHeight: 1.15 }}>{t('create.hero')}</h1>
        <p className="text-secondary" style={{ marginBottom: 'var(--space-6)', fontSize: 15 }}>{t('create.subtitle')}</p>

        <section style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{t('create.quick.title')}</h2>
            <span className="text-xs text-secondary">{t('create.quick.subtitle')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {quickNeeds.map((need) => (
              <button
                key={need.labelKey}
                type="button"
                className="glass-panel interactive-card"
                onClick={() => applyQuickNeed(need)}
                style={{ minHeight: 78, border: 'none', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: 14, cursor: 'pointer', textAlign: 'left' }}
              >
                <strong style={{ fontSize: 14, lineHeight: 1.25 }}>{t(need.labelKey)}</strong>
                <span className="text-xs text-secondary" style={{ lineHeight: 1.35 }}>{t('create.quick.fill')}</span>
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 'var(--space-6)' }}>
          {([
            ['sleep', goalLabel('sleep'), <Moon key="sleep-icon" size={17} />],
            ['calm', goalLabel('calm'), <Waves key="calm-icon" size={17} />],
            ['focus', goalLabel('focus'), <Brain key="focus-icon" size={17} />],
          ] as const).map(([value, label, icon]) => (
            <button key={value} className="interactive-card" aria-pressed={goal === value} onClick={() => setGoal(value)} style={{ padding: '12px 10px', borderRadius: 'var(--radius-md)', border: goal === value ? '1px solid var(--primary)' : '1px solid var(--surface-border)', background: goal === value ? 'rgba(148,116,255,0.18)' : 'var(--surface-1)', color: goal === value ? 'var(--primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, boxShadow: goal === value ? '0 4px 16px var(--primary-glow)' : 'none' }}>
              {icon}{label}
            </button>
          ))}
        </div>

        <section style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16 }}>{t('create.avoid.title')}</h2>
            <span className="text-xs text-secondary">{t('create.avoid.subtitle')}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {avoidShortcuts.map(({ labelKey }) => (
              <button
                key={labelKey}
                type="button"
                onClick={() => {
                  const sentence = t(labelKey);
                  const nextValue = prompt.trim()
                    ? `${prompt.trim()} ${sentence}`
                    : `${t('create.avoidIntro')} ${sentence}`;
                  setPrompt(nextValue);
                  setError('');
                  promptRef.current?.focus();
                }}
                style={{ minHeight: 38, padding: '0 11px', borderRadius: 999, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </section>

        {/* AI Input Portal */}
        <div className="glass-panel-heavy" style={{ padding: 'var(--space-6)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(148,116,255,0.35)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ position: 'absolute', top: -60, left: -60, width: 180, height: 180, background: 'var(--primary)', filter: 'blur(90px)', opacity: 0.25, borderRadius: '50%' }} />
          
          <textarea 
            ref={promptRef}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); if (e.target.value.trim()) setError(''); }}
            placeholder={t('create.placeholder')}
            style={{ 
              width: '100%', height: 120, background: 'transparent', border: 'none', 
              color: 'white', fontSize: 18, fontFamily: 'inherit', lineHeight: 1.45, resize: 'none',
              position: 'relative', zIndex: 1, paddingRight: 40,
              outline: promptAttention ? '2px solid #FF9F43' : 'none',
              boxShadow: promptAttention ? '0 0 0 5px rgba(255,159,67,0.16)' : 'none',
              transition: 'outline 0.15s ease, box-shadow 0.15s ease'
            }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-3)', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            {[300, 600, 900, 1800].map((seconds) => (
              <button key={seconds} className="interactive-card" aria-pressed={durationSeconds === seconds} onClick={() => setDurationSeconds(seconds)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: durationSeconds === seconds ? '1px solid var(--accent)' : '1px solid var(--surface-border)', background: durationSeconds === seconds ? 'rgba(46,229,245,0.14)' : 'rgba(255,255,255,0.03)', color: durationSeconds === seconds ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 650 }}>
                {formatMinutes(seconds)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-6)', position: 'relative', zIndex: 1 }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px 28px', borderRadius: 'var(--radius-pill)', fontWeight: 700, fontSize: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}
              onClick={handleGenerate}
              aria-disabled={isGenerating}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  {t('create.analyzing')}
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  {t('create.submit')}
                </>
              )}
            </button>
          </div>
          {error && <p role="alert" style={{ color: '#ffd3d3', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>

        {/* Popular Needs Tags */}
        <div style={{ marginTop: 'var(--space-8)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[
              t('create.popular.sleep'),
              t('create.popular.calm'),
              t('create.popular.focus')
            ].map(tag => (
              <button 
                key={tag} 
                onClick={() => setPrompt(tag)}
                style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', padding: '8px 16px', borderRadius: 20, color: 'var(--text-secondary)', fontSize: 13, transition: 'all 0.2s', cursor: 'pointer' }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>}
      {paywallReason && <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />}

    </div>
  );
};

export default AIHealPage;
