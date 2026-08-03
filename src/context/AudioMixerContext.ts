import { createContext, useContext } from 'react';
import type { AudioTrackDef } from './AudioContext';

export interface AudioContextType {
  tracks: AudioTrackDef[];
  isPlaying: boolean;
  playbackError: string | null;
  playbackPosition: number;
  sessionDuration: number;
  preparePlayback: () => void;
  play: () => void;
  playFrom: (positionSeconds: number) => void;
  pause: () => void;
  seekTo: (positionSeconds: number) => void;
  togglePlay: () => void;
  toggleMute: (id: number) => void;
  updateVolume: (id: number, volume: number) => void;
  updateVolumeAutomation: (id: number, points: Array<{ atSeconds: number; volume: number }>) => void;
  refreshPlayback: () => void;
  updateTrackTime: (id: number, startTime: number, duration: number, trimStart?: number, trimEnd?: number) => void;
  addTrack: (track: AudioTrackDef) => void;
  removeTrack: (id: number) => void;
  stopAll: () => void;
  loadCustomTracks: (tracks: AudioTrackDef[]) => void;
}

export const MixerAudioContext = createContext<AudioContextType | null>(null);

export const useAudioMixer = () => {
  const context = useContext(MixerAudioContext);
  if (!context) throw new Error('useAudioMixer must be used within an AudioProvider');
  return context;
};
