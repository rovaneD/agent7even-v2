# Foundation Intelligence Vision
*June 19, 2026 — product vision, not yet built*

This document captures the agreed vision for Foundation as a dynamic, accreting intelligence layer. It supersedes the static "scored form" model. Everything downstream — generation features, agent relevance gradient, trial model — references this document.

**Status:** vision finalized, architecture decided, drift-prevention mechanism agreed. Not yet built. Write the generation handoff and agent build specs after this doc is stable.

---

## The Problem with Foundation Today

Foundation is currently a static intake artifact. The user answers questions during onboarding, the answers are scored (0–100), and the form mostly sits there. Agents read it; nothing writes back to it. The score can improve if the user edits sections manually, but Maya doesn't learn from what actually happens.

This creates a gap between what Foundation claims to be ("persistent business intelligence") and what it actually is ("a well-structured form that gets scored once"). The contamination fix (June 2026) protected Foundation from being overwritten — but protection of a static form is not the same as a living intelligence layer.

The consequence: Maya's output quality is determined entirely by the richness of the initial Foundation. A user who fills in a thin Foundation gets thin output forever. A user who fills in a rich Foundation gets rich output but doesn't benefit from Maya observing their business over time. Neither compounds. Neither learns. That is what this vision changes.

---

## The Vision: Foundation as a Layered, Accreting Intelligence Stack

Foundation is not a document. It is a **stack** — a layered intelligence system that begins with a guarded bedrock and grows accretively as Maya learns the business from the inside.

The stack has a fundamental property that makes it defensible: **it is path-dependent.** A competitor can copy the onboarding form (Phase 1). They cannot copy six months of accreted, decision-trained, business-specific intelligence layered on top of it. That stack can only be built by being present as the business made its decisions. Maya is the only one who was there.

---

## Phase 1 — The Guarded Bedrock

Phase 1 is the first moment of contact between Maya and the business. It is:

- The onboarding Foundation answers — who the business is, who they serve, their voice, their positioning, their 30-day priorities.
- **Permanently guarded.** The contamination fix (severance + single-snapshot undo, June 2026) ensures Phase 1 is never silently overwritten. It is the only layer that requires deliberate, explicit user action to change — and even then, there is always an undo path.
- **Always the reference frame.** Phase 1 is not one input among many. It is the anchor. Every subsequent layer is checked against it. A proposal that contradicts Phase 1 faces a higher bar than one that extends it.
- **Never disregarded.** No matter how many phases stack on top, Phase 1 is always read by agents. It is the key the piece is written in.

Phase 1 is the thing that makes everything else trustworthy. Without a stable, protected bedrock, the stack drifts. With it, all accretion is bounded and checked.

---

## Phases 2+ — Accreting Intelligence Layers

As Maya observes the business in operation — the decisions the user makes, the content they approve, the edits they make, the posts they reject — she learns. That learning does not edit Phase 1. It forms **new layers that stack above it**.

Each layer represents a refinement of Maya's understanding of this specific business, grounded in real decisions rather than self-reported answers. Over time the stack looks like:

```
Phase 1 — Guarded bedrock (onboarding answers, protected)
Phase 2 — Learned from early decisions (first 30–60 days of approvals/rejections)
Phase 3 — Observed patterns (what messaging resonates, which formats work, what the user consistently changes)
Phase N — Ongoing refinement (continuous, never stops)
```

The layers are **additive, not mutative.** Phase 2 does not change Phase 1. Phase 3 does not change Phase 2. Each layer adds intelligence; none replaces what came before. The full stack is what Maya reasons from.

**The learning signal is user decisions — available now.** Every approve, reject, and edit is a signal. Approving a post that leans into urgency tells Maya something. Editing every draft to soften the tone tells Maya something. Rejecting three consecutive posts about pricing tells Maya something. This signal is available without any vendor integrations. It starts the moment a user begins using the product.

Performance data (Zernio analytics, EnsembleData competitor metrics) enriches later phases when available — "posts about X outperform posts about Y" is a signal too — but it is not required to start. The learning engine begins on decision-signal alone.

---

## The Mechanism: Changelog → Proposals → Layers

Maya does not write directly to Foundation. Ever. The mechanism is:

**1. Observation (continuous, internal).** Maya maintains a running changelog of observations derived from user decisions. This is internal — the user never sees the raw changelog. It accumulates observations like: "user has rejected 6 posts mentioning competitor pricing," "user consistently edits CTA from 'buy now' to 'learn more,'" "user approved 8 community-focused posts and rejected 4 product-feature posts."

**2. Formalization (periodic, internal).** When enough signal accumulates around a pattern, the learning agent formalizes it into a candidate proposal. A candidate is a structured statement about what Maya has learned: "Your audience responds better to community-focused content than product-feature content — Maya suggests updating your Foundation to reflect this."

**3. Verification (parallel, independent — see Dual-Agent Architecture below).** The candidate passes to the verification agent before any user ever sees it. The verification agent checks it against Phase 1 and assigns a state: consistent, extending, or contradicting. Only proposals that pass verification are surfaced.

**4. Proposal to user (low-frequency, respectful).** Verified proposals are surfaced to the user periodically — not as a stream, not as a dashboard to manage. A calm, occasional notification: "Maya has a few observations about your business — review when ready." The user sees 2–4 proposals at most. They approve, reject, or defer.

**5. Layer creation (on approval).** An approved proposal becomes a new Foundation layer. It is tagged with the date, the signal that generated it, and the approval that authorized it. It is immediately available to all agents as part of their Foundation context.

**6. Rejection as signal (feeds back).** A rejected proposal goes back to the learning agent as signal. "The user said no to this" is itself a data point — recalibrate.

**Silent writes never happen.** This is non-negotiable. The approval queue applies to Foundation's own evolution. Maya proposes; the user disposes. The morning's contamination fix is not just a patch — it is the first implementation of this principle.

---

## The Dual-Agent Architecture: Foundation Observer + Foundation Guardian

The drift problem — how does Maya learn without drifting? — is solved structurally, not through rules. Two agents run in parallel, independently, and their outputs are never merged without user authorization.

### Agent 1: Foundation Observer (the learning agent)

**What it does:** watches every user interaction with Maya's output — approvals, rejections, edits, re-orders, ignores. Extracts patterns. Maintains the internal changelog. Periodically formalizes candidate proposals.

**What it does not do:** communicate directly with the user. Write to Foundation. Override or influence Agent 2's reference frame.

**Key property:** it learns freely. There is no constraint on what it can observe or what patterns it can identify. The constraint is downstream — at verification, not at observation. Constraining observation would make the learning agent blind to real business evolution.

### Agent 2: Foundation Guardian (the verification agent)

**What it does:** receives candidate proposals from Agent 1. Independently checks each against Phase 1 as its fixed reference frame. Assigns one of three states. Decides what reaches the user.

**What it does not do:** learn from Agent 1's observations. Update its own reference frame based on what Agent 1 says. Agent 2's reference frame is anchored to Phase 1 and updates *only* when the user explicitly approves a proposal. Agent 1 cannot update Agent 2's reference frame. Ever.

**The three states Agent 2 assigns:**

| State | Meaning | Action |
|-------|---------|--------|
| **Consistent** | Proposal aligns with or deepens Phase 1 | Surface to user. Low friction: "Maya noticed this — add to Foundation?" |
| **Extending** | Proposal adds something Phase 1 doesn't cover | Surface with context: "Maya learned something new about your business." |
| **Contradicting** | Proposal conflicts with Phase 1 | Apply threshold filter (see below). Either discard as noise or surface as a deliberate question. |

**Why they must be independent:** if Agent 1 can influence Agent 2's reference frame, you get drift by another name — Agent 1 gradually convinces Agent 2 that the drift is intentional. Independence is the structural protection. It is not a design preference; it is the whole mechanism.

**Disagreement is signal.** When Agent 1 says "this business is evolving toward e-commerce" and Agent 2 says "that contradicts Phase 1 positioning (local services only)," the tension is information. The proposal that reaches the user is: "Maya is noticing a pattern that might mean your business is evolving — here's the tension. Is this a real shift?" That is a far more trustworthy surface than either agent alone would produce.

---

## The Drift Filter: Threshold-Based Contradiction Handling (Option C)

When Agent 2 identifies a contradiction with Phase 1, it applies a threshold filter rather than discarding all contradictions (too blind) or surfacing all of them (too noisy).

**The threshold is signal strength** — how many independent signals from Agent 1 support the contradicting proposal.

- **Weak signal (1–2 instances):** almost always noise. Discard quietly. One rejected post does not mean a brand pivot. The user never sees it.
- **Moderate signal (3–5 consistent instances):** holds for review. Agent 2 waits for more signal before surfacing. Still not shown to user.
- **Strong signal (6+ independent signals across multiple sessions, multiple content types, consistent direction):** surface as a deliberate question with full transparency. "Maya has noticed a pattern across your recent activity that may conflict with your Foundation — here's what she's seeing vs. what your Foundation says. Is this a real shift in your business?"

**The threshold is tunable.** Initial values (1–2/3–5/6+) are starting points. As usage data accumulates, the right thresholds will become empirically clear — what signal strength predicts a real business evolution vs. temporary variance. This is the ongoing engineering and calibration work.

**Rejected contradicting proposals are not lost.** They go back to Agent 1 as negative signal. If the user rejects "Maya thinks you're pivoting to e-commerce," that rejection is itself strong signal that the pattern was noise — recalibrate accordingly.

---

## Maya as the Maestro

Foundation is not a document Maya reads. It is the **score** — the complete musical notation of this business's identity. 

Phase 1 is the key the piece is written in. Stack phases are the movements that develop the theme. The agents are the orchestra. Maya is the conductor.

The conductor does not play an instrument. She coordinates the orchestra so that each section — content writing, competitor watching, trend spotting, analytics — plays from the same score, in the same key, developing the same theme. When the score evolves (a new Foundation layer is approved), the whole orchestra hears it and adjusts.

This reframe has a practical consequence: **Foundation-as-intelligence is the product. The agents are how it acts on the world.** Users are not buying "a content agent plus a competitor-watching agent plus a trend agent." They are buying Maya — an intelligence that knows their business and directs specialists to do work on its behalf. The agents are expressions of that intelligence, not the product itself.

---

## The Foundation-Strength Relevance Gradient

Foundation strength is not a binary gate. It is a gradient that determines the *relevance* of agent output — and the product should make this visible and motivating rather than punitive.

**Trial mode = deliberately ungated explore mode.**
New users need to feel value immediately or they churn. Agents run in trial regardless of Foundation strength. But the product is explicit: this is preview quality. Maya is working from limited information. The output gets sharper as the user builds Foundation.

Framing: not "your Foundation is too weak to use this" (wall) but "Maya is showing you what she can do with what she knows — here's how much sharper this gets when she knows more" (hook). The limitation becomes the conversion reason.

**Foundation strength as a visible dial.**
The product surfaces which Foundation sections are thin and what would improve if they were strengthened. "Your Voice section is at 40% — strengthen it and watch Maya's captions get sharper." Specific, actionable, routes to the section editor. Not a score for its own sake — a signal that drives behavior.

**Generation is the hard-floor exception.**
Image and video generation gate on a real minimum Foundation strength even in trial. A bad reel is not "preview quality the user can edit" — it is embarrassing and worse than nothing. The floor prevents the feature from producing business-in-a-box output for users who haven't given Maya enough to work with.

The floor is:
- **Empirical, not hardcoded.** Calibrate during build by generating across Foundations of varying strength. Find where output quality drops. Don't guess.
- **Per-relevant-section.** Gate on Voice + Position + Customer, not global score. A user could have an 80 overall but a weak Voice — and Voice is what makes creative output on-brand.
- **Server-enforced.** Not just UI-hidden. The generation route checks Foundation strength. A determined user cannot bypass it by hitting the API.
- **Specific and actionable on block.** "Generation needs a stronger Voice profile. Your Voice is at 45% — strengthen it here → [Intelligence tab, Voice section]." Not a generic "improve your Foundation."

**Per-agent relevance (beyond generation).**
Each agent has natural Foundation dependencies — which sections it reads, how much it depends on them. The Agent connections tab in Foundation Hub already maps these relationships. The gradient makes them binding: agents that depend heavily on Voice degrade gracefully when Voice is thin (output is more generic, Maya says so); agents that don't depend on identity (competitor watcher, trend spotter) run without degradation regardless of Foundation strength.

---

## What This Is Not

**Not fine-tuning a model.** The learning is prompt-composition and retrieval — Maya composes richer briefs as Foundation deepens. No model training, no ML infrastructure. On-architecture with the existing `agent_skills` / `prompt_library` pattern.

**Not autonomous identity updates.** Maya never changes Foundation without user approval. The proposal mechanism is not a shortcut — it is the constraint. There is no "Maya silently updated your Foundation" scenario.

**Not a dashboard to manage.** Foundation evolution is not a feed of notifications to process. It is a calm, occasional, low-friction proposal surface. 2–4 items, when Maya is confident enough. If the user ignores it, nothing breaks.

**Not a replacement for Phase 1.** No matter how many phases accrete, Phase 1 is always read, always the reference frame, always the anchor. The stack grows upward. The bedrock does not move.

---

## Build Sequence (high level — detailed specs separate)

This doc is the vision. Build specs follow after this is stable. High-level sequence:

1. **Foundation Observer (Agent 1)** — the observation and changelog layer. Hooks into approval/rejection/edit events. Maintains internal changelog per user. No user-facing surface yet.

2. **Foundation Guardian (Agent 2)** — the verification layer. Reads candidate proposals from Agent 1 against Phase 1. Assigns states. Applies threshold filter. No user-facing surface yet. Must be implemented as a fully independent agent — separate prompt, separate context, Phase 1 as its only reference frame.

3. **Proposal surface** — the periodic UI that surfaces verified proposals to the user. Approve / reject / defer. Approved proposals create Foundation layers.

4. **Layer persistence** — the data model for Foundation layers (tagged with date, signal, approval). Available to all agents as Foundation context alongside Phase 1.

5. **Relevance gradient** — the per-agent Foundation-dependency model. Starts with generation as the hard-floor implementation (already scoped in the generation handoff). Expands to other agents based on their dependency maps.

6. **Calibration** — ongoing. Threshold tuning as usage data arrives. What signal strength actually predicts real evolution vs. noise.

---

## Open Questions (to answer during build, not before)

- What is the right proposal cadence? (Weekly? When signal strength crosses a threshold? On a user-triggered "Foundation review"?) Start with threshold-triggered, tune from usage.
- What data model do Foundation layers use? (Supabase table with `phase`, `content`, `signal_source`, `approved_at`, `approved_by_session`?)
- How does Agent 2 handle multi-signal contradictions across different Foundation sections? (Voice contradiction is different from Positioning contradiction — do they need different thresholds?)
- When the user rejects a proposal, how long does the cooldown last before Agent 1 can re-raise the same pattern?

These are engineering questions that belong in the build spec, not this vision doc.

---

## Connection to Other Roadmap Items

**Creative generation handoff** — downstream of this doc. The generation feature's Foundation-strength gate, the grounded-brief composition, and the "Maya translates identity + assets into generation input" thesis all assume this Foundation model. Write the generation handoff against this doc.

**100-video format library** — Meaning 1 (distilled patterns Maya composes from, not model training). Enhances Agent 1's brief-composition capability. The library feeds the Observer's output quality; the Guardian's job doesn't change.

**EnsembleData Stage 1/3** — performance data (what actually worked) becomes a learning signal for Agent 1 in later phases. Not required to start the Foundation Intelligence build — available as enrichment when Stage 1/3 ships.

**Approval queue (existing)** — the proposal surface for Foundation evolution uses the same mental model as the existing content approval queue. The user already understands "Maya proposes, I decide." Foundation proposals are the same pattern applied to Foundation itself.

---

*Foundation Intelligence Vision — June 19, 2026*
*Vision finalized. Not yet built. Generation handoff is the next document.*
