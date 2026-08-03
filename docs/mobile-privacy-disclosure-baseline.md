# SNOOZE Mobile Privacy Disclosure Baseline

Date: 2026-07-15  
Release: Voice-free Beta  
Status: repository baseline; final store forms require production-provider reconciliation

## Product Boundary

- No advertising SDK, cross-app tracking, contact access, microphone access,
  camera access, precise location, or health-record collection is present in the
  Voice-free Beta.
- Sound requests may describe sleep, calm, or focus needs. Treat this text as
  user content and potentially sensitive even though SNOOZE is not a medical
  service and does not request medical records.
- Account, preference, saved-sound, listening, playback reliability, and render
  data are deleted through the authenticated account-deletion flow, subject to
  any documented security or legal retention requirement.
- Device backup is disabled for the native app because local storage can contain
  authentication state, preferences, playback history, and offline sound files.

## Apple App Privacy Baseline

| Apple category | Collected | Linked | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Contact Info: Email Address | Yes for registered accounts | Yes | No | App functionality, account security |
| Identifiers: User ID | Yes, including guest/account IDs | Yes | No | App functionality |
| User Content: Other User Content | Yes, sound requests and explicit preferences | Yes | No | Personal soundscape generation |
| Usage Data: Product Interaction | Yes, playback, save, refinement, and reliability events | Yes | No | App functionality and analytics |
| Diagnostics: Crash Data | Only if the deployed platform collects it | No by design | No | App functionality and analytics |
| Purchases | No in Voice-free Beta | No | No | Sprint 5 only |
| Health & Fitness | No | No | No | Not a medical product |
| Location, Contacts, Photos, Audio recordings | No | No | No | Not requested |

The application Privacy Manifest declares the currently known app-level data
categories and no tracking. Before submission, reconcile diagnostics and
processor behavior against the actual hosting, AI, monitoring, CDN, and crash
reporting providers. Third-party SDK manifests remain independently required.

## Google Play Data Safety Baseline

| Google category | Collected | Shared | Required | Purpose | Deletable |
| --- | --- | --- | --- | --- | --- |
| Personal info: Email address | Yes for registered accounts | Service providers only | Optional registration | Account management | Yes |
| Personal info: User IDs | Yes | Service providers only | Yes for account-scoped use | App functionality | Yes |
| App activity: App interactions | Yes | Monitoring processors only | Yes | Reliability and analytics | Yes |
| App info and performance: Diagnostics | Yes when failures occur | Monitoring processors only | Yes | Reliability | Yes |
| Other user-generated content | Yes, sound requests and preferences | AI/infrastructure processors as configured | Yes for personalization | App functionality | Yes |
| Financial info and Purchases | No in Voice-free Beta | No | No | Sprint 5 only | N/A |
| Health info | No | No | No | Not requested | N/A |
| Location, Contacts, Photos, Videos, Audio files | No | No | No | Not requested | N/A |

"Shared" in store forms must follow the platform's processor/service-provider
exceptions and the actual provider contracts. This table does not decide that
legal classification by itself.

## Pre-Submission Reconciliation

Record concrete evidence for:

1. Production hosting, PostgreSQL, object storage/CDN, AI, monitoring, and crash
   reporting providers, including regions and retention.
2. Encryption in transit and at rest for every provider.
3. Whether any provider uses submitted data for its own model training,
   advertising, profiling, or unrelated product improvement. These uses are not
   allowed without a new product and legal decision.
4. Public privacy URL, support contact, deletion instructions, and effective
   date matching the shipped app.
5. Apple App Privacy and Google Play Data Safety form screenshots or exports.

The release evidence row `privacy_data_safety_forms` stays pending until this
reconciliation is completed against the deployed production stack.
