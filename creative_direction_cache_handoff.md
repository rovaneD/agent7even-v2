# Handoff — Creative Direction Cache (Step 5)
*June 23, 2026. Stop recomputing the translation layer on every generate.*

## Context (what's already true — do not rebuild)

The Foundation → Creative Direction translation layer is BUILT and WIRED:
- `lib/agents/foundationCreativeDirection/` — `translateFoundationToCreativeDirection()`
- `scripts/verify-creative-direction.ts` — checkpoint script (already run, bet validated)
- Image gen (`generateOptions.ts`) and video gen (`app/api/posts/generate-video/route.ts`)
  already call the translation on every run and pass `creativeDirectionBlock` to the
  brief composers.

**The problem this handoff fixes:** the translation runs FRESH on every single image
and video generation. Two issues:
1. **Cost** — an LLM call per generate, when the Creative Direction only changes when
   Foundation changes.
2. **Drift (worse)** — non-deterministic. Two generations from the same unchanged
   Foundation can get slightly different Creative Direction → different briefs →
   inconsistency that can't be debugged.

**The fix:** compute the Creative Direction only when Foundation changes, store it,
and have generation READ the stored object instead of recomputing.

---

## Repo rules (non-negotiable)
- Repo is `rovaneD/agent7even-v2`. Confirm `git remote -v` before any push.
- Next.js 16 (`proxy.ts` not `middleware.ts`), TypeScript, Supabase.
- `npx tsc --noEmit` must pass before commit. Commit before moving on.
- Read `AGENTS.md`, `CONTEXTV20.md`, `creative_generation_handoff.md` first.

---

## Step 0 — Locate the real Foundation save path (DO THIS FIRST, do not guess)

The recompute trigger must attach to wherever Foundation answers are actually saved.
The recon pointed at `POST /api/foundation/score` as the field-SCORE write path, but
that may not be where ANSWERS are saved. Find the truth before wiring anything.

Locate and report:
1. The route(s) that write `profiles.foundation_answers` (the answer values, not just
   scores). Likely candidates: a Foundation save/update route, or the score route if
   it also persists answers. Grep for `foundation_answers` writes:
   `grep -rin "foundation_answers" app/ lib/ | grep -i "update\|upsert\|insert"`
2. Confirm where `FoundationHub.tsx` "Save changes" posts to.
3. Report the exact route + the function that performs the DB write. That's the
   attachment point for the recompute trigger.

Do not proceed to Step 1 until the real save path is identified and reported.

---

## Step 1 — Storage for the cached Creative Direction object

Store the object on the profile, alongside Foundation, so generation reads it directly.

- Add a column (or jsonb field) to `profiles`:
  `creative_direction jsonb` — the cached CreativeDirection object
  `creative_direction_computed_at timestamptz` — when it was last computed
  `creative_direction_source_hash text` — hash of the source fields it was computed from
    (used for the content-checked trigger in Step 2)
- SQL migration file: `23_creative_direction_cache.sql` (additive, safe to re-run).
- If schema is managed directly in Supabase (no migrations folder per AGENTS.md),
  write the SQL and note it must be applied manually, matching the existing pattern.

---

## Step 2 — Content-checked recompute trigger

**Do NOT recompute on every Foundation save.** Recompute only when a field that
actually feeds the Creative Direction changes value.

The Creative-Direction-relevant fields (from the translation layer's inputs):
- Identity: `businessDescription`, `problemSolved`, `transformation`,
  `customerWho`, `customerFrustration`, `customerTriedBefore`, `customerBuyingTrigger`,
  `competitors`, `differentiator`, `differentiatorOwn`,
  `toneTraits`, `brandsAdmired`, `neverSoundLike`
- Visual: the five `visual*` fields (`visualAesthetic`, casting, imagery, palette,
  forbidden — confirm exact keys from `lib/foundation/visualFields.ts`)

Confirm the exact field set the translation layer actually reads by inspecting
`lib/agents/foundationCreativeDirection/` — use ITS input list as the source of truth,
not this list. If they differ, the translation layer's actual inputs win.

Trigger mechanism (on Foundation save, after the answer write succeeds):
1. Compute a hash of the current values of the relevant fields.
2. Compare to `profiles.creative_direction_source_hash`.
3. If different (or no cached object exists) → recompute, store the new object,
   update `computed_at` and `source_hash`.
4. If identical → do nothing (the save didn't touch anything the direction depends on).

This means: typo fixes in irrelevant fields, or saves with no real change, skip the
recompute. Only meaningful identity/visual edits trigger it.

---

## Step 3 — Recompute execution + failure safety

When a recompute is triggered:
- Call the EXISTING `translateFoundationToCreativeDirection()` — do not rewrite it.
- Store the result in `profiles.creative_direction` with `computed_at` + `source_hash`.

**Failure handling (critical — never break generation):**
- If the recompute LLM call fails (timeout, provider error): **keep the last good
  cached object in place.** Do not clear it. Do not block the Foundation save —
  the save succeeds, the recompute fails silently (log it), and the stale-but-valid
  object remains. Retry happens naturally on the next Foundation save or next generate.
- Recompute should be non-blocking on the save response where possible (use the
  same `after()` pattern the webhook uses, or a background trigger) so the user's
  "Save changes" doesn't wait on an LLM call. If that's hard, a short synchronous
  recompute is acceptable since Foundation saves are infrequent — but prefer non-blocking.

---

## Step 4 — Generation reads the cache (replace the per-run translation call)

In BOTH `generateOptions.ts` and `app/api/posts/generate-video/route.ts`:
- Replace the inline `translateFoundationToCreativeDirection()` call with a READ of
  `profiles.creative_direction`.
- **Fallback safety net:** if the cached object is missing (brand-new Foundation that
  hasn't triggered a compute yet, or a profile from before this change), compute it
  once inline, store it, and use it — i.e. lazy backfill. After the first compute it's
  cached and subsequent generates read the cache. This guarantees no generation ever
  fails for lack of a cached object.
- Net effect: the common path (Foundation unchanged) does ZERO LLM calls for
  Creative Direction at generate time. Only Foundation edits pay the compute cost.

---

## Success criteria (strict)

1. Foundation save with a meaningful identity/visual change → Creative Direction
   recomputes and `creative_direction` + `source_hash` + `computed_at` update.
2. Foundation save with NO change to relevant fields (e.g. typo in an unrelated field,
   or save with identical values) → NO recompute (hash matches, skipped).
3. Image generation reads cached `creative_direction` and makes NO translation LLM
   call when the cache is present and fresh.
4. Video generation does the same.
5. Brand-new Foundation with no cached object → first generation computes once,
   stores it, succeeds. Second generation reads cache, no recompute.
6. Recompute failure (simulate by forcing the translation call to throw) → Foundation
   save still succeeds, last good cached object remains, generation still works off it.
7. The cached object matches what `scripts/verify-creative-direction.ts` produces for
   the same profile (sanity: cache stores the same thing the verify script reads).
8. `npx tsc --noEmit` clean. `git remote -v` = `rovaneD/agent7even-v2`.

---

## What this does NOT include (out of scope — separate work)

- **Hub synthesis** — displaying the cached `visualDirection` in "Your Look" so it
  reads as confidently as "Your Voice." Separate, next after this. (The cache makes it
  possible — the hub can read the stored object directly.)
- **Guided pickers (Path B)** — converting open-text visual fields to recognition-based
  choices. Defer until real users show thin/empty visual fields (the translation
  layer's `weakSignals` is the built-in detector for this).
- **Observer/Guardian loop** — the cached object is the surface they'll later update,
  but that's the intelligence-layer build, not this.

---

## Why this completes Step 2 properly

The translation layer was always meant to be cached-on-change, not run-per-generate.
Caching turns it from a function call into a persistent object on the profile —
which is exactly what makes it (a) cheap, (b) deterministic, and (c) the stable
surface the hub can display and the Observer can later update. This is the step that
turns the Creative Direction from a transient computation into the persistent
intelligence the whole vision rests on.

---

## Loop protocol (run this as a self-checking loop)

1. PLAN — state the single next step.
2. DO — produce or improve the work.
3. VERIFY — score each success criterion 1–10, brutally honest, list what's weak.
4. DECIDE — every criterion 8+ → print FINAL and stop. Otherwise ITERATING, fix the
   weakest first.

Rules: never done until every criterion is 8+. Start with Step 0 (locate the real
save path) — do not wire to a guessed route. Do not rewrite the translation layer;
it's validated. Commit after each step group passes.

Begin. Run the loop until FINAL.

---

*creative_direction_cache_handoff.md — June 23, 2026*
*Completes Step 5 of FOUNDATION_CREATIVE_DIRECTION_PLAN.md*
