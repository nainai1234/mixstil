#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/audio-sources/discord-cc0-band"
COMMIT="7a9c478fe331f94f246d33332f0adedb25bbbe27"
BASE="https://raw.githubusercontent.com/sfzinstruments/Discord-SFZ-GM-Bank/$COMMIT/Discord%20GM/Melodic"
mkdir -p "$DEST/guitar" "$DEST/bass" "$DEST/rhodes"

guitar_files=(
  MartinGM2_040__E2_1.wav MartinGM2_043__G2_1.wav MartinGM2_046_Bb2_1.wav
  MartinGM2_049_Db3_1.wav MartinGM2_052__E3_1.wav MartinGM2_055__G3_1.wav
  MartinGM2_058_Bb3_1.wav MartinGM2_061_Db4_1.wav MartinGM2_064__E4_1.wav
  MartinGM2_068_Ab4_1.wav MartinGM2_071__B4_1.wav MartinGM2_074__D5_1.wav
  MartinGM2_077__F5_1.wav MartinGM2_080_Ab5_1.wav MartinGM2_083__B5_1.wav
)
for file in "${guitar_files[@]}"; do
  curl -L --fail --silent --show-error "$BASE/026-Acoustic%20Guitar%20%28steel%29/$file" -o "$DEST/guitar/$file"
done

bass_files=(killer_bass_c2_vl1.wav killer_bass_gb2_vl1.wav killer_bass_c3_vl1.wav killer_bass_gb3_vl1.wav killer_bass_c4_vl1.wav)
for file in "${bass_files[@]}"; do
  curl -L --fail --silent --show-error "$BASE/034-Electric%20Bass%20%28finger%29/$file" -o "$DEST/bass/$file"
done

rhodes_files=(A_040__E2_3.wav A_045__A2_3.wav A_050__D3_3.wav A_055__G3_3.wav A_059__B3_3.wav A_062__D4_3.wav A_065__F4_3.wav A_071__B4_4.wav A_076__E5_4.wav)
for file in "${rhodes_files[@]}"; do
  curl -L --fail --silent --show-error "$BASE/005-Electric%20Piano%201/$file" -o "$DEST/rhodes/$file"
done

curl -L --fail --silent --show-error "https://raw.githubusercontent.com/sfzinstruments/Discord-SFZ-GM-Bank/$COMMIT/README.md" -o "$DEST/UPSTREAM-README.md"
(
  cd "$DEST"
  shasum -a 256 UPSTREAM-README.md guitar/* bass/* rhodes/* > SHA256SUMS
)
echo "Fetched pinned CC0 guitar, finger bass, and Rhodes samples into $DEST"
