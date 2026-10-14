# Unified Credit Pricing: Implementation Plan

Version 1 · 2026-10-14 · Owner: Rovane Durso
Source of truth: the "Unified Credit Pricing: Implementation Plan" doc on claude.ai. This file is a copy for the repos. If the two disagree, the doc wins; update this copy in the same session.

## Summary

Maya and Atlas move to one credit wallet: pay as you go by default, plans as a discount, one rate card for both products. The work runs in five phases. Phase 0 stops losses this week and needs no architecture change. Everything after it waits on one decision: the wallet lives in Maya's Supabase, and Atlas calls it.

- **Why now:** no paying customers on either product, so there is nothing to migrate and no one to grandfather.
- **Biggest current leaks:** Maya top-up packs sell credits below cost on premium video, and Atlas has no metering, rate limits, or Places cache.
- **Rule that keeps both products in step:** neither product enforces credits until the shared wallet has run in shadow mode and reconciled against real vendor costs.

## Pricing principle and rate card

Creating something new costs credits; reusing it is free. One credit is $0.10 at pay as you go, and every paid action must earn at least 3x its cost there and 2x at the deepest plan discount.

| Action | Product | Credits | Pay as you go | Cost per action |
| --- | --- | --- | --- | --- |
| Chat, approvals, Foundation, pins, follow-ups | Both | 0 | Free | under 1 cent |
| Outreach draft, freshness check, reopen research | Atlas | 0 | Free | $0 |
| Short output (post, caption, email) | Maya | 2 | $0.20 | under 1 cent (inferred) |
| Long output (campaign, strategy) | Maya | 20 | $2.00 | 2 to 10 cents (inferred) |
| Market map (category + place) | Atlas | 10 | $1.00 | 3.5 cents |
| Research one business | Atlas | 5 | $0.50 | 1 to 2 cents |
| Qualify, per candidate | Atlas | 1 | $0.10 | under 0.2 cents |
| Standard image | Maya | 5 | $0.50 | about 4 cents |
| Premium image (Recraft) | Maya | 8 | $0.80 | about 24 cents |
| Standard video (Veo) | Maya | 50 | $5.00 | 38 to 76 cents |
| Premium video (Kling) | Maya | 60 | $6.00 | about $1.00 |

- **Pay as you go:** packs of $10, $25, $50 and $100; purchased credits never expire.
- **Plans (draft):** Starter $49 for 600 credits, Growth $89 for 1,200, ProAgent $149 for 2,200. Plan credits reset monthly and are spent before purchased credits.
- **Free starter tank:** 50 credits on sign-up, no card, replacing the 7-day card trial.
- **Savings check:** billing tells a pay-as-you-go customer when a plan would have cost less last month.

## Architecture: one wallet, two apps

The wallet lives in Maya's Supabase because Maya already has `credit_balances`, `credit_ledger` and the Stripe top-up webhook. Atlas keeps its own database and asks Maya's wallet for credits before each paid action.

```
                 Clerk (one login, same user id in both)
                   |                              |
                   v                              v
+----------------------------------+   +----------------------------------+
| Maya app (Next.js, Vercel)       |   | Atlas (FastAPI, Vercel)          |
|  +----------------------------+  |   |  +----------------------------+  |
|  | WALLET (Maya Supabase)     |<-------| Atlas Supabase             |  |
|  | credit_balances            |  reserve / commit / release        |  |
|  | credit_ledger              |  |   |  | research, qualify, outreach|  |
|  | rate_card (one price list) |  |   |  | wallet client              |  |
|  +----------------------------+  |   |  | METERING_MODE flag         |  |
+------|-------------------^-------+   |  | no balances stored here    |  |
       v                   |           |  +----------------------------+  |
   OpenRouter            Stripe        +------------------|---------------+
   text, image, video    packs, plans,                    v
                         refill (webhook)     Google Places or OpenStreetMap,
                                              OpenRouter with Exa search
```

Clerk already gives both apps the same user id, so the ledger needs no account linking. Atlas never stores a balance; it reserves credits, runs the vendor call, then commits or releases.

## Phased plan

Five phases, each gated: a phase starts only when the one before meets its exit check. Phase 0 can start today; Phases 1 and 2 can overlap once the wallet contract is written.

### Phase 0: Stop the losses (both repos, no architecture change)

- [ ] Maya: hide credit top-up purchase until Phase 3 ships the new packs
- [ ] Maya: charge more credits for premium models in today's units (Kling video 25, Recraft image 6)
- [ ] Atlas: per-user rate limit on `/research`, `/discover` and `/businesses/research`; cap batch research at 20 businesses per click
- [ ] Atlas: cache discovery results by normalized category + place (check Google's caching terms first; see Risks)
- [ ] Atlas: allowlist `OPENROUTER_MODEL` so a config change cannot swap in a 16x more expensive model

**Exit:** no top-up can be bought; premium credit charges live in Maya; a repeated Atlas search hits the cache and a burst of requests is throttled.

### Phase 1: Instrument costs (both repos)

- [ ] Atlas: add `usage` (tokens, search count, `cost_usd`) to `research_runs` and cost columns to `ai_reports`
- [ ] Atlas: log every Google Places call with its SKU and cost
- [ ] Maya: confirm `agent_tasks.cost_usd` is recorded for posts, campaigns, images and videos, tagged by action type
- [ ] Both: one weekly query of cost per action type, excluding the internal test accounts

**Exit:** every paid action writes a cost row, and the INFERRED rows in the rate card are replaced with measured averages.

### Phase 2: Shared wallet (Maya repo first, then Atlas)

- [ ] Write the wallet contract (endpoints, auth, idempotency, error codes) as one doc both repos link to
- [ ] Maya Supabase: extend `credit_ledger` with `product`, `action_type`, `idempotency_key`, `status` (reserved, committed, released) and `bucket` (plan or purchased)
- [ ] Maya Supabase: add a versioned `rate_card` table; both products read credit amounts from it, never from code constants
- [ ] Maya: server-to-server wallet endpoints (balance, reserve, commit, release), keyed by the shared Clerk user id
- [ ] Atlas: wallet client behind `METERING_MODE` = off, shadow or enforce
- [ ] Both: run in shadow mode, logging would-be debits without blocking

**Exit:** one week of shadow mode where every ledger debit matches a cost row, and no failed or aborted action is charged.

### Phase 3: Billing

- [ ] Stripe: pay-as-you-go packs, plans as monthly credit grants, optional auto-refill with a customer-set cap
- [ ] Free starter tank on sign-up; remove the card-required trial
- [ ] Spend plan credits before purchased credits; plan credits reset monthly, purchased credits never expire
- [ ] Savings check in billing
- [ ] Balance shown as credits and dollars in both apps

**Exit:** Stripe test mode end to end, then one live purchase with a real card, refunded.

### Phase 4: Launch

- [ ] One pricing page for both products, pay as you go on the left and plans on the right; Atlas pricing page points to it
- [ ] Notify Atlas early-access users at least two weeks before billing, with a free credit grant (the Atlas FAQ promises notice before anything is billed)
- [ ] Flip `METERING_MODE` to enforce: Maya first, Atlas after its notice period
- [ ] Check every pricing claim on both sites against live code (performance theater test)

**Exit:** both products enforce credits from the same rate card, and every published price matches the `rate_card` table.

## Coordination rules

1. **One source of truth.** Credit amounts live only in the `rate_card` table. A price change is one row edit, never two code changes.
2. **Wallet first.** Maya's wallet endpoints ship and pass shadow mode before Atlas calls them in enforce mode.
3. **Same flag in both repos.** `METERING_MODE` = off, shadow or enforce, set per product, so either can roll back alone.
4. **Reserve, then commit.** Reserve credits before a paid vendor call, commit on success, release on failure or abort. No charge when the user got nothing.
5. **One idempotency key per action.** A retry never charges twice.
6. **Contract change = both repos.** The wallet contract doc is versioned; Atlas pins the version it uses, and any change updates both repos' AGENTS.md in the same session.
7. **Session discipline.** Each session starts with `git remote -v` and a check of live code and data; completion is verified against ledger rows, not changelogs.
8. **Test accounts excluded.** rovane@dursodesign.com, melissa@agent7even.com and rovdurs@gmail.com get unlimited internal credit and stay out of every cost and revenue query.

## Risks and open questions

**Decision: Google Places or OpenStreetMap for discovery.** The Market Reveal map uses OpenFreeMap tiles, which are free. Discovery is a separate step: `POST /research` calls Google Places Text Search (`google_places.py:124`), with OpenStreetMap only as a fallback, while Advanced Search uses OpenStreetMap alone.

| Option | Cost per search | Data quality | Limits |
| --- | --- | --- | --- |
| Keep Google Places | 3.5 cents after 1,000 free a month | Websites and phone numbers included | Google restricts how long Places results can be cached |
| OpenStreetMap first | $0 | Websites and phones often missing | Public Nominatim and Overpass allow about 1 request a second and no heavy use; scale needs a self-hosted or paid instance |

**Checks before acting**

- [ ] Google Maps Platform terms on caching Places results, before building the Phase 0 cache
- [ ] Rules on prepaid balances that never expire, before promising "never expire" publicly
- [ ] Stripe requirements for saved-card auto-refill consent, before Phase 3
- [ ] Measured Maya cost per post and per campaign (currently inferred), before locking plan sizes
- [ ] Wallet outage behavior: fail closed for media; deferred debit for Atlas actions that cost under 5 cents

**Known changes to promises**

- Maya's pricing page says campaigns and content are unlimited; under this plan they cost credits. Update the page in Phase 4, not before.
- Maya credits change value (about $0.49 today to $0.10), so balances show a dollar value next to credits.
