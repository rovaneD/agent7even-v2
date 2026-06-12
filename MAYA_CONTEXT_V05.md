# MAYA_CONTEXT_V05 - Hub Live in Prod, Page Context Architecture, Ingest Fixed
*Versioned snapshot: June 10, 2026*

**Superseded by `MAYA_CONTEXT_V06.md` (June 10 evening)** — image-context
caption product rules and post-media roadmap.

This document supersedes `MAYA_CONTEXT_V04.md`. Everything in V04 still
applies unless this file explicitly changes it.

Product/technical detail: `CONTEXTV14.md`. Session backlog: `SESSION_2026-06-10.md`.

---

## What Changed Since MAYA_CONTEXT_V04

### Foundation in production — canonical surface changed

- **Foundation Hub is live in prod** (June 10). `NEXT_PUBLIC_FOUNDATION_V2=true`
  was set in Production and redeployed. Users on prod now see the four-tab Hub
  (Intelligence, Knowledge, Memory, Agent connections), not the legacy per-field
  editor layout.
- **Legacy `FoundationEditor`** remains in code when the flag is off. It is
  **legacy** — do not polish its answer cards. Product decision pending: retire
  the flag gate and remove the editor path.
- **Knowledge ingest field-mapping** was broken in prod by dead OpenRouter slug
  `anthropic/claude-haiku-4` (fixed `496e570`). Post-fix: URL and image ingests
  extract fields in prod (session-verified). Stale Knowledge rows from the
  pre-fix era may still show old empty summaries until deleted and re-ingested.

### Maya page context — new documented property

Maya reads the user's current page through a **standard architecture** (shipped
June 10, prod smoke passed):

1. **`useMayaContext`** (`hooks/useMayaContext.ts`) — pages pass a
   `MayaPageContext` object; the hook handles dispatch and cleanup.
2. **Contract** (`lib/maya/contextTypes.ts`) — mandatory `dataSource` line;
   optional **`activeView`** as `{ label, state? }` for tabbed pages, serialized
   as `CURRENTLY VIEWING:` above the on-screen summary.
3. **Builders** (`lib/maya/summaries/`) — one per major surface; tabbed pages
   (Brand Kit, Foundation Hub, Analytics) set `activeView` to the active tab.

Maya should answer from **what the user is looking at**, including the active
tab, not from a static page inventory.

**Analytics nuance**: the page-level `DATA SOURCE:` header can disagree with
per-metric lines (e.g. header `live` while posting block says `SAMPLE / MOCK`).
When they conflict, **trust the per-block lines in `metrics`**.

### Foundation Hub Knowledge UX (June 10)

Committed and pushed in `cba111d` (hash confirmed on `main`); **not prod
UI-verified** this session:

- Header **Add knowledge** scrolls to the Intelligence upload card (was a no-op).
- **Review Findings** shows **From: {url or filename}** so competitor-page
  extractions are visible before save.
- Failed ingests show an error state instead of silently resetting.

Verify in prod before treating as done (`SESSION_2026-06-10.md` checklist).

Not done: snippet-level provenance (quote from source text per field) — deferred.

### Agent reliability note

Three registry agents (`weekly_content`, `ad_variations`, `brand_voice_guardian`)
and `contentWriter` shared the same dead Haiku slug as ingest field-mapping.
Slug fixed repo-wide; **prod agent smoke not yet run** to confirm costed output
rows (backlog item 10).

---

## 1. Product Identity

Unchanged from V04: Maya is the intelligence layer inside Agent7even v2.

Workspace areas (sidebar order unchanged). **Foundation** in prod now means the
**Hub** experience: section cards, Knowledge uploads, Memory stats, agent
connection map — not the legacy per-field percentage cards.

---

## 2. Current Flow Updates

Verified unchanged:

- Foundation generation pre-checkout (`chargeCredits: false`).
- Completion routing to checkout or pricing.
- Maya no-credit modal CTAs.
- Sign-in → `/dashboard`; incomplete foundation → `/foundation` onboarding.

New / updated:

- **Dashboard Foundation** (`/dashboard/foundation`) → Hub when V2 flag true.
- **Exa onboarding pre-fill** still in `/foundation` flow (separate from Hub
  Knowledge ingest).
- **Hub Knowledge ingest** uses Exa (URLs) + Anthropic vision (images) + OpenRouter
  Haiku 4.5 (field mapping). Failures now surface distinct messages where wired.

---

## 3. Foundation Hub — Maya-relevant behavior

| Tab | What Maya should understand |
|-----|----------------------------|
| Intelligence | Section health, score, weak sections, in-progress edit/regen |
| Knowledge | Uploaded materials count and types |
| Memory | Agent approval patterns (30-day window) |
| Agent connections | Which agents read which Foundation sections |

`buildFoundationHubMayaContext` passes `activeView` with tab label + compact state.

**Open UX bugs** (not fixed):

- Rescore updates overall score but not per-field scores until page reload.
- Legacy editor weak-area banner threshold mismatch — irrelevant if Hub stays canonical.

---

## 4. Visual Rules

Unchanged from V04 (`app/globals.css`):

- Blue `#3B82F6` primary interactive; pink `#F5349B` logo/accent only.
- White cards, `rounded-2xl`, `border-gray-100`, no default shadow.
- Command Center / Agents hero soft-shadow exceptions.
- Centered canvas `max-w-[1240px]`, `px-4 sm:px-8`.

---

## 5. Maya Behavior Rules

Maya should continue to:

- Read page context (including **active tab** on tabbed pages) before answering.
- Use module-appropriate summaries from `lib/maya/summaries/`.
- Avoid acting like a detached generic chatbot.
- Surface billing intent when credits block chat.
- During Exa onboarding pre-fill: present suggestions as editable research, not
  as user-authored answers.

**Knowledge Review Findings** (once prod-verified): users should see **which URL
or file** fields came from before saving. Maya should not encourage saving
competitor positioning as the user's own without the user noticing the source
line. Code shipped in `cba111d`; UI not confirmed live in prod this session.

---

## 6. Known Roster Mismatch

Unchanged from V04: marketing nine-agent roster includes Reputation & Follow-up;
platform registry still has `brand_voice_guardian` and no reputation agent.
Reconcile before marketing and product diverge further.

---

## 7. Current Technical Pointers

Read first:

- `SESSION_2026-06-10.md` — backlog and verification status
- `CONTEXTV15.md` — technical state
- `MAYA_CONTEXT_V06.md` — product/Maya rules
- `post_media_expansion_handoff.md` — post-media v2 scope (planning)
- `AUDIT_FIXES_2026-06-02.md`

Superseded: `MAYA_CONTEXT_V05.md`, `CONTEXTV14.md`.

---

## 8. Version Notes

V04 described Foundation Hub as shipped in code but did not record that **prod
was still on legacy editor** until June 10. V05 records the flag flip and ingest
slug fix as prod-relevant changes.

---

## UNVERIFIED — NEEDS ROVANE CONFIRMATION

1. Retire legacy `FoundationEditor` and remove flag gate — timing?
2. Exa pre-fill measurement / flag state in production?
3. AI Toolkit: keep, re-link, or retire?
4. Posts permission gate vs dedicated permission?
5. Roster reconciliation direction?
6. Mega / gomega.ai competitive work — still owed from session start?

---

*Last reviewed: June 10, 2026*
