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

---

## Backlog (registry remaining)

| Screen | Next |
|--------|------|
| Foundation Hub | Exa pre-fill success messaging |
| Brand Kit | Premium model gating copy (ProAgent) |
| Calendar | Lifecycle deep links from events |
| Assets | Link to Posts compose |
| Agent outputs archive | Lifecycle stage labels |

---

## Verification

```bash
npx tsc --noEmit
# Dashboard: stat hints + section subtitles visible
# Campaigns list: cards show today/strategy preview
# Approvals: draft banner when Zernio drafts exist
# Services orders: status hint under each card
```
