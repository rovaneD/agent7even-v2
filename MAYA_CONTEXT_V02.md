# MAYA_CONTEXT_V02 - Product Context and Visual System
*Versioned snapshot: June 4, 2026*

This is the current versioned Maya product context. It supersedes
`MAYA_CONTEXT_V01.md` while preserving all prior product decisions unless
explicitly changed here.

## 1. Product Identity

Maya is the intelligence layer inside the experimental Agent7even v2 marketing
workspace. Maya is not a generic chat shell and should not require users to
repeat visible page context.

The canvas is the workspace. Maya should understand the work on the canvas and
help the user move it toward a useful outcome.

Primary workspace areas:

- Dashboard Command Center
- Agents
- Campaigns
- Content Calendar
- Services
- Brand Kit
- Foundation
- Analytics
- Deliverables
- Support

Foundation is the canonical onboarding route. Do not add redirects to the
deleted `/onboarding` page.

Foundation document generation occurs before checkout and is platform-funded.
It must not depend on a new user's credit balance. A Foundation generation
failure must remain visible on Step 5 and must not redirect the user as though
setup completed.
Internal Foundation generation tasks use `foundation_*` agent ids. They should
not appear in Maya daily brief activity or count as a user's first specialist
agent run.
- Team, Billing, Notifications, and Settings

## 2. Current Visual Direction

The product now has a global color-token foundation.

### Palette

| Role | Hex |
|---|---|
| Primary interaction | `#3B82F6` |
| Secondary / dark UI | `#2D3748` |
| Logo accent | `#F5349B` |
| Success | `#10B981` |
| Warning | `#FCA509` |
| Danger | `#EE533B` |
| App background | `#FCFCFC` |
| Nested surface | `#F8FAFC` |
| Card surface | `#FFFFFF` |
| Muted text | `#9BA1AE` |

### Visual rules

- Blue is the primary CTA, link, focus, and selected-action color.
- Pink is reserved for the logo and restrained accent moments.
- Semantic colors must remain semantic.
- Standard dashboard cards are white, `rounded-2xl`, bordered with
  `border-gray-100`, and do not use a default shadow.
- The Dashboard Command Center hero and Agents Command Center hero intentionally
  share a soft elevated shadow treatment.
- Dashboard pages use a centered constrained canvas with left-aligned content.
- Avoid page-to-page layout jumps.

## 3. Maya Context Behavior

Implemented behavior:

- Pages dispatch `maya:canvas-context`.
- Chat requests include `canvasContext`.
- Maya sessions store `canvas_context`.
- Maya chat history can be deleted from the sidebar.
- Chat delete controls remain visually quiet and hover-based.

Expected behavior:

- On Dashboard, Maya understands the operating snapshot and next best moves.
- On Agents, Maya understands selected agent, setup flow, approvals, outputs,
  and scorecard context.
- On Services, Maya understands available services, active orders, and selected
  order state.
- On Calendar, Maya understands the week/day/content context.
- Campaign artifacts are canonically stored in `campaigns.plan` for the live
  Supabase schema. Consumers must tolerate both `plan.weekPlan` and legacy
  `plan.weeks[].tasks[]` shapes.
- On Brand Kit and Foundation, Maya uses saved brand and business context.
- On Deliverables, Maya understands the permanent asset library.

## 4. Agents

There are nine agents. They must not share one generic setup form.

Product rules:

- Each agent flow collects the minimum context required for a final output.
- An output that only asks the user for missing inputs is a failed run unless a
  clarification step was explicitly intended.
- Auto-agent outputs save directly to `agent_outputs` and remain visible from
  the Command Center.
- Approval-agent outputs route to the approval queue.
- Users must be able to open and read output content, not only see output
  counts.
- Output detail pages should use agent-specific structured renderers where the
  output shape is predictable.

Surfaces:

```txt
/dashboard/agents
/dashboard/agents/[agentId]/outputs
/dashboard/agents/approvals
```

## 5. Services and Orders

Services is both a catalog and a trackable order workspace.

Managed services:

- Create `orders` records.
- Keep service follow-up inside Services, not Support.
- Surface orders to admin with status and follow-up controls.
- Remain protected from user deletion while admin-managed/in review.

Self-serve services:

- Generate output immediately.
- Do not require admin follow-up.
- Can be requested repeatedly.
- Save permanent output assets to Deliverables.

Viral Hooks remains the first free self-serve service.

## 6. Deliverables

Deliverables is the permanent asset/file library.

The live schema is project-backed:

```txt
projects.user_id -> deliverables.project_id
```

Deliverables supports:

- client uploads
- admin uploads
- signed downloads
- authorized user deletion
- project grouping
- generated Viral Hooks PDFs

Services history and Deliverables have different responsibilities:

- Services = request/generation/order history
- Deliverables = permanent saved asset library

## 7. Dashboard Command Center

The Dashboard is now an operating command center rather than a collection of
generic cards.

It surfaces:

- approvals
- open service orders
- Foundation completion
- credits
- setup progress
- next best moves
- workspace modules
- morning digest

The first Command Center hero is intentionally visually elevated. Do not apply
that hero shadow to standard cards.

## 8. Deployment and Environment Context

Preview deployments must have Preview-scoped Clerk and Supabase variables.

Provider clients should not be initialized at module evaluation time when a
missing feature key would break the entire build. Resend and Stripe access now
use deferred initialization.

Environment behavior:

- Production fails fast for missing required variables.
- Preview and development warn so branch deployments can boot and reveal
  configuration gaps.

## 9. Current Priorities

1. Complete desktop/mobile visual QA across all dashboard routes.
2. Apply the same visual-system discipline to admin pages.
3. Continue agent-specific output renderers.
4. Keep Maya context-aware on every new page and flow.
5. Keep Services and Deliverables responsibilities separate.
6. Merge `design-system/color-tokens` only after validation.

## 10. Technical Guardrails

```txt
Workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: design-system/color-tokens
```

Before every push:

```bash
git remote -v
```

Verification:

```bash
npx tsc --noEmit
git diff --check
npm run build
```

Next.js 16 uses `proxy.ts`, not `middleware.ts`.

Stripe API version must remain:

```ts
'2026-04-22.dahlia' as any
```
