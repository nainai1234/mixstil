import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

type NativeMediaAction = {
  action: 'play' | 'pause' | 'stop' | 'seek' | 'state' | 'ended' | 'stopped' | 'error';
  positionSeconds: number;
  durationSeconds?: number;
  playing?: boolean;
  prepared?: boolean;
  error?: string;
};

type NativePlaybackState = {
  audioUrl: string;
  positionSeconds: number;
  durationSeconds: number;
  playing: boolean;
  prepared: boolean;
};

type NativeMediaSessionPlugin = {
  prepare(input: {
    audioUrl: string;
    title: string;
    playing: boolean;
    durationSeconds: number;
    positionSeconds: number;
  }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(input: { positionSeconds: number }): Promise<void>;
  getState(): Promise<NativePlaybackState>;
  update(input: {
    title: string;
    playing: boolean;
    durationSeconds: number;
    positionSeconds: number;
  }): Promise<void>;
  clear(): Promise<void>;
  addListener(eventName: 'action', listener: (event: NativeMediaAction) => void): Promise<PluginListenerHandle>;
};

const plugin = registerPlugin<NativeMediaSessionPlugin>('NativeMediaSession');

export const hasNativeMediaSession = () => ['android', 'ios'].includes(Capacitor.getPlatform());
export const hasNativeAudioPlayback = () => ['android', 'ios'].includes(Capacitor.getPlatform());

export const prepareNativeAudio = (input: {
  audioUrl: string;
  title: string;
  playing: boolean;
  durationSeconds: number;
  positionSeconds: number;
}) => plugin.prepare(input);

export const playNativeAudio = () => plugin.play();
export const pauseNativeAudio = () => plugin.pause();
export const seekNativeAudio = (positionSeconds: number) => plugin.seek({ positionSeconds });
export const getNativeAudioState = () => plugin.getState();

export const updateNativeMediaSession = (input: {
  title: string;
  playing: boolean;
  durationSeconds: number;
  positionSeconds: number;
}) => plugin.update(input);

export const clearNativeMediaSession = () => plugin.clear();

export const addNativeMediaActionListener = (listener: (event: NativeMediaAction) => void) => plugin.addListener('action', listener);
