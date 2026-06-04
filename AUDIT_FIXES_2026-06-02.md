# Audit Fixes — June 2, 2026
*Updated: June 4, 2026*

Repo: `rovaneD/agent7even-v2`
Initial audit commit: `dae9088 Fix audit security and credit issues`
Latest related fix commit: `2278e11 Match agents hero to dashboard command center`

## Summary

This document records the fixes made after the read-only security, credit-integrity, environment, routing, and build audit.

The original audit focused on auth, ownership, credit integrity, environment safety, routing, and build risk. Follow-on product testing surfaced additional issues in agent output visibility, service order tracking, self-serve Viral Hooks persistence, and the Deliverables schema. Those fixes are now documented here because they were direct continuation work from the audit/test pass.

## Critical Fixes

### Internal Agent Execution

- `app/api/agents/run/[agentId]/route.ts`
  - Now requires `INTERNAL_JOB_SECRET`.
  - Rejects requests without the matching `x-internal-secret` header.
  - Verifies the supplied `taskId` belongs to the expected profile before running.
  - Reserves credits before model execution.
  - Refunds credits if execution fails after reservation.

### Maya Ownership Issues

- `app/api/maya/task-complete/route.ts`
  - Campaign lookup and update are scoped by `user_id`.
- `app/api/maya/session/route.ts`
  - Uses authenticated session profile ID instead of trusting a body-supplied user ID.

### OAuth CSRF Binding

- `lib/oauth-state.ts`
- `app/api/analytics/ga-connect/route.ts`
- `app/api/analytics/ga-callback/route.ts`
- `app/api/analytics/meta-connect/route.ts`
- `app/api/analytics/meta-callback/route.ts`

OAuth now uses single-use nonce state records instead of raw Clerk user IDs.

## Credit Integrity Fixes

### Atomic Credit RPCs

Added SQL files:

- `06_oauth_states.sql`
- `07_deduct_credits_rpc.sql`
- `04_refund_credits_rpc.sql`

These were applied in Supabase.

### App Credit Helpers

- `lib/credits.ts`
  - `deductCredits()` now calls `deduct_credits()`.
  - `refundCredits()` now calls `refund_credits()`.

### AI Routes Updated

Routes now reserve credits before expensive model calls and refund on failure:

- `app/api/campaigns/generate/route.ts`
- `app/api/brand-kit/generate-colors/route.ts`
- `app/api/brand-kit/generate-fonts/route.ts`
- `app/api/maya/chat/route.ts`
- `lib/agents/runner.ts`

This addresses:

- Free campaign generation when deduction fails
- Brand Kit generation bypass
- Parallel Foundation generation balance races
- Stale balance overwrite risks
- Incorrect `lifetime_used` handling

## Environment Fixes

- `lib/env.ts`
  - `INTERNAL_JOB_SECRET` is now required.
- `.env.example`
  - Added required and feature-gated environment variables.
- `.gitignore`
  - Allows committing `.env.example` while keeping real `.env*` files ignored.
- Vercel
  - `INTERNAL_JOB_SECRET` was set.

## Build and Routing Fixes

- `app/layout.tsx`
  - Removed `next/font/google` usage to avoid build-time Google Fonts fetch failures.
- `app/globals.css`
- `app/dashboard/DashboardShell.tsx`
  - Replaced stale Geist font variables with system font fallback.
- `app/api/stripe/portal/route.ts`
  - Added safe `NEXT_PUBLIC_APP_URL` fallback.

## Product Copy Fixes

- `app/pricing/page.tsx`
  - Updated FAQ copy to match actual behavior: Maya chat uses 2 credits per message.

## Cleanup

- Removed root-level duplicate TSX files from the fix commit:
  - `page.tsx`
  - `FoundationPage.tsx`
- Removed temporary draft/audit files from the fix commit:
  - `05_env_validation.ts`
  - `AUDIT_2026-06-01_security_credits.md`

## Documentation Updated

- `AGENTS.md`
  - Review date updated to June 2, 2026.
- `CONTEXTV9.md`
  - Added a security, credit integrity, and build fixes section.

## Follow-On Fixes After Initial Audit

### Agent Output Visibility

Commits:

- `64d5b08 Refine agent outputs navigation`
- `9069aa8 Improve agent output review UI`
- `b503ae9 Structure campaign builder outputs`
- `91089d9 Structure all agent outputs`

Issues addressed:

- Auto-agent outputs were being saved to `agent_outputs` but had no clear UI surface.
- Command Center output counts were not enough; users needed to read the saved content.
- Some outputs rendered as raw markdown/text dumps and were difficult to digest.

Fixes:

- Added archive/detail navigation under each agent.
- Output rows can be opened from the Command Center.
- Campaign Builder output got structured rendering.
- Other agent outputs received improved structured rendering instead of only generic markdown.

### Agent-Specific Flows

Commits:

- `9f6628a Add guided email sequence flow`
- `e93049e Add guided setup flows for all agents`

Issues addressed:

- All agents had effectively the same run flow.
- Agents with different tasks were missing required context.
- Some outputs asked the user for more information instead of completing the task.

Fixes:

- Added specific guided flows for the nine agents.
- Each agent now collects context aligned to its job.
- The product rule is now that each agent flow must gather enough input to produce a final output without asking follow-up questions inside the output.

### Maya Context and Chat Cleanup

Commits:

- `7bba369 Start Maya with page context`
- `b3e11da Allow deleting Maya chat sessions`

Issues addressed:

- Maya opened as a generic shell even when triggered from a specific page.
- Past chats accumulated without a delete affordance.

Fixes:

- Maya receives page/canvas context.
- Maya sessions can be deleted by the owning user.
- Delete controls are kept visually quiet to avoid a permanent trash-icon column.

### Services and Order Tracking

Commits:

- `ef07699 Improve service order follow-up flow`
- `c660def Fix admin order visibility and support links`
- `6f77f5c Move service follow-ups into orders flow`
- `121b343 Improve service order tracking flow`
- `c521e19 Surface admin order controls`
- `8f90cd2 Fix admin order status controls`

Issues addressed:

- Service request submissions appeared to disappear.
- Users had no clear active order record.
- Admin Orders did not reliably surface submitted requests.
- Service follow-up incorrectly felt like a Support issue.
- Admin order cards lacked enough follow-up/status controls.

Fixes:

- Service requests create `orders` records.
- Service follow-up stays inside Marketing Services.
- Admin sees orders on Admin Orders.
- Order cards include trackable order numbers.
- Admin can update order status and complete work.
- Notifications/order counts were improved around the admin flow.

### Viral Hooks Self-Serve Service

Commits:

- `e65fc59 Add viral hooks service`
- `7efba6d Make viral hooks self serve`
- `30b52be Allow repeat service requests`
- `8a24adf Improve viral hooks self serve flow`
- `653ffa6 Persist viral hooks generated output`
- `24de64b Save self serve PDFs to deliverables`
- `67dbc88 Handle missing viral hooks output`
- `2de86da Save viral hooks deliverables on generation`
- `64d2562 Persist viral hooks output on orders`
- `9687763 Harden viral hooks deliverable saving`
- `995eab7 Allow deleting viral hooks service orders`

Issues addressed:

- Viral Hooks initially behaved like a normal service request even though it is free/self-serve.
- Generated output could be lost if the user navigated away.
- Some delivered rows had no attached generated output.
- Users needed to request the service multiple times.
- Users needed to delete old Viral Hooks cards from Services history without deleting permanent deliverables.

Fixes:

- Added Viral Hooks as a free self-serve service.
- Added dedicated generator UI.
- Stored generated output in `orders.brief` using `VIRAL_HOOKS_OUTPUT_MARKER`.
- Added fallback reads from support message/ticket body.
- Added `Needs regenerate` state for broken legacy rows.
- Added PDF generation via `lib/pdf/textPdf.ts`.
- Saves generated PDFs to Deliverables.
- Allows deleting only `viral_hooks` orders from Services.
- Managed service orders, especially those in review, remain protected from user deletion.

### Deliverables Schema Realignment

Commits:

- `2beb02a Align deliverables with project schema`
- `0c2b963 Handle project phase constraint for deliverables`
- `65dca71 Use allowed project phases for deliverables`

Issues addressed:

- App code was using old Deliverables columns:
  - `user_id`
  - `project_name`
  - `file_name`
  - `file_path`
  - `notes`
  - `uploaded_by_role`
- Live Supabase schema uses project-backed columns:
  - `project_id`
  - `title`
  - `description`
  - `file_url`
  - `file_type`
  - `file_size`
  - `uploaded_by`
- Viral Hooks PDFs were generated but not visible in Deliverables.
- Deliverables inserts failed with schema-cache errors.
- Project creation failed until the live `projects_phase_check` values were confirmed.

Fixes:

- Added `lib/deliverables/projectDeliverables.ts`.
- Deliverables now query by `projects.user_id`.
- Upload/download/delete authorization now checks owning project.
- User Deliverables page can show and delete saved PDFs/files.
- Client/admin upload routes now write to the live schema.
- Viral Hooks saves to a `Viral Hooks` project.
- Confirmed accepted project phase value via controlled Supabase probe.
- Project creation now uses allowed phases:
  - `discovery`
  - `strategy`
  - `design`
  - `development`
  - `launch`
  - `completed`

### Content Calendar and Output Readability

Commits:

- `fd630cd Build campaign content calendar`
- `b503ae9 Structure campaign builder outputs`
- `91089d9 Structure all agent outputs`

Issues addressed:

- Campaign/calendar content was too close to a raw text dump.
- Content Calendar needed a more usable page-level canvas.

Fixes:

- Built a structured Content Calendar page.
- Added Maya context button for calendar work.
- Improved campaign output structure.

## Follow-On Documentation Added

- `CONTEXTV11.md`
  - Current design-system branch product/technical handoff.
- `MAYA_CONTEXT_V02.md`
  - Current versioned Maya product context and visual-system rules.
- `AUDIT_FIXES_2026-06-02.md`
  - This file now includes the follow-on fixes above.
- `AGENTS.md`
  - Points future sessions to `CONTEXTV11.md` / `MAYA_CONTEXT_V02.md`.

## Design-System and Preview Deployment Follow-On

Commits:

- `902d218 Introduce global color tokens`
- `b24e6f1 Defer Resend client initialization`
- `8b4a273 Defer Stripe client initialization`
- `4338ed2 Warn on missing preview env vars`
- `7c5b453 Polish dashboard command center UI`
- `9f6cde0 Use blue for primary CTAs`
- `5db58f7 Polish agents command center UI`
- `5529158 Polish campaign calendar services brand kit UI`
- `96fb0c8 Polish remaining dashboard utility pages`
- `8a77250 Normalize dashboard page alignment`
- `4d6445c Normalize dashboard card treatments`
- `2278e11 Match agents hero to dashboard command center`

Issues addressed:

- UI colors were spread across CSS variables, arbitrary Tailwind hex values,
  inline styles, and page-specific choices.
- Preview builds failed when Resend or Stripe keys were absent because clients
  were initialized during module evaluation.
- Preview runtime returned 500 errors when Clerk variables were configured only
  for Production.
- Dashboard pages used inconsistent alignment, card borders, radius, and
  shadows.
- The Dashboard and Agents pages lacked a clear, useful command-center
  hierarchy.

Fixes:

- Added global brand, semantic, surface, border, and text tokens.
- Updated the dashboard shell and Maya panel to use the token system.
- Deferred Stripe and Resend initialization.
- Production environment validation remains fail-fast; preview/development
  warn so branch deployments can boot and expose missing configuration.
- Reworked dashboard pages into a centered constrained canvas with left-aligned
  content.
- Standardized normal dashboard cards to white surfaces, `rounded-2xl`,
  `border-gray-100`, and no default shadow.
- Preserved matching soft-shadow hero treatments for the Dashboard Command
  Center and Agents Command Center.

## Pre-Merge Route and Campaign Follow-On

Issues addressed:

- `/onboarding` was intentionally deleted when Foundation became the canonical
  setup flow, but sign-up and three Agent pages still redirected to the missing
  route.
- Pricing plan selection needed to survive the new Foundation redirect so a
  newly signed-up user could continue to checkout after Foundation generation.
- The Campaigns page explicitly selected the `mode` field through PostgREST,
  which caused PostgreSQL to interpret `mode` as an ordered-set aggregate and
  return `WITHIN GROUP is required for ordered-set aggregate mode`.

Fixes:

- Replaced stale `/onboarding` redirects with `/foundation`.
- Passed the optional pricing plan through sign-up, Foundation, and
  `/checkout-now`.
- Changed the Campaigns list query to `select('*')`, which returns the campaign
  mode when present without invoking aggregate parsing.
- Made Campaigns list display metadata tolerant of legacy rows that do not have
  `mode` or `segment`.

## Verification

Passed:

```bash
./node_modules/.bin/tsc --noEmit --incremental false --pretty false
npm run build
```

Build passed with Next.js 16.2.6 / Turbopack.

Follow-on verification after later fixes repeatedly passed:

```bash
./node_modules/.bin/tsc --noEmit
npm run build
```

Build may require sandbox escalation because Turbopack opens worker ports.

## Foundation Completion Loop and Campaigns Live-Schema Compatibility

Issues addressed:

- New users could reach Foundation Step 5 before checkout with no credit
  balance. Foundation document generation used the normal credit-charging agent
  runner, returned `INSUFFICIENT_CREDITS`, and left the user in a loop.
- The Foundation client did not surface generation failures and could navigate
  away after a partial result.
- The live `campaigns` table stores structured campaign output in `plan` and
  does not contain newer top-level fields such as `segment`, `week_plan`, or
  `do_this_today`. Calendar and related consumers queried those missing columns.

Fixes:

- Added an explicit platform-funded runner mode and used it for pre-checkout
  Foundation generation while retaining task, output, token, and cost tracking.
- Foundation generation now returns a failure status when any required document
  is missing, and Step 5 shows a visible retryable error instead of silently
  redirecting.
- Internal `foundation_*` tasks are filtered out of Dashboard agent counts and
  Maya daily briefs so setup generation is not exposed as user-facing agent
  activity.
- Campaign generation now writes the structured artifact to `campaigns.plan`.
- Campaigns list, detail, digest, agent context, and Content Calendar now read
  the live schema and normalize plan data for their existing UI contracts.
- Content Calendar supports both current `plan.weekPlan` output and legacy
  `plan.weeks[].tasks[]` output.

## Remaining Local Notes

The following untracked files remained local and were intentionally not included in the fix commit:

- `foundation_generate_runner_handoff.md`
- `foundation_redesign_handoff.md`
