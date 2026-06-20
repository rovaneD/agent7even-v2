# SESSION_2026-06-20 — Creative image generation v1

*Experimental v2 (`rovaneD/agent7even-v2`). Shipped `634c53a` on `main`.*

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
| 8 Calibrate empirical floor | ✅ **70%** — `scripts/calibrate-generation-floor.ts` |
| 9 Staging flag | ✅ Preview branch `feature/image-context-v1-verify`; Production `false` |

---

## §10 verification gates

| Gate | Status |
|------|--------|
| Weak Foundation blocked server-side | ✅ Position 48% → 403 (local script) |
| Strong Foundation allowed | ✅ Agent7even + 85% profile |
| QA / compose auth validation | ✅ local gate scripts |
| Manual happy path (local) | ✅ generate → QA → compose → approve → Posts |
| One 25-credit ledger row | ✅ |
| CI on `main` | ✅ GitHub Actions run 27859612961 |
| Production flag OFF | ✅ prod `POST /generate-images` → 404 (disabled) |
| Preview flag ON | ✅ preview routes return 401 unauth (live, not 404) |
| Upload path unchanged | ⚠️ Manual on preview (deployment protection blocks Bearer script smoke) |

---

## Deploy

| Target | URL | Flag |
|--------|-----|------|
| Production (`main`) | https://agent7even-v2.vercel.app | OFF |
| Preview staging | https://agent7even-v2-717xq7zyg-rovane-dursos-projects.vercel.app | ON (`feature/image-context-v1-verify` @ `634c53a`) |

**Manual preview smoke:** sign in → Agents → Single post → **Generate 3 options** visible; also test upload + Run path.

---

## Vercel env (applied)

```bash
vercel env add NEXT_PUBLIC_IMAGE_GENERATION preview feature/image-context-v1-verify --value true --yes --force
vercel env update NEXT_PUBLIC_IMAGE_GENERATION production --value false -y
```

---

## UX fixes (same session)

- After **Submit for approval** → auto-navigate to Approvals `?task=…&queue=post`
- **Posts** page banner when pending post approvals exist
- Approvals uses **newest** `agent_outputs` row per task

---

## Next

- Manual preview smoke (generate + upload paths)
- When staging passes → consider Production flag (affects www.agent7even.ai)

*Session: June 20, 2026*
