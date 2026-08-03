import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, Mic, Activity, CheckCircle2 } from 'lucide-react';
import { useAudioMixer } from '../context/AudioMixerContext';
import { api } from '../lib/api';
import AudioRecipeModal from '../components/AudioRecipeModal';

const AIPromptPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.quickCreate>> | null>(null);
  const { loadCustomTracks } = useAudioMixer();

  const suggestedPrompts = [
    "I'm feeling very stressed and need 10 minutes of deep relaxation to fall asleep.",
    "Morning reset with light nature sounds and a steady warm music bed.",
    "Focus mode: 25 minutes with steady rain and low distraction.",
    "Five minutes of steady box breathing with a quiet ambient bed.",
    "Power nap: 20 minutes of pink noise fading into gentle wake-up chimes.",
    "Reading time: 1 hour of ambient coffee shop sounds with soft piano.",
    "Deep work: 45 minutes of brown noise and a low ambient drone.",
    "Yoga flow: 30 minutes of Tibetan bowls and flowing river sounds.",
    "Three minutes of gentle grounding and slow breathing.",
    "Digital detox: 15 minutes of pure forest ambience, no voice."
  ];

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    
    setGenerationStep(1);
    try {
      const generated = await api.quickCreate({ prompt, durationSeconds: 900 });
      setGenerationStep(3);
      loadCustomTracks(generated.tracks);
      localStorage.setItem('draft_mix_id', generated.mix.id);
      setResult(generated);
      setIsGenerating(false);
    } catch (error) {
      console.warn('AI recipe generation failed:', error);
      setIsGenerating(false);
      setGenerationStep(0);
    }
  };

  if (isGenerating) {
    return (
      <div style={{ padding: 'var(--space-6)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
           <div style={{ 
             width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #8C6AFF 0%, #00F0FF 100%)',
             display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: 'var(--space-6)',
             boxShadow: '0 0 40px rgba(140, 106, 255, 0.4)', animation: 'pulse 2s infinite'
           }}>
             <Sparkles size={32} fill="white" />
           </div>
           <h2 style={{ fontSize: '24px', marginBottom: 'var(--space-2)' }}>MixStil AI Copilot</h2>
           <p className="text-secondary">Crafting your personalized soundscape...</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 300, margin: '0 auto', width: '100%' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: generationStep >= 0 ? 1 : 0.3 }}>
            {generationStep > 0 ? <CheckCircle2 size={20} className="text-primary" /> : <Loader2 size={20} className="animate-spin text-primary" />}
            <span style={{ fontSize: 14 }}>Analyzing emotional intent...</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: generationStep >= 1 ? 1 : 0.3 }}>
            {generationStep > 1 ? <CheckCircle2 size={20} className="text-primary" /> : (generationStep === 1 ? <Loader2 size={20} className="animate-spin text-primary" /> : <Mic size={20} className="text-secondary" />)}
            <span style={{ fontSize: 14 }}>Matching your scene and listening goal...</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: generationStep >= 2 ? 1 : 0.3 }}>
            {generationStep > 2 ? <CheckCircle2 size={20} className="text-primary" /> : (generationStep === 2 ? <Loader2 size={20} className="animate-spin text-primary" /> : <Activity size={20} className="text-secondary" />)}
            <span style={{ fontSize: 14 }}>Selecting licensed sound stems...</span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-6)', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {result && (
        <AudioRecipeModal
          onClose={() => setResult(null)}
          prompt={prompt}
          result={result}
        />
      )}
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: 'var(--space-2)' }} className="text-gradient-primary">
          What do you need today?
        </h2>
        <p className="text-secondary text-sm">
          Describe your mood, goal, or the exact audio you want. The AI Copilot will generate a complete timeline for you to fine-tune.
        </p>
      </header>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <textarea 
          className="glass-panel"
          style={{ 
            width: '100%', minHeight: 140, padding: 'var(--space-4)', fontSize: '16px', 
            background: 'var(--surface-1)', color: 'white', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg)', resize: 'none', marginBottom: 'var(--space-4)'
          }}
          placeholder="e.g. 'I need 10 minutes of gentle bedtime audio with quiet room tone and warm music...'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 600, opacity: prompt ? 1 : 0.5 }}
          onClick={handleGenerate}
          disabled={!prompt}
        >
          <Sparkles size={20} style={{ marginRight: 8 }} />
          Generate AI Mix
          <ArrowRight size={20} style={{ marginLeft: 'auto' }} />
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Inspiration (Top 10 requests):</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingBottom: 'var(--space-6)' }}>
          {suggestedPrompts.map((p, i) => (
            <button 
              key={i}
              style={{ 
                textAlign: 'left', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'flex-start', gap: '8px'
              }}
              onClick={() => setPrompt(p)}
            >
              <span style={{ color: 'var(--primary)', opacity: 0.8 }}>✧</span>
              <span>"{p}"</span>
            </button>
          ))}
        </div>
      </div>

      {/* Global Style for Keyframe animation */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(140, 106, 255, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(140, 106, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(140, 106, 255, 0); }
        }
      `}</style>
    </div>
  );
};

export default AIPromptPage;
