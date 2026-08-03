# MixStil ToC Product Development Master Plan

Date: 2026-07-14  
Status: Highest product and development directive

Implementation status:

- Sprint 0 completed on 2026-07-14: canonical consumer routes, direct AI Create,
  ToC Home and Explore, My Sounds, consumer Profile, direct save-to-library,
  route-contract validation, and mobile browser layout verification.
- 2026-07-16 content correction: the current content base does not yet support
  paid retention. Goal-diversity listening QA failed, so the Content Baseline
  Reset in [MixStil Content Baseline Rebuild Plan](./content-baseline-rebuild-plan.md)
  is now a release precondition before additional noncritical device-release or
  store-submission work.
- Sprint 1 implementation completed: true Web Audio pause/resume, Media Session
  controls, interruption recovery, long-session scheduling, checkpoints, and
  state recovery are implemented. Physical-device release gates remain.
- Sprint 2 completed: My Sounds, explicit preference memory, exclusions, and
  preference-aware creation are implemented.
- Sprint 3 completed: returning-user Home, verified offline copies, app-shell
  fallback, frozen offline replay, and cross-device playback state are implemented.
- Sprint 4 in progress: Capacitor iOS/Android projects, production service-origin
  configuration, privacy disclosure, and authenticated account deletion are
  implemented; signing, store assets, native builds, and physical-device gates remain.

## 1. Strategic Decision

MixStil is a ToC-first personalized soundscape product.

The first paying audience is not small businesses, creators, teachers, or
institutions. It is consumers who already use sleep sounds, noise, ambient
music, or focus audio, but cannot reliably find a result that matches their
specific preferences and exclusions.

Small-business workspaces, creator acquisition, client CRM, custom domains,
marketplace revenue sharing, and creator payout systems are not current
mainline work. Existing advanced editing, export, sharing, and analytics code
may remain, but it must not determine the customer-facing information
architecture or displace the ToC loop.

Recipe V2 remains the technical foundation. The product mainline above it is:

```text
Describe the current need
  -> receive a fitting playable result within seconds
  -> refine it through continued AI conversation
  -> optionally make precise layer adjustments
  -> save it to My Sounds
  -> replay it without starting over
  -> let explicit preferences improve future results
  -> subscribe for persistent personalization and deeper use
```

## 2. Target Customer

The first target customer is a sound-sensitive consumer who has tried sleep
or focus audio before and repeatedly encounters one or more of these problems:

- Water, birds, music, voices, or high-frequency sounds are unwanted.
- Existing tracks contain sudden events, obvious loops, or tiring textures.
- A fixed track is close to the need but cannot be changed locally.
- The user must search again every night instead of replaying a trusted result.
- Existing mixers expose many controls but do not understand plain-language
  intent.

Initial scenarios, in priority order:

1. Bedtime sleep.
2. Return to sleep after waking.
3. Emotional settling and quiet relaxation.
4. Deep focus.
5. Breathing meditation after the voice quality gate is passed.

The product does not diagnose, treat, cure, or guarantee an outcome. It helps
the user create a suitable listening environment.

## 3. User Value Proposition

The free product must prove:

> I can describe what I need and quickly hear a result that respects what I do
> and do not want.

The paid product must prove:

> MixStil remembers my stable preferences, helps me create useful variants, and
> makes my trusted sounds available whenever I need them.

Users do not pay for internal concepts such as Recipe, Stem, Timeline, or AI
tokens. They pay for saved time, reliable fit, persistent preference memory,
longer and offline listening, stable replay, and sufficient generation and
refinement capacity.

## 4. Product Principles

1. Result before tools. A user hears a useful result before seeing advanced
   editing controls.
2. AI conversation is the primary adjustment interface. Buttons are optional
   shortcuts, not a separate product path.
3. Explicit exclusions are permanent hard constraints until the user changes
   them.
4. A local edit changes only the requested part of the current Recipe.
5. My Sounds is the core retention surface; Studio is not the primary consumer
   concept.
6. Replay is more important than content-feed depth.
7. Approved assets, authorization, acoustic QA, and reproducibility are part of
   generation quality.
8. Voice stays disabled in the Voice-free Beta until script, pronunciation,
   rights, safety, and listening QA all pass.
9. No medical claims, unverified frequency claims, or guaranteed outcomes.
10. Small sample interviews do not decide strategy. Market direction is based
    on large-scale external evidence, model-based analysis, current technical
    capability, and production-scale behavioral and payment telemetry.

## 5. Consumer Information Architecture

### Home

Purpose: start a new need or resume a trusted sound.

P0 content:

- One-sentence need entry.
- Sleep, Calm, and Focus context selectors.
- Continue the most recent sound.
- Recently played sounds.
- Saved bedtime and return-to-sleep sounds.

Home must not lead with creator statistics, trending creators, publishing
progress, or a large generic catalog.

### Create

Purpose: turn a need into a playable Live Mix.

P0 flow:

- Plain-language description.
- Goal and duration.
- Honest generation state.
- Immediate handoff to the player.

The user is not asked to choose tracks, templates, licenses, or publishing
settings before hearing a result.

### Player

Purpose: listen, decide, and refine.

P0 actions:

- Explicit play.
- This fits me.
- Refine with AI.
- Save to My Sounds.
- Open precise layer controls when needed.

The advanced mixer remains available after value is delivered. It is not a
separate first-class product or required workflow.

### My Sounds

Purpose: create personal switching cost and replay value.

P0 content:

- Saved sounds.
- Recent listening history.
- Favorites.
- Versions and variants.
- Sleep, return-to-sleep, calm, and focus groupings.

The current Studio surface must evolve into My Sounds. Creator analytics,
visibility operations, and publishing controls must not dominate this page.

### Explore

Purpose: provide safe starting points when the user does not know what to ask
for.

P1 content:

- Curated scenario starters.
- Approved sound families.
- Create my version.

Explore is not a creator marketplace or social ranking feed in the current
plan.

### Profile

Purpose: manage identity, preferences, devices, and subscription.

P0 content:

- Explicit likes and exclusions.
- Default duration and goal.
- Sound sensitivity controls.
- Subscription and entitlement state.
- Language and account settings.

## 6. Free And Paid Product

### Free

- Three personalized generations per week.
- One AI refinement per generated sound.
- Up to 30 minutes per session.
- Three saved sounds.
- Listening history.
- Background and lock-screen playback.
- Basic layer volume and mute controls.

The free tier must demonstrate the real personalized product. It must not be a
fixed-content demo.

### Plus

- A generous generation and refinement allowance.
- 60, 90, and 120 minute sessions and extended playback.
- Persistent preference memory.
- Unlimited saved sounds and versions within reasonable storage limits.
- Offline playback.
- Scenario variants derived from a trusted saved sound.
- Advanced layer and time-structure adjustments.
- Cross-device synchronization.

Initial packaging hypothesis:

- Monthly: USD 9.99.
- Annual: USD 39.99 with a seven-day trial.
- Optional launch offer: USD 29.99 annual founding plan.
- No lifetime plan in the initial release.

The paywall appears after the user has heard and accepted a useful result. The
primary paid message is persistent personalization, not access to a mixer.

## 7. Required Domain Objects

Recipe V2 remains the executable source of truth. Add consumer product objects
around it:

```text
UserSoundProfile
PreferenceEvidence
SavedSoundscape
SoundscapeVersion
ListeningSession
SubscriptionEntitlement
GenerationQuota
DevicePlaybackState
```

`UserSoundProfile` must distinguish:

- Explicit user facts from inferred preferences.
- Stable preferences from one-session instructions.
- Required sounds from preferred sounds.
- Exact exclusions from family exclusions.

Explicit user facts always override inference and can be viewed, changed, or
deleted by the user.

## 8. Development Plan

### Content Baseline Reset: Finished Content And Foundational Sounds

Status: active release blocker as of 2026-07-16.

Goal: make the product worth listening to, saving, and returning to before
continuing release mechanics.

Reference plan: [MixStil Content Baseline Rebuild Plan](./content-baseline-rebuild-plan.md).

Deliverables:

- Internal audible baseline: 30 finished content items and 80-100 foundational
  sounds.
- Paid Beta baseline: 80-100 finished content items and 150-250 foundational
  sounds.
- Clear Sleep, Calm, and Focus differentiation by human listening.
- Content factory flow from candidate to rights, human listening, combination
  QA, finished packaging, and release baseline.
- Explicit pause on subscription, payment, store submission, and noncritical
  device-release work until content value is credible.

Exit criteria:

- A listener can distinguish Sleep, Calm, and Focus without reading labels.
- Sampled finished content includes items worth saving and replaying.
- The product no longer feels like a generic white-noise or raw mixer demo.
- No content uses medical, therapeutic, cure, or guaranteed-outcome claims.

### Sprint 0: Product Reframe And Route Contract

Status: completed on 2026-07-14.

Goal: remove creator-first ambiguity without breaking the working Recipe V2
journey.

Deliverables:

- Replace creator and healing language with consumer listening language.
- Define the final Home, Create, Player, My Sounds, Explore, and Profile route
  responsibilities.
- Reframe Studio as My Sounds.
- Keep creator-only routes out of primary navigation.
- Preserve public sharing as a secondary consumer action.
- Add regression coverage for the revised navigation contract.

Exit criteria:

- A first-time consumer can describe, play, refine, save, and replay without
  encountering creator-business concepts.
- Existing Recipe V2 and Voice-free Beta validations still pass.

### Sprint 1: Mobile Listening Reliability

Status: implementation complete; physical-device release matrix pending.

Goal: make the product usable for real sleep and focus sessions.

Deliverables:

- Lock-screen and background playback.
- Audio interruption and resume handling.
- Long-session stability for 30, 60, 90, and 120 minutes.
- Mobile media controls.
- Browser and device playback-state recovery.
- System-language default with manual override.

Exit criteria:

- A supported mobile device can lock the screen and complete a long session
  without unexplained silence or recipe drift.
- Playback start success is at least 95 percent in automated and production
  telemetry.

### Sprint 2: My Sounds And Preference Memory

Status: completed on 2026-07-14.

Goal: turn a one-time generation into a reusable personal asset.

Deliverables:

- My Sounds library, history, favorites, and versions.
- UserSoundProfile and PreferenceEvidence persistence.
- Explicit preference and exclusion management.
- Generate a variant from a saved sound.
- One-tap replay for bedtime and return-to-sleep sounds.
- AI context that combines the current instruction with stable user facts.

Exit criteria:

- Saved versions replay the same frozen Recipe.
- Explicit exclusions remain enforced across future generations.
- A temporary instruction does not silently become a permanent preference.

### Sprint 3: Retention Home And Offline Use

Status: completed on 2026-07-14. Optional reminders remain deferred; they are
not required for the current retention loop.

Goal: make returning easier than starting over.

Deliverables:

- Continue last sound.
- Contextual bedtime, return-to-sleep, calm, and focus shortcuts.
- Offline download and cache governance.
- Optional reminders controlled by the user.
- Cross-device state synchronization.
- Recommendation limited to approved starters and the user's own sound history.

Exit criteria:

- A returning user reaches a trusted sound in one action.
- Offline playback uses the same frozen version and attribution rules as online
  playback.

### Sprint 4: Mobile Distribution Readiness

Status: in progress.

Goal: package the validated free product for consumer distribution before
introducing payment complexity.

Deliverables:

- Capacitor-based iOS and Android shell unless a native constraint requires a
  documented alternative.
- Privacy disclosures and account deletion.
- Store listing and consumer onboarding.
- Store build, signing, release-channel, and update infrastructure.

Exit criteria:

- Store builds pass background audio, privacy, and account deletion checks.
- The shipped product makes no voice or medical claim outside approved
  capability flags.

### Sprint 5: Subscription, Entitlements, Trials, And Payment

Goal: monetize only after the complete consumer value and retention loop is
available.

Deliverables:

- Free and Plus entitlements.
- Generation, refinement, duration, storage, and offline limits.
- Web billing and App Store / Play in-app subscription integration.
- Trial, purchase, restore, cancellation, refund, and grace-period states.
- Value-triggered paywall after a useful result.
- Paywall and plan packaging iteration using production-scale conversion,
  renewal, refund, and cost telemetry.
- Subscription analytics isolated from synthetic validation events.

Exit criteria:

- Free users can complete the full core loop within limits.
- Paid state is enforced consistently across web, API, and mobile clients.
- Purchase and restore pass on every supported store.
- Billing failure never destroys saved sounds or preferences.

## 9. Product Metrics And Gates

Technical gates:

- Playback start success: at least 95 percent.
- Recipe Ready P50: at most 5 seconds.
- Recipe Ready P95: at most 12 seconds.
- Frozen replay and final render remain Recipe V2 equivalent.
- No unapproved audible asset reaches a public or offline result.

Product and business targets:

- First-result acceptance or save: at least 40 percent.
- AI refinement success: at least 90 percent.
- At least 15 percent of activated users play on three different days within
  30 days.
- D35 paid conversion target: at least 3 percent.
- Annual-plan share target: at least 60 percent.
- Refund rate target: below 5 percent.
- AI, render, storage, and delivery cost: below 15 percent of first-year
  subscription revenue.

These are operating targets for production-scale telemetry. A small set of
subjective interviews cannot approve or reject the strategy.

## 10. Explicitly Deferred

- Small-business workspaces and client CRM.
- Creator branding, custom domains, and team collaboration.
- Creator marketplace, comments, private messages, payouts, and revenue share.
- Generic AI music generation.
- Arbitrary user uploads and voice cloning.
- Wearable, heart-rate, weather, and location adaptation.
- Production voice before the independent quality gate.
- Large undirected asset expansion.
- Medical, therapeutic, or guaranteed-outcome claims.

## 11. Priority Rule

When work competes for priority, use this order:

1. Does it improve the fit, speed, reliability, or controllability of the first
   playable result?
2. Does it make a trusted result easier to save and replay?
3. Does it improve explicit preference memory without weakening exclusions?
4. Does it create clear recurring paid value?
5. Does it improve mobile listening reliability and distribution?

If a task does not satisfy one of these questions, it is not current mainline
work. This document overrides creator-first PRDs and backlogs when they
conflict.
