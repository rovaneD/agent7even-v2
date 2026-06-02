# Audit Fixes — June 2, 2026

Repo: `rovaneD/agent7even-v2`
Commit: `dae9088 Fix audit security and credit issues`

## Summary

This document records the fixes made after the read-only security, credit-integrity, environment, routing, and build audit.

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

## Verification

Passed:

```bash
./node_modules/.bin/tsc --noEmit --incremental false --pretty false
npm run build
```

Build passed with Next.js 16.2.6 / Turbopack.

## Remaining Local Notes

The following untracked files remained local and were intentionally not included in the fix commit:

- `foundation_generate_runner_handoff.md`
- `foundation_redesign_handoff.md`

