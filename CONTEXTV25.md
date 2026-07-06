# CONTEXTV25 — Foundation knowledge in agent context, team workspace hardening
*Snapshot: July 6, 2026 — supersedes `CONTEXTV24.md` for logged-in product work*

Session log: `SESSION_2026-07-06.md`.

---

## Repository state

```txt
Local workspace: /Users/durso/agent7even-v2-clean
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: main
Latest remote: 935036e (Foundation polish, team-safe APIs, Memory observations)
This session: Foundation V2 Piece 3 + team guards — commit pending
Prior handoff: CONTEXTV24 (July 4)
```

**Deploy workflow:** push directly to `main` → Vercel auto-deploys.

Before every push: `git remote -v` must show `rovaneD/agent7even-v2`.

---

## What changed since CONTEXTV24 (index)

| Area | Doc |
|------|-----|
| Foundation theme policy + Guardian calibration | **§1** |
| Maya team context (Phase 4) | **§2** |
| Foundation Memory + observations UI | **§3** |
| Foundation V2 Piece 3 — knowledge in agent/Maya context | **§4** |
| Team workspace hardening (API guards, generation floor) | **§5** |
| Ship validation scripts | **§6** |

---

## 1. Foundation Intelligence — theme policy + calibration

**Theme policy:** `lib/foundation/proposals/proposalThemePolicy.ts` — blocks proposals whose theme matches an approved layer; 30-day reject cooldown; 14-day defer cooldown.

**Guardian:** `MIN_SURFACE_CONTRADICTING = 6` (≥6 supporting rows → surface contradicting clusters; below → hold). Stale pending auto-dismiss via `dismissStalePendingProposals.ts`.

**Calibration:** `scripts/calibrate-guardian-thresholds.ts` — on Agent7even data, holds thresholds at 3/3/4; 100% approve rate on 2 decided surfaced proposals.

**Verify:** `scripts/verify-foundation-theme-policy.ts`, `scripts/verify-relevance-gradient.ts`.

---

## 2. Maya team context (Phase 4)

**Module:** `lib/maya/summaries/workspaceTeamContext.ts`

**Wired into:** `app/api/maya/chat/route.ts`, `lib/agents/buildAgentContext.ts` (with `actor_profile_id`).

**Provides:** pending approvals count, open assignments, member attribution — so Maya can answer “what’s waiting on me?” for owners and members.

**Phase 5 (not started):** task threads / shared chat — spec says evaluate after Phase 1–4 + feedback.

---

## 3. Foundation Memory + observations

**API:** workspace-scoped memory load via `resolveFoundationWorkspaceForClerkUser`.

**UI:** Foundation Hub Memory tab — “What Maya has noticed” from changelog observations (`changelogHubObservations.ts` filters dev probes).

---

## 4. Foundation V2 Piece 3 — knowledge in context

**Purpose:** Owner-confirmed `foundation_knowledge.confirmed_fields` now reach agents and Maya as a **reference layer** (not Phase 1 identity).

| Piece | Path |
|-------|------|
| Load + format | `lib/foundation/knowledgeContext.ts` |
| Agents | `lib/agents/buildAgentContext.ts` — after site snapshot, before Observer |
| Maya | `app/api/maya/chat/route.ts` — parallel load, inserted after Foundation section |

**Merge order (agents):** Client → brand docs → Foundation docs → site snapshot → **uploaded knowledge** → Observer → layers → memory → team context.

**Copy rule:** Phase 1 Foundation remains anchor; knowledge enriches output only.

---

## 5. Team workspace hardening

| Route | Fix |
|-------|-----|
| `POST /api/integrations/zernio/connect` | `requireWorkspaceOwner` + `resolveWorkspaceClerkProfile` — members cannot connect social accounts |
| `GET /api/foundation/generation-floor` | `resolveFoundationWorkspaceForClerkUser` — members check owner workspace floor |
| Foundation memory/knowledge/ingest APIs | Workspace-scoped (prior commit `935036e`) |
| GA connect | Owner guard already in place |

---

## 6. Ship validation

**Script:** `scripts/validate-ship-checkpoint.ts` — 9 checks (theme policy, stale dismiss, contradiction filter, calibration, memory, **knowledge format**, owner/member team context).

**Run:**

```bash
FOUNDATION_GUARDIAN_PROFILE_ID=bfa73081-3906-4b5b-b24e-d9df3fb07384 \
  npx --yes tsx --env-file=.env.local scripts/validate-ship-checkpoint.ts
```

**Agent7even result (July 6):** 9/9 passed · 4 knowledge rows formatted for agents + Maya.

---

## Known open items

| Item | Notes |
|------|--------|
| Foundation V2 Piece 2 | Upload classification pipeline — not started |
| Team Phase 5 | Task threads — after feedback on Phase 4 |
| Hub rescore field-score refresh | Open since June |
| Zernio DPA scoped keys | External blocker — unchanged from CONTEXTV22 §8 |
| Manual browser checks | Owner/member Maya prompts; member agent → owner approval queue |

---

## Do not revert

- All CONTEXTV24 “do not revert” items.
- Theme policy reject/defer cooldowns and approved-layer blocks.
- Knowledge as reference-only layer — must not override Phase 1 Foundation in prompts.
- Owner-only integration connects (GA, Zernio).
- Workspace resolution for Foundation APIs (`resolveFoundationWorkspaceForClerkUser`).

---

## Related docs

| Doc | Role |
|-----|------|
| `CONTEXTV24.md` | July 4 handoff (email, proposals, layers v0) |
| `SESSION_2026-07-06.md` | This session log |
| `foundation_intelligence_vision.md` | Vision + build sequence |
| `AGENTS.md` | Product rules + deploy |

---

*End CONTEXTV25 — July 6, 2026*
