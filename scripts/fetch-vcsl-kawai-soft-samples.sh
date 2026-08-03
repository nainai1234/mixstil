#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/audio-sources/vcsl-kawai-soft"
COMMIT="c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e"
BASE="https://raw.githubusercontent.com/sgossner/VCSL/$COMMIT"
PIANO_PATH="Chordophones/Zithers/Grand%20Piano%2C%20Kawai%20-%20Legacy/Sustains"

mkdir -p "$DEST"

curl -L --fail --silent --show-error \
  "$BASE/LICENSE" \
  -o "$DEST/LICENSE-CC0-1.0.txt"

for note in C2 F2 A2 C3 E3 G3 B3 D4 F4 A4 C5; do
  for layer in v1 v2; do
    curl -L --fail --silent --show-error \
      "$BASE/$PIANO_PATH/GrandPno_Main_Sus_${note}_${layer}_rr1.wav" \
      -o "$DEST/${note}_${layer}.wav"
  done
done

(
  cd "$DEST"
  shasum -a 256 LICENSE-CC0-1.0.txt ./*_v1.wav ./*_v2.wav > SHA256SUMS
)

echo "Fetched pinned VCSL CC0 Kawai soft samples into $DEST"
