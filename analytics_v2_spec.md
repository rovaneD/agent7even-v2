# Analytics V2 — Maya's Performance Intelligence Hub
## Product Spec + UI Redesign + Claude Code Handoff
*Snapshot: June 5, 2026 — REVISED to reflect Zernio as the social/ads analytics layer.*
*Append to CONTEXTV12 and MAYA_CONTEXT_V03 when built.*

Read AGENTS.md, CONTEXTV12.md, MAYA_CONTEXT_V03.md before starting.
Confirm `git remote -v` shows `rovaneD/agent7even-v2`.
Branch off `main`: `feature/analytics-v2`

---

## The vision in one sentence

Analytics is Maya's read on everything that is happening across the owner's
marketing — website, social, ads, and inbox — delivered as intelligence and
actionable signals, not as raw charts the owner has to interpret themselves.

---

## Data source architecture (revised June 5, 2026)

Two data sources. That's it.

**Google Analytics (GA4)** — website traffic only.
Sessions, pageviews, bounce rate, top pages, traffic sources, referrals.
OAuth already built and live. Stays exactly as-is.

**Zernio** — everything social and paid.
Replaces ALL of the following that were previously planned as separate integrations:
- Meta/Instagram direct API (was blocked by pending scope review — now irrelevant)
- Meta Ads API (direct integration no longer needed)
- LinkedIn Ads, TikTok Ads, Pinterest Ads, Google Ads (all covered by Zernio)
- Organic social analytics (Instagram, Facebook, TikTok, LinkedIn, YouTube, X,
  Threads, Bluesky, Pinterest, Reddit, Google Business)
- Inbox analytics (Comments, Messages — via Zernio Inbox API)

Zernio's platform coverage confirmed from their dashboard (June 5, 2026):
Social: TikTok, Instagram, Facebook, YouTube, LinkedIn, Twitter/X, Threads,
Bluesky, Pinterest, Reddit, Google Business, Snapchat (coming soon)
Ads: Meta Ads, LinkedIn Ads, Pinterest Ads, TikTok Ads, Google Ads, X Ads

Zernio's API surface (confirmed from their nav):
Posts, Analytics, Inbox, Ads, Numbers, Webhooks

This is the single most important architectural decision in this spec:
Maya does not build direct social platform integrations. Zernio handles
platform OAuth, app review, quota limits, and API maintenance.
Maya calls one API (Zernio) with a master key + profile_id.

---

## What the Instagram scope review blocker status is now

The Meta app review for instagram_basic and instagram_manage_insights is
NO LONGER A BLOCKER for Analytics V2. Zernio has already handled Meta platform
approval on their side. Maya reads Instagram data through Zernio's Analytics API,
not directly from Meta.

The Meta OAuth in Maya (meta-connect, meta-callback routes) was built for direct
Meta Ads and Instagram access. Once Zernio is the analytics layer, these routes
become redundant for analytics purposes. Do NOT remove them in this build —
they may still be used for the existing connect flow. But do not build new
direct Meta API routes for analytics data. All new social/ads analytics goes
through Zernio.

---

## Zernio integration prerequisites

Before Analytics V2 can be built, confirm:
1. Zernio Analytics API endpoints return the same metrics shown in their
   dashboard (engagement rate, reach, followers, posts, likes, best time to
   post, follower history, top performing posts)
2. Zernio Ads API returns spend, reach, clicks, CTR per ad platform
3. Data is accessible with master key + profile_id scoping (confirmed by Elean)
4. Test with a connected account before writing any analytics routes

Zernio API key: stored in env as ZERNIO_API_KEY (server-side only, never
exposed client-side). Add to .env.local and Vercel Preview + Production scopes.

The lib/social/publisher.ts swappable interface (from zernio_social_evaluation_backlog.md)
is the right place for Zernio API calls. Do NOT scatter Zernio calls across
multiple routes — all Zernio access goes through the publisher lib, which is
the architectural answer to vendor lock-in risk.

---

## Full analytics scope

This is what Analytics V2 covers. Organized by Zernio's API surface.

### Website (Google Analytics — existing)
- Sessions, users, pageviews
- Avg session duration, bounce rate
- Top pages (top 5 by sessions)
- Traffic sources: Direct / Organic / Social / Referral (%)
- Cross-channel referral insight: "Instagram drove X% of website sessions"

### Social organic (Zernio Analytics API)
Per connected platform (Instagram, Facebook, TikTok, LinkedIn, YouTube,
X, Threads, Bluesky, Pinterest, Reddit, Google Business):
- Total followers + growth (7D/30D/90D)
- Total reach
- Engagement rate
- Posts published this period
- Likes over time
- Best time to post (derived from post performance data)
- Top performing posts (post preview, platform, reach, engagement)
- Posts per platform breakdown
- Follower history over time

### Paid ads (Zernio Ads API)
Per connected ad platform (Meta Ads, LinkedIn Ads, TikTok Ads, Pinterest Ads,
Google Ads, X Ads):
- Total spend
- Total reach
- Clicks + CTR
- Active campaigns (name, spend, reach, CTR, status)
- CTR trend (sparkline)
- Cost per result

### Inbox / engagement (Zernio Inbox API)
- Total comments received
- Total DMs received
- Response rate
- Unread count
- This is a lighter section — surface the signal, not the full inbox
  (the full inbox UI is a separate product surface if Maya builds it later)

---

## Page structure

### Header (white bg, bottom border, px-8 pt-6 pb-0)

Eyebrow: "ANALYTICS"
Title: "Performance overview"
Subtitle: "Website, social, and paid media · Last updated [time ago]"

Top-right: time range selector 7D / 30D / 90D + "Generate briefing" button (blue)

Connection status strip (below title, above tabs):
Shows connected sources as pills. One pill per Zernio-connected platform
(not per account — aggregate). Plus GA pill.
Example: [GA4 ✓] [Instagram ✓] [Facebook ✓] [Meta Ads ✓] [+ Connect more]
"+ Connect more" opens the Connect panel (see below).

---

### Tab navigation

Four tabs:

1. **Overview** (default) — Maya's briefing + unified metrics bar + cross-channel signals
2. **Social** — organic social analytics (all Zernio-connected social platforms)
3. **Ads** — paid ads analytics (all Zernio-connected ad platforms)
4. **Inbox** — engagement summary (comments, DMs, response rate)

This tab structure mirrors Zernio's own nav (Analytics / Ads / Inbox) plus
the GA website layer. It maps directly to how the data is organized in their API.

---

### Tab 1: Overview

**Maya's briefing card** (full width, blue left border, white card)

States:
A) No sources connected: empty state with connect CTA
B) Connected, no briefing yet: "Maya hasn't analyzed this period yet."
   [Generate briefing →] "~15 seconds · 2 credits"
C) Briefing generated:
   Maya avatar + "Maya's read · [date]"
   2-4 sentences synthesizing GA + social + ads data.
   "Ask Maya about this →" link

**Unified metrics bar** (4 cards across)
| Card | Metric | Source |
|---|---|---|
| GA Sessions | sessions this period | GA4 |
| Total Reach | reach across all social platforms | Zernio Analytics |
| Total Followers | aggregate follower count | Zernio Analytics |
| Ad Spend | total spend across all ad platforms | Zernio Ads |

**Cross-channel insight line** (below metrics bar, when 2+ sources connected)
Example: "Instagram drove 34% of your website sessions · Your best-performing
ad platform this week is Meta · Tuesday is your highest-reach posting day"
This is one sentence per notable cross-channel finding, separated by ·

**Actionable signals** (2-3 cards, derived from briefing)
Each card: signal text + CTA button linking to the relevant agent or page.
Examples:
- "Meta ad CTR down 40% — creative may need refreshing" → [Generate ad variations]
- "Tuesday posts get 2x reach — content calendar has Monday scheduled" → [View calendar]
- "Instagram followers grew 8% — capitalize with a campaign this week" → [Build campaign]

---

### Tab 2: Social

**Platform selector** (horizontal scroll of connected platform pills)
All / Instagram / Facebook / TikTok / LinkedIn / YouTube / X / Threads / etc.
Selecting a platform filters all charts below to that platform.
"All" aggregates across platforms where the metric makes sense (total reach,
total followers) or shows per-platform breakdown.

**Top stats row** (5 cards):
Engagement Rate / Total Reach / Total Followers / Posts This Period / Best Post

**Charts section** (2-column grid):
- Posts per platform (bar chart by platform)
- Posts over time (line chart, posts per week)
- Likes per platform (bar)
- Likes over time (line)
- Follower history (line, with platform filter)

**Best time to post** (full width)
Heatmap or simple day/time grid showing engagement by time slot.
"Not enough data yet — post more to see your best times" when insufficient data.

**Top performing posts** (table)
Columns: Platform icon, Post preview (first 60 chars), Date, Reach, Likes,
Engagement rate, [View on platform ↗]
Sorted by engagement rate. Top 10. Time range filtered.

**Empty state** (when no social accounts connected):
"Connect your social accounts to see organic performance"
[Connect accounts] button → opens Connect panel

---

### Tab 3: Ads

**Ad platform selector** (pills): All / Meta Ads / LinkedIn Ads / TikTok Ads /
Pinterest Ads / Google Ads / X Ads

**Top stats row** (4 cards):
Total Spend / Total Reach / Total Clicks / Average CTR

**Charts section**:
- Spend over time (line)
- CTR trend (line with 7 data points for 7D)
- Reach by platform (bar)

**Active campaigns table**:
Columns: Platform icon, Campaign name, Spend, Reach, Clicks, CTR, Status
Top 10 by spend. Time range filtered.

**Maya's ads read** (below table):
One-paragraph Maya interpretation of the ads data. Generated as part of the
full briefing but displayed here in context. Example: "Your Meta CTR of 1.2%
is below the 1.8% you hit last month. This usually signals creative fatigue.
Your LinkedIn campaigns are performing well — CTR held steady at 0.9%."

**Empty state** (when no ad accounts connected):
"Connect your ad accounts to track spend, reach, and performance"
[Connect ad accounts] button

---

### Tab 4: Inbox

**Summary cards** (3 cards):
Total Comments / Total DMs / Response Rate

**Platform breakdown** (simple table):
Platform / Comments / DMs / Unread
Shows which platforms have engagement needing attention.

**Engagement trend** (line chart):
Total comments + DMs over the selected time range.

**Note at bottom** (always visible):
"Manage and reply to comments and DMs directly in Maya — coming soon."
This sets expectations: inbox analytics is here, full inbox management
is a future surface.

**Empty state**:
"Connect social accounts to track comments and messages"

---

### Connect panel (slide-out, accessible from "+ Connect more" in status strip)

This is how owners connect their social and ad accounts to Zernio through Maya.
The owner never sees Zernio branding — this is Maya's connect flow.

Panel header: "Connect your accounts"
Sub: "Maya uses these connections to track performance and publish content."

Two sections:
**Social accounts** — list of supported platforms with connect buttons
**Ad accounts** — list of supported ad platforms with connect buttons

Each platform row:
- Platform icon + name
- "Connected" green pill if linked, or [Connect] button if not
- Connected state shows: account name/handle + [Disconnect] link

The connect action fires Maya's Zernio OAuth flow:
POST /api/integrations/zernio/connect (new route)
This creates a Zernio profile for the tenant (on first connection) and
initiates the platform OAuth through Zernio's connection API.
On success: stores the Zernio profile_id and connected platform list
in profiles (new columns — see Supabase section).

---

## Trial gate and mock data (required — build before connecting any real accounts)

### The rule
Social account connections (which trigger Zernio billing) are ONLY available on an
active paid plan. Trial users (trial_active = true) and users with no plan see mock
data with a clear upgrade prompt. They never trigger a Zernio OAuth flow.

This is consistent with existing trial gates: Brand Kit locked during trial,
AI Toolkit capped at 5 runs. Zernio account connections belong in the same category.

### Three rendering states

Every analytics component checks a single derived state:

```typescript
type AnalyticsDataState = 'mock' | 'live' | 'empty'

// Derived server-side, passed to the page as a prop:
// 'mock'  — trial active OR no active plan → show mock data + upgrade banner
// 'live'  — active plan + zernio_profile_id exists + accounts connected → real data
// 'empty' — active plan + no accounts connected yet → connect prompt
function getAnalyticsState(profile: Profile): AnalyticsDataState {
  const hasPlan = profile.plan && !profile.trial_active
  if (!hasPlan) return 'mock'
  if (!profile.zernio_profile_id || !profile.zernio_connected_platforms?.length)
    return 'empty'
  return 'live'
}
```

No Zernio API calls are made in mock or empty state. Zero cost exposure during trials.

### Mock data — lib/analytics/mockData.ts

One static file. Numbers are deliberately mid-range SMB realistic — plausible for a
real small business after 6 months of consistent posting. NOT aspirational (enterprise
numbers would feel fake), NOT minimal (zero/near-zero would feel unimpressive).

Target ranges:
- Followers: 2,000–4,000 across platforms
- Engagement rate: 2.5–4.5% (realistic SMB average)
- Reach: 15,000–25,000 per period
- Post frequency: 12–18 posts per 30 days

```typescript
// lib/analytics/mockData.ts
export const MOCK_ANALYTICS_SOCIAL = {
  overview: {
    totalFollowers: 2847,
    followerGrowth: 124,
    followerGrowthPct: 4.6,
    totalReach: 18420,
    engagementRate: 3.2,
    postsThisPeriod: 14,
  },
  platforms: {
    instagram: { followers: 1842, reach: 12400, engagementRate: 3.8, posts: 8 },
    facebook:  { followers: 680,  reach: 4200,  engagementRate: 1.9, posts: 4 },
    tiktok:    { followers: 325,  reach: 1820,  engagementRate: 5.1, posts: 2 },
  },
  topPosts: [
    { platform: 'instagram', content: 'Behind the scenes of our process...',
      reach: 2840, likes: 187, engagementRate: 6.6, date: '2026-05-28' },
    { platform: 'instagram', content: 'Customer story: how we helped...',
      reach: 2210, likes: 143, engagementRate: 5.2, date: '2026-05-24' },
    { platform: 'facebook',  content: 'Our new summer collection is here',
      reach: 1840, likes: 89,  engagementRate: 4.1, date: '2026-05-21' },
    { platform: 'tiktok',    content: '3 things nobody tells you about...',
      reach: 1820, likes: 234, engagementRate: 5.1, date: '2026-05-19' },
    { platform: 'instagram', content: 'Throwback to when we first started...',
      reach: 1640, likes: 112, engagementRate: 4.8, date: '2026-05-15' },
  ],
  bestTimeToPost: { day: 'Tuesday', hour: '6:00 PM', avgEngagement: 510 },
  followerHistory: [
    // 30 daily data points showing realistic gradual growth
    // Generate as: start 2720, add 4-6 per day with slight variance
  ],
  dailyMetrics: [
    // 30 days: date, postCount, impressions, reach, likes, comments, shares
    // Build a realistic posting cadence: 3-4 posts/week, weekend dips
  ],
  contentDecay: {
    // Realistic decay: most engagement in first 6h, long tail drops off
    buckets: [
      { label: '0-6h',  pct: 48.2 },
      { label: '6-12h', pct: 19.4 },
      { label: '12-24h',pct: 14.8 },
      { label: '1-2d',  pct: 9.1  },
      { label: '2-7d',  pct: 6.3  },
      { label: '7-30d', pct: 2.2  },
    ]
  }
}

export const MOCK_ANALYTICS_ADS = {
  overview: {
    totalSpend: 340.50,
    totalReach: 24800,
    totalClicks: 412,
    avgCTR: 1.66,
  },
  platforms: {
    meta_ads: { spend: 280.00, reach: 19200, clicks: 334, ctr: 1.74 },
    google_ads: { spend: 60.50, reach: 5600,  clicks: 78,  ctr: 1.39 },
  },
  campaigns: [
    { name: 'Summer Sale — Instagram', platform: 'meta_ads',
      spend: 180.00, reach: 12400, clicks: 218, ctr: 1.76, status: 'active' },
    { name: 'Brand Awareness — Facebook', platform: 'meta_ads',
      spend: 100.00, reach: 6800,  clicks: 116, ctr: 1.71, status: 'active' },
    { name: 'Search — Brand Keywords', platform: 'google_ads',
      spend: 60.50,  reach: 5600,  clicks: 78,  ctr: 1.39, status: 'active' },
  ],
  spendOverTime: [], // 7 daily spend data points
  ctrTrend: [1.82, 1.79, 1.74, 1.71, 1.68, 1.66, 1.66], // slight decline trend
}

export const MOCK_ANALYTICS_INBOX = {
  totalComments: 47,
  totalDMs: 23,
  responseRate: 68,
  platforms: [
    { platform: 'instagram', comments: 31, dms: 18, unread: 4 },
    { platform: 'facebook',  comments: 16, dms: 5,  unread: 1 },
  ],
  trend: [], // 7 days of comment + DM counts
}
```

### Visual treatment in mock state

The goal: the data shape is visible and informative, but there is NO ambiguity
that any number is real. Four layers of signaling, all present simultaneously:

1. AMBER BANNER (top of page body, below tabs, full width, NEVER dismissible):
   Background: #FFF7ED, border-bottom: 1px solid #FDE68A
   Left: ti-eye-off icon + "Demo data only — this is not your real performance.
         Connect your accounts on a paid plan to see live data."
   Right: "View plans →" link (blue #3B82F6)
   Color rationale: amber signals caution/notice, NOT blue (which signals information).
   The owner must understand this is a warning, not a feature description.

2. "Demo" PILL on every metric card (top-right corner of each card):
   bg #FEF3C7, color #92400E, border #FDE68A, 10px, rounded-full
   This means every single number carries a label. Scrolling past the banner
   does not create a window where data looks real.

3. "Demo data" BADGE on every chart/section title (right side):
   Same amber treatment as the pill. Every chart is labeled.

4. SOFT OVERLAY on charts and metrics area:
   rgba(255,255,255,0.55) overlay on the main content area (pointer-events:none).
   The data shape is visible — bars show posting frequency, lines show trends —
   but the visual treatment makes it clearly not live. This is the "ghosted/faded"
   effect. Do NOT use heavy blur or opacity < 0.4 on the charts themselves —
   the owner needs to see what type of data they're getting, just not trust the
   numbers as their own.

5. UPGRADE CARD below the charts (not a modal, not a paywall — inline card):
   White bg, 1.5px blue border (#BFDBFE), rounded-2xl, centered
   Icon: ti-chart-bar in a blue circle
   Heading: "See your real performance data"
   Body: explain what connects (social accounts, GA, ad platforms) and what
         they'll see (followers, reach, engagement, ad spend, Maya's briefing)
   Disclaimer box (amber bg #FEF3C7, 11px):
     ti-info-circle + "Live data is available on paid plans only.
     Not included in the 3-day free trial."
   Primary button: "Activate your plan →" → /dashboard/billing
   Ghost button: "View plan options" → /pricing

6. RIGHT SIDEBAR in mock state (two cards):
   Card 1: "What you'll see when connected" — checklist of all data sources
     (Instagram, Facebook, TikTok, LinkedIn, Meta Ads, Google Ads, GA, Maya
     briefing, best time to post, content decay) each with a green ✓
   Card 2: "Demo data shown above" — 2-sentence explanation that numbers are
     illustrative, ghost bars (gray rounded bars at 50% opacity), and
     "← your data goes here" caption in muted text

### The gate on the connect route

POST /api/integrations/zernio/connect must check plan status:

```typescript
const hasPlan = profile.plan && !profile.trial_active
if (!hasPlan) {
  return NextResponse.json(
    { error: 'active_plan_required',
      message: 'Connect your accounts after activating your plan.' },
    { status: 403 }
  )
}
```

This is a server-side gate — the UI already prevents reaching this route in mock state,
but the route must also enforce it so no direct API calls can bypass the UI gate.

### Cancellation cleanup (webhook handler)

In app/api/webhooks/stripe/route.ts, on these events:
- customer.subscription.deleted
- Trial expiry without conversion (check customer.subscription.updated where
  status changes from 'trialing' to anything other than 'active')

Call Zernio's disconnect API for all connected accounts under that profile:

```typescript
// On cancellation/expiry:
const profile = await getProfileByStripeCustomerId(customerId)
if (profile?.zernio_profile_id && profile?.zernio_connected_platforms?.length) {
  await publisher.disconnectAllAccounts(profile.id)
  // publisher.disconnectAllAccounts calls DELETE /api/integrations/zernio/disconnect
  // which removes all platform connections via Zernio API
  // Updates profiles.zernio_connected_platforms = []
}
```

This is REQUIRED. Without it, cancelled accounts continue to bill indefinitely.
Build this in the same session as the connect flow — do not ship connect without
the disconnect cleanup being live.

### X/Twitter cost disclosure during connect

When a user on an active plan connects X/Twitter, show a cost disclosure modal
BEFORE completing the OAuth redirect:

"X/Twitter has per-call API costs that pass through from Zernio:
- Reading posts and analytics: $0.005 per call
- Publishing posts: $0.015 per post
- Posts with URLs: $0.200 per post

We recommend setting a monthly spend cap. [Set cap before connecting →]"

Two buttons: [Set cap and connect] (opens cap input then OAuth) / [Connect without cap]

The X spend cap is settable via Zernio's billing API or their dashboard. Link to
their dashboard for now (zernio.com/dashboard/billing) until a direct API exists.

### Definition of done additions (add to Phase 2 checklist)

- [ ] getAnalyticsState() returns correct state for trial/no-plan/active-plan users
- [ ] Mock data file lib/analytics/mockData.ts populated with realistic SMB numbers
- [ ] Mock state renders sample data with persistent banner + "Sample" pills
- [ ] Connect CTA at bottom of each tab links to /dashboard/billing in mock state
- [ ] POST /api/integrations/zernio/connect returns 403 for trial/no-plan users
- [ ] Stripe webhook cancellation handler calls disconnectAllAccounts()
- [ ] X/Twitter connect shows cost disclosure before OAuth redirect
- [ ] Zero Zernio API calls made for any user in mock or empty state

## New API routes

### GET /api/analytics/zernio/social
Fetches social analytics from Zernio Analytics API.
Params: profileId, platform (optional, default all), dateRange (7d/30d/90d)
Returns: { followers, reach, engagementRate, posts, likes, bestTimeToPost,
topPosts, followerHistory, platformBreakdown }

### GET /api/analytics/zernio/ads
Fetches ads analytics from Zernio Ads API.
Params: profileId, platform (optional), dateRange
Returns: { spend, reach, clicks, ctr, campaigns, spendOverTime, ctrTrend }

### GET /api/analytics/zernio/inbox
Fetches inbox summary from Zernio Inbox API.
Params: profileId, dateRange
Returns: { totalComments, totalDMs, responseRate, platformBreakdown, trend }

### POST /api/analytics/generate-briefing
Fires Performance Digest agent with all data sources.
Receives: gaData, zernioSocialData, zernioAdsData, foundationContext
Returns: { briefing, signals, generated_at }
Credits: 2 credits via deductCredits() / refundCredits() on failure.

### GET /api/analytics/briefing
Returns most recent stored briefing for the user.

### POST /api/integrations/zernio/connect
Initiates Zernio platform connection for a tenant.
Creates Zernio profile on first call, stores profile_id.
Handles per-platform OAuth through Zernio's connection API.

### DELETE /api/integrations/zernio/disconnect
Disconnects a platform or the full Zernio integration.
Scoped to the authenticated user's profile_id.

All routes: Clerk auth, profile-ownership scoped, never throw to client.
All Zernio calls go through lib/social/publisher.ts (the swappable interface).
Mirror the pattern from audited routes.

---

## lib/social/publisher.ts — extend for analytics

The publisher lib (from zernio_social_evaluation_backlog.md) is the single
Zernio access point. Extend it with analytics methods:

```typescript
// Existing (publishing):
connectAccount(userId, platform)
listChannels(userId)
schedulePost(userId, payload)
onPublishResult(webhook)

// New (analytics):
getSocialAnalytics(profileId, params)   // → Zernio Analytics API
getAdsAnalytics(profileId, params)      // → Zernio Ads API
getInboxSummary(profileId, params)      // → Zernio Inbox API
getConnectedPlatforms(profileId)        // → list connected accounts
```

All methods: fail soft (return null/empty on error, never throw).
All methods: log Zernio API calls — rate limiting is per API key, not per
tenant, so a busy period across many tenants counts against one limit.
Build a simple request-rate guard into the lib from day one.

---

## New Supabase columns + table

```sql
-- Add to profiles table:
ALTER TABLE profiles
  ADD COLUMN zernio_profile_id text,          -- Zernio profile ID for this tenant
  ADD COLUMN zernio_connected_platforms jsonb, -- ['instagram', 'facebook', 'meta_ads', ...]
  ADD COLUMN zernio_connected_at timestamptz;

-- analytics_briefings table (new):
CREATE TABLE analytics_briefings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  briefing_text text NOT NULL,
  signals jsonb,              -- [{ type, text, cta_route, cta_label, priority }]
  sources_used text[],        -- ['ga', 'zernio_social', 'zernio_ads']
  time_range text NOT NULL,   -- '7d' | '30d' | '90d'
  ga_snapshot jsonb,
  zernio_social_snapshot jsonb,
  zernio_ads_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON analytics_briefings(profile_id, created_at DESC);
-- RLS: profile_id = authenticated user's profile
```

---

## Foundation Memory feedback loop

After each briefing generation, write analytics signals back to
profiles.foundation_answers.analytics_memory:

```typescript
{
  topChannel: string,           // e.g. 'Instagram'
  topAdPlatform: string,        // e.g. 'Meta Ads'
  bestPerformingTopic: string,  // from top posts
  adEfficiency: string,         // 'improving' | 'declining' | 'stable'
  avgEngagementRate: number,
  lastBriefingDate: string,
  keyInsight: string,
}
```

This feeds back into every agent run — Campaign Builder knows Instagram is
the top channel, Ad Copy Generator knows CTR is declining, Content Writer
knows Tuesday is the best posting day. Do NOT overwrite user-authored fields.

---

## Performance Digest agent prompt (update in agent_skills table)

Input shape:
```
{
  ga: { sessions, topPages, trafficSources, referrals },
  social: { totalReach, followers, engagementRate, topPosts, bestDay },
  ads: { totalSpend, ctr, topCampaign, ctrTrend },
  foundation: { companyName, channels, monthlyGoal },
  previousBriefing?: string
}
```

Output shape (strict JSON):
```
{
  briefing: string,    // 2-4 sentences, specific numbers, strategist tone
  signals: [
    {
      text: string,        // one sentence, references a specific metric
      cta_label: string,   // action label
      cta_route: string,   // route in Maya
      priority: 'high' | 'medium'
    }
  ]
}
```

Constraints:
- Every signal MUST reference a specific number from the input data
- No generic advice ("post consistently", "engage with your audience")
- Tone: direct, specific, confident — Maya has seen the data
- If a metric improved: say by how much and what likely caused it
- If a metric declined: say by how much and the most likely cause
- Cross-channel insights take priority over single-channel observations

---

## Design tokens — unchanged from prior spec

Primary blue: #3B82F6
Success green: #10B981
Warning amber: #F59E0B
Danger red: #EF4444
Page bg: #FCFCFC
Card: white, rounded-2xl, border-gray-100, no shadow
Canvas: mx-auto max-w-[1240px] px-8 py-6
Maya intelligence card: 4px blue left border — briefing card ONLY
No pink except Maya avatar. No old orange.

---

## What does NOT change

- All existing GA OAuth routes (ga-connect, ga-callback, ga-properties, ga-data)
- The CSRF nonce pattern from the audit (oauth-state.ts)
- The existing Meta OAuth routes (meta-connect, meta-callback) — leave in place,
  do not remove, but do not build new analytics routes using them
- The profiles columns that store existing GA tokens and Meta IDs

---

## Phased build order

Phase 1 — Page structure + tab navigation + unified metrics bar (UI only)
Rebuild page layout: header with connection status pills, four tabs (Overview,
Social, Ads, Inbox), metrics bar with correct empty states. No new API routes.
Existing GA data populates the GA card. Zernio cards show "Connect" empty state.

Phase 2 — Zernio connection flow
Build POST /api/integrations/zernio/connect and the Connect panel slide-out.
Run the Supabase migration for zernio_profile_id columns. Test connecting one
social account (Instagram) and confirming the profile_id is stored correctly.

Phase 3 — Social tab (Zernio Analytics API)
Build GET /api/analytics/zernio/social. Populate the Social tab with real data.
Test with a connected Instagram or Facebook account. Confirm all metrics match
what Zernio's own dashboard shows.

Phase 4 — Ads tab (Zernio Ads API)
Build GET /api/analytics/zernio/ads. Populate the Ads tab. Test with a
connected ad account.

Phase 5 — Inbox tab (Zernio Inbox API) — **DONE June 14, 2026**
Build GET /api/analytics/zernio/inbox. Populate the Inbox tab.
**Follow-on (shipped same release):** `/dashboard/inbox` workspace — see
`zernio_inbox_phase_b_plan.md` and `CONTEXTV17.md`.

Phase 6 — Maya's briefing + generate-briefing route
Add the briefing card. Build POST /api/analytics/generate-briefing.
Update Performance Digest agent prompt in agent_skills. Create
analytics_briefings table. Wire actionable signals on Overview tab.

Phase 7 — Foundation Memory feedback loop
Extend loadFoundationMemory() with analytics_memory. Write back after
each briefing generation.

Do NOT attempt all phases in one session. Phase 1 first.

---

## Definition of done

Phase 1:
- [ ] Header with 4 tabs, connection status strip, time range selector
- [ ] Overview tab: briefing card empty state, metrics bar (4 cards), signals empty state
- [ ] Social tab: platform selector, top stats row, charts section, empty state
- [ ] Ads tab: platform selector, top stats row, campaigns table, empty state
- [ ] Inbox tab: summary cards, empty state
- [ ] Connect panel slide-out accessible from "+ Connect more"
- [ ] All design tokens correct, no orange, no pink on cards
- [ ] npx tsc --noEmit + npm run build pass

Phase 2:
- [ ] Supabase migration run: zernio_profile_id + connected_platforms on profiles
- [ ] POST /api/integrations/zernio/connect creates Zernio profile and stores ID
- [ ] Connect panel shows connected/disconnected state per platform
- [ ] Connecting Instagram works end-to-end and appears in status strip

Phase 3:
- [ ] GET /api/analytics/zernio/social returns real data
- [ ] Social tab populates with live metrics matching Zernio's own dashboard
- [ ] Platform filter works across all charts
- [ ] Top performing posts table shows real posts

Phase 4:
- [ ] GET /api/analytics/zernio/ads returns real data
- [ ] Ads tab shows spend, reach, CTR, active campaigns

Phase 5:
- [x] GET /api/analytics/zernio/inbox returns real data
- [x] Inbox tab shows comments, DMs, response rate

Phase 5b (inbox workspace — shipped June 14, 2026):
- [x] GET /api/inbox/conversations, messages, comments proxy routes
- [x] `/dashboard/inbox` — DM read/reply + post comments list
- [x] Sidebar Inbox nav; Analytics tab links to workspace
- [ ] Maya draft-reply in composer (B4.1 — optional)

Phase 6:
- [ ] analytics_briefings table migrated with RLS
- [ ] Generate briefing fires Performance Digest agent with all data sources
- [ ] Briefing card shows all three states correctly
- [ ] Signals panel shows 2-3 data-derived actions with working CTAs
- [ ] 2 credits deducted via lib/credits.ts, shown in UI

Phase 7:
- [ ] loadFoundationMemory() includes analytics_memory
- [ ] After briefing, foundation_answers.analytics_memory updated
- [ ] Agents receive analytics context in runner calls

---

## Update these docs when built

- CONTEXTV17.md (successor to V12+): new routes, Zernio inbox analytics + workspace,
  Stage 2 Idea Analysis, lib/social/publisher.ts inbox extensions — **updated June 14, 2026**.
- MAYA_CONTEXT_V08.md (successor): Analytics inbox live data, `/dashboard/inbox`
  affordances, Idea Analysis → Viral Hooks — **updated June 14, 2026**.
- competitive_intelligence.md: Update Zernio entry to reflect analytics
  capabilities confirmed and in use.
- AGENTS.md: update Last reviewed date.

---

## TRACKED TODO at fold-in time

The existing Meta OAuth routes (meta-connect, meta-callback) become
redundant for analytics once Zernio is live. At the NEXT major doc version,
flag to Rovane whether to deprecate those routes or keep them as a fallback.
Do not remove them in this build — confirm the Zernio analytics layer is
stable first. This is a conscious deferred decision, not an oversight.
