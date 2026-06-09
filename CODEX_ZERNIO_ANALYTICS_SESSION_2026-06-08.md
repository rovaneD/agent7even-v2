# Zernio Analytics Session Log

Date: 2026-06-08  
Branch: `feature/foundation-v2`  
Scope: analytics parity work against Zernio, especially the posting analytics page

## Why this document exists

This session focused on getting the in-app analytics experience to match the Zernio platform more closely. The user repeatedly compared the Agent7even analytics page to the exact same account inside Zernio and found that several values and visualizations still did not line up:

- engagement over time did not match
- best post pointed to the wrong Instagram post
- best time to post did not match
- engagement accumulation was off
- some totals and deltas were still looking unreliable

This document records what was investigated, what was changed, what was verified, and what remains unresolved.

## Starting point

The analytics page was originally powered by a mixture of:

- live Zernio payloads
- local mapping logic in `AnalyticsClient.tsx`
- fallback/mock-shaped analytics structures

That meant the UI could render something plausible while still drifting from Zernio in important ways. The user caught that drift by comparing screenshots of the same connected account in both systems.

The key concern was not just display polish. It was data parity. The same connected Instagram account should produce the same underlying analytics conclusions.

## What we tried, in order

### 1. Fixed the Zernio follower count fallback

The first concrete issue was that the total follower count was showing as `0` even though the raw Zernio payload already contained the correct value.

Observed Zernio payload shape:

- `followerStats.accounts[0].currentFollowers = 480`

The frontend mapper was not reading `currentFollowers`. It was only checking older follower field variants. That caused the UI to fall back to zero.

What changed:

- added a dedicated follower-count reader in `app/dashboard/analytics/AnalyticsClient.tsx`
- prioritized `currentFollowers` and `current_followers`
- also checked nested `followerStats.accounts[]`
- kept older field variants as fallback

Result:

- total followers started rendering correctly as `480`
- this was pushed

### 2. Fixed the “best post” link handling

The next mismatch was the best post card. In Zernio, the “View” action opens the actual Instagram post. In the app, the best post card was either:

- missing the link entirely
- or linking to an incorrect/random post

What changed:

- expanded `readBestPostUrl()` in `AnalyticsClient.tsx`
- searched across more fields and nested shapes:
  - `platformPostUrl`
  - `permalink`
  - `postUrl`
  - `url`
  - `link`
  - nested `post`, `content`, `media`, `metadata`
  - `platformAnalytics` arrays at both top level and inside analytics payloads

Result:

- the UI started rendering a real link when a usable URL was present
- however, parity was still not reliable enough
- the user still saw the app linking to the wrong Instagram post in later comparisons

### 3. Removed the Maya briefing block from live analytics

Zernio’s analytics screen is dense and direct. Our app had a Maya briefing block at the top of the live analytics page, which made the layout diverge before the data even started.

What changed:

- removed the Maya briefing block from the live analytics view
- kept it only for mock/demo mode
- let the live page start with filters and stat cards, closer to Zernio

Result:

- layout alignment improved
- the screen stopped showing a large extra block that Zernio does not have

### 4. Mapped more Zernio endpoints directly

We audited the analytics integration against Zernio docs and replaced several endpoint mismatches:

- connect flow contract
- accounts lookup
- daily metrics
- ads analytics
- inbox analytics
- best time to post
- posting frequency
- content decay

Specific work done in the codebase:

- `lib/social/publisher.ts`
  - documented endpoint wrappers were added or corrected
  - endpoint helpers were expanded for:
    - posting frequency
    - content decay
  - connect URL uses `redirect_url`

- `app/api/analytics/zernio/social/route.ts`
  - now fetches:
    - raw post data
    - connected accounts
    - daily metrics
    - follower stats
    - best times
    - posting frequency
    - content decay
  - returns all of those payloads in a combined response

- `app/dashboard/analytics/AnalyticsClient.tsx`
  - updated the live mapping logic to derive:
    - daily analytics
    - platform breakdown
    - top posts
    - follower evolution
    - best time heatmap
    - posting frequency scatter
    - content decay / engagement accumulation
  - added helper functions for:
    - daily metric extraction
    - percentage parsing
    - scatter bucket labels
    - weekday normalization
    - heatmap hour mapping

Result:

- the page had live mapping for the major analytics sections
- but the values still did not fully match Zernio

### 5. Fixed the live analytics layout to better mirror Zernio

We also adjusted the page structure to better resemble the Zernio analytics screen:

- filters at the top
- stats cards in the same general location
- best post positioned as Zernio does
- charts arranged more like the source platform

Result:

- the page looked closer to Zernio
- but matching the layout did not solve the data mismatch

## What we verified

The following checks passed at different points in this work:

- `git diff --check`
- `npx tsc --noEmit`
- `npx next build --webpack`

The normal `npm run build` still hit the known Turbopack sandbox issue in this environment:

- CSS processing eventually tried to bind a port
- the sandbox denied the port bind
- this is environmental, not a code regression

## What the user compared and found still wrong

After the above changes, the user compared the app directly against Zernio for the same connected account and still found meaningful differences:

- engagement over time still did not match
- best post still did not consistently point to the correct Instagram post
- best time still did not match
- engagement accumulation was still off
- some graph shapes and totals looked unreliable

The user also provided a direct Zernio comparison screenshot showing a different analytics shape:

- Zernio had a more populated set of charts and sections
- the in-app version was still not reflecting the same structure or values

## Likely root causes that remain

Based on the state of the code and the comparisons, the remaining mismatch is probably coming from one or more of the following:

### 1. The live mapper is still mixing live data with mock-derived structure

The analytics page still uses a mock-shaped base object in live mapping and overrides fields selectively. That is convenient, but it is also a common source of drift when the remote payload shape is not identical to the UI model.

### 2. Some Zernio payload fields are still being interpreted incorrectly

The following sections are especially suspicious:

- engagement over time
- best time heatmap
- posting frequency scatter
- content decay / engagement accumulation
- best post URL resolution

These may be coming from nested payloads or alternate fields that are not yet handled exactly right.

### 3. The UI may be computing derived metrics differently from Zernio

Even if the raw payload is correct, the UI may still compute:

- engagement rate
- growth deltas
- best time labels
- decay/accumulation curves

in a way that differs from Zernio’s own logic.

### 4. The “best post” card may need stricter source selection

The card should probably be built from a single authoritative post object, not from a fallback search through multiple nested arrays. The current fallback logic makes it resilient, but not necessarily accurate.

## Important files touched in this session

- `lib/social/publisher.ts`
- `app/api/analytics/zernio/social/route.ts`
- `app/dashboard/analytics/AnalyticsClient.tsx`
- `app/dashboard/analytics/page.tsx` indirectly through layout wiring changes earlier in the session

## What was pushed

The analytics work was committed and pushed multiple times during this session. The latest pushed analytics commit before this document was:

- `074ff9b Fix Zernio analytics parity`

Later conversation continued with further observations from the user, but this document is focused on the work done during the session and the remaining mismatch.

## Recommended next step

Do not keep adding ad hoc fallback rules.

The next useful step is to treat Zernio as the canonical source and do one of these:

1. dump the exact Zernio payloads for the current account and map them field-by-field into the UI model
2. remove the mock-shaped base object from the live analytics mapper and build a strict live-data path
3. create a one-screen parity audit for:
   - engagement over time
   - best post
   - best time
   - engagement accumulation
   - follower evolution

Until that happens, the page can look close while still being wrong.

