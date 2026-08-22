# Database schema (`db/`)

This directory is the **source of truth for the live database schema** on `www.agent7even.ai`.

## Background

Most tables in this project were created directly in the Supabase console. The repo has **no replayable migration history** for those objects — numbered files like `29_rls_policies.sql` are one-off scripts, not a full chain.

## Workflow

After **any** schema change in the Supabase console (new table, column, index, constraint):

1. Re-run the schema snapshot:
   ```bash
   SUPABASE_DB_URL='postgresql://…' npx tsx --env-file=.env.local scripts/f2-live-schema.ts
   ```
   Without `SUPABASE_DB_URL`, the script falls back to PostgREST OpenAPI introspection (less complete for constraints and indexes).

2. Commit the updated `schema_live_YYYY-MM-DD.sql` in the **same session** as the console change.

3. If you added RLS or app code that references the new shape, commit those together.

## Snapshots

| File | Notes |
|------|--------|
| `schema_live_2026-08-21.sql` | Pre–Phase 2 Maya fixes. `maya_sessions` indexes live-confirmed (see below). |

## Known drift (documented, not hidden)

- **`maya_sessions`:** `UNIQUE(user_id)` existed in early docs but was dropped in the live DB with no repo record. Multiple sessions per profile are intentional.
- **`maya_sessions.created_at`:** Referenced in legacy `CONTEXTV8` docs; **does not exist** live. Use `updated_at`.
- **`chat_sessions`:** Orphan table (0 rows). Removal pending Gate 2 confirmation — see Maya recon handoff F3.

## `maya_sessions` indexes (live-confirmed — no action)

Verified live 2026-08-22. The dashboard list query filters on `user_id`, orders by `updated_at DESC`, limit 20 — the composite index matches that pattern.

```sql
CREATE UNIQUE INDEX maya_sessions_pkey ON public.maya_sessions USING btree (id);
CREATE INDEX maya_sessions_user_id_idx ON public.maya_sessions USING btree (user_id);
CREATE INDEX idx_maya_sessions_user_updated ON public.maya_sessions USING btree (user_id, updated_at DESC);
```

`maya_sessions_user_id_idx` is redundant (composite index covers `user_id` as a leading prefix). Negligible write overhead; not worth a migration to drop.
