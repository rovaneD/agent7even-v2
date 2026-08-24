#!/usr/bin/env bash
# Dump public schema via pg_dump. Uses direct connection (pooler :6543 fails for pg_dump).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-db/schema_live_2026-08-21.sql}"

if [[ ! -f .env.local ]]; then
  echo ".env.local not found — set SUPABASE_DB_URL there." >&2
  exit 1
fi

DB_URL="$(npx --yes tsx --env-file=.env.local scripts/resolve-direct-db-url.ts)"
PG_DUMP="${PG_DUMP:-$(command -v pg_dump)}"
if [[ -x /opt/homebrew/opt/postgresql@17/bin/pg_dump ]]; then
  PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
fi
mkdir -p "$(dirname "$OUT")"
"$PG_DUMP" "$DB_URL" --schema-only --schema=public --no-owner --no-privileges -f "$OUT"
echo "Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines)"
