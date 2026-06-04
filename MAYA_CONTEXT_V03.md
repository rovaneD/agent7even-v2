# MAYA_CONTEXT_V03 - Product Context After Merge
*Versioned snapshot: June 4, 2026*

This document supersedes `MAYA_CONTEXT_V02.md`. Everything in V02 still
applies unless this file explicitly changes it.

## 1. Product Identity

Maya is the intelligence layer inside Agent7even v2. She should understand the
current canvas and help the user move the work forward without making them
repeat obvious context.

Current workspace areas:

- Dashboard Command Center
- Agents
- Campaigns
- Content Calendar
- Services
- Brand Kit
- Foundation
- Analytics
- Deliverables
- Support
- Team
- Billing
- Notifications
- Settings

## 2. Current Flow Updates

The merged main branch now includes the latest onboarding and billing behavior:

- Foundation generation runs before checkout using the platform-funded path.
- If the user has not selected a plan, Foundation completion now routes to
  `/pricing?foundation=complete`.
- Maya no-credit states now open a plan/credits modal instead of rendering a
  dead-looking chat response.
- Existing plan users are routed to Billing / top-up from that modal.
- No-plan users are routed to Pricing from that modal.

This is the intended behavior for a new user who reaches Foundation before
completing subscription selection.

## 3. Visual Rules

The visual system remains the same as V02:

- Blue is the primary interactive color.
- Pink is reserved for the logo and restrained accents.
- Standard cards remain white with light borders and no default shadow.
- The Dashboard Command Center hero and Agents hero keep the soft-shadow
  exception.
- Page content stays centered on the canvas, with left-aligned content inside
  the center column.

## 4. Maya Behavior Rules

Maya should continue to:

- Read the page or canvas context before answering.
- Use the appropriate module context when triggered from Dashboard, Agents,
  Campaigns, Services, Content Calendar, Brand Kit, or Deliverables.
- Avoid acting like a detached generic chat shell.
- Show clear billing intent when the current state blocks chat due to credits.

## 5. Current Technical Pointers

Read these first for the latest implementation state:

- `CONTEXTV12.md`
- `AUDIT_FIXES_2026-06-02.md`

## 6. Version Notes

This file is the new current Maya context reference. The older unversioned
`MAYA_CONTEXT.md` should point here for continuity.

---

## Exa Web-Grounding — Product Rationale

### The problem it solves
Maya's target market — small business owners — is skeptical of AI because they've seen
generic, untimely, off-brand output. Maya's agents currently generate from training data,
which reads as generic. Exa grounding lets Maya generate from current, cited, real-world
information instead. A trust differentiator, not a feature checkbox.

### First build: Foundation pre-fill (the first-contact moment)
The highest-leverage place to prove this is the very first interaction. Today Foundation
hands a new user a blank multi-step form before Maya has done anything. The pre-fill flips it:

1. Before step 1, Maya asks one thing: "What's your business? Drop your website or name."
2. Maya reads their site and finds their competitors (Exa, in the background).
3. Maya enters the Foundation steps with fields already drafted — business description, what problem they solve, who their customer is, and especially their competitors.
4. The user confirms and corrects instead of authoring from scratch.

The value is not the data — it's that Maya did work before asking the user to. It makes Maya
feel like a strategist, not a form with a chat box, in the first 30 seconds.

### Fits the merged onboarding rules (do not violate)
- Platform-funded, pre-checkout: the pre-fill runs before a plan/balance exists and must NOT depend on the user's credits (cost 0 during the test).
- If research runs as an internal task it uses a `foundation_*`-style id and stays filtered out of Dashboard agent counts and Maya daily briefs — not the user's first specialist run.
- The pre-step lives inside the Foundation route; no redirect to the deleted `/onboarding` page.
- Completion routing is untouched: selected plan → `/checkout-now?plan=...`; no plan → `/pricing?foundation=complete`.

### Non-negotiable product guardrails
- Confirm-don't-author: pre-filled fields are clearly marked as Maya's editable suggestions, never presented as the user's own input.
- A wrong pre-fill is worse than none. Only pre-fill fields Maya is confident about; low-confidence fields stay blank.
- Never infer Voice or Budget/Goals from a website.
- Onboarding latency is sacred: if research is slow or fails, fall through to the normal blank Foundation. The flow never hangs on Exa.

### This is a measured test, not a commitment
Run flagged, 50/50, against the current manual Foundation. Graduate only if it lifts
Foundation completion and first-pass score with no latency/quality complaints. Otherwise kill
via the flag — $0 to find out (Exa free tier).

### Where it goes next (after validation)
Exa grounding is horizontal. Once the pre-fill test proves value, the same grounding layer
extends across the agent fleet, tiered on Light/Standard/Deep run tiers. Rollout order and
the Exa-template-to-agent map are in the CONTEXTV12 Exa addition. content_writer (grounded
social posts) is the natural second build. None of this jumps ahead of the pre-fill validation.

### Relationship to other integrations
Exa is server-side intelligence, unrelated to social scheduling. Buffer is ruled out; Zernio
is the gated social-publishing candidate. Exa makes Maya's output smarter; it does not publish anything.
