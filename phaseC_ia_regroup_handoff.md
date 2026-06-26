# Phase C — IA Regroup Handoff

**Status:** shipped  
**Prior:** dashboard cold-open (`4164c3b`)  
**Next:** asset lifecycle surfacing

---

## Problem

571-page audit: 13 flat sidebar items under “Your workspace” + “Account” — hard to scan, no mental model of how modules relate.

---

## Shipped grouping (`app/dashboard/DashboardShell.tsx`)

| Section | Items | Order rationale |
|---------|--------|-----------------|
| **Maya** | Dashboard | Cold-open / daily brief — always first |
| **Intelligence** | Agents (+ Approvals), Analytics, Inbox | Agents + signals before you plan or publish |
| **Brand** | Foundation, Brand Kit | Context everything else runs on |
| **Campaigns** | Campaigns | Plans built on brand + agent output |
| **Content** | Content Calendar, Posts, Assets | Execute and publish from plans |
| **Services** | Services, Deliverables, Support | Human-delivered work + support |
| **Settings** | Notifications, Team, Billing, Settings | Account — always last |

- Approvals remain nested under Agents (badge + child link) — not a top-level duplicate.
- `canvasContext` for `/dashboard/agents/approvals` → **Approvals** (not generic Agents).
- `currentPageKey` extended for calendar, posts, assets, services, deliverables.

---

## Do not revert

- Seven-group structure — maps to audit spine (Maya / Campaigns / Content / Intelligence / Brand / Services / Settings).
- Maya button + session history stay above nav (unchanged).

---

## Verification

- Sidebar shows 7 section labels when expanded.
- All previous routes still resolve (no path changes).
- Pending approval badge still on Agents + nested Approvals link.
