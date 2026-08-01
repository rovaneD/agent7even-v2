# Agent7even v2

Live client portal and AI marketing workspace for www.agent7even.ai.

```txt
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Production URL: https://www.agent7even.ai
Legacy portal repository (frozen): rovaneD/agent7even-app
Branch: main
Latest handoff: CONTEXTV30.md (July 24, 2026)
```

Do not make legacy-repository changes from this workspace.

Before every push, confirm:

```bash
git remote -v
```

The remote must show `rovaneD/agent7even-v2`.

## Read First

- `AGENTS.md` — product rules, deployment guardrails, implementation SSOT
- `CONTEXTV30.md` — latest handoff (onboarding v2, trial billing, agents UX)
- `CONTEXTV29.md` — prior handoff (audit phases, homepage hero)
- `MAYA_CONTEXT_V10.md` — Maya product context
- `SESSION_2026-07-24.md` — recent commit ledger

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npx tsc --noEmit
git diff --check
npm run build
```

This project uses Next.js `16.2.6` with Turbopack. Read the relevant local
Next.js guides in `node_modules/next/dist/docs/` before changing framework APIs
or conventions.

## Environment

Use `.env.example` as the variable reference. Preview deployments require
Preview-scoped Clerk and Supabase variables; setting variables only for
Production is not enough.

Production runtime fails fast for missing required variables. Preview and
development runtime warn so branch deployments can boot and expose
configuration gaps.

## Product Notes

- Maya is page-context-aware and should assist with the work visible on the
  current canvas.
- Foundation onboarding is website-first: URL synthesis → confirm → generate.
- Trial is 7-day tier-neutral; card required; charge on day 8 (`lib/billing/trialPolicy.ts`).
- Services is the request/generation/order-history workspace.
- Deliverables is the permanent saved asset library.
- Blue is the primary interaction color.
- Standard dashboard cards are white, `rounded-2xl`, bordered with
  `border-gray-100`, and do not use a default shadow.
- Dashboard Command Center and Agents Command Center heroes are intentional
  soft-shadow exceptions.
