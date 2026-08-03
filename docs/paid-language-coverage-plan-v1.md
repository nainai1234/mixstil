# SNOOZE 90% Paid-Language Coverage Plan V1

Date: 2026-08-01  
Status: 90% paid-language active coverage baseline  
Scope: consumer UI language coverage for paid internet and app-subscription audience

## Decision

SNOOZE will expand language support toward an estimated 90% of addressable paid
internet users, but language activation must remain quality-gated.

The target is not raw speaker population. It is the addressable audience most
likely to pay for a consumer subscription app: high-income app markets,
subscription habit, mobile payment maturity, and strategic growth markets.

## Active Consumer UI

The current active consumer UI languages are:

```text
zh, en, hi, es, ar, bn, pt, ru, ja, id, de, fr, ko, it, nl,
zh-Hant, tr, pl, sv, th, vi, ms, he, da, no, fi
```

These are already exposed in Profile and are required to pass the consumer
localization and language-preference contracts.

## Paid Coverage Batch 1 Activated

These languages are now part of the active consumer UI set:

```text
de, fr, ko, it, nl
```

Rationale:

- German: Germany, Austria, and Switzerland are high-ARPU subscription markets.
- French: France, Canada, Belgium, Switzerland, and long-run francophone reach.
- Korean: South Korea is a high-spend mobile and subscription market.
- Italian: Italy adds mature Western European paid coverage.
- Dutch: Netherlands and Belgium add high payment density despite smaller size.

Activation gate:

- Consumer Home, Create, Player, My Sounds, Explore, Profile, Support, Privacy,
  Audio Credits, share pages, public work pages, and Plus waiting page must all
  have localized copy.
- System-language detection must map regional codes correctly.
- Manual Profile language selection may show the language only after the above
  surfaces pass validation.
- Mobile bundle, iOS sync, and Android sync must pass.

## Paid Coverage Batch 2 Activated

```text
zh-Hant, tr, pl, sv, th
```

Rationale:

- Traditional Chinese covers Taiwan and Hong Kong as distinct high-value markets.
- Turkish adds a large mobile-first market.
- Polish adds strong Central and Eastern European paid coverage.
- Swedish opens the Nordic high-ARPU localization pattern.
- Thai adds a mature Southeast Asian mobile and digital-payment market.

Activation gate:

- Consumer UI language selection, system-language mapping, Create, Player, My
  Sounds, Profile, Explore, core sharing, support, privacy, credits, and Plus
  boundary copy must pass automated localization validation.
- Traditional Chinese maps from `zh-TW`, `zh-HK`, and `zh-MO`.
- Batch 2 still needs native copy review before App Store or Play Store listing
  localization is treated as final.

## Paid Coverage Batch 3 Activated

```text
vi, ms, he, da, no, fi
```

Rationale:

- Vietnamese and Malay expand Southeast Asian growth coverage.
- Hebrew adds Israel, a small but high-ARPU technology market.
- Danish, Norwegian, and Finnish complete more Nordic high-ARPU coverage after
  Swedish validates the pattern.

Activation gate:

- Consumer UI language selection, system-language mapping, Create, Player, My
  Sounds, Profile, Explore, core sharing, support, privacy, credits, and Plus
  boundary copy must pass automated localization validation.
- Norwegian maps from `no`, `nb`, and `nn`.
- Hebrew requires a real RTL visual pass before store submission readiness is
  claimed.

## Product Rules

- Do not implement payment, checkout, subscriptions, App Store products, Google
  Play billing, trials, or entitlements as part of language expansion.
- Do not expose a language in Profile until it is fully localized across the
  consumer path.
- Do not call English fallback a completed localization.
- Do not expand admin or creator surfaces ahead of consumer listening,
  saving, replay, sharing, support, privacy, and Plus boundary pages.
- Right-to-left languages require a layout and text-fit audit before activation.

## Implementation Order

1. Register paid-coverage roadmap in code.
2. Add a validator that checks active vs planned languages and release gates.
3. Localize Batch 1 pages across all consumer surfaces.
4. Extend language preference contract from active-core to active-plus-Batch-1.
5. Only then expose Batch 1 in Profile and system-language activation.
6. Repeat the same gate for Batch 2 and Batch 3.
7. Keep native copy review and physical-device text-fit validation as release
   evidence gates, separate from code activation.

## Native Review Registry

The structured review source of truth is
`data/paid-language-native-review.json`. Batch 1, 2, and 3 locales may be
machine-ready and available for internal testing while remaining
`pending_native_review`. Machine validation never changes a locale to
`approved`; approval requires a named native reviewer and review timestamp.

Arabic and Hebrew set the document direction to RTL at runtime. This engineering
behavior is automated, while final linguistic approval and physical-device
text-fit evidence remain separate release gates.
