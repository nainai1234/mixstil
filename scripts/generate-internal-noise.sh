#!/usr/bin/env bash
set -euo pipefail

output_dir="${1:-public/audio/noise/internal}"
duration="${NOISE_DURATION_SECONDS:-90}"
mkdir -p "$output_dir"

generate() {
  local filename="$1"
  local source="$2"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "$source" \
    -t "$duration" -ac 2 -ar 44100 -codec:a libmp3lame -b:a 160k \
    "$output_dir/$filename.mp3"
  echo "generated $filename.mp3"
}

generate white_soft "anoisesrc=color=white:amplitude=0.075:r=44100,highpass=f=80,lowpass=f=12500"
generate white_deep "anoisesrc=color=white:amplitude=0.085:r=44100,highpass=f=45,lowpass=f=6500"
generate pink_balanced "anoisesrc=color=pink:amplitude=0.10:r=44100,highpass=f=35,lowpass=f=11000"
generate pink_soft "anoisesrc=color=pink:amplitude=0.075:r=44100,highpass=f=60,lowpass=f=7500"
generate brown_deep "anoisesrc=color=brown:amplitude=0.14:r=44100,highpass=f=28,lowpass=f=5000"
generate brown_soft "anoisesrc=color=brown:amplitude=0.10:r=44100,highpass=f=35,lowpass=f=3500"
generate fan_low "anoisesrc=color=pink:amplitude=0.11:r=44100,highpass=f=70,lowpass=f=1800,tremolo=f=0.22:d=0.10"
generate fan_medium "anoisesrc=color=pink:amplitude=0.10:r=44100,highpass=f=100,lowpass=f=2800,tremolo=f=0.34:d=0.12"
generate fan_high "anoisesrc=color=white:amplitude=0.075:r=44100,highpass=f=180,lowpass=f=4500,tremolo=f=0.48:d=0.09"
generate airplane_cabin "anoisesrc=color=brown:amplitude=0.12:r=44100,highpass=f=35,lowpass=f=2200,tremolo=f=0.10:d=0.05"
generate train_carriage "anoisesrc=color=pink:amplitude=0.10:r=44100,highpass=f=45,lowpass=f=3200,tremolo=f=1.35:d=0.08"
generate air_conditioner "anoisesrc=color=brown:amplitude=0.11:r=44100,highpass=f=45,lowpass=f=2400,tremolo=f=0.18:d=0.08"
generate humidifier "anoisesrc=color=white:amplitude=0.065:r=44100,highpass=f=250,lowpass=f=6000,tremolo=f=0.12:d=0.04"
generate distant_highway "anoisesrc=color=brown:amplitude=0.09:r=44100,highpass=f=30,lowpass=f=1400,tremolo=f=0.10:d=0.07"
generate quiet_room "anoisesrc=color=pink:amplitude=0.042:r=44100,highpass=f=90,lowpass=f=4200"
