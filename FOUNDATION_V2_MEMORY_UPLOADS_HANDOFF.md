# Foundation V2 — Memory + Source Materials Slice
*Build Sequence item 3 (depth track) · July 2026*

Read `foundation_v2_spec.md`, `foundation_intelligence_vision.md`, and `FOUNDATION_CREATIVE_DIRECTION_STEP2_HANDOFF.md` before starting.

**Problem this slice solves:** Foundation today is a scored intake form. Competitors (e.g. Blaze.ai) produce a **rich brand profile from a URL alone** — business overview, tiered positioning, competitors, advantages, customer segments. Our Phase 1 is narrower and static; agents keep re-reading the same paragraphs.

This slice adds **depth owners can see and feed** — not the full Foundation Hub redesign.

---

## Goals

1. **Source materials** — owner uploads PDFs, decks, screenshots, past campaigns; Maya extracts structured facts into reviewable sections.
2. **Visible memory** — owner sees what Maya has observed (changelog + approved layers later), not just a score.
3. **URL / site enrichment** — one canonical website URL → strategic snapshot (positioning tiers, competitors, segments) comparable to competitor products, grounded in fetch + user confirmation.
4. **Combined agent context** — agents read Phase 1 + source excerpts + Observer signals + memory summary (not Phase 1 alone).

---

## Non-goals (this slice)

- Full Foundation Hub UI redesign (see `foundation_v2_spec.md`)
- Guardian proposal UI
- Auto-writing Phase 1 without user approval
- EnsembleData / Zernio performance loops

---

## Architecture

```
Owner inputs                    Stored                         Agents / Maya read
─────────────                   ──────                         ─────────────────
Website URL          →         site_snapshot (jsonb)     →    buildAgentContext
Uploads              →         foundation_sources        →    excerpt bundle
Foundation answers   →         Phase 1 (guarded)       →    anchor
Observer changelog   →         foundation_changelog    →    changelogContext (v0.5)
Approved layers (later)→        foundation_layers       →    layer stack
```

---

## Schema (migration `34_foundation_sources.sql` — draft)

### `foundation_sources`
| Column | Notes |
|--------|-------|
| id | uuid PK |
| profile_id | uuid FK |
| type | `upload` \| `website_snapshot` \| `manual_note` |
| title | user-visible label |
| storage_path | Supabase storage for uploads |
| extracted_markdown | Maya/Exa extraction output |
| extraction_status | pending \| ready \| failed |
| source_hash | dedupe |
| created_at | |

### `profiles.site_snapshot` (or JSONB on foundation_sources)
Structured object aligned with Blaze-class output:

```typescript
type SiteSnapshot = {
  businessOverview: string
  marketPositioning: { primary: string; secondary?: string; tertiary?: string }
  competitors: { local?: string[]; international?: string[] }
  competitiveAdvantages: string[]
  customerSegments: { label: string; shareHint?: string; description: string }[]
  fetchedAt: string
  sourceUrl: string
}
```

User **reviews and edits** before "Use in Foundation context" toggle — same Apply gate as form actuation.

---

## Build steps (ordered)

### 1 — Website enrichment path (highest Blaze parity)
- Reuse Exa read path from `lib/agents/flows.ts` (`websiteSnapshotContext`) as intake, not just SEO.
- New: `lib/foundation/enrichFromWebsite.ts` — structured extraction prompt → `SiteSnapshot` JSON.
- Foundation Hub section: "From your website" with Edit + **Apply to context** (does not mutate Phase 1 answers).
- Wire snapshot into `buildAgentContext` after Phase 1 block.

**Human checkpoint:** Run on agent7even.ai + zwee.io test URLs. Compare depth to Blaze screenshot standard.

### 2 — Uploads (source materials)
- Storage bucket `foundation-sources` (RLS per profile).
- Upload UI on Foundation Hub — single file first (PDF/image), expand later.
- Extract text → `extracted_markdown` via existing doc pipeline or Haiku pass.
- Show excerpt list; user toggles which excerpts agents may read.

### 3 — Memory visibility (UI)
- New Foundation Hub panel: **What Maya has noticed** — read-only list from `foundation_changelog` (last 30 days).
- Copy: "These are observations from your approvals and edits — not changes to your Foundation yet."
- Links forward to future proposal surface when Guardian surfaces rows.

### 4 — Agent context merge order
Document and enforce in `buildAgentContext`:

1. Phase 1 documents / answers (anchor)
2. Site snapshot + approved source excerpts (strategic depth)
3. Brand kit documents
4. Observer changelog block (decision signal — v0.5)
5. Maya memory stats (counts)

Prompt rule: **Depth sources enrich; Phase 1 constrains. Observer signals vary repetition.**

---

## Blaze gap — honest comparison

| Blaze (from URL) | Agent7even today | After this slice |
|------------------|------------------|------------------|
| Tiered positioning | Single positioning doc | `SiteSnapshot.marketPositioning` tiers |
| Competitor buckets | User-typed competitors field | Extracted + editable competitors |
| Segment % hints | ICP paragraph | Structured segments array |
| Advantages list | differentiator fields | `competitiveAdvantages[]` |
| Owner edits in UI | Foundation editor | Snapshot + sources + Phase 1 edit |
| Learns from decisions | Observer v0.5 readback | Changelog panel + future layers |

Blaze optimizes **first impression depth**. We optimize **guarded bedrock + accretion**. This slice closes the first-impression gap without breaking Phase 1 protection.

---

## Verification

- [ ] URL enrichment produces structured JSON on 3 test sites
- [ ] User can reject/edit snapshot before agents see it
- [ ] Campaign Builder run after snapshot includes tiered positioning (not only agency-frustration loop)
- [ ] Upload PDF → excerpt appears in agent context when toggled on
- [ ] Memory panel shows changelog rows matching verify script
- [ ] Phase 1 undo/severance still works — snapshot is separate column/table

---

## Cross-refs

| Doc | Role |
|-----|------|
| `foundation_v2_spec.md` | Full Hub vision |
| `FOUNDATION_GUARDIAN_HANDOFF.md` | Proposal verification (next FI step) |
| `lib/foundation/changelogContext.ts` | Observer v0.5 |
| `23_creative_direction_cache.sql` | Related translation layer |

*Memory + uploads slice — July 2026. Build after Guardian spec is stable.*
