package com.snooze.soundscapes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;

public class MediaPlaybackService extends Service {
    private static volatile boolean running = false;
    private static volatile boolean prepared = false;
    private static volatile boolean playing = false;
    private static volatile double currentPositionSeconds = 0;
    private static volatile double currentDurationSeconds = 0;
    private static volatile String currentAudioUrl = "";

    public static final String ACTION_PREPARE = "com.snooze.soundscapes.action.PREPARE_MEDIA";
    public static final String ACTION_UPDATE = "com.snooze.soundscapes.action.UPDATE_MEDIA_SESSION";
    public static final String ACTION_PLAY = "com.snooze.soundscapes.action.PLAY";
    public static final String ACTION_PAUSE = "com.snooze.soundscapes.action.PAUSE";
    public static final String ACTION_STOP = "com.snooze.soundscapes.action.STOP";
    public static final String ACTION_SEEK = "com.snooze.soundscapes.action.SEEK";
    public static final String ACTION_SEEK_BACKWARD = "com.snooze.soundscapes.action.SEEK_BACKWARD";
    public static final String ACTION_SEEK_FORWARD = "com.snooze.soundscapes.action.SEEK_FORWARD";
    public static final String ACTION_MEDIA_EVENT = "com.snooze.soundscapes.MEDIA_ACTION";
    public static final String EXTRA_MEDIA_ACTION = "mediaAction";
    public static final String EXTRA_AUDIO_URL = "audioUrl";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_PREPARED = "prepared";
    public static final String EXTRA_DURATION_SECONDS = "durationSeconds";
    public static final String EXTRA_POSITION_SECONDS = "positionSeconds";
    public static final String EXTRA_ERROR = "error";

    private static final String CHANNEL_ID = "snooze_playback";
    private static final int NOTIFICATION_ID = 2101;
    private static final long POSITION_UPDATE_MS = 1000;
    private static final double SEEK_STEP_SECONDS = 15.0;

    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final Runnable progressUpdate = new Runnable() {
        @Override public void run() {
            updateCachedState();
            updateSession();
            emitState("");
            if (player != null && player.isPlaying()) {
                progressHandler.postDelayed(this, POSITION_UPDATE_MS);
            }
        }
    };

    private MediaSession mediaSession;
    private ExoPlayer player;
    private String title = "Personal sound";
    private long requestedDurationMs = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        createNotificationChannel();
        createPlayer();
        createMediaSession();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    private void createPlayer() {
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();
        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build();
        player.addListener(new Player.Listener() {
            @Override public void onIsPlayingChanged(boolean isPlaying) {
                updateCachedState();
                updateSession();
                refreshNotification();
                emitState("");
                progressHandler.removeCallbacks(progressUpdate);
                if (isPlaying) progressHandler.post(progressUpdate);
            }

            @Override public void onPlaybackStateChanged(int playbackState) {
                prepared = playbackState == Player.STATE_READY || playbackState == Player.STATE_ENDED;
                updateCachedState();
                updateSession();
                refreshNotification();
                emitState("");
                if (playbackState == Player.STATE_ENDED) emitAction("ended", currentPositionSeconds, "");
            }

            @Override public void onPlayerError(PlaybackException error) {
                updateCachedState();
                updateSession();
                refreshNotification();
                emitAction("error", currentPositionSeconds, error.getErrorCodeName());
            }
        });
    }

    private void createMediaSession() {
        mediaSession = new MediaSession(this, "MixStil playback");
        mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { play(); }
            @Override public void onPause() { pause(); }
            @Override public void onStop() { stopPlayback(); }
            @Override public void onSeekTo(long pos) { seekTo(pos / 1000.0); }
            @Override public void onRewind() { seekBy(-SEEK_STEP_SECONDS); }
            @Override public void onFastForward() { seekBy(SEEK_STEP_SECONDS); }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_UPDATE : intent.getAction();
        if (intent != null && ACTION_PREPARE.equals(action)) prepare(intent);
        if (ACTION_PLAY.equals(action)) play();
        if (ACTION_PAUSE.equals(action)) pause();
        if (ACTION_STOP.equals(action)) stopPlayback();
        if (ACTION_SEEK_BACKWARD.equals(action)) seekBy(-SEEK_STEP_SECONDS);
        if (ACTION_SEEK_FORWARD.equals(action)) seekBy(SEEK_STEP_SECONDS);
        if (intent != null && ACTION_SEEK.equals(action)) {
            seekTo(intent.getDoubleExtra(EXTRA_POSITION_SECONDS, 0));
        }
        if (intent != null && ACTION_UPDATE.equals(action)) updateMetadata(intent);
        updateCachedState();
        updateSession();
        refreshNotification();
        return player != null && player.isPlaying() ? START_STICKY : START_NOT_STICKY;
    }

    private void prepare(Intent intent) {
        updateMetadata(intent);
        String audioUrl = intent.getStringExtra(EXTRA_AUDIO_URL);
        if (audioUrl == null || audioUrl.isBlank()) {
            emitAction("error", currentPositionSeconds, "missing_audio_url");
            return;
        }
        double requestedPosition = Math.max(0, intent.getDoubleExtra(EXTRA_POSITION_SECONDS, 0));
        boolean playWhenReady = intent.getBooleanExtra(EXTRA_PLAYING, false);
        boolean sourceChanged = !audioUrl.equals(currentAudioUrl);
        currentAudioUrl = audioUrl;
        if (sourceChanged || player.getMediaItemCount() == 0) {
            prepared = false;
            player.setMediaItem(MediaItem.fromUri(audioUrl));
            player.prepare();
        }
        player.seekTo(Math.round(requestedPosition * 1000));
        player.setPlayWhenReady(playWhenReady);
    }

    private void updateMetadata(Intent intent) {
        String nextTitle = intent.getStringExtra(EXTRA_TITLE);
        if (nextTitle != null && !nextTitle.isBlank()) title = nextTitle;
        requestedDurationMs = Math.max(0, Math.round(intent.getDoubleExtra(EXTRA_DURATION_SECONDS, requestedDurationMs / 1000.0) * 1000));
    }

    private void play() {
        if (player == null || player.getMediaItemCount() == 0) return;
        if (player.getPlaybackState() == Player.STATE_ENDED) player.seekTo(0);
        player.play();
    }

    private void pause() {
        if (player != null) player.pause();
    }

    private void seekTo(double positionSeconds) {
        if (player == null || player.getMediaItemCount() == 0) return;
        double bounded = currentDurationSeconds > 0
            ? Math.min(currentDurationSeconds, Math.max(0, positionSeconds))
            : Math.max(0, positionSeconds);
        player.seekTo(Math.round(bounded * 1000));
        updateCachedState();
        updateSession();
        emitState("");
    }

    private void seekBy(double offsetSeconds) {
        updateCachedState();
        seekTo(currentPositionSeconds + offsetSeconds);
    }

    private void stopPlayback() {
        if (player != null) {
            player.pause();
            player.seekTo(0);
        }
        updateCachedState();
        updateSession();
        refreshNotification();
        emitAction("stopped", 0, "");
        stopSelf();
    }

    private void updateCachedState() {
        if (player == null) return;
        playing = player.isPlaying();
        currentPositionSeconds = Math.max(0, player.getCurrentPosition() / 1000.0);
        long playerDuration = player.getDuration();
        long durationMs = playerDuration == C.TIME_UNSET || playerDuration < 0 ? requestedDurationMs : playerDuration;
        currentDurationSeconds = Math.max(0, durationMs / 1000.0);
    }

    private void updateSession() {
        if (mediaSession == null) return;
        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_STOP
            | PlaybackState.ACTION_SEEK_TO
            | PlaybackState.ACTION_REWIND
            | PlaybackState.ACTION_FAST_FORWARD;
        mediaSession.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, Math.round(currentPositionSeconds * 1000), playing ? 1f : 0f)
            .build());
        mediaSession.setMetadata(new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, "MixStil")
            .putString(MediaMetadata.METADATA_KEY_ALBUM, "My Sounds")
            .putLong(MediaMetadata.METADATA_KEY_DURATION, Math.round(currentDurationSeconds * 1000))
            .build());
    }

    private Notification buildNotification() {
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String controlAction = playing ? ACTION_PAUSE : ACTION_PLAY;
        int controlIcon = playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String controlTitle = playing ? "Pause" : "Play";
        PendingIntent controlIntent = PendingIntent.getService(
            this,
            1,
            new Intent(this, MediaPlaybackService.class).setAction(controlAction),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent rewindIntent = PendingIntent.getService(
            this,
            3,
            new Intent(this, MediaPlaybackService.class).setAction(ACTION_SEEK_BACKWARD),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent forwardIntent = PendingIntent.getService(
            this,
            4,
            new Intent(this, MediaPlaybackService.class).setAction(ACTION_SEEK_FORWARD),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        PendingIntent stopIntent = PendingIntent.getService(
            this,
            2,
            new Intent(this, MediaPlaybackService.class).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText("MixStil")
            .setContentIntent(contentIntent)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_rew, "Back 15 seconds", rewindIntent).build())
            .addAction(new Notification.Action.Builder(controlIcon, controlTitle, controlIntent).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_ff, "Forward 15 seconds", forwardIntent).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent).build())
            .setStyle(new Notification.MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .build();
    }

    private void refreshNotification() {
        if (mediaSession == null) return;
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    private void emitState(String error) {
        emitAction("state", currentPositionSeconds, error);
    }

    private void emitAction(String action, double positionSeconds, String error) {
        Intent event = new Intent(ACTION_MEDIA_EVENT)
            .setPackage(getPackageName())
            .putExtra(EXTRA_MEDIA_ACTION, action)
            .putExtra(EXTRA_PLAYING, playing)
            .putExtra(EXTRA_PREPARED, prepared)
            .putExtra(EXTRA_DURATION_SECONDS, currentDurationSeconds)
            .putExtra(EXTRA_POSITION_SECONDS, positionSeconds)
            .putExtra(EXTRA_ERROR, error == null ? "" : error);
        sendBroadcast(event);
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Controls for the sound currently playing");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setSound(null, null);
        channel.enableVibration(false);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        running = false;
        prepared = false;
        playing = false;
        currentPositionSeconds = 0;
        currentDurationSeconds = 0;
        currentAudioUrl = "";
        progressHandler.removeCallbacks(progressUpdate);
        if (player != null) {
            player.release();
            player = null;
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public static boolean isRunning() { return running; }
    public static boolean isPrepared() { return prepared; }
    public static boolean isPlaying() { return playing; }
    public static double getCurrentPositionSeconds() { return currentPositionSeconds; }
    public static double getCurrentDurationSeconds() { return currentDurationSeconds; }
    public static String getCurrentAudioUrl() { return currentAudioUrl; }
}
