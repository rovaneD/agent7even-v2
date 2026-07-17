# CONTEXTV29 — Analytics consent enforcement
*Snapshot: July 17, 2026 — supersedes `CONTEXTV28.md`*

---

## Repository state

```txt
GitHub: rovaneD/agent7even-v2
Vercel: agent7even-v2.vercel.app
Branch: cursor/critical-bug-investigation-8d97
Fix commits: cdfba72, c601ea3
Prior handoff: CONTEXTV28 (July 13 codebase audit)
```

---

## Critical bug fixed

Commit `de18cee` made every `trackEvent()` call send a named behavioral event to
Vercel Web Analytics regardless of the cookie banner choice. That contradicted
the privacy policy, which permits only aggregated cookieless page views before
consent or after rejection. The GA path also trusted the presence of
`window.gtag` instead of the current consent value, so a tab that had loaded GA
could continue tracking after another tab stored a rejected choice.

### Fix

- `lib/gtag.ts` now requires an accepted analytics choice before sending named
  events to either Vercel or GA. The root `<Analytics />` page-view integration
  remains unchanged.
- `ConsentAwareAnalytics` listens for cross-tab `storage` changes and updates
  GA consent to `granted` or `denied` when a choice changes.
- `CookieConsentBanner` synchronizes its state across tabs.
- Consent storage reads fail closed. Storage write failures no longer prevent
  the current-page choice event or make the banner impossible to dismiss.
- `tests/analytics-consent.test.ts` locks in rejected/unset event suppression,
  accepted event delivery, and blocked-storage behavior.

### Validation

```bash
npm run test:consent  # 2/2 pass
npx tsc --noEmit      # pass
npm run build         # pass, 216 static pages generated
```

---

## Carry-forward

The open product and environment checks in `CONTEXTV28.md` remain unchanged:
decide whether to link `/dashboard/ai-toolkit`, confirm the production video
webhook and credit price environment variables, and complete live Stripe and
first-customer Zernio QA.
