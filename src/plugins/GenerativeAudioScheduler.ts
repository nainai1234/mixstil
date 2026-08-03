import { SoundfontPlayer } from './SoundfontPlayer';

export class GenerativeAudioScheduler {
  private timerId: any = null;
  private isPlaying = false;
  private currentNotes: Set<number> = new Set();
  
  // A simple ambient generative algorithm
  // Picks a random note from a pentatonic scale and plays it
  private pentatonicScale = [60, 62, 64, 67, 69, 72]; // C4, D4, E4, G4, A4, C5

  public async initialize(fontPath: string = 'assets/soundfonts/FluidR3_GM.sf2') {
    await SoundfontPlayer.load({ fontPath });
  }

  public play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.scheduleNextNote();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    
    // Turn off all currently playing notes
    for (const note of this.currentNotes) {
      SoundfontPlayer.noteOff({ note });
    }
    this.currentNotes.clear();
  }

  private scheduleNextNote() {
    if (!this.isPlaying) return;

    // 1. Pick a random note
    const note = this.pentatonicScale[Math.floor(Math.random() * this.pentatonicScale.length)];
    const velocity = 40 + Math.floor(Math.random() * 40); // 40-80 velocity for ambient
    
    // 2. Play it
    SoundfontPlayer.noteOn({ note, velocity }).catch(console.error);
    this.currentNotes.add(note);
    
    // 3. Schedule its noteOff
    const durationMs = 2000 + Math.random() * 4000; // Hold for 2-6 seconds
    setTimeout(() => {
      SoundfontPlayer.noteOff({ note }).catch(console.error);
      this.currentNotes.delete(note);
    }, durationMs);

    // 4. Schedule the next note onset
    const nextIntervalMs = 1000 + Math.random() * 3000; // Next note in 1-4 seconds
    this.timerId = setTimeout(() => {
      this.scheduleNextNote();
    }, nextIntervalMs);
  }
}
