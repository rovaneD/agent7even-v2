# EnsembleData Verification Spike — Outlier Gate Unblock

*Purpose: confirm EnsembleData can supply the competitor post-level data that the
outlier-intelligence gate (Stage 1 + Stage 3) is blocked on, at a cost that
survives Maya's per-tenant fan-out. This is a VERIFY task — sign up for the free
trial, make real calls, capture real numbers. Decide after, build nothing yet.*

**Context:** Recon returned NO-GO on the gate because no integrated source gave
per-post metrics for non-owned channels. EnsembleData is a public-data scraping
API that, on paper, fills it. Web research already confirmed (a) consumption-unit
pricing that fits fan-out and (b) a live TikTok response containing `play_count`
(views) per post. This spike confirms it end-to-end before any commitment.

---

## What's already known (don't re-verify, build on it)

- **Pricing model:** daily unit buckets, reset 00:00 UTC, no charge for failed
  calls. Free 50 units/day · Wood 1,500/$100mo · Bronze 5,000/$200mo ·
  Silver 11,000/$400mo · Gold 25,000/$800mo.
- **Relevant Instagram endpoints + unit costs (from docs):**
  - `instagram/user/reels` — #posts units (1 unit ≈ 1 post) — **the key one**
  - `instagram/user/posts` — #posts units
  - `instagram/user/detailed-info` — 10 units — profile + 12 most recent posts
  - `instagram/user/basic-stats` — 4 units — username, followers, followings
  - `instagram/post/info-and-comments` — 2 units — full post info
- **TikTok equivalent confirmed to return views:** the `statistics.play_count`
  field came back in a real hashtag-search response. Instagram reels follow the
  same response shape.
- **Vendor compliance claim:** "public data only, no private/sensitive data, no
  fake accounts, GDPR + ToS compliant." This is THEIR posture on THEIR scraping —
  it does not automatically cover Maya reselling derived insight (see Q3 below).

---

## The three questions this spike must answer

### Q1 — DATA SHAPE (the gate itself)
Does a per-competitor call return **view count + recent post history** for a
public handle the SMB does NOT own?

Steps:
1. Sign up free (no card): https://dashboard.ensembledata.com/register → get token.
2. Pick 2-3 real competitor-style IG handles (e.g. a marketing creator).
3. Call `instagram/user/reels` for each. Confirm the response contains, per reel:
   - a **view/play count** field (the outlier numerator)
   - **like / comment / share** counts (engagement fallback)
   - a **timestamp** (needed to scope "recent" for the baseline)
4. Call `instagram/user/detailed-info` for one handle. Confirm it returns the
   ~12 most recent posts WITH the metric fields above (this is the cheapest
   single-call baseline primitive at 10 units).

**Pass = view count + per-post metrics + timestamp present for a non-owned handle.**
If only follower/profile data comes back and per-post views are absent on IG
(even though TikTok has play_count), record that as a PARTIAL — IG may differ
from TikTok, and the feed's first platform matters.

### Q2 — COST FAN-OUT (does it survive Maya's scale)
Capture the REAL per-tenant unit cost from the calls above, then project.

1. Use `customer/get-used-units` (0 units) before and after to measure exact
   spend per competitor refresh.
2. Compute: units per competitor × (typical competitors per SMB, assume 5) =
   units per tenant per refresh.
3. Project against refresh cadence (assume weekly) and tenant counts:
   - At Bronze (5,000 units/day): how many tenant-refreshes/day fit?
   - At what tenant count do you outgrow each tier?
4. Convert to $/tenant/month and sanity-check against Maya's ~$0.04/credit
   economics. Record the actual number, not the earlier estimate (~50 units/
   tenant/refresh → hundreds of tenants on $100-200/mo was the projection).

**Pass = projected data cost per tenant is a small fraction of per-tenant revenue
at the tenant scale Maya targets.**

### Q3 — RESALE / ToS (the legal gate, same severity as DPA)
The one question that is specifically about Maya's model, not their scraping.

1. Read EnsembleData Terms: https://ensembledata.com/terms-and-conditions
2. Confirm whether redistributing / reselling DERIVED insight (outlier findings,
   not raw data) to Maya's own customers is permitted, restricted, or silent.
3. Note any attribution, caching, or retention limits (can you STORE the baseline
   history, or must you re-fetch each time? Storage is required for baselines).
4. Separately note: this remains PUBLIC-SCRAPED data. Even if their ToS permits
   resale, Maya inherits a public-scraped-data risk class — materially better
   than self-scraping, but not the clean licensed posture of Exa/Zernio. This is
   a DECISION to record, not a checkbox to pass.

---

## Deliverable

A short findings report:
1. **Q1 verdict** — data shape confirmed / partial / failed, with a redacted
   sample of the per-reel fields returned (field names, not full payload).
2. **Q2 verdict** — real units-per-tenant number + the tier→tenant-count table +
   $/tenant/mo. GO only if the economics clearly work.
3. **Q3 verdict** — resale permitted / restricted / unclear, + storage/retention
   note, + the named public-scraped-data risk for the decision record.
4. **Overall gate call:** GO (un-park Stage 1 + Stage 3) / NO-GO (stay parked,
   reason) / CONDITIONAL (what must be true).

Build nothing. This spike decides whether the parked stages un-park, and onto
which platform (IG vs TikTok) the first feed should target based on Q1.

**Completed:** findings in `ensembledata_verification_findings.md` (2026-06-14).

---

## Note on platform choice (falls out of Q1)
If IG per-post views prove harder to get than TikTok's `play_count`, the first
outlier feed may target TikTok, where view data is confirmed. Record which
platform has the cleanest view data — it determines the feed's v1 scope.
