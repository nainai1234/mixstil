package com.mixstil.soundscapes;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SoundfontPlayer")
public class SoundfontPlayerPlugin extends Plugin {

    private FluidSynthEngine engine;

    @Override
    public void load() {
        super.load();
        engine = new FluidSynthEngine();
    }

    @PluginMethod
    public void load(PluginCall call) {
        String fontPath = call.getString("fontPath");
        if (fontPath == null) {
            call.reject("Must provide fontPath");
            return;
        }

        try {
            engine.load(getContext(), fontPath);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to load soundfont: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void noteOn(PluginCall call) {
        Integer note = call.getInt("note");
        Integer velocity = call.getInt("velocity");
        
        if (note == null || velocity == null) {
            call.reject("Must provide note and velocity");
            return;
        }

        engine.noteOn(note, velocity);
        call.resolve();
    }

    @PluginMethod
    public void noteOff(PluginCall call) {
        Integer note = call.getInt("note");
        if (note == null) {
            call.reject("Must provide note");
            return;
        }

        engine.noteOff(note);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (engine != null) {
            engine.destroy();
        }
    }
}
