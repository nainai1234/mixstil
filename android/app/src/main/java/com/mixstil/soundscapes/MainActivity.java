package com.mixstil.soundscapes;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeMediaSessionPlugin.class);
        registerPlugin(SoundfontPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
