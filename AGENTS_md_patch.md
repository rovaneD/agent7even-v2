# AGENTS.md patch - Buffer / social-scheduling rule
*Apply now. Snapshot: June 4, 2026.*

In AGENTS.md, under "Key third-party notes", REPLACE this stale line:

> - **Buffer** - do NOT attempt OAuth integration. Buffer stopped accepting new developer
>   OAuth registrations as of 2026. Use Later or Publer for social scheduling instead.

WITH:

> - **Social scheduling** - Buffer is OUT for multi-tenant publishing (verified June 4,
>   2026): legacy REST OAuth is closed to new developer app registrations (no new client_id),
>   and the new GraphQL API is personal-key-only beta with no third-party end-user OAuth.
>   Publer is dashboard-first, also not a multi-tenant fit. Leading candidate is **Zernio**
>   (multi-tenant OAuth-as-a-service, white-label, per-account pricing, publish/fail
>   webhooks) - pending verification (tenant isolation [open], cost caps [answered], support/
>   reliability, data-handling/DPA) and gated behind the Exa pre-fill value test. Build behind
>   a swappable `lib/social/publisher.ts` interface. Do NOT attempt Buffer OAuth. Details in
>   zernio_social_evaluation_backlog.md.

Leave the Instagram Lucide icon note unchanged.
