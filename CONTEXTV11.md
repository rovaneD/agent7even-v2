# CONTEXTV11 - Design System, Preview Deployment, and Dashboard UI Normalization
*Snapshot: June 3, 2026*

This is the current technical and product handoff for the experimental v2 app.
Everything in `CONTEXTV10.md` still applies unless this document explicitly
changes it.

## Repository and Branch

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Current branch: design-system/color-tokens
Production repository: rovaneD/agent7even-app - do not touch from this folder
```

Before every push:

```bash
git remote -v
```

The remote must show `rovaneD/agent7even-v2`.

---

## What Changed Since CONTEXTV10

The design-system/color-token work is no longer only planned. It has been
implemented on its own branch and followed by a broad dashboard UI pass.

Main changes:

- Introduced global brand, semantic, surface, border, and text color tokens.
- Updated the dashboard shell and Maya panel to use the new visual language.
- Changed primary CTAs from dark slate to blue.
- Rebuilt the Dashboard Command Center into a more useful operating snapshot.
- Polished Agents, Campaigns, Content Calendar, Services, Brand Kit, and the
  remaining dashboard utility pages.
- Normalized dashboard page alignment so content does not jump between centered
  and left-aligned layouts.
- Normalized standard card borders, radius, surfaces, and shadows to match the
  restrained Admin Revenue card treatment.
- Preserved the soft-shadow hero treatment for the Dashboard Command Center and
  the Agents Command Center hero.
- Fixed preview deployment failures caused by missing provider keys during
  module evaluation.
- Changed environment validation so preview deployments warn about missing
  variables while production continues to fail fast.

---

## 1. Global Color Token System

**Commit:** `902d218 Introduce global color tokens`

**Primary files:**

- `app/globals.css`
- `app/dashboard/DashboardShell.tsx`
- `components/maya/MayChatPanel.tsx`

### Current palette

| Role | Token | Hex |
|---|---|---|
| Primary action / focus / links | `--color-brand-primary` | `#3B82F6` |
| Secondary / dark UI | `--color-brand-secondary` | `#2D3748` |
| Logo accent | `--color-brand-accent` | `#F5349B` |
| Success / positive | `--color-status-success` | `#10B981` |
| Warning / medium progress | `--color-status-warning` | `#FCA509` |
| Danger / low/error | `--color-status-danger` | `#EE533B` |
| App background | `--color-bg` | `#FCFCFC` |
| Card surface | `--color-surface` | `#FFFFFF` |
| Nested surface | `--color-surface-2` | `#F8FAFC` |
| Border | `--color-border` | `#E2E8F0` |
| Strong border | `--color-border-strong` | `#CBD5E1` |
| Primary text | `--color-text-primary` | `#2D3748` |
| Secondary text | `--color-text-secondary` | `#64748B` |
| Muted/menu text | `--color-text-muted` / `--color-menu-muted` | `#9BA1AE` |

### Product rules

- Blue is the main interactive color for primary CTAs, links, focus, and
  selected actions.
- Dark slate remains useful for strong structural UI, but it is no longer the
  default primary CTA color.
- Pink is a logo/accent color, not a general interface color.
- Success, warning, and danger colors remain semantic.
- Colors should be changed by role through tokens, not by broad hex search and
  replace.

### Shared component utilities

`app/globals.css` now contains shared button and card primitives:

- `.btn-primary`
- `.btn-interactive`
- `.btn-secondary`
- `.btn-destructive`
- `.card`
- `.card-hover`

The card utilities now use white surfaces, `#F3F4F6` borders, 16px radius, and
no default shadow.

---

## 2. Preview Deployment and Environment Hardening

**Commits:**

- `b24e6f1 Defer Resend client initialization`
- `8b4a273 Defer Stripe client initialization`
- `4338ed2 Warn on missing preview env vars`

### Build failures found

Vercel preview builds initially failed during page-data collection because
provider clients were initialized at module evaluation time:

```txt
Missing API key. Pass it to the constructor new Resend(...)
Neither apiKey nor config.authenticator provided
```

The preview deployment then returned HTTP 500 because Clerk variables were not
available in the Preview environment:

```txt
@clerk/nextjs: Missing publishableKey
@clerk/nextjs: Missing secretKey
```

### Fixes

- Added lazy provider access through `lib/resend.ts` and `lib/stripe.ts`.
- Updated provider-using routes so missing feature keys do not break module
  evaluation during build.
- Updated `lib/env.ts`:
  - Production runtime still fails fast when required variables are missing.
  - Preview and development runtimes warn so branch deployments can boot and
    expose the missing configuration clearly.
  - Feature-gated environment groups continue to warn when unavailable.

### Vercel preview requirement

Preview deployments need the required Clerk, Supabase, app URL, and any
features being tested configured for the **Preview** environment, not only
Production.

At minimum for authenticated preview UI:

```txt
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

---

## 3. Dashboard Command Center

**Commits:**

- `7c5b453 Polish dashboard command center UI`
- `9f6cde0 Use blue for primary CTAs`

**Files:**

- `app/dashboard/page.tsx`
- `components/dashboard/GettingStarted.tsx`
- `components/dashboard/MorningDigest.tsx`

### What changed

- Replaced the simplistic dashboard with an operating command center.
- Added a clear primary action and service request action.
- Added real operating snapshot metrics:
  - approvals
  - open orders
  - Foundation completion
  - credits
- Reworked setup progress, next best moves, workspace modules, and morning
  digest into a more useful hierarchy.
- Primary CTAs use blue.

### Visual exception

The first Dashboard Command Center hero intentionally keeps a soft elevated
shadow:

```txt
rounded-[24px]
border border-border
bg-surface
shadow-[0_20px_60px_rgba(45,55,72,0.08)]
```

This is an intentional hero treatment, not the standard card style.

---

## 4. Agents Command Center

**Commits:**

- `5db58f7 Polish agents command center UI`
- `2278e11 Match agents hero to dashboard command center`

**File:**

- `app/dashboard/agents/AgentCommandCenter.tsx`

### What changed

- Improved information hierarchy for running agents, queued work, approvals,
  outputs, guided setup, activity, scorecard, and recent outputs.
- Kept the nine agent-specific guided flows introduced before V10.
- Standardized non-hero cards with the shared restrained card treatment.
- Matched the Agents hero to the Dashboard Command Center soft-shadow hero.

### Hero rule

The Dashboard Command Center and Agents Command Center hero sections are the two
intentional elevated hero cards. Standard cards should not copy that shadow.

---

## 5. Dashboard Page UI Pass

**Commits:**

- `5529158 Polish campaign calendar services brand kit UI`
- `96fb0c8 Polish remaining dashboard utility pages`
- `8a77250 Normalize dashboard page alignment`
- `4d6445c Normalize dashboard card treatments`

### Primary pages updated

- Campaigns
- Content Calendar
- Services
- Brand Kit
- AI Toolkit
- Analytics
- Billing
- Deliverables
- Foundation
- Notifications
- Settings
- Support
- Team
- Brand Kit flow/document views
- Services inquiry

### Alignment rule

Dashboard pages should use the same centered constrained canvas:

```txt
mx-auto max-w-[1240px] px-8 py-8
```

The goal is not centered text. It is a centered page container with internally
left-aligned content so navigation between pages does not feel like the canvas
jumps left and right.

### Standard card rule

Standard dashboard cards should match the restrained Admin Revenue treatment:

```txt
rounded-2xl
border border-gray-100
bg-white
no default shadow
```

Clickable cards may change border or surface on hover, but should not gain a
large default shadow.

Exceptions:

- Dashboard Command Center hero
- Agents Command Center hero
- Modals and overlays
- Small interactive control shadows where needed for selected-state clarity

---

## 6. Current Visual QA Status

Completed:

- Global token foundation
- Dashboard shell and Maya panel color pass
- Blue primary CTAs
- Dashboard Command Center redesign
- Agents Command Center redesign
- Campaigns, Calendar, Services, Brand Kit polish
- Utility page polish
- Dashboard page alignment normalization
- Standard card normalization

Still recommended:

- Visual QA every dashboard route on desktop and mobile.
- Check admin pages against the same token system.
- Continue replacing legacy arbitrary hex colors by semantic role.
- Audit typography scale and dense rows after the color/card pass.
- Confirm hover, focus, disabled, loading, empty, and error states on every
  updated page.

---

## 7. Verification

The branch repeatedly passed:

```bash
npx tsc --noEmit
git diff --check
npm run build
```

Latest build passed with Next.js `16.2.6` and Turbopack.

---

## 8. Current Work Queue

| # | Item | Status |
|---|---|---|
| 1 | Global color tokens | DONE |
| 2 | Preview provider initialization fixes | DONE |
| 3 | Preview environment warning behavior | DONE |
| 4 | Dashboard Command Center polish | DONE |
| 5 | Agents Command Center polish | DONE |
| 6 | Campaigns / Calendar / Services / Brand Kit polish | DONE |
| 7 | Remaining dashboard utility page polish | DONE |
| 8 | Dashboard alignment normalization | DONE |
| 9 | Standard card normalization | DONE |
| 10 | Full desktop/mobile visual QA | NEXT |
| 11 | Admin visual-system pass | NEXT |
| 12 | Typography and dense-row QA | NEXT |
| 13 | Continue agent-specific output renderers | OPEN |
| 14 | Credit top-up | OPEN |
| 15 | Orchestration progress UI | OPEN |
| 16 | Profile dedup | OPEN / data task |
| 17 | Merge design-system branch to main | HOLD until validation |

