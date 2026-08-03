package com.snooze.soundscapes;

import android.content.Context;

public class FluidSynthEngine {
    public void load(Context context, String fontPath) throws Exception {
        throw new UnsupportedOperationException("Native soundfont playback is disabled in the mobile release build.");
    }
    
    public void noteOn(int note, int velocity) {
    }
    
    public void noteOff(int note) {
    }
    
    public void destroy() {
    }
}
