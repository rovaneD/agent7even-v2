# Foundation Page Redesign — Handoff

> Read `MAYA_CONTEXT.md` and `CONTEXTV7.md` first. Run `git remote -v` and confirm it shows `agent7even-v2-clean` before touching code.

## Goal

The Foundation page (`app/dashboard/foundation/page.tsx`) is hard to read. Every answer
is crammed into a fixed-height textarea with an inner scrollbar, so each field shows
~3 truncated lines and nothing is readable without scrolling inside a tiny box.

Redesign it so answers are full-width and readable at rest, expand on demand, and stay
editable. **Apply the new treatment to ALL 16 fields**, not just the text ones — but the
treatment differs by field type (see below). Do not change the data model, the field keys,
the scoring API, or the sidebar.

## The 16 fields (do not rename keys)

Grouped exactly as in `FoundationFlow.tsx` / `FIELD_EXPECTATIONS`:

| Section | key | label | type |
|---|---|---|---|
| Your business | `businessDescription` | Business description | text |
| Your business | `problemSolved` | Problem solved | text |
| Your business | `transformation` | Customer transformation | text |
| Your customer | `customerWho` | Customer description | text |
| Your customer | `customerFrustration` | Customer frustration | text |
| Your customer | `customerTriedBefore` | What they tried before | text |
| Your customer | `customerBuyingTrigger` | Buying trigger | text |
| Your position | `competitors` | Competitors | string[] (3 entries) |
| Your position | `differentiator` | Differentiator | single-select chip |
| Your position | `differentiatorOwn` | Differentiator (own words) | text |
| Your voice | `toneTraits` | Tone traits | multi-select chips |
| Your voice | `brandsAdmired` | Brands admired | text |
| Your voice | `neverSoundLike` | Never sound like | text |
| Your 30 days | `marketingBudget` | Marketing budget | single-select chip |
| Your 30 days | `channels` | Channels | multi-select chips |
| Your 30 days | `monthlyGoal` | Monthly goal | single-select chip |

Section titles, in order: **Your business · Your customer · Your position · Your voice · Your 30 days**

Pull labels from `FIELD_EXPECTATIONS` in `app/api/foundation/score/route.ts` so they stay
the single source of truth — don't duplicate label strings.

## Treatment by field type

Every field renders inside the same card shell:
- White bg, `border border-gray-200/80`, `rounded-xl`, `px-4 py-3.5`
- Header row: label (`text-[13px] font-medium text-gray-900`) on the left, per-field
  score on the right (`{score}%`), color-coded.
- Hover/focus: `hover:border-gray-300 focus-within:border-gray-400`

Score color helper:
```ts
function scoreColor(s?: number) {
  if (s == null) return 'text-gray-400'
  if (s >= 85) return 'text-emerald-600'
  if (s >= 75) return 'text-lime-600'
  if (s >= 50) return 'text-amber-600'
  return 'text-red-500'
}
```

### 1. Text fields (9 of them)
Use the `AnswerField` component from the reference file `FoundationPage.tsx`:
- Auto-growing textarea — height tracks content, NO fixed height, NO inner scrollbar.
- At rest, clamp to `COLLAPSED_MAX = 132px` with a bottom fade + "Show more" toggle
  **only when the content actually overflows** that height.
- On focus, always expand fully so the user edits the whole answer.
- `competitors` is `string[]` — render each of the 3 entries as its own auto-growing
  textarea stacked in the card, each labeled "Competitor 1/2/3" (small muted label),
  sharing the single `competitors` score in the card header.

### 2. Single-select chip fields (`differentiator`, `marketingBudget`, `monthlyGoal`)
- Render the option chips inline (reuse the existing option arrays:
  `DIFFERENTIATOR_OPTIONS`, `BUDGET_OPTIONS`, `GOAL_OPTIONS` from `FoundationFlow.tsx` —
  import them rather than re-declaring).
- Selected chip filled (`bg-gray-900 text-white`), others outline
  (`border border-gray-200 text-gray-600 hover:border-gray-400`).
- Clicking a chip sets the value. No textarea.

### 3. Multi-select chip fields (`toneTraits`, `channels`)
- Same chip rendering as above but multiple can be active.
- Reuse `TONE_OPTIONS` and `CHANNEL_OPTIONS`.
- Keep any existing max-selection limit from `FoundationFlow.tsx` (`toggleArrayItem` max arg).

## Layout

Two columns on `lg`, single column below:
`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-7`

- Left: the five sections of field cards.
- Right: the **Foundation strength panel made sticky** (`lg:sticky lg:top-8 lg:self-start`)
  so it stays visible while scrolling — this is why long fields clamp instead of all
  expanding by default. Panel content (strength %, bar, "Strong foundation / weak areas"
  line, Rescore button, "What Maya uses this for" list) is unchanged from current.
- Footer line under the Rescore button flips to `Unsaved edits — rescore to save` when
  any field has been edited since last score; otherwise `Last scored {date}`.

## Hard rules
- **Sentence case everywhere.** No Title Case, no ALL CAPS in the field bodies. (The
  mockup that floated around had `text-transform` artifacts — do not reproduce them.)
- No inner scrollbars on any field. Height is driven by content.
- Do not touch: field keys, `foundation_answers` shape, `/api/foundation/score`,
  `foundation_field_scores`, the sidebar progress bar, or the generate flow.
- Page stays a client component reading `initial` from the server component wrapper
  (`page.tsx` loads `foundation_answers` + `foundation_field_scores` + `foundation_score`
  + `foundation_updated_at` and passes them down).

## Reference implementation
Two attached files, both go in `app/dashboard/foundation/`:
- `page.tsx` — server component. Clerk-auths, loads `foundation_answers` +
  `foundation_score` + `foundation_updated_at` from `profiles` (by `clerk_user_id`) and
  per-field scores from `foundation_field_scores`, then passes them to the client as
  `initial`. Matches the existing server-component pattern used across the app
  (`createServiceClient`, redirect to `/sign-in`). Should drop in mostly as-is.
- `FoundationPage.tsx` — client component. Implements the full pattern for the
  text-field case, the sticky panel, the rescore wiring, and the score colors. **Extend
  it** with the chip and array variants above so all 16 fields are covered.

If a Foundation `page.tsx` already exists, replace its body but keep whatever auth /
profile-lookup helper the rest of the app currently uses — don't introduce a new one.

## Definition of done
- [ ] All 16 fields render in the new card shell, grouped into the 5 sections in order.
- [ ] 9 text fields auto-grow; long ones clamp with working Show more / Show less; focus expands.
- [ ] `competitors` shows 3 individually-editable auto-growing entries under one card.
- [ ] 3 single-select and 2 multi-select chip fields render as chips, not textareas, and write back correctly.
- [ ] Per-field scores show in each card header, color-coded; chip-field cards show their score too.
- [ ] Strength panel is sticky on lg and stays in view while scrolling the left column.
- [ ] Editing any field flips the footer to "Unsaved edits — rescore to save".
- [ ] Rescore posts to `/api/foundation/score`, updates overall + per-field scores + last-scored, clears dirty.
- [ ] Sentence case throughout; no inner scrollbars anywhere.
- [ ] Safari + Chrome: long Competitors answer is readable, expandable, and editable; panel stays visible.
