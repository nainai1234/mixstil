# Human Listening QA Checklist

Updated: 2026-07-11

## Purpose

This checklist turns the remaining subjective audio review into a repeatable gate. It does not replace automated render QA, license checks, or voice QA. It records the human judgment needed before a Recipe V2 mix or controlled voice preview can be treated as product-quality.

Mainline protected by this checklist:

```text
AudioIntent V2 -> Recipe V2 -> Live Mix -> deterministic edit -> frozen version -> final render
```

## Review setup

- Use wired headphones or a known neutral monitor.
- Set system volume to a comfortable fixed level before the first item and do not change it during one session.
- Review in a quiet room.
- Listen to rendered MP3 first, then Live Mix when a workbench link is provided.
- If fatigue appears, stop after 5 long works or 20 minutes and continue in a new session.

## Required verdicts

Each reviewed item must end with exactly one verdict:

- `pass`: product-ready for the current scope.
- `needs_fix`: a specific issue must be fixed before public use.
- `reject`: the sound does not fit the scene or has an unacceptable artifact.

Do not use `pass` when the reviewer only skimmed the intro.

## Ten standard works: minimum listening pass

For each of the 10 catalog works:

1. Listen to the first 60 seconds.
2. Jump to the middle and listen for 60 seconds.
3. Listen to the final 30 seconds.
4. If the source loops are shorter than the work, listen across at least one likely loop boundary.
5. Record one sentence explaining the verdict.

The internal `/internal/listening-qa` workbench enforces this as evidence:

- Intro, Middle, and Final must each be checked for every standard work.
- Each standard work must also have a non-pending verdict.
- `Save Final` stays disabled until all 10 standard works meet those conditions.
- Draft reports can still be saved during a partial review.

### Scoring fields

Use 1-5 scoring for each field:

| Field | Pass threshold | What to listen for |
| --- | ---: | --- |
| Scene fit | >= 4 | The mix supports its stated goal and scene. |
| Balance | >= 4 | Base and environment layers feel intentional; no layer dominates by accident. |
| Loop smoothness | >= 4 | No obvious seam, click, gap, repeated bump, or rhythmic distraction. |
| Transient safety | >= 4 | No startling peaks, sharp ticks, harsh highs, or sudden low-frequency thumps. |
| Fatigue risk | >= 4 | The sound remains comfortable and non-annoying after repeated exposure. |

A work can only pass if all five fields are at least 4 and no blocking notes are present.

## Controlled voice preview: minimum listening pass

For each controlled TTS preview promoted toward production:

1. Confirm the script is from an approved block or a safe whitelisted edit.
2. Listen to the voice alone once.
3. Listen inside Live Mix once.
4. Apply `人声更慢` or the equivalent slower-voice edit when relevant, then listen again.
5. Confirm export remains blocked unless voice QA approves script safety, pronunciation, rights, commercial use, and derivative use.

### Voice scoring fields

| Field | Pass threshold | What to listen for |
| --- | ---: | --- |
| Script safety | required | No medical promise, diagnosis, coercive hypnosis, or high-risk suggestion. |
| Pronunciation | >= 4 | Words are intelligible and language pronunciation is acceptable. |
| Pacing | >= 4 | Default and slowed versions are comfortable and do not feel rushed. |
| Ducking comfort | >= 4 | Background lowers naturally under voice and recovers without pumping. |
| Voice/music balance | >= 4 | Voice is audible without feeling too loud or pasted on top. |
| Noise/artifact | >= 4 | No clipped syllables, robotic glitches, harsh sibilance, or broken fades. |

Voice previews remain blocked from production export until the voice QA workflow records the rights and safety approval separately.

## Blocking issues

Any of the following forces `needs_fix` or `reject`:

- Clicks, pops, gaps, or obvious loop seams.
- Startling transient in a sleep or return-to-sleep scene.
- Harsh high-frequency rain, insects, water, or voice sibilance.
- Low-frequency rumble that masks the rest of the scene or feels uncomfortable.
- Voice timing that starts before the listener has settled.
- Ducking that pumps, clamps the background too hard, or fails to recover smoothly.
- A scene mismatch, such as focus energy inside a sleep recipe.
- Any medical, therapeutic, guaranteed-effect, or coercive wording.
- Any stem or voice whose rights or QA status does not allow the intended use.

## Session output

Every listening session should produce a report in `reports/` with:

- reviewer name or initials;
- date;
- playback device;
- environment;
- generated checklist table;
- pass/fix/reject verdicts;
- notes and follow-up issue list.

Use:

```bash
pnpm qa:listening-session
```

to generate the current session template.
