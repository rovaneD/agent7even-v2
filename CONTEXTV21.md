# CONTEXTV21 — Lab5 marketing site (homepage + agents)
*Snapshot: June 25, 2026 — marketing-site sections still valid; logged-in product work superseded by `CONTEXTV22.md` (July 1, 2026)*

This document supersedes **marketing-site sections** in `CONTEXTV18.md` (hero structure, FAQ channels, feature mockups). Product/dashboard work is governed by **`CONTEXTV22.md`** (latest) and `CONTEXTV20.md` unless noted here.

Session log: `SESSION_2026-06-25.md`.

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest marketing commits: 1e9cfd9 … fcdfa65 (June 25, 2026)
```

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## Homepage hero (locked copy — June 25)

| Element | Copy |
|---------|------|
| H1 | Marketing, managed. |
| Lead L1 | **Maya** plans campaigns, writes the content, and queues it for your approval, |
| Lead L2 | and drafts customer replies, grounded in your brand voice. |
| Lead L3 | Nothing goes live without your&nbsp;approval. |
| Tagline | The operating system for your marketing. |
| Primary CTA | Start your free trial → `/pricing` |
| Secondary CTA | See how it works → `#how` |
| Trial note | 3-day free trial. / No charge until day 4. (under primary button) |

**Positioning:** OS-forward headline; Maya named in lead; **approval-first** — no “schedules publishing” or auto-post language (A1 + A2 ledger).

**CSS hooks:** `.hero-title`, `.hero-lead`, `.hero-lead-line`, `.hero-tagline`, `.hero-primary-stack`, `.hero-note`, `.btn-hero-primary`. Desktop: `.hero-lead-line { white-space: nowrap }`. Mobile (≤980px): lines 1–2 inline flow; line 3 block; CTAs full-width stack (≤720px).

**Files:** `app/lab5/page.tsx`, `app/page.tsx` (metadata + re-export), `app/lab5/styles.css`

---

## Supported channels (marketing claims)

### FAQ (`What channels does Agent7even cover?`)

Social publishing: **Instagram, Facebook, LinkedIn, X, and YouTube** (when accounts connected). Email sequences drafted for ESP paste (Mailchimp, Klaviyo, etc.). Google Analytics for marketing intelligence.

### Agents page — Connect strip

Pills: **Instagram · Facebook · LinkedIn · X · YouTube · Google Analytics**

---

## Product ↔ marketing alignment (publish path)

There is **no publish allowlist** in `lib/social/publisher.ts`. `createPost` forwards `platforms[]` to Zernio `POST /posts`.

**Caption / validation map** (`lib/social/postConstraints.ts` → `PLATFORM_CAPTION_LIMITS`):

```txt
instagram, facebook, twitter/x, threads, linkedin, tiktok, pinterest,
youtube, reddit, bluesky, telegram, snapchat, gbp/googlebusiness
```

**Connect UI lists (dashboard, not marketing):**

- Posts: `instagram, facebook, tiktok, linkedin, x, threads, pinterest, youtube`
- Analytics: above + `reddit, bluesky, google_business`

**Headless OAuth only (Meta):** `ZERNIO_HEADLESS_PLATFORMS = facebook | instagram | threads`

YouTube connect uses standard Zernio OAuth (`headless: false`). Marketing may claim YouTube; app code does not gate it — live success depends on Zernio.

---

## Feature mockups (lab5)

| Mockup key | Location | Notes |
|------------|----------|-------|
| `dashboard` | Hero showpiece | Maya chat + approval stats |
| `campaign` | Features — Your week, promoted | 3-column canvas; side panels 124/132px; ellipsis on cramped rows |
| `calendar` | Features — Images and video | `.mk-cal-grid`; mobile 1-col (do not apply 7-col CSS rule) |
| `approvals` | Features — The feed, handled | Approval queue |
| `competitor` | Features — The market, understood | Competitor watch |

**Mobile CSS trap (fixed June 25):** Do not use broad `[style*="grid-template-columns"]` in feat mockups — scope to `[style*="repeat(7"]` for content-planner only.

**Files:** `public/lab5/mockups.js`, `public/lab5/agent-mockups.js`, `app/lab5/styles.css`

---

## Visual system (unchanged)

- Primary blue `#3B82F6` — CTAs, links, focus, selected actions
- Pink `#F5349B` — logo + **Maya** name in hero only (restrained elsewhere)
- Standard marketing cards: white, `rounded-2xl`, `border-gray-100`, no default shadow
- Dashboard Command Center + Agents Command Center heroes: intentional soft-shadow exceptions

---

## Do not revert

- Hero approval-first lead (no schedules publishing)
- Five social channels in FAQ + Agents Connect (incl. X and YouTube)
- Campaign mockup overflow fixes
- Mobile hero CTA stack + calendar single-column grid
- Use-case ecommerce headline line breaks (`headlineLines()`)

---

## Related docs

| Doc | Role |
|-----|------|
| `a1_positioning_lock.md` | Pre/post signup positioning; hero inherits approval-first OS frame |
| `a2_capability_ledger.md` | What product claims may assert (gates Phase B copy) |
| `CONTEXTV20.md` | Content Posting UX, Creative Direction cache |
| `CONTEXTV22.md` | Latest logged-in product handoff (July 1, 2026) |
| `CONTEXTV18.md` | Prior lab5 homepage structure (superseded for hero by this file) |
| `phaseB_*_handoff.md` | Phase B rebuild notes (local, untracked) |

---

*End CONTEXTV21 — June 25, 2026*
