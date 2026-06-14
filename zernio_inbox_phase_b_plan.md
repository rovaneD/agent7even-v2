# Zernio Inbox — Phase B Plan (Messages & Reply UI)

*Phase A (live inbox analytics on the Analytics tab) ships first. This doc is the
build plan for Phase B — a white-label inbox workspace inside Agent7even. Do NOT
start Phase B until Phase A is verified on a connected test account.*

**Goal:** Let users read and reply to DMs and post comments from Agent7even —
without sending them to Zernio's dashboard — with optional Maya draft-reply assist.

---

## READ BEFORE WRITING CODE

1. `git remote -v` → confirm `rovaneD/agent7even-v2`.
2. Source of truth: `MAYA_CONTEXT_V07.md` + `CONTEXTV16.md`.
3. Read the real files, not this plan's summary:
   - `lib/social/publisher.ts` — single Zernio access point; extend here only.
   - `lib/social/zernioInboxParse.ts` — Phase A mapper (volume + comments + conversations → UI shape).
   - `app/api/analytics/zernio/inbox/route.ts` — Phase A analytics route pattern.
   - `app/dashboard/analytics/AnalyticsClient.tsx` — Inbox analytics tab (Phase A).
   - `analytics_v2_spec.md` — Phase 5 inbox analytics spec; Phase B extends beyond analytics.
4. **Gating:** Per `CONTEXTV16.md`, real client social accounts stay gated until
   Zernio Q4 data-handling/DPA is cleared. Build and test on FREE tier / owner
   test accounts only until then.
5. If the real Zernio API shapes contradict this plan, the API wins. Report and stop.

---

## What Phase A delivers (prerequisite)

| Layer | Status after Phase A |
|---|---|
| `GET /api/analytics/zernio/inbox` | Live — volume + comments + conversation analytics merged |
| Analytics → Inbox tab | Real counts (comments, DMs, response rate, platform table, trend) |
| Maya context | Live inbox metrics when `dataState === 'live'` |
| Reply UI | **Not built** — footer still says "coming soon" |

Phase B replaces the "coming soon" footer with a link into the full inbox workspace.

---

## Zernio APIs verified (test account `@rovanedurso`)

| Endpoint | Purpose | Phase |
|---|---|---|
| `GET /analytics/inbox/volume` | Aggregate received/sent/read + timeseries | A ✓ |
| `GET /analytics/inbox/conversations` | Per-conversation stats (unread derivation) | A ✓ |
| `GET /inbox/comments` | Posts with comment threads (list) | A ✓ (count) · B (UI) |
| `GET /inbox/conversations` | DM conversation list | B |
| `GET /inbox/conversations/{id}/messages` | Thread messages | B |
| `POST /inbox/conversations/{id}/messages` | Send DM reply | B |

**Shape note:** Volume analytics uses `received` / `sent` / `read`, not a native
comments-vs-DMs split. Phase A composes UI metrics from volume + comments list +
conversation analytics. Phase B surfaces the underlying objects directly.

---

## Phase B — build slices

### B1. Publisher extensions (XS)

Add to `lib/social/publisher.ts` (fail soft, never throw):

```typescript
listInboxConversations(params)      // GET /inbox/conversations
getInboxThread(params)              // GET /inbox/conversations/{id}/messages
sendInboxReply(params)              // POST /inbox/conversations/{id}/messages
listInboxComments(params)           // already exists from Phase A — reuse
```

All calls scoped with `profileId` from the authenticated user's profile row.

### B2. Proxy API routes (S)

Mirror the audited pattern from `/api/analytics/zernio/*` and `/api/integrations/zernio/*`:

| Route | Method | Zernio target |
|---|---|---|
| `/api/inbox/conversations` | GET | `/inbox/conversations` |
| `/api/inbox/conversations/[id]/messages` | GET | thread fetch |
| `/api/inbox/conversations/[id]/messages` | POST | send reply |
| `/api/inbox/comments` | GET | `/inbox/comments` (paginated) |

Requirements:
- Clerk auth on every route.
- Resolve `zernio_profile_id` / `zernio_profile_ids` from Supabase — never accept
  `profileId` from the client body for tenancy.
- Return normalized JSON envelopes the UI can consume without Zernio-specific nesting.
- Rate-limit guard stays in `publisher.ts` (shared API key).

### B3. Inbox workspace UI (M)

**Route:** `/dashboard/inbox` (or a "Messages" item in the sidebar — pick one in
implementation; default recommendation: `/dashboard/inbox` to mirror Analytics tab naming).

**Layout:** Two-pane master-detail (responsive — stack on mobile):

```
┌─────────────────────────────────────────────┐
│  Inbox                          [filters]   │
├──────────────────┬──────────────────────────┤
│  Conversations   │  Thread / comment detail │
│  + Comments tab  │  Reply composer          │
│  (list)          │  Send button             │
└──────────────────┴──────────────────────────┘
```

**Tabs within inbox:**
- **DMs** — conversation list from `/api/inbox/conversations`
- **Comments** — post-comment list from `/api/inbox/comments` (expand to thread when Zernio exposes per-comment replies)

**Design tokens:** Match existing dashboard — white cards, `rounded-2xl`,
`border-gray-100`, primary blue `#3B82F6`. No pink on functional surfaces.

**Empty states:**
- No connected accounts → connect CTA (same pattern as Analytics empty state).
- Connected but no messages → calm empty illustration + copy.

**Analytics tab link:** Replace "coming soon" footer in `InboxAnalyticsContent` with
"Open inbox →" linking to `/dashboard/inbox`.

### B4. Maya draft-reply (S, optional in first B ship)

**Not required for Phase B acceptance** — can land as B4.1 after core send works.

Flow:
1. User selects a conversation or comment thread.
2. "Draft reply with Maya" button → lightweight agent skill or inline prompt using
   Foundation voice + thread context.
3. Inserts draft into composer; user edits and sends.

Constraints:
- Runs through `lib/agents/runner.ts` — credits tracked.
- Never auto-send without explicit user click.
- Maya context updated with inbox affordance rules (no vendor names).

### B5. Sidebar + nav (XS)

Add inbox entry to `app/dashboard/DashboardShell.tsx` — position after Posts or
Analytics per product preference. Gate visibility: paid plan + at least one connected
platform (same gate as posting).

---

## Data mapping reference

### Conversation list item (UI)

| Zernio field | UI use |
|---|---|
| `conversationId` | Route key |
| `platform` | Platform avatar |
| `participantUsername` / `participantName` | List title (fallback: "Instagram user") |
| `participantPicture` | Avatar |
| `lastMessage` | Preview snippet |
| `lastMessageAt` | Relative time |
| `received - read` | Unread badge |

### Message thread item

Map inbound vs outbound for bubble alignment. Show send failures from `failed` counts
if Zernio exposes per-message status on fetch.

### Comment item

| Zernio field | UI use |
|---|---|
| `content` | Post caption preview |
| `permalink` | External link (opens platform) |
| `picture` | Thumbnail |
| `commentCount` | Badge |
| `createdTime` | Sort key |

---

## Acceptance checks (Phase B)

- [ ] `/dashboard/inbox` loads conversation list for a connected test account.
- [ ] Selecting a conversation loads thread messages without full page reload.
- [ ] User can send a DM reply; message appears in thread after send.
- [ ] Comments tab lists post comments from connected accounts.
- [ ] All Zernio calls go through `lib/social/publisher.ts` — no scattered fetch.
- [ ] Tenancy: every route derives `profileId` from Clerk → Supabase, never request body.
- [ ] Analytics Inbox tab shows live metrics (Phase A) and links to inbox workspace.
- [ ] Maya context describes inbox workspace affordances without naming Zernio.
- [ ] `npx tsc --noEmit` + `npm run build` pass.
- [ ] Manual test on `@rovanedurso` test account only until DPA gate clears.

---

## Explicitly OUT of scope for Phase B

- Unified notification push / real-time websocket inbox (poll or SWR refresh is fine).
- Bulk reply, auto-reply rules, or AI auto-send.
- Facebook Messenger / TikTok DMs until Zernio connection supports them for the tenant.
- Ads inbox or ad-comment moderation (separate surface).
- Replacing Zernio for publishing — inbox only.

---

## Suggested build order (one session per slice)

1. **B1 + B2** — publisher methods + proxy routes; verify with curl/tsx against test account.
2. **B3** — inbox page shell + conversation list + thread view + send.
3. **B5** — sidebar nav + Analytics footer link.
4. **B4** — Maya draft-reply (optional follow-on).

---

## Docs to update when Phase B ships

- `CONTEXTV16.md` (or successor): new routes, `/dashboard/inbox`, Maya inbox affordances.
- `MAYA_CONTEXT_V07.md` (or successor): Inbox workspace section — what users can do in-app.
- `analytics_v2_spec.md`: Mark Phase 5 inbox analytics done; add Phase B workspace note.

---

*Plan filed: June 10, 2026 — Phase A ships in the same branch/session; Phase B is next build.*
