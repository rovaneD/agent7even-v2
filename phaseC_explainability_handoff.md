# Phase C — Explainability Pass Handoff

**Status:** shipped (first slice) — June 10, 2026  
**Prior:** per-screen registry · situational grounding Layer 1 · credits clarity  
**Registry:** `per_screen_registry.md`

---

## Problem

571-page audit theme: product is more sophisticated than the UX communicates. Users couldn't see what outputs look like, what approvals lead to, or what service order statuses mean.

---

## Shipped (this slice)

### Dashboard — Maya brief (`MorningDigest.tsx`)

- Stat pill hints (approvals / campaigns / media credits)
- Section subtitles: Needs review · Since yesterday · Today's plan

### Campaigns

- **List** (`app/dashboard/campaigns/page.tsx`) — artifact preview line on each card (today's task, strategy snippet, or plan summary)
- **Detail** (`CampaignDetail.tsx`) — Do-this-today explainer + unlimited Maya note

### Approvals (`ApprovalsClient.tsx` + page)

- Header copy clarifies approve → Posts draft flow
- Green banner when draft posts exist on Posts with deep link `?status=draft`

### Posts (`PostsClient.tsx`)

- Approval bridge banner clarifies review-first vs post-approval listing

### Services (`ServicesClient.tsx`)

- Orders tab intro (human-delivered, not credit-metered)
- Plain-language `STATUS_HINT` under each order card

### Foundation Hub (`FoundationHub.tsx`)

- Website/file ingest success confirmation after saving Knowledge fields
- URL ingest explainer (public page read → confirm before save)

### Brand Kit (`BrandKitView.tsx`)

- ProAgent premium model callout for non-ProAgent plans
- Media credit note on AI palette/font generation

### Calendar (`app/dashboard/calendar/page.tsx`)

- Compact content lifecycle bar
- Per-entry execution hint (Posts / agents / campaign)

### Assets (`AssetsClient.tsx`, `AssetPreviewModal.tsx`)

- Header link to Posts; modal adds schedule path alongside post workflow

### Agent outputs archive (`outputs/page.tsx`, `AgentOutputDetail.tsx`)

- Lifecycle labels (In review / Approved / Rejected) with hints and deep links to Approvals or Posts drafts

### Deliverables (`DeliverablesClient.tsx`)

- Upload → agent context callout (Foundation, Brand Kit, Agents links)
- Post-upload success note for Maya + brand context

### Support (`SupportClient.tsx`, `page.tsx`)

- Parses `Order ID` from ticket body; shows service-order badge and deep link to Services

### Inbox (`InboxClient.tsx`, inbox API routes)

- Post comment threads (read + reply in-app via Zernio)
- Maya draft-reply for DMs and comments (composer insert, user sends)

---

## Backlog (registry remaining)

_None — Phase C explainability pass complete for logged-in screens._

---

## Verification

```bash
npx tsc --noEmit
# Dashboard: stat hints + section subtitles visible
# Campaigns list: cards show today/strategy preview
# Approvals: draft banner when Zernio drafts exist
# Services orders: status hint under each card
```
