# Foundation V2 — Living Intelligence Hub
## Product Spec + UI Redesign + Claude Code Handoff
*Snapshot: June 5, 2026. Append to CONTEXTV12 and MAYA_CONTEXT_V03 when built.*

Read AGENTS.md, CONTEXTV12.md, MAYA_CONTEXT_V03.md before starting.
Confirm `git remote -v` shows `rovaneD/agent7even-v2`.
Branch off `main`: `feature/foundation-v2`

---

## The vision in one sentence

Foundation is not a form you complete. It is Maya's living brain —
the growing, adaptable intelligence layer that every agent, every campaign,
and every Maya conversation draws from. The more the owner feeds it,
the smarter Maya gets about their specific business.

---

## Why this matters (the product argument)

Foundation quality determines everything downstream. From Kyle Norton:
"Foundation reduces lossiness at the source — it replaces lossy inference
steps with the owner's actual stated answers. The better Foundation is,
the fewer lossy generative steps every downstream agent has to take."

Right now Foundation is a one-time wizard. That trains the wrong behavior:
the owner completes it and mentally moves on. The rebuilt Foundation must
feel like something you return to, something that visibly gets smarter, and
something that is obviously connected to everything Maya does. That
connection — visible, explicit, always present — is what makes the owner
understand that investing in Foundation directly improves every agent output.

---

## The four capability gaps this build closes

### Gap 1: No uploads / no external knowledge
The owner has materials: brand guides, PDFs, competitor screenshots, word
docs, past campaigns, customer testimonials, product specs, pitch decks.
None of this can currently enter Maya. Foundation V2 makes uploads a
first-class action — the owner feeds Maya their real business materials and
Maya extracts and integrates what's relevant.

### Gap 2: No agent connectivity visibility
The owner has no idea that their Voice definition powers three agents, or
that a thin competitors list is why the Competitor Watcher outputs are
generic. Foundation V2 makes this graph explicit and always visible: each
section shows which agents it powers, what the current health of that
section is, and what improving it would unlock.

### Gap 3: No memory / no learning loop
Foundation is static after generation. The owner's approval patterns, the
campaigns that ran, the posts that worked — none of it feeds back into
Foundation context. Foundation V2 introduces a memory layer: what's been
done, what's worked, what Maya has learned about this business over time.

### Gap 4: No adaptability after onboarding
The business changes. New competitors emerge, the offer evolves, the
customer understanding deepens. Foundation V2 is always editable, always
improvable, and (with the Exa grounding layer) proactively surfaces when
context may be drifting.

---

## The three surfaces (all three rebuilt together)

---

### SURFACE 1: The Foundation Hub (main page at /foundation)

Replaces the current redirect-to-wizard behavior for returning users.
New users still go through the onboarding flow (see Surface 2), but once
Foundation is complete, `/foundation` is a rich workspace, not a completed
form.

#### Layout
Centered constrained canvas: `mx-auto max-w-[1240px] px-8 py-8`
Two-column on desktop: main content left (70%), sidebar right (30%).
Single column on mobile.

#### Header zone
```
Maya's understanding of [Business Name]
Last updated [X days ago] · Foundation strength: [score/100]
[+ Add knowledge] button (primary, blue #3B82F6)
```

The Foundation strength score is the existing scoring system made visible
at the top level. Not a vanity metric — clicking it shows exactly which
sections are pulling it down and what to do.

#### Six knowledge sections (replacing the five static documents)

Each section is a card: `.card` treatment (white, rounded-2xl,
border-gray-100, no default shadow). Each card has:
- Section title + icon
- Health signal (Strong / Needs work / Thin — color-coded with status tokens)
- Key content preview (2-3 lines of what Maya knows here)
- [Edit] button
- Agent connectivity strip (see below)
- Last updated timestamp

The six sections:

| Section | What it covers | Feeds these agents |
|---|---|---|
| Your Business | businessDescription, problemSolved, transformation | All 9 agents (baseline context) |
| Your Customer | customerWho, frustration, trigger, transformation | content_writer, email_sequence_builder, ad_copy_generator, campaign_builder |
| Your Position | competitors, differentiator, differentiatorOwn | competitor_watcher, campaign_builder, ad_copy_generator, seo_scanner |
| Your Voice | toneTraits, brandsAdmired, neverSoundLike | content_writer, email_sequence_builder, brand_voice_guardian, ad_copy_generator |
| Your 30 Days | budget, channels, monthlyGoal | campaign_builder, analytics_reader, trend_spotter |
| Maya's Memory | campaigns run, approvals, what worked, what didn't | All 9 agents (historical context) |

Maya's Memory is new — it doesn't exist today. See Gap 3 below for
the data model. It auto-populates from the existing agent_outputs and
agent_tasks tables; the owner doesn't manually edit it.

#### Agent connectivity strip (on every section card)
A compact row below the section preview showing which agents draw from
this section. Each agent shown as a small pill with its icon and name.
Agents with Approval autonomy shown in blue; Auto agents in green.
Clicking a pill opens that agent's output page.

Example for Your Voice section:
[Content Writer ✓] [Email Builder ✓] [Brand Voice Guardian ✓] [Ad Copy ✓]

If a section is Thin and an agent depends on it, that agent's pill shows
amber with a warning dot: "Ad Copy Generator — limited by thin voice
definition." This is the cause-and-effect that makes Foundation
investment feel directly valuable.

#### The Knowledge sidebar (right column)
Always visible on desktop. Contains:

**Uploaded knowledge**
List of files/URLs the owner has added. Each item shows:
- File name/URL
- What Maya extracted from it (brief summary)
- Which sections it enriched
- [Remove] option

[+ Upload file] and [+ Add URL] buttons.
Accepts: PDF, DOCX, PNG/JPG (screenshots), plain text.
Max file size: 10MB per file, 50MB total per account.

**Maya's suggestions**
1-3 proactive suggestions from Maya based on thin sections or detected
drift. Examples:
- "Your competitors list has 2 entries. Adding more would improve your
  Competitor Watcher outputs."
- "Your Voice section hasn't been updated in 45 days. Your recent posts
  suggest your tone has evolved — want to update it?"
- "Based on last month's campaigns, your best-performing channel was
  Instagram. Your 30 Days section still shows Email as primary."

These suggestions are generated lazily (on page load, cached for 24h)
via a lightweight Maya call. They should feel like a strategist noticing
something, not a system notification.

**Foundation health breakdown**
A small visual breakdown of score by section. Not a pie chart — a simple
vertical bar per section, labeled, with the section health color.
Clicking a bar jumps to that section.

---

### SURFACE 2: The editing experience (per-section)

When the owner clicks [Edit] on any section, they enter an inline editing
mode — NOT a new page, NOT a modal. The section card expands in place,
showing the full fields for that section with current values pre-filled.

This is critical: the owner should never feel like they're "redoing
onboarding." They're refining a specific area of Maya's understanding.

#### Edit mode card behavior
- Card expands to show all fields for that section
- Current values shown in the inputs (not blank)
- Maya's intro copy for that section shown above (same as onboarding)
- Auto-growing textareas (already built in the design-system pass)
- Chip rendering for multi-select fields (toneTraits, channels, etc.)
- [Save changes] button (blue) + [Cancel] link
- Saving calls `/api/foundation/save-step` (existing route) with the
  section index and new values, then triggers a re-generation of only
  the affected Foundation documents via `/api/foundation/generate`
  (partial re-gen, not full 5-doc regeneration)

#### Partial regeneration rule
When a section is edited and saved, only the documents that depend on
that section should regenerate:
- Business edited → regenerate Business Brief + 30-Day Plan
- Customer edited → regenerate Ideal Customer Profile
- Position edited → regenerate Positioning Statement
- Voice edited → regenerate Brand Voice Guide
- 30 Days edited → regenerate 30-Day Plan
- Full regeneration option always available via "Regenerate all" in the
  overflow menu

This keeps the edit loop fast and low-cost. The owner fixes their Voice
section and Brand Voice Guide updates in seconds — they don't wait for
all 5 documents.

#### The agent-awareness panel (visible during edit)
While the owner is editing a section, show a compact panel:
"Changes here will update: [list of affected agents and documents]"
This makes the consequence of the edit visible before they save it.
Reinforces Foundation as the engine, not a form.

---

### SURFACE 3: The upload + knowledge ingestion surface

This is new infrastructure. It's the "Claude Projects" capability for Maya.

#### Upload entry points
Three places an owner can add knowledge:
1. The [+ Add knowledge] button in the Foundation Hub header (primary)
2. The [+ Upload file] / [+ Add URL] in the sidebar
3. A drag-and-drop zone that activates when a file is dragged onto the
   Foundation page

#### What can be uploaded
| Type | What Maya does with it |
|---|---|
| PDF | Extracts text, identifies brand elements, product info, competitor mentions |
| DOCX / TXT | Full text extraction and section mapping |
| PNG / JPG / WebP | Identifies brand colors, competitors, product imagery, copy from screenshots |
| URL | Reads the page via Exa getContents, extracts relevant context |
| CSV | Identifies customer data, product catalogs, campaign performance data |

#### The ingestion flow (what the owner sees)

1. Owner uploads a file or pastes a URL.
2. Immediate feedback: "Maya is reading this..." with a subtle spinner.
   This calls a new route: `POST /api/foundation/ingest`
3. Maya processes the file and returns an extraction result:
   ```
   Found in your brand guide PDF:
   ✓ Brand voice: Professional but approachable, never formal
   ✓ Core colors: #1A1A2E, #E94560 (added to your visual context)
   ✓ Product: [Product name] — [brief description]
   ✓ 2 competitor mentions: [Competitor A], [Competitor B]
   ? Unclear: "Premium tier" — is this a current or planned offering?
   ```
4. Owner reviews the extraction. Confirms, edits, or dismisses each item.
   Confirmed items are written to the relevant Foundation sections.
   Dismissed items are discarded.
5. Affected Foundation sections show "Updated via [filename]" in their
   last-updated timestamp.

#### The ingestion route: POST /api/foundation/ingest

New route. Accepts: `{ type: 'file' | 'url', content: base64 | string, filename?: string }`

Processing by type:
- URL: use `exaReadSite()` from lib/research/exa.ts (already built)
- PDF/DOCX: extract text via a library (see implementation note below)
- Image: use Claude vision via OpenRouter to identify brand/product/
  competitor elements — this is a natural fit for the existing runner

The route returns a structured `ExtractionResult`:
```typescript
type ExtractionResult = {
  items: {
    field: string        // which Foundation field this maps to
    value: string        // the extracted value
    confidence: 'high' | 'medium' | 'low'
    source: string       // filename or URL
    question?: string    // if unclear, what to ask the owner
  }[]
  summary: string        // "Found X items across Y Foundation sections"
}
```

Confirmed items are written to `profiles.foundation_answers` (existing
JSONB field) by merging new values into the existing structure.

**Implementation note on PDF/DOCX extraction:**
Do NOT build a custom parser. Use a bought library:
- PDF: `pdf-parse` (npm) — text extraction only, no rendering
- DOCX: `mammoth` (npm) — already in the codebase per CONTEXTV11

Both are already in the project or easily added. Build/buy discipline:
the intelligence is in how Maya *interprets* what's extracted, not in
the extraction itself.

**Image processing note:**
Claude vision via OpenRouter is the right call. The prompt:
"This is a business document/screenshot. Extract: brand voice indicators,
product names and descriptions, competitor names, pricing information,
visual brand elements. Return as JSON."

This is a Standard-tier runner call (not Light — images need reasoning).
Log to credit_ledger via deductCredits() accordingly.

#### Uploaded knowledge storage

New table: `foundation_knowledge`
```sql
CREATE TABLE foundation_knowledge (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL,         -- 'pdf' | 'docx' | 'image' | 'url' | 'text'
  source_name text,                   -- filename or URL
  raw_content text,                   -- extracted text (not the file itself)
  extraction_result jsonb,            -- the ExtractionResult from ingestion
  confirmed_fields jsonb,             -- which items the owner confirmed
  storage_path text,                  -- Supabase Storage path (files only)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: profile_id = authenticated user's profile
```

Files themselves go to Supabase Storage: `foundation-knowledge/{profile_id}/{uuid}-{filename}`
Signed URLs for retrieval. Never expose raw storage paths to the client.

---

## The Memory section (Gap 3 — new data, not new table)

Maya's Memory auto-populates from existing tables. No owner input required.
It reads:
- `agent_outputs` — what each agent has produced for this user
- `agent_tasks` — approval patterns (approved, rejected, edited)
- Future: post performance data when Zernio is live

What Foundation Memory surfaces on the hub:
- "Content Writer: 12 outputs approved, 3 rejected. Strongest topics:
  [topic A], [topic B]. Owner typically edits: CTA language."
- "Campaign Builder: 2 campaigns run. Best-performing channel: Instagram."
- "Brand Voice Guardian: flagged 4 off-brand outputs in the last 30 days.
  Most common issue: tone too formal."

This data is read-only for the owner. It's used by agents at run-time:
when the Content Writer runs, it reads the approval pattern summary from
Foundation Memory and adjusts its output toward what the owner has
historically approved. This is the compounding intelligence loop.

Agent reads of Foundation Memory happen in the existing runner:
`lib/agents/loadFoundationContext.ts` (already exists) should be
extended to include a `loadFoundationMemory(profileId)` function that
summarizes the last 30 days of agent_outputs approval patterns for the
requesting agent.

---

## Agent connectivity data (the explicit map)

Add to `lib/agents/registry.ts` a `foundationSections` array per agent
that lists which Foundation sections it reads:

```typescript
{
  id: 'content_writer',
  foundationSections: ['business', 'customer', 'voice', 'memory'],
  // ...existing fields
}
```

This powers the agent connectivity strips on the Foundation Hub without
hardcoding in the UI. The UI reads the registry and derives which agents
a section feeds. Single source of truth.

---

## What doesn't change

- The 5-step onboarding wizard for new users — it still runs on first
  Foundation completion. Exa pre-fill (already built) still runs before it.
  Do NOT redesign the onboarding wizard in this build.
- The `/api/foundation/generate` route — still generates the 5 documents.
  Partial re-gen (per section edit) calls the same route with a sections
  parameter.
- The `profiles.foundation_answers` JSONB field — still the source of truth
  for structured answers. Uploads enrich this field; they don't replace it.
- Foundation remains platform-funded before checkout. The knowledge
  ingestion for uploaded files runs through the runner but at zero credit
  cost during onboarding (same rule as Exa pre-fill).
- The `foundation_complete` flag and completion routing
  (`/checkout-now?plan=...` or `/pricing?foundation=complete`) are
  unchanged.

---

## Design tokens and visual rules

All current system tokens apply. Specific to Foundation V2:

- Section health states:
  Strong: `--color-status-success` (#10B981) — green pill/dot
  Needs work: `--color-status-warning` (#FCA509) — amber pill/dot
  Thin: `--color-status-danger` (#EE533B) — red pill/dot

- Agent connectivity pills:
  Approval agents: blue `#3B82F6` background, white text
  Auto agents: green `#10B981` background, white text
  Limited by thin section: amber `#FCA509` border, warning dot

- Upload zone:
  Idle: dashed border `--color-border` (#E2E8F0), surface-2 background
  Drag-over: blue border `#3B82F6`, light blue background tint
  Processing: animated pulse on the card

- The [+ Add knowledge] button is the primary CTA on this page.
  It uses `.btn-primary` (blue). This is the action Maya wants the owner
  to take most.

- No pink (#F5349B) anywhere on Foundation pages except the Maya avatar.
- Standard card treatment for all section cards.
- The two hero-shadow exceptions (Dashboard + Agents Command Center) do
  NOT apply here. Foundation Hub uses standard cards throughout.

---

## New API routes summary

| Route | Method | What it does |
|---|---|---|
| `/api/foundation/ingest` | POST | Process uploaded file or URL, return ExtractionResult |
| `/api/foundation/knowledge` | GET | List uploaded knowledge items for the user |
| `/api/foundation/knowledge/[id]` | DELETE | Remove an uploaded knowledge item |
| `/api/foundation/generate` | POST | Extend to accept `sections?: string[]` for partial regen |
| `/api/foundation/memory` | GET | Return approval pattern summary for Foundation Memory section |

All routes: Clerk auth, profile ownership scoped, never throw to client.
Mirror the pattern from `app/api/agents/constraints/route.ts`.

---

## New Supabase migration

```sql
-- foundation_knowledge table (see Surface 3 above)
CREATE TABLE foundation_knowledge ( ... );

-- Supabase Storage bucket
-- Name: foundation-knowledge
-- Access: private (signed URLs only)
-- RLS: profile_id ownership

-- Add to profiles (if not already present from Exa migration):
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS foundation_knowledge_count int DEFAULT 0;
```

---

## lib/agents/loadFoundationContext.ts changes

Extend the existing shared function to also load:
1. Uploaded knowledge summaries (from foundation_knowledge, confirmed_fields)
2. Foundation Memory summary (from agent_outputs approval patterns)

The combined context object passed to agents becomes:
```typescript
{
  answers: FoundationAnswers,        // existing structured fields
  documents: FoundationDocuments,    // existing 5 generated docs
  knowledge: KnowledgeSummary[],     // NEW: uploaded/ingested items
  memory: FoundationMemory,          // NEW: approval patterns + history
}
```

Agents can read all four. The runner passes the full context by default;
individual agents can declare which parts they need via their
`foundationSections` registry entry to keep token usage controlled.

---

## Phased build order (within this spec)

Phase 1 — The Hub UI + editing experience (no new backend)
Rebuild the Foundation page for returning users. Six section cards, health
signals, agent connectivity strips, edit-in-place. Uses existing data only.
No uploads, no memory section yet. This is the visual/UX shift.

Phase 2 — Foundation Memory section
Add the memory section to the hub. Read-only, auto-populated from existing
agent_outputs and agent_tasks. Extend loadFoundationContext.ts.
No new tables — just reads existing data differently.

Phase 3 — Upload + ingestion surface
The full upload flow: foundation_knowledge table, Supabase Storage bucket,
/api/foundation/ingest route, extraction UI, confirm/dismiss flow.
This is the largest build in the spec.

Phase 4 — Partial regeneration + agent connectivity registry
Add foundationSections to agent registry. Wire partial regen to section
edits. Connect the agent pills to the registry data.

Do NOT attempt all four phases in one session. Phase 1 first, verify,
then proceed.

---

## Definition of done

Phase 1:
- [ ] /foundation for returning users renders the Hub (not a completed-form dead end)
- [ ] Six section cards with current data, health signals, and agent connectivity strips
- [ ] Edit-in-place expands the card, pre-fills current values, saves correctly
- [ ] Agent connectivity strips read from registry foundationSections (Phase 4 can
      use hardcoded for now; refactor in Phase 4)
- [ ] Foundation strength score visible at top level
- [ ] Sidebar: uploaded knowledge placeholder (empty state), Maya suggestions (1-3)
- [ ] All design tokens correct; no pink; standard card treatment
- [ ] npx tsc --noEmit + npm run build pass

Phase 2:
- [ ] Foundation Memory section renders on the hub with real data
- [ ] loadFoundationContext.ts exports loadFoundationMemory()
- [ ] Agents receive memory context in their runner calls
- [ ] Memory section is read-only and clearly labeled as auto-generated

Phase 3:
- [ ] foundation_knowledge table migrated
- [ ] Supabase Storage bucket created with correct RLS
- [ ] /api/foundation/ingest route built and tested
- [ ] Upload UI: file picker + URL input + drag-and-drop
- [ ] Extraction result displayed with confirm/dismiss per item
- [ ] Confirmed items merged into profiles.foundation_answers
- [ ] Uploaded items listed in sidebar with summary + remove option
- [ ] PDF, DOCX, image, URL all tested with real files

Phase 4:
- [ ] foundationSections added to all 9 agents in registry
- [ ] Agent connectivity strips driven by registry data (not hardcoded)
- [ ] Partial regeneration works per section edit
- [ ] "Changes here will update:" panel visible during edit mode

---

## Update these docs when done

- CONTEXTV12.md (or successor): new routes, new table, storage bucket,
  lib/agents/loadFoundationContext.ts changes, queue items as DONE.
- MAYA_CONTEXT_V03.md (or successor): Foundation is now a living hub,
  not a wizard. Update the Foundation section description completely.
- AGENTS.md: update Last reviewed date.

---

## TRACKED TODO at fold-in time

When folding this into MAYA_CONTEXT_V03 or its successor, absorb it
fully into that document rather than leaving it as an appended section.
Foundation V2 is a major product shift — it deserves a first-class
section in the main context doc, not a footnote. Flag to Rovane.
