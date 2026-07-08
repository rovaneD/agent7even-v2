# Follow-up email to Zernio — trimmed (Jul 3, 2026)

**To:** Ana / Elean (existing support thread)  
**Subject:** Trust Center + security questionnaire — 4 items still open for client onboarding

---

Hi Ana / Elean,

Thanks for the Trust Center access. I've reviewed the 25 policy documents, submitted our security questionnaire through the portal, and signed/accepted the DPA via Trust Center (or attached PDF Jul 2 — please confirm which record is authoritative).

The policy library and questionnaire AI pre-fill helped on breach notification (GDPR 72h framework) and sub-processor/retention processes. Four integration-specific items are still open before we onboard paying customers' live social accounts on Agent7even (white-label, master API key + profileId scoping):

**1. Tenant isolation (highest priority)**  
Elean confirmed profileId scoping on 15 Jun. Please confirm in writing for our security review: (a) server-side enforcement that our master API key cannot access another tenant's profiles/accounts/posts/inbox without a valid profileId; (b) whether Zernio offers per-tenant scoped API keys as a documented product feature; (c) blast radius and revocation process if our master key is compromised.

**2. DELETE /profiles/{id} — data map**  
Your retention/off-boarding policies reference disposal within 30 days and token revocation within 48h; email on 15 Jun referenced ~1 hour for disconnections. For `DELETE /profiles/{id}`, please confirm which data types are permanently deleted (OAuth tokens, scheduled posts, analytics cache, DMs, comments, inbox) and the timeline for each.

**3. Breach notification contact**  
Incident Response policy references GDPR 72h and a Communications Lead. Who is the designated contact for Agent7even as data controller (email/role)?

**4. Headless OAuth — insufficient scopes**  
For API integrations without Zernio UI, which response field or error code indicates missing scopes (e.g. instagram_business_basic) so we can show "reconnect needed" instead of silent empty analytics?

We've already implemented your Jun 10–12 analytics guidance (accountId scoping, platformPostUrl, 429 backoff). Sub-processors and processing categories we'll treat from SOC 2 + Trust Center unless you flag gaps.

Thanks,  
Rovane  
Agent7even — www.agent7even.ai
