# Profile merge runbook

Duplicate `profiles` rows cause billing, analytics, and Zernio/GA to read different data. Code now uses `pickCanonicalProfile`, but **one row should remain per account** in Supabase.

## 1. Find duplicates

```bash
cd ~/agent7even-v2-clean
npx tsx --env-file=.env.local scripts/list-duplicate-profiles.ts
```

For one email:

```bash
npx tsx --env-file=.env.local scripts/list-duplicate-profiles.ts your@email.com
```

Each group shows **KEEP** (canonical — has Stripe/plan) and **MERGE→DELETE** (orphan).

## 2. Dry-run merge

```bash
npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --email your@email.com --dry-run
```

Review which tables will be reassigned.

## 3. Execute merge

```bash
npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts --email your@email.com --execute
```

Or merge two specific IDs (when you already know which to keep):

```bash
npx tsx --env-file=.env.local scripts/merge-duplicate-profiles.ts \
  --keep <canonical-uuid-from-KEEP-tag> \
  --orphan <orphan-uuid-from-MERGE-tag> \
  --dry-run
```

Replace UUIDs with values from `list-duplicate-profiles.ts`. The row tagged **KEEP** should have Stripe/plan; **MERGE→DELETE** is the orphan.

### Agent7even owner account

Use the **Clerk login email** for the v2 app (not `rovane@zwee.io` unless that is your Clerk primary). To find Agent7even company duplicates:

```bash
npx tsx --env-file=.env.local scripts/list-duplicate-profiles.ts
```

Look for groups where `company_name` is Agent7even or emails match your sign-in. Merge **each** duplicate group the list reports — typically:

1. Your Agent7even company login (may share a clerk_user_id with an older orphan row)
2. Any other emails that show `=== duplicate email ===` or `=== duplicate clerk_user_id ===`

Run dry-run then `--execute` **once per group** (one `--email` at a time).

1. Keeps the canonical profile (same rules as billing: Stripe → plan → oldest).
2. Copies missing GA/Zernio/Foundation/site-snapshot fields from orphan → canonical.
3. Reassigns `user_id` / `profile_id` FKs to canonical.
4. Adds orphan credit balance onto canonical.
5. Deletes the orphan profile row.

## After merge

- Hard refresh the dashboard.
- Analytics / Connect accounts should stop hitting “Profile not found”.
- No app redeploy required — this is data-only.

**Do not** merge profiles that are separate paying customers sharing nothing except a typo email — confirm KEEP row has ProAgent/Stripe before `--execute`.
