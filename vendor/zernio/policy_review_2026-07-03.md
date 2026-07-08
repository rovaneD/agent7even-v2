# Zernio Trust Center policies — review vs Agent7even questionnaire (Jul 3, 2026)

Source: 25 PDFs in `~/Volumes/Black 10TB/Agent7even Update/Zernio/zernio_policies_2026-07-03/`

**Caveat:** CompAI-generated SOC 2 template pack. Company placeholder is **"Late"**, not ARBICHAT/Zernio. Repeated infra: Vercel, Cloudflare, MongoDB, **North America** (conflicts with Elean email "Europe" and SOC 2 GCP — treat SOC 2 + DPA as authoritative).

---

## Policy relevance (which PDFs matter for our 6 questions)

| Priority | Policy file | Helps with |
|----------|-------------|------------|
| **High** | `incident_response_breach_notification.pdf` | Q3 breach timelines (GDPR 72h) |
| **High** | `vendor_third_party_risk.pdf` | Q3, Q4, Q2 (off-boarding, DPA, subprocessors) |
| **High** | `retention_secure_disposal.pdf` | Q2, Q5 (retention/disposal framework) |
| **High** | `privacy_data_subject_rights.pdf` | Q5 (processing activity record / ROPA) |
| **Medium** | `data_classification_handling.pdf` | Q5 (PII classification) |
| **Medium** | `information_sharing_transfer.pdf` | Q4 (SCCs, transfer log) |
| **Low** | `access_control_least_privilege.pdf` | Internal RBAC only — **not** Q1 API tenant isolation |
| **Low** | All others | General SOC 2 posture; no integration-specific answers |

**No policy answers Q6** (headless OAuth scope / reconnect API signal).

---

## Q1 — Tenant isolation (master key + profileId)

**Status: NOT ANSWERED by policies.**

`access_control_least_privilege` covers employee JML/RBAC and "service accounts with restricted scopes" — internal ops, not multi-tenant API isolation.

**Still need email:** server-side profileId enforcement, scoped API keys as product feature, master-key compromise blast radius.

**Prior email (Elean, 15 Jun):** profileId scoping recommended; optional scoped keys "in your backend" — insufficient for written gate.

---

## Q2 — DELETE /profiles/{id} data deletion

**Status: PARTIAL.**

| Source | Timeline / method |
|--------|-------------------|
| `retention_secure_disposal` | Over-retention flagged → disposal queued within **30 days** |
| `vendor_third_party_risk` (off-boarding) | Revoke tokens within **48h**; certificate of destruction |
| Elean email (15 Jun) | Disconnect grace **~1 hour** |

**Gap:** No mapping to `DELETE /profiles/{id}` or per-data-type purge (DMs, comments, analytics cache, inbox).

---

## Q3 — Breach notification

**Status: MOSTLY ANSWERED (policy); contact still missing.**

`incident_response_breach_notification`:
- Notify management immediately for personal/regulated data
- **GDPR 72 hours** to authorities (example timeframe)
- Communications Lead + legal for external statements
- 24×7 incident roster

`vendor_third_party_risk` (processor obligations template): notify controller **without undue delay**

**Gap:** Named email/contact for Agent7even as controller.

---

## Q4 — Sub-processors

**Status: PARTIAL (framework only).**

`vendor_third_party_risk`:
- Prior written authorization for subprocessors
- Vendor inventory with processing locations
- SCCs / transfer mechanisms
- Notify of new subprocessors (contractual template)

**Actual list:** SOC 2 report + Trust Center — not in policy PDFs.

---

## Q5 — Processing schedule

**Status: PARTIAL.**

`privacy_data_subject_rights`:
- Processing-activity record (categories, purposes, lawful bases, recipients, transfers)
- Public Privacy Notice with categories and retention

**Gap:** No social-integration-specific annex (OAuth tokens, DM/comment content, follower analytics). Check DPA + zernio.com Privacy Notice.

---

## Q6 — OAuth scope API signal (headless)

**Status: NOT ANSWERED.**

---

## Policies with no material value for our open items

acceptable_use, authentication_password, background_screening, backup_bcdr, change_release, compliance_regulatory, encryption, information_security_governance, logging, physical_security, policy_management, remote_access, risk_management, sanctions, secure_configuration, secure_sdlc, security_awareness, vulnerability_patch — general hygiene only.

---

## Recommended follow-up (4 items only)

See `followup_email_to_zernio_2026-07-03.md`.
