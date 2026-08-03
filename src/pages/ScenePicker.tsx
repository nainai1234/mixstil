import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Brain, Check, Loader2, Mic2, Moon, Sparkles, Timer, Waves } from 'lucide-react';
import { api } from '../lib/api';
import type { CatalogScene, ProductGoal, ProductScene } from '../lib/domain';
import { useAudioMixer } from '../context/AudioMixerContext';
import AudioRecipeModal from '../components/AudioRecipeModal';

const goalOptions: Array<{
  id: ProductGoal;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { id: 'sleep', label: 'Sleep', description: 'Bedtime and return-to-sleep soundscapes', icon: <Moon size={20} /> },
  { id: 'calm', label: 'Calm', description: 'Breathing and emotional settling sessions', icon: <Waves size={20} /> },
  { id: 'focus', label: 'Focus', description: 'Steady background audio for deep work', icon: <Brain size={20} /> },
];

const fallbackScenes: CatalogScene[] = [
  { id: 'bedtime', goal: 'sleep', name: 'Bedtime', defaultDurationSeconds: 1800 },
  { id: 'return_to_sleep', goal: 'sleep', name: 'Return to Sleep', defaultDurationSeconds: 900 },
  { id: 'breathing', goal: 'calm', name: 'Mindful Breathing', defaultDurationSeconds: 600 },
  { id: 'emotional_settling', goal: 'calm', name: 'Emotional Settling', defaultDurationSeconds: 1200 },
  { id: 'deep_focus', goal: 'focus', name: 'Deep Focus', defaultDurationSeconds: 1500 },
];

const durationOptions = [300, 600, 900, 1500, 1800, 3600];

const ScenePicker: React.FC = () => {
  const { preparePlayback } = useAudioMixer();
  const [goal, setGoal] = useState<ProductGoal>('sleep');
  const [scene, setScene] = useState<ProductScene>('bedtime');
  const [durationSeconds, setDurationSeconds] = useState(1800);
  const [prompt, setPrompt] = useState('');
  const [guidedVoice, setGuidedVoice] = useState(false);
  const [environmentIntensity, setEnvironmentIntensity] = useState(50);
  const [musicIntensity, setMusicIntensity] = useState(50);
  const [voiceIntensity, setVoiceIntensity] = useState(50);
  const [scenes, setScenes] = useState<CatalogScene[]>(fallbackScenes);
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.quickCreate>> | null>(null);
  const [resultJourney, setResultJourney] = useState<{ id: string; startedAt: number } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ prompt?: string }>({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.getContentCatalog()
      .then((catalog) => setScenes(catalog.scenes))
      .catch((requestError) => {
        console.warn('Content catalog unavailable; using local scene labels:', requestError);
      });
  }, []);

  const visibleScenes = useMemo(() => scenes.filter((item) => item.goal === goal), [goal, scenes]);

  useEffect(() => {
    const defaultScene = visibleScenes[0];
    if (defaultScene && !visibleScenes.some((item) => item.id === scene)) {
      setScene(defaultScene.id);
      setDurationSeconds(defaultScene.defaultDurationSeconds);
    }
  }, [goal, scene, visibleScenes]);

  const selectedScene = scenes.find((item) => item.id === scene);
  const promptHasError = Boolean(fieldErrors.prompt);
  const submitHasError = Boolean(submitError);

  const clearErrors = () => {
    setFieldErrors({});
    setSubmitError('');
  };

  const handleCreate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setFieldErrors({ prompt: 'Describe the sound to continue.' });
      setSubmitError('');
      return;
    }

    const journeyId = `qc_${crypto.randomUUID()}`;
    const journeyStartedAt = Date.now();
    preparePlayback();
    setIsCreating(true);
    clearErrors();
    try {
      const result = await api.quickCreate({
        goal,
        scene,
        prompt: trimmedPrompt,
        durationSeconds,
        guidedVoice,
        environmentIntensity,
        musicIntensity,
        voiceIntensity,
      });
      const recipeReadyMs = Date.now() - journeyStartedAt;
      api.recordPlaybackEvents(result.mix.id, journeyId, [
        { type: 'quick_create_started', elapsedMs: 0, details: { source: 'scene_picker' } },
        { type: 'recipe_ready', elapsedMs: recipeReadyMs, details: { trackCount: result.tracks.length } },
      ]).catch((metricsError) => console.warn('Could not record Quick Create timing:', metricsError));
      localStorage.setItem('draft_mix_id', result.mix.id);
      setResultJourney({ id: journeyId, startedAt: journeyStartedAt });
      setResult(result);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Could not create a soundscape.';
      setSubmitError(message === 'Failed to fetch'
        ? 'Live Mix service is unreachable right now. Try again after the backend responds.'
        : message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {result && (
        <AudioRecipeModal
          onClose={() => {
            setResult(null);
            setResultJourney(null);
          }}
          prompt={result.mix.recipeData.quickCreate?.prompt ?? prompt}
          result={result}
          journey={resultJourney}
        />
      )}
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Link to="/studio" className="btn-icon" style={{ background: 'transparent' }}>
          <ArrowLeft size={24} />
        </Link>
        <div>
          <span className="text-xs text-secondary">Quick Create</span>
          <h2 style={{ fontSize: 22 }}>New Soundscape</h2>
        </div>
      </header>

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Goal</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {goalOptions.map((option) => {
            const isActive = goal === option.id;
            return (
              <button
                key={option.id}
                onClick={() => {
                  setGoal(option.id);
                  if (promptHasError || submitHasError) clearErrors();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  padding: 14, borderRadius: 12, cursor: 'pointer',
                  background: isActive ? 'rgba(140, 106, 255, 0.18)' : 'var(--surface-1)',
                  border: isActive ? '1px solid rgba(140, 106, 255, 0.65)' : '1px solid var(--surface-border)',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--primary)' }}>
                  {option.icon}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{option.label}</span>
                  <span className="text-xs text-secondary">{option.description}</span>
                </span>
                {isActive && <Check size={18} color="var(--primary)" />}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Scene</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {visibleScenes.map((item) => {
            const isActive = scene === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setScene(item.id);
                  setDurationSeconds(item.defaultDurationSeconds);
                  if (promptHasError || submitHasError) clearErrors();
                }}
                style={{
                  padding: '10px 12px', borderRadius: 999, cursor: 'pointer',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                  background: isActive ? 'rgba(140, 106, 255, 0.18)' : 'var(--surface-1)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                }}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Duration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {durationOptions.map((seconds) => {
            const isActive = durationSeconds === seconds;
            return (
              <button
                key={seconds}
                onClick={() => {
                  setDurationSeconds(seconds);
                  if (promptHasError || submitHasError) clearErrors();
                }}
                style={{
                  minHeight: 44, borderRadius: 10, cursor: 'pointer',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--surface-border)',
                  background: isActive ? 'rgba(0, 240, 255, 0.12)' : 'var(--surface-1)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  fontWeight: 700,
                }}
              >
                {Math.round(seconds / 60)}m
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Description</h3>
        <textarea
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            if (promptHasError || submitHasError) clearErrors();
          }}
          placeholder="e.g. gentle rain, very low stimulation, no sudden sounds"
          aria-invalid={promptHasError}
          style={{
            width: '100%', minHeight: 96, padding: 14, resize: 'none',
            borderRadius: 12, background: 'var(--surface-1)',
            border: promptHasError ? '1px solid rgba(255, 75, 75, 0.85)' : '1px solid var(--surface-border)',
            boxShadow: promptHasError ? '0 0 0 1px rgba(255, 75, 75, 0.25) inset' : 'none',
            color: 'white', fontSize: 15, outline: 'none',
          }}
        />
        {promptHasError && (
          <p role="alert" className="text-xs" style={{ marginTop: 8, color: '#FFB2B2' }}>
            {fieldErrors.prompt}
          </p>
        )}
      </section>

      <button
        onClick={() => {
          setGuidedVoice((value) => !value);
          if (promptHasError || submitHasError) clearErrors();
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 14, borderRadius: 12, border: '1px solid var(--surface-border)',
          background: 'var(--surface-1)', color: 'var(--text-primary)', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mic2 size={18} color="var(--primary)" />
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Guided voice draft</span>
            <span className="text-xs text-secondary">Marked in the recipe; controlled TTS comes after voice QA.</span>
          </span>
        </span>
        <span style={{ width: 42, height: 24, borderRadius: 999, background: guidedVoice ? 'var(--primary)' : 'var(--surface-2)', position: 'relative', transition: 'all 0.2s' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: guidedVoice ? 20 : 2, transition: 'all 0.2s' }} />
        </span>
      </button>

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Layer Strength</h3>
        {[
          ['Environment', environmentIntensity, setEnvironmentIntensity],
          ['Music', musicIntensity, setMusicIntensity],
          ['Voice', voiceIntensity, setVoiceIntensity],
        ].map(([label, value, setter]) => (
          <label key={label as string} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 36px', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13 }}>
            <span>{label as string}</span>
            <input type="range" min="0" max="100" value={value as number} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value))} />
            <span className="text-xs text-secondary">{value as number}</span>
          </label>
        ))}
      </section>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
          <Timer size={14} />
          <span>{selectedScene?.name ?? 'Selected scene'} uses approved catalog stems only.</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={isCreating}
          style={{
            width: '100%',
            padding: 16,
            fontSize: 16,
            fontWeight: 800,
            border: submitHasError ? '1px solid rgba(255, 75, 75, 0.55)' : 'none',
            background: submitHasError ? 'rgba(255, 75, 75, 0.18)' : undefined,
            boxShadow: submitHasError ? '0 0 0 1px rgba(255, 75, 75, 0.2) inset' : undefined,
          }}
        >
          {isCreating ? <Loader2 size={20} className="animate-spin" style={{ marginRight: 8 }} /> : <Sparkles size={20} style={{ marginRight: 8 }} />}
          Create Live Mix
        </button>
        {submitHasError && (
          <div
            role="alert"
            style={{
              background: 'rgba(255, 75, 75, 0.12)',
              border: '1px solid rgba(255, 75, 75, 0.35)',
              color: '#FFB2B2',
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {submitError}
          </div>
        )}
        <Link to="/creator/create/template" className="text-sm" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          Browse approved recipes
        </Link>
      </div>
    </div>
  );
};

export default ScenePicker;
