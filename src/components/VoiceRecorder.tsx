import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Check, Pause } from 'lucide-react';
import { useAudioMixer } from '../context/AudioMixerContext';

const VoiceRecorder: React.FC<{ onAdded: () => void }> = ({ onAdded }) => {
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'review'>('idle');
  const [time, setTime] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<any>(null);
  
  const { addTrack } = useAudioMixer();

  // Handle timer
  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = setInterval(() => setTime((prev) => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current);
          const url = URL.createObjectURL(blob);
          setRecordedUrl(url);
          setState('review');
        } catch (e) {
          console.error("Failed to create blob/url:", e);
          alert("Failed to process recording on this browser.");
        }
        // Stop all tracks to free microphone
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(200); // collect 200ms chunks
      setState('recording');
      setTime(0);
    } catch (err) {
      alert("Could not access microphone. Please allow permissions.");
      console.error(err);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (state === 'recording' || state === 'paused')) {
      mediaRecorderRef.current.stop();
    }
  };

  const resetRecording = () => {
    setRecordedUrl(null);
    setState('idle');
    setTime(0);
  };

  const confirmRecording = () => {
    if (!recordedUrl) return;
    addTrack({
      id: Date.now(),
      name: `My Voice (${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`,
      url: recordedUrl,
      volume: 100,
      isMuted: false,
      startTime: 0,
      duration: time,
      sourceDuration: time,
      trimStart: 0,
      trimEnd: time,
      tags: ['Recorded Voice']
    });
    onAdded();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4) 0', minHeight: 280 }}>
      {state === 'idle' && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ 
            width: '100%', maxWidth: 300, background: 'var(--surface-2)', padding: 'var(--space-6)', 
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)'
          }}>
            <button 
              onClick={startRecording}
              style={{ 
                width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #FF3C3C 0%, #FF6B6B 100%)', 
                border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(255, 60, 60, 0.4), inset 0 -4px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer', transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            >
              <Mic size={28} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Ready to Record</p>
              <p className="text-secondary text-xs">Tap the mic to start capturing your voice.</p>
            </div>
          </div>
        </div>
      )}

      {(state === 'recording' || state === 'paused') && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 300 }}>
          <div style={{ 
            background: 'var(--surface-2)', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', 
            border: `1px solid ${state === 'recording' ? 'rgba(255, 60, 60, 0.3)' : 'var(--surface-border)'}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            boxShadow: state === 'recording' ? '0 0 40px rgba(255, 60, 60, 0.05)' : 'none',
            transition: 'all 0.3s'
          }}>
            <div style={{ 
              fontSize: 48, fontWeight: 300, marginBottom: 'var(--space-4)', 
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px',
              color: state === 'paused' ? 'var(--text-secondary)' : 'white'
            }}>
              {formatTime(time)}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, height: 32, marginBottom: 'var(--space-8)', opacity: state === 'paused' ? 0.3 : 1 }}>
              {Array.from({length: 15}).map((_, i) => (
                <div 
                  key={i} 
                  style={{ 
                    width: 3, background: 'rgb(255, 60, 60)', borderRadius: 2, 
                    height: state === 'recording' ? `${Math.max(15, Math.random() * 100)}%` : '15%',
                    transition: 'height 0.1s ease'
                  }} 
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'center' }}>
              {state === 'recording' ? (
                <button 
                  onClick={pauseRecording}
                  style={{ 
                    width: 54, height: 54, borderRadius: '50%', background: 'var(--surface-3)', 
                    border: '1px solid var(--surface-border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Pause size={24} fill="currentColor" />
                </button>
              ) : (
                <button 
                  onClick={resumeRecording}
                  style={{ 
                    width: 54, height: 54, borderRadius: '50%', background: 'rgba(255, 60, 60, 0.15)', 
                    border: '1px solid rgb(255, 60, 60)', color: 'rgb(255, 60, 60)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Mic size={24} />
                </button>
              )}
              
              <button 
                onClick={stopRecording}
                style={{ 
                  width: 54, height: 54, borderRadius: '50%', background: 'var(--surface-3)', 
                  border: '1px solid var(--surface-border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Square size={20} fill="currentColor" />
              </button>
            </div>
            <p className="text-xs text-secondary" style={{ marginTop: 'var(--space-4)' }}>
              {state === 'recording' ? 'Recording in progress...' : 'Recording paused'}
            </p>
          </div>
        </div>
      )}

      {state === 'review' && (
        <div style={{ width: '100%', maxWidth: 300, textAlign: 'center' }}>
          <div style={{ background: 'var(--surface-2)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', marginBottom: 'var(--space-4)' }}>
             <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 16, fontWeight: 600 }}>Review Recording</h3>
             <div style={{ background: 'var(--surface-1)', padding: '12px 16px', borderRadius: 12, marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <audio ref={audioRef} src={recordedUrl || ''} controls style={{ width: '100%', height: 36 }} />
             </div>
  
             <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
               <button 
                 className="btn" 
                 style={{ background: 'var(--surface-3)', color: 'white', flex: 1, padding: '10px' }}
                 onClick={resetRecording}
               >
                 <Trash2 size={16} style={{ marginRight: 6 }} /> Retake
               </button>
               <button 
                 className="btn btn-primary" 
                 style={{ flex: 1.5, padding: '10px' }}
                 onClick={confirmRecording}
               >
                 <Check size={16} style={{ marginRight: 6 }} /> Use Audio
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
