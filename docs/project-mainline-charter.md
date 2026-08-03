# MixStil Project Mainline Charter

Date: 2026-07-14  
Status: Highest project execution constraint

Detailed execution plan: [ToC Product Development Master Plan](./toc-product-development-master-plan.md)

## 0. Highest Strategic Decision

MixStil is now ToC-first.

The product serves consumers who cannot reliably find a suitable fixed sleep,
calm, or focus sound. The user describes the current need, hears a fitting
result within seconds, continues refining it through AI conversation, saves it
to My Sounds, and returns to a trusted version later.

Small-business acquisition, creator workspaces, brand pages, client CRM,
marketplace distribution, and revenue sharing are not current mainline work.
Advanced editing, export, sharing, and analytics may remain as secondary or
future Pro capabilities, but they cannot define the primary consumer journey.

This charter and the ToC master plan override older creator-first product,
business architecture, information architecture, and MVP documents.

## 1. Product Goal

> A consumer describes the sound they need and receives, within seconds, a
> fitting and immediately playable personalized soundscape that can be refined,
> saved, reliably replayed, and improved over time from explicit preferences.

The product does not first optimize for generating more audio. It optimizes for
a result the user accepts, saves, and replays on multiple days.

The fixed mainline is:

```text
Need description
  -> AudioIntent: goal, scene, preferences, exclusions, and structure
  -> Recipe V2: deterministic approved-asset arrangement
  -> Live Mix: immediate playback
  -> continued AI refinement and optional precise controls
  -> frozen Saved Soundscape version
  -> My Sounds replay
  -> explicit preference memory
  -> subscription for persistent personalization and deeper use
```

Recipe V2 is the technical foundation shared by Live Mix, saved versions,
offline playback, and final rendering. It is no longer the unfinished product
milestone; the unfinished milestone is the ToC retention and payment loop above
it.

## 2. Current Release Scope

The first public release remains Voice-free Beta:

- Sleep, Calm, and Focus use approved environment, noise, accent, and music
  assets.
- Voice and TTS are not exposed in Create, Player, My Sounds, Explore, sharing,
  or advanced controls.
- A request for voice degrades honestly to a fitting voice-free result.
- Historical audible Voice tracks are filtered from Beta playback and blocked
  from public, offline, or rendered release.
- Production voice requires an independent script, pronunciation, rights,
  safety, and listening-quality gate.

## 3. Current Mainline

Recipe V2, Voice-free Beta regression, frozen versions, rendering, sharing,
technical QA, and approved-asset constraints are implemented and validated.

Sprint 0 through Sprint 3 implementation were completed on 2026-07-14. The
active mainline is Sprint 4: iOS/Android distribution readiness. Sprint 1's
physical-device background, interruption, and 30/60/90/120 minute release
matrix remains a mandatory Sprint 4 store gate. Subscription and payment remain
last.

2026-07-16 correction: content value is now the active release blocker. The
goal-diversity listening QA failed because the current Sleep, Calm, and Focus
outputs do not yet feel meaningfully different or worth paying for. Until the
[Content Baseline Rebuild Plan](./content-baseline-rebuild-plan.md) reaches at
least the Internal Audible Product Baseline, noncritical device-release testing,
store-submission preparation, subscription, trials, entitlements, and payment
must pause. Playback reliability remains necessary after the content baseline
exists, but stable playback of weak content is not product readiness.

The current development order is:

```text
Sprint 0: consumer route and language reframe
  -> Content Baseline Reset: finished content and foundational sound inventory
  -> Sprint 1: mobile background and long-session reliability
  -> Sprint 2: My Sounds and explicit preference memory
  -> Sprint 3: returning-user Home and offline use
  -> Sprint 4: iOS/Android distribution readiness
  -> Sprint 5: subscription, entitlements, trials, and payment
```

No later Sprint may displace an unfinished earlier Sprint unless this charter
is explicitly changed.

## 4. Priority Test

Before starting work, answer in order:

1. Does it improve first-result fit, speed, reliability, or controllability?
2. Does it make a trusted sound easier to save and replay?
3. Does it improve explicit preference memory while preserving exclusions?
4. Does it create clear recurring paid consumer value?
5. Does it improve mobile listening reliability or distribution?

If every answer is no, the task is not current mainline work.

## 5. Product Rules

- Result before tools.
- AI conversation is the primary refinement interface.
- Explicit exclusions override defaults, inference, and recommendation.
- A local edit changes only the requested portion of the Recipe.
- My Sounds is the primary retention surface.
- Replay is more important than a broad catalog or social feed.
- Approved assets, authorization, acoustic QA, and reproducibility are product
  features, not backend details.
- Do not use medical, therapeutic, frequency-effect, or guaranteed-outcome
  claims.
- Small subjective samples do not decide strategy. Use large-scale external
  evidence, model-based reasoning, and production-scale behavior, payment,
  renewal, refund, and cost telemetry.

## 6. Metrics

Technical gates:

- Playback start success at least 95 percent.
- Recipe Ready P50 at most 5 seconds.
- Recipe Ready P95 at most 12 seconds.
- Frozen replay and final rendering remain Recipe V2 equivalent.
- No unapproved audible asset reaches a public or offline result.

Product and business targets:

- First-result acceptance or save at least 40 percent.
- AI refinement success at least 90 percent.
- At least 15 percent of activated users play on three different days within
  30 days.
- D35 paid conversion at least 3 percent.
- Annual-plan share at least 60 percent.
- Refund rate below 5 percent.
- AI, rendering, storage, and delivery cost below 15 percent of first-year
  subscription revenue.

## 7. Explicitly Deferred

- Small-business workspaces, client CRM, and custom domains.
- Creator marketplace, public rankings, comments, messages, payouts, and
  revenue share.
- Generic AI music generation.
- Large undirected asset expansion.
- Wearable, heart-rate, weather, and location adaptation.
- Arbitrary uploads, open-ended treatment scripts, and voice cloning.
- Production voice before its independent release gate.

## 8. Sprint Discipline

Every Sprint must deliver:

- One complete consumer journey.
- Automated regression coverage.
- Real browser or device verification appropriate to the feature.
- Honest capability and QA boundaries.
- A direct explanation of which mainline metric or paid value improved.

Page count, API count, asset count, AI calls, and decorative polish are not
success metrics.
