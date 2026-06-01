# Orchestration Progress UI — Claude Code Handoff
*Work queue item 18 — Final feature item*

Read MAYA_CONTEXT.md and CONTEXTV9.md before starting.
Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Real-time agent-by-agent progress display for parallel orchestration runs.
Two surfaces: Agent Command Center live activity and campaign generation screen.

Infrastructure already in place:
- `orchestration_sessions` table with `total_tasks`, `completed_tasks`, `status`
- Supabase realtime enabled on `orchestration_sessions`
- `agent_tasks` updated as each agent completes
- `runOrchestration()` rolls up cost and completed count after each task

---

## Part 1 — Schema Addition

```sql
-- Add agent list to orchestration sessions so UI knows which agents ran
ALTER TABLE orchestration_sessions
  ADD COLUMN IF NOT EXISTS agent_ids    text[],   -- e.g. ['content_writer', 'ad_copy_generator']
  ADD COLUMN IF NOT EXISTS agent_status jsonb;    -- { agentId: 'pending'|'running'|'completed'|'failed' }
```

Update `createOrchestrationSession()` in `lib/agents/runner.ts` to populate `agent_ids`:

```typescript
const { data, error } = await supabase
  .from('orchestration_sessions')
  .insert({
    user_id:        opts.userId,
    triggered_by:   opts.triggeredBy,
    status:         'running',
    total_tasks:    opts.subagentCount,
    budget_cap_usd: cap,
    agent_ids:      opts.agentIds ?? [],          // NEW
    agent_status:   buildInitialStatus(opts.agentIds ?? []),  // NEW
  })

function buildInitialStatus(agentIds: string[]): Record<string, string> {
  return Object.fromEntries(agentIds.map(id => [id, 'pending']))
}
```

Update `rollupCostToOrchestration()` to also update agent status:

```typescript
// After each task completes, mark that agent as completed in agent_status
const { data: s } = await supabase
  .from('orchestration_sessions')
  .select('agent_status')
  .eq('id', orchestrationId)
  .single()

const updatedStatus = {
  ...(s?.agent_status ?? {}),
  [agentId]: failed ? 'failed' : 'completed',
}

await supabase
  .from('orchestration_sessions')
  .update({
    agent_status: updatedStatus,
    // ... existing fields
  })
  .eq('id', orchestrationId)
```

---

## Part 2 — OrchestrationProgress Component

Create `components/agents/OrchestrationProgress.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OrchestrationSession {
  id:              string
  triggered_by:    string
  status:          string
  total_tasks:     number
  completed_tasks: number
  total_cost_usd:  number
  budget_cap_usd:  number | null
  budget_exceeded: boolean
  agent_ids:       string[]
  agent_status:    Record<string, 'pending' | 'running' | 'completed' | 'failed'>
  created_at:      string
  completed_at:    string | null
}

interface Props {
  orchestrationId: string
  onComplete?: (session: OrchestrationSession) => void
  onBudgetExceeded?: () => void
  compact?: boolean  // compact mode for inline display
}

const AGENT_NAMES: Record<string, string> = {
  competitor_watcher:     'Competitor Watcher',
  content_writer:         'Weekly Content',
  campaign_builder:       'Campaign Builder',
  analytics_reader:       'Performance Digest',
  trend_spotter:          'Trend Spotter',
  email_sequence_builder: 'Email Sequence Builder',
  ad_copy_generator:      'Ad Variations',
  seo_scanner:            'SEO Scanner',
  brand_voice_guardian:   'Brand Voice Guardian',
}

export default function OrchestrationProgress({
  orchestrationId,
  onComplete,
  onBudgetExceeded,
  compact = false,
}: Props) {
  const [session, setSession] = useState<OrchestrationSession | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Initial fetch
    supabase
      .from('orchestration_sessions')
      .select('*')
      .eq('id', orchestrationId)
      .single()
      .then(({ data }) => {
        if (data) setSession(data)
      })

    // Realtime subscription
    const channel = supabase
      .channel(`orchestration-${orchestrationId}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'orchestration_sessions',
        filter: `id=eq.${orchestrationId}`,
      }, payload => {
        const updated = payload.new as OrchestrationSession
        setSession(updated)

        if (updated.status === 'completed') {
          onComplete?.(updated)
        }
        if (updated.budget_exceeded) {
          onBudgetExceeded?.()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orchestrationId])

  if (!session) return <OrchestrationSkeleton compact={compact} />

  const pct = session.total_tasks > 0
    ? Math.round((session.completed_tasks / session.total_tasks) * 100)
    : 0

  const isComplete = session.status === 'completed'
  const isBudgetHit = session.budget_exceeded

  if (compact) return <CompactProgress session={session} pct={pct} />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">
            {isComplete ? 'Orchestration complete' : 'Agents running...'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {session.triggered_by.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">
            {session.completed_tasks}/{session.total_tasks}
          </p>
          <p className="text-xs text-gray-400">agents</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
        <div
          className={`rounded-full h-1.5 transition-all duration-500
            ${isBudgetHit ? 'bg-orange-400' : isComplete ? 'bg-green-500' : 'bg-black'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {(session.agent_ids ?? []).map((agentId, i) => {
          const status = session.agent_status?.[agentId] ?? 'pending'
          return (
            <AgentStatusRow
              key={agentId}
              agentId={agentId}
              status={status}
              index={i}
            />
          )
        })}
      </div>

      {/* Budget warning */}
      {isBudgetHit && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2.5
                        bg-orange-50 border border-orange-100 rounded-xl">
          <span className="text-sm text-orange-700">
            Budget cap reached — some agents were stopped.
            {session.completed_tasks} of {session.total_tasks} completed.
          </span>
        </div>
      )}

      {/* Cost */}
      {isComplete && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center
                        justify-between">
          <span className="text-xs text-gray-400">Total cost</span>
          <span className="text-xs font-medium text-gray-600">
            ${session.total_cost_usd?.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  )
}

function AgentStatusRow({
  agentId,
  status,
  index,
}: {
  agentId: string
  status:  string
  index:   number
}) {
  const name = AGENT_NAMES[agentId] ?? agentId.replace(/_/g, ' ')

  return (
    <div
      className="flex items-center gap-3 py-2"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Status indicator */}
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
        {status === 'completed' && (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center
                          justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {status === 'running' && (
          <div className="w-4 h-4 rounded-full border-2 border-black
                          border-t-transparent animate-spin" />
        )}
        {status === 'pending' && (
          <div className="w-3 h-3 rounded-full bg-gray-200" />
        )}
        {status === 'failed' && (
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center
                          justify-center">
            <span className="text-red-500 text-xs font-bold">✕</span>
          </div>
        )}
      </div>

      {/* Agent name */}
      <span className={`text-sm transition-colors
        ${status === 'completed' ? 'text-gray-900 font-medium'
        : status === 'running'   ? 'text-black font-medium'
        : status === 'failed'    ? 'text-red-500'
        : 'text-gray-400'}`}>
        {name}
      </span>

      {/* Running pulse */}
      {status === 'running' && (
        <span className="text-xs text-gray-400 animate-pulse">working...</span>
      )}

      {/* Completed time */}
      {status === 'completed' && (
        <span className="ml-auto text-xs text-gray-400">done</span>
      )}
    </div>
  )
}

function CompactProgress({
  session,
  pct,
}: {
  session: OrchestrationSession
  pct:     number
}) {
  const isComplete = session.status === 'completed'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-1">
        <div
          className={`rounded-full h-1 transition-all duration-500
            ${isComplete ? 'bg-green-500' : 'bg-black'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
        {session.completed_tasks}/{session.total_tasks} agents
      </span>
    </div>
  )
}

function OrchestrationSkeleton({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-1 animate-pulse" />
        <span className="text-xs text-gray-300">loading...</span>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
      <div className="h-1.5 bg-gray-100 rounded-full mb-5" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-4 bg-gray-100 rounded w-2/3" />
        ))}
      </div>
    </div>
  )
}
```

---

## Part 3 — Agent Command Center Integration

In `AgentCommandCenter.tsx`, update the Live Activity section to show
`OrchestrationProgress` when an active orchestration exists:

```tsx
// Fetch active orchestration on mount + poll
const [activeOrchestration, setActiveOrchestration] = useState<string | null>(null)

useEffect(() => {
  // Check for any running orchestration for this user
  supabase
    .from('orchestration_sessions')
    .select('id')
    .eq('user_id', profileId)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .then(({ data }) => {
      if (data?.[0]) setActiveOrchestration(data[0].id)
    })
}, [])

// In Live Activity section:
{activeOrchestration ? (
  <OrchestrationProgress
    orchestrationId={activeOrchestration}
    onComplete={() => {
      setActiveOrchestration(null)
      // Refresh agent scorecard
      refreshScorecard()
    }}
  />
) : (
  <div className="flex flex-col items-center justify-center py-12">
    <OrchestrationIdleIcon />
    <p className="text-sm text-gray-400 mt-3">No activity yet</p>
    <p className="text-xs text-gray-300 mt-1">Run an agent to get started</p>
  </div>
)}
```

Also show recent completed orchestrations below the live section:

```tsx
// Recent orchestrations (last 5, completed)
{recentOrchestrations.map(orch => (
  <div key={orch.id}
       className="flex items-center justify-between py-3
                  border-b border-gray-100 last:border-0">
    <div>
      <p className="text-sm font-medium text-gray-800">
        {orch.triggered_by.replace(/_/g, ' ')}
      </p>
      <p className="text-xs text-gray-400">
        {orch.completed_tasks} agents · {formatRelative(orch.completed_at)}
      </p>
    </div>
    <div className="text-right">
      <p className="text-xs text-gray-500">${orch.total_cost_usd?.toFixed(4)}</p>
      <span className={`text-xs px-2 py-0.5 rounded-full
        ${orch.budget_exceeded
          ? 'bg-orange-50 text-orange-600'
          : 'bg-green-50 text-green-600'}`}>
        {orch.budget_exceeded ? 'budget hit' : 'completed'}
      </span>
    </div>
  </div>
))}
```

---

## Part 4 — Campaign Generation Screen Integration

In `GuidedCampaignFlow.tsx` and `OpenCanvasFlow.tsx`, when campaign
generation triggers an orchestration, replace the generic animation
with `OrchestrationProgress`:

```tsx
// Generation state
const [orchestrationId, setOrchestrationId] = useState<string | null>(null)
const [generating, setGenerating] = useState(false)

async function handleGenerate() {
  setGenerating(true)

  const res = await fetch('/api/campaigns/generate', {
    method: 'POST',
    body:   JSON.stringify({ ...campaignParams, model }),
  })
  const data = await res.json()

  if (data.orchestrationId) {
    setOrchestrationId(data.orchestrationId)
    // OrchestrationProgress handles the rest via realtime
  } else if (data.campaignId) {
    // Non-orchestrated generation — use existing animation
    router.push(`/dashboard/campaigns/${data.campaignId}`)
  }
}

// In render — generation screen:
{generating && orchestrationId && (
  <div className="max-w-lg mx-auto px-6 py-12">
    <div className="w-10 h-10 rounded-xl bg-black flex items-center
                    justify-center mb-6">
      <span className="text-white font-bold text-sm">M</span>
    </div>
    <h2 className="text-xl font-semibold text-gray-900 mb-2">
      Building your campaign
    </h2>
    <p className="text-sm text-gray-400 mb-8">
      Maya is running multiple agents in parallel to build
      the strongest possible campaign for you.
    </p>
    <OrchestrationProgress
      orchestrationId={orchestrationId}
      onComplete={(session) => {
        // Navigate to campaign once complete
        router.push(`/dashboard/campaigns/${campaignId}`)
      }}
      onBudgetExceeded={() => {
        // Show partial results notice
        setShowBudgetNotice(true)
      }}
    />
  </div>
)}
```

---

## Part 5 — API: Active Orchestration Endpoint

Create `app/api/agents/orchestrations/active/route.ts`:

```typescript
// GET — returns the most recent running orchestration for the user
// Used by Agent Command Center on mount

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!profile) return NextResponse.json({ orchestration: null })

  const { data } = await supabase
    .from('orchestration_sessions')
    .select('id, triggered_by, status, total_tasks, completed_tasks, agent_ids, agent_status')
    .eq('user_id', profile.id)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)

  return NextResponse.json({ orchestration: data?.[0] ?? null })
}
```

Also `GET /api/agents/orchestrations/recent` — returns last 5 completed:

```typescript
// Returns last 5 completed orchestration_sessions for the user
// Used by Agent Command Center recent activity section
```

---

## Definition of Done

- [ ] SQL migration — `agent_ids text[]` and `agent_status jsonb` on `orchestration_sessions`
- [ ] `createOrchestrationSession()` populates `agent_ids` and initial `agent_status`
- [ ] `rollupCostToOrchestration()` updates `agent_status` per agent as each completes
- [ ] `OrchestrationProgress` component renders full view with agent-by-agent status
- [ ] Realtime subscription updates status as agents complete
- [ ] Spinner shows for `running` agents, checkmark for `completed`, X for `failed`
- [ ] Progress bar fills as agents complete
- [ ] Budget exceeded warning shows when `budget_exceeded = true`
- [ ] Cost summary shows when `status = completed`
- [ ] Compact mode renders for inline use
- [ ] Skeleton loading state while data fetches
- [ ] Agent Command Center Live Activity shows `OrchestrationProgress` when running
- [ ] Agent Command Center shows recent completed orchestrations
- [ ] Campaign generation screen uses `OrchestrationProgress` instead of generic dots
- [ ] `GET /api/agents/orchestrations/active` returns running orchestration
- [ ] `GET /api/agents/orchestrations/recent` returns last 5 completed
- [ ] Agent names use updated names (Weekly Content, Performance Digest, Ad Variations)

