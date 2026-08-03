#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RESTORE_FILE:?RESTORE_FILE is required}"

if [ "${CONFIRM_DATABASE_RESTORE:-}" != "RESTORE" ]; then
  printf '%s\n' "Set CONFIRM_DATABASE_RESTORE=RESTORE to confirm this destructive operation." >&2
  exit 1
fi

test -f "$RESTORE_FILE"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$RESTORE_FILE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select count(*) as users from users; select count(*) as stems from audio_stems;"
