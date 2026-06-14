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
  compact?: boolean
}

const AGENT_NAMES: Record<string, string> = {
  competitor_watcher:     'Competitor Watcher',
  content_posting:        'Content Posting',
  weekly_content:         'Weekly Content',
  post_caption:           'Post Caption',
  content_writer:         'Weekly Content',
  campaign_builder:       'Campaign Builder',
  performance_digest:     'Performance Digest',
  analytics_reader:       'Performance Digest',
  trend_spotter:          'Trend Spotter',
  email_sequence_builder: 'Email Sequence Builder',
  idea_analysis:          'Idea Analysis',
  ad_variations:          'Ad Variations',
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
    supabase
      .from('orchestration_sessions')
      .select('*')
      .eq('id', orchestrationId)
      .single()
      .then(({ data }) => {
        if (data) setSession(data as OrchestrationSession)
      })

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
        if (updated.status === 'completed') onComplete?.(updated)
        if (updated.budget_exceeded) onBudgetExceeded?.()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orchestrationId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <OrchestrationSkeleton compact={compact} />

  const pct = session.total_tasks > 0
    ? Math.round((session.completed_tasks / session.total_tasks) * 100)
    : 0

  const isComplete  = session.status === 'completed'
  const isBudgetHit = session.budget_exceeded

  if (compact) return <CompactProgress session={session} pct={pct} />

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #ebebeb', padding: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', margin: 0 }}>
            {isComplete ? 'Orchestration complete' : 'Agents running...'}
          </p>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
            {session.triggered_by.replace(/_/g, ' ')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', margin: 0 }}>
            {session.completed_tasks}/{session.total_tasks}
          </p>
          <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>agents</p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', background: '#f0f0f0', borderRadius: 99, height: 4, marginBottom: 16 }}>
        <div
          style={{
            borderRadius: 99, height: 4,
            width: `${pct}%`,
            background: isBudgetHit ? '#F59E0B' : isComplete ? '#10B981' : '#3B82F6',
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      {/* Agent list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
        <div style={{ marginTop: 12, background: '#fff7ed', border: '0.5px solid #fed7aa', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 12, color: '#c2410c', margin: 0 }}>
            Budget cap reached — some agents were stopped.
            {' '}{session.completed_tasks} of {session.total_tasks} completed.
          </p>
        </div>
      )}

      {/* Cost summary */}
      {isComplete && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>Total cost</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#555' }}>
            ${(session.total_cost_usd ?? 0).toFixed(4)}
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', animationDelay: `${index * 100}ms` }}>
      <div style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status === 'completed' && (
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {status === 'running' && (
          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #2D3748', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        )}
        {status === 'pending' && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E2E8F0' }} />
        )}
        {status === 'failed' && (
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, lineHeight: 1 }}>✕</span>
          </div>
        )}
      </div>

      <span style={{
        fontSize: 12.5,
        color: status === 'completed' ? '#2D3748'
             : status === 'running'   ? '#2D3748'
             : status === 'failed'    ? '#ef4444'
             : '#bbb',
        fontWeight: status === 'completed' || status === 'running' ? 500 : 400,
        flex: 1,
      }}>
        {name}
      </span>

      {status === 'running' && (
        <span style={{ fontSize: 11, color: '#bbb', animation: 'pulse 1.5s ease-in-out infinite' }}>working...</span>
      )}
      {status === 'completed' && (
        <span style={{ fontSize: 11, color: '#bbb' }}>done</span>
      )}
    </div>
  )
}

function CompactProgress({ session, pct }: { session: OrchestrationSession; pct: number }) {
  const isComplete = session.status === 'completed'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 99, height: 3 }}>
        <div
          style={{
            borderRadius: 99, height: 3,
            width: `${pct}%`,
            background: isComplete ? '#22c55e' : '#2D3748',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {session.completed_tasks}/{session.total_tasks} agents
      </span>
    </div>
  )
}

function OrchestrationSkeleton({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 99, height: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <span style={{ fontSize: 11, color: '#ccc' }}>loading...</span>
      </div>
    )
  }
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #ebebeb', padding: 20, animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ height: 14, background: '#f0f0f0', borderRadius: 6, width: '40%', marginBottom: 14 }} />
      <div style={{ height: 4, background: '#f0f0f0', borderRadius: 99, marginBottom: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 12, background: '#f5f5f5', borderRadius: 6, width: '60%' }} />
        ))}
      </div>
    </div>
  )
}
