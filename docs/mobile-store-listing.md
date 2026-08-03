# MIXVOID Mobile Store Listing

Date: 2026-07-14  
Release: Voice-free Beta  
Primary category: Health & Fitness  
Secondary category: Lifestyle

## Store Metadata

App name: `MIXVOID`

Apple subtitle: `Personal soundscapes`

Google Play short description:

> Describe the sound you need, adjust it, save it, and return whenever you want.

Promotional text:

> Create a sleep, calm, or focus soundscape around what you like and what you want excluded.

Keywords:

`sleep sounds, ambient, focus, calm, noise, soundscape, relaxation`

Full description:

> MIXVOID creates a personal listening environment from a simple description.
> Choose Sleep, Calm, or Focus, name sounds you want to avoid, and hear an
> immediately playable result assembled from approved audio layers. Refine the
> result with AI, adjust individual layers when needed, save trusted versions
> to My Sounds, and continue from your latest position. Saved sounds can be made
> available offline. MIXVOID is a listening and sound-customization product; it
> does not diagnose, treat, cure, or guarantee health outcomes.

Support URL: required before submission.  
Public privacy URL: required before submission; the in-app source is `/privacy`.

The production values are supplied through `SNOOZE_SUPPORT_URL`,
`SNOOZE_PRIVACY_URL`, and `VITE_SUPPORT_EMAIL`. The deployed support URL may
point to the public `/support` route. Placeholder URLs, non-HTTPS URLs, and
placeholder support mailboxes fail submission validation.

## Screenshot Set

1. First-run goal, exclusions, and default-duration setup.
2. Describe the current need in Create.
3. Play and refine a generated result.
4. Adjust one sound layer without rebuilding the whole soundscape.
5. Save and replay from My Sounds, including offline state.
6. Manage explicit likes, exclusions, language, privacy, and account deletion.

Required sizes must be exported from the final native builds. Screenshots must
not show Voice, medical claims, subscription pricing, or placeholder content.
The structured source of truth is
`data/mobile-store-listing.json`. Localized App Store and Google Play copy plus
localized screenshot titles for all 26 active consumer locales are maintained
in `data/mobile-store-listing-localizations.json`. Non-English entries remain
`pending_native_review` until a named native reviewer approves them. Final
screenshots are expected at:

- `store-assets/ios/iphone-6.7/*.png` at 1290 x 2796.
- `store-assets/android/phone/*.png` at 1080 x 1920.

Both directories use the same six stable filenames from the screenshot plan.
The repository baseline validates copy limits, routes, claims, and store-icon
dimensions. Submission validation additionally requires both real public URLs
and all twelve final screenshots:

```sh
pnpm validate:mobile-store-listing
pnpm validate:mobile-store-listing:submission
```

## Review Notes

- The initial build is Voice-free Beta; voice and TTS controls are disabled.
- Playback begins only after an explicit user action.
- Background audio is a core product behavior and is declared on iOS.
- Account deletion is available in Profile and requires an authenticated account
  plus explicit confirmation.
- Review credentials and a production API environment are required before submission.

## Data Safety

| Data | Purpose | Linked to account | Shared with processors | User deletion |
| --- | --- | --- | --- | --- |
| Email, username, auth session | Account and security | Yes | Hosting/auth infrastructure | Yes |
| Sound requests | Generate a requested soundscape | Yes | AI/infrastructure providers as configured | Yes |
| Likes and exclusions | Persistent personalization | Yes | Application infrastructure | Yes |
| Saved recipes and versions | Replay and offline use | Yes | Storage/delivery infrastructure | Yes |
| Listening position and history | Resume and retention experience | Yes | Application infrastructure | Yes |
| Playback reliability events | Diagnose failures and measure reliability | Pseudonymous/account-linked | Analytics infrastructure as configured | Yes, subject to documented security retention |

MIXVOID does not sell personal information and does not use it for cross-context
behavioral advertising. Final App Privacy and Play Data Safety forms must be
reconciled against the actual production providers and retention configuration.
The field-by-field repository baseline and required reconciliation evidence are
maintained in [Mobile Privacy Disclosure Baseline](./mobile-privacy-disclosure-baseline.md).

## Release Channels

1. Local debug: bundled Web assets with a developer API origin.
2. Internal testing: signed build, production-like API, synthetic/test accounts.
3. Closed beta: Voice-free capability flags, monitored playback telemetry, no payment.
4. Public release: only after background playback, privacy, deletion, offline,
   signing, screenshots, support URL, and store review gates pass.
