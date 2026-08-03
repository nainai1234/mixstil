import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Clipboard, Download, Pause, Play, RotateCcw, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type ListeningQaItem = {
  recipeId: string;
  name: string;
  goal: string;
  scene: string;
  durationSeconds: number;
  mixId: string;
  renderedAudioUrl: string;
  renderStatus: string;
  autoQa: null | {
    durationSeconds: number;
    peakDb: number | null;
    integratedLufs: number | null;
    abnormalSilenceCount: number;
    passed: boolean;
    createdAt: string;
  };
};

type Review = {
  heardIntro: boolean;
  heardMiddle: boolean;
  heardFinal: boolean;
  sceneFit: string;
  balance: string;
  loopSmoothness: string;
  transientSafety: string;
  fatigueRisk: string;
  blockingIssue: string;
  verdict: 'pending' | 'pass' | 'needs_fix' | 'reject';
  notes: string;
};

const emptyReview = (): Review => ({
  heardIntro: false,
  heardMiddle: false,
  heardFinal: false,
  sceneFit: '',
  balance: '',
  loopSmoothness: '',
  transientSafety: '',
  fatigueRisk: '',
  blockingIssue: '',
  verdict: 'pending',
  notes: '',
});

const storageKey = 'snooze_listening_qa_reviews_v1';
const voiceStorageKey = 'snooze_listening_qa_voice_review_v1';

type ScoreField = 'sceneFit' | 'balance' | 'loopSmoothness' | 'transientSafety' | 'fatigueRisk';

const fieldLabels: Array<[ScoreField, string]> = [
  ['sceneFit', 'Scene fit'],
  ['balance', 'Balance'],
  ['loopSmoothness', 'Loop'],
  ['transientSafety', 'Transient'],
  ['fatigueRisk', 'Fatigue'],
];

const voiceRows = [
  ['scriptSource', 'Voice script source', 'Approved script block or safe whitelisted edit'],
  ['previewStatus', 'Voice preview status', 'Stem remains needs_review before review'],
  ['exportGate', 'Export check before QA', 'Blocked by QA/rights/commercial/derivative gates'],
  ['liveMixLabel', 'Live Mix label', 'Voice lane shows real preview stem name, not Unknown Stem'],
  ['defaultPacing', 'Default pacing', 'Comfortable and intelligible'],
  ['slowerEdit', 'Slower edit', '人声更慢 sets playbackRate 0.9 and increases visible duration'],
  ['duckingComfort', 'Ducking comfort', 'Background lowers naturally under voice and recovers smoothly'],
  ['voiceQaApproval', 'Voice QA approval', 'Only complete QA approval allows export'],
] as const;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const isPassingReview = (review: Review) => (
  review.verdict === 'pass'
  && review.heardIntro
  && review.heardMiddle
  && review.heardFinal
  && fieldLabels.every(([field]) => Number(review[field]) >= 4)
  && review.blockingIssue.trim().length === 0
);

const hasStandardVerdict = (review: Review) => (
  review.verdict !== 'pending'
  && review.heardIntro
  && review.heardMiddle
  && review.heardFinal
);

const ListeningQaPage: React.FC = () => {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [items, setItems] = useState<ListeningQaItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [voiceReview, setVoiceReview] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selected = items.find((item) => item.recipeId === selectedId) ?? items[0];
  const selectedReview = selected ? reviews[selected.recipeId] ?? emptyReview() : emptyReview();
  const selectedIndex = selected ? items.findIndex((item) => item.recipeId === selected.recipeId) : -1;
  const completedCount = items.filter((item) => hasStandardVerdict(reviews[item.recipeId] ?? emptyReview())).length;
  const passCount = items.filter((item) => isPassingReview(reviews[item.recipeId] ?? emptyReview())).length;
  const incompleteStandardCount = Math.max(0, items.length - completedCount);
  const nextPending = items.find((item) => !hasStandardVerdict(reviews[item.recipeId] ?? emptyReview()));
  const voiceStarted = voiceRows.some(([key]) => (
    Boolean(voiceReview[`${key}Actual`]?.trim())
    || Boolean(voiceReview[`${key}Notes`]?.trim())
    || (voiceReview[`${key}Verdict`] ?? 'pending') !== 'pending'
  ));
  const incompleteVoiceCount = voiceStarted
    ? voiceRows.filter(([key]) => (voiceReview[`${key}Verdict`] ?? 'pending') === 'pending').length
    : 0;
  const canSaveFinal = items.length > 0 && incompleteStandardCount === 0 && incompleteVoiceCount === 0;

  useEffect(() => {
    api.getListeningQaSession()
      .then((session) => {
        setItems(session.items);
        setSelectedId(session.items[0]?.recipeId ?? '');
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load listening QA session.'));
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try { setReviews(JSON.parse(stored)); } catch { setReviews({}); }
    }
    const storedVoice = window.localStorage.getItem(voiceStorageKey);
    if (storedVoice) {
      try { setVoiceReview(JSON.parse(storedVoice)); } catch { setVoiceReview({}); }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(reviews));
  }, [reviews]);

  useEffect(() => {
    window.localStorage.setItem(voiceStorageKey, JSON.stringify(voiceReview));
  }, [voiceReview]);

  useEffect(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [selectedId]);

  const updateReview = (recipeId: string, patch: Partial<Review>) => {
    setReviews((current) => ({
      ...current,
      [recipeId]: { ...(current[recipeId] ?? emptyReview()), ...patch },
    }));
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
      setError('');
    } catch {
      setError('Playback was blocked by the browser. Tap Play again.');
    }
  };

  const jumpTo = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || seconds));
  };

  const markSegmentAndJump = (segment: 'heardIntro' | 'heardMiddle' | 'heardFinal', seconds: number) => {
    if (!selected) return;
    updateReview(selected.recipeId, { [segment]: true });
    jumpTo(seconds);
  };

  const selectNextPending = () => {
    if (nextPending) {
      setSelectedId(nextPending.recipeId);
      return;
    }
    if (items.length > 0 && selectedIndex >= 0) {
      setSelectedId(items[(selectedIndex + 1) % items.length].recipeId);
    }
  };

  const exportedMarkdown = useMemo(() => {
    const rows = items.map((item) => {
      const review = reviews[item.recipeId] ?? emptyReview();
      return [
        item.recipeId,
        item.name,
        item.goal,
        item.scene,
        item.mixId,
        item.renderedAudioUrl,
        item.autoQa?.passed ? 'auto-pass' : 'auto-missing',
        review.heardIntro ? 'yes' : 'no',
        review.heardMiddle ? 'yes' : 'no',
        review.heardFinal ? 'yes' : 'no',
        review.sceneFit,
        review.balance,
        review.loopSmoothness,
        review.transientSafety,
        review.fatigueRisk,
        review.blockingIssue.replaceAll('|', '/'),
        review.verdict,
        review.notes.replaceAll('|', '/'),
      ].join(' | ');
    });
    return `# Listening QA Results

Generated: ${new Date().toISOString()}
Status: ${canSaveFinal ? 'final-ready' : 'draft'}
Standard works reviewed: ${completedCount}/${items.length}
Standard works passing: ${passCount}/${items.length}
Voice QA started: ${voiceStarted ? 'yes' : 'no'}
Voice QA incomplete rows: ${incompleteVoiceCount}

| Recipe ID | Name | Goal | Scene | Mix ID | Render | Auto QA | Heard intro | Heard middle | Heard final | Scene fit | Balance | Loop | Transient | Fatigue | Blocking issue | Verdict | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
${rows.map((row) => `| ${row} |`).join('\n')}

## Controlled Voice Preview QA

| Check | Actual | Verdict | Notes |
| --- | --- | --- | --- |
| Voice script source | ${voiceReview.scriptSourceActual ?? ''} | ${voiceReview.scriptSourceVerdict ?? 'pending'} | ${voiceReview.scriptSourceNotes ?? ''} |
| Voice preview status | ${voiceReview.previewStatusActual ?? ''} | ${voiceReview.previewStatusVerdict ?? 'pending'} | ${voiceReview.previewStatusNotes ?? ''} |
| Export check before QA | ${voiceReview.exportGateActual ?? ''} | ${voiceReview.exportGateVerdict ?? 'pending'} | ${voiceReview.exportGateNotes ?? ''} |
| Live Mix label | ${voiceReview.liveMixLabelActual ?? ''} | ${voiceReview.liveMixLabelVerdict ?? 'pending'} | ${voiceReview.liveMixLabelNotes ?? ''} |
| Default pacing | ${voiceReview.defaultPacingActual ?? ''} | ${voiceReview.defaultPacingVerdict ?? 'pending'} | ${voiceReview.defaultPacingNotes ?? ''} |
| Slower edit | ${voiceReview.slowerEditActual ?? ''} | ${voiceReview.slowerEditVerdict ?? 'pending'} | ${voiceReview.slowerEditNotes ?? ''} |
| Ducking comfort | ${voiceReview.duckingComfortActual ?? ''} | ${voiceReview.duckingComfortVerdict ?? 'pending'} | ${voiceReview.duckingComfortNotes ?? ''} |
| Voice QA approval | ${voiceReview.voiceQaApprovalActual ?? ''} | ${voiceReview.voiceQaApprovalVerdict ?? 'pending'} | ${voiceReview.voiceQaApprovalNotes ?? ''} |
`;
  }, [canSaveFinal, completedCount, incompleteVoiceCount, items, passCount, reviews, voiceReview, voiceStarted]);

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(exportedMarkdown);
    setMessage('Listening QA markdown copied.');
  };

  const downloadMarkdown = () => {
    const blob = new Blob([exportedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `listening-qa-results-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveMarkdown = async (status: 'draft' | 'final') => {
    if (status === 'final' && !canSaveFinal) {
      setError(`Final QA is incomplete: ${incompleteStandardCount} standard works still need verdict + intro/middle/final checks${incompleteVoiceCount ? `, ${incompleteVoiceCount} voice rows pending` : ''}.`);
      setMessage('');
      return;
    }
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await api.saveListeningQaResults({ markdown: exportedMarkdown, status });
      setMessage(`Saved ${result.status} report: ${result.relativePath}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save listening QA results.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetCurrent = () => {
    if (!selected) return;
    updateReview(selected.recipeId, emptyReview());
  };

  const resetStandardQaDraft = () => {
    setReviews({});
    setSelectedId(items[0]?.recipeId ?? '');
    window.localStorage.removeItem(storageKey);
  };

  const updateVoiceReview = (key: string, value: string) => {
    setVoiceReview((current) => ({ ...current, [key]: value.replaceAll('|', '/') }));
  };

  return (
    <div style={{ minHeight: '100vh', padding: 'var(--space-6)', background: 'var(--bg-gradient)' }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} style={{ background: 'transparent' }}>
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <p className="text-xs text-secondary">Mainline QA · Recipe V2 subjective gate</p>
          <h2 style={{ fontSize: 22 }}>Listening QA Workbench</h2>
          <p className="text-xs text-secondary" style={{ marginTop: 4 }}>
            Final requires each standard work to have Intro, Middle, Final checks plus a verdict.
          </p>
        </div>
        <button className="btn" onClick={copyMarkdown} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Clipboard size={16} /> Copy
        </button>
        <button className="btn btn-primary" onClick={downloadMarkdown} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Download size={16} /> Export
        </button>
        <button className="btn" onClick={() => saveMarkdown('draft')} disabled={isSaving} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Save size={16} /> {isSaving ? 'Saving...' : 'Save Draft'}
        </button>
        <button className="btn" onClick={resetStandardQaDraft} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <RotateCcw size={16} /> Reset Draft
        </button>
        <button
          className="btn btn-primary"
          onClick={() => saveMarkdown('final')}
          disabled={isSaving || !canSaveFinal}
          title={canSaveFinal ? 'Save final QA report' : 'Final requires all standard works to have intro/middle/final checks plus verdicts, and started voice rows to have verdicts.'}
          style={{ display: 'inline-flex', gap: 8, alignItems: 'center', opacity: canSaveFinal ? 1 : 0.55 }}
        >
          <Check size={16} /> Save Final
        </button>
      </header>

      <div style={{ marginBottom: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)', borderRadius: 14, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span className="text-sm text-secondary">Final gate: {canSaveFinal ? 'ready' : 'not ready'}</span>
        <span className="text-sm text-secondary">Standard pending: {incompleteStandardCount}</span>
        <span className="text-sm text-secondary">Voice QA: {voiceStarted ? `${incompleteVoiceCount} pending` : 'not started'}</span>
        <button className="btn" onClick={selectNextPending} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          Next pending
        </button>
        <span className="text-sm" style={{ color: 'var(--primary)' }}>Draft can be saved anytime.</span>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.95fr) minmax(320px, 1.4fr)', gap: 16 }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="text-sm text-secondary">{completedCount}/{items.length} reviewed</span>
            <span className="text-sm" style={{ color: 'var(--primary)' }}>{passCount} pass</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => {
              const review = reviews[item.recipeId] ?? emptyReview();
              const active = item.recipeId === selected?.recipeId;
              return (
                <button
                  key={item.recipeId}
                  onClick={() => setSelectedId(item.recipeId)}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${active ? 'var(--primary)' : 'var(--surface-border)'}`,
                    borderRadius: 12,
                    padding: 12,
                    background: active ? 'rgba(140, 106, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{item.name}</strong>
                    <span className="text-xs" style={{ color: review.verdict === 'pass' ? '#00FF94' : 'var(--text-secondary)' }}>
                      {hasStandardVerdict(review) ? review.verdict : 'pending'}
                    </span>
                  </div>
                  <p className="text-xs text-secondary" style={{ marginTop: 4 }}>
                    {item.goal} · {item.scene} · {Math.round(item.durationSeconds / 60)}m
                  </p>
                  <p className="text-xs text-secondary" style={{ marginTop: 4 }}>
                    Heard: {review.heardIntro ? 'I' : '·'} {review.heardMiddle ? 'M' : '·'} {review.heardFinal ? 'F' : '·'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 18 }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 20, marginBottom: 4 }}>{selected.name}</h3>
                  <p className="text-sm text-secondary">
                    {selectedIndex + 1}/{items.length} · {selected.recipeId} · {selected.mixId}
                  </p>
                  <p className="text-xs text-secondary" style={{ marginTop: 6 }}>
                    Auto QA: {selected.autoQa?.passed ? 'pass' : 'missing'} · duration {selected.autoQa ? formatTime(selected.autoQa.durationSeconds) : '-'} · peak {selected.autoQa?.peakDb ?? '-'} dB · silence {selected.autoQa?.abnormalSilenceCount ?? '-'}
                  </p>
                </div>
                <button className="btn" onClick={resetCurrent} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <RotateCcw size={16} /> Reset
                </button>
              </div>

              <audio
                ref={audioRef}
                src={selected.renderedAudioUrl}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                style={{ width: '100%', marginTop: 18 }}
                controls
              />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <button className="btn btn-primary" onClick={togglePlay} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />} {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button className={selectedReview.heardIntro ? 'btn btn-primary' : 'btn'} onClick={() => markSegmentAndJump('heardIntro', 0)}>
                  Intro 0:00 {selectedReview.heardIntro ? '✓' : ''}
                </button>
                <button className={selectedReview.heardMiddle ? 'btn btn-primary' : 'btn'} onClick={() => markSegmentAndJump('heardMiddle', selected.durationSeconds / 2)}>
                  Middle {formatTime(selected.durationSeconds / 2)} {selectedReview.heardMiddle ? '✓' : ''}
                </button>
                <button className={selectedReview.heardFinal ? 'btn btn-primary' : 'btn'} onClick={() => markSegmentAndJump('heardFinal', Math.max(0, selected.durationSeconds - 30))}>
                  Final 30s {selectedReview.heardFinal ? '✓' : ''}
                </button>
                <button className="btn" onClick={selectNextPending}>Next pending</button>
                <button className="btn" onClick={() => window.open(`/creator/mix?mixId=${selected.mixId}`, '_blank')}>Open Live Mix</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 22 }}>
                {fieldLabels.map(([field, label]) => (
                  <label key={field} className="text-xs text-secondary">
                    {label}
                    <select
                      aria-label={label}
                      value={selectedReview[field]}
                      onChange={(event) => updateReview(selected.recipeId, { [field]: event.target.value })}
                      style={{ width: '100%', marginTop: 6, background: 'var(--surface-2)', color: 'white', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 10 }}
                    >
                      <option value="">-</option>
                      {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              <label className="text-xs text-secondary" style={{ display: 'block', marginTop: 16 }}>
                Blocking issue
                <input
                  value={selectedReview.blockingIssue}
                  onChange={(event) => updateReview(selected.recipeId, { blockingIssue: event.target.value })}
                  placeholder="clicks, harsh highs, loop seam, scene mismatch..."
                  style={{ width: '100%', marginTop: 6, background: 'var(--surface-2)', color: 'white', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 12 }}
                />
              </label>

              <label className="text-xs text-secondary" style={{ display: 'block', marginTop: 12 }}>
                Notes
                <textarea
                  value={selectedReview.notes}
                  onChange={(event) => updateReview(selected.recipeId, { notes: event.target.value })}
                  rows={4}
                  placeholder="One sentence explaining the verdict."
                  style={{ width: '100%', marginTop: 6, background: 'var(--surface-2)', color: 'white', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 12, resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                {(['pass', 'needs_fix', 'reject'] as const).map((verdict) => (
                  <button
                    key={verdict}
                    className={selectedReview.verdict === verdict ? 'btn btn-primary' : 'btn'}
                    onClick={() => updateReview(selected.recipeId, { verdict })}
                    style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                  >
                    {selectedReview.verdict === verdict && <Check size={16} />}
                    {verdict}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-secondary">Loading listening QA session...</p>
          )}
        </div>
      </section>

      <section style={{ marginTop: 16, background: 'var(--surface-1)', border: '1px solid var(--surface-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <p className="text-xs text-secondary">Controlled voice QA path</p>
            <h3 style={{ fontSize: 18 }}>Voice Preview Review</h3>
          </div>
          <button
            className="btn"
            onClick={() => {
              setVoiceReview({});
              window.localStorage.removeItem(voiceStorageKey);
            }}
            style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
          >
            <RotateCcw size={16} /> Reset voice QA
          </button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {voiceRows.map(([key, label, expected]) => (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr 160px 1.4fr', gap: 10, alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: 13 }}>{label}</strong>
                <p className="text-xs text-secondary" style={{ marginTop: 4 }}>{expected}</p>
              </div>
              <input
                aria-label={`${label} actual`}
                value={voiceReview[`${key}Actual`] ?? ''}
                onChange={(event) => updateVoiceReview(`${key}Actual`, event.target.value)}
                placeholder="Actual result"
                style={{ background: 'var(--surface-2)', color: 'white', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 10 }}
              />
              <select
                aria-label={`${label} verdict`}
                value={voiceReview[`${key}Verdict`] ?? 'pending'}
                onChange={(event) => updateVoiceReview(`${key}Verdict`, event.target.value)}
                style={{ background: 'var(--surface-2)', color: 'white', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 10 }}
              >
                <option value="pending">pending</option>
                <option value="pass">pass</option>
                <option value="needs_fix">needs_fix</option>
                <option value="reject">reject</option>
              </select>
              <input
                aria-label={`${label} notes`}
                value={voiceReview[`${key}Notes`] ?? ''}
                onChange={(event) => updateVoiceReview(`${key}Notes`, event.target.value)}
                placeholder="Notes"
                style={{ background: 'var(--surface-2)', color: 'white', border: '1px solid var(--surface-border)', borderRadius: 10, padding: 10 }}
              />
            </div>
          ))}
        </div>
      </section>

      {(message || error) && (
        <p role={error ? 'alert' : 'status'} style={{ marginTop: 14, color: error ? '#FFB2B2' : 'var(--text-secondary)' }}>
          {error || message}
        </p>
      )}
    </div>
  );
};

export default ListeningQaPage;
