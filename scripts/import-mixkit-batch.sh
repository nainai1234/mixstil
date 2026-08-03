#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-docs/asset-batch-02.tsv}"

tail -n +2 "$manifest" | while IFS=$'\t' read -r item_id slug _name category _source_path _tags _volume _scene; do
  case "$category" in
    Nature) output_dir="public/audio/nature/batch-02" ;;
    Accent) output_dir="public/audio/accent/batch-02" ;;
    *) echo "unsupported category: $category" >&2; exit 1 ;;
  esac

  mkdir -p "$output_dir"
  output="$output_dir/$slug.wav"
  if [[ -s "$output" ]] && ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output" >/dev/null 2>&1; then
    echo "verified existing $item_id $output"
    continue
  fi
  curl --fail --location --silent --show-error \
    "https://assets.mixkit.co/active_storage/sfx/$item_id/$item_id.wav" \
    --output "$output"
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output" >/dev/null
  echo "imported $item_id $output"
done
