# CONTEXT.md Versioning Rule

Every time there is a significant shift in concept, architecture, or product direction — create a new version.
Name files sequentially: CONTEXT.md → CONTEXTV2.md → CONTEXTV3.md → CONTEXTV4.md → CONTEXTV5.md etc.
Each version is never edited retroactively — it's a snapshot of where the product stood at that moment.

---

# CONTEXTV6 — v2 Experimental Project Setup
*Snapshot: May 27, 2026*

## What This Repo Is
This is the **experimental v2** of the Agent7even app. It was forked from `agent7even-app` at commit `15c3f01` and is where new platform features are prototyped before being merged into production.

## Repo Identity (CRITICAL)
This file lives in the **EXPERIMENTAL v2** repo.

| | Production | Experimental v2 |
|---|---|---|
| Local | `~/agent7even-app/` | `~/agent7even-v2-clean/` |
| GitHub | `rovaneD/agent7even-app` | `rovaneD/agent7even-v2` |
| Vercel | `app.agent7even.com` | `agent7even-v2.vercel.app` |
| Branch | `main` | `main` |

**Before every push: run `git remote -v` and confirm it shows `agent7even-v2`, never `agent7even-app`.**

## What v2 Has Built (Beyond CONTEXTV5 Baseline)

### Maya — AI Marketing Agent Chat
- Route: `/maya`
- `MayaShell.tsx` — full chat UI, streaming responses, brand context awareness
- API: `/api/maya/chat` — connects to Claude via OpenRouter, uses user's profile/brand data as system context

### Agent Command Center
- Route: `/dashboard/agents`
- `AgentCommandCenter.tsx` — live activity feed, approval queue, agent scorecard, run-an-agent form

### Agent Registry (`lib/agents/registry.ts`)
9 agents defined with models, autonomy levels, and default schedules:

| Agent | Autonomy | Model |
|---|---|---|
| competitor_watcher | autonomous | gemini-2.5-flash |
| content_writer | approval_required | claude-haiku-4 |
| campaign_builder | approval_required | claude-sonnet-4 |
| analytics_reader | autonomous | gemini-2.5-flash |
| trend_spotter | autonomous | gemini-2.5-flash |
| email_sequence_builder | approval_required | claude-sonnet-4 |
| ad_copy_generator | approval_required | claude-haiku-4 |
| seo_scanner | autonomous | claude-sonnet-4 |
| brand_voice_guardian | autonomous | claude-haiku-4 |

### Agent Runner (`lib/agents/runner.ts`)
- `createTask` — inserts into `agent_tasks`
- `updateTaskStatus` — updates status, timestamps
- `saveAgentOutput` — inserts into `agent_outputs`

### API Routes
- `POST /api/agents/tasks/create`
- `GET /api/agents/tasks`
- `POST /api/agents/tasks/[id]/approve`
- `POST /api/agents/tasks/[id]/reject`
- `GET /api/agents/outputs`
- `POST /api/agents/content-writer`
- `POST /api/agents/run/campaign-builder`
- `GET /api/cron/run-scheduled-agents` — fires hourly via Vercel cron

### Supabase Tables (already migrated)
```sql
agent_tasks      — task queue with status, approval, scheduling
agent_outputs    — agent-generated content with approval status
agent_schedules  — per-user schedule config (frequency, day/hour)
```
Both `agent_tasks` and `agent_outputs` are on `supabase_realtime` publication.

### Onboarding Updates
New profile fields collected during onboarding:
`ideal_customer`, `sell_locations`, `marketing_budget`, `competitors`, `top_goals`, `marketing_challenge`, `content_comfort`

## Vercel Cron
`vercel.json` — cron fires every hour: `"schedule": "0 * * * *"` → `/api/cron/run-scheduled-agents`

## Environment Variables
All env vars from production are shared. `NEXT_PUBLIC_APP_URL` is set to `https://agent7even-v2.vercel.app`.
`OPENROUTER_API_KEY` is set separately (not in production).

## Everything from CONTEXTV5 Still Applies
All baseline features, tables, Stripe config, Meta config, and conventions from CONTEXTV5.md are the foundation this v2 builds on.
