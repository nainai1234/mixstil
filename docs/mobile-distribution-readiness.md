# SNOOZE Mobile Distribution Readiness

Date: 2026-07-15  
Sprint: 4  
Status: **NO-GO**; signed physical builds run, but the full playback matrix and store-production setup remain incomplete

2026-07-21 execution note: Android physical-device playback rows are deferred
for the current implementation pass. Use
`pnpm validate:sprint1-mobile-playback-code-only` to keep non-device release
preparation moving. This is a code-readiness gate only and must keep
`releaseApproved: false`; it does not replace the Android 30/90/120 rows,
Android 60 audible-continuity confirmation, or Android headphone/Bluetooth
recovery evidence.

## Implemented

- Capacitor iOS and Android projects with application ID `com.mixstil.soundscapes`.
- Fail-closed store-candidate synchronization through `pnpm mobile:sync`; it rejects local/example API origins and missing release versions.
- Separate iOS and Android release commands validate platform signing inputs before preparing or building a store artifact.
- Mobile API origin supplied by `VITE_API_BASE_URL` in `.env.mobile`.
- API requests, audio playback, and offline cache requests share the configured service origin.
- In-app privacy disclosure at `/privacy`.
- Public support page at `/support`, linked from Profile, with a release-configured
  mailbox and privacy-safe diagnostic copy action.
- Authenticated account deletion with explicit confirmation and local listening-data cleanup.
- App-level iOS Privacy Manifest with no tracking and Voice-free Beta data categories.
- Separate iOS Debug and Release property lists: local-network development
  access exists only in Debug, while Release keeps background audio without
  shipping local-network permission text or exceptions.
- Android release backup disabled, personal-data extraction excluded, and cleartext traffic blocked.
- Apple App Privacy and Google Play Data Safety repository baselines with production reconciliation gates.
- Voice-free, non-medical product claims remain the release default.
- Reproducible SNOOZE-branded iOS, Android, and PWA icons and splash assets.
- Structured App Store and Play listing metadata with character-limit,
  Voice-free claim, icon-dimension, screenshot-plan, and public-URL validation.
- Functional first-run setup for goal, exclusions, and default duration.
- Android debug APK verified with application ID `com.mixstil.soundscapes`,
  version `1.0 (1)`, min SDK 24, target SDK 36, and a 13 MB package size.
- iOS Simulator Debug build verified with application ID
  `com.mixstil.soundscapes` and Background Audio enabled.
- Android Media3 ExoPlayer owned by the foreground playback service, with a
  system Media Session, audio focus, wake lock, and media notification.
- iOS playback audio session, Now Playing metadata, and remote-command bridge.
- iOS Background Modes includes audio.
- A signed iOS build using native AVPlayer completed the 30/60/90/120-minute
  physical-device matrix, including lock-screen controls, replay after natural
  completion, incoming-call recovery, and headphone/Bluetooth route change.
- Android Media3 completed a 60-minute deep-Doze technical run with system media
  controls, notification continuity, state recovery, and persisted checkpoints.

## Current Release Blockers

- Android 30/90/120 installed-device rows are not complete.
- Android 60 still requires owner confirmation of uninterrupted audible output
  for the complete session.
- Android headphone or Bluetooth-change recovery remains unverified.
- Production HTTPS, store signing/release channels, store metadata, privacy/data
  screenshot exports, public support/privacy URLs, disclosures, and
  production-like account/deletion checks remain open.

## Required Before Store Submission

- Replace the example API origin with a production HTTPS service in `.env.mobile`.
- Set `SNOOZE_VERSION` and increment `SNOOZE_BUILD_NUMBER` for every store upload.
- Provide final 1024 px App Store and 512 px Play Store icons, splash assets, screenshots, subtitle, description, keywords, support URL, and public privacy URL.
- Set Apple Developer and Play Console signing identities outside source control.
- Accept the installed Xcode license with administrator approval before the first verified iOS build on this workstation.
- Verify the configured iOS audio Background Mode against a signed physical-device build.
- Complete App Privacy and Play Data Safety disclosures against the deployed telemetry and providers.
- Test account creation, sign-in, deletion, and deletion reauthentication on production-like accounts.
- Run 30, 60, 90, and 120 minute background sessions on physical iOS and Android devices.
- Verify interruption recovery for calls, notifications, headphones, Bluetooth, lock screen, and app process suspension.
- Confirm offline playback on both platforms with the API and network unavailable.

## Commands

```sh
pnpm mobile:sync
pnpm mobile:release:ios
pnpm mobile:release:android
pnpm mobile:sync:android:local
pnpm mobile:open:ios
pnpm mobile:open:android
pnpm validate:sprint4-mobile-readiness
pnpm validate:sprint1-mobile-playback-code-only
pnpm validate:sprint1-mobile-playback-release-gate
pnpm validate:ios-release-artifact
pnpm validate:mobile-store-listing
pnpm validate:mobile-store-listing:submission
```

`mobile:sync:android:local` is only for an ADB-connected local device. It embeds
`http://localhost:8788`, enables the Android cleartext debug path, and requires
`adb reverse tcp:8788 tcp:8788`. Store builds must use the production HTTPS
origin, version, build number, and signing values from `.env.mobile`. The store
commands fail before building when those deployment values are local, examples,
or missing.

`validate:sprint4-mobile-readiness` proves implementation readiness only. Its
output must still report `releaseApproved: false` while any physical-device,
production-origin, signing, public URL, screenshot, account, or offline gate is
open. Use `pnpm release:check` for the full release decision.

`validate:sprint1-mobile-playback-code-only` is the accepted temporary path
when physical phone testing is explicitly skipped. It runs the Sprint 1 mobile
playback code contracts and returns GO only for code readiness, while leaving
the physical-device blockers listed in the generated report. The full
`validate:sprint1-mobile-playback-release-gate` remains NO-GO until the
physical-device matrix is complete.

`validate:mobile-store-listing` proves the repository copy, icon, and screenshot
plan are coherent. `validate:mobile-store-listing:submission` is intentionally
fail-closed until final native screenshots and real public support/privacy URLs
exist. Passing the repository check does not complete the external
`store_listing_assets` evidence row.

The iOS release builder automatically runs `validate:ios-release-artifact`
against the archived `.app`. The same command can inspect the default unsigned
Release simulator build or an explicit artifact supplied through
`IOS_APP_PATH`.

The generated Xcode and Gradle projects are source artifacts. Signing secrets,
store credentials, and `.env.mobile` remain local and must not be committed.
