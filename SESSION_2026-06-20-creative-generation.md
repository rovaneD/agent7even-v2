# SESSION_2026-06-20 — Creative image generation v1

*Experimental v2 (`rovaneD/agent7even-v2`). Uncommitted on `main` at session end.*

---

## §9 build order status

| Step | Status |
|------|--------|
| 1 Foundation gate (`sections.ts`, `sectionStrength.ts`) | ✅ |
| 2 Generate route — 3 options | ✅ |
| 3 Pick UI | ✅ |
| 4 Text-QA gate | ✅ |
| 5 Caption with image in context | ✅ |
| 6 Insert `pending_approval` | ✅ |
| 7 Bundled 25-credit charge | ✅ |
| 8 Calibrate empirical floor | ✅ **70%** — see `scripts/calibrate-generation-floor.ts` |
| 9 Staging flag | ⚠️ Local only — Vercel Preview needs manual env add (below) |

---

## §10 verification gates

| Gate | Status |
|------|--------|
| Weak Foundation blocked server-side | ✅ `verify-generation-floor-http.ts` — Position 48% → 403 |
| Strong Foundation allowed | ✅ Agent7even + 85% profile → 200 |
| QA gate auth/validation | ✅ `verify-generate-images-qa.ts` |
| Compose auth/validation | ✅ `verify-generate-images-compose.ts` |
| Approvals API reachable | ✅ `verify-generate-images-happy-path.ts` |
| Manual happy path (generate → pick → QA → compose → approve → Posts) | ✅ Agent7even — Jun 20 session |
| One 25-credit ledger row | ✅ User confirmed |
| Approve → Zernio draft on Posts | ✅ User confirmed after approval |
| Upload path unchanged | ⚠️ Quick regression not re-run this session |

---

## Step 8 — floor calibration (70%)

Ran `scripts/calibrate-generation-floor.ts` against paid profiles with field scores:

- **Agent7even** — ALLOW (C83 P84 V80) — manual happy path passed
- **294c0d57** — BLOCK at Position 48%
- Pass rate at 70%: 1/2 scored paid profiles (expected — per-section gate, not global)

Decision: keep `GENERATION_SECTION_FLOOR = 70` in `lib/foundation/sectionStrength.ts` (documented in constant comment).

---

## Step 9 — Vercel Preview flag (manual)

`NEXT_PUBLIC_IMAGE_GENERATION` is **not** on Vercel Preview yet. CLI requires branch targeting — run from repo root:

```bash
# All Preview deployments (recommended for staging validation)
vercel env add NEXT_PUBLIC_IMAGE_GENERATION preview --value true --yes

# Or target a feature branch explicitly
vercel env add NEXT_PUBLIC_IMAGE_GENERATION preview design-system/color-tokens --value true --yes
```

Keep **Production** `false` until full §10 pass on staging. Redeploy Preview after adding.

---

## UX fixes (same session)

- After **Submit for approval** → auto-navigate to Approvals `?task=…&queue=post`
- **Posts** page banner when pending post approvals exist
- Approvals uses **newest** `agent_outputs` row per task

---

## Next

1. Commit generation work to `agent7even-v2` (confirm `git remote -v`)
2. Push → Preview deploy with flag on
3. Staging smoke: block case, happy path, upload regression
4. Production flag stays off until staging gates pass

---

*Session: June 20, 2026*
