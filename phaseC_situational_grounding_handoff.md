# Phase C — Situational Grounding (Thread 7 Layer 1) Handoff

**Status:** shipped (Agents, Foundation, Posts, Settings form, Analytics connect modals)  
**Layer 2 (write/actuation):** not built — chat remains text-only

---

## Problem

Audit screenshot: SEO Scanner — Maya asked for website URL while the URL field was visible on canvas. Root cause: page context described Agents generically, not the **open setup form values**.

---

## Shipped

### Agents Command Center
`AgentCommandCenter.tsx` — when an agent setup panel is open, `useMayaContext` payload includes:

- `activeView.label` — e.g. `SEO Scanner setup form`
- `activeView.state` — filled field values inline; empty fields listed as “Empty on screen”
- `affordance` — instructs Maya to use on-screen values, not re-ask

Applies to **all 12 guided agents**, not SEO alone.

### Foundation Hub + Editor
Section edit forms bind live field values via `buildFoundationHubMayaContext` / `FoundationEditor`.

### Posts compose
`PostsClient.tsx` — compose drawer binds caption/platform state.

### Settings (June 10)
`SettingsClient.tsx` + `buildSettingsMayaContext(profile, form)` — live company, website, Instagram, and email-pref toggles; unsaved-changes flag.

### Analytics connect flows (June 10)
`AnalyticsClient.tsx` + `buildAnalyticsConnectActiveView` — Connect panel, GA connect modal, and property selector override `activeView` when open.

### Campaign creation (June 10)
`GuidedCampaignFlow.tsx` + `OpenCanvasFlow.tsx` — step selections and open-canvas draft/chat bound via `buildGuidedCampaignMayaContext` / `buildOpenCanvasCampaignMayaContext`.

### Service inquiry (June 10)
`InquiryForm.tsx` — all three steps of scoped design/dev inquiry form bound via `buildServiceInquiryMayaContext`.

---

## Layer 2 backlog

Maya chat has no tool/actuation channel (`/api/maya/chat` = `streamText` only). Writing form fields from chat requires new API design + approval gate — see `phaseC_dashboard_cold_open_handoff.md` write-path recon.

---

## Follow-on (optional)

- Explainability pass per `per_screen_registry.md` remaining column.
- Bind form state on any new canvases using same `activeView` pattern.
