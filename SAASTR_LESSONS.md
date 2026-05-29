# SaaStr AI Agent Playbook — Lessons for Agent7even / Maya
*Extracted June 2026 · Source: SaaStr AI Agent Playbook for GTM (Lemkin & Lerutte)*

This document translates the SaaStr playbook directly into product decisions for Maya. Every item below is either a feature to build, a design principle to enforce, or a constraint to respect. Reference this document when prioritising the roadmap or designing any new Maya capability.

---

## The Core Thesis (What We Are Validating)

SaaStr's headline result was not about AI being brilliant. It was about **"pretty good at scale."** 60,000 emails that weren't perfect, but were consistently good and actually sent. Their best insight:

> "Find something in your go-to-market motion that is not getting done, or is getting done at a mediocre level, and put an agent on it."

**For Agent7even:** Our clients are small businesses with one or two people doing marketing. The social posts that go dark, the email newsletter that ships quarterly, the follow-up that never happens — that's the gap Maya fills. Maya's value prop is not "better than a great marketer." It's "a consistently good marketer who never stops showing up."

---

## Lesson 1 → Foundation Is the Most Critical Product Decision

**The SaaStr insight:** "Agents are force multipliers, not magicians. The AI is not inventing your ICP or discovering your positioning. Your best humans figured all that out. The AI just runs those plays at scale."

**The test they use before deploying any agent:** *"If I hired 100 junior reps and gave them a perfect script, could they execute this motion?"* If yes → deploy AI. If no → you have a figuring-it-out problem, not a scaling problem.

**What this means for Maya:**

Foundation is not just onboarding UX. It is the quality gate for everything that follows. If a client completes Foundation with vague answers, every agent downstream will produce mediocre output. The 5 documents Foundation generates are the "proven playbook" — without them, agents have nothing to run.

**Immediate product implications:**
- Foundation answers should be validated for specificity before generating documents. Maya should push back on vague inputs: *"You said 'small businesses' — can you be more specific? What industry, what size, what problem are they trying to solve on a Tuesday?"*
- The Foundation generation step should show the client what the agents will do with each document. Make the connection explicit: "Your Brand Voice Guide is what the Content agent uses every time it writes a post."
- Post-Foundation, Maya should surface a readiness score or a plain-English summary: *"Based on your Foundation, here's what I can do well right now, and here's where we need more context to get great results."*

---

## Lesson 2 → Start With "Layup" Agents, Not Hero Agents

**The SaaStr insight:** "Find what is literally not getting done in your org. Support that takes a week to respond. Follow-up that never happens. Qualification that relies on fill-out-this-form-and-hope."

Their SDRs refused to follow up with return attendees. AI agents on those exact same leads generated 15% of London ticket revenue — money they wouldn't have gotten otherwise.

**What this means for Maya:**

The first agents a new client activates should be the ones covering work that's currently falling through the cracks, not improving something that's already sort of working.

**Immediate product implications:**
- During or immediately after Foundation, Maya should ask: *"What marketing work do you know should be happening but isn't? What's the thing you always mean to do but never get to?"* — and map the answer to a specific agent recommendation.
- The agent onboarding sequence should default to the highest-gap agents first. A likely ordering for most small business clients:
  1. Follow-up / re-engagement (leads that went cold)
  2. Content consistency (social/email that goes dark)
  3. Response speed (inquiry handling)
  4. Audience growth (cold outreach) — last, not first
- Frame this in the UI as "Found Revenue / Found Attention" — the work that was already there, just not being done.

---

## Lesson 3 → Agent Constraints Are as Important as Agent Instructions

**The SaaStr insight:** "I used to give the agent the best of everything. But agents are self-gratifying — they start saying things you never put in the context. Now I explicitly tell the agent what we cannot do."

SaaStr went through 47 iterations just to stop an agent from being too aggressive on pricing. Agents are goal-seeking — they will improvise to hit targets.

**What this means for Maya:**

Every agent needs a **Constraints** field alongside its instructions. This is not optional or advanced — it's foundational to brand safety.

**Immediate product implications:**
- Each agent card in the Agent Command Center should have two configuration sections:
  - **"What to do"** — goals, tone, proof points, context
  - **"What NOT to do"** — explicit prohibitions, hard floors, topics to avoid, escalation triggers
- Maya should prompt for constraints during agent setup: *"Is there anything this agent should never say or offer? Any topics to avoid? Any promises that need human approval first?"*
- For common constraint categories, offer templates: no discounting, no delivery promises, no competitor mentions, always route pricing questions to human, etc.
- The approval queue (already in the roadmap) enforces this at the output level — but constraints should catch it at the generation level first.

---

## Lesson 4 → Hyper-Segmentation Over Generic Campaigns

**The SaaStr insight:** "People run one campaign for 10,000 leads. Do not. Max campaigns at 100–500. Each campaign is highly customized to the exact segment. Not 'have you heard about SaaStr?' — instead 'you attended SaaStr Europa 2024, here is what is new.'"

They run 5 sub-agents just for outbound, each with different training: Lapsed Sponsors, Current Sponsors, Previous Attendees, Engaged Non-Converters, Pure Cold.

**What this means for Maya:**

Campaigns in Agent7even should not be channel-first (Email Campaign, Social Campaign). They should be segment-first, where the channel is a detail.

**Immediate product implications:**
- Campaign creation should start with: *"Who specifically are you reaching?"* — not "What do you want to post?"
- Segment options to surface during campaign setup (translate for small business context):
  - Past customers / lapsed customers
  - Warm leads who went quiet
  - People who engaged but didn't convert
  - Current customers (expansion / referral)
  - Cold audience by interest/location
- Maya should actively prevent "spray and pray" — if a client tries to run one campaign to their entire list, Maya should flag it and offer to split into segments.
- The A/B/C/D lead rule from SaaStr is directly applicable: A-leads (hand them to human immediately), B-leads (agents own these — this is the found money), C/D-leads (test later). Maya should help clients identify and label their B-leads.

---

## Lesson 5 → Daily Review Is the Product, Not the Burden

**The SaaStr insight:** "90% of AI SDR implementations fail because set-it-and-forget-it does not work. Weeks when we invest more time in our agents, response rates rise 10–20%. The training never stops."

They reviewed the first 1,000 emails manually. Now 20–30 minute daily spot-checks. Performance correlates directly with human attention invested.

**The key tension for Agent7even:** SaaStr spent 15–20 hours/week managing agents. Our clients cannot and will not do that. We need to compress that management overhead into a 10–15 minute daily habit — or absorb it ourselves as the agency layer.

**Immediate product implications:**
- The Dashboard's primary job should be making the daily review frictionless:
  - **Morning digest** — what agents did overnight, flagged outputs, anything needing approval
  - **Quick-approve flow** — swipe/tap approval for queued outputs without opening full editor
  - **One-click corrections** — mark output as "off-brand," "too aggressive," "wrong tone" and have Maya use it as training signal
- Maya should proactively surface: *"Your email agent sent 3 follow-ups last night. One got a response — want to see it? Two look slightly off to me — want to review?"*
- Daily engagement nudge: if a client hasn't reviewed agent outputs in 48 hours, Maya sends a gentle check-in (not an email — in-app notification or Maya greeting on next login).
- Make training feel like a 2-minute habit: a simple thumbs-up/thumbs-down on agent outputs, with Maya asking "what should it have done instead?" only when thumbs-down is tapped.

---

## Lesson 6 → Stealth Churn Is the Real Retention Signal

**The SaaStr insight:** "We haven't logged into Canva in 100+ days and still pay $18/month. DAU/WAU/MAU used to be a joke metric in B2B. Now it's your earliest leading indicator of churn. Silence is the new churn signal."

**What this means for Agent7even (as a product and as the agency):**

Client silence ≠ happy client. A client who hasn't interacted with Maya in 14 days is almost certainly about to churn, even if their subscription is active.

**Immediate product implications:**
- Track and surface agent activity per client in admin: last Maya interaction, last agent run, last output approved/rejected, days since any engagement.
- Automated re-engagement triggers (QBee-style for our own clients):
  - Day 7 no activity → Maya sends an in-app nudge: *"It's been a week — want to see what I've queued up for you?"*
  - Day 14 no activity → more proactive: Maya surfaces a specific win or insight to pull them back in
  - Day 21 no activity → flag for human follow-up from the Agent7even team
- In admin panel: add a "Client Health" column showing engagement score. This is a retention tool, not just analytics.
- The agents should be running even when the client isn't logging in — but they should create pull-back moments: *"I drafted 3 posts for next week. Want to review them?"*

---

## Lesson 7 → The Agent Evolution Pattern — Don't Start With "An Agent"

**The SaaStr insight:** "We didn't sit down to build agents. We sat down to kill workflows we hated. The agents grew out of that."

SaaStr's flagship agents all started as something boring: 10K started as a dashboard. QBee started as a project tracker. They shipped commits daily and the agents grew into what they needed.

**What this means for Maya's agent design:**

Don't present agents as complex AI systems. Present them as workflow replacements for things the client already does manually and hates.

**Immediate product implications:**
- Agent naming and descriptions should lead with the workflow being replaced, not the AI capability:
  - Not: "AI Content Generator"
  - Yes: "Weekly Social — drafts and schedules your social posts so you don't have to"
- During agent setup, Maya should ask: *"How are you currently doing this? Walk me through what you do now."* — this gives Maya the "best human to clone" context.
- Onboarding for each agent should feel like handing off a task, not configuring software. Maya walks the client through it conversationally, extracting what she needs to run it well.

---

## Lesson 8 → Specialized Agents Beat Generalists

**The SaaStr insight:** "We take three A+ tools over one B+ tool. Specialized wins. Even within one platform we run sub-agents with completely different training."

**What this means for Maya's agent architecture:**

The current 9-agent grid is the right structure, but each agent needs a tightly scoped identity. "Email Agent" is too broad. Agents should be scoped to a segment + job, not just a channel.

**Immediate product implications:**
- As clients activate agents, Maya should prompt specialization: *"Who specifically should this agent be reaching? Past customers, warm leads, or cold audience?"*
- Consider surfacing agent variants in the UI — not as separate agents, but as "modes" or "audiences" within an agent: the re-engagement mode vs. the nurture mode vs. the cold outreach mode, each with different training.
- Agent performance metrics should be tracked per audience segment so clients can see which specialization is working best.

---

## Lesson 9 → Forward Deployed Support Is a Product Differentiator

**The SaaStr insight:** "The vendors that work at SaaStr did 80% of the heavy lifting in the first 30–60 days: daily check-ins, custom training on their data, proactive identification of edge cases. The ones that flopped said 'here's your login, good luck.'"

SaaStr is the #1 performing customer for both Artisan and Qualified — not because the tools are magic, but because their teams invested heavily in training and optimization.

**What this means for Agent7even:**

This is the agency moat. The product (Maya) enables self-serve, but the agency layer (Agent7even team) provides the FDE-equivalent that separates top performers from everyone else. This is especially true for small business owners who have no AI fluency.

**Immediate product implications:**
- For Growth and ProAgent plans, build an explicit "onboarding sprint" — Agent7even team does the first 30 days of agent training alongside the client.
- Services module should include "Agent Setup & Training" as a purchasable service — getting a specific agent production-ready with an Agent7even specialist.
- In admin panel: track which clients have had human-assisted setup vs. pure self-serve, and measure the performance difference. This data validates the agency premium.
- Maya should surface the right moment to escalate to the team: *"This looks like a more complex setup than I can do on my own — want me to loop in the Agent7even team?"*

---

## Lesson 10 → The Economics Frame for Positioning

**The SaaStr insight:** AI-native orgs have 3–5x better unit economics. The optimal team size for a $10M B2B business used to be 25–35 people. It's probably going to be 8–12 people plus AI agents.

The ICONIQ 2026 data: high AI adopters generate $640K net new revenue per GTM FTE vs. $370K for low adopters — a 73% gap.

**What this means for Agent7even's positioning:**

Our clients can't hire a marketing team. Maya + Agent7even gives them the output of a 3–5 person marketing team for a fraction of the cost. That's the pitch — not "AI tools," but "your marketing team, powered by AI."

**Immediate product implications:**
- Dashboard should show ROI-adjacent metrics: content pieces published, follow-ups sent, leads re-engaged, hours of work handled by agents. Make the value visible.
- Consider a "What Maya did this week" weekly summary email to clients — keeps them feeling the value even when they're not logging in daily.
- Pricing page and onboarding copy should frame Maya against the cost of hiring (even part-time): "Maya handles what a part-time social media manager, email marketer, and customer follow-up coordinator would do — for less than one hour of their time."

---

## What NOT to Do (Anti-Patterns from the Playbook)

These are the failure modes SaaStr documented. Avoid building product that enables them.

| Anti-pattern | How Maya prevents it |
|---|---|
| Deploy AI to fix what's already broken | Foundation validates that the client has a working playbook before agents run it |
| Generic training / set and forget | Daily review UX makes ongoing training a 2-minute habit, not a project |
| Too many vendor bake-offs | Maya is the one platform — agents are unified, not separate tools to evaluate |
| No daily monitoring | Dashboard morning digest + agent activity notifications make monitoring default |
| Testing from wrong perspective | Maya's "incognito test" equivalent: after Foundation, Maya walks through the client experience as if she's a new customer — surfaces gaps |
| Expecting magic without work | Onboarding should set expectations clearly: "Maya gets better the more you work with her. Here's what the first 30 days look like." |

---

## Priority Mapping to Current Roadmap

Based on these lessons, here's how they map to what's already planned vs. what needs to be added:

### Validates existing priorities (keep building)
- Foundation flow ✅ — the most important thing to get right
- Approval queue ✅ — enforces agent constraints at output level
- Agent Command Center ✅ — central management view
- Dashboard morning state ✅ — needs to be the daily review hub

### Should be added / elevated in priority
- **Agent Constraints field** — per-agent "what NOT to do" configuration (currently missing)
- **Segment-first campaign creation** — start with "who" not "what channel"
- **Client health / engagement score in admin** — retention signal
- **Thumbs-up/down training feedback on agent outputs** — makes ongoing training frictionless
- **Re-engagement triggers for inactive clients** — Maya proactively pulls people back in
- **"What Maya did this week" digest** — value visibility for low-engagement clients
- **B-lead identification in campaign setup** — help clients find their "found money"

### Philosophy changes (no new code, just framing)
- Agent names/descriptions lead with workflow replaced, not AI capability
- Campaign creation starts with segment, not channel
- Foundation should push back on vague answers before generating documents
- Onboarding sets the "30-day training" expectation upfront, not as a surprise

---

*Last updated: June 2026. Source: SaaStr AI Agent Playbook for GTM + Agent7even MAYA_CONTEXT.md analysis.*
