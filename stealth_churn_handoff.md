# Stealth Churn Tracking — Claude Code Handoff
*Work queue item 4 — Retention*

Read MAYA_CONTEXT.md before starting. Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Clients disengage silently before they cancel. Right now there is no visibility into
who is active, who is drifting, and who is about to churn. This adds a client health
view to the admin panel — all clients with engagement scores, plus a filtered at-risk
view that surfaces who needs attention.

Four parts: schema, engagement score calculation, admin UI, Maya nudge trigger.

---

## Part 1 — Schema Migration

Run in Supabase SQL Editor:

```sql
-- Add engagement tracking columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at      timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_score    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_updated_at timestamptz;

-- Activity log — every meaningful client action
CREATE TABLE IF NOT EXISTS client_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Index for fast per-user lookups
CREATE INDEX idx_client_activity_user 
  ON client_activity_log(user_id, created_at DESC);

-- Index for admin queries (recent activity across all users)
CREATE INDEX idx_client_activity_recent
  ON client_activity_log(created_at DESC);
```

**Event types to log:**
- `page_view` — any authenticated page load
- `maya_message` — user sends a message to Maya
- `agent_run` — user triggers an agent
- `agent_approved` — user approves an agent output
- `campaign_created` — user creates a campaign
- `foundation_updated` — user improves Foundation answers
- `brand_kit_updated` — user edits Brand Kit
- `analytics_viewed` — user opens Analytics page

---

## Part 2 — Activity Tracking Middleware

Create `middleware.ts` addition (or update existing middleware):

```typescript
// Track last_active_at on every authenticated request
// Add to existing middleware or create new

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function trackActivity(userId: string, eventType: string, metadata?: object) {
  const supabase = createServiceClient()

  // Get profile id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return

  // Update last_active_at on profile
  await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', profile.id)

  // Log the event
  await supabase
    .from('client_activity_log')
    .insert({
      user_id:    profile.id,
      event_type: eventType,
      metadata:   metadata ?? null,
    })
}
```

**Where to call trackActivity:**
- `app/api/maya/chat/route.ts` → `trackActivity(userId, 'maya_message')`
- `app/api/agents/tasks/create/route.ts` → `trackActivity(userId, 'agent_run', { agentId })`
- `app/api/agents/tasks/[id]/approve/route.ts` → `trackActivity(userId, 'agent_approved')`
- `app/dashboard/layout.tsx` → `trackActivity(userId, 'page_view', { page: pathname })`
- `app/api/foundation/score/route.ts` → `trackActivity(userId, 'foundation_updated')`

---

## Part 3 — Engagement Score Calculation

Create `app/api/cron/calculate-engagement/route.ts`:

Runs daily. Scores each active client 0-100 based on last 14 days of activity.

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Points per event type (last 14 days)
const EVENT_POINTS: Record<string, number> = {
  maya_message:        3,
  agent_run:           5,
  agent_approved:      4,
  campaign_created:    8,
  foundation_updated:  6,
  brand_kit_updated:   4,
  analytics_viewed:    2,
  page_view:           1,
}

const MAX_SCORE = 100

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Get all active paid profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('status', 'active')
    .in('plan', ['starter', 'growth', 'proagent'])

  if (!profiles?.length) return NextResponse.json({ updated: 0 })

  let updated = 0

  for (const profile of profiles) {
    // Fetch last 14 days of activity
    const { data: events } = await supabase
      .from('client_activity_log')
      .select('event_type')
      .eq('user_id', profile.id)
      .gte('created_at', fourteenDaysAgo)

    if (!events) continue

    // Calculate raw score
    const rawScore = events.reduce((sum, e) => {
      return sum + (EVENT_POINTS[e.event_type] ?? 0)
    }, 0)

    // Cap at 100
    const score = Math.min(rawScore, MAX_SCORE)

    await supabase
      .from('profiles')
      .update({
        engagement_score:      score,
        engagement_updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    updated++
  }

  return NextResponse.json({ updated })
}
```

Add to `vercel.json` crons:
```json
{
  "path": "/api/cron/calculate-engagement",
  "schedule": "0 6 * * *"
}
```

---

## Part 4 — Admin Client Health Page

Create `app/admin/clients/page.tsx`:

### Page layout

Two tabs at the top:
- **All clients** — full list, sortable
- **At risk** — filtered: `last_active_at` > 48hrs ago OR `engagement_score` < 30

### All clients tab

Table with columns:
| Column | Source | Notes |
|---|---|---|
| Client | `profiles.full_name` + `profiles.email` | Avatar + name + email |
| Plan | `profiles.plan` | Starter / Growth / ProAgent badge |
| Last active | `profiles.last_active_at` | Relative time ("2 hours ago", "3 days ago") |
| Engagement | `profiles.engagement_score` | Score bar + number |
| Foundation | `profiles.foundation_score` | Score bar + number |
| Status | Derived | Green / Yellow / Red indicator |
| Joined | `profiles.created_at` | Date |

**Status derivation:**
- 🟢 Healthy — active in last 24hrs AND engagement_score ≥ 50
- 🟡 Drifting — active in last 48hrs OR engagement_score 30–49
- 🔴 At risk — not active in 48hrs+ OR engagement_score < 30

**Sortable by:** Last active, Engagement score, Foundation score, Plan, Joined date

### At risk tab

Same table but pre-filtered to 🔴 At risk clients only.

Top of tab shows summary cards:
```tsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">At risk</p>
    <p className="text-2xl font-semibold text-red-500">{atRiskCount}</p>
    <p className="text-xs text-gray-400 mt-1">inactive 48hrs+ or score &lt; 30</p>
  </div>
  <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Drifting</p>
    <p className="text-2xl font-semibold text-yellow-500">{driftingCount}</p>
    <p className="text-xs text-gray-400 mt-1">low engagement, still active</p>
  </div>
  <div className="bg-white rounded-2xl border border-gray-100 p-4">
    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Healthy</p>
    <p className="text-2xl font-semibold text-green-500">{healthyCount}</p>
    <p className="text-xs text-gray-400 mt-1">active and engaged</p>
  </div>
</div>
```

**Action button per at-risk row:**
"Send Maya nudge" — triggers in-app notification to that client:
Maya message: "Hey — it's been a few days. Your agents are ready to run and there's work waiting for you. Want to pick up where we left off?"

### API route for admin data

Create `app/api/admin/clients/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') // 'all' | 'at_risk'

  let query = supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      avatar_url,
      plan,
      status,
      last_active_at,
      engagement_score,
      foundation_score,
      created_at
    `)
    .in('plan', ['starter', 'growth', 'proagent'])
    .order('last_active_at', { ascending: false })

  if (filter === 'at_risk') {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    query = query.or(
      `last_active_at.lt.${fortyEightHoursAgo},engagement_score.lt.30`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: data })
}
```

---

## Part 5 — Maya Nudge Trigger for At-Risk Clients

Create `app/api/cron/nudge-inactive/route.ts`:

Runs daily. Sends in-app Maya notification to clients inactive 48hrs+ who haven't been nudged in 7 days.

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Find inactive clients who haven't been nudged recently
  const { data: inactive } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('plan', ['starter', 'growth', 'proagent'])
    .eq('status', 'active')
    .lt('last_active_at', fortyEightHoursAgo)
    .or(`last_nudged_at.is.null,last_nudged_at.lt.${sevenDaysAgo}`)

  if (!inactive?.length) return NextResponse.json({ nudged: 0 })

  let nudged = 0

  for (const client of inactive) {
    // Insert notification
    await supabase.from('notifications').insert({
      user_id:   client.id,
      type:      'maya_nudge',
      title:     'Maya has work ready for you',
      message:   `Hey ${client.full_name?.split(' ')[0] ?? 'there'} — it's been a few days. Your agents are ready to run and there's work waiting. Want to pick up where we left off?`,
      read:      false,
      action_url: '/dashboard',
    })

    // Update last_nudged_at
    await supabase
      .from('profiles')
      .update({ last_nudged_at: new Date().toISOString() })
      .eq('id', client.id)

    nudged++
  }

  return NextResponse.json({ nudged })
}
```

Add `last_nudged_at timestamptz` column to profiles migration:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz;
```

Add to `vercel.json` crons:
```json
{
  "path": "/api/cron/nudge-inactive",
  "schedule": "0 9 * * *"
}
```

---

## Definition of done

- [ ] Schema migration run — `last_active_at`, `engagement_score`, `engagement_updated_at`, `last_nudged_at` on profiles + `client_activity_log` table
- [ ] `trackActivity()` called in all 5 locations listed in Part 2
- [ ] `POST /api/cron/calculate-engagement` scores all active clients daily
- [ ] `POST /api/cron/nudge-inactive` sends Maya nudge to inactive clients daily at 9am
- [ ] Admin clients page at `/admin/clients` with All clients + At risk tabs
- [ ] Summary cards show at-risk / drifting / healthy counts
- [ ] Table sortable by last active, engagement score, foundation score
- [ ] Status indicator (🟢 🟡 🔴) derived correctly
- [ ] "Send Maya nudge" button on at-risk rows works
- [ ] `vercel.json` updated with 2 new cron schedules
- [ ] Add `/admin/clients` link to admin panel navigation

