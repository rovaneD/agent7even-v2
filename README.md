# Agent7even v2

Experimental v2 client portal and AI marketing workspace.

```txt
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Production app repository: rovaneD/agent7even-app
```

Do not make production-repository changes from this workspace.

## Current Branch

The active visual-system work is on:

```txt
design-system/color-tokens
```

Before every push, confirm:

```bash
git remote -v
```

The remote must show `rovaneD/agent7even-v2`.

## Read First

- `AGENTS.md`
- `CONTEXTV12.md`
- `MAYA_CONTEXT_V03.md`
- `AUDIT_FIXES_2026-06-02.md`

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
- Services is the request/generation/order-history workspace.
- Deliverables is the permanent saved asset library.
- Blue is the primary interaction color.
- Standard dashboard cards are white, `rounded-2xl`, bordered with
  `border-gray-100`, and do not use a default shadow.
- Dashboard Command Center and Agents Command Center heroes are intentional
  soft-shadow exceptions.
