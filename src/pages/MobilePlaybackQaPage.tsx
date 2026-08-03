import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Clipboard, ExternalLink, RefreshCw, RotateCcw, Save, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type RunId = 'ios30' | 'ios60' | 'ios90' | 'ios120' | 'android30' | 'android60' | 'android90' | 'android120';

type MobilePlaybackQaRun = {
  id: RunId;
  label: string;
  device: 'iPhone' | 'Android';
  runtime: 'Installed iOS app' | 'Installed Android app';
  durationMinutes: number;
  checkpointSeconds: number;
  interruption: string;
};

type MobilePlaybackQaReview = {
  osVersion: string;
  appVersion: string;
  mixId: string;
  journeyId: string;
  lockScreenControls: boolean;
  backgroundPlayback: boolean;
  interruptionRecovered: boolean;
  nativeMediaSessionReady: boolean;
  checkpointRecorded: boolean;
  noUnexplainedSilence: boolean;
  recipePositionStable: boolean;
  deviceVerifierEvidence: string;
  verdict: 'pending' | 'pass' | 'needs_fix' | 'fail';
  notes: string;
  telemetryCheckedAt: string;
};

const runs: MobilePlaybackQaRun[] = [
  { id: 'ios30', label: 'iOS 30', device: 'iPhone', runtime: 'Installed iOS app', durationMinutes: 30, checkpointSeconds: 1800, interruption: 'none' },
  { id: 'ios60', label: 'iOS 60', device: 'iPhone', runtime: 'Installed iOS app', durationMinutes: 60, checkpointSeconds: 3600, interruption: 'notification or call' },
  { id: 'ios90', label: 'iOS 90', device: 'iPhone', runtime: 'Installed iOS app', durationMinutes: 90, checkpointSeconds: 5400, interruption: 'headphone or Bluetooth change' },
  { id: 'ios120', label: 'iOS 120', device: 'iPhone', runtime: 'Installed iOS app', durationMinutes: 120, checkpointSeconds: 7200, interruption: 'none' },
  { id: 'android30', label: 'Android 30', device: 'Android', runtime: 'Installed Android app', durationMinutes: 30, checkpointSeconds: 1800, interruption: 'none' },
  { id: 'android60', label: 'Android 60', device: 'Android', runtime: 'Installed Android app', durationMinutes: 60, checkpointSeconds: 3600, interruption: 'notification or call' },
  { id: 'android90', label: 'Android 90', device: 'Android', runtime: 'Installed Android app', durationMinutes: 90, checkpointSeconds: 5400, interruption: 'headphone or Bluetooth change' },
  { id: 'android120', label: 'Android 120', device: 'Android', runtime: 'Installed Android app', durationMinutes: 120, checkpointSeconds: 7200, interruption: 'none' },
];

const storageKey = 'snooze_mobile_playback_qa_v1';

const emptyReview = (): MobilePlaybackQaReview => ({
  osVersion: '',
  appVersion: '',
  mixId: '',
  journeyId: '',
  lockScreenControls: false,
  backgroundPlayback: false,
  interruptionRecovered: false,
  nativeMediaSessionReady: false,
  checkpointRecorded: false,
  noUnexplainedSilence: false,
  recipePositionStable: false,
  deviceVerifierEvidence: '',
  verdict: 'pending',
  notes: '',
  telemetryCheckedAt: '',
});

const loadReviews = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Record<string, MobilePlaybackQaReview & { browserVersion?: string }>;
    return Object.fromEntries(Object.entries(stored).map(([id, review]) => [id, {
      ...review,
      appVersion: review.appVersion || review.browserVersion || '',
    }])) as Record<RunId, MobilePlaybackQaReview>;
  } catch {
    return {} as Record<RunId, MobilePlaybackQaReview>;
  }
};

const isPassing = (review: MobilePlaybackQaReview) => (
  review.verdict === 'pass'
  && review.lockScreenControls
  && review.backgroundPlayback
  && review.interruptionRecovered
  && review.nativeMediaSessionReady
  && review.checkpointRecorded
  && review.noUnexplainedSilence
  && review.recipePositionStable
);

const MobilePlaybackQaPage: React.FC = () => {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Record<RunId, MobilePlaybackQaReview>>(() => loadReviews());
  const [selectedId, setSelectedId] = useState<RunId>('ios30');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [creatingMix, setCreatingMix] = useState(false);
  const [checkingTelemetry, setCheckingTelemetry] = useState(false);
  const selectedRun = runs.find((run) => run.id === selectedId) ?? runs[0];
  const selectedReview = reviews[selectedRun.id] ?? emptyReview();
  const passCount = runs.filter((run) => isPassing(reviews[run.id] ?? emptyReview())).length;

  const markdown = useMemo(() => {
    const rows = runs.map((run) => {
      const review = reviews[run.id] ?? emptyReview();
      const deviceEvidence = review.deviceVerifierEvidence.trim()
        ? review.deviceVerifierEvidence.replace(/\n/g, ' ').replace(/\|/g, '\\|')
        : '';
      return `| ${run.label} | ${run.device} | ${run.runtime} | ${run.durationMinutes} | ${run.checkpointSeconds} | ${review.mixId} | ${review.journeyId} | ${review.lockScreenControls ? 'yes' : 'no'} | ${review.backgroundPlayback ? 'yes' : 'no'} | ${review.interruptionRecovered ? 'yes' : 'no'} | ${review.nativeMediaSessionReady ? 'yes' : 'no'} | ${review.checkpointRecorded ? 'yes' : 'no'} | ${review.noUnexplainedSilence ? 'yes' : 'no'} | ${review.recipePositionStable ? 'yes' : 'no'} | ${deviceEvidence} | ${review.verdict} | ${review.notes.replace(/\n/g, ' ')} |`;
    }).join('\n');
    return `# Mobile Playback Device QA

Date: ${new Date().toISOString()}
Pass count: ${passCount}/${runs.length}

| Run | Device | Runtime | Duration min | Checkpoint sec | Mix ID | Journey ID | Lock controls | Background | Interruption | Native session | Checkpoint | No silence | Position stable | Device verifier evidence | Verdict | Notes |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`;
  }, [passCount, reviews]);

  const updateReview = (patch: Partial<MobilePlaybackQaReview>) => {
    const next = {
      ...reviews,
      [selectedRun.id]: { ...selectedReview, ...patch },
    };
    setReviews(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setMessage('');
    setError('');
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown);
    setMessage('Mobile playback QA markdown copied.');
  };

  const saveMarkdown = async () => {
    setMessage('');
    setError('');
    try {
      await api.saveListeningQaResults({ markdown, status: passCount === runs.length ? 'final' : 'draft' });
      setMessage('Mobile playback QA report saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save mobile playback QA report.');
    }
  };

  const createSelectedMix = async () => {
    if (creatingMix) return;
    setCreatingMix(true);
    setMessage('');
    setError('');
    try {
      const journeyId = `deviceqa_${selectedRun.id}_${Date.now()}`;
      const prompt = selectedRun.device === 'iPhone'
        ? 'Create a steady sleep soundscape for installed iPhone app background playback testing. No voices, no sudden sounds, and no harsh high frequencies.'
        : 'Create a steady sleep soundscape for installed Android app background playback testing. No voices, no sudden sounds, and no harsh high frequencies.';
      const generated = await api.quickCreate({
        prompt,
        goal: 'sleep',
        durationSeconds: selectedRun.durationMinutes * 60,
        guidedVoice: false,
      }, { internalMobilePlaybackQa: true });
      updateReview({
        mixId: generated.mix.id,
        journeyId,
        verdict: 'pending',
        notes: selectedReview.notes || `QA mix created for ${selectedRun.durationMinutes} minute ${selectedRun.runtime} run.`,
      });
      setMessage(`Created ${selectedRun.label} QA mix.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create QA mix.');
    } finally {
      setCreatingMix(false);
    }
  };

  const openSelectedPlayer = () => {
    const mixId = selectedReview.mixId.trim();
    if (!mixId) {
      setError('Enter a mixId before opening the player.');
      return;
    }
    const journeyId = selectedReview.journeyId.trim() || `deviceqa_${selectedRun.id}_${Date.now()}`;
    if (!selectedReview.journeyId.trim()) updateReview({ journeyId });
    const params = new URLSearchParams({
      mixId,
      journeyId,
      journeyStartedAt: String(Date.now()),
      cohort: 'deviceqa',
      participant: selectedRun.id,
    });
    window.open(`/player?${params.toString()}`, '_blank');
  };

  const verifyTelemetry = async () => {
    const journeyId = selectedReview.journeyId.trim();
    if (!journeyId || checkingTelemetry) {
      if (!journeyId) setError('Enter a journeyId before verifying telemetry.');
      return;
    }
    setCheckingTelemetry(true);
    setMessage('');
    setError('');
    try {
      const result = await api.getPlaybackJourneyEvents(journeyId);
      const nativeReady = result.events.some((event) => event.type === 'native_media_session_ready');
      const checkpointRecorded = result.events.some((event) => (
        event.type === 'playback_checkpoint'
        && Number(event.details?.checkpointSeconds) === selectedRun.checkpointSeconds
      ));
      const failures = result.events.filter((event) => event.type === 'playback_failed' || event.type === 'native_media_session_failed');
      const failureSummary = failures.map((event) => String(event.details?.reason ?? event.type)).join(', ');
      const failureNote = failureSummary ? `Telemetry failure: ${failureSummary}` : '';
      updateReview({
        nativeMediaSessionReady: nativeReady,
        checkpointRecorded,
        telemetryCheckedAt: new Date().toISOString(),
        verdict: failures.length ? 'needs_fix' : selectedReview.verdict,
        notes: failureNote && !selectedReview.notes.includes(failureNote)
          ? [selectedReview.notes, failureNote].filter(Boolean).join('\n')
          : selectedReview.notes,
      });
      setMessage(`Telemetry checked: native session ${nativeReady ? 'ready' : 'not ready'}, checkpoint ${checkpointRecorded ? 'recorded' : 'not recorded'}, failures ${failures.length}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not verify playback telemetry.');
    } finally {
      setCheckingTelemetry(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)', padding: '24px 18px 40px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back" style={{ width: 40, height: 40, background: 'var(--surface-1)' }}><ArrowLeft size={18} /></button>
        <div style={{ flex: 1 }}>
          <p className="text-xs text-secondary">Sprint 1 QA</p>
          <h1 style={{ fontSize: 23, margin: 0 }}>Mobile Playback QA</h1>
        </div>
        <span className="text-sm text-secondary">{passCount}/{runs.length}</span>
      </header>

      <section style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
        {runs.map((run) => {
          const review = reviews[run.id] ?? emptyReview();
          return (
            <button key={run.id} type="button" onClick={() => setSelectedId(run.id)} style={{ minHeight: 58, borderRadius: 8, border: run.id === selectedRun.id ? '1px solid var(--primary)' : '1px solid var(--surface-border)', background: run.id === selectedRun.id ? 'rgba(140,106,255,0.16)' : 'var(--surface-1)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', textAlign: 'left' }}>
              <Smartphone size={18} color="var(--primary)" />
              <span style={{ flex: 1 }}>
                <strong style={{ display: 'block' }}>{run.label}</strong>
                <small className="text-secondary">{run.runtime} · {run.durationMinutes} min · checkpoint {run.checkpointSeconds}s</small>
              </span>
              {isPassing(review) && <Check size={18} color="var(--primary)" />}
            </button>
          );
        })}
      </section>

      <section className="glass-panel" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>{selectedRun.label}</h2>
        <p className="text-sm text-secondary" style={{ marginBottom: 14 }}>{selectedRun.device} · {selectedRun.runtime} · interruption: {selectedRun.interruption}</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {(['osVersion', 'appVersion', 'mixId', 'journeyId'] as const).map((field) => (
            <input key={field} value={selectedReview[field]} onChange={(event) => updateReview({ [field]: event.target.value })} placeholder={field} aria-label={field} style={{ height: 42, borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 11px' }} />
          ))}
          {([
            ['lockScreenControls', 'Lock-screen controls worked'],
            ['backgroundPlayback', 'Background playback continued'],
            ['interruptionRecovered', 'Interruption recovered at same position'],
            ['nativeMediaSessionReady', 'Native media session ready'],
            ['checkpointRecorded', `Checkpoint ${selectedRun.checkpointSeconds}s recorded`],
            ['noUnexplainedSilence', 'No unexplained silence'],
            ['recipePositionStable', 'Recipe position stable within 5s'],
          ] as const).map(([field, label]) => (
            <label key={field} style={{ minHeight: 36, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={selectedReview[field]} onChange={(event) => updateReview({ [field]: event.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
          <select value={selectedReview.verdict} onChange={(event) => updateReview({ verdict: event.target.value as MobilePlaybackQaReview['verdict'] })} aria-label="Verdict" style={{ height: 42, borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: '0 11px' }}>
            <option value="pending">Pending</option>
            <option value="pass">Pass</option>
            <option value="needs_fix">Needs fix</option>
            <option value="fail">Fail</option>
          </select>
          <textarea value={selectedReview.notes} onChange={(event) => updateReview({ notes: event.target.value })} placeholder="Notes" rows={4} style={{ borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: 11, resize: 'vertical' }} />
          <textarea value={selectedReview.deviceVerifierEvidence} onChange={(event) => updateReview({ deviceVerifierEvidence: event.target.value })} placeholder="Device verifier JSON" rows={4} style={{ borderRadius: 8, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', color: 'var(--text-primary)', padding: 11, resize: 'vertical' }} />
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={copyMarkdown}><Clipboard size={16} /> Copy report</button>
        <button className="btn btn-secondary" onClick={createSelectedMix} disabled={creatingMix}><Smartphone size={16} /> {creatingMix ? 'Creating...' : 'Create mix'}</button>
        <button className="btn btn-secondary" onClick={openSelectedPlayer}><ExternalLink size={16} /> Open player</button>
        <button className="btn btn-secondary" onClick={verifyTelemetry} disabled={checkingTelemetry}><RefreshCw size={16} /> {checkingTelemetry ? 'Checking...' : 'Verify telemetry'}</button>
        <button className="btn btn-primary" onClick={saveMarkdown}><Save size={16} /> Save report</button>
        <button className="btn btn-secondary" onClick={() => { window.localStorage.removeItem(storageKey); setReviews({} as Record<RunId, MobilePlaybackQaReview>); }}><RotateCcw size={16} /> Reset</button>
        
        {/* Test Native Soundfont Button */}
        <button className="btn btn-secondary" onClick={async () => {
           try {
             const { GenerativeAudioScheduler } = await import('../plugins/GenerativeAudioScheduler');
             const scheduler = new GenerativeAudioScheduler();
             await scheduler.initialize();
             scheduler.play();
             alert('Native Soundfont Engine started! (Playing pentatonic ambient notes in background)');
           } catch (e: any) {
             alert('Failed to start Native Soundfont Engine: ' + e.message);
           }
        }}>
          🎵 Test Native Soundfont
        </button>
      </div>
      {message && <p className="text-sm" style={{ color: 'var(--primary)', marginTop: 12 }}>{message}</p>}
      {error && <p role="alert" style={{ color: '#ffd3d3', marginTop: 12 }}>{error}</p>}
    </main>
  );
};

export default MobilePlaybackQaPage;
