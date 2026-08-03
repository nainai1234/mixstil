# Creator Validation Cohort Runbook

Date: 2026-07-13  
Status: current mainline validation procedure

## Purpose

Validate the real product loop with 10-20 people without adding a QA surface to the customer product:

```text
genuine description -> first playback -> accept / adjust / retry -> save -> publish/share -> later replay
```

This is not a catalog listening test. Participants use the normal `/ai-heal` and player experience.

## Cohort Setup

Choose one URL-safe cohort ID, for example `pilot-2026-07-a`, and assign anonymous participant IDs `P01` through `P20`.

Give each participant a unique normal-product URL:

```text
http://localhost:5174/ai-heal?cohort=pilot-2026-07-a&participant=P01
```

The identifiers are only attached to telemetry. They are not shown in the product UI. Do not put names, phone numbers, email addresses, or health information in either identifier.

## Participant Task

1. Enter a real current need in their own words. Do not give them a prepared prompt.
2. Generate and explicitly start playback.
3. Choose whether the first result fits, needs a local adjustment, or needs a new direction.
4. If adjusting, describe only the change they actually want.
5. Save and publish only if the work is genuinely worth keeping.
6. Open the work again later if they genuinely want to replay it.

The facilitator must not tell participants which result they should accept.

## Report

Run the cohort-specific report:

```bash
pnpm report:creator-validation -- --cohort=pilot-2026-07-a
```

Optional filters:

```bash
pnpm report:creator-validation -- --cohort=pilot-2026-07-a --participant=P01
pnpm report:creator-validation -- --cohort=pilot-2026-07-a --since=2026-07-13 --until=2026-07-28
```

The report includes participant count, first-result acceptance, adjustment-to-save, publish/share creation, replay, repeated exclusions, repeated adjustment requests, and per-journey evidence.

## Decision Rule

Do not add assets from one person's isolated preference. Rank repeated failures first:

1. Intent understood, but no matching approved supply.
2. Matching supply exists, but retrieval or compatibility scoring chose incorrectly.
3. Recipe structure or balance was wrong.
4. The requested local adjustment was unsupported or failed.
5. Playback, save, publish, or share failed technically.

Only repeated category 1 failures become an asset acquisition or generation backlog. TTS remains a separately deferred production gate.
