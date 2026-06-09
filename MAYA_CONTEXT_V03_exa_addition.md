# MAYA_CONTEXT_V03 - Addition: Exa Grounding & Foundation Pre-fill
*Append to MAYA_CONTEXT_V03.md (current) or its successor. Snapshot: June 4, 2026 (post-merge).*

Adds the product rationale for Exa web-grounding. Technical detail lives in the CONTEXTV12
Exa addition and exa_foundation_prefill_handoff.md. No prior product decision changes.

---

## Exa Web-Grounding - Product Rationale

### The problem it solves
Maya's target market - small business owners - is skeptical of AI because they've seen
generic, untimely, off-brand output. Maya's agents currently generate from training data,
which reads as generic. Exa grounding lets Maya generate from current, cited, real-world
information instead. A trust differentiator, not a feature checkbox.

### First build: Foundation pre-fill (the first-contact moment)
The highest-leverage place to prove this is the very first interaction. Today Foundation
hands a new user a blank multi-step form before Maya has done anything. The pre-fill flips it:

1. Before step 1, Maya asks one thing: "What's your business? Drop your website or name."
2. Maya reads their site and finds their competitors (Exa, in the background).
3. Maya enters the Foundation steps with fields already drafted - business description, what
   problem they solve, who their customer is, and especially their competitors.
4. The user confirms and corrects instead of authoring from scratch.

The value is not the data - it's that Maya did work before asking the user to. It makes Maya
feel like a strategist, not a form with a chat box, in the first 30 seconds.

### Fits the merged onboarding rules (do not violate)
- Platform-funded, pre-checkout: the pre-fill runs before a plan/balance exists and must NOT
  depend on the user's credits (cost 0 during the test).
- If research runs as an internal task it uses a foundation_*-style id and stays filtered out
  of Dashboard agent counts and Maya daily briefs - not the user's first specialist run.
- The pre-step lives inside the Foundation route; no redirect to the deleted /onboarding page.
- Completion routing is untouched: selected plan -> /checkout-now?plan=...; no plan ->
  /pricing?foundation=complete.

### Non-negotiable product guardrails
- Confirm-don't-author: pre-filled fields are clearly marked as Maya's editable suggestions,
  never presented as the user's own input.
- A wrong pre-fill is worse than none. Only pre-fill fields Maya is confident about;
  low-confidence fields stay blank.
- Never infer Voice or Budget/Goals from a website.
- Onboarding latency is sacred: if research is slow or fails, fall through to the normal
  blank Foundation. The flow never hangs on Exa.

### This is a measured test, not a commitment
Run flagged, 50/50, against the current manual Foundation. Graduate only if it lifts
Foundation completion and first-pass score with no latency/quality complaints. Otherwise kill
via the flag - $0 to find out (Exa free tier).

### Where it goes next (after validation)
Exa grounding is horizontal. Once the pre-fill test proves value, the same grounding layer
extends across the agent fleet, tiered on Light/Standard/Deep run tiers. Rollout order and
the Exa-template-to-agent map are in the CONTEXTV12 Exa addition. content_writer (grounded
social posts) is the natural second build. None of this jumps ahead of the pre-fill
validation.

### Relationship to other integrations
Exa is server-side intelligence, unrelated to social scheduling. Buffer is ruled out; Zernio
is the gated social-publishing candidate. Exa makes Maya's output smarter; it does not
publish anything.
