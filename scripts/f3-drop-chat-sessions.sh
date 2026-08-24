#!/usr/bin/env bash
# F3 — drop empty chat_sessions. Uses DIRECT_URL or SUPABASE_DB_URL via resolve-direct-db-url.ts.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="$(npx --yes tsx --env-file=.env.local scripts/resolve-direct-db-url.ts)"
PSQL="${PSQL:-psql}"
if [[ -x /opt/homebrew/opt/postgresql@17/bin/psql ]]; then
  PSQL="/opt/homebrew/opt/postgresql@17/bin/psql"
fi

exists="$("$PSQL" "$DB_URL" -tAc "select to_regclass('public.chat_sessions')")"
if [[ -z "$exists" ]]; then
  echo "chat_sessions already absent"
  exit 0
fi

count="$("$PSQL" "$DB_URL" -tAc "select count(*) from public.chat_sessions")"
echo "chat_sessions row count: $count"
if [[ "$count" != "0" ]]; then
  echo "Refusing to drop — table is not empty" >&2
  exit 1
fi

"$PSQL" "$DB_URL" -c "drop table if exists public.chat_sessions cascade"
after="$("$PSQL" "$DB_URL" -tAc "select to_regclass('public.chat_sessions')")"
if [[ -n "$after" ]]; then
  echo "Drop failed — table still exists" >&2
  exit 1
fi
echo "Dropped and verified: chat_sessions gone"
