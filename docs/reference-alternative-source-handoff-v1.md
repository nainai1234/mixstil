# Alternative Reference Source Handoff V1

Date: 2026-07-21

The YouTube downloads were blocked by the platform bot check. This handoff records only alternate sources that were directly matched by title and creator. These files are temporary copies for acoustic and structure analysis; they are not product assets and are not used in user playback.

## Completed

- `sleep_ocean_eight_hour`: official Soothing Relaxation SoundCloud upload, 11,078.055 seconds. The complete MP3 is retained; a 1,800-second beginning sample was analyzed with beginning, middle, and end windows.
- `focus_affection`: official Jinsang SoundCloud upload, 115.589 seconds. The complete track was analyzed.

## Found but not downloadable

Brian Eno `An Ending (Ascent)`, Ólafur Arnalds `saman`, and Hariprasad Chaurasia `Raga Yaman` have exact official SoundCloud pages, but their stream responses are DRM-protected. They remain pending and were not replaced with covers or unrelated uploads.

## Still unresolved

The remaining twelve IDs are listed in `config/reference-alternative-sources-v1.json`. Search results that were only previews, remixes, covers, album excerpts, or uploader copies were rejected. A 30-second preview is not promoted to formal analysis.

## Verification rule

An alternate source must match title and creator and pass first-30-second identity verification before it can enter the formal analysis manifest. Full tracks under 30 minutes are analyzed completely; longer tracks require at least 1,800 seconds with beginning, middle, and end coverage.
