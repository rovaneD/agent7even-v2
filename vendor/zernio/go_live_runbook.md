# Zernio go-live runbook — paying customer social connect

*Updated July 9, 2026 · Clearance: `go_live_clearance_2026-07-08.md`*

## Preconditions (confirmed)

- [x] DPA executed both sides (Trust Center, Jul 2026)
- [x] Zernio cleared **paying customer** live social accounts (Elean, Jul 8, 2026)
- [ ] Written tenant-isolation / scoped-key answers in chat (non-blocking for first pilot)

## Before first paying customer connects

1. **Env** — Production has `ZERNIO_API_KEY`, OAuth redirect URLs for `app.agent7even.com` (or v2 preview if piloting there).
2. **Owner-only connect** — Confirm team member cannot hit `POST /api/integrations/zernio/connect` (guard in place).
3. **Readiness script** — run locally or in CI smoke:
   ```bash
   npx --yes tsx --env-file=.env.local scripts/verify-zernio-go-live-readiness.ts
   ```
4. **Cost cap** — Stripe spending limit on Zernio dashboard as backstop.
5. **Disclosure** — Meta OAuth may show Zernio shared app (“Social Media Connector”); acceptable for v1 per `PRODUCTION_GREENLIGHT.md` §9.2.

## First customer connect (owner flow)

1. Owner → **Analytics** → Connect social (Zernio OAuth).
2. Verify `profiles.zernio_profile_id` populated for workspace owner row.
3. Publish test draft via **Posts** or approve a content-posting agent output → confirm draft appears in Zernio + Posts lifecycle bar.
4. Check `zernio_usage_log` (if enabled) for tenant-scoped calls under correct `userId`.

## Rollback

- Owner → Analytics → Disconnect (calls `disconnectAllZernioProfiles`).
- Stripe subscription cancel webhook also disconnects Zernio profiles.

## Still internal / QA only

- Free-tier Zernio accounts without paid Agent7even subscription — use for dev smoke only.
- Do not bypass `lib/social/publisher.ts` with direct Zernio calls from routes.

## References

- `vendor/zernio/go_live_clearance_2026-07-08.md`
- `zernio_social_evaluation_backlog.md`
- `scripts/verify-zernio-tenant-fixes.ts` — cross-tenant regression
- `PRODUCTION_GREENLIGHT.md` §9.2
