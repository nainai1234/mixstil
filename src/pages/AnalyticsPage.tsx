import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Heart, Play, RefreshCw, Save, SlidersHorizontal, Target, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { Mix } from '../lib/domain';

type PlaybackMetricsSummary = Awaited<ReturnType<typeof api.getPlaybackMetricsSummary>>;

const readinessCopy = (status?: PlaybackMetricsSummary['retentionReadiness']['paymentReadiness']) => {
  if (status === 'ready_to_test_paywall') return { label: 'Ready to test paywall', color: 'var(--primary)' };
  if (status === 'not_ready') return { label: 'Not ready for payment', color: '#ffd3d3' };
  return { label: 'Collecting evidence', color: 'var(--text-secondary)' };
};

const formatPercent = (value: number | null | undefined) => value == null ? '—' : `${value}%`;

const AnalyticsPage: React.FC = () => {
  const [journeyMetrics, setJourneyMetrics] = useState<PlaybackMetricsSummary | null>(null);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const cohort = searchParams.get('cohort')?.trim() || undefined;
  const participant = searchParams.get('participant')?.trim() || undefined;

  useEffect(() => {
    Promise.all([api.getPlaybackMetricsSummary({ cohort, participant }), api.getStudioDashboard({ all: true })])
      .then(([metrics, studio]) => { setJourneyMetrics(metrics); setMixes(studio.mixes); })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load real analytics.'));
  }, [cohort, participant]);

  const totals = useMemo(() => mixes.reduce((summary, mix) => ({
    plays: summary.plays + mix.playsCount,
    favorites: summary.favorites + mix.likesCount,
    completion50: summary.completion50 + mix.completion50Count,
    completion90: summary.completion90 + mix.completion90Count,
    shares: summary.shares + mix.shareClicks,
  }), { plays: 0, favorites: 0, completion50: 0, completion90: 0, shares: 0 }), [mixes]);

  const completionRate = totals.plays === 0 ? null : Math.round((totals.completion90 / totals.plays) * 1000) / 10;
  const topMixes = [...mixes].sort((a, b) => b.playsCount - a.playsCount).slice(0, 5);
  const readiness = journeyMetrics?.retentionReadiness;
  const readinessState = readinessCopy(readiness?.paymentReadiness);
  const pilotCohort = cohort ?? 'pilot-2026-07-a';
  const pilotParticipant = participant ?? 'P01';
  const pilotSearch = new URLSearchParams({ cohort: pilotCohort, participant: pilotParticipant });
  const createPilotSearch = new URLSearchParams(pilotSearch);
  createPilotSearch.set('goal', 'sleep');
  createPilotSearch.set('duration', '1800');
  createPilotSearch.set('prompt', 'Help me sleep with a quiet, low-stimulation sound. No sudden sounds, no voices, and no water.');
  const pilotLinks = [
    { label: 'Participant Home', helper: 'Use this when you want the tester to choose their own daily path.', to: `/listen?${pilotSearch.toString()}` },
    { label: 'Direct Create', helper: 'Use this when you want a controlled first task.', to: `/create?${createPilotSearch.toString()}` },
    { label: 'Filtered report', helper: 'Use this to inspect only this participant.', to: `/creator/analytics?${pilotSearch.toString()}` },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Link to="/studio" className="btn-icon" style={{ background: 'var(--surface-2)' }}><ArrowLeft size={20} /></Link>
        <div><h1 style={{ fontSize: 24, fontWeight: 700 }}>Retention Readiness</h1><p className="text-sm text-secondary">{cohort ? `Cohort: ${cohort}${participant ? ` · Participant: ${participant}` : ''}` : 'Synthetic validation events are excluded.'}</p></div>
      </div>

      {error && <p role="alert" style={{ color: '#ffd3d3' }}>{error}</p>}

      <section className="glass-panel" style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div>
          <p className="text-xs text-secondary" style={{ marginBottom: 6 }}>RETENTION PILOT</p>
          <h2 style={{ fontSize: 18 }}>Cohort links</h2>
          <p className="text-xs text-secondary" style={{ marginTop: 6, lineHeight: 1.45 }}>
            Cohort: {pilotCohort} · Participant: {pilotParticipant}
          </p>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {pilotLinks.map((item) => (
            <Link key={item.label} to={item.to} style={{ minHeight: 58, padding: 11, borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-1)', color: 'var(--text-primary)', textDecoration: 'none', display: 'grid', gap: 4 }}>
              <strong style={{ fontSize: 13 }}>{item.label}</strong>
              <span className="text-xs text-secondary" style={{ lineHeight: 1.35 }}>{item.helper}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="glass-panel" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="text-xs text-secondary" style={{ marginBottom: 6 }}>PAYMENT DECISION</p>
            <h2 style={{ fontSize: 22, color: readinessState.color }}>{readinessState.label}</h2>
          </div>
          <Target size={22} color="var(--primary)" />
        </div>
        <p className="text-sm text-secondary" style={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>
          The paywall should wait until first-result value, repeat use, and preference memory are all visible in real behavior.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            {
              label: 'Accepted or saved',
              value: formatPercent(readiness?.gates.acceptedOrSaved.value),
              target: `${readiness?.gates.acceptedOrSaved.target ?? 40}% target`,
              passed: readiness?.gates.acceptedOrSaved.passed,
            },
            {
              label: 'Playback days in 30d',
              value: readiness?.gates.threeDayReplay.value ?? 0,
              target: `${readiness?.gates.threeDayReplay.target ?? 3} day target`,
              passed: readiness?.gates.threeDayReplay.passed,
            },
            {
              label: 'Preference signals',
              value: readiness?.gates.preferenceMemory.value ?? 0,
              target: `${readiness?.gates.preferenceMemory.target ?? 3} signal target`,
              passed: readiness?.gates.preferenceMemory.passed,
            },
          ].map((gate) => (
            <div key={gate.label} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--surface-border)' }}>
              {gate.passed ? <CheckCircle2 size={18} color="var(--primary)" /> : <XCircle size={18} color="var(--text-secondary)" />}
              <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13 }}>{gate.label}</strong><span className="text-xs text-secondary">{gate.target}</span></span>
              <strong>{gate.value}</strong>
            </div>
          ))}
        </div>
        {Boolean(readiness?.recommendations.length) && (
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(140,106,255,0.08)', border: '1px solid rgba(140,106,255,0.22)' }}>
            <strong style={{ display: 'block', marginBottom: 8 }}>Next validation actions</strong>
            {readiness!.recommendations.map((item) => <p key={item} className="text-xs text-secondary" style={{ margin: '6px 0 0', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{item}</p>)}
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          ['Plays', totals.plays, <Play key="plays" size={18} />],
          ['Favorites', totals.favorites, <Heart key="favorites" size={18} />],
          ['Shares', totals.shares, <RefreshCw key="shares" size={18} />],
          ['90% completion', completionRate == null ? '—' : `${completionRate}%`, <Clock key="completion" size={18} />],
        ].map(([label, value, icon]) => <div key={String(label)} className="glass-panel" style={{ padding: 16 }}><div className="text-secondary" style={{ marginBottom: 8 }}>{icon}</div><h3 style={{ fontSize: 24 }}>{value}</h3><p className="text-xs text-secondary">{label}</p></div>)}
      </div>

      <div className="glass-panel" style={{ padding: 18 }}>
        <p className="text-sm text-secondary">Quick Create to first playback</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
          <div><strong>{journeyMetrics?.successRate == null ? '—' : `${journeyMetrics.successRate}%`}</strong><br /><span className="text-xs text-secondary">success</span></div>
          <div><strong>{journeyMetrics?.timeToRecipeReadyMs?.p50 ?? '—'}</strong><br /><span className="text-xs text-secondary">Recipe P50 ms</span></div>
          <div><strong>{journeyMetrics?.timeToFirstPlaybackMs.p50 ?? '—'}</strong><br /><span className="text-xs text-secondary">P50 ms</span></div>
          <div><strong>{journeyMetrics?.timeToFirstPlaybackMs.p95 ?? '—'}</strong><br /><span className="text-xs text-secondary">P95 ms</span></div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Save size={18} /><h3 style={{ fontSize: 17 }}>Kept after listening</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 14 }}>
          <div><strong>{journeyMetrics?.resultOutcomes.saveRate == null ? '—' : `${journeyMetrics.resultOutcomes.saveRate}%`}</strong><br /><span className="text-xs text-secondary">saved</span></div>
          <div><strong>{journeyMetrics?.resultOutcomes.adjustedThenSavedRate == null ? '—' : `${journeyMetrics.resultOutcomes.adjustedThenSavedRate}%`}</strong><br /><span className="text-xs text-secondary">saved after edit</span></div>
          <div><strong>{journeyMetrics?.resultOutcomes.publishedJourneys ?? 0}</strong><br /><span className="text-xs text-secondary">published</span></div>
          <div><strong>{journeyMetrics?.resultOutcomes.replayRate == null ? '—' : `${journeyMetrics.resultOutcomes.replayRate}%`}</strong><br /><span className="text-xs text-secondary">replayed after save</span></div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 17, marginBottom: 12 }}>Retention memory</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div><strong>{readiness?.account30Day.playDays ?? 0}</strong><br /><span className="text-xs text-secondary">play days in 30d</span></div>
          <div><strong>{readiness?.account30Day.savedSounds ?? 0}</strong><br /><span className="text-xs text-secondary">saved sounds</span></div>
          <div><strong>{readiness?.preferenceEvidence.playbackBehavior ?? 0}</strong><br /><span className="text-xs text-secondary">playback feedback</span></div>
          <div><strong>{readiness?.preferenceEvidence.exclusions ?? 0}</strong><br /><span className="text-xs text-secondary">avoid signals</span></div>
        </div>
      </div>

      {Boolean(journeyMetrics?.failureReasons.length) && (
        <div className="glass-panel" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 17 }}>Observed failure reasons</h3>
          {journeyMetrics!.failureReasons.slice(0, 5).map((item) => <p key={item.reason} className="text-sm text-secondary" style={{ marginTop: 8 }}>{item.reason} · {item.count}</p>)}
        </div>
      )}

      <div className="glass-panel" style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SlidersHorizontal size={18} /><h3 style={{ fontSize: 17 }}>First result decisions</h3></div>
        <h2 style={{ marginTop: 12 }}>{journeyMetrics?.resultDecisions.firstResultAcceptanceRate == null ? '—' : `${journeyMetrics.resultDecisions.firstResultAcceptanceRate}%`}</h2>
        <p className="text-xs text-secondary">first-result acceptance</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          <div><strong>{journeyMetrics?.resultDecisions.acceptedJourneys ?? 0}</strong><br /><span className="text-xs text-secondary">kept</span></div>
          <div><strong>{journeyMetrics?.resultDecisions.adjustRequestedJourneys ?? 0}</strong><br /><span className="text-xs text-secondary">adjusted</span></div>
          <div><strong>{journeyMetrics?.resultDecisions.retryRequestedJourneys ?? 0}</strong><br /><span className="text-xs text-secondary">retried</span></div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 18, marginBottom: 12 }}>Works by recorded plays</h3>
        {topMixes.length === 0 ? <p className="text-sm text-secondary">No works have been created yet.</p> : topMixes.map((mix) => (
          <div key={mix.id} className="glass-panel" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 38, height: 38, borderRadius: 6, background: `url(${mix.coverImageUrl}) center/cover` }} />
            <div style={{ flex: 1 }}><h4 style={{ fontSize: 14 }}>{mix.title}</h4><p className="text-xs text-secondary">{mix.status} · {mix.renderStatus}</p></div>
            <strong>{mix.playsCount}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsPage;
