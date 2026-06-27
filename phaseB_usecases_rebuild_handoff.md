# Phase B — Use Cases Rebuild Handoff

**Status:** ready. Unblocked NOW (gates A1 + A2 locked; no credit-retune dependency).
**Repo:** `rovaneD/agent7even-v2`. `git remote -v` before push. v2/lab5.
**Gating docs:** `a1_positioning_lock.md` (§5 two-ICP), `a2_capability_ledger.md` (claims table).

**Important scope note:** Use-cases pages already received *overclaim cleanup* in the prior Phase B session (verbs fixed, "answers reviews" removed). That is DONE. This handoff is the *rebuild* — the structural A1 work that was never scoped. Different job. The pages are currently honest but still tell one story four times (scored 6.0, weakest after pricing).

---

## The problem this fixes

All four verticals (Ecommerce, Local Service, Creators, Agencies) currently follow the identical structure: "Tell Maya X → Maya creates campaign → you approve." A visitor learns nothing new per vertical and cannot self-identify. The marketing audit: "the same product pitch with different stock photos."

## The fix (A1 §5)

**Differentiate by which agents matter to which ICP — not by stock photo.** Each vertical leads with a *different agent stack* and a *different primary pain*, drawn only from `live` / `live-narrower` capabilities in A2. The page becomes "which business looks like yours?" — self-identification, not repetition.

---

## Step 0 — Recon
- `git remote -v`, branch, last commit.
- Map `app/lab5/use-cases/page.tsx` and `app/lab5/use-cases/[slug]/page.tsx`: structure, how the four verticals are defined (data array? per-slug?), where headlines/agent-lists/proof live.
- Report before editing.

## Step 1 — Per-vertical differentiation

Each vertical: a distinct primary pain + a distinct lead agent stack. **Every agent named must be real (12-agent registry) and every verb must match A2 boundaries** (reports/drafts/writes — not monitors-live/sends/runs).

### Local Service (the strongest vertical — lead the page with it)
- Primary pain (keep — audit called it the best headline on the site): *"The competitor across town isn't better. They're just more present."*
- Lead agent stack: SEO Scanner (live HTML scan), Competitor reports, Weekly Content / promotions, Performance Digest.
- NOT reviews (roadmap — do not surface). NOT "monitors live."

### Ecommerce
- Primary pain: going quiet between launches; visibility cadence.
- Lead agent stack: Campaign Builder (launch plans), image + video generation (this ICP is media-heavy → ties to ProAgent premium tier), Weekly Content, Competitor reports.
- This is the media-heavy ICP — surface the creative-generation capability hardest here.

### Creators
- Primary pain: can't scale yourself; content consistency is the ceiling.
- Lead agent stack: Weekly Content (cadence), image/video generation, Trend reports, Campaign Builder (launches/offers).
- Different emotional register from SMB — audience growth + consistency, not "competitor across town."

### Agencies
- Primary pain: production capacity without hiring.
- Lead agent stack: Campaign Builder + content/ad-variation production at volume, approval framework (client control).
- **CONSTRAINT — do not overclaim agency features.** Multi-client workspaces, white-label, team permissions, separate client approvals **do not exist in the product** (recon: no multi-tenant client management). Do NOT imply them. Frame agencies around *production capacity* (writing/drafting volume) which is real — not *client management* which is not built.
- The agency packaging gap (multi-client/white-label/team) is a flagged roadmap+pricing decision, NOT to be resolved in marketing copy. See §3.

## Step 2 — Structure & IA
- Reframe the page entry from "Same Maya, four jobs" → **"Which business looks most like yours?"** (self-identification).
- Information architecture: A1 notes buyers ask "is this for me?" before "how does it work?" — if the site nav order is Homepage → Agents → Use Cases, that's acceptable, but the Use Cases page itself should let a visitor self-select fast (vertical picker up top).
- Each vertical's proof/outcome label = engagement outcomes (reach, followers, DMs, visibility) — NOT revenue attribution (A2 §5: no commerce integration).

## Step 3 — Definition of done
- [ ] Recon map produced; edits bound to real files.
- [ ] Each of 4 verticals leads with a DIFFERENT agent stack + DIFFERENT primary pain — no longer one story four times.
- [ ] Every named agent is in the 12-agent registry; every verb matches A2.
- [ ] Reviews not surfaced anywhere (roadmap). No "monitors live," "sends," "runs ads."
- [ ] Agencies framed on production capacity only; NO multi-client/white-label/team-permission claims.
- [ ] Media generation surfaced hardest on Ecommerce + Creators (media-heavy ICP).
- [ ] Outcome labels = engagement, not revenue.
- [ ] Entry reframed to self-identification.
- [ ] Live render verified (localhost + deployed). `npm run build` clean.
- [ ] Performance-theater check: every claim maps to a backed A2 row.

## §3 — Flagged for roadmap/backlog (NOT this handoff)
Agency multi-client / white-label / team-permissions / separate-client-approvals: real product + pricing question, product does not support it today. Capture in MAYA_CONTEXT backlog. If pursued, it's a product build upstream of marketing — do not pre-sell it on the use-cases page. The pricing audit also flagged the missing agency/enterprise tier; that pairs with this decision.
