# Morning Digest — Claude Code Handoff
*Work queue item 11*

Read MAYA_CONTEXT.md and CONTEXTV8.md before starting. 
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

The morning digest is the primary daily touchpoint between Maya and the user.
Two surfaces: a proactive email at 7am and a dashboard widget that IS the top
of the dashboard until actioned.

Three parts: digest generation API, dashboard widget, morning email cron.

---

## Part 1 — Schema

Run in Supabase SQL Editor:

```sql
-- Daily digest record — one per user per day
CREATE TABLE IF NOT EXISTS daily_digests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date            date NOT NULL,
  agent_runs      jsonb,   -- array of { agentId, agentName, summary, outputCount, needsApproval }
  approvals       jsonb,   -- array of { taskId, agentId, agentName, preview, createdAt }
  today_actions   jsonb,   -- array of { task, channel, campaignTitle, cta }
  email_sent      boolean DEFAULT false,
  email_sent_at   timestamptz,
  dismissed       boolean DEFAULT false,
  dismissed_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_digests_user_date 
  ON daily_digests(user_id, date DESC);

-- Add timezone to profiles if not exists
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';
```

---

## Part 2 — Digest Generation API

Create `app/api/digest/generate/route.ts`:

Called by the cron and also on-demand when the dashboard loads and no digest
exists for today yet.

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const { userId, profileId } = await req.json()

  const today = new Date().toISOString().split('T')[0]

  // Check if digest already exists for today
  const { data: existing } = await supabase
    .from('daily_digests')
    .select('id')
    .eq('user_id', profileId)
    .eq('date', today)
    .single()

  if (existing) return NextResponse.json({ digestId: existing.id, cached: true })

  // Fetch data from last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Agent runs overnight
  const { data: agentTasks } = await supabase
    .from('agent_tasks')
    .select('id, agent_id, status, cost_usd, created_at, agent_outputs(content)')
    .eq('user_id', profileId)
    .gte('created_at', since)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  // 2. Pending approvals
  const { data: pendingApprovals } = await supabase
    .from('agent_tasks')
    .select('id, agent_id, created_at, agent_outputs(content)')
    .eq('user_id', profileId)
    .eq('status', 'approval_required')
    .order('created_at', { ascending: false })

  // 3. Today's campaign actions
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('title, do_this_today, week_plan')
    .eq('user_id', profileId)
    .eq('status', 'active')

  // Extract today's actions from campaigns
  const todayActions: any[] = []
  campaigns?.forEach(campaign => {
    const actions = campaign.do_this_today as any[] ?? []
    actions.slice(0, 2).forEach(action => {
      todayActions.push({
        task:          action.task,
        channel:       action.channel,
        campaignTitle: campaign.title,
        cta:           'Do this with Maya →',
      })
    })
  })

  // Generate Maya's first-person summaries for agent runs
  const agentSummaries = await Promise.all(
    (agentTasks ?? []).slice(0, 5).map(async task => {
      const output = (task.agent_outputs as any[])?.[0]?.content ?? ''
      const preview = output.slice(0, 300)

      // Ask Maya to write a one-line first-person summary
      if (!preview) return {
        agentId:      task.agent_id,
        agentName:    formatAgentName(task.agent_id),
        summary:      `Completed a run with no output recorded.`,
        outputCount:  0,
        needsApproval: false,
      }

      const result = await openRouterComplete({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{
          role: 'user',
          content: `Write a single sentence (max 20 words) in first person as Maya 
summarizing what this agent found or produced. Start with "I" or the agent action.
Agent: ${formatAgentName(task.agent_id)}
Output preview: ${preview}
Return only the sentence, nothing else.`
        }],
        max_tokens: 60,
        temperature: 0.4,
      })

      return {
        agentId:      task.agent_id,
        agentName:    formatAgentName(task.agent_id),
        summary:      result.content.trim(),
        outputCount:  (task.agent_outputs as any[])?.length ?? 0,
        needsApproval: false,
      }
    })
  )

  // Format approval items
  const approvalItems = (pendingApprovals ?? []).slice(0, 5).map(task => ({
    taskId:    task.id,
    agentId:   task.agent_id,
    agentName: formatAgentName(task.agent_id),
    preview:   ((task.agent_outputs as any[])?.[0]?.content ?? '').slice(0, 150),
    createdAt: task.created_at,
  }))

  // Save digest
  const { data: digest, error } = await supabase
    .from('daily_digests')
    .insert({
      user_id:      profileId,
      date:         today,
      agent_runs:   agentSummaries,
      approvals:    approvalItems,
      today_actions: todayActions.slice(0, 3),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ digestId: digest.id })
}

function formatAgentName(agentId: string): string {
  const names: Record<string, string> = {
    competitor_watcher:    'Competitor Watcher',
    content_writer:        'Content Writer',
    campaign_builder:      'Campaign Builder',
    analytics_reader:      'Analytics Reader',
    trend_spotter:         'Trend Spotter',
    email_sequence_builder: 'Email Sequence Builder',
    ad_copy_generator:     'Ad Copy Generator',
    seo_scanner:           'SEO Scanner',
    brand_voice_guardian:  'Brand Voice Guardian',
  }
  return names[agentId] ?? agentId
}
```

---

## Part 3 — Dashboard Digest Widget

Update `app/dashboard/page.tsx` and create 
`components/dashboard/MorningDigest.tsx`.

### Dashboard page — load digest on mount

```typescript
// In dashboard page server component:
// Generate digest if it doesn't exist for today (fast — cached after first call)
const today = new Date().toISOString().split('T')[0]
const { data: digest } = await supabase
  .from('daily_digests')
  .select('*')
  .eq('user_id', profile.id)
  .eq('date', today)
  .single()

// If no digest yet, trigger generation (non-blocking)
// Pass digest (or null) to dashboard client component
```

### MorningDigest component

```tsx
'use client'

interface DigestProps {
  digest: {
    id: string
    agent_runs: AgentRun[]
    approvals: ApprovalItem[]
    today_actions: TodayAction[]
    dismissed: boolean
  } | null
  profileId: string
}

export default function MorningDigest({ digest, profileId }: DigestProps) {
  const [dismissed, setDismissed] = useState(digest?.dismissed ?? false)
  const [approvals, setApprovals] = useState(digest?.approvals ?? [])

  // Don't show if dismissed or no overnight activity
  if (dismissed) return null
  if (!digest) return <DigestSkeleton />

  const hasActivity = (digest.agent_runs?.length ?? 0) > 0
  const hasPending  = approvals.length > 0
  const hasActions  = (digest.today_actions?.length ?? 0) > 0

  if (!hasActivity && !hasPending && !hasActions) return null

  const greeting = getGreeting() // "Good morning" / "Good afternoon" / "Good evening"
  const firstName = '' // pass from profile

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Maya</span>
          </div>
          <p className="text-sm text-gray-500">
            {greeting}{firstName ? `, ${firstName}` : ''}. Here's what happened overnight.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* What I did — agent runs */}
      {hasActivity && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            What I did
          </p>
          <div className="space-y-2">
            {digest.agent_runs.map((run, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-gray-500 mr-2">
                    {run.agentName}
                  </span>
                  <span className="text-sm text-gray-800">{run.summary}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What needs you — approvals */}
      {hasPending && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            What needs you
          </p>
          <div className="space-y-3">
            {approvals.map(item => (
              <div
                key={item.taskId}
                className="bg-gray-50 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">
                    {item.agentName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatRelative(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {item.preview}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item.taskId)}
                    className="flex-1 py-2 bg-black text-white text-xs font-medium 
                               rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.taskId)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 
                               text-xs font-medium rounded-lg hover:border-gray-400 
                               transition-colors"
                  >
                    Reject
                  </button>
                  <Link
                    href={`/dashboard/agents?task=${item.taskId}`}
                    className="px-3 py-2 border border-gray-200 text-gray-600 
                               text-xs font-medium rounded-lg hover:border-gray-400 
                               transition-colors"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's plan */}
      {hasActions && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Today's plan
          </p>
          <div className="space-y-2">
            {digest.today_actions.map((action, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 
                           border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <ChannelIcon channel={action.channel} />
                  <div>
                    <p className="text-sm text-gray-800">{action.task}</p>
                    <p className="text-xs text-gray-400">{action.campaignTitle}</p>
                  </div>
                </div>
                <button
                  onClick={() => dispatchMayaTask(action)}
                  className="text-xs font-medium text-[#c8522a] hover:underline whitespace-nowrap ml-4"
                >
                  Do this with Maya →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )

  async function handleApprove(taskId: string) {
    await fetch(`/api/agents/tasks/${taskId}/approve`, { method: 'POST' })
    setApprovals(prev => prev.filter(a => a.taskId !== taskId))
  }

  async function handleReject(taskId: string) {
    await fetch(`/api/agents/tasks/${taskId}/reject`, { method: 'POST' })
    setApprovals(prev => prev.filter(a => a.taskId !== taskId))
  }

  async function handleDismiss() {
    await fetch(`/api/digest/${digest!.id}/dismiss`, { method: 'POST' })
    setDismissed(true)
  }

  function dispatchMayaTask(action: TodayAction) {
    window.dispatchEvent(new CustomEvent('maya:open-task', {
      detail: { task: action.task, context: action.campaignTitle }
    }))
  }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
```

### Dismiss API route

Create `app/api/digest/[id]/dismiss/route.ts`:
```typescript
// POST — marks digest as dismissed
// Updates daily_digests.dismissed = true, dismissed_at = now()
// Protected by auth — only owner can dismiss their own digest
```

---

## Part 4 — Morning Email Cron

Create `app/api/cron/morning-digest/route.ts`:

Runs at 12:00 UTC daily (7am EST). For users in other timezones,
send within ±1hr of their 7am.

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  // Get active paid accounts that haven't received today's email
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, company_name, timezone')
    .in('plan', ['starter', 'growth', 'proagent'])
    .eq('status', 'active')

  if (!profiles?.length) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const profile of profiles) {
    // Check if digest exists and email not yet sent
    const { data: digest } = await supabase
      .from('daily_digests')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .eq('email_sent', false)
      .single()

    // Generate digest if it doesn't exist
    let digestData = digest
    if (!digestData) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/digest/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id }),
      })
      const { digestId } = await res.json()
      const { data } = await supabase
        .from('daily_digests')
        .select('*')
        .eq('id', digestId)
        .single()
      digestData = data
    }

    if (!digestData) continue

    // Skip if nothing to report
    const hasContent =
      (digestData.agent_runs?.length ?? 0) > 0 ||
      (digestData.approvals?.length ?? 0) > 0 ||
      (digestData.today_actions?.length ?? 0) > 0

    if (!hasContent) continue

    // Send email
    const firstName = profile.full_name?.split(' ')[0] ?? 'there'
    const subject = buildSubject(digestData)
    const html = buildEmailHtml(digestData, firstName, profile.company_name)

    try {
      await resend.emails.send({
        from:    'Maya <maya@agent7even.com>',
        to:      profile.email,
        subject,
        html,
      })

      // Mark email as sent
      await supabase
        .from('daily_digests')
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq('id', digestData.id)

      sent++
    } catch (err) {
      console.error(`Failed to send digest to ${profile.email}:`, err)
    }
  }

  return NextResponse.json({ sent })
}

function buildSubject(digest: any): string {
  const approvalCount = digest.approvals?.length ?? 0
  const runCount = digest.agent_runs?.length ?? 0

  if (approvalCount > 0) {
    return `${approvalCount} item${approvalCount > 1 ? 's' : ''} waiting for your approval`
  }
  if (runCount > 0) {
    return `Here's what Maya did overnight`
  }
  return `Your marketing plan for today`
}

function buildEmailHtml(digest: any, firstName: string, companyName: string): string {
  const agentRuns   = digest.agent_runs    ?? []
  const approvals   = digest.approvals     ?? []
  const actions     = digest.today_actions ?? []

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
           background: #f5f4f0; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: white; 
                 border-radius: 16px; padding: 32px; }
    .logo { font-weight: 700; font-size: 16px; letter-spacing: -0.5px; 
            color: #111; margin-bottom: 24px; }
    .logo span { color: #c8522a; }
    h2 { font-size: 20px; font-weight: 600; color: #111; margin: 0 0 8px; }
    p { font-size: 14px; color: #6b7280; margin: 0 0 24px; line-height: 1.5; }
    .section-label { font-size: 11px; font-weight: 600; color: #9ca3af; 
                     text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
    .item { padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
    .item:last-child { border-bottom: none; }
    .item-label { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
    .item-text { font-size: 14px; color: #111; }
    .approval-box { background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .approval-preview { font-size: 13px; color: #374151; margin: 8px 0 12px; }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 8px; 
           font-size: 13px; font-weight: 500; text-decoration: none; }
    .btn-black { background: #111; color: white; }
    .btn-outline { border: 1px solid #e5e7eb; color: #374151; margin-left: 8px; }
    .cta { text-align: center; margin-top: 32px; padding-top: 24px; 
           border-top: 1px solid #f3f4f6; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">AGENT<span>7</span>EVEN</div>

    <h2>Good morning, ${firstName}.</h2>
    <p>Here's what Maya did overnight and what's on your plate today.</p>

    ${agentRuns.length > 0 ? `
    <div class="section-label">What I did</div>
    ${agentRuns.map((run: any) => `
      <div class="item">
        <div class="item-label">${run.agentName}</div>
        <div class="item-text">${run.summary}</div>
      </div>
    `).join('')}
    <br>
    ` : ''}

    ${approvals.length > 0 ? `
    <div class="section-label">What needs you (${approvals.length} item${approvals.length > 1 ? 's' : ''})</div>
    ${approvals.map((item: any) => `
      <div class="approval-box">
        <div class="item-label">${item.agentName}</div>
        <div class="approval-preview">${item.preview}${item.preview.length >= 150 ? '...' : ''}</div>
        <a href="${appUrl}/dashboard/agents?task=${item.taskId}" class="btn btn-black">Review →</a>
      </div>
    `).join('')}
    <br>
    ` : ''}

    ${actions.length > 0 ? `
    <div class="section-label">Today's plan</div>
    ${actions.map((action: any) => `
      <div class="item">
        <div class="item-label">${action.campaignTitle} · ${action.channel}</div>
        <div class="item-text">${action.task}</div>
      </div>
    `).join('')}
    <br>
    ` : ''}

    <div class="cta">
      <a href="${appUrl}/dashboard" class="btn btn-black">Open Maya →</a>
    </div>

    <div class="footer">
      Agent7even · You're receiving this because you have an active Maya account.<br>
      <a href="${appUrl}/dashboard/settings" style="color: #9ca3af;">Manage email preferences</a>
    </div>
  </div>
</body>
</html>`
}
```

Add to `vercel.json` crons:
```json
{
  "path": "/api/cron/morning-digest",
  "schedule": "0 12 * * *"
}
```

---

## Part 5 — Email Preferences in Settings

In `app/dashboard/settings/page.tsx` or settings client component,
add a notification preferences section:

```tsx
<div className="bg-white rounded-2xl border border-gray-100 p-6">
  <h3 className="font-semibold text-gray-900 mb-4">Email notifications</h3>
  <div className="space-y-3">
    <PreferenceToggle
      label="Morning digest"
      description="Daily summary of agent activity and today's plan"
      checked={emailDigest}
      onChange={val => updatePreference('email_digest', val)}
    />
    <PreferenceToggle
      label="Approval alerts"
      description="Notified immediately when an agent output needs your review"
      checked={emailApprovals}
      onChange={val => updatePreference('email_approvals', val)}
    />
    <PreferenceToggle
      label="Weekly summary"
      description="What Maya accomplished this week"
      checked={emailWeekly}
      onChange={val => updatePreference('email_weekly', val)}
    />
  </div>
</div>
```

Add columns to profiles:
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_digest    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_approvals boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_weekly    boolean DEFAULT true;
```

Update the cron to check `email_digest = true` before sending.

---

## Definition of Done

- [ ] SQL migration run — `daily_digests` table + email pref columns on profiles
- [ ] `POST /api/digest/generate` creates digest, caches by date, returns digestId
- [ ] `POST /api/digest/[id]/dismiss` marks dismissed
- [ ] `MorningDigest` component renders at top of Dashboard
- [ ] Shows correctly when agent runs exist
- [ ] Shows correctly when approvals exist — approve/reject works inline
- [ ] Shows correctly when today's actions exist — "Do this with Maya →" fires maya:open-task
- [ ] Hides when dismissed (persisted, survives refresh)
- [ ] Hides when nothing to report (no runs, no approvals, no actions)
- [ ] DigestSkeleton shows while loading
- [ ] Morning email cron at `/api/cron/morning-digest` runs at 12:00 UTC
- [ ] Email sends via Resend from maya@agent7even.com
- [ ] Email subject adapts based on content (approvals → "X items waiting", runs → "Here's what Maya did")
- [ ] Email HTML renders correctly — three sections, CTA button
- [ ] `vercel.json` updated with new cron
- [ ] Email preferences section in Settings — 3 toggles, saved to profiles
- [ ] Cron respects `email_digest = false` preference

