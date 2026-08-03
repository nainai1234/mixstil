# SNOOZE Content Baseline Rebuild Plan

Date: 2026-07-16  
Status: New execution focus pending charter update  
Owner: Product/content systems

## 0. Decision

The current Voice-free Beta content base is not strong enough to support paid
retention.

The recent goal-diversity listening QA failed because Sleep, Calm, and Focus
outputs still collapse toward similar low-value noise beds. That failure is a
product-value failure, not only an audio-balancing issue. Stable device playback
does not create paid value if the content is not worth saving and replaying.

Until a credible content baseline exists, the project should pause noncritical
device-release work, store-submission preparation, subscription implementation,
and large undirected asset expansion.

The new near-term goal is:

> Build a minimum content base that makes SNOOZE feel like a real personalized
> listening product rather than a weak noise mixer.

## 1. Market Reality

Large meditation and sleep products are content products first. Their technical
players, mixers, and subscriptions sit on top of a large, polished, searchable,
and repeatedly useful content library.

Reference points:

- BetterSleep describes an advanced sound mixer with over 500 sounds and
  melodies, plus SleepTales, meditations, hypnosis, music, mixes, and sleep
  tools.
- Calm's Sleep Stories are structured content mixing narration, music, sound
  effects, and voice acting; its help center describes over 300 stories with
  weekly additions.
- Headspace Sleepcasts are structured 45-55 minute experiences with wind-down,
  relaxing environment visualization, ambient noise, and subtle replay
  variation.
- Insight Timer describes a library of 300,000+ guided practices, meditations,
  sleep tracks, music, courses, and breathwork.

SNOOZE should not try to match those absolute counts at launch. But it cannot
charge for a product experience that sounds like a handful of generic white
noise variants.

## 2. Content Strategy

SNOOZE needs two content layers.

### Layer A: Finished Content

Finished content is directly listenable, nameable, saveable, and replayable.
It is what makes the product feel valuable before the user opens any advanced
controls.

Finished content can be:

- voice-free sound journeys;
- sleep soundscapes;
- calm and meditation music beds;
- focus soundscapes;
- prebuilt combinations of environment, music, noise, and accent events;
- later, guided voice content after the separate voice gate passes.

Every finished item must have:

- a human-readable title;
- a primary scene;
- a target listener need;
- a duration family;
- a content structure;
- approved ingredients;
- an audible identity;
- a replay reason;
- a QA verdict.

It is not acceptable to expose anonymous variants such as `noise variant 01` or
bare combinations that only prove the mixer can play audio.

### Layer B: Foundational Sounds

Foundational sounds are the approved ingredients used by the system and by
advanced users to create personalized versions.

Foundational sounds are not automatically product content. They must carry
metadata that makes them useful in combinations:

- source family;
- scene fit;
- loop safety;
- event density;
- brightness;
- low-frequency weight;
- foreground/background role;
- startle risk;
- long-listen fatigue risk;
- recommended gain range;
- compatible and incompatible pairings;
- license and derivative-use status.

The purpose of foundational sounds is not count inflation. The purpose is to
make good combinations possible.

## 3. Minimum Paid Beta Inventory

The first paid-capable content baseline should target:

| Inventory area | Count | Purpose |
| --- | ---: | --- |
| Finished Sleep content | 30 | Bedtime, return-to-sleep, low-stimulation night listening |
| Finished Calm content | 30 | Emotional settling, meditation, breath-friendly sound journeys |
| Finished Focus content | 20 | Deep work, neutral background, low-distraction masking |
| Special scenario content | 10 | Nap, late-night reset, anxious wind-down, quiet room, travel |
| Foundational sleep beds | 40-60 | Room tone, wind, soft mechanical, brown/pink noise, low event density |
| Foundational nature/environment sounds | 30-50 | Rain, forest, night, distant water, wind, but only after fatigue and event QA |
| Foundational music beds | 30-40 | Pads, drones, soft piano, ambient guitar, low harmonic texture |
| Foundational focus beds | 20-30 | Office, train, aircraft, distant traffic, restrained mechanical textures |
| Foundational accent events | 20-30 | Bells, bowls, soft transitions, one-shot cues, non-looping detail |

Minimum launch-like target:

- 80-100 finished content items.
- 150-250 foundational sounds.

This is not the final competitive library. It is the smallest baseline that can
credibly support "describe, hear, refine, save, and replay" without feeling
like a toy.

## 4. Formal Milestones

### Milestone 1: Internal Audible Product Baseline

Target:

- 30 finished content items.
- 80-100 foundational sounds.
- At least 10 each across Sleep, Calm, and Focus.

Pass criteria:

- A blind listener can distinguish Sleep, Calm, and Focus families without
  reading labels.
- At least 6 of 10 sampled finished items feel worth saving.
- No item sounds like a generic placeholder, raw noise export, or accidental
  test file.
- No medical or guaranteed-outcome claim is embedded in title, description, or
  generated copy.

### Milestone 2: Paid Beta Baseline

Target:

- 80-100 finished content items.
- 150-250 foundational sounds.
- At least 20 content items with strong replay value.
- At least 30 content items suitable for 30+ minute sessions.

Pass criteria:

- A first-time user can find or generate a useful result in the first session.
- The system can generate clearly different Sleep, Calm, and Focus outputs.
- The user can save a version and understand why they would return to it.
- AI refinement changes the requested part of the sound without destroying the
  whole arrangement.

### Milestone 3: V1 Content Library

Target:

- 200-300 finished content items.
- 400-600 foundational sounds.
- Weekly content-production rhythm.
- Production analytics for save rate, replay rate, skip rate, refund reasons,
  and repeated preference signals.

Pass criteria:

- Content no longer depends on manual demos to feel credible.
- Explore, Create, and My Sounds all have enough depth to support repeat use.
- The paid message can honestly emphasize persistent personalization, offline
  access, longer sessions, and high-quality saved versions.

## 5. Content Families To Build First

### Sleep

Goal: quiet, safe, low-stimulation content people can trust at night.

Initial finished content:

- Quiet Room Cocoon.
- Soft Brown Night.
- Warm Fan Sleep.
- Rainless Dark Room.
- Low Wind Shelter.
- Return-to-Sleep Cabin.
- No-Water Bedtime Pad.
- Late-Night Apartment Tone.
- Gentle Train Night.
- Deep Blanket Noise.

Required qualities:

- low event density;
- no sudden foreground accents;
- no bright birds, voices, chatter, applause, or human activity;
- no water unless explicitly selected;
- stable perceived loudness;
- no obvious loop fatigue.

### Calm

Goal: emotional settling and meditation-adjacent listening that has aesthetic
value even without voice.

Initial finished content:

- Warm Breathing Space.
- Grounded Ambient Pad.
- Forest Edge Stillness.
- Soft Bell Exhale.
- Open Room Meditation.
- Gentle Guitar Horizon.
- Low Piano Reflection.
- Floating Evening Calm.
- Slow Body Scan Bed.
- Quiet After-Work Reset.

Required qualities:

- audible music or harmonic identity;
- enough space and warmth to feel intentional;
- not just noise under a title;
- slow movement, but no eerie suspense;
- optional one-shot accents only where they support structure.

### Focus

Goal: clean background that masks distraction without feeling sleepy or busy.

Initial finished content:

- Quiet Train Focus.
- Neutral Office Flow.
- Cabin Noise Workspace.
- Low Anchor Pad.
- Warm Mechanical Focus.
- Distant Traffic Shield.
- Clean Pink Focus.
- Soft Air Conditioner Flow.
- Workroom Steady State.
- Open Air Concentration.

Required qualities:

- stable enough for work;
- slightly clearer and more upright than sleep content;
- music may be present but must not demand attention;
- no sudden attention-capturing events;
- no bedtime softness as the dominant identity.

## 6. Content Factory

SNOOZE should not let user-facing prompts generate final paid content directly.
Generated audio enters a content factory first.

Required factory flow:

```text
Content gap or product brief
  -> reference selection
  -> generation or sourcing
  -> technical QA
  -> rights QA
  -> human listening QA
  -> semantic tagging
  -> combination QA
  -> finished content packaging
  -> release baseline
  -> user-facing personalization
```

Generation tools can include:

- local or hosted music generation for ambient pads and harmonic beds;
- sound-effect/environment generation for rare accents or transition details;
- licensed third-party libraries for high-quality core recordings;
- deterministic synthesis only where simple noise or low-frequency beds are
  actually the right content;
- later, TTS and voice generation after script, pronunciation, safety, and
  listening gates pass.

The factory must keep these states separate:

- candidate;
- technically valid;
- rights approved;
- human-listening passed;
- combination approved;
- finished content;
- released;
- rejected.

## 7. User Generation Model

User-facing generation should select, combine, and refine from a strong content
base. It should not pretend that a weak asset pool can become premium content
through prompting alone.

Correct model:

```text
User describes current need
  -> intent and exclusions
  -> retrieve high-quality finished content and foundational sounds
  -> produce a personalized arrangement
  -> play immediately
  -> refine locally
  -> save version
  -> learn explicit preferences
  -> generate better variants next time
```

Long-term retention comes from:

- fresh finished content entering the library;
- better user preference memory;
- scenario variants derived from trusted saved sounds;
- user-visible improvement after explicit likes and exclusions;
- reliable replay and offline access after the content is already valuable.

## 8. QA Gates

Every finished content item must pass:

- audible identity gate: the item has a clear reason to exist;
- scene-fit gate: Sleep, Calm, and Focus are perceptually different;
- long-listen gate: no obvious fatigue, loop, harshness, or startle issue;
- title and description gate: no medical, therapeutic, cure, or guaranteed
  outcome claims;
- rights gate: commercial and derivative use are explicitly allowed;
- release gate: all ingredients are approved and reproducible.

Every foundational sound must pass:

- source-identity check;
- no-human-voice hard gate;
- technical decode and loudness check;
- loop or one-shot classification;
- scene metadata;
- recommended gain range;
- incompatibility notes;
- rights evidence.

## 9. What To Stop For Now

Pause:

- Android 30/90/120 long-session QA, except when needed to preserve already
  completed technical work.
- Store-submission preparation.
- Subscription, trials, entitlements, and payment.
- Generic asset scraping.
- Machine-only diversity tuning.
- More blind listening pages that ask the product owner to rate weak content.

Continue only if it supports content value:

- source review;
- music and environment generation research;
- content factory workflow;
- QA reports that make a promotion or rejection decision;
- player and save flows needed to judge whether a finished item is worth
  keeping.

## 10. Immediate Next Work

Batch 001 production inputs were created, but the first listening reaction
rejected the direction: the previews still felt like white-noise/noise-bed
variants rather than save-worthy personalized content. Batch 001 should not be
used as the current promotion candidate set.

- Finished content briefs:
  `data/content-baseline/finished-content-briefs-v1.json`.
- Foundational sound gaps:
  `data/content-baseline/foundational-sound-gaps-v1.json`.
- Rejected first 10 audible candidate previews:
  `data/content-baseline/content-baseline-batch-001-manifest.json`.
- Rejected review page:
  `/review/content-baseline-batch-001/index.html`.
- Historical validation:
  `pnpm validate:content-baseline-batch-001`.
  `pnpm validate:content-baseline-audio-batch-001`.

Batch 002 corrected the most obvious Batch 001 problem, but it is not a product
pass. Owner listening found that the music itself can be attractive and
save-worthy, with no major suddenness problem, but the result still feels like
ordinary music rather than therapeutic, meditation, focus, or personalized
soundscape content. The environment layer is occasionally pleasant, but the
overall arrangement does not create a state change; it attracts listening
attention instead of guiding sleep, calm, focus, or meditation.

Batch 002 should therefore be treated as a partial learning, not a promotion
candidate:

- 9 music-forward previews, balanced across Sleep / Calm / Focus:
  `data/content-baseline/content-baseline-batch-002-manifest.json`.
- Review page:
  `/review/content-baseline-batch-002/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-002`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-002`.
- Hard listening gate:
  reject any candidate that still primarily feels like white/pink/brown noise
  or lacks an audible melody, chord change, or resonant musical event in the
  first 30 seconds.

Batch 003 tested arrangement-level soundscape design, not just music
selection:

- The main value must come from the whole mix, not from an isolated music track.
- Music, noise, and environment layers need intentional entrances, exits,
  volume movement, and rest sections.
- White/pink/brown noise or room tone may appear, but only as structured
  masking or transition material, not as a static bed.
- Environmental events should feel placed and purposeful, not pasted under
  music.
- The listening question becomes: does the piece help the user enter a state
  instead of merely giving them something pleasant to hear?

Batch 003 production outputs were created:

- 5 arrangement/state-transition previews:
  `data/content-baseline/content-baseline-batch-003-manifest.json`.
- Review page:
  `/review/content-baseline-batch-003/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-003`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-003`.

Batch 003 should not be promoted. Owner listening found one useful improvement:
it sounded more like a process than ordinary music. But it still failed the
content-value gate:

- the opening felt too loud and immediate, more like a "whoosh" than a quiet
  invitation;
- noise and environment were more harmonious than before, but still a little
  harsh;
- the blend felt forced rather than naturally composed;
- it did not help the listener enter sleep, meditation, relaxation, or focus.

Batch 004 is the direct correction. It is intentionally smaller and stricter:

- 4 quiet-entry previews:
  `data/content-baseline/content-baseline-batch-004-manifest.json`.
- Review page:
  `/review/content-baseline-batch-004/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-004`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-004`.
- Machine gate:
  first 12 seconds must stay below -18 dB max peak to prevent the "opened too
  loudly" failure from recurring.

Batch 004 should not be promoted. Owner listening found that, except for the
third candidate, the first 20-30 seconds were almost inaudible. Around 30
seconds, the support/noise layer became too loud and felt like it occupied
roughly half of the perceived content. The deeper failure was "form without
soul": the ingredients were present, but the result still did not help the
listener enter meditation, relaxation, sleep, or focus.

Batch 005 is the direct correction:

- 4 music-led previews:
  `data/content-baseline/content-baseline-batch-005-manifest.json`.
- Review page:
  `/review/content-baseline-batch-005/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-005`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-005`.
- Design rule:
  no generated white/pink/brown noise. Music, resonance, pad, and harmonic
  structure must carry the state entry; room or environment layers may only act
  as low-level spatial glue.
- Machine gate:
  the first 30 seconds must be audible but not forceful, and each candidate
  must contain at least two musical/harmonic roles while keeping room/noise-like
  support to at most one layer.

Next listening decision:

1. Open Batch 005 and judge whether the first 30 seconds now provide a gentle
   but audible entrance.
2. Judge whether the supporting texture has truly become decoration rather than
   the main perceived content.
3. Most importantly, judge whether any candidate has "soul": a state-entry
   feeling beyond assembled elements.
4. If Batch 005 still has form without soul, stop iterating level envelopes on
   existing tracks and move to a dedicated original structured sound-journey
   factory.

Batch 005 should not be promoted. Owner listening found that the problem has
now moved from simple mixing toward music semantics:

- the first Sleep candidate was labeled as sleep but the music felt cheerful,
  festive, and oddly happy, so the scene label destroyed trust;
- the fourth Focus candidate still felt like white noise and was
  uncomfortable;
- the other two candidates were more normal mainly because their music choice
  was less semantically wrong.

Batch 006 is therefore not another broad mix test. It is a semantic music
filter test:

- 3 previews only, one each for Sleep, Calm, and Focus:
  `data/content-baseline/content-baseline-batch-006-manifest.json`.
- Review page:
  `/review/content-baseline-batch-006/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-006`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-006`.
- Design rule:
  Sleep must avoid cheerful, festive, bright, romantic, or performative music.
  Focus must avoid white/pink/brown noise perception, room-tone masking, fan
  masking, and traffic masking. Calm must keep warmth and intentional space
  without using hiss as breath.
- Promotion gate:
  if the music semantics still fail, the next step is not volume adjustment;
  it is a dedicated original structured sound-journey factory with explicit
  composition briefs before rendering.

Owner listening found Batch 006 "OK" but still not foundational enough. This
means the next content problem is ownership of the underlying sound language,
not another search through existing music files. Start the original structured
sound factory:

- Factory Batch 001 outputs:
  `data/content-baseline/original-structured-sound-factory-batch-001-manifest.json`.
- Review page:
  `/review/original-structured-sound-factory-batch-001/index.html`.
- Generation:
  `pnpm generate:original-structured-sound-factory-batch-001`.
- Validation:
  `pnpm validate:original-structured-sound-factory-batch-001`.
- Scope:
  three project-original, deterministic, voice-free, non-noise harmonic
  substrates for Sleep, Calm, and Focus.
- Important distinction:
  these are foundational substrates, not finished content. They should be
  judged on whether they feel like reusable low-level SNOOZE sound material.
  Finished journeys should be composed from these substrates plus carefully
  selected environment and accent events only after the substrate direction
  passes.

Factory Batch 001 should be treated as rejected. Owner listening identified an
obvious mechanical/electric quality and questioned why such a sound would
appear in meditation or sleep content. That is a correct rejection: a substrate
that feels like machine tone, electrical hum, pulse engine, vibrator-like
pressure, or physically harmful vibration is not acceptable for sleep or
meditation, even if its loudness is technically safe.

Factory Batch 002 changes the factory rule:

- Outputs:
  `data/content-baseline/organic-structured-sound-factory-batch-002-manifest.json`.
- Review page:
  `/review/organic-structured-sound-factory-batch-002/index.html`.
- Generation:
  `pnpm generate:organic-structured-sound-factory-batch-002`.
- Validation:
  `pnpm validate:organic-structured-sound-factory-batch-002`.
- Scope:
  organic source-based reference substrates only; no deterministic synth pulse,
  no machine engine, no white/pink/brown noise file, no fan/traffic masking
  layer.
- Placement rule:
  if a noise-like air layer is used at all, it must be perceived as decoration
  only, roughly below 10 percent of attention. It cannot be the content.

Owner listening found Factory Batch 002 overall not uncomfortable. However,
`Focus Organic Clear Bed 001` was correctly identified as music-like. It should
therefore be classified as a Focus music bed or finished-content ingredient,
not as neutral foundational noise or a generic base sound.

Batch 008 is a placement demo:

- Outputs:
  `data/content-baseline/content-baseline-batch-008-manifest.json`.
- Review page:
  `/review/content-baseline-batch-008/index.html`.
- Generation:
  `pnpm generate:organic-placement-demo-batch-008`.
- Validation:
  `pnpm validate:organic-placement-demo-batch-008`.
- Decision:
  material that sounds like music is allowed only when the product labels and
  places it as a music bed. It must not be used to inflate the foundational
  sound inventory.

Batch 008 should not be promoted as-is. Owner listening found:

- the first and second candidates were not uncomfortable, but they were not
  natural enough and the perceived noise/air layer was too loud;
- the third candidate was good, but it was essentially music.

Batch 009 corrects the classification and placement:

- Outputs:
  `data/content-baseline/content-baseline-batch-009-manifest.json`.
- Review page:
  `/review/content-baseline-batch-009/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-009`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-009`.
- Rule:
  Sleep and Calm should be music-first for this test, with no insect, room,
  fan, traffic, or obvious air/noise bed. Focus may keep the accepted direction
  only if it is labeled as a music bed, not as foundational sound.
- Product implication:
  the current promising material belongs to finished music beds and
  finished-content ingredients. The separate foundational sound inventory still
  needs quieter, more primitive, non-song air/space/texture assets.

Batch 009 should not be promoted as-is. Owner listening found:

- the first Sleep and third Focus candidates are music beds, but they are still
  too loud/too noisy in perceived musical activity;
- the second Calm candidate is a hard reject because it feels uncomfortable,
  hellish, and horror-like.

Batch 010 corrects those failures:

- Outputs:
  `data/content-baseline/content-baseline-batch-010-manifest.json`.
- Review page:
  `/review/content-baseline-batch-010/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-010`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-010`.
- Rule:
  Sleep and Focus keep the music-bed direction but are pushed further back.
  Calm must avoid singing bowls, dark resonance, ritual/horror semantics,
  oppressive pads, insect/air/room/noise layers, and any source that feels like
  a "hell" sound.

Batch 010 is a partial pass. Owner listening found the candidates are good, but
likely because the music itself is good; the result still sounds almost purely
like music, with little non-music soundscape character.

Batch 011 tests a narrow next step:

- Outputs:
  `data/content-baseline/content-baseline-batch-011-manifest.json`.
- Review page:
  `/review/content-baseline-batch-011/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-011`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-011`.
- Rule:
  keep Batch 010 music beds as the main content and add only micro organic
  texture, intended around 1-5 percent perceived share. If the texture is
  clearly heard as noise or becomes attention-capturing, reject the candidate.
- Product implication:
  the promising finished-content path is music-led soundscapes, not raw
  foundational noise. Foundational sounds still need a separate inventory, but
  finished content should first prove a save-worthy music-led experience.

Batch 011 is the first clearly positive direction. Owner listening found it
"much stronger" than prior attempts. The working formula is:

- music bed remains the main content;
- non-music texture exists only as micro organic space, not as audible noise;
- the result should be judged as a finished music-led soundscape, not as a
  foundational sound.

Batch 012 refines the winning direction into saveable candidates:

- Outputs:
  `data/content-baseline/content-baseline-batch-012-manifest.json`.
- Review page:
  `/review/content-baseline-batch-012/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-012`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-012`.
- Rule:
  build from the accepted Batch 011 direction; add only musical release/width
  where needed; do not reintroduce foreground noise, wind, rain, room tone,
  dark resonance, or horror semantics.

Owner listening promoted Batch 012 as the first save/replay-worthy direction:
"我愿意保存下来，下次还会打开". Batch 012 is therefore promoted as an
Internal Audible Product Baseline seed, not as a public release:

- Promotion manifest:
  `data/content-baseline/content-baseline-batch-012-promotion.json`.
- Promotion report:
  `reports/content-baseline-batch-012-promotion-2026-07-17.md`.
- Promotion command:
  `pnpm promote:content-baseline-batch-012`.
- Validation:
  `pnpm validate:content-baseline-batch-012-promotion`.
- Status:
  three seed finished soundscapes, one each for Sleep, Calm, and Focus.
- Accepted formula:
  quiet music bed as the main content, with micro organic texture or musical
  release below attention.
- Boundary:
  this does not satisfy public release depth yet. It is the first formula to
  scale toward 30 finished items for the Internal Audible Product Baseline.

Batch 013 is the first scale test from the Batch 012 seed:

- Outputs:
  `data/content-baseline/content-baseline-batch-013-manifest.json`.
- Review page:
  `/review/content-baseline-batch-013/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-013`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-013`.
- Scope:
  six nearby finished soundscape candidates, two each for Sleep, Calm, and
  Focus.
- Rule:
  every candidate must inherit the Batch 012 formula and build from the
  promoted Batch 012 seeds. Support layers must remain below attention and
  must not reintroduce rejected source families such as obvious wind, room,
  traffic, white/pink/brown noise, mechanical pulse, or dark resonance.

Owner listening promoted all Batch 013 candidates: "都愿意保存，下次还会打开".
This proves the Batch 012 formula is reproducible beyond the original three
seeds.

- Promotion manifest:
  `data/content-baseline/content-baseline-batch-013-promotion.json`.
- Promotion report:
  `reports/content-baseline-batch-013-promotion-2026-07-17.md`.
- Promotion command:
  `pnpm promote:content-baseline-batch 013`.
- Validation:
  `pnpm validate:content-baseline-batch-promotion 013`.
- Status:
  six additional Internal Audible Product Baseline seeds, two each for Sleep,
  Calm, and Focus.
- Current baseline count:
  nine save/replay-worthy finished soundscape seeds: three from Batch 012 plus
  six from Batch 013.
- Next target:
  reach 30 finished soundscapes while preserving the formula and adding enough
  scene diversity to avoid near-duplicate inflation.

Batch 014 continues the scale-up with scene coverage:

- Outputs:
  `data/content-baseline/content-baseline-batch-014-manifest.json`.
- Review page:
  `/review/content-baseline-batch-014/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-014`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-014`.
- Scope:
  six candidates across Nap, Late Night, Morning Calm, Evening Release,
  Reading Focus, and Deep Work.
- Rule:
  use promoted Batch 013 items as the main body; add only 1-3 percent musical
  support. Do not add obvious environment/noise layers and do not create
  title-only duplicates.

Owner listening promoted all Batch 014 candidates: "都愿意保存复听." This
brings the Internal Audible Product Baseline seed count to 15:

- Batch 012: 3 save/replay-worthy seeds.
- Batch 013: 6 save/replay-worthy seeds.
- Batch 014: 6 save/replay-worthy seeds.

Batch 014 promotion records:

- Promotion manifest:
  `data/content-baseline/content-baseline-batch-014-promotion.json`.
- Promotion report:
  `reports/content-baseline-batch-014-promotion-2026-07-17.md`.
- Promotion command:
  `pnpm promote:content-baseline-batch 014`.
- Validation:
  `pnpm validate:content-baseline-batch-promotion 014`.

Next target: add 6 more scene-diverse finished soundscapes to reach 21 seeds,
then continue to 27 and 30 while preserving diversity and avoiding duplicate
inflation.

Batch 015 continues the expansion toward 21 seeds:

- Outputs:
  `data/content-baseline/content-baseline-batch-015-manifest.json`.
- Review page:
  `/review/content-baseline-batch-015/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-015`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-015`.
- Scope:
  six candidates across Travel Rest, Restless Mind, Midday Recenter, Before
  Meeting, Writing Flow, and Low Energy Admin.
- Rule:
  use promoted Batch 014 items as the main body; add only 1-3 percent musical
  support. Continue avoiding obvious environment/noise layers, mechanical
  pulse, dark resonance, and title-only duplicates.

Owner listening promoted all Batch 015 candidates: "这 6 条都愿意保存复听".
This brings the Internal Audible Product Baseline seed count to 21:

- Batch 012: 3 save/replay-worthy seeds.
- Batch 013: 6 save/replay-worthy seeds.
- Batch 014: 6 save/replay-worthy seeds.
- Batch 015: 6 save/replay-worthy seeds.

Batch 015 promotion records:

- Promotion manifest:
  `data/content-baseline/content-baseline-batch-015-promotion.json`.
- Promotion report:
  `reports/content-baseline-batch-015-promotion-2026-07-17.md`.
- Promotion command:
  `pnpm promote:content-baseline-batch 015`.
- Validation:
  `pnpm validate:content-baseline-batch-promotion 015`.

Next target: add 6 more finished soundscapes to reach 27 seeds, then produce a
final 3-item closing batch to reach the 30-item Internal Audible Product
Baseline target.

Batch 016 continues the expansion toward 27 seeds:

- Outputs:
  `data/content-baseline/content-baseline-batch-016-manifest.json`.
- Review page:
  `/review/content-baseline-batch-016/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-016`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-016`.
- Scope:
  six candidates across Anxious Bedtime, Early Morning Return, Emotional
  Buffer, Weekend Unwind, Coding Focus, and Study Focus.
- Rule:
  use promoted Batch 015 items as the main body; add only 1-3 percent musical
  support. Continue avoiding obvious environment/noise layers, mechanical
  pulse, dark resonance, and title-only duplicates.

Owner listening promoted all Batch 016 candidates: "愿意保存、下次还会打开".
This brings the Internal Audible Product Baseline seed count to 27:

- Batch 012: 3 save/replay-worthy seeds.
- Batch 013: 6 save/replay-worthy seeds.
- Batch 014: 6 save/replay-worthy seeds.
- Batch 015: 6 save/replay-worthy seeds.
- Batch 016: 6 save/replay-worthy seeds.

Batch 016 promotion records:

- Promotion manifest:
  `data/content-baseline/content-baseline-batch-016-promotion.json`.
- Promotion report:
  `reports/content-baseline-batch-016-promotion-2026-07-17.md`.
- Promotion command:
  `pnpm promote:content-baseline-batch 016`.
- Validation:
  `pnpm validate:content-baseline-batch-promotion 016`.

Next target: produce a final 3-item closing batch to reach the 30-item Internal
Audible Product Baseline target. Batch 017 should avoid padding the count with
near duplicates; choose three missing, high-retention use cases and keep the
same accepted formula: music-led finished soundscape, extremely low support
layers, no white-noise foreground, no mechanical pulse, no dark resonance, no
medical or guaranteed-effect claims.

Batch 017 is the 3-item closing batch toward 30 seeds:

- Outputs:
  `data/content-baseline/content-baseline-batch-017-manifest.json`.
- Review page:
  `/review/content-baseline-batch-017/index.html`.
- Generation:
  `pnpm generate:content-baseline-batch-017`.
- Validation:
  `pnpm validate:content-baseline-audio-batch-017`.
- Scope:
  one candidate per goal: Phone Down Bedtime, After Work Release, and Reading
  Low Distraction.
- Rule:
  use promoted Batch 016 items as the main body; add only 1-3 percent musical
  support. Batch 017 must earn approval as three real save/replay use cases,
  not as filler to reach the 30-item count.

Owner listening promoted all Batch 017 candidates: "愿意保存、下次还会打开".
This completes the first 30-item Internal Audible Product Baseline:

- Batch 012: 3 save/replay-worthy seeds.
- Batch 013: 6 save/replay-worthy seeds.
- Batch 014: 6 save/replay-worthy seeds.
- Batch 015: 6 save/replay-worthy seeds.
- Batch 016: 6 save/replay-worthy seeds.
- Batch 017: 3 save/replay-worthy seeds.
- Total: 30 save/replay-worthy internal baseline seeds.

Batch 017 promotion records:

- Promotion manifest:
  `data/content-baseline/content-baseline-batch-017-promotion.json`.
- Promotion report:
  `reports/content-baseline-batch-017-promotion-2026-07-17.md`.
- Promotion command:
  `pnpm promote:content-baseline-batch 017`.
- Validation:
  `pnpm validate:content-baseline-batch-promotion 017`.

Internal Audible Product Baseline completion note:

- The baseline is complete as an internal product-quality seed set, not as a
  public catalog launch by itself.
- The working formula is music-led finished soundscape first, with extremely
  low support layers only when they improve continuity or scene specificity.
- Rejected directions remain blocked: white-noise foreground, obvious
  mechanical/pulse beds, dark or horror-like resonance, abrupt loud openings,
  medical/treatment claims, and filler variations made only to increase count.
- Next implementation work should connect these 30 seeds to the consumer
  creation/replay loop: content registry, scenario mapping, Recipe/intent
  selection, first-result diversity checks, and My Sounds replay evidence.

2026-07-17 implementation follow-through:

- Added `server/internalBaselineCatalog.ts` to register all 30 promoted seeds
  as owner-approved internal baseline stems and Catalog Recipes.
- Updated `/api/quick-create` so generic Sleep, Calm, and Focus requests can
  select the 30-item baseline instead of falling back to weak noise-led default
  combinations.
- Updated legacy `/api/ai/sessions` to reuse the same planner and baseline
  selection path, removing the older direct brown/pink/rain/music stem
  assembly path for ordinary AI generation.
- Preserved explicit exclusions: requests such as "不要音乐" or "只要雨声" must
  not be overridden by the music-led internal baseline.
- Added `pnpm validate:internal-baseline-catalog` to verify all 30 seeds are
  registered, local audio files exist, generic Sleep/Calm/Focus select baseline
  seeds, and no-music / rain-only requests remain exclusion-safe.
- Real API smoke check after restart confirmed:
  - generic sleep prompt selected
    `stem_content_baseline_sleep_027_phone_down_bedtime`;
  - legacy AI Sessions calm prompt selected
    `stem_content_baseline_calm_023_after_work_release`;
  - explicit no-music pink-noise prompt did not select an internal baseline
    seed.

2026-07-17 user-loop follow-through:

- Player now displays a visible "Save/replay baseline match" card when the
  generated Recipe came from a promoted internal baseline seed.
- Quick Create `recipe_ready` telemetry includes `internalBaselineSeed`.
- Save-to-My-Sounds `work_saved` telemetry includes `internalBaselineSeed`.
- Added `pnpm validate:internal-baseline-user-loop` to verify the complete
  loop: generic need -> internal baseline selection -> playable content-baseline
  audio -> private My Sounds save -> frozen Recipe metadata retained -> explicit
  no-music request still bypasses the baseline.
- Latest validation result: `sleep_027_phone_down_bedtime` selected for a
  generic anxious sleep request, saved as a private My Sounds item with a frozen
  Recipe version, while a no-music pink-noise prompt did not select a baseline
  seed.

2026-07-17 first-result diversity follow-through:

- Expanded internal baseline selection with explicit scenario aliases for
  sleep, calm, and focus needs, including night waking, nap, travel rest,
  anxious bedtime, phone-down bedtime, after-work release, pre-meeting settle,
  emotional buffer, weekend unwind, reading, writing, coding, study, and
  low-energy admin.
- Updated `pnpm validate:internal-baseline-catalog` so 15 representative
  natural-language prompts must map to their intended promoted seeds.
- Latest validation result: 15 scenario prompts selected 15 distinct internal
  baseline seeds while explicit no-music and rain-only requests still bypassed
  the music-led baseline.
- This prevents the 30-item baseline from behaving like one generic good sound;
  first results now vary by user need before any manual refinement.

2026-07-17 match-reason follow-through:

- Internal baseline selection now produces durable match metadata:
  `seedId`, `title`, `goal`, `scene`, `matchedSignals`, `matchReason`, and
  owner listening verdict.
- Recipe V2 stores the metadata under `quickCreate.internalBaselineMatch`, so
  the explanation survives save, freeze, and My Sounds replay.
- Player now shows a "Why this sound" card for baseline results instead of a
  generic internal label.
- Latest validation result: a generic sleep prompt retained this user-facing
  reason after save/freeze: "Matched your bedtime sleep request from cues like
  “睡不好”, then used an owner-approved save/replay baseline for sleep."

2026-07-17 save/replay product-loop correction:

- Corrected the Player save flow so "Save to My Sounds" now opens a
  save-first dialog instead of a creator-style public-publishing dialog.
- The first-save dialog now defaults to private replay, explains that the
  sound is private by default, and keeps public publishing as an explicit
  opt-in.
- Updated `pnpm validate:publication-choice-ui` to enforce the ToC consumer
  loop: save privately for replay first, publish publicly only when selected.
- Latest validation results:
  - `pnpm -s tsc --noEmit`
  - `pnpm validate:publication-choice-ui`
  - `pnpm validate:internal-baseline-catalog`
  - `pnpm validate:internal-baseline-user-loop`
  - `pnpm validate:mainline-journey`
- Current status: the promoted 30-item internal audible baseline is no longer
  only a review asset pool. It is connected to generic consumer creation,
  scenario-diverse first results, visible match explanation, private My Sounds
  save/freeze, and replay metadata retention.

2026-07-17 saved-preference feedback loop:

- Saving an internal baseline result to My Sounds now records stable
  `saved_sound` preference evidence with the selected baseline seed, goal,
  scene, canonical scene, and match metadata.
- Quick Create and legacy AI Sessions now read recent saved baseline evidence
  before selecting an internal baseline seed.
- Saved baseline preference is used as a positive ranking signal only within
  the same goal and canonical scene, so it improves similar future requests
  without overriding clearly different scenes.
- Explicit exclusions still win: no-music and single-source natural/noise
  requests bypass the music-led internal baseline even if the user previously
  saved a baseline result.
- Added `pnpm validate:saved-baseline-preference-loop` to verify the full
  behavior: save baseline -> evidence appears in sound profile -> similar
  request reuses saved seed -> return-to-sleep still selects its specific seed
  -> no-music request still bypasses baseline.

2026-07-17 visible preference control follow-through:

- Added a user-controlled learned-preference surface in Profile:
  "Learned from saved sounds".
- Profile now shows saved baseline learning signals with a plain-language
  explanation of how they affect similar future requests.
- Users can remove learned saved-sound evidence without editing manual likes or
  exclusions.
- Added `DELETE /api/me/preference-evidence/:id` for owned, non-explicit
  preference evidence. Explicit profile preferences remain controlled through
  the profile fields.
- Strengthened saved-baseline ranking so an exact saved seed can guide similar
  same-scene future requests, while canonical scene boundaries and explicit
  exclusions still override it.
- Latest validation result: saving `sleep_027_phone_down_bedtime` made a
  similar bedtime request reuse that seed; removing the evidence stopped that
  reuse; return-to-sleep still selected `sleep_020_return_sleep_soft_floor`;
  no-music still bypassed the baseline.

## References

- BetterSleep FAQ, "What does BetterSleep offer?", retrieved 2026-07-16.
- Calm Help Center, "Calm Sleep Stories: Harry Styles, Matthew McConaughey &
  Full List", retrieved 2026-07-16.
- Headspace Help Center, "What is a Sleepcast?", retrieved 2026-07-16.
- Insight Timer Support, "What Free Features Does Insight Timer Offer?",
  retrieved 2026-07-16.
- `reports/goal-diversity-listening-qa-user-feedback-2026-07-15.md`.
- `reports/content-release-manifest-2026-07-15.md`.
