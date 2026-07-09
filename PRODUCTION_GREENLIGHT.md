# Production Greenlight — agent7even-v2 on agent7even.ai

*Created: June 16, 2026 · Target: real paying customers on v2*

This is the master checklist for taking **agent7even-v2** from experimental/staging to **production-ready** on **www.agent7even.ai**. It covers Stripe (currently test/sandbox), Clerk (currently Development), integrations, legal, ops, and known feature gates.

**Scope:** v2 replaces the customer-facing product on `.ai`. The legacy app at `app.agent7even.com` (`rovaneD/agent7even-app`) stays untouched until cutover is intentional.

**How to use:** Work top-to-bottom. Items marked **BLOCKER** must pass before charging real money or onboarding real client social accounts.

---

## 0. Current state (as of June 16, 2026)

| System | v2 on agent7even.ai | Legacy app.agent7even.com |
|--------|---------------------|---------------------------|
| **Deploy** | `rovaneD/agent7even-v2` → Vercel `agent7even-v2` | `rovaneD/agent7even-app` |
| **Clerk** | **Development** (`pk_test_…`, `ruling-drum-42.clerk.accounts.dev`) | **Production** (`pk_live_…`, `clerk.app.agent7even.com`) |
| **Stripe** | **Test mode** (`sk_test_…`, test price IDs) | Likely live keys (separate instance) |
| **Supabase** | Shared project (verify prod vs staging) | Same or separate — confirm |
| **Meta domains** | `agent7even.ai` verified | `agent7even.com` verified (marketing repo) |
| **Meta Tech Provider** | Agent7even app `992647829846107` verified (June 2026) | — |
| **Legal pages** | `/privacy`, `/terms`, `/security`, `/data-deletion` on v2 | Older copies may still exist on `.com` |
| **Marketing CTAs** | v2 root pages point to `/sign-up`, `/pricing` on `.ai` | AGENTS.md still references `.com` app URLs in some rules |

`lib/env.ts` already warns if `NEXT_PUBLIC_APP_URL` contains `app.agent7even.com` while `STRIPE_SECRET_KEY` starts with `sk_test_` — the inverse (`.ai` URL + test keys) is where v2 is today.

---

## 1. Strategic decisions (do first)

- [ ] **BLOCKER — Confirm cutover model**
  - **Option A:** v2 on `.ai` becomes the only customer app; `.com` app retired or redirects.
  - **Option B:** v2 launches on `.ai` while `.com` app continues for existing subscribers (dual-run — high ops cost).
  - **Recommendation:** Option A with a migration plan for any `.com` subscribers.

- [ ] **Canonical URLs** — pick one set for all external references:
  - App: `https://www.agent7even.ai`
  - Marketing: same host (already true for v2 lab5 root)
  - Support email: `support@agent7even.ai`
  - Update AGENTS.md CTA rules, Meta app settings, Google OAuth consent screen, Stripe business settings, and Resend from-addresses to match.

- [ ] **Supabase environment** — confirm v2 uses the **production** Supabase project (not a dev fork). Document project ref + backup policy.

- [ ] **User migration** — if any paying users exist on `.com` app, plan: export profiles, Stripe customer IDs, Clerk user mapping, or force re-signup (avoid duplicate billing).

---

## 2. Domain & DNS

- [ ] **BLOCKER — Vercel domains on `agent7even-v2` project**
  - [ ] `agent7even.ai` (apex)
  - [ ] `www.agent7even.ai` (primary)
  - [ ] Optional: `app.agent7even.ai` alias if you want a separate app subdomain later

- [ ] **SSL** — all domains show valid cert in Vercel

- [ ] **Redirects**
  - [ ] Apex → `www` (already 308)
  - [ ] Decide: redirect `agent7even.com` → `agent7even.ai` when ready (marketing repo + DNS)

- [ ] **Meta domain verification** — `agent7even.ai` ✅ · `agent7even.com` ✅ (marketing repo)

- [ ] **`NEXT_PUBLIC_APP_URL`** in Vercel Production = `https://www.agent7even.ai` (not `.com`, not `agent7even-v2.vercel.app`)

---

## 3. Clerk (Development → Production)

Today v2 uses **Clerk Development**. Real customers need **Production**.

### 3.1 Clerk Production instance

- [ ] **BLOCKER — Create / activate Clerk Production** for project `agent7even-v2`
- [ ] **Custom domain** (recommended): `clerk.agent7even.ai` or `accounts.agent7even.ai`
  - [ ] Add CNAME in DNS per Clerk dashboard
  - [ ] Wait for SSL provisioning

### 3.2 Clerk Configure (Production tab)

- [ ] **Allowed origins / domains**
  - `https://www.agent7even.ai`
  - `https://agent7even.ai`
- [ ] **Paths**
  - Sign-in URL: `/sign-in`
  - Sign-up URL: `/sign-up`
  - After sign-in / sign-up: `/foundation` (matches `.env.example`)
- [ ] **Social connections** — enable Google (and any others) in **Production**, not just Development
- [ ] **Email templates** — review branding, from-name, links point to `.ai`

### 3.3 Clerk webhooks (Production)

- [ ] Endpoint: `https://www.agent7even.ai/api/webhooks/clerk`
- [ ] Events: `user.created`, `user.updated`, `user.deleted`
- [ ] Copy **Production** signing secret → Vercel `CLERK_WEBHOOK_SIGNING_SECRET`

### 3.4 Vercel env (Production only)

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

- [ ] Redeploy after updating keys
- [ ] **Smoke test:** incognito sign-up → user in Clerk Production → Supabase `profiles` row → welcome email

### 3.5 Dev vs prod isolation

- [ ] Keep Development instance for local/preview testing only
- [ ] Preview deployments: either stay on `pk_test_` or use Clerk staging strategy — document which

---

## 4. Stripe (Test → Live)

Today v2 runs **Stripe test mode**. Test price IDs (e.g. `price_1TaGc5…`) do **not** work in live mode — you must recreate products/prices in the Stripe **Live** dashboard.

### 4.1 Stripe account readiness

- [ ] **BLOCKER — Activate Stripe live payments** (business verification complete)
- [ ] Business name, support email, statement descriptor (`AGENT7EVEN` or similar)
- [ ] Customer portal branding matches Agent7even
- [ ] Tax settings decided (Stripe Tax or manual) — document choice
- [ ] Refund / cancellation policy aligned with Terms

### 4.2 Live products & prices (mirror test catalog)

Create in **Live mode** Dashboard → Products:

| Product | Monthly | Annual | Notes |
|---------|---------|--------|-------|
| **Starter** | $49/mo | $490/yr | 3-day trial via Checkout (`trial_period_days: 3`) |
| **Growth** | $89/mo | $890/yr | No trial — charged immediately |
| **ProAgent** | $149/mo | $1,490/yr | No trial |
| **Extra seat** | $15/mo | — | `STRIPE_SEAT_PRICE_ID` — recurring add-on line item |
| **Credit top-ups** | $5 / $15 / $40 | — | 100 / 350 / 1000 credits (`lib/credits-packages.ts`) |

- [ ] Copy all **live** price IDs into Vercel Production env
- [ ] Verify trial is **only** on Starter (code: `app/api/stripe/checkout/route.ts`)
- [ ] Verify Growth/ProAgent charge immediately on subscribe

### 4.3 Live API keys & webhooks

```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from LIVE webhook endpoint
```

**Live webhook endpoint:** `https://www.agent7even.ai/api/webhooks/stripe`

Subscribe to events handled in `app/api/webhooks/stripe/route.ts`:

- [ ] `checkout.session.completed` (subscriptions + credit top-ups)
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`
- [ ] `invoice.payment_failed` (if handled — verify route)
- [ ] Any other events referenced in the webhook file — audit full handler

- [ ] **Stripe CLI test against live** (careful — use test clock or staging customer first)
- [ ] Confirm webhook delivery **200** in Stripe Dashboard → Developers → Webhooks

### 4.4 Billing flows to QA (live, small real charge)

- [ ] **Starter trial** — card collected, $0 for 3 days, then $49/mo
- [ ] **Growth subscribe** — immediate charge $89/mo
- [ ] **ProAgent subscribe** — immediate charge $149/mo
- [ ] **Annual billing** — correct price + interval
- [ ] **Upgrade / downgrade** — plan change updates `profiles.plan` + credits
- [ ] **Cancel subscription** — status → churned, Zernio disconnect (webhook calls `disconnectAllZernioProfiles`)
- [ ] **Billing portal** — `POST /api/stripe/portal` opens Stripe Customer Portal
- [ ] **Team seat add** — invite adds `STRIPE_SEAT_PRICE_ID` line item (+$15/mo)
- [ ] **Team seat remove** — decrements/removes seat line item
- [ ] **Credit top-up** — one-time payment completes, `credit_balances` updates
- [ ] **Promo codes** — `allow_promotion_codes: true` on Checkout; test one live coupon
- [ ] **Trial limits** — 5 AI runs, Brand Kit locked (`TRIAL_LIMIT` / `NO_PLAN` errors)
- [ ] **Failed payment** — dunning / access restriction behaves as expected

### 4.5 Stripe API version

- [ ] Code uses `'2026-04-22.dahlia'` in `lib/stripe.ts` — confirm live account supports it (Dashboard → Developers → API version)

### 4.6 Sandbox cleanup

- [ ] Remove or rotate test keys from **Production** Vercel env (never deploy `sk_test_` to production)
- [ ] Keep test keys in Preview / local `.env.local` only

---

## 5. Vercel environment variables (Production checklist)

Set on **agent7even-v2** Vercel project → Settings → Environment Variables → **Production**:

### Required (app won't boot without these — `lib/env.ts`)

| Variable | Production value |
|----------|------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` |
| `CLERK_SECRET_KEY` | `sk_live_…` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Production `whsec_…` |
| `NEXT_PUBLIC_SUPABASE_URL` | Prod project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod service role (server only) |
| `NEXT_PUBLIC_APP_URL` | `https://www.agent7even.ai` |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | Live `whsec_…` |
| `STRIPE_STARTER_MONTHLY_PRICE_ID` | Live price ID |
| `STRIPE_STARTER_ANNUAL_PRICE_ID` | Live price ID |
| `STRIPE_GROWTH_MONTHLY_PRICE_ID` | Live price ID |
| `STRIPE_GROWTH_ANNUAL_PRICE_ID` | Live price ID |
| `STRIPE_PROAGENT_MONTHLY_PRICE_ID` | Live price ID |
| `STRIPE_PROAGENT_ANNUAL_PRICE_ID` | Live price ID |
| `OPENROUTER_API_KEY` | Production key |
| `RESEND_API_KEY` | Production key |
| `CRON_SECRET` | Strong random secret |
| `INTERNAL_JOB_SECRET` | Strong random secret |

### Feature-gated (warn if missing — feature disabled)

| Variable | Feature |
|----------|---------|
| `STRIPE_SEAT_PRICE_ID` | Team seats billing |
| `STRIPE_CREDITS_SMALL/MEDIUM/LARGE_PRICE_ID` | Credit top-ups |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` | GA connect |
| `GOOGLE_SA_CLIENT_EMAIL/PRIVATE_KEY` | GA data pull |
| `META_APP_ID/SECRET` | Legacy direct Meta OAuth |
| `ANTHROPIC_API_KEY` | Foundation generate |
| `EXA_API_KEY` | Foundation pre-fill |
| `ZERNIO_API_KEY` | Social analytics / inbox / posting |

Optional: `NOTIFY_EMAIL`, `NEXT_PUBLIC_EXA_PREFILL_ENABLED`

- [ ] Run `npm run build` locally with production-like env before cutover
- [ ] After deploy, check Vercel runtime logs for `[env]` warnings

---

## 6. Supabase (database & storage)

- [ ] **BLOCKER — All migrations applied** on production DB:

| Migration | Purpose | Status |
|-----------|---------|--------|
| `11_foundation_answers_snapshot.sql` | Foundation undo | Applied |
| `12_post_assets_bucket.sql` | Post media bucket | Applied |
| `14_content_posting_agent_skill.sql` | Content Posting agent | Applied |
| `16_prevent_duplicate_client_emails.sql` | Email uniqueness | Applied |
| `17_email_sequence_builder_skill.sql` | Email Sequence agent | **Verify** |
| `18_idea_analysis_skill.sql` | Idea Analysis agent | **Verify** |

- [ ] RLS policies reviewed for multi-tenant isolation (June 2 audit fixes)
- [ ] `platform_settings.notify_email` set to operational inbox
- [ ] Storage buckets: `post-assets` (and any others) — policies correct
- [ ] Backups enabled (Supabase Pro or PITR)
- [ ] Stale Knowledge rows cleaned (see `SESSION_2026-06-10.md`)

---

## 7. Email (Resend)

- [ ] **BLOCKER — Sending domain verified** (`agent7even.com` or `agent7even.ai` in Resend)
- [ ] SPF / DKIM / DMARC on DNS
- [ ] From addresses match verified domain:
  - Welcome: `hello@agent7even.com` (today) → consider `hello@agent7even.ai`
  - Data deletion / support replies: `support@agent7even.ai`
  - Noreply: `noreply@agent7even.com`
- [ ] Test: sign-up welcome, data deletion request, billing notifications, morning digest

---

## 8. Legal & compliance

- [x] **BLOCKER — Legal pages live on canonical domain**
  - [x] `/privacy` — `.ai` URLs, Meta/social section, data deletion link
  - [x] `/terms`
  - [x] `/security`
  - [x] `/data-deletion` — form + API working
  - [x] Canonical dashboard URL `www.agent7even.ai` (not `app.agent7even.com`) — `lib/siteUrls.ts`

- [ ] **Meta Developer App (Basic settings)**
  - [ ] App domains: `agent7even.ai`
  - [ ] Privacy Policy URL: `https://www.agent7even.ai/privacy`
  - [ ] Terms URL: `https://www.agent7even.ai/terms`
  - [ ] User Data Deletion URL: `https://www.agent7even.ai/data-deletion`
  - [ ] Website: `https://www.agent7even.ai`
  - [ ] Remove use cases you do not ship (e.g. WhatsApp) — see **§8.1**

- [x] **Meta Tech Provider verification** — Agent7even (`992647829846107`, Business `738598814681808`) verified June 2026

- [ ] **Meta Access Verification** — submit with `.ai` URLs + screen recordings (follows Tech Provider)

### 8.1 Meta App Review — v1 vs ads later

Two integration tracks — do not conflate them:

| Track | Powers | Launch blocker? |
|-------|--------|-----------------|
| **Zernio** (live) | Social connect, posting, inbox, organic analytics — **paid ads later via Zernio Ads API** | DPA + tenant isolation (§9.2) |
| **Agent7even Meta app** (`992647829846107`) | Legacy `/api/analytics/meta-connect` — **not linked from UI**; optional future direct Graph | Basic settings + Access Verification only for v1 |

**v1 launch (do now)**

- [ ] Finish **Basic settings** (URLs above) and submit **Access Verification** when Meta prompts
- [ ] **Do not submit App Review for ads** — no paid-ads UI in v1; Meta rejects broad permission asks without a shipped feature
- [ ] **Do not chase Marketing API Access Tier** (500 calls @ 85% success) unless committing to **direct** Meta Marketing API from this app
- [ ] **Remove WhatsApp** use case from the app until WhatsApp is built
- [ ] **Skip Instagram messaging/comment scopes** on your app for v1 — inbox runs through Zernio, not direct Graph
- [ ] Social connect for customers stays on **Zernio** (§9.2); consent may show Zernio’s shared app (“Social Media Connector”) — disclosure UX, not a launch blocker

**Ads later (when product includes paid media)**

Default path (matches `analytics_v2_spec.md`):

- [ ] Connect ad accounts in **Zernio**; read spend/reach/CTR via **Zernio Ads API**
- [ ] **No App Review on your Meta app for ads** — Zernio holds platform approval on their side

Only if you later bypass Zernio for **direct** Meta Marketing API:

- [ ] Complete Marketing API testing (500 API calls, 85% success rate)
- [ ] Submit focused App Review for `ads_read` / `ads_management` with screen recordings of the ads feature in Agent7even
- [ ] Trim legacy `meta-connect` scopes to match what you ship (`app/api/analytics/meta-connect/route.ts` still requests ads scopes today — update before re-enabling that route)

**Testing dashboard note:** Completed test calls for `ads_read` / `ads_management` are fine to keep as prep; they do not obligate you to submit those permissions before the feature ships.

- [ ] **Google OAuth consent screen**
  - [ ] App name, logo, privacy/terms links → `.ai`
  - [ ] Authorized domain: `agent7even.ai`
  - [ ] Redirect URI: `https://www.agent7even.ai/api/analytics/ga-callback`

- [ ] **Cookie / analytics disclosure** in Privacy Policy (GA `G-8913QV8Z1M`)

---

## 9. Integrations — go-live gates

### 9.1 Google Analytics OAuth

- [ ] GCP OAuth client redirect URI updated for `.ai`
- [ ] Consent screen published (External)
- [ ] End-to-end: Connect → property picker → dashboard data

### 9.2 Zernio (social analytics, inbox, posting)

- [ ] **Zernio DPA / data handling** — **Cleared Jul 8, 2026** (both sides; Trust Center). Paying customers may connect live social accounts. Runbook: `vendor/zernio/go_live_runbook.md`
- [ ] **Tenant isolation** — cross-tenant fixes shipped (`b9c416b`); run `scripts/verify-zernio-tenant-fixes.ts` on prod
- [ ] **BYOK / Meta branding** — decide: stay on shared Zernio OAuth vs Agent7even Meta apps (removes "Social Media Connector" branding)
- [ ] **Cost cap** — Stripe spending limit on Zernio dashboard as global backstop
- [ ] **Known data gap** — reconnect analytics sync banner (72h); confirm Zernio metrics for real accounts before marketing "live analytics"
- [ ] **FREE tier limit** — 2 connected accounts on Zernio free tier; payment method on Zernio for scale

### 9.3 Meta direct OAuth (legacy path)

- [ ] **Not required for v1 launch** — Analytics connect UI uses Zernio only; see **§8.1**
- [ ] `META_APP_ID` / `META_APP_SECRET` in prod env only if re-enabling `/api/analytics/meta-connect`
- [ ] Redirect: `https://www.agent7even.ai/api/analytics/meta-callback`
- [ ] If re-enabled before ads ship: remove `ads_read` / `ads_management` from OAuth scopes

### 9.4 OpenRouter / Anthropic / Exa

- [ ] Production API keys with spend limits / alerts
- [ ] `NEXT_PUBLIC_EXA_PREFILL_ENABLED` — decide on for launch
- [ ] Rate limits and trial/monthly credit enforcement verified under load

---

## 10. Cron jobs & background work

Configured in `vercel.json` (requires Vercel plan with Cron support):

| Cron | Schedule | Route |
|------|----------|-------|
| Scheduled agents | Hourly | `/api/cron/run-scheduled-agents` |
| Credit allocation | 1st of month | `/api/cron/allocate-credits` |
| Pricing refresh | Every 6h | `/api/cron/refresh-pricing` |
| Engagement score | Daily 06:00 | `/api/cron/calculate-engagement` |
| Inactive nudge | Daily 09:00 | `/api/cron/nudge-inactive` |
| Morning digest | Daily 12:00 | `/api/cron/morning-digest` |

- [ ] **BLOCKER — Vercel Cron enabled** on production project (Pro plan)
- [ ] `CRON_SECRET` set; each route rejects unauthorized calls
- [ ] **`calculate-engagement`** — never verified in v2; run manually once before relying on it
- [ ] Monitor first week of cron logs in Vercel

---

## 11. Marketing & product alignment

- [ ] All v2 marketing pages (`/`, `/pricing`, `/agents`, `/use-cases`) CTAs → `/sign-up` and `/pricing` on **same host** (not `app.agent7even.com`)
- [ ] Footer links: Privacy, Terms, Security, Data Deletion
- [ ] Pricing page matches live Stripe prices ($49 / $89 / $149)
- [ ] Starter CTA: "Start your free trial" · Growth/ProAgent: "Get started"
- [ ] No "Book a free call" CTAs
- [ ] Optional: redirect `agent7even.com` marketing site to `.ai` when cutover complete
- [ ] Update `~/agent7even` marketing repo links if `.com` still sends traffic to old app

---

## 12. Security & ops

- [ ] No secrets in git; `.env.local` gitignored
- [ ] Supabase service role key never exposed to client
- [ ] Stripe restricted keys considered for read-only admin tooling
- [ ] Admin routes (`/admin/*`) — `requireAdmin` tested
- [ ] Webhook endpoints reject bad signatures (Clerk svix, Stripe sig)
- [ ] `INTERNAL_JOB_SECRET` on agent/digest internal routes
- [ ] Error monitoring — add Sentry or Vercel observability (optional but recommended)
- [ ] Uptime check on `https://www.agent7even.ai/sign-in` and `/api/webhooks/stripe`

---

## 13. Pre-launch QA script (run in order)

Run on **production** env with real keys, using a **fresh test email** and a **real card** (refund after):

1. [ ] Land on `www.agent7even.ai` → Sign up → Foundation flow starts
2. [ ] Complete Foundation (or skip path) → Dashboard loads
3. [ ] Pricing → Starter free trial Checkout → success → `profiles.plan = starter`, trial status
4. [ ] AI Toolkit — run prompt (within trial limit); 6th run blocked with `TRIAL_LIMIT`
5. [ ] Brand Kit locked during trial
6. [ ] Connect Google Analytics (if enabled)
7. [ ] Connect social via Zernio — paying customers cleared (Jul 2026); run `scripts/verify-zernio-go-live-readiness.ts` before first live connect
8. [ ] Analytics tab shows data or honest empty/sync-pending state
9. [ ] Inbox loads for connected account
10. [ ] Create + schedule a post (if posting enabled)
11. [ ] Invite team member → seat billing line item appears
12. [ ] Billing portal → cancel / update payment method
13. [ ] Submit `/data-deletion` form → emails received
14. [ ] Sign out / sign in persists session
15. [ ] Mobile smoke: inbox, analytics connect panel, pricing

---

## 14. Launch sequence (recommended order)

| Phase | Actions | Gate |
|-------|---------|------|
| **1 — Infrastructure** | DNS, Vercel prod env, Supabase migrations, Resend domain | All required env vars set |
| **2 — Auth** | Clerk Production + webhook | Sign-up creates profile |
| **3 — Billing** | Stripe Live products, webhook, portal | Real $1 test charge + refund |
| **4 — Legal** | Meta/Google URLs, data deletion page | Legal review pass |
| **5 — Integrations** | GA OAuth on `.ai`; Zernio live for paying customers | Tenant isolation answers in chat (non-blocking pilot) |
| **6 — Crons** | Enable + monitor 48h | No silent failures |
| **7 — Soft launch** | Invite-only / internal users | QA script green |
| **8 — Public launch** | Open sign-up, monitor Stripe + Clerk logs | On-call for 72h |

---

## 15. Known deferrals (not launch blockers if scoped out of marketing)

| Item | Notes |
|------|-------|
| Zernio BYOK / Meta app rebrand | OAuth shows "Social Media Connector" on shared key |
| Paid ads (Meta Marketing API on Agent7even app) | v1: Zernio Ads API when ready; direct Meta ads = separate App Review (§8.1) |
| Meta Data Deletion **Callback** URL | Form page sufficient for most reviews |
| Competitor post-level metrics | Gated — `backlog_gate_competitor_reach.md` |
| Inbox Maya draft-reply (B4.1) | Optional enhancement |
| Post media Phases B/C (video, carousel) | `post_media_expansion_handoff.md` |
| Port to `agent7even-app` repo | Only if cutover strategy requires legacy repo |

---

## 16. Sign-off

| Area | Owner | Date | Ready? |
|------|-------|------|--------|
| DNS / Vercel | | | ☐ |
| Clerk Production | | | ☐ |
| Stripe Live | | | ☐ |
| Supabase | | | ☐ |
| Legal / Meta / Google | | | ☐ |
| Zernio / social | | | ☐ |
| QA script | | | ☐ |
| Marketing CTAs | | | ☐ |

**Greenlight criteria:** All **BLOCKER** items checked + QA script passed + one successful live Starter trial subscription end-to-end.

---

*Update this doc when items ship. After cutover, bump AGENTS.md "Last reviewed" date and add summary to CONTEXTV22.md.*
