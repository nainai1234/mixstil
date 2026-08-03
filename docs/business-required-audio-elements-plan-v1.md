# Business-Required Audio Elements Plan V1

Date: 2026-07-26  
Status: business inventory contract, not an audio-production batch  
Machine-readable contract: `config/business-required-audio-elements-v1.json`

## 1. Correction

The last feedback changes the question.

We should not ask: "What sound should this failed batch become?"

We should ask: "For this business, which reusable sound elements must exist so the product can create personalized Sleep, Calm, and Focus soundscapes?"

The product needs a structured inventory. A failed review such as "this sounds like cars on a highway" is not solved by making another arbitrary sound. It means our inventory categories and routing rules were too loose: generic continuous noise was acting as the main product identity.

## 2. Business Objective

The sound inventory exists to support this product loop:

```text
user need
  -> intent and exclusions
  -> selected reusable elements
  -> Recipe V2 arrangement
  -> immediate playable mix
  -> refinement
  -> saved replayable version
```

So every audio element must answer:

- What role does it play in a personalized mix?
- Can it be independently adjusted?
- Which user need does it serve?
- What should never be paired with it?
- Is it safe for long listening?
- Is it approved, merely a candidate, or only a reference?

## 3. Required Element Families

| Family | Why the business needs it | Examples | Important boundary |
| --- | --- | --- | --- |
| Playable instrument sources | Lets the system compose new music from notes, not reuse one fixed clip | felt piano, Rhodes, nylon guitar, soft strings, flute | Not a mixed MP3 or Lyria song |
| Structured composition material | Creates many different works from the same inventory | harmony templates, motifs, forms, grammars | This is data, not audio |
| Music beds and phrases | Provides light-music color when users ask for music or meditation-like material | pads, drones, sparse piano, soft guitar | No hooks, drums, or voice in Sleep/Calm defaults |
| Environment identity beds | Serves concrete scene requests | rain, room, forest, wind, distant water | Not generic highway-like whoosh |
| Masking/noise support | Optional smoothing or masking layer | pink/brown noise, band-limited noise | Support layer, not default product identity |
| Organic textures | Adds tactile character without becoming a scene | warm resonance, tape hush, wood/fabric softness | No road-like rumble or machine cycle |
| Accent and transition events | Gives sessions a beginning/end cue | soft bowl, bell tail, release swell | One-shot only, not a loop |
| Precise DSP configs | Exact technical signals when needed | noise config, reference tone, stereo offset | No healing/brainwave claims |
| Finished reference and seed content | Calibrates taste and provides replayable content | finished Sleep/Calm/Focus sessions, reference tracks | Not counted as foundational elements |

## 4. Minimum Counts

Internal audible baseline:

- 30 finished content items.
- 80-100 foundational elements.
- Enough coverage for Sleep, Calm, and Focus to sound different without reading labels.

Paid Beta baseline:

- 80-100 finished content items.
- 150-250 foundational elements.

V1 library:

- 200-300 finished content items.
- 400-600 foundational elements.

## 5. What This Means For Production

The next production work should not start with "generate another sound page."

It should start with an inventory audit against the business families above:

1. Which element families are already covered?
2. Which are only configured but not actually usable?
3. Which are candidates but failed human listening?
4. Which are missing enough depth to support personalization?
5. Which categories should be disabled as defaults because they create wrong product identity?

Only after that should we produce audio by family.

## 6. Recent QA Decision

`soothing-deterministic-combination-v1` is rejected as a business-default direction because the owner heard "cars on a highway."

Business interpretation:

- The product does not need generic continuous noise as the default main layer.
- Highway-like, road-like, fan-like, or whoosh-like layers should not become the default Sleep/Calm/Focus identity.
- Environment and noise elements are still useful, but only when routed by explicit user need or kept as low-volume support.

## 7. Next Correct Step

Create an inventory audit against `business-required-audio-elements-v1` and report:

- formal usable count;
- candidate count;
- failed count;
- missing count;
- recommended next production family.

That audit should decide the next production batch. Not taste guessing.
