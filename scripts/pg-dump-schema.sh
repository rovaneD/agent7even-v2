#!/usr/bin/env bash
# Dump public schema via pg_dump. Requires SUPABASE_DB_URL in .env.local (session pooler).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-db/schema_live_2026-08-21.sql}"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL not set. Add session pooler URI to .env.local (Supabase → Database → Connection string)." >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
pg_dump "$SUPABASE_DB_URL" --schema-only --schema=public --no-owner --no-privileges -f "$OUT"
echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
