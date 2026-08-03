#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

backup_dir="${BACKUP_DIR:-backups/postgres}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
output="$backup_dir/snooze-$timestamp.dump"

pg_dump --format=custom --no-owner --no-acl --file="$output" "$DATABASE_URL"
pg_restore --list "$output" >/dev/null
printf '%s\n' "$output"
