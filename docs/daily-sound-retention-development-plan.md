# Daily Sound Retention Development Plan

Date: 2026-07-20
Status: Implementation plan for the ToC retention loop

## Product Direction

SNOOZE should become a daily sound-state tool, not a generic journal, meditation
course library, or AI music generator.

The target loop is:

```text
Today check-in
  -> fitting playable sound
  -> listen
  -> one-tap fit feedback
  -> saved effective sound
  -> preference memory
  -> faster return use
```

The user pays for saved time, reliable fit, persistent preference memory,
longer listening, offline replay, and trusted sounds that are easy to reuse.

## Current Product Assets To Reuse

- `ConsumerHome`: already supports home feed, recent playback, offline fallback,
  and playback-state resume.
- `AIHealPage`: already supports goal, prompt, duration, preference-aware quick
  create, and handoff to Player.
- `PlayerPage`: already supports playback, AI refinement, basic adjustments,
  save to My Sounds, playback metrics, mobile recovery, and Media Session work.
- `StudioPage`: already serves as My Sounds with search, filters, playback,
  share, and offline copies.
- `ProfilePage`: already exposes explicit preferences, exclusions, default goal,
  default duration, and learned saved-sound preferences.

## Phase 1: Daily Entry And Check-in

Goal: make the first screen feel like a daily tool.

Deliverables:

- Rename the consumer mental model from Home to Today in copy.
- Add three state-first entries:
  - Tonight I need sleep.
  - I need to focus.
  - I need to settle down.
- Add common exclusion shortcuts for faster sound shaping.
- Keep free text available for users with a specific request.
- Preserve existing quick-create and Player routing.

Exit criteria:

- A user can start from a daily state and reach Player without learning the
  mixer or catalog.
- Build passes.

## Phase 2: Fit Feedback

Goal: convert listening into preference memory.

Deliverables:

- Add Player feedback buttons:
  - Fits me.
  - Too loud.
  - Too bright.
  - Too plain.
  - Do not use this sound again.
- Record feedback as `PreferenceEvidence` where appropriate.
- Distinguish one-session feedback from stable exclusions.
- Use feedback to improve next similar quick-create request.

Exit criteria:

- Fit feedback is visible after meaningful playback.
- Saving or accepting a sound creates controllable learned preference evidence.
- A rejected or excluded sound family does not return in the next similar
  request.

## Phase 3: Effective Sounds Library

Goal: turn My Sounds into a personal switching-cost surface.

Deliverables:

- Group saved/recent sounds by use case:
  - Sleep.
  - Return to sleep.
  - Focus.
  - Calm.
  - Offline.
- Show lightweight usage signals:
  - Last used.
  - Fit feedback count.
  - Available offline.
- Add "create similar" from a saved sound.

Exit criteria:

- A returning user can replay a trusted sound in one tap.
- Saved sounds feel like durable personal assets, not a generic list.

## Phase 4: Weekly Insight

Goal: give feedback without becoming a heavy diary product.

Deliverables:

- Add simple weekly insight cards:
  - Days listened.
  - Most reused goal.
  - Frequent exclusions.
  - Most replayed saved sound.
- Keep all language non-medical and non-guaranteed.

Exit criteria:

- The user gets a lightweight sense that SNOOZE is learning from use.
- Insights are based on listening and preference behavior, not medical claims.

## Phase 5: Paid Packaging

Goal: monetize only after value is proven.

Free should prove:

- Personalized daily check-in.
- Immediate playable result.
- Limited saved sounds.
- Basic listening history.
- Basic playback reliability.

Plus should unlock:

- Persistent preference memory.
- Unlimited or meaningfully expanded saved sounds.
- Longer 60/90/120 minute sessions.
- Offline playback.
- Cross-device playback state.
- More refinement and similar-variant generation.

Payment remains after consumer value, replay, offline, and mobile reliability
loops are stable.

## Metrics

- First-result acceptance or save rate.
- Repeat play on three different days within 30 days.
- Saved sound replay rate.
- Percentage of quick-create journeys started from Today check-in.
- Percentage of accepted sounds that become saved effective sounds.
- Plus conversion after at least one accepted or replayed sound.

