# CONTEXTV14 - Loop Integrity Closed, Hub Live in Prod, Maya Context Architecture
*Snapshot: June 10, 2026*

**Superseded by `CONTEXTV15.md` (June 10 evening)** — image-context captions,
Zernio analytics honesty pass, and post-media expansion handoff.

This document supersedes `CONTEXTV13.md`. Everything in V13 still applies
unless this file explicitly changes it.

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2          (verified via git remote -v, June 10, 2026)
Vercel: agent7even-v2.vercel.app
Current branch: main (latest commit 64b094d, June 10, 2026)
Production SaaS repo: rovaneD/agent7even-app — do not touch from this folder
```

Before every push:

```bash
git remote -v
```

The remote must show `rovaneD/agent7even-v2`.

Session handoff with open backlog: `SESSION_2026-06-10.md`.

---

## What Changed Since CONTEXTV13

Verified against `git log` (commits through `64b094d`, June 10, 2026) and
runtime/row checks described in `SESSION_2026-06-10.md`. Status labels below
match that session log (fixed-verified / fixed-unverified / open).

### Loop integrity and cost instrumentation — VERIFIED

1. **Maya chat `completed_at` bug — FIXED** (commit `9deee9a`).
   `/api/maya/chat/route.ts` `waitUntil` update now sets `completed_at` on
   `agent_tasks`. Verified: post-fix Maya rows have non-null `completed_at`.

2. **Silent `agent_outputs` insert on foundation runs — FIXED** (commit
   `9deee9a`). Root cause was missing NOT NULL columns `agent` and
   `output_type` in `lib/agents/runner.ts` (not `user_id`, which is nullable).
   Insert now supplies required columns and logs on failure (log-and-continue).
   Verified: foundation regen writes `agent_outputs` rows.

3. **Serverless cost-write drop risk — CLOSED** (commit `a179b20` harness).
   Production batch on deployed Vercel: 15/15 requests → 15 `agent_tasks` with
   `cost_usd > 0` and non-null `completed_at`. Retire
   `foundation_generate_runner_handoff.md`.

4. **Foundation generate runner path — unchanged, confirmed**.
   `/api/foundation/generate` uses `runAgent` with `chargeCredits: false`.

### Maya page-context architecture — SHIPPED + prod smoke passed

5. **Central hook: `hooks/useMayaContext.ts`** (commits `52e4452`–`4cba5e1`).
   Pages emit `MayaPageContext`; the hook serializes, dispatches
   `maya:canvas-context`, re-dispatches on change, clears on unmount. Replaces
   per-page hand-rolled `CustomEvent` wiring.

6. **Payload contract: `lib/maya/contextTypes.ts`**.
   - Mandatory page-level `dataSource`: `live` | `sample` | `none` → serialized
     as `DATA SOURCE:` first line.
   - **`activeView`**: `string | MayaActiveView` where object form renders
     `CURRENTLY VIEWING: <label> — <state>` above page summary.
   - Per-block mock/live provenance inside `metrics` lines (a page can mix
     sample posting data with live GA in the same payload).

7. **Phase coverage**.
   - Phase 3: dashboard pages wired via builders in `lib/maya/summaries/`.
   - Phase 4–5: tab-level `activeView` on Brand Kit, Foundation Hub, Analytics
     (`buildBrandKitMayaContext`, `buildFoundationHubMayaContext`,
     `buildAnalyticsMayaContext`).

8. **Prod smoke (session report)**: Maya reads active tab and on-screen data on
   Brand Kit, Foundation Hub, Analytics; prior "I'm not seeing your dashboard"
   contradiction resolved.

9. **Analytics caveat (documented behavior)**.
   Global `dataSource` on Analytics can read `live` while individual metric
   blocks carry `POSTING DATA: SAMPLE / MOCK` or inbox mock lines. **Per-block
   markers in `metrics` are authoritative** when they disagree with the header.

### Foundation Hub production flip — DONE (operational + verified UI)

10. **Root finding**: `NEXT_PUBLIC_FOUNDATION_V2` existed in Vercel **Preview
    only**, absent from **Production** → prod served legacy `FoundationEditor`
    since V2 landed. Oversight, not an intentional holdback.

11. **Pre-flip audit (read-only, June 10)** against Supabase `jianzyolobriaqpttamt`:
    - `foundation_knowledge` table + expected columns — EXISTS
    - `profiles.foundation_knowledge_count`, zernio columns, `zernio_profile_ids` — EXISTS
    - `analytics_briefings` — EXISTS (migration 05 proxy)
    - `EXA_API_KEY`, `ANTHROPIC_API_KEY`, Google OAuth/SA keys — present in
      Production Vercel scope (per `vercel env ls`)

12. **Operational steps (not in git)**: Production flag set
    `NEXT_PUBLIC_FOUNDATION_V2=true`, redeploy, `foundation-knowledge` storage
    bucket pre-created (private, 10MB, MIME allowlist matched to ingest uploads).

13. **Verified in prod (session report)**: Hub renders — 4 tabs, section cards,
    strength rail. Legacy editor no longer default for prod users with flag on.

### Foundation ingest field-mapping — FIXED (slug + UX)

14. **Dead OpenRouter slug** (commit `496e570`).
    `interpretExtraction` used `anthropic/claude-haiku-4`; OpenRouter rejects it
    (no generation row). User-facing symptom: "Could not parse document content."
    Same dead slug was live in `lib/agents/registry.ts` (`weekly_content`,
    `ad_variations`, `brand_voice_guardian`) and `lib/ai/client.ts`
    (`contentWriter`). Replaced repo-wide with `anthropic/claude-haiku-4-5`
    (pricing in `lib/agents/cost.ts` line 112).

15. **Error surfacing in `interpretExtraction`** (same commit).
    - API failure → `"Couldn't reach the analysis model."`
    - JSON parse failure → `"Model returned an unreadable response."`

16. **Hub Knowledge UX** (commit `cba111d`, pushed; **prod UI not verified**
    this session).
    - Header **Add knowledge** wired (Intelligence tab + scroll to UploadCard).
    - Review Findings shows **From: {source}**.
    - Failed ingests show error panel instead of silent `idle`.
    - Next-session verify: click header button, confirm **From:** on ingest,
      trigger error on bad URL (`SESSION_2026-06-10.md` backlog #14).

17. **Diagnostic logging** (commit `64b094d`).
    `[foundation-ingest-diag]` in `app/api/foundation/ingest/route.ts` and
    `lib/research/exa.ts` for empty extraction and Exa failures.

18. **Prod verification (session report)**: URL ingest extracts fields post-fix;
    image OCR path extracted 10 fields. Wikipedia URL may return zero business
    fields with a valid summary — not a slug failure.

---

## Resolved from CONTEXTV13 UNVERIFIED

These V13 items are **confirmed** by the June 10 audit and session work:

| V13 # | Topic | Resolution |
|-------|-------|------------|
| 2 (partial) | Key env vars in Production | Hub-critical keys present in Production scope; full Preview/Production mirror still incomplete (see open backlog) |
| 3 | Migrations 05/09/10 on live Supabase | Applied — table/column probes on prod project ref |

Still UNVERIFIED from V13: production DNS, Zernio vendor gates, Exa A/B
measurement, ai-toolkit fate, `analytics_briefings` roadmap, design-system
branch role. See `SESSION_2026-06-10.md`.

---

## Foundation routing (current)

`app/dashboard/foundation/page.tsx`:

```ts
const FOUNDATION_V2 = process.env.NEXT_PUBLIC_FOUNDATION_V2 === 'true'
```

- `true` → `FoundationHub` (canonical in prod after flag flip)
- absent/false → `FoundationEditor` (legacy; candidate for retirement)

Build-time env: changing the flag requires a Production redeploy.

---

## Maya context — implementation reference

| Piece | Path |
|-------|------|
| Hook | `hooks/useMayaContext.ts` |
| Contract | `lib/maya/contextTypes.ts` |
| Serializers | `lib/maya/summaries/*Context.ts` |
| Consumer | `app/dashboard/DashboardShell.tsx` (listens for `maya:canvas-context`) |

Every tabbed dashboard page that Maya should understand must populate
`activeView` with the current tab/sub-surface, not a tab inventory.

---

## Foundation ingest — technical reference (unchanged pipeline)

| Route | Role |
|-------|------|
| `POST /api/foundation/ingest` | Extract + field-map + `foundation_knowledge` insert |
| `GET /api/foundation/knowledge` | List knowledge items |
| Field mapping model | `anthropic/claude-haiku-4-5` via `openRouterComplete` |
| URL text extraction | `exaReadSite` (`EXA_API_KEY`) |
| Image OCR | Anthropic direct (`ANTHROPIC_API_KEY`), not OpenRouter |

Known open bugs (not fixed this session): `.txt` base64 not decoded on `text`
type; Hub rescore stale `fieldScores`; snippet provenance not captured.

---

## Open technical backlog (summary)

Full list with owners/next steps: `SESSION_2026-06-10.md`.

Highlights:

- Stale pre-fix `foundation_knowledge` rows — delete and re-ingest
- Haiku agents post-slug prod smoke (one agent run + cost row)
- `STRIPE_SEAT_PRICE_ID` missing all Vercel scopes
- Preview vs Production env parity audit
- 4.5MB serverless body vs 10MB bucket mismatch
- Retire `FoundationEditor` (product decision)

---

## Current docs to read first

- `SESSION_2026-06-10.md` — session log + backlog
- `MAYA_CONTEXT_V06.md` — product/Maya rules (**current**)
- `CONTEXTV15.md` — technical state (**current**)
- `post_media_expansion_handoff.md` — crop / carousel / video roadmap (after v1)
- `AUDIT_FIXES_2026-06-02.md` — audit fix ledger

Historical: `CONTEXTV14.md`, `MAYA_CONTEXT_V05.md`, `CONTEXTV13.md`,
`MAYA_CONTEXT_V04.md` (superseded).

---

## UNVERIFIED — NEEDS ROVANE CONFIRMATION

1. Production domain: is `agent7even.ai` pointing at `agent7even-v2` on Vercel?
2. Zernio vendor gates (tenant isolation, support, DPA): answered before build
   or still outstanding?
3. Exa pre-fill: is `NEXT_PUBLIC_EXA_PREFILL_ENABLED` on in production; was the
   planned value test run?
4. `/dashboard/ai-toolkit`: hidden intentionally or pending removal?
5. `analytics_briefings`: planned feature or dead schema?
6. `design-system/color-tokens` branch: still active validation branch?
7. ANTHROPIC_API_KEY: consolidate duplicate Preview vs Production Vercel entries?
8. Pre-slug-fix Haiku agent cost rows in admin: acceptable or need backfill note?

---

*Last reviewed: June 10, 2026*
