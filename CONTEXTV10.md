# CONTEXTV10 — Agent Outputs, Services Flow, Viral Hooks, Deliverables, and Color-System Plan
*Snapshot: June 3, 2026*

> Superseded by `CONTEXTV11.md`. This file remains a historical snapshot of the
> product state before the design-system/color-token implementation.

## What Changed Since CONTEXTV9

Everything in CONTEXTV9 still applies. This version documents the work completed after the approval queue, pricing, billing, and audit-fix baseline.

The main product movement since V9:

- Maya became page-context-aware and chat history can be deleted.
- Agent Command Center outputs became visible and navigable instead of hidden behind counts.
- All nine agents now have specific guided setup flows instead of sharing one generic prompt form.
- Services moved from loose support-ticket behavior into a trackable order/conversation workflow.
- Viral Hooks became a free self-serve service that generates output immediately, saves PDFs to Deliverables, and can be repeated/deleted from Services history.
- Deliverables were realigned to the live Supabase project-backed schema.
- Content Calendar and agent output views were upgraded from raw text dumps into structured review surfaces.
- A future design-system/color-token branch was planned but intentionally not started.

---

## 1. Maya Page Context and Chat Session Management

### Maya starts with canvas context

**Commits:** `7bba369`, related previous V7/V8 work

**Files:**
- `app/api/maya/chat/route.ts`
- `app/api/maya/session/route.ts`
- `components/maya/MayChatPanel.tsx`
- multiple page clients dispatch `maya:canvas-context`

**Behavior:**
- When Maya is opened from a page, she receives the current page/module context.
- The product goal is that Maya does not open as a generic blank shell when the user is working inside Services, Agents, Deliverables, Brand Kit, etc.
- Canvas context is stored in `maya_sessions.canvas_context` and sent in chat requests.

**User-facing reason:**
Maya should help with the work currently in front of the user. If the user is on Agents, she should understand agent setup/output context. If the user is in Services, she should know the active service/order state.

### Delete past Maya chats

**Commit:** `b3e11da`

**Files:**
- `app/api/maya/session/route.ts`
- `app/dashboard/DashboardShell.tsx`

**Behavior:**
- Users can delete prior Maya chat sessions from the sidebar.
- Delete controls are shown on hover so the chat list does not become a permanent column of trash icons.
- Deletion is scoped to the authenticated user's session/profile.

---

## 2. Agent Command Center and Agent Output Surface

### Agent outputs became visible

**Problem found:**
- Agent runs were saving rows to `agent_outputs`, but auto-agent output had no UI surface.
- Approval agents appeared in the approval queue, but auto agents skipped that queue and their outputs were effectively invisible.
- Scorecard could show `Outputs = 2` while the user had no way to open the content.

**Fixes:**
- Agent scorecards now link to output archive/detail pages.
- Auto-agent outputs surface below the Command Center instead of only existing as database rows.
- Output rows include a one-line description and route into a level below the Agent Command Center.
- Back navigation returns users to the Command Center.

### Last Run contradiction

**Problem:**
- Scorecard showed output counts while `Last Run: Never`.
- The scorecard was reading schedule/run metadata that was not updated by completed ad-hoc runs.

**Outcome:**
- Run completion/output state was reviewed and the output navigation work became the first product fix.
- Follow-up work should continue to ensure scorecards derive last run from completed tasks/outputs when schedule metadata is absent.

### Agent output detail UI

**Commits:** `9069aa8`, `64d5b08`, `91089d9`, `b503ae9`

**File:**
- `app/dashboard/agents/[agentId]/outputs/AgentOutputDetail.tsx`

**What changed:**
- Agent outputs no longer rely only on a generic markdown dump.
- Campaign Builder output is parsed into a more structured campaign/calendar review.
- Other agent outputs gained structured sections and better visual hierarchy.
- Approval actions remain available where relevant.
- Back navigation and archive selection were retained.

**Remaining design note:**
Some agent output types may still need deeper purpose-built rendering. The generic renderer is improved, but the product direction is agent-specific review surfaces wherever output structure is predictable.

---

## 3. Guided Agent Flows for All Nine Agents

**Commits:** `9f6628a`, `e93049e`

**Problem:**
- All agents were using a generic "run agent" input flow.
- The nine agents perform different jobs and need different context.
- Users were getting outputs that asked for missing inputs instead of producing final work.

**Fix:**
The Agent Command Center now exposes agent-specific setup flows.

Examples:
- Competitor Watcher asks for watch focus, time window, competitors, source priority, decision this should inform, must-avoid notes, and additional instructions.
- Email Sequence Builder needs sequence type, lead/source, offer/product, desired outcome, warmth/pain points, and tone.
- Campaign Builder needs campaign objective, audience/segment, duration, channel mix, offer, constraints, and success criteria.
- Weekly Content, Performance Digest, Trend Spotter, Ad Variations, SEO Scanner, and Brand Voice Guardian each have their own flow needs.

**Product rule going forward:**
Agents should not all use the same form. Each agent flow must collect the minimum context needed for that agent to produce a final output without asking the user follow-up questions inside the output.

---

## 4. Services and Orders — Trackable Workflow

### Service request submission now creates trackable orders

**Commits:** `ef07699`, `c660def`, `6f77f5c`, `121b343`

**Files:**
- `app/dashboard/services/ServicesClient.tsx`
- `app/dashboard/services/page.tsx`
- `app/api/orders/create/route.ts`
- `app/api/support/reply/route.ts`
- `app/admin/orders/page.tsx`
- `app/admin/orders/AdminOrderConversation.tsx`
- `app/api/admin/orders/update-status/route.ts`
- `lib/orders/formatOrderNumber.ts`

**Problem:**
- User submitted a service request and nothing visible happened.
- User had no record of the submission.
- Admin Orders did not show the order.
- Admin had no clear notification/follow-up path.
- "Open follow-up conversation" routed to Support, which made service follow-up feel like a support problem.

**Fixes:**
- Service request creates an `orders` row.
- A linked service conversation/support transcript is created for managed service follow-up.
- User sees active service orders inside Marketing Services.
- Admin sees order cards on Admin Orders.
- Admin can open the order conversation, update status, and follow up.
- Order cards now include an order number via `formatOrderNumber()`.
- User follow-up conversation stays in Services, not Support.

### Admin order UI fixes

**Commits:** `c521e19`, `8f90cd2`

**Files:**
- `app/admin/orders/AdminOrderStatusControls.tsx`
- `app/admin/orders/page.tsx`
- `app/api/admin/orders/update-status/route.ts`

**Fixes:**
- Admin status controls were separated into a focused component.
- Admin cards expose status updates and completion controls.
- Layout/crowding issues were improved for order number, status, priority, date, follow-up, and message affordances.
- Order sidebar count/green dot logic was added for active order visibility.

**Known area to keep watching:**
Admin order rows are dense. If more actions are added, this should move toward a detail drawer or table/detail split instead of crowding the row.

---

## 5. Viral Hooks — Free Self-Serve Service

### Service added

**Commits:** `e65fc59`, `7efba6d`

**Files:**
- `app/dashboard/services/ServicesClient.tsx`
- `app/api/orders/create/route.ts`
- `app/api/orders/complete-self-serve/route.ts`
- `lib/services/viralHooks.ts`

**Product decision:**
Viral Hooks is a free self-serve service, not an admin-managed order.

**Behavior:**
- User requests Viral Hooks inside Marketing Services.
- Maya generates the hooks immediately.
- No admin handoff is required.
- The result remains accessible inside the user's Services orders.
- The output is saved as a generated asset and later moved into Deliverables as a PDF.

### Dedicated Viral Hooks UI

**Commit:** `8a24adf`

**Problem:**
- The first Viral Hooks modal looked like a normal service request textarea.
- That was the wrong mental model: this is a generator, not an order brief.

**Fix:**
- Viral Hooks got a dedicated generator modal.
- Inputs became structured:
  - topic/offer
  - audience
  - primary goal
  - best format
  - tone
  - notes
- Modal copy clarifies this is a free self-serve tool.
- The user can generate hooks without involving admin.

### Repeat requests

**Commit:** `30b52be`

**Problem:**
- Once a user submitted a service request, the service card effectively became "View Order".
- This blocked repeat usage for services that should be reusable.

**Fix:**
- Service cards now support repeat requests.
- Existing orders remain available through the Orders tab.
- Users can request/generate the same service again instead of being locked into the previous order.

### Viral Hooks output persistence

**Commits:** `653ffa6`, `64d2562`

**Problem:**
- Generated hooks could be lost if the user navigated away before marking complete.
- Some delivered rows had no generated output attached and showed empty output states.

**Fixes:**
- Generated output is stored directly in `orders.brief` using `VIRAL_HOOKS_OUTPUT_MARKER`.
- Existing fallbacks still read from support ticket body/messages.
- Services UI reads generated output from:
  1. order brief marker
  2. support messages
  3. support ticket body
- Missing-output rows show a clear `Needs regenerate` state.

### Regenerate flow

**Commit:** `67dbc88`

**Behavior:**
- Broken legacy Viral Hooks rows that were marked delivered before output was attached show:
  - `Needs regenerate`
  - explanation that the generated hooks were not saved
  - `Regenerate hooks` button
- Regeneration creates a new saved result from the original request.

### PDF generation and Deliverables save

**Commits:** `24de64b`, `2de86da`, `9687763`, `2beb02a`, `0c2b963`, `65dca71`

**Files:**
- `lib/pdf/textPdf.ts`
- `lib/services/saveViralHooksDeliverable.ts`
- `lib/deliverables/projectDeliverables.ts`
- `app/api/orders/create/route.ts`
- `app/api/orders/complete-self-serve/route.ts`
- `app/dashboard/deliverables/page.tsx`
- `app/dashboard/deliverables/DeliverablesClient.tsx`
- `app/api/deliverables/upload/route.ts`
- `app/api/deliverables/admin-upload/route.ts`
- `app/api/deliverables/download/route.ts`
- `app/api/deliverables/delete/route.ts`

**What changed:**
- `buildTextPdf()` generates a PDF file from plain text output.
- Viral Hooks PDF is saved to Supabase Storage.
- A Deliverables row is created when hooks are generated.
- Mark complete also attempts to ensure the PDF exists.
- Deliverables save errors are surfaced in the UI with the underlying Supabase error for debugging.

**Schema issue found and fixed:**
The app originally assumed an old deliverables schema:

```txt
user_id, project_name, file_name, file_path, notes, uploaded_by_role
```

The live table is project-backed:

```txt
project_id, title, description, file_url, file_type, file_size, uploaded_by
```

The app was realigned to the live schema:

- Deliverables now query through `projects.user_id`.
- New helper `lib/deliverables/projectDeliverables.ts` finds/creates the user project.
- Upload/download/delete authorize by owning project instead of trusting a file path prefix.
- User Deliverables page shows and can delete saved files.
- Admin/client upload routes now insert the correct columns.

**Projects phase constraint issue:**
- Supabase `projects.phase` has a check constraint.
- Initial code guessed invalid values (`active`, etc.).
- A controlled Supabase probe showed `discovery` is accepted.
- Helper now creates self-serve projects with allowed phase values:
  - `discovery`
  - `strategy`
  - `design`
  - `development`
  - `launch`
  - `completed`

### Delete Viral Hooks cards from Services

**Commit:** `995eab7`

**Files:**
- `app/api/orders/delete-self-serve/route.ts`
- `app/dashboard/services/ServicesClient.tsx`

**Behavior:**
- Users can delete Viral Hooks cards from the Marketing Services orders list.
- This is only allowed for `service_type = 'viral_hooks'`.
- Managed service orders, especially those in review, cannot be deleted through this route.
- Deleting a Viral Hooks order removes it from Services and removes the self-serve support transcript.
- It does **not** delete the saved PDF from Deliverables. Deliverables is treated as the permanent asset library.

---

## 6. Content Calendar

**Commit:** `fd630cd`

**Files:**
- `app/dashboard/calendar/page.tsx`
- `app/dashboard/calendar/CalendarMayaButton.tsx`

**Problem:**
- Campaign Builder outputs contained useful campaign calendar content, but the calendar section itself needed a better canvas.

**Fix:**
- Content Calendar page now has a structured week/day/content layout.
- Calendar items can trigger Maya with relevant context via `CalendarMayaButton`.
- The page dispatches canvas context so Maya understands calendar state.

**Product direction:**
Calendar output should continue moving away from raw markdown toward structured days, channels, content types, status, and actions.

---

## 7. Design-System / Color Token Plan

This was planned on June 3, 2026 but intentionally not implemented yet.

### Reason

Vercel/usability checks are flagging UI issues and the app still uses a mix of:

- CSS variables in `app/globals.css`
- Tailwind arbitrary classes like `bg-[#2D3748]`
- inline style hex values
- page-specific color decisions

Changing colors globally is not currently one clean task because not all components use shared tokens.

### Planned branch

Use a separate branch:

```bash
design-system/color-tokens
```

### Final palette agreed

| Role | Hex |
|---|---|
| Primary / interactive | `#3B82F6` |
| Secondary / dark UI | `#2D3748` |
| Logo accent | `#F5349B` |
| Success / positive | `#10B981` |
| Warning / medium progress | `#FCA509` |
| Danger / low/error | `#EE533B` |
| Neutral surface | `#F8FAFC` |
| Menu muted text | `#9BA1AE` |
| App background | `#FCFCFC` |
| Card/surface | `#FFFFFF` |

### Implementation rule

Do not blindly replace every hex. Convert by UI role:

- Shell/sidebar/nav first
- Dashboard cards/buttons/forms
- Services/orders/deliverables
- Agents/output UI
- Admin
- Older inline-style components last

Keep semantic colors separate from brand colors. Blue remains action/focus/link color. Pink is logo/accent only and should be used sparingly.

---

## 8. Updated Work Queue

| # | Item | Status |
|---|---|---|
| 1 | Approval queue UI | DONE (V9) |
| 2 | Maya page context | DONE |
| 3 | Maya chat deletion | DONE |
| 4 | Agent output navigation/detail pages | DONE |
| 5 | Guided flows for all nine agents | DONE |
| 6 | Services order tracking and admin follow-up | DONE |
| 7 | Admin order controls | DONE |
| 8 | Viral Hooks service | DONE |
| 9 | Viral Hooks self-serve generation | DONE |
| 10 | Viral Hooks PDF save to Deliverables | DONE |
| 11 | Deliverables schema realignment | DONE |
| 12 | Delete Viral Hooks cards from Services | DONE |
| 13 | Content Calendar page structure | DONE |
| 14 | Color-token branch | PLANNED — not started |
| 15 | Full visual QA against Vercel usability flags | NEXT |
| 16 | Credit top-up | OPEN |
| 17 | Orchestration progress UI | OPEN |
| 18 | Profile dedup | OPEN / data task |
| 19 | Production merge | HOLD until validation |

---

## 9. Verification Completed Across This Work

Repeatedly passed after major commits:

```bash
./node_modules/.bin/tsc --noEmit
npm run build
```

Build uses Next.js 16.2.6 / Turbopack and may require sandbox escalation because Turbopack opens worker ports.

---

## 10. Important Operational Notes

- This repo is `rovaneD/agent7even-v2`.
- Always run `git remote -v` before push and confirm the remote is `https://github.com/rovaneD/agent7even-v2.git`.
- Do not touch production repo `rovaneD/agent7even-app` from this folder.
- Vercel auto-deploys v2 from GitHub on push to `main`.
- The design-system/color-token work should happen in its own branch, not on `main`, because it is broad and should be easy to review/revert.
