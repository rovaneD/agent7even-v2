# Phase C — Situational Grounding (Thread 7 Layer 1) Handoff

**Status:** shipped (Agents Command Center)  
**Layer 2 (write/actuation):** not built — chat remains text-only

---

## Problem

Audit screenshot: SEO Scanner — Maya asked for website URL while the URL field was visible on canvas. Root cause: page context described Agents generically, not the **open setup form values**.

---

## Shipped

`AgentCommandCenter.tsx` — when an agent setup panel is open, `useMayaContext` payload includes:

- `activeView.label` — e.g. `SEO Scanner setup form`
- `activeView.state` — filled field values inline; empty fields listed as “Empty on screen”
- `affordance` — instructs Maya to use on-screen values, not re-ask

Applies to **all 12 guided agents**, not SEO alone.

---

## Layer 2 backlog

Maya chat has no tool/actuation channel (`/api/maya/chat` = `streamText` only). Writing form fields from chat requires new API design + approval gate — see `phaseC_dashboard_cold_open_handoff.md` write-path recon.

---

## Follow-on (optional)

- Bind form state on other canvases (Foundation editor, Posts compose drawer) using same `activeView` pattern.
- Settings website field, Analytics connect flows.
