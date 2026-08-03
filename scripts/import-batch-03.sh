#!/usr/bin/env bash
set -euo pipefail

music_manifest="docs/asset-batch-03-music.tsv"
voice_manifest="docs/asset-batch-03-voice-candidates.tsv"
music_dir="public/audio/music/batch-03"
voice_dir="public/audio/voice/candidates"
liaoyu_voice_dir="/Users/pang/project/liaoyu/public/generated/vocal"

mkdir -p "$music_dir" "$voice_dir"

tail -n +2 "$music_manifest" | while IFS=$'\t' read -r item_id slug _name _family _tags _volume _scene; do
  output="$music_dir/$slug.mp3"
  if [[ ! -s "$output" ]]; then
    curl --fail --location --silent --show-error \
      "https://assets.mixkit.co/music/$item_id/$item_id.mp3" \
      --output "$output"
  fi
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output" >/dev/null
  echo "verified music $item_id $output"
done

tail -n +2 "$voice_manifest" | while IFS=$'\t' read -r _source_id slug _name _language source_file _tags _volume _review; do
  source="$liaoyu_voice_dir/$source_file"
  output="$voice_dir/$slug.mp3"
  [[ -f "$source" ]] || { echo "missing voice source: $source" >&2; exit 1; }
  cp "$source" "$output"
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output" >/dev/null
  echo "verified voice $output"
done
