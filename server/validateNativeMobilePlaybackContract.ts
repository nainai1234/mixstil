import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const player = fs.readFileSync(path.join(root, 'src/pages/PlayerPage.tsx'), 'utf8');
const activity = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/snooze/soundscapes/MainActivity.java'), 'utf8');
const nativeService = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/snooze/soundscapes/MediaPlaybackService.java'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const androidBuild = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const iosPlugin = fs.readFileSync(path.join(root, 'ios/App/App/NativeMediaSessionPlugin.swift'), 'utf8');
const iosInfo = fs.readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');
const iosStoryboard = fs.readFileSync(path.join(root, 'ios/App/App/Base.lproj/Main.storyboard'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/lib/api.ts'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.ts'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'server/schema.ts'), 'utf8');

const requiredContracts = [
  [player, 'resolveServiceUrl', 'Player resolves rendered audio URLs through the API base'],
  [player, 'isMobileBrowser', 'Player detects mobile browsers'],
  [player, 'useNativeMobilePlayback', 'Player has a native mobile playback branch'],
  [player, 'api.renderMix(mixId)', 'Player prepares rendered audio for mobile playback'],
  [player, 'const isNativeRuntime = hasNativeAudioPlayback()', 'Player distinguishes native apps from mobile browsers'],
  [player, 'if (!isNativeRuntime) {', 'Mobile browsers do not wait for a full server render before playback'],
  [player, "if (existingUrl) {\n      setMobileRenderPending(false);", 'A completed mobile render always releases the pending playback state'],
  [player, "searchParams.get('mixId')", 'Player can load QA mix IDs from a direct URL'],
  [player, "searchParams.get('journeyId')", 'Player can load QA journey IDs from a direct URL'],
  [player, 'nativeAudioRef', 'Player owns a native audio element ref'],
  [player, '<audio', 'Player renders a real audio element'],
  [player, 'src={nativeAudioUrl}', 'Native audio element uses the rendered URL as its source'],
  [player, 'prepareNativeAudio', 'Native apps hand rendered audio to the platform player'],
  [player, 'nativeAudioUrl && !useNativeAudioPlayback', 'Native apps do not rely on the hidden WebView audio element'],
  [player, "window.addEventListener('focus', refreshNativeState)", 'Native apps restore platform playback position after the WebView wakes'],
  [player, "recordPlaybackEvent('playback_started', { playbackEngine: 'native-audio' })", 'Native playback records playback_started'],
  [player, "recordPlaybackEvent('playback_checkpoint'", 'Native playback records checkpoints'],
  [player, 'const seekPlaybackTo = useCallback', 'Player uses one seek path across playback engines'],
  [player, "aria-label={t('player.seekPlayback')}", 'Player exposes a draggable playback-position range control'],
  [player, "navigator.mediaSession.setActionHandler(action, handler)", 'Native playback registers Media Session action handlers'],
  [player, "register('play'", 'Native playback handles system play'],
  [player, "register('pause'", 'Native playback handles system pause'],
  [player, 'updateNativeMediaSession', 'Player synchronizes playback state with the Android media session'],
  [player, 'addNativeMediaActionListener', 'Player handles Android lock-screen transport actions'],
  [player, "recordPlaybackEvent('native_media_session_ready'", 'Player records successful native media-session initialization'],
  [player, "recordPlaybackEvent('native_media_session_failed'", 'Player records failed native media-session initialization'],
  [api, "'native_media_session_ready'", 'Client API accepts native media-session telemetry'],
  [server, "'native_media_session_failed'", 'Server accepts native media-session telemetry'],
  [schema, "'native_media_session_ready', 'native_media_session_failed'", 'Database accepts native media-session telemetry'],
  [activity, 'registerPlugin(NativeMediaSessionPlugin.class)', 'Android registers the native media-session bridge'],
  [nativeService, 'new MediaSession(this, "MixStil playback")', 'Android owns a real system MediaSession'],
  [nativeService, 'new ExoPlayer.Builder(this)', 'Android foreground service owns the real audio player'],
  [nativeService, '.setAudioAttributes(audioAttributes, true)', 'Android native player handles audio focus'],
  [nativeService, '.setWakeMode(C.WAKE_MODE_LOCAL)', 'Android native player holds a playback wake lock'],
  [nativeService, '@Override public void onPlay() { play(); }', 'Android Media Session controls the native player directly'],
  [nativeService, 'emitAction("state"', 'Android native progress is returned to the web UI and telemetry layer'],
  [androidBuild, 'androidx.media3:media3-exoplayer', 'Android packages Media3 ExoPlayer'],
  [nativeService, 'startForeground(NOTIFICATION_ID, buildNotification())', 'Android playback keeps a foreground media notification'],
  [nativeService, 'public static boolean isRunning()', 'Background state updates reuse the active foreground service'],
  [manifest, 'android:foregroundServiceType="mediaPlayback"', 'Android declares the media playback foreground service'],
  [iosPlugin, 'AVAudioSession.sharedInstance()', 'iOS activates the playback audio session'],
  [iosPlugin, 'AVPlayer(playerItem:', 'iOS native code owns the real audio player'],
  [iosPlugin, 'item.observe(\\.status', 'iOS waits for the remote audio item to become ready'],
  [iosPlugin, 'case .failed:', 'iOS surfaces remote audio loading failures'],
  [iosPlugin, 'Audio took too long to become ready', 'iOS bounds native audio startup time'],
  [iosPlugin, 'CAPPluginMethod(name: "getState"', 'iOS exposes native playback state for foreground recovery'],
  [iosPlugin, 'AVAudioSession.interruptionNotification', 'iOS handles system audio interruptions'],
  [iosPlugin, 'AVAudioSession.routeChangeNotification', 'iOS handles output-route removal'],
  [iosPlugin, 'MPNowPlayingInfoCenter.default()', 'iOS publishes lock-screen metadata and position'],
  [iosPlugin, 'MPRemoteCommandCenter.shared()', 'iOS handles lock-screen transport commands'],
  [iosPlugin, 'resumeOrRestartPlayback()', 'iOS restarts completed audio from the beginning'],
  [iosPlugin, 'registerPluginInstance(NativeMediaSessionPlugin())', 'iOS registers the native media-session bridge'],
  [iosInfo, '<string>audio</string>', 'iOS declares background audio mode'],
  [iosStoryboard, 'customClass="MixStilBridgeViewController"', 'iOS launches the custom Capacitor bridge controller'],
] as const;

const missing = requiredContracts
  .filter(([source, needle]) => !source.includes(needle))
  .map(([, , label]) => label);

if (missing.length) throw new Error(`Native mobile playback contract failed:\n- ${missing.join('\n- ')}`);

console.log(JSON.stringify({
  passed: true,
  contracts: [
    'mobile-rendered-audio',
    'native-audio-element',
    'media-session-native-actions',
    'native-playback-checkpoints',
    'draggable-playback-position',
    'native-media-session-readiness-telemetry',
    'android-system-media-session',
    'android-foreground-playback-service',
    'android-foreground-service-audio-owner',
    'ios-native-background-audio-owner',
    'ios-ready-to-play-startup-gate',
    'ios-interruption-and-route-recovery',
    'ios-now-playing-remote-controls',
    'ios-replay-after-completion',
  ],
  remainingDeviceGates: ['physical-lock-screen-card', 'interruption-recovery', '30-120-minute-checkpoints'],
}, null, 2));
