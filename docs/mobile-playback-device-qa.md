# Mobile Playback Device QA

Date: 2026-07-15  
Scope: Sprint 1 mobile listening reliability gate

Release verdict: **NO-GO**. The iOS physical-device matrix has passed, but the
paused Android rows remain incomplete. The detailed
evidence is recorded in
[`reports/listening-qa-results-draft-2026-07-15T10-13-53-460Z.md`](../reports/listening-qa-results-draft-2026-07-15T10-13-53-460Z.md).

This gate verifies what automated browser and static contracts cannot prove:
real mobile background playback, lock-screen controls, audio interruption, and
30/60/90/120 minute continuity.

## Required Devices

- Installed SNOOZE iOS build on a current iPhone and iOS release.
- Installed SNOOZE Android build on a current Android device and release.
- Headphones or Bluetooth audio for at least one interruption run.

Safari and Chrome remain useful web regressions, but they do not approve the
store build or its native media controls.

## Test Mixes

Use `/create` to generate one Sleep mix and one Focus mix. Save the mix IDs and
the journey IDs from playback telemetry.

Each long-session run must use a duration that can reach the target checkpoint:

- 30 minute run: at least 1800 seconds.
- 60 minute run: at least 3600 seconds.
- 90 minute run: at least 5400 seconds.
- 120 minute run: at least 7200 seconds.

## Pass Criteria

- Playback starts from a user tap without a browser startup error.
- Lock-screen play, pause, seek backward, and seek forward control the same
  recipe timeline shown in the Player.
- Background playback does not stop without a visible reason.
- If playback is interrupted, returning to the app resumes from the same recipe
  position or clearly asks the user to tap Play from that position.
- No unexplained silence occurs before the target checkpoint.
- The matching `playback_checkpoint` event is recorded for the target time.
- The playback-event API accepts elapsed timestamps through the full 120 minute
  run; the server safety ceiling is eight hours, not ten minutes.
- Recipe position does not drift by more than 5 seconds from expected elapsed
  listening time after resume or seek.

## Runs

| Run | Device | Runtime | Duration | Lock screen | Background app switch | Interruption | Required checkpoint | Result |
| --- | --- | --- | ---: | --- | --- | --- | ---: | --- |
| iOS 30 | iPhone 11 / iOS 26.1 | Installed iOS app / AVPlayer | 30 min | covered by iOS 60 control run | passed | none | 1800 | passed |
| iOS 60 | iPhone 11 / iOS 26.1 | Installed iOS app / AVPlayer | 60 min | passed | passed | call interruption passed in follow-up | 3600 | passed |
| iOS 90 | iPhone 11 / iOS 26.1 | Installed iOS app / AVPlayer | 90 min | covered by iOS 60 control run | passed | headphone/Bluetooth route change passed in follow-up | 5400 | passed; hidden 5400 checkpoint also verified in iOS 120 run |
| iOS 120 | iPhone 11 / iOS 26.1 | Installed iOS app / AVPlayer | 120 min | covered by iOS 60 control run | passed | none | 7200 | passed: all checkpoints, hidden 7200 endpoint, and no native/playback failures |
| Android 30 | Android | Installed Android app | 30 min | required | required | none | 1800 | pending |
| Android 60 | OPPO PEEM00 / Android 14 | Installed Android app / Media3 ExoPlayer | 60 min | passed | passed | notification passed | 3600 | partial: technical evidence passed; full-session audible continuity unconfirmed |
| Android 90 | Android | Installed Android app | 90 min | required | required | headphone or Bluetooth change | 5400 | pending |
| Android 120 | Android | Installed Android app | 120 min | required | required | none | 7200 | pending |

## Current Evidence Summary

- iOS 30 completed lock-screen playback to 1800 seconds and stopped naturally;
  the shared native transport controls were verified in the iOS 60 run.
- iOS 60 completed lock-screen playback to 3600 seconds with audible continuity,
  working lock-screen controls, natural completion, and replay from 0:00. The
  required call interruption was verified in a later short follow-up.
- iOS 90 completed audibly and the iOS 120 run supplied hidden 5400- and
  7200-second checkpoints. Headphone/Bluetooth route removal and recovery passed
  a later short follow-up.
- Android 60 reached 3600 seconds in deep Doze, passed system media controls and
  notification continuity, and persisted the 300/1800/3600 checkpoints. Final
  approval still requires owner confirmation that no silence or jump occurred
  during the complete hour.
- All iOS physical-device rows now pass. Android 30/90/120 and Android
  headphone or Bluetooth-change evidence remain open; Android 60 still needs
  owner confirmation of full-session audible continuity.

## Evidence To Capture

- Device, OS version, browser version, and network state.
- Mix ID and journey ID.
- Whether lock-screen controls appeared.
- Whether `native_media_session_ready` was recorded after the first playback
  request; any `native_media_session_failed` event blocks the run.
- Whether each required checkpoint was recorded.
- Any `playback_failed` event, browser audio prompt, or visible playback error.
- User-visible position before and after interruption or resume.

### Android evidence helper

Before starting or resuming the Android matrix, run:

```sh
pnpm qa:android-playback-matrix
```

This reports connected ADB devices, the next open Android row, the required
human observations, and the commands needed to prepare or verify the installed
app. It is a release-status helper only; it does not pass any row by itself.

After starting playback with a real user tap, collect the current Android
system state without changing the device:

```sh
node scripts/verify-android-playback-device.mjs --serial=<adb-serial>
```

To explicitly exercise background or screen-off state, add
`--background-seconds=15` or `--lock-seconds=15`. These flags change the device
state; the default command is read-only.

The helper fails unless the app process, active audio output, audio focus,
Android Media Session, foreground playback service, and media notification are
all present. It does not replace headphone listening, interruption actions, or
the full 30/60/90/120 minute checkpoint run.

After the run, open `/internal/mobile-playback-qa`, select the matching row,
enter its journey ID, and use **Verify telemetry**. The workbench reads the
persisted journey events and verifies native media-session readiness, the
required checkpoint, and recorded playback failures. Lock-screen behavior,
audible continuity, interruption recovery, and recipe-position stability remain
manual device observations.

Sprint 1 implementation is code-ready, but no iOS/Android store build is
release-approved until these device rows pass. Automated validators only prove
the code path is ready for this QA.

## Android Deep-Doze Failure And Remediation

The 2026-07-15 Android 60-minute run on OPPO PEEM00 exposed that a foreground
notification and Media Session are not sufficient when the actual audio still
lives in a WebView `<audio>` element. After the device returned from the full
lock screen to deep Doze, Android destroyed the WebView audio track at 1331
seconds even though the foreground service and Media Session remained alive.

Android playback therefore uses Media3 ExoPlayer inside
`MediaPlaybackService`. The service owns the audio source, wake lock, audio
focus, position, and transport controls. The WebView receives state events for
UI and telemetry but is no longer the Android audio owner. The failed 1331
second run remains `needs_fix` evidence and must not count as the Android 60
row; a fresh installed-build run is required after the remediation.

The fresh Android 60-minute technical run completed on 2026-07-15. It does not
close the release row until the outstanding audible-continuity confirmation is
recorded.
