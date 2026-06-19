# CONTEXTV18 — Launch prep, auth/billing hardening, lab5 homepage refresh
*Snapshot: June 18, 2026 — supersedes `CONTEXTV17.md`*

This document supersedes `CONTEXTV17.md`. Everything in V17 still applies
unless this file explicitly changes it.

Prior session logs: `SESSION_2026-06-14.md` (inbox + Stage 2),
`SESSION_2026-06-11.md` (Foundation safety), `SESSION_2026-06-12.md` (Content Posting merge).

---

## Repository State

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app (+ www.agent7even.ai when DNS pointed)
Branch: main
Latest commits (June 18, 2026):
  93beb2f — lab5 homepage hero, product widget cards, FAQ
  f8da5dd / 4a6b3f2 / 3f2793a — Stripe checkout hardening
  3d6a007 / 31c44d6 — auth pages aligned to lab5 marketing design
  81cbe2b — Google sign-in profile linking (redirect loop fix)
  27a03c9 — launch prep (Meta disclosure, legal .ai URLs)
June 15, 2026:
  b9c416b — Zernio cross-tenant isolation on shared master key
  29701e8 — mobile inbox thread header/loading fix
  be8fad1 — data deletion page + analytics OAuth/legal updates
  4d974da — Meta domain verification (agent7even.ai)
  5d2dc51 — PRODUCTION_GREENLIGHT.md
  85099c7 — remove hero pill badge
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What Shipped Since CONTEXTV17

### June 15 — launch prep & platform hardening

| Area | Summary |
|------|---------|
| **Zernio tenancy** | `b9c416b` — cross-tenant isolation fix when profiles share a master key |
| **Inbox mobile** | `29701e8` — thread view keeps header + loading state visible on small screens |
| **Legal / compliance** | `be8fad1` — `/data-deletion` page + API; privacy/terms/security URLs on `.ai`; analytics OAuth copy |
| **Meta** | `4d974da` — domain verification meta tag for `agent7even.ai` |
| **Launch checklist** | `PRODUCTION_GREENLIGHT.md` — master go-live checklist (Stripe live, Clerk prod, DNS, etc.) |
| **Homepage** | `85099c7` — removed hero pill badge above Meet Maya |

### June 18 — auth, billing, marketing homepage

| Area | Summary |
|------|---------|
| **Auth UX** | `3d6a007`, `31c44d6` — split layout sign-in/sign-up with lab5 marketing panel; matches homepage tokens |
| **Auth fix** | `81cbe2b` — Google sign-in profile linking stops post-OAuth redirect loop |
| **Build fix** | `3f7e1e6` — duplicate `isProductionRuntime` declaration |
| **Launch prep** | `27a03c9` — Meta connect disclosure, inbox analytics notes, legal `.ai` URL alignment |
| **Stripe checkout** | `3f2793a`, `4a6b3f2`, `f8da5dd` — accounts without plan, stale test customer IDs, invalid header chars on secret key |
| **Homepage hero** | `93beb2f` — Meet Maya typography (pink on Maya only), two-line deck in `#838B97`, body/join CTAs, blue primary + ghost secondary, Metaballs retained |
| **Dashboard showpiece** | Increased `.showpiece` bottom padding (80px desktop) before trust strip |
| **Feature / use-case cards** | Cropped mini product UI widgets via `data-mk="widget-*"` — clipped inside card (`overflow: hidden`), left/bottom inset, zoomed mockup |
| **Mockup chrome** | `public/agent7even_mark.svg` — circle mark in mockup sidebars (`mockups.js`, `agent-mockups.js`, `usecase-mockups.js`) |
| **FAQ** | Scheduling-tool answer — Maya plans, writes, runs campaigns, queues for approval; user brings visuals |
| **Meta description** | `app/page.tsx` — “posts queued” (not “content posted”) |

---

## Marketing site (lab5) — file map

Root `/` is the lab5 homepage:

| Path | Role |
|------|------|
| `app/page.tsx` | Re-exports `app/lab5/page.tsx` + metadata |
| `app/lab5/page.tsx` | Homepage JSX (hero, sections, FAQ) |
| `app/lab5/styles.css` | All `--l5-*` tokens + `.lab5` layout |
| `app/lab5/MarketingNav.tsx` | Shared nav |
| `app/lab5/SafeMetaballs.tsx` | Metaballs error boundary |
| `public/lab5/mockups.js` | Full mockups + `widget-*` card snippets |
| `public/agent7even_mark.svg` | Circle logo for mockup rails |
| `public/agent7even_logo.svg` | Full wordmark for nav |

**Hero CSS hooks:** `.hero-title`, `.hero-title-deck-line`, `.hero-body`, `.hero-link`, `.showpiece`, `.btn-hero-primary`.

**Card widgets:** `.lcard` / `.use` → `.lcard-copy` / `.use-copy` + `.card-widget` with `[data-mk="widget-…"]`. Mockup keys: `widget-campaign`, `widget-competitor`, `widget-reputation`, `widget-voice`, `widget-use-ecommerce`, `widget-use-local`, `widget-use-creators`, `widget-use-agencies`.

**Visual rules (marketing):** primary blue `#3B82F6`; pink `#F5349B` on Maya/logo moments only; white cards, no grey card fills; cropped UI peeks at card bottom.

---

## SQL migrations — unchanged from V17

| File | Purpose | Status |
|------|---------|--------|
| `18_idea_analysis_skill.sql` | Idea Analysis agent skill | **Run if not applied** |
| Prior migrations | See `CONTEXTV17.md` | Applied in prod |

---

## Open backlog (carried + updated)

1. **Zernio Q4 DPA** — real client social accounts gated until DPA cleared.
2. **Inbox B4.1** — Maya draft-reply in composer (optional).
3. **In-app comment replies** — blocked on Zernio per-comment thread API.
4. **Competitor post-level metrics (CONDITIONAL GO)** — Stage 1/3 parked.
5. **Zernio native publish → analytics** — confirm sync before trusting best-post.
6. **Engagement cron** — never ran in v2.
7. **Post media Phases A–C** — `post_media_expansion_handoff.md`.
8. **Port to agent7even-app** — separate repo; live Stripe, crons, full QA.
9. **Show the artifact, not the description** — **partial progress June 18:** homepage feature + use-case cards now use cropped product UI widgets; hero dashboard mockup unchanged. Viktor principle still applies elsewhere on site.
10. **Production greenlight** — track remaining blockers in `PRODUCTION_GREENLIGHT.md` (Stripe live, Clerk prod, Resend domain, DNS cutover).

**Closed since V17:** auth redirect loop; three Stripe checkout edge cases; lab5 homepage hero + card widgets (June 18).

---

## Current docs to read first

| Priority | Doc |
|----------|-----|
| Technical state | `CONTEXTV18.md` (this file) |
| Prior technical | `CONTEXTV17.md`, `CONTEXTV16.md` |
| Maya product rules | `MAYA_CONTEXT_V09.md` |
| Go-live checklist | `PRODUCTION_GREENLIGHT.md` |
| Inbox build record | `zernio_inbox_phase_b_plan.md` |
| Stage 2 build record | `stage2_idea_analysis_plan.md` |
| June 18 session | `SESSION_2026-06-18.md` |
| June 14 session | `SESSION_2026-06-14.md` |
| Audit ledger | `AUDIT_FIXES_2026-06-02.md` |

Superseded for latest state: `CONTEXTV17.md`, `MAYA_CONTEXT_V08.md`.

---

*Last reviewed: June 18, 2026*
