# Production Launch Session — agent7even.ai

*Working doc for the five launch gates from `PRODUCTION_GREENLIGHT.md`. Run checks with:*

```bash
npx tsx scripts/verify-production-readiness.ts
```

**Verified June 17, 2026:** Legal routes return HTTP 200 on `www.agent7even.ai`. Production `/sign-up` still serves **`pk_test_`** (Clerk Development). Stripe/Clerk live keys must be set in Vercel before charging real customers.

---

## Status snapshot

| Gate | Code ready? | Dashboard action needed |
|------|-------------|-------------------------|
| Legal pages on `.ai` | Yes (fix `.com` refs in this session) | None — pages live |
| Clerk Production | Webhook route ready | **Switch to `pk_live_` / `sk_live_` on Vercel** |
| Stripe Live | Checkout + webhook code ready | **Create live products/prices + webhook** |
| Zernio DPA | Connect works on test accounts | **Agent7even signed Jul 2026 — await Zernio confirmation; then client social OK** |
| Pre-launch QA | Script + checklist below | Run after Clerk + Stripe live |

---

## 1. Clerk Production on `.ai`

### Why

Production `/sign-up` currently embeds `pk_test_…` (Development instance `ruling-drum-42.clerk.accounts.dev`). Real customers need **`pk_live_`**.

### Steps (Clerk Dashboard)

1. Open [Clerk Dashboard](https://dashboard.clerk.com) → your **agent7even-v2** application.
2. Toggle **Development** → **Production** (top of sidebar).
3. **Configure → Domains**
   - Add `www.agent7even.ai` and `agent7even.ai`.
   - Optional custom domain: `clerk.agent7even.ai` (add CNAME Clerk provides).
4. **Configure → Paths**
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in / sign-up: `/foundation`
5. **Configure → Social connections** — enable Google (and others) in **Production**.
6. **Configure → Webhooks**
   - Endpoint: `https://www.agent7even.ai/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy **Production** signing secret.

### Vercel Production env (agent7even-v2 project)

Update **Production only** (keep Preview on `pk_test_` for branch deploys if desired):

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...   # Production webhook secret
```

Redeploy, then verify:

```bash
curl -sL https://www.agent7even.ai/sign-up | rg -o 'pk_(live|test)_[^"\']+' | head -1
# Must show pk_live_
```

### Smoke test

1. Incognito → `https://www.agent7even.ai/sign-up`
2. Confirm Clerk UI shows Production (not `*.clerk.accounts.dev` dev hostname in network tab).
3. Complete sign-up → check Clerk Production **Users**
4. Confirm Supabase `profiles` row created
5. Confirm welcome email received (Resend)

---

## 2. Stripe Live products + webhook

### Why

Vercel has `STRIPE_*_PRICE_ID` vars but **`sk_test_` keys do not work with live price IDs** (and vice versa). Live products must be created in Stripe **Live mode**.

### Steps (Stripe Dashboard — Live mode)

1. Activate live payments (business verification complete).
2. **Products** → create mirror of test catalog:

| Product | Monthly | Annual |
|---------|---------|--------|
| Starter | $49/mo | $490/yr — 3-day trial via Checkout |
| Growth | $89/mo | $890/yr — no trial |
| ProAgent | $149/mo | $1,490/yr — no trial |
| Extra seat | $15/mo | `STRIPE_SEAT_PRICE_ID` |
| Credit packs | $5 / $15 / $40 | small / medium / large |

3. **Developers → Webhooks** → Add endpoint:
   - URL: `https://www.agent7even.ai/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` (audit `app/api/webhooks/stripe/route.ts` for full list)
   - Copy **live** `whsec_…`

4. Update **Vercel Production**:

```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_MONTHLY_PRICE_ID=price_...   # live IDs
STRIPE_STARTER_ANNUAL_PRICE_ID=price_...
STRIPE_GROWTH_MONTHLY_PRICE_ID=price_...
STRIPE_GROWTH_ANNUAL_PRICE_ID=price_...
STRIPE_PROAGENT_MONTHLY_PRICE_ID=price_...
STRIPE_PROAGENT_ANNUAL_PRICE_ID=price_...
STRIPE_SEAT_PRICE_ID=price_1TbBQ6CjXyyqncdvakHy4jce   # confirm live equivalent
STRIPE_CREDITS_SMALL/MEDIUM/LARGE_PRICE_ID=price_...
```

5. Redeploy.

### Smoke test

1. Pricing → Starter → Checkout with real card → **$0 for 3 days**, then $49/mo
2. Stripe Dashboard → Webhooks → confirm **200** delivery
3. `profiles.plan = starter`, trial limits apply (5 AI runs, Brand Kit locked)
4. Billing portal opens via Settings
5. Refund/cancel test subscription after verification

---

## 3. Zernio DPA (before real client social accounts)

### Why

`zernio_social_evaluation_backlog.md` Q4 — **Agent7even signed and returned DPA Jul 2026** (`Data-Processing-Agreement-ARBICHAT.pdf`, §13 California/LA County). Owner test accounts (`@rovanedurso`) are fine. **Await Zernio written confirmation of fully executed DPA** before treating client social onboarding as fully cleared.

### Compliance materials on file (trust-center NDA, Jun 15, 2026)

- SOC 2 Type II — Jan 20 – Apr 20, 2026 — Securance Pro — unqualified
- GDPR attestation — DPLMC — Feb 2, 2026 (expires Feb 2, 2027)
- Local path: `~/Volumes/Black 10TB/Agent7even Update/Zernio/` — do not commit to repo

### Steps

1. **Done:** Sign DPA; return to Zernio.
2. **Pending:** Email Zernio confirming receipt + return fully executed copy (optional: processing schedule / sub-processor list referencing trust.zernio.com).
3. Set Stripe spending cap on [zernio.com/dashboard/billing](https://zernio.com/dashboard/billing) as global backstop.
4. Until Zernio confirms: QA social connect with **test accounts**; client accounts OK after confirmation.

### Optional env gate (after Zernio confirms)

Add to Vercel when ready:

```bash
ZERNIO_CLIENT_ACCOUNTS_ENABLED=true
```

(Code can read this later to show a hard gate in connect UI — not required for manual process.)

---

## 4. Legal pages live on `.ai`

### Done in code

- `/privacy`, `/terms`, `/security`, `/data-deletion` — canonical URLs via `lib/siteUrls.ts`
- Data deletion form → `POST /api/data-deletion/request`

### Verify

```bash
npx tsx scripts/verify-production-readiness.ts
```

All four legal paths should return **HTTP 200**. Privacy/terms/data-deletion footer must show **`www.agent7even.ai`**, not `app.agent7even.com`.

---

## 5. Pre-launch QA script

Run on **production** after Clerk + Stripe live. Use a **fresh email** and **real card** (refund after).

| # | Step | Pass? |
|---|------|-------|
| 1 | Land on `www.agent7even.ai` → Sign up → Foundation starts | ☐ |
| 2 | Complete or skip Foundation → Dashboard loads | ☐ |
| 3 | Pricing → Starter trial Checkout → success → `profiles.plan = starter` | ☐ |
| 4 | AI Toolkit — 5 runs OK, 6th blocked (`TRIAL_LIMIT`) | ☐ |
| 5 | Brand Kit locked during trial | ☐ |
| 6 | Connect Google Analytics (if enabled) | ☐ |
| 7 | Connect social via Zernio — **test account until Zernio confirms DPA** (Agent7even signed Jul 2026) | ☐ |
| 8 | Meta connect modal → OAuth → analytics or honest empty state | ☐ |
| 9 | Analytics → Posting + Inbox tabs load (no silent failures) | ☐ |
| 10 | Inbox `/dashboard/inbox` loads for connected account | ☐ |
| 11 | Create + schedule a post | ☐ |
| 12 | Billing portal → cancel / update payment method | ☐ |
| 13 | Submit `/data-deletion` form → emails received | ☐ |
| 14 | Sign out / sign in persists | ☐ |
| 15 | Mobile smoke: connect panel, pricing, inbox | ☐ |

---

## Recommended order today

1. **Legal URL fix** — commit + deploy (this session)
2. **Clerk Production keys** on Vercel → redeploy → verify `pk_live_`
3. **Stripe Live** products + webhook + Vercel env → redeploy
4. **Email Zernio** for DPA (parallel — doesn't block steps 2–3)
5. **Run QA table** above
6. Check off `PRODUCTION_GREENLIGHT.md` §16 sign-off

---

*After cutover: update AGENTS.md CTA rules to `.ai` only and bump CONTEXT version.*
