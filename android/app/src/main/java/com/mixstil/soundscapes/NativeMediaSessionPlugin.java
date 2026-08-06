package com.mixstil.soundscapes;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeMediaSession")
public class NativeMediaSessionPlugin extends Plugin {
    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("action", intent.getStringExtra(MediaPlaybackService.EXTRA_MEDIA_ACTION));
                data.put("positionSeconds", intent.getDoubleExtra(MediaPlaybackService.EXTRA_POSITION_SECONDS, -1));
                data.put("durationSeconds", intent.getDoubleExtra(MediaPlaybackService.EXTRA_DURATION_SECONDS, 0));
                data.put("playing", intent.getBooleanExtra(MediaPlaybackService.EXTRA_PLAYING, false));
                data.put("prepared", intent.getBooleanExtra(MediaPlaybackService.EXTRA_PREPARED, false));
                data.put("error", intent.getStringExtra(MediaPlaybackService.EXTRA_ERROR));
                notifyListeners("action", data, true);
            }
        };
        ContextCompat.registerReceiver(
            getContext(),
            actionReceiver,
            new IntentFilter(MediaPlaybackService.ACTION_MEDIA_EVENT),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        String audioUrl = call.getString("audioUrl", "");
        if (audioUrl.isBlank()) {
            call.reject("audioUrl is required");
            return;
        }
        Intent intent = baseIntent(call)
            .setAction(MediaPlaybackService.ACTION_PREPARE)
            .putExtra(MediaPlaybackService.EXTRA_AUDIO_URL, audioUrl);
        startPlaybackService(intent);
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        startPlaybackService(new Intent(getContext(), MediaPlaybackService.class).setAction(MediaPlaybackService.ACTION_PLAY));
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        startPlaybackService(new Intent(getContext(), MediaPlaybackService.class).setAction(MediaPlaybackService.ACTION_PAUSE));
        call.resolve();
    }

    @PluginMethod
    public void seek(PluginCall call) {
        Intent intent = new Intent(getContext(), MediaPlaybackService.class)
            .setAction(MediaPlaybackService.ACTION_SEEK)
            .putExtra(MediaPlaybackService.EXTRA_POSITION_SECONDS, call.getDouble("positionSeconds", 0.0));
        startPlaybackService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject state = new JSObject();
        state.put("audioUrl", MediaPlaybackService.getCurrentAudioUrl());
        state.put("durationSeconds", MediaPlaybackService.getCurrentDurationSeconds());
        state.put("positionSeconds", MediaPlaybackService.getCurrentPositionSeconds());
        state.put("playing", MediaPlaybackService.isPlaying());
        state.put("prepared", MediaPlaybackService.isPrepared());
        call.resolve(state);
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = baseIntent(call).setAction(MediaPlaybackService.ACTION_UPDATE);
        startPlaybackService(intent);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MediaPlaybackService.class));
        call.resolve();
    }

    private Intent baseIntent(PluginCall call) {
        return new Intent(getContext(), MediaPlaybackService.class)
            .putExtra(MediaPlaybackService.EXTRA_TITLE, call.getString("title", "Personal sound"))
            .putExtra(MediaPlaybackService.EXTRA_PLAYING, call.getBoolean("playing", false))
            .putExtra(MediaPlaybackService.EXTRA_DURATION_SECONDS, call.getDouble("durationSeconds", 0.0))
            .putExtra(MediaPlaybackService.EXTRA_POSITION_SECONDS, call.getDouble("positionSeconds", 0.0));
    }

    private void startPlaybackService(Intent intent) {
        if (MediaPlaybackService.isRunning()) {
            getContext().startService(intent);
        } else {
            ContextCompat.startForegroundService(getContext(), intent);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (actionReceiver != null) {
            getContext().unregisterReceiver(actionReceiver);
            actionReceiver = null;
        }
    }
}
