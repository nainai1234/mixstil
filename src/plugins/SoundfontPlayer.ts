import { registerPlugin } from '@capacitor/core';

export interface SoundfontPlayerPlugin {
  /**
   * Initializes the audio engine and loads a SoundFont file.
   * @param options Object containing the path to the .sf2 file relative to the public/assets directory.
   */
  load(options: { fontPath: string }): Promise<void>;

  /**
   * Sends a MIDI Note On message.
   * @param options Object containing note (0-127) and velocity (0-127).
   */
  noteOn(options: { note: number; velocity: number }): Promise<void>;

  /**
   * Sends a MIDI Note Off message.
   * @param options Object containing note (0-127).
   */
  noteOff(options: { note: number }): Promise<void>;
}

export const SoundfontPlayer = registerPlugin<SoundfontPlayerPlugin>('SoundfontPlayer');
