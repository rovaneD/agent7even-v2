# MAYA_CONTEXT_V04 - Product Context After the Marketing Launch and Social Build
*Versioned snapshot: June 9, 2026*

This document supersedes `MAYA_CONTEXT_V03.md`. Everything in V03 still
applies unless this file explicitly changes it.

## What Changed Since MAYA_CONTEXT_V03

Verified against the codebase on June 9, 2026:

- A new "Posts" workspace area exists between Content Calendar and Foundation
  in the sidebar (`app/dashboard/DashboardShell.tsx` line 90). It is a full
  social-post composer backed by Zernio: media upload with previews, post type
  selector, per-platform captions, pre-submit validation, and queue picker.
- Foundation inside the dashboard is now a Hub with four tabs - Intelligence,
  Knowledge, Memory, Agent connections (`app/dashboard/foundation/FoundationHub.tsx`).
  Users can upload materials (PDF/DOCX/image/URL/text) that enrich agent context.
- The Exa Foundation pre-fill is live in the onboarding flow
  (`app/foundation/FoundationFlow.tsx` + `/api/foundation/research`): Maya reads
  the user's website and pre-fills high-confidence fields. Voice and
  Budget/Goals are never pre-filled; low-confidence fields stay blank. This
  matches the V03 guardrails exactly.
- Analytics now has three tabs: Posting analytics, Inbox analytics, and
  Google analytics (`AnalyticsClient.tsx` line 3125). Posting and Inbox are
  fed by the user's connected Zernio social accounts; Google analytics is fed
  by a per-user GA4 OAuth connection.
- The marketing site now lives at the root of this app: `/` (home), `/agents`,
  `/use-cases`, `/use-cases/[slug]`, `/pricing`, plus legal pages `/privacy`,
  `/terms`, and the new `/security`. All branded `agent7even.ai` with
  `support@agent7even.ai` as the contact address.
- Signing in always lands on `/dashboard` (`forceRedirectUrl` on the SignIn
  component). Users with incomplete Foundation are still bounced to
  `/foundation` by the dashboard itself, so onboarding is unchanged.
- Marketing and dashboard surfaces received a full mobile-responsive pass.
  The Maya chat panel opens as a full-height drawer on mobile.

## 1. Product Identity

Maya is the intelligence layer inside Agent7even v2. She should understand the
current canvas and help the user move the work forward without making them
repeat obvious context.

Current workspace areas (sidebar order, verified in `DashboardShell.tsx`):

- Dashboard Command Center
- Agents
- Campaigns
- Services
- Content Calendar
- Posts (new)
- Foundation
- Brand Kit
- Analytics
- Deliverables
- Support
- Notifications
- Team
- Billing
- Settings

Note: an AI Toolkit page exists at `/dashboard/ai-toolkit` but has no sidebar
entry and no inbound links in the current code.

## 2. Current Flow Updates

Verified unchanged from V03:

- Foundation generation runs before checkout using the platform-funded path
  (`chargeCredits: false` in `/api/foundation/generate`).
- Foundation completion routing: selected plan -> `/checkout-now?plan=...`;
  no plan -> `/pricing?foundation=complete` (`FoundationFlow.tsx` line 240).
- Maya no-credit states open the plan/credits modal; the CTA routes existing
  plan users to `/dashboard/billing` and no-plan users to
  `/pricing?source=maya` (`MayChatPanel.tsx` line 393).

New since V03:

- Sign-in lands on `/dashboard` in all cases. Sign-up still lands on
  `/foundation` (with the selected plan carried in the query string).
- The first onboarding moment can now be the Exa pre-fill: Maya asks for the
  user's website or business name, researches in the background, and enters
  the Foundation steps with editable suggestions. If research is slow or
  fails, the flow falls through to the blank Foundation - it never hangs.

## 3. New Product Surfaces

- **Posts** (`/dashboard/posts`): compose, schedule, and publish social posts
  through the user's connected Zernio profile. Includes platform validation
  rules (`lib/social/postConstraints.ts`) so captions and media are checked
  before submission. Gated by the same team permission as Analytics.
- **Foundation Hub** (`/dashboard/foundation`): Intelligence (foundation
  scores and document state), Knowledge (uploaded materials), Memory, and
  Agent connections (which agents read which Foundation sections).
- **Analytics**: Posting analytics and Inbox analytics mirror Zernio's
  information architecture (30-day default, weekly buckets, engagement rate,
  best post, best-time-to-post heatmap, follower stats). Google analytics
  shows GA4 data for the property the user connects via Google OAuth.
- **Marketing site at root**: editorial design with Metaballs shader hero
  (with a graceful gradient fallback when WebGL fails on mobile), shared
  responsive nav with hamburger menu, and GA4 event tracking on sign-up and
  pricing CTAs.

## 4. Visual Rules

The visual system is unchanged from V03 and confirmed in `app/globals.css`:

- Blue `#3B82F6` is the primary interactive color.
- Pink `#F5349B` is reserved for the logo and restrained accents.
- Standard cards remain white with light borders and no default shadow.
- The Dashboard Command Center hero and Agents hero keep the soft-shadow
  exception.
- Page content stays centered on the canvas (max-w-[1240px]) with left-aligned
  content inside the center column; canvas padding is now responsive
  (`px-4 sm:px-8`).

The marketing site has its own token set (`--l5-*` in `app/lab5/styles.css`)
and is visually distinct from the platform by design.

## 5. Maya Behavior Rules

Maya should continue to:

- Read the page or canvas context before answering.
- Use the appropriate module context when triggered from Dashboard, Agents,
  Campaigns, Services, Content Calendar, Posts, Brand Kit, Foundation, or
  Deliverables.
- Avoid acting like a detached generic chat shell.
- Show clear billing intent when the current state blocks chat due to credits.
- During onboarding pre-fill: present researched fields as Maya's editable
  suggestions, never as the user's own input. A wrong pre-fill is worse than
  none.

## 6. Known Roster Mismatch (marketing vs platform)

The June 9 marketing copy locked a canonical nine-agent roster that includes
**Reputation & Follow-up** and explicitly moves **Brand Voice Guardian** out
of the roster into Maya's orchestration layer (a review gate). The marketing
pages implement this (`app/lab5/agents/page.tsx` has the Reputation &
Follow-up card at line ~192).

The platform agent registry (`lib/agents/registry.ts`) does NOT yet reflect
this: it still contains `brand_voice_guardian` as a registered autonomous
agent and has no reputation/follow-up agent. The platform's nine agents are
currently: competitor_watcher, weekly_content, campaign_builder,
performance_digest, trend_spotter, email_sequence_builder, ad_variations,
seo_scanner, brand_voice_guardian.

Until reconciled, marketing promises an agent the platform does not have, and
the platform surfaces an agent card marketing says is not one of the nine.

## 7. Current Technical Pointers

Read these first for the latest implementation state:

- `CONTEXTV13.md`
- `AUDIT_FIXES_2026-06-02.md`

## 8. Version Notes

This file is the new current Maya context reference. `MAYA_CONTEXT_V03.md`
and its Exa addition remain valid history; the Exa pre-fill described there
as a planned test is now shipped code.

---

## UNVERIFIED - NEEDS ROVANE CONFIRMATION

1. Roster direction: should `lib/agents/registry.ts` be updated to add a
   Reputation & Follow-up agent and fold Brand Voice Guardian into Maya's
   review layer (matching the locked marketing copy), or is the platform
   registry intentionally lagging until that agent is built?
2. Exa pre-fill measurement: the V03 plan was a flagged 50/50 test that
   graduates only on measured lift. Has the test been run, and is the feature
   currently on for all new users or still flagged?
3. AI Toolkit: keep, re-link, or retire? It is currently unreachable from the
   navigation.
4. Is the Posts area's permission gate (same team permission as Analytics)
   the intended access model, or should Posts have its own permission?
