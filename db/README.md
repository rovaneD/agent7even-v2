# Database schema (`db/`)

This directory is the **source of truth for the live database schema** on `www.agent7even.ai`.

## Background

Most tables in this project were created directly in the Supabase console. The repo has **no replayable migration history** for those objects — numbered files like `29_rls_policies.sql` are one-off scripts, not a full chain.

## Workflow

After **any** schema change in the Supabase console (new table, column, index, constraint):

1. Re-run the schema snapshot:
   ```bash
   bash scripts/pg-dump-schema.sh db/schema_live_2026-08-21.sql
   ```
   Uses `DIRECT_URL` or `SUPABASE_DB_URL` from `.env.local` (Session pooler, port 5432). Requires PostgreSQL 17 `pg_dump` (Homebrew: `postgresql@17`).

2. Commit the updated `schema_live_YYYY-MM-DD.sql` in the **same session** as the console change.

3. If you added RLS or app code that references the new shape, commit those together.

## Snapshots

| File | Notes |
|------|--------|
| `schema_live_2026-08-21.sql` | Live `pg_dump --schema-only` (5039 lines). Includes constraints, indexes, RLS policies. |

## Known drift (documented, not hidden)

- **`maya_sessions`:** `UNIQUE(user_id)` existed in early docs but was dropped in the live DB with no repo record. Multiple sessions per profile are intentional.
- **`maya_sessions.created_at`:** Referenced in legacy `CONTEXTV8` docs; **does not exist** live. Use `updated_at`.
- **`chat_sessions`:** Orphan table removed 2026-08-24 (0 rows). Dropped live; no longer in schema dump.

## `maya_sessions` indexes (live-confirmed — no action)

Verified live 2026-08-22. The dashboard list query filters on `user_id`, orders by `updated_at DESC`, limit 20 — the composite index matches that pattern.

```sql
CREATE UNIQUE INDEX maya_sessions_pkey ON public.maya_sessions USING btree (id);
CREATE INDEX maya_sessions_user_id_idx ON public.maya_sessions USING btree (user_id);
CREATE INDEX idx_maya_sessions_user_updated ON public.maya_sessions USING btree (user_id, updated_at DESC);
```

`maya_sessions_user_id_idx` is redundant (composite index covers `user_id` as a leading prefix). Negligible write overhead; not worth a migration to drop.

## `DIRECT_URL` / `SUPABASE_DB_URL` for pg_dump

Copy **Session pooler** (port **5432**) from the top-bar **Connect** button. Prefer `DIRECT_URL` in `.env.local`; scripts also accept `SUPABASE_DB_URL`. Remove `[` `]` placeholder brackets from passwords.

For `jianzyolobriaqpttamt`, pooler host is **`aws-1-us-east-1.pooler.supabase.com`**.

```bash
bash scripts/pg-dump-schema.sh db/schema_live_2026-08-21.sql
bash scripts/f3-drop-chat-sessions.sh   # only if re-running drop
```
