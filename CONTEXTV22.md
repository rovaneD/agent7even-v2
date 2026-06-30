# CONTEXTV22 — SEO Scanner URL safety
*Snapshot: June 30, 2026 — supersedes `CONTEXTV21.md` only for SEO Scanner website URL safety. Marketing homepage/channel state remains in `CONTEXTV21.md`.*

---

## Critical fix — SEO Scanner public URL validation

Recent SEO Scanner changes added direct server-side fetching of the profile/override website URL. That fetch path now requires a public `http(s)` website URL before any server request is made.

**Files:**
- `lib/security/publicWebsiteUrl.ts` — validates normalized website URLs, blocks localhost/private/reserved IPs, local/internal hostnames, credentialed URLs, and DNS names resolving to non-public IPs.
- `lib/agents/flows.ts` — validates SEO Scanner fetch targets, follows redirects manually with validation at each hop, and caps HTML downloads at 1 MB.
- `app/api/settings/update/route.ts` — rejects unsafe website URLs before saving to `profiles.website_url`.
- `scripts/verify-public-website-url.ts` — focused regression checks for malformed schemes and private/local address forms.

**Trigger that is now blocked:** a logged-in user saving or submitting a website URL such as `http://127.0.0.1`, `http://169.254.169.254/latest/meta-data`, `http://[::1]/`, or a local/internal hostname for an SEO Scanner run.

**Validation performed:** `npx tsx scripts/verify-public-website-url.ts`, `npx tsc --noEmit`, and `npm run build`.

---

## Related docs

- `CONTEXTV21.md` — lab5 marketing homepage hero, FAQ/agents channels, mobile mockup fixes.
- `CONTEXTV20.md` — Content Posting UX, Creative Direction cache.

---

*End CONTEXTV22 — June 30, 2026*
