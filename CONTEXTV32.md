# CONTEXTV32 — Customer count audit, marketing copy, PR #62 prep
*Snapshot: September 21, 2026 — supersedes `CONTEXTV31.md`*

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Production URL: https://www.agent7even.ai  (also agent7even-v2.vercel.app)
Vercel project: agent7even-v2 (team plan: Pro)
Supabase project: jianzyolobriaqpttamt (Agent7 — currently Free tier; inactivity pause warning Sep 2026)
Branch: main
Latest remote: aee88bf (marketing copy — sign-off secondary line)
Prior handoff: CONTEXTV31 (September 21 — HeaderBack homepage, Maya Phase 2, cron repair)
```

**Deploy workflow:** push to `main` → Vercel auto-deploys. Before push: `git remote -v` → `rovaneD/agent7even-v2`. Pre-push hook blocks uncommitted tracked changes.

---

## Customer counts (verified Sep 21, 2026)

**Definition:** *External customer* = any `profiles` row that is not one of the internal accounts below. Exclude internal accounts from all customer, churn, and revenue counts in docs and reports.

### Internal accounts (never count as customers)

| Email | profile_id | Notes |
|-------|------------|-------|
| `rovane@dursodesign.com` | `bfa73081-3906-4b5b-b24e-d9df3fb07384` | Owner/internal — ProAgent, `billing_exempt = true` |
| `melissa@agent7even.com` | `79a1aae2-de3c-40b1-9f8a-6142895b129b` | Internal test — Growth, `billing_exempt = true` |
| `rovdurs@gmail.com` | `f5702a77-f81f-48f7-8847-78318e428c52` | Internal team-member test — churned |

### External customers

| Metric | Count |
|--------|------:|
| **Active external customers** | **0** |
| **Historical external customers (ever signed up)** | **2** |
| **External churned** | **2** (`1addfb0e-…`, `8889dc4d-…`) |

Both historical externals are `status = 'churned'`. Their Stripe customer IDs resolve in **test** Stripe only (QA / early test signups). **No live-mode external subscriptions** were found in the Sep 21 audit.

**Counting rule:** Customer and payment counts must be verified against **live Stripe** (active subscriptions, paid invoices, cancellations). Never infer paying status from `profiles.stripe_subscription_id` alone — that column can hold stale test-era IDs out of sync with live Stripe.

Production checkout uses **`pk_live_`** on `www.agent7even.ai` (verified). Local `.env.local` uses `sk_test_` — use Stripe CLI `--live` or Dashboard for live-mode reads.

### Legacy portal database

`app.agent7even.com` (`~/agent7even-app`) is a **separate frozen codebase**, not a separate database. It uses the **same Supabase project** `jianzyolobriaqpttamt`.

---

## What changed since CONTEXTV31 (index)

| Area | Doc |
|------|-----|
| Marketing approval copy (`comes to you first` + sign-off) | **§1** |
| Customer count audit + internal account exclusions | **§2** (above) |
| PR #62 identity branch (preview, not merged) | **§3** |
| Open items | **§4** |
| Carry-forward from V31 | **§5** |

---

## 1. Marketing copy (`c96173e` → `aee88bf`)

Five commits on `main` (Sep 21, 2026):

1. `c96173e` — P3: trial copy aligned with `trialPolicy.ts` on live marketing routes
2. `4d3834e` / `1af7486` / `c623e09` — P2: approval promise tightened to one primary line
3. `aee88bf` — P2: secondary line → **"Nothing publishes without your sign-off."**

Live `/` hero primary: **"Every post, campaign, and ad draft comes to you first."**

Legacy `/lab5` and design-concept routes still carry old approval wording — not live homepage.

---

## 2. Internal billing / Stripe notes (Sep 21 audit)

### Rovane (`bfa73081`)

- `stripe_customer_id`: `cus_UvLGi0VCYxPrWK` — **live-mode customer only** (not found in test Stripe).
- `stripe_subscription_id` on profile: `sub_1TdjLGCjXyyqncdvgDuIn99G` — resolves in **test** Stripe as **canceled**, attached to orphan customer `cus_UcSxm1YlUOFljA` (not rovane's live customer). Treat as **stale test-era linkage** on the profile row.
- Live Stripe (Sep 21): customer exists; **zero subscriptions**; profile `stripe_subscription_id` cleared. **`billing_exempt = true`.**

### Melissa (`79a1aae2`)

- `stripe_customer_id`: `cus_UZ4PlAAA702M28` — **test-mode customer only**.
- `stripe_subscription_id`: **null**; no subscriptions or invoices in test Stripe.
- **Not charging.** **`billing_exempt = true`.**

### Admin delete vs Stripe orphans

`deleteClientAccount` **hard-deletes** the profile row and cancels an active Stripe subscription if `stripe_subscription_id` is set, but **does not delete the Stripe customer**. Sep 21 scan: **7** Stripe customers (test mode) with no matching profile row — mix of QA scripts (`verify_stripe_trial_qa`, `verify_trial_credits`) and deleted test signups.

---

## 3. PR #62 — identity (`fix/profile-identity-resolution`, not merged)

Combines #60 (exact email match) + #48 (insert-only Clerk `user.created`). Preview deployed; merge blocked pending:

1. Fresh sign-up on preview → one profile row, correct `clerk_user_id`, `/start-trial` → checkout
2. Existing login (`rovane@dursodesign.com`) → same profile
3. Clerk `user.created` redelivery → no-op (no lifecycle reset)

Preview likely writes to **prod Supabase** (`jianzyolobriaqpttamt`). Preview Stripe mode: confirm in Vercel Preview env (`sk_test_` vs `sk_live_`) before test checkout.

---

## 4. Open items

1. **Supabase Pro upgrade** — prod DB on Free tier (carried from V31).
2. **Team workspace PRs #48–#60** — preview only; merge queue after #62.
3. **PR #62 merge** — after preview sign-up + webhook redelivery test.
4. Carry-forward from V31 §8 (legacy `.com` fallbacks, Resend domain, `45_agent_run_failed`, etc.).

---

## 5. Carry-forward from CONTEXTV31

Unchanged unless this doc overrides:

- Homepage HeaderBack hero on `/`
- Maya Phase 2 — per-member sessions, `MayaShell` removed
- `resolveClerkProfile` — never raw `.eq('clerk_user_id').single()`
- `hasPlatformAccess` — paid API gate
- Pending approvals SSOT — `lib/agents/pendingApprovals.ts`
- Vercel crons public in `proxy.ts` + `CRON_SECRET` bearer
- Zernio integrated for social publishing (Jul 8, 2026) — cleared for **external customer** live social when customers exist

---

*Last reviewed: September 21, 2026*
