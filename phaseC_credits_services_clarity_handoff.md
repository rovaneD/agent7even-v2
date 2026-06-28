# Phase C — Credits + Services Clarity Handoff

**Status:** shipped (first slice) — June 10, 2026  
**Gates:** A3 credit retune (live) · pricing page media framing (Phase B done)  
**Prior slices shipped:** dashboard cold-open · IA regroup · asset lifecycle · Thread 7 Layer 1 (Agents, Posts, Foundation)

---

## Problem (571-page audit · Thread 2)

Pricing reframed credits on the marketing site, but logged-in surfaces still said generic “credits,” didn’t explain **media-only** metering, and **Services** didn’t define human-delivered **service requests** vs AI usage.

---

## Shipped (this slice)

### `lib/plans.ts`

Shared helpers: `PLAN_MEDIA_CREDITS`, `PLAN_SERVICE_REQUESTS`, `PLAN_MEDIA_EXAMPLES`, `getPlanMediaCredits`, `getServiceRequestLimit`, `getMediaAllowanceExample`.

### `components/dashboard/PlanUsageCallout.tsx`

Two-column callout: media credits balance/pool + examples; service request slots with plain-language definition.

Surfaces on:
- **Dashboard** — below content lifecycle bar
- **Services** — below hero (compact)

### Copy alignment

- **MorningDigest** stat pill: “Credits” → “Media credits”
- **BillingClient** plan feature bullets: media credits wording, 12 agents, unlimited text note on Starter
- **ServicesClient** hero: defines service requests vs self-serve / AI

---

## Do not revert

- “Unlimited” for text/chat/campaigns on paid plans — matches A3 economics.
- Service requests described as human-delivered, not credit-metered.

---

## Backlog (Phase C remaining)

| Item | Status |
|------|--------|
| Thread 7 Layer 2 (Maya form actuation) | Deferred — needs product/API design |
| Settings / Analytics connect grounding | **Shipped** — see `phaseC_situational_grounding_handoff.md` |
| Campaign / inquiry form grounding | **Shipped** — guided, open canvas, service inquiry |
| `per_screen_registry.md` | **Shipped** — June 10, 2026 |
| Stale digest regenerate after approval-query fix | Optional ops |
| Explainability pass (per-screen) | Next — use registry as checklist |

## Open product decisions (unchanged)

ProAgent rename · trial-on-all-plans · Starter→Growth non-volume lever — **decisions pending**, not in scope.

---

## Verification

```bash
npx tsc --noEmit
# Dashboard: plan usage callout visible for paid account
# Services: hero + callout explain service requests
# Billing: feature bullets say media credits / 12 agents
```
