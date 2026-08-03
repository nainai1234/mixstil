#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-docs/asset-batch-04-nature.tsv}"
batch_name="${2:-batch-04}"
output_dir="public/audio/nature/$batch_name"
mkdir -p "$output_dir"

download_one() {
  local item_id="$1"
  local slug="$2"
  local output="$output_dir/$slug.wav"

  if [[ ! -s "$output" ]] || ! ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output" >/dev/null 2>&1; then
    curl --fail --location --silent --show-error \
      "https://assets.mixkit.co/active_storage/sfx/$item_id/$item_id.wav" \
      --output "$output"
  fi
  ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$output" >/dev/null
  echo "verified $item_id $output"
}

export output_dir
export -f download_one
tail -n +2 "$manifest" | awk -F '\t' '{print $1, $2}' | xargs -n 2 -P 8 bash -c 'download_one "$1" "$2"' _
