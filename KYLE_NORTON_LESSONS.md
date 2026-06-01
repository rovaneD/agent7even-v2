# Owner.com CRO Playbook — Design Principles & Action Items for Maya
*Extracted May 2026 · Source: Kyle Norton (CRO, Owner.com) SaaStr AI 2026 talk*

Companion to SAASTR_LESSONS.md. That document covers the Lemkin/Lerutte GTM playbook (Foundation as quality gate, layup agents, constraints, segmentation, daily review). This one covers Kyle Norton's distinct ground: centralization, build-vs-buy, lossiness, and the assistive→agentic autonomy ramp. Where the two overlap, this doc defers to SAASTR_LESSONS.md and adds only what's new.

---

## The One-Line Translation

Kyle's thesis: one small central team building 5–10x-better tools beats 20 people building mediocre ones, and the gap between "Level 3" operators and everyone else widens every month. **Maya is the productized version of that central team for a buyer who could never hire one.** The SMB owner is the "rep" who should never be building their own GPTs — Maya is the applied-AI team running centrally and delivering output into the surfaces the owner already lives in.

---

## Principle 1 → Maya Is the Centralized Team (don't make the owner operate AI)

**Kyle:** Decentralized "let a thousand flowers bloom" stalls orgs at Level 1. Reps building their own tools is "hyperrealistic work-like activities" / "AI performance theater" — it feels like work but doesn't move a number. Production-grade builds happen centrally; ideas can come from anywhere.

**For Maya:** The owner should never orchestrate agents, manage prompts, or assemble their own workflows. Maya runs everything centrally and surfaces results. Any UI that asks the owner to "configure," "chain," or "manage" an agent is performance theater — it's the thing to design *out*.

**The test, applied to every feature:** *Does this put the owner closer to a result, or does it just feel productive?* If a feature makes the owner feel like they're "doing AI" rather than getting marketing done, cut it.

---

## Principle 2 → Buy Infrastructure, Build Intelligence

**Kyle's five questions** for any build/buy call:
1. How critical is uptime? (if it breaks for an afternoon, does everything stop?)
2. How customized does it need to be? (is off-the-shelf already 90%?)
3. What's the engineering ROI?
4. Is this core proprietary intelligence?
5. Does it give a real competitive advantage?

Infrastructure (dialers, auth, payments, transcription) → buy. Proprietary intelligence → build.

**For Maya:** This validates the existing stack split. Clerk, Stripe, Supabase, OpenRouter, Resend = bought infrastructure. The moat being built is the **intelligence layer**: the 5 Foundation documents, the brand context, the bidirectional canvas memory, the campaign reasoning. Run any proposed new feature through the five questions before building it in-house.

**Standing rule:** If a capability is already 90% solved off the shelf and isn't proprietary intelligence, integrate it — don't build it.

---

## Principle 3 → Lossiness Is the Core Constraint on Agent Design

**Kyle:** Every generative step in a chain compounds error. Crawl site → infer value prop → infer ICP → infer positioning → identify competitors → write email = five stacked generative steps = slop. The fix is a human or deterministic checkpoint that intercepts before lossiness compounds. At Owner, AI surfaces a scored account list; a *human* decides what enters the prospecting engine. That single checkpoint kills the compounding.

**For Maya — this is the most important architectural takeaway:**
- The approval queue is Maya's lossiness interceptor. It must sit at the *right points inside* agent chains, not only at the final output.
- Be deliberate and explicit about how many generative steps run before a human or deterministic rule intercepts. Document the chain length for each agent and each multi-agent orchestration.
- "Maya can chain agents together" is powerful and dangerous. Long autonomous chains are exactly where slop is produced. Default to short chains with a checkpoint, not long ones that run end-to-end unattended.
- Foundation reduces lossiness at the *source* — it replaces "infer the ICP/positioning/voice" generative steps with the owner's actual stated answers. The better Foundation is, the fewer lossy inference steps every downstream agent has to take.

---

## Principle 4 → The Autonomy Ramp Is a Trust-Building Dial, Not a Setting

**Kyle's spectrum:** Assistive (human makes every decision) → Hybrid (deterministic workflow + generative steps + human checkpoints) → Fully agentic (no human in the loop). And separately: change management — not tech — is the #1 challenge. The market has scared people that AI will replace them; you have to win trust first with builds that are obviously net-positive.

**For Maya:** The Auto / Approval autonomy levels already in the agent design are the trust dial. The design principle: **autonomy is earned over time, per agent, not chosen up front.**
- New owners start with everything in Approval (assistive/hybrid). Maya proposes, owner approves.
- As an agent demonstrates consistently good, on-brand output the owner keeps approving, Maya can suggest graduating that agent to Auto for that specific task.
- Lead with rep-positive (here, owner-positive) wins: the first things Maya does autonomously should make the owner's life obviously easier and lower-risk, never something that could embarrass them publicly.
- This ties directly to the approval queue (lossiness) and to the daily-review habit from SAASTR_LESSONS.md Lesson 5.

---

## Principle 5 → You Are the Eval (the hour-8 grinder beats the hour-3 quitter)

**Kyle:** The build is the easy part now. The grinding iteration on prompts, context, and workflow chains until output quality is actually good is the work. Most "AI doesn't work" stories are "I tried it twice and gave up" stories. Breakthroughs come at hour 6–8, not hour 3.

**For Maya — two applications:**
- *Internal (the team building Maya):* Don't ship MVP prompts and call an agent done. Each agent needs a deliberate eval + iteration loop. Quality is an iteration problem, not a feature-count problem.
- *Product:* The thumbs-up/down training signal (already flagged in SAASTR_LESSONS.md) is how the *owner* becomes the eval without realizing it. Every correction is iteration. Maya should treat accumulated feedback as the thing that compounds output quality over time.

---

## Principle 6 → Capture, Don't Ask (first-party data instrumentation)

**Kyle:** "You can't ask a rep to fill out 25 fields. They won't." Owner uses Momentum to auto-ingest every call transcript and populate Salesforce fields automatically — pricing changes, positioning shifts, competitor mentions, all captured passively.

**For Maya:** The owner will not maintain their own context. Maya's context must be *captured* from what the owner actually does — campaigns run, content approved/rejected, what performed — and folded back into her permanent context automatically. The bidirectional canvas relationship in MAYA_CONTEXT.md must be a *capture* mechanism, not just a *reflect* one. Every approval, edit, and rejection is first-party signal that should update Maya's understanding of the business.

---

## Principle 7 → The Sophistication Ladder as Buyer-Facing Positioning

**Kyle's ladder:** L0 (ChatGPT as search bar) → L1 (individuals building custom GPTs, stuck here) → L2 (a team automating workflows) → L3 (centralized infra, shared skills, context library, compounding leverage) → L4 (self-improving, nobody's there yet).

**For Maya:** Most SMBs are at L0. Maya sells them L3 — centralized infrastructure, a context library that compounds, real leverage — with zero building required on their part. That's a sharp, non-technical way to frame the value gap: *"You don't need to learn AI. You need the thing the best operators built — and that's what Maya is."*

---

## What Does NOT Transfer

Kyle's "unbundle the job" frame is about reorganizing internal headcount (central data team builds lists so BDRs only sell). Maya has no internal team to reorganize. The analog is unbundling the *owner's* marketing tasks and deciding which Maya does autonomously vs. which need owner judgment — which is just Principle 4 (the autonomy ramp) applied per task. Don't over-import the headcount framing.

---

## Action Items

Grouped by type. Items that overlap with SAASTR_LESSONS.md are noted so they're not double-counted.

### A. Architecture / build work (new or elevated)

1. **Map and document generative-chain length for every agent and every orchestration.** For each agent in the registry and each multi-agent flow in `runOrchestration()`, write down the sequence of generative steps and where the human/deterministic checkpoint sits. Target: no chain runs more than ~2–3 generative steps without an interception point. *(New — directly from Principle 3.)*

2. **Audit the approval queue's position in agent chains.** Confirm the queue can intercept *mid-chain*, not only at final output. If it can only catch final outputs, design mid-chain checkpoints for the longer orchestrations. *(New — Principle 3.)*

3. **Make the canvas binding a capture mechanism.** Extend the bidirectional canvas relationship so every owner action (approve, edit, reject, reschedule) writes a structured signal back into Maya's permanent context — not just into the current session. Define where this lands in Supabase. *(New — Principle 6. Related to the thumbs-up/down item already in SAASTR_LESSONS.md.)*

4. **Build the autonomy ramp as a per-agent, time-earned progression.** New agents default to Approval. Add the mechanism + UI for Maya to *suggest* graduating a specific agent to Auto after a track record of approved, on-brand output. *(New — Principle 4. Builds on the existing Auto/Approval levels and the agent_constraints work.)*

5. **Wire Maya chat into `runAgent()`.** Already a known gap in MAYA_CONTEXT.md (Maya chat bypasses the runner — tokens not logged, credits not deducted). Reinforced here because lossiness/eval discipline only works if Maya's own generations go through the same instrumented path as agents. *(Existing gap — elevate priority.)*

### B. Process / team discipline (no new code)

6. **Adopt a per-agent eval + iteration loop before any agent is marked "done."** Define a minimum quality bar and an iteration log per agent. Kill the "ship MVP prompt, move on" pattern. *(New — Principle 5.)*

7. **Run every proposed build through Kyle's five build/buy questions.** Add the five questions to the session/handoff checklist so build-vs-buy is a deliberate decision, not a default-to-build. *(New — Principle 2.)*

8. **Add a "performance theater" test to feature review.** Before building any owner-facing config/orchestration UI, ask: does this get the owner to a result, or just make them feel like they're doing AI? Cut features that fail. *(New — Principle 1.)*

### C. Positioning / framing (copy, not code)

9. **Frame Maya as "the central AI team you couldn't hire," using the sophistication ladder.** Update positioning/onboarding copy: most SMBs are at L0; Maya delivers L3 with no building required. *(New — Principles 1 & 7. Complements the "your marketing team, powered by AI" framing in SAASTR_LESSONS.md Lesson 10.)*

10. **Make Foundation's anti-lossiness role explicit to the owner.** In Foundation, connect the dots: every specific answer they give removes a place where Maya would otherwise have to guess. Reinforces the "push back on vague answers" item already in SAASTR_LESSONS.md Lesson 1. *(Reinforces existing — Principle 3 + 6.)*

---

*Last updated: May 2026. Source: Kyle Norton SaaStr AI 2026 talk + MAYA_CONTEXT.md + SAASTR_LESSONS.md.*
