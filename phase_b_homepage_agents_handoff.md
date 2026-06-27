# Phase B Handoff — Homepage + Agents (copy thread)

**Status:** ready to execute. **Do not commit this file** — planning artifact; same category as A1/A2.
**Repo:** `agent7even-v2` @ `main`. Run `git remote -v` before push.
**Gates:** `a1_positioning_lock.md` (OS-forward pre-signup, Maya subhead) + `a2_capability_ledger.md` (claims table §2, agent correction §3).
**Parallel-safe:** No overlap with A3 credit retune (`lib/credits.ts`, `lib/agents/cost.ts`, API debit routes). Touch only marketing copy + mockup JS.
**Out of scope:** Pricing page numbers (gates on A3). Use-case page rewrites (separate handoff). Logged-in product copy.

---

## 0. Objective

Kill live **performance-theater** claims on `/` and `/agents` without waiting for credit retune. Every change must pass A2’s verb test: claim what the product **executes today**, present tense, at the true boundary.

**P0 overclaims to eliminate in this pass:**
- “Answers reviews” / Google review reply UI (roadmap — not built)
- Fictional “Reputation & Follow-up” agent
- “Nine agents” (code has **12** registered)
- “Runs automatically” on Weekly Content (code: **approval_required**, no schedule)
- “Maya runs brand-voice review on every draft” (false — separate agent, not auto-invoked)
- “She ships” / “scheduled and sent” / “Maya sends” (draft → approve → **you** publish)
- “Monitors live” competitors/trends (LLM **reports**, not live feeds)
- “Runs ads” (writes **variations** only)
- “Revenue attribution” / post-to-sale (Stripe billing-only; no commerce sync)
- Fake trust-strip customer names (Thread 5 — included here because it’s on homepage)

**P0 underclaims to add:**
- Generates images in brand style (env-gated but real)
- Generates short videos (env-gated but real)
- Reads your image, writes the caption (vision captions)
- Approval queue as core trust mechanism

---

## 1. File manifest

| File | Action |
|------|--------|
| `app/lab5/page.tsx` | Hero, sections, FAQ, footer tagline, agents bridge |
| `app/page.tsx` | `metadata.title` + `description` (OS-forward) |
| `app/lab5/agents/page.tsx` | Full agent architecture rewrite |
| `app/agents/page.tsx` | `metadata.description` |
| `public/lab5/mockups.js` | Remove review-reply mock rows; soften ship/send language in dashboard mock |
| `public/lab5/agent-mockups.js` | **Remove** `reputationQueue` mock; replace competitor/campaign copy if needed |

**Do not edit:** `lib/**`, `app/api/**`, pricing, dashboard, credit files.

---

## 2. Homepage (`app/lab5/page.tsx`)

### 2.1 Hero — A1 OS-forward (§1, §4)

**Replace** Maya-first H1 with OS outcome; Maya named immediately under.

| Element | Current | Target |
|---------|---------|--------|
| H1 line 1 | `Meet Maya` | `Marketing gets done` *(or)* `Your marketing OS` |
| H1 deck | `An AI agent that orchestrates your entire marketing…` | `without becoming your job.` |
| Subhead (new, one line) | — | `Powered by **Maya** — the intelligence layer coordinating 12 specialist agents.` *(pink `<em>` on Maya only)* |
| Body p1 | `Your campaigns planned, copy drafted, posts queued…` | `Campaigns planned, copy drafted, images and video generated — all in your voice, queued for approval.` |
| Body p2 | `She runs the marketing while you run the business.` | `You run the business. The OS runs the marketing.` |
| Hero link | `Join the SMB owners getting their marketing done with Maya` | `See how the marketing OS works →` *(or keep trial CTA tone without over-claiming execution)* |

CTAs unchanged: `/pricing` trial, `#how`.

### 2.2 How it works — step 03 execute boundary

| Step | Current | Target |
|------|---------|--------|
| 03 title | `You approve, she ships` | `You approve, you publish` |
| 03 body | `…Maya makes it happen.` | `Nothing goes live until you sign off. Approve from your queue, then schedule or publish in one click.` |

Step 02: add “images and captions” — e.g. `Posts, emails, images, and captions — built from your Brand Kit.`

Sec-head lead: change `idea to scheduled` → `idea to your approval queue`.

### 2.3 Features section — replace Follow-up block

**Delete** entire “Follow-up” feat block (lines ~218–230) — review replies not built.

**Replace with** “Creative” feat (live capabilities):

```
feat-relief: Creative
h3: Images and video, on-brand.
body: Generate post images in your brand style, short-form video, and captions that match what's in the frame — not generic stock.
checks:
  ✓ AI images from your Brand Kit and Foundation
  ✓ Captions written with your image in context
  ✓ Every asset waits in your approval queue
data-mk: keep calendar OR add widget showing image+caption — reuse widget-campaign if no new mock
```

### 2.4 Content feat — stop implying auto-post

| Current | Target |
|---------|--------|
| `Maya posts in your voice` | `Maya drafts posts and captions in your voice` |
| `Scheduled and out without touching a tool` | `Queued for your approval — you choose when to publish` |

### 2.5 Competitors feat — live-narrower

| Current | Target |
|---------|--------|
| `Maya tracks what your competitors are running` | `Competitive reports grounded in your Foundation` |
| `Rival promotions flagged before they cost you` | `Weekly competitor briefings you can act on` |
| `Trends surfaced before they peak` | *(remove or move to Trend Spotter — don't conflate)* |

### 2.6 Agents bridge

| Current | Target |
|---------|--------|
| `nine agents in all` | `twelve specialist agents` |

Features sec-head: `Planned, drafted, scheduled and sent` → `Planned, drafted, and queued for your approval`.

### 2.7 Always-on layer — remove Reputation card

**Delete** “Reputation loops” `lcard` (~lines 277–284).

**Replace** with e.g. “Approval queue” card:

```
h3: Nothing goes live without you
p: Every post, email, and campaign artifact lands in your queue. Review, edit, approve — then publish when you're ready.
data-mk: widget-approvals (reuse approvals mock key if exists) OR widget-voice slot
```

Competitor watch card: `tracks your market` → `delivers competitive reports`.

### 2.8 FAQ — A2-aligned answers

Update these `FAQ_ITEMS` entries:

**Q: What exactly is Maya?**
> Agent7even is an AI marketing operating system — twelve specialist agents for campaigns, content, creative, SEO, and more. **Maya** is the interface: she coordinates the agents, drafts in your brand voice, and routes everything through your approval queue. Nothing publishes until you approve it.

**Q: What channels does Maya cover?**
> Social publishing supports Instagram, Facebook, LinkedIn, and X when you connect accounts. Email sequences are **drafted** for you to paste into your ESP (Mailchimp, Klaviyo, etc.). Google Analytics connects for performance reporting.

**Q: How is this different from a social media scheduling tool?**
> Scheduling tools post what you give them. Agent7even **plans, drafts, and generates** — campaigns, captions, images, and video — then queues it for your approval. You publish when ready.

**Q: How does the approval flow work?** — keep; already accurate.

Remove any FAQ implication that Maya sends email or answers reviews.

### 2.9 Footer + dark CTA

Footer: `The AI-first marketing platform` → `The AI marketing operating system for small business. Meet Maya.`

Dark CTA h2: OK as team metaphor; optional tweak: `Work like you have a full marketing team.` (drop “Because now you do” if it feels like over-claim)

### 2.10 Trust strip (Thread 5 — do in same pass)

**Remove** fake names (Ember Coffee, Field Goods, etc.).

**Replace** with honest framing, e.g.:
```
<p>Built for solo operators and small teams</p>
<div class="names">
  <span>3-day Starter trial</span>
  <span>Approval-first</span>
  <span>12 specialist agents</span>
</div>
```
*(No fabricated logos or customer names.)*

---

## 3. Homepage metadata (`app/page.tsx`)

```ts
title: 'Agent7even — Marketing that gets done without becoming your job'
description: 'AI marketing OS for small business — campaigns, content, images, and video drafted in your voice, approved by you. Powered by Maya and twelve specialist agents.'
```

---

## 4. Agents page (`app/lab5/agents/page.tsx`)

### 4.1 Page hero

| Current | Target |
|---------|--------|
| `Nine specialized agents` | `Twelve specialist agents` |
| sublead | `…live analytics, and Maya orchestrating them. Here's what each one does — and what runs automatically vs. what waits for your approval.` |

### 4.2 Analytics section — integration truth (A2 §5)

**Connected sources strip:** Do not imply all five are equally wired. Either:
- Label strip `Connect via Agent7even` and keep platforms as *available connections*, OR
- Trim to `Instagram · Facebook · LinkedIn · X` (publish-verified) + separate `Google Analytics` callout

**Performance overview feat — remove revenue attribution:**
| Remove | Replace with |
|--------|--------------|
| `email, and revenue — every connected channel` | `social and site analytics — connected channels in one place` |
| `Attribution that connects the post to the sale` | `Performance Digest turns numbers into next actions` |
| `Reach, engagement, and revenue across every channel` | `Reach, engagement, and traffic from connected accounts` |

Performance Digest copy: OK if framed as briefing from **connected** data; add caveat if no GA connected: insights depend on connections (optional footnote in body).

### 4.3 Maya orchestrator block

**Remove** bold claim: `Every draft also passes through her brand-voice review before it reaches you…`

**Replace with:**
> Maya isn't one of the twelve agents — she's the intelligence layer above them. She reads your goals and Foundation, decides which agents to run, and routes output to your approval queue. **Brand Voice Guardian** is a separate agent you can run when you want a dedicated tone check. You talk to Maya in plain language; she runs the team.

### 4.4 Section restructure — twelve real agents

**Rename section:** `The nine agents` → `The twelve agents`

**Remove entirely:** “Reputation & Follow-up” feat block (lines ~192–208) and `reputationQueue` mock reference.

**Replace “Weekly Content” feat** with **Content Posting** (registry id `content_posting`):

```
r-label: Content Posting
badge: Requires approval (NOT runs automatically)
h3: Posts, captions, and weekly plans — drafted in your voice.
body: Single posts with image-aware captions, or a full week of content. Generate images in your brand style or attach your own. Everything lands in your approval queue — nothing publishes until you say so.
checks:
  ✓ Writes captions with your image in context
  ✓ Generates on-brand images and short video
  ✓ Weekly content plans in one approval session
data-am: contentPlanner (reuse mock)
```

**Campaign Builder** — tighten plan boundary:
- `queues everything for your approval before a single thing goes out` → OK
- Add check: `Builds a 30-day plan — you produce assets from the plan when ready` *(not auto-fan-out)*

**Competitor Watcher** — live-narrower:
- `surfaces what your competitors promoted last week — channels, offers, messaging` → `delivers competitive reports from your Foundation and positioning — actionable briefings, not a live spy feed`
- Remove check: `Promotions, content, and positioning tracked weekly` → `Weekly competitive read you can respond to`

**“Five more agents” grid** — fix verbs + add missing agents:

| Agent | Fix copy | Badge |
|-------|----------|-------|
| Trend Spotter | `Trend **reports** for your niche, filtered for brand fit` — NOT “Monitors” | Runs automatically · Daily |
| SEO Scanner | `Scans your site and **advises** on fixes` — NOT “full audit/crawl” | Runs automatically · Weekly |
| Ad Variations | `Writes ad **variations to test**` — NOT “runs ads” | Requires approval |
| Email Sequence Builder | keep “ready to load into any ESP” | Requires approval |
| Performance Digest | keep | Runs automatically |

**Add two cards** to grid (12 total visible):

**Idea Analysis**
> Breaks one content idea into angles grounded in your Foundation — structured output for hooks and campaigns.
> Requires approval · On request

**Brand Voice Guardian**
> Reviews specific content against your Brand Kit — flags tone, vocabulary, and risky claims with suggested fixes.
> Runs automatically · On schedule or request

Grid section head: `Five more agents` → `Eight more specialists` *(or restructure as single 12-card grid — preferred for accuracy)*.

**Recommended layout:** One `agents-grid` with all 12 cards (autonomy badge on each). Drop “feat + five more” split; Agents page scored 8.5 because architecture is the hero — make the grid the centerpiece.

### 4.5 Agents metadata (`app/agents/page.tsx`)

```ts
description: 'Twelve marketing agents — campaigns, content, creative, SEO, email, and ads — orchestrated by Maya, with a real approval framework.'
```
Remove `reputation loops`.

---

## 5. Mockup JS

### `public/lab5/mockups.js`

- **Remove** all Google review rows (`New 4★ review`, `widget-reputation` review content).
- **Replace** `widget-reputation` with approval-queue mock (pending drafts, no reviews).
- Dashboard hero mock (`data-mk="dashboard"`): if it shows review reply, swap to approval queue / content draft rows only.

### `public/lab5/agent-mockups.js`

- **Delete** `reputationQueue` renderer entirely OR repoint `data-am="reputationQueue"` to a new `approvalQueue` mock.
- Update `competitorBoard` subtitle if it says “live tracking” → “Weekly report”.

---

## 6. Copy grep pass (before PR)

Run from repo root; **zero matches** on marketing files after edits:

```
rg -n "nine agents|Nine specialized|Nine agents" app/lab5 app/agents public/lab5
rg -n "review.*reply|Reviews answered|answers reviews|Reputation &" app/lab5 app/agents public/lab5
rg -n "she ships|Maya sends|scheduled and sent|runs ads|monitors live|revenue attribution|post to the sale" app/lab5 app/agents public/lab5 -i
rg -n "Runs automatically" app/lab5/agents/page.tsx  # must NOT appear on Content Posting / Weekly Content
rg -n "Ember Coffee|Field Goods|Atlas Studio" app/lab5
```

---

## 7. Definition of done

- [ ] `/` hero is OS-forward; Maya named in subhead (pink on name only).
- [ ] No review-reply claims on homepage or agents page (copy + mockups).
- [ ] No “nine agents” — twelve everywhere.
- [ ] No fictional Reputation agent (page section + mockups).
- [ ] Content Posting replaces Weekly Content on agents page; badge = **Requires approval**.
- [ ] Execute verbs fixed: drafts / reports / you publish — not sends, monitors live, runs ads.
- [ ] Creative capabilities visible on homepage (images, video, in-context captions).
- [ ] Analytics section does not claim revenue attribution.
- [ ] Trust strip has no fake customer names.
- [ ] `npm run build` passes (marketing pages only change — should be clean).
- [ ] Manual smoke: load `/` and `/agents` — read every section aloud against A2 claims table.

---

## 8. Spawn prompt (paste into Claude Code)

```
Execute phase_b_homepage_agents_handoff.md in agent7even-v2.

Rules:
- git remote -v must show agent7even-v2 before push
- Touch ONLY files in §1 manifest
- Every copy change must match a1_positioning_lock.md + a2_capability_ledger.md
- Do NOT edit credit/pricing/lib code
- Run §6 grep pass + build before done
- Do NOT commit phase_b_homepage_agents_handoff.md or a1/a2 audit docs
- Commit message when asked: "fix(marketing): align homepage and agents copy with A1/A2 truth"
```

---

## 9. Staged next (do not execute here)

**Pricing Phase B handoff** — draft after this lands; **execute only after** A3 verifies ledger rows (3cr image, 0 text, etc.).
