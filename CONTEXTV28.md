# CONTEXTV28 — Codebase audit: profile resolution enforced, dead routes removed
*Snapshot: July 13, 2026 — supersedes `CONTEXTV27.md`*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Production URL: https://www.agent7even.ai
Vercel project: agent7even-v2
Branch: main
Latest remote: 8aa8719 (audit fixes — profile resolution, dead routes, pre-push guard)
Prior handoff: CONTEXTV27 (July 9 evening — launch audit, mobile modals, Zernio OAuth)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`. The `.git/hooks/pre-push` guard (uncommitted tracked changes block the push) **actually exists now** — it was missing until this session; recreate it on any fresh clone (see `SESSION_2026-07-13.md` §4).

---

## Post-snapshot critical fixes (July 19)

Critical-bug investigation branch `cursor/critical-bug-investigation-dd51` adds two billing enforcement fixes:

- `a61a45c`: Existing subscribers who change plans now keep Stripe's returned billing standing. A failed immediate proration returns `past_due` and leaves the profile `paused` instead of the route unconditionally restoring `status = 'active'`.
- `74212bf`: Post image compose/regenerate/edit/QA, attachment, and Zernio media routes now use `hasPlatformAccess(...)`. A retained paid plan no longer lets a failed-payment (`paused`) account call provider-backed routes; `billing_exempt` accounts remain allowed.

Validation: `npx tsc --noEmit` and `npm run build` both pass on Next.js 16.2.6.

---

## What changed since CONTEXTV27 (index)

| Area | Doc |
|------|-----|
| Full audit results (healthy baseline + findings) | **§1** |
| `resolveClerkProfile` now enforced at every call site (45 fixed) | **§2** |
| 16 dead API routes deleted + proxy/env cleanup | **§3** |
| Open items the audit surfaced (not code-fixable here) | **§4** |
| Carry-forward from V27 (launch QA, Zernio pilot) | **§5** |

Full detail: `SESSION_2026-07-13.md`.

---

## 1. Audit baseline (July 13)

Verified healthy: TypeScript and production build clean; every client `fetch()` maps to an existing route; no broken internal page links; Stripe (`constructEvent`), Clerk (svix), and OpenRouter (HMAC) webhooks verify signatures; all crons gate on `CRON_SECRET`; live Supabase matches the migration ledger (18–22, 36, 37, 41, 44 all applied); **no duplicate `clerk_user_id` profiles in prod**.

---

## 2. Profile resolution — rule now enforced in code

The AGENTS.md rule ("never `.eq('clerk_user_id').single()` when duplicates may exist") was violated at **45 call sites**; all are now on `resolveClerkProfile` from `lib/profiles/resolveClerkProfile.ts`. Scope: 8 dashboard pages, ~25 API routes, `lib/activity.ts`, and the Stripe webhook. Behavior preserved (no email fallback passed; same selects, house-idiom inline generics).

**Convention for new code:** any Clerk-scoped read of `profiles` uses `resolveClerkProfile` (or the purpose-built `getDashboardProfileForClerkUser` / `getBillingProfileForClerkUser` / workspace helpers). The old pattern greps to zero — keep it that way.

---

## 3. Dead surface removed

16 orphan API routes deleted (no callers; verified against static and dynamic URL builders): `agents/run/[agentId]`, `agents/approvals` GET root, `agents/tasks` GET root, `agents/content-writer`, `agents/outputs`, `analytics/meta-*` ×4, `analytics/zernio/ads`, `brand-kit` GET root, `campaigns/list`, `digest/[id]/dismiss`, `maya/sessions`, `onboarding/complete`, `stripe/portal`.

Follow-on cleanup:
- `proxy.ts`: removed public carve-outs for `api/agents/run/(.*)` and `api/analytics/meta-callback(.*)`.
- `lib/env.ts`: `INTERNAL_JOB_SECRET` no longer required (agent dispatch is in-process via `lib/agents/dispatch.ts`); Meta Ads OAuth feature gate removed.
- `lib/integrationsHealth.ts`: `meta_oauth` health item and its now-unused helpers removed.

**Meta analytics is fully retired** in v2 — reintroducing it means new routes, env gates, and health checks, not restoring these files.

---

## 4. Open items (decisions / external checks)

1. **`/dashboard/ai-toolkit` is unreachable** — page exists and works, nothing links to it. Either add it to the dashboard sidebar or remove the feature (trial copy still promises "5 AI Toolkit runs").
2. **Vercel Production env to confirm:** `OPENROUTER_VIDEO_WEBHOOK_SECRET`, `STRIPE_CREDITS_SMALL/MEDIUM/LARGE_PRICE_ID`.
3. **`MARKETING_CHAT_IP_PEPPER`** unset → hardcoded default pepper (`lib/marketing/marketingChatLog.ts`); set a real value in prod if IP-hash privacy matters.
4. **RLS-no-policy tables** (`approval_task_notes`, `marketing_chat_logs`, `team_task_notes`) — deny-by-default, service-role only; leave unless client-side access is ever added.

---

## 5. Carry-forward from CONTEXTV27

- Stripe live checkout QA on `www.agent7even.ai/pricing` (Starter trial) — still manual.
- First production Zernio connect (pilot) — runbook `vendor/zernio/go_live_runbook.md`.
- Clerk Production (`pk_live_`) verified live on `.ai` (July 9 audit, 10/10).
