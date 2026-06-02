'use client'

import { Fragment, useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AGENTS, AgentId, AgentDefinition } from '@/lib/agents/registry'
import OrchestrationProgress from '@/components/agents/OrchestrationProgress'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentTask {
  id: string
  agent: string
  status: string
  priority: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  requires_approval: boolean
  approved_at: string | null
  rejected_at: string | null
  rejection_note: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  updated_at: string | null
  agent_outputs?: AgentOutput[]
}

interface AgentOutput {
  id: string
  task_id: string
  agent: string
  output_type: string
  title: string
  content: { raw?: string; parsed?: Record<string, unknown> } | string | null
  status: string
  created_at: string
}

interface ScorecardEntry {
  agentId: string
  name: string
  icon: string
  lastRunAt: string | null
  totalOutputs: number
  approvalRate: number | null
  isScheduled: boolean
  scheduleId: string | null
}

interface Props {
  profileId: string
  companyName: string
  activeTasks: AgentTask[]
  pendingApprovals: AgentTask[]
  recentTasks: AgentTask[]
  recentOutputs: AgentOutput[]
  scorecard: ScorecardEntry[]
}

type GuidedFieldType = 'text' | 'textarea' | 'select'

interface GuidedField {
  key: string
  label: string
  placeholder?: string
  type?: GuidedFieldType
  options?: string[]
  columns?: 1 | 2 | 3
}

interface AgentGuidedConfig {
  intro: string
  fields: GuidedField[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const AGENT_GUIDED_CONFIG: Record<AgentId, AgentGuidedConfig> = {
  competitor_watcher: {
    intro: 'Set the competitive angle so the watcher returns a decision-ready read instead of asking who to watch.',
    fields: [
      { key: 'watchFocus', label: 'Watch focus', type: 'select', options: ['General market watch', 'Pricing/offers', 'Social content', 'Positioning/messaging', 'Website/landing pages'], columns: 3 },
      { key: 'timeWindow', label: 'Time window', type: 'select', options: ['This week', 'Last 30 days', 'Current campaigns', 'Always-on watch'], columns: 3 },
      { key: 'decisionGoal', label: 'Decision this should inform', placeholder: 'What should we change, launch, test, or protect?', columns: 3 },
      { key: 'competitors', label: 'Competitors to watch', type: 'textarea', placeholder: 'Optional. Leave blank to use Foundation competitors.', columns: 2 },
      { key: 'channels', label: 'Sources to prioritize', type: 'textarea', placeholder: 'Websites, pricing pages, Instagram, email, ads, reviews...', columns: 2 },
      { key: 'mustAvoid', label: 'Must avoid', type: 'textarea', placeholder: 'Claims, competitor callouts, tactics, or sensitive areas to avoid.', columns: 1 },
    ],
  },
  weekly_content: {
    intro: 'Define the week so the agent produces usable posts and emails, not a generic content brainstorm.',
    fields: [
      { key: 'weekGoal', label: 'Week goal', placeholder: 'Lead generation, nurture, launch support, retention...', columns: 3 },
      { key: 'contentMix', label: 'Content mix', type: 'select', options: ['Balanced', 'Education-heavy', 'Sales/promo', 'Community/engagement', 'Launch support'], columns: 3 },
      { key: 'platforms', label: 'Platforms', placeholder: 'Instagram, LinkedIn, email, blog, Facebook...', columns: 3 },
      { key: 'audience', label: 'Audience', placeholder: 'Who should this week speak to?', columns: 2 },
      { key: 'offer', label: 'Offer / product', placeholder: 'What should the content move people toward?', columns: 2 },
      { key: 'mustInclude', label: 'Must include', type: 'textarea', placeholder: 'Proof, events, links, product details, campaign notes...', columns: 2 },
      { key: 'mustAvoid', label: 'Must avoid', type: 'textarea', placeholder: 'Topics, phrases, claims, or angles to avoid.', columns: 2 },
    ],
  },
  campaign_builder: {
    intro: 'Give the campaign enough operating constraints to return a real plan with actions, timing, and metrics.',
    fields: [
      { key: 'campaignGoal', label: 'Campaign goal', type: 'select', options: ['Leads', 'Trials', 'Sales', 'Awareness', 'Retention', 'Launch'], columns: 3 },
      { key: 'timeline', label: 'Timeline', type: 'select', options: ['14 days', '30 days', '60 days', '90 days'], columns: 3 },
      { key: 'successMetric', label: 'Success metric', placeholder: 'Booked calls, trials, purchases, replies, traffic...', columns: 3 },
      { key: 'audience', label: 'Audience', placeholder: 'Target customer segment or ICP.', columns: 2 },
      { key: 'offer', label: 'Offer / product', placeholder: 'Primary offer, package, launch, or feature.', columns: 2 },
      { key: 'channels', label: 'Channels', placeholder: 'Email, paid social, organic social, search, events...', columns: 2 },
      { key: 'budget', label: 'Budget / constraints', placeholder: 'Budget, team capacity, assets available, timing constraints...', columns: 2 },
    ],
  },
  performance_digest: {
    intro: 'Point the analyst at the decision you need. If connected analytics are limited, it will use the snapshot you provide.',
    fields: [
      { key: 'dateRange', label: 'Date range', type: 'select', options: ['7 days', '30 days', '90 days', 'Current campaign'], columns: 3 },
      { key: 'decisionNeed', label: 'Decision needed', type: 'select', options: ['Full digest', 'What to double down on', 'What to fix', 'Budget allocation', 'Content performance'], columns: 3 },
      { key: 'channels', label: 'Channels', placeholder: 'GA, Meta, Instagram, email, ads, website...', columns: 3 },
      { key: 'campaignFocus', label: 'Campaign focus', placeholder: 'Optional campaign, launch, or funnel to evaluate.', columns: 2 },
      { key: 'analyticsSnapshot', label: 'Analytics snapshot', type: 'textarea', placeholder: 'Paste any key metrics, observations, or dashboard notes.', columns: 2 },
    ],
  },
  trend_spotter: {
    intro: 'Set the niche and risk level so trend recommendations stay useful and on brand.',
    fields: [
      { key: 'industry', label: 'Industry / niche', placeholder: 'Business category or niche to monitor.', columns: 3 },
      { key: 'riskTolerance', label: 'Risk level', type: 'select', options: ['Conservative', 'Balanced', 'Aggressive/experimental'], columns: 3 },
      { key: 'contentFormats', label: 'Useful formats', placeholder: 'Reels, carousels, newsletters, paid ads, blog posts...', columns: 3 },
      { key: 'trendSources', label: 'Sources to consider', type: 'textarea', placeholder: 'TikTok, Instagram, newsletters, competitors, search, communities...', columns: 2 },
      { key: 'brandFitRules', label: 'Brand-fit rules', type: 'textarea', placeholder: 'What trends should be excluded even if popular?', columns: 2 },
    ],
  },
  email_sequence_builder: {
    intro: 'Build the sequence from the workflow details so the output is ready to review and edit.',
    fields: [
      { key: 'sequenceType', label: 'Sequence type', type: 'select', options: ['Welcome', 'Lead nurture', 'Prospect response', 'Demo follow-up', 'Abandoned checkout', 'Re-engagement', 'Launch/promo'], columns: 3 },
      { key: 'emailCount', label: 'Email count', type: 'select', options: ['3', '4', '5', '6', '7'], columns: 3 },
      { key: 'desiredOutcome', label: 'Goal', type: 'select', options: ['Schedule a demo', 'Start a trial', 'Book a consultation', 'Purchase', 'Reply to email', 'Move to next conversation stage'], columns: 3 },
      { key: 'leadSource', label: 'Lead/source', placeholder: 'Website form, social DM, referral, demo, existing list...', columns: 2 },
      { key: 'audience', label: 'Audience / lead type', placeholder: 'Warm lead, new subscriber, trial user, past client...', columns: 2 },
      { key: 'offer', label: 'Offer / product', placeholder: 'What should the sequence move them toward?', columns: 2 },
      { key: 'ctaDestination', label: 'CTA destination', placeholder: 'Booking link, pricing page, reply, checkout, trial page...', columns: 2 },
      { key: 'cadence', label: 'Send cadence', placeholder: 'Every 2 days, daily for 3 days, weekly...', columns: 2 },
      { key: 'tone', label: 'Tone', placeholder: 'Warm and direct, premium, playful, consultative...', columns: 2 },
      { key: 'painPoints', label: 'Pain points', type: 'textarea', placeholder: 'What objections or frustrations should it address?', columns: 3 },
      { key: 'mustInclude', label: 'Must include', type: 'textarea', placeholder: 'Proof, offer details, links, deadlines, product facts...', columns: 3 },
      { key: 'mustAvoid', label: 'Must avoid', type: 'textarea', placeholder: 'Discounts, guarantees, competitor names, certain claims...', columns: 3 },
    ],
  },
  ad_variations: {
    intro: 'Set the test conditions so the agent creates platform-ready variants with clear angles.',
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', options: ['Meta', 'Instagram', 'Google Search', 'LinkedIn', 'TikTok', 'Multi-platform'], columns: 3 },
      { key: 'objective', label: 'Objective', type: 'select', options: ['Leads', 'Trials', 'Sales', 'Retargeting', 'Awareness'], columns: 3 },
      { key: 'format', label: 'Format', type: 'select', options: ['Feed', 'Story/Reel', 'Search', 'Carousel', 'Short video script'], columns: 3 },
      { key: 'offer', label: 'Offer / product', placeholder: 'What is the ad selling or promoting?', columns: 2 },
      { key: 'audience', label: 'Audience', placeholder: 'Who should the ad target?', columns: 2 },
      { key: 'proofPoints', label: 'Proof points', type: 'textarea', placeholder: 'Testimonials, outcomes, differentiators, features, credibility...', columns: 2 },
      { key: 'mustAvoid', label: 'Must avoid', type: 'textarea', placeholder: 'Claims, phrases, angles, protected attributes, compliance risks...', columns: 2 },
    ],
  },
  seo_scanner: {
    intro: 'Define the audit lens. The scanner uses your saved website unless you provide an override.',
    fields: [
      { key: 'scanFocus', label: 'Scan focus', type: 'select', options: ['Full audit', 'Quick wins', 'Content gaps', 'Technical basics', 'Local SEO'], columns: 3 },
      { key: 'websiteUrl', label: 'Website URL', placeholder: 'Optional override. Leave blank to use profile website.', columns: 3 },
      { key: 'businessNiche', label: 'Business niche', placeholder: 'What market should the SEO advice fit?', columns: 3 },
      { key: 'targetKeywords', label: 'Target keywords', type: 'textarea', placeholder: 'Keywords, services, locations, topics, or search terms.', columns: 2 },
      { key: 'priorityPages', label: 'Priority pages', type: 'textarea', placeholder: 'Homepage, pricing, product pages, service pages, blog URLs...', columns: 2 },
      { key: 'competitors', label: 'SEO competitors', type: 'textarea', placeholder: 'Optional competitors to compare against.', columns: 1 },
    ],
  },
  brand_voice_guardian: {
    intro: 'Paste the content and set the review standard so the guardian can approve, flag, or rewrite.',
    fields: [
      { key: 'reviewMode', label: 'Review mode', type: 'select', options: ['Full review', 'Tone only', 'Compliance/risk', 'Rewrite suggestions', 'Approval check'], columns: 3 },
      { key: 'strictness', label: 'Strictness', type: 'select', options: ['Light', 'Standard', 'Strict'], columns: 3 },
      { key: 'channel', label: 'Channel', placeholder: 'Email, ad, landing page, Instagram, LinkedIn...', columns: 3 },
      { key: 'intendedAudience', label: 'Intended audience', placeholder: 'Who is this content for?', columns: 2 },
      { key: 'mustPreserve', label: 'Must preserve', type: 'textarea', placeholder: 'Lines, claims, tone notes, offer details, or structure to keep.', columns: 2 },
      { key: 'contentToReview', label: 'Content to review', type: 'textarea', placeholder: 'Paste the draft, caption, email, ad, or page copy here.', columns: 1 },
    ],
  },
}

const INITIAL_AGENT_FORMS = Object.fromEntries(
  Object.entries(AGENT_GUIDED_CONFIG).map(([agentId, config]) => [
    agentId,
    Object.fromEntries(config.fields.map(field => [field.key, field.options?.[0] ?? ''])),
  ])
) as Record<AgentId, Record<string, string>>

function buildGuidedInstructions(agentId: AgentId, form: Record<string, string>, extraInstructions: string): string {
  const agent = AGENTS[agentId]
  const config = AGENT_GUIDED_CONFIG[agentId]
  const details = config.fields
    .map(field => `${field.label}: ${form[field.key]?.trim() || 'Use best assumption from Foundation/Brand context'}`)
    .join('\n')

  return `Run ${agent.name} using these setup details.

${details}

Additional instructions: ${extraInstructions.trim() || 'None'}

Return a complete, ready-to-review output that follows this agent's output contract. Do not ask setup questions. If anything is missing, state your assumption and continue.`
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getContentPreview(output: AgentOutput): string {
  const raw = getOutputText(output)
  return raw.length > 120 ? raw.slice(0, 120) + '…' : raw
}

function getOutputDescription(output: AgentOutput): string {
  const raw = getOutputText(output)
  const firstHeading = raw
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('#'))
    ?.replace(/^#+\s*/, '')

  if (firstHeading) return firstHeading
  if (output.title) return output.title
  return getContentPreview(output) || 'Saved agent output'
}

function getOutputText(output: AgentOutput): string {
  const content = output.content
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content.raw === 'string') return content.raw
  if (content.parsed) return JSON.stringify(content.parsed, null, 2)
  return JSON.stringify(content, null, 2)
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AgentCommandCenter({
  profileId, companyName, activeTasks: initActiveTasks,
  pendingApprovals: initPendingApprovals, recentTasks: initRecent, recentOutputs: initRecentOutputs, scorecard,
}: Props) {
  const [activeTasks, setActiveTasks] = useState(initActiveTasks)
  const [pendingApprovals, setPendingApprovals] = useState(initPendingApprovals)
  const [recentTasks] = useState(initRecent)
  const [recentOutputs, setRecentOutputs] = useState(initRecentOutputs)

  // New task form state
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null)
  const [taskInstructions, setTaskInstructions] = useState('')
  const [taskPriority, setTaskPriority] = useState<'normal' | 'high'>('normal')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [agentForms, setAgentForms] = useState<Record<AgentId, Record<string, string>>>(INITIAL_AGENT_FORMS)

  // Orchestration state
  const [activeOrchestration, setActiveOrchestration] = useState<string | null>(null)
  const [recentOrchestrations, setRecentOrchestrations] = useState<Array<{
    id: string
    triggered_by: string
    total_tasks: number
    completed_tasks: number
    total_cost_usd: number
    budget_exceeded: boolean
    completed_at: string | null
  }>>([])

  // Constraints state
  const [constraints, setConstraints] = useState('')
  const [savedConstraints, setSavedConstraints] = useState('')
  const [isCustomized, setIsCustomized] = useState(false)
  const [constraintsLastUpdated, setConstraintsLastUpdated] = useState<string | null>(null)
  const [savingConstraints, setSavingConstraints] = useState(false)
  const [constraintsSaved, setConstraintsSaved] = useState(false)

  const agentList = Object.values(AGENTS)
  const selectedAgentConfig = selectedAgent ? AGENT_GUIDED_CONFIG[selectedAgent] : null
  const selectedAgentForm = selectedAgent ? agentForms[selectedAgent] : {}

  const CONSTRAINT_TEMPLATES = [
    { label: 'No discounting', text: 'Never offer discounts, promotions, or reduced pricing without explicit client approval.' },
    { label: 'No delivery promises', text: 'Never promise specific delivery timelines, turnaround times, or completion dates.' },
    { label: 'No competitor mentions', text: 'Never name or reference specific competitors by name.' },
    { label: 'Route pricing to human', text: 'Always direct pricing and cost questions to a human team member.' },
    { label: 'No guarantees', text: 'Never promise specific results, outcomes, rankings, or revenue figures.' },
    { label: 'No sensitive topics', text: 'Never engage with political, religious, or controversial social topics.' },
  ]

  // Canvas context for Maya
  useEffect(() => {
    const scorecardLines = scorecard
      .map(e => `- ${e.name}: last run ${e.lastRunAt ?? 'never'}, ${e.totalOutputs} output(s), ${e.isScheduled ? 'scheduled/active' : 'idle'}`)
      .join('\n')
    const context = `AGENT COMMAND CENTER PAGE
Company: ${companyName}
Active tasks: ${activeTasks.length}
Pending approvals: ${pendingApprovals.length}
Agents:
${scorecardLines || '- No agent activity yet'}
The user can run agents, approve/reject pending outputs, and manage agent constraints.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch active + recent orchestrations on mount
  useEffect(() => {
    fetch('/api/agents/orchestrations/active')
      .then(r => r.json())
      .then(data => { if (data.orchestration?.id) setActiveOrchestration(data.orchestration.id) })
      .catch(() => {})

    fetch('/api/agents/orchestrations/recent')
      .then(r => r.json())
      .then(data => { if (data.orchestrations) setRecentOrchestrations(data.orchestrations) })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`agent_tasks:user:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_tasks',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const updated = payload.new as AgentTask
          if (!updated) return

          if (updated.status === 'running' || updated.status === 'pending') {
            setActiveTasks(prev => {
              const exists = prev.find(t => t.id === updated.id)
              return exists
                ? prev.map(t => t.id === updated.id ? updated : t)
                : [updated, ...prev]
            })
          } else {
            setActiveTasks(prev => prev.filter(t => t.id !== updated.id))
          }

          if (
            updated.requires_approval &&
            updated.status === 'completed' &&
            !updated.approved_at &&
            !updated.rejected_at
          ) {
            setPendingApprovals(prev => {
              const exists = prev.find(t => t.id === updated.id)
              return exists ? prev : [updated, ...prev]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_outputs',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const output = payload.new as AgentOutput
          if (!output) return

          setRecentOutputs(prev => {
            if (prev.some(existing => existing.id === output.id)) return prev
            return [output, ...prev].slice(0, 50)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  useEffect(() => {
    if (!selectedAgent) return
    setConstraints('')
    setSavedConstraints('')
    setIsCustomized(false)
    setConstraintsLastUpdated(null)

    fetch(`/api/agents/constraints?agentId=${selectedAgent}`)
      .then(r => r.json())
      .then(data => {
        const value = data.constraints ?? ''
        setConstraints(value)
        setSavedConstraints(value)
        setIsCustomized(!!data.constraints)
        setConstraintsLastUpdated(data.updated_at ?? null)
      })
      .catch(() => {})
  }, [selectedAgent])

  async function handleSaveConstraints() {
    if (!selectedAgent) return
    setSavingConstraints(true)
    try {
      await fetch('/api/agents/constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent, constraints }),
      })
      setSavedConstraints(constraints)
      setIsCustomized(true)
      setConstraintsLastUpdated(new Date().toISOString())
      setConstraintsSaved(true)
      setTimeout(() => setConstraintsSaved(false), 2500)
    } finally {
      setSavingConstraints(false)
    }
  }

  async function handleCreateTask() {
    if (!selectedAgent) return
    setSubmitting(true)
    try {
      const form = agentForms[selectedAgent] ?? {}
      const instructions = buildGuidedInstructions(selectedAgent, form, taskInstructions)

      await fetch('/api/agents/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: selectedAgent,
          input: { instructions, ...form },
          priority: taskPriority,
        }),
      })
      setSubmitted(true)
      setTaskInstructions('')
      setSelectedAgent(null)
      setTimeout(() => setSubmitted(false), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  function updateAgentForm(agentId: AgentId, key: string, value: string) {
    setAgentForms(prev => ({
      ...prev,
      [agentId]: {
        ...prev[agentId],
        [key]: value,
      },
    }))
  }

  const runningTasks = activeTasks.filter(t => t.status === 'running')
  const queuedTasks = activeTasks.filter(t => t.status === 'pending')
  const completedToday = recentTasks
    .filter(t => t.status === 'completed' && t.completed_at && (Date.now() - new Date(t.completed_at).getTime()) < 86400000)
    .slice(0, 5)
  const scorecardWithLiveCounts = scorecard.map(entry => ({
    ...entry,
    totalOutputs: Math.max(entry.totalOutputs, recentOutputs.filter(output => output.agent === entry.agentId).length),
  }))
  const latestOutputs = recentOutputs.slice(0, 5)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px', fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>Agents</p>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>
          Agent Command Center
        </h1>
        <p style={{ fontSize: 14, color: '#64748B' }}>
          {companyName} · {agentList.length} agents available
        </p>
      </div>

      {/* ═══ ZONE 1: Create New Task ═══ */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Run an agent</p>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Choose an agent and tell it what you need.</p>

        {/* Agent grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {agentList.map((agent: AgentDefinition) => {
            const isSelected = selectedAgent === agent.id
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(isSelected ? null : agent.id as AgentId)}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 10, border: isSelected ? '2px solid #3B82F6' : '1px solid #E2E8F0', background: isSelected ? 'rgba(59,130,246,0.04)' : '#fff', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = '#64748B' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <i className={`ti ${agent.icon}`} style={{ fontSize: 20, color: isSelected ? '#3B82F6' : '#64748B' }} />
                  <span style={{
                    fontSize: 10, borderRadius: 20, padding: '2px 7px', fontWeight: 500,
                    background: agent.autonomyLevel === 'autonomous' ? 'rgba(59,130,246,0.1)' : 'rgba(45,55,72,0.1)',
                    color: agent.autonomyLevel === 'autonomous' ? '#3B82F6' : '#2D3748',
                  }}>
                    {agent.autonomyLevel === 'autonomous' ? 'Auto' : 'Approval'}
                  </span>
                </div>
                <p style={{ fontSize: 12.5, fontWeight: 500, color: '#2D3748', margin: 0 }}>{agent.name}</p>
                <p style={{ fontSize: 11, color: '#999', lineHeight: 1.4, margin: 0 }}>{agent.description}</p>
              </button>
            )
          })}
        </div>

        {/* Instructions + submit */}
        {selectedAgent && (
          <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 18 }}>
            {selectedAgentConfig && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#2D3748', margin: '0 0 3px' }}>
                    {AGENTS[selectedAgent].name} setup
                  </p>
                  <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                    {selectedAgentConfig.intro}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
                  {selectedAgentConfig.fields.map(field => {
                    const type = field.type ?? 'text'
                    const columnSpan = field.columns === 1 ? 6 : field.columns === 3 ? 2 : 3
                    const fieldStyle = { gridColumn: `span ${columnSpan}` }
                    const controlStyle = {
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: '9px 10px',
                      fontSize: 13,
                      color: '#2D3748',
                      background: '#fff',
                      fontFamily: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box' as const,
                    }

                    return (
                      <label key={field.key} style={{ display: 'grid', gap: 5, ...fieldStyle }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {field.label}
                        </span>
                        {type === 'select' ? (
                          <select
                            value={selectedAgentForm[field.key] ?? ''}
                            onChange={e => updateAgentForm(selectedAgent, field.key, e.target.value)}
                            style={controlStyle}
                          >
                            {(field.options ?? []).map(option => <option key={option}>{option}</option>)}
                          </select>
                        ) : type === 'textarea' ? (
                          <textarea
                            value={selectedAgentForm[field.key] ?? ''}
                            onChange={e => updateAgentForm(selectedAgent, field.key, e.target.value)}
                            rows={field.columns === 1 ? 4 : 3}
                            placeholder={field.placeholder}
                            style={{ ...controlStyle, resize: 'vertical', lineHeight: 1.5 }}
                          />
                        ) : (
                          <input
                            value={selectedAgentForm[field.key] ?? ''}
                            onChange={e => updateAgentForm(selectedAgent, field.key, e.target.value)}
                            placeholder={field.placeholder}
                            style={controlStyle}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>

                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Additional instructions
                  </span>
                  <textarea
                    value={taskInstructions}
                    onChange={e => setTaskInstructions(e.target.value)}
                    placeholder={`Optional: add anything specific ${AGENTS[selectedAgent].name} should know for this run.`}
                    rows={3}
                    style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#2D3748', lineHeight: 1.5 }}
                  />
                </label>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['normal', 'high'] as const).map(p => (
                  <button key={p} onClick={() => setTaskPriority(p)}
                    style={{ padding: '5px 12px', borderRadius: 20, border: taskPriority === p ? '2px solid #3B82F6' : '1px solid #E2E8F0', background: taskPriority === p ? 'rgba(59,130,246,0.06)' : '#F8FAFC', color: '#2D3748', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateTask}
                disabled={submitting || submitted}
                style={{ marginLeft: 'auto', padding: '8px 24px', background: submitted ? '#10B981' : '#2D3748', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: submitting || submitted ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minWidth: 160 }}
              >
                {submitted ? 'Task queued' : submitting ? 'Queuing...' : `Run ${AGENTS[selectedAgent].name}`}
              </button>
            </div>

            {/* Constraints section */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '0.5px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#888', margin: 0 }}>
                    What this agent will never do
                  </p>
                  <p style={{ fontSize: 11.5, color: '#bbb', marginTop: 3 }}>
                    Brand safety guardrails — applied to every run
                  </p>
                </div>
                {isCustomized && (
                  <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#16a34a', borderRadius: 20, fontWeight: 500, flexShrink: 0 }}>
                    Customized
                  </span>
                )}
              </div>

              {/* Template quick-insert buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {CONSTRAINT_TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setConstraints(prev => prev ? `${prev}\n${t.text}` : t.text)}
                    style={{ padding: '3px 10px', borderRadius: 20, border: '0.5px solid #E2E8F0', background: '#fafafa', color: '#555', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2D3748' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0' }}
                  >
                    + {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={constraints}
                onChange={e => setConstraints(e.target.value)}
                rows={4}
                placeholder={AGENTS[selectedAgent].defaultConstraints}
                style={{ width: '100%', border: '0.5px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#2D3748', lineHeight: 1.6 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                {constraints !== savedConstraints && (
                  <button
                    onClick={handleSaveConstraints}
                    disabled={savingConstraints}
                    style={{ padding: '6px 16px', background: '#2D3748', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: savingConstraints ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: savingConstraints ? 0.6 : 1 }}
                  >
                    {savingConstraints ? 'Saving…' : 'Save constraints'}
                  </button>
                )}
                {constraintsSaved && (
                  <span style={{ fontSize: 12, color: '#10B981' }}>Constraints saved</span>
                )}
                {constraintsLastUpdated && !constraintsSaved && (
                  <span style={{ fontSize: 11, color: '#ccc' }}>
                    Last updated {relativeTime(constraintsLastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedAgent && (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 13, padding: '8px 0' }}>
            Select an agent above to get started
          </div>
        )}
      </div>

      {/* ═══ ZONE 1: Approval Queue Banner ═══ */}
      {pendingApprovals.length > 0 ? (
        <Link
          href="/dashboard/agents/approvals"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12,
            padding: '14px 20px', marginBottom: 24, textDecoration: 'none',
            transition: 'border-color 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#3B82F6' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#BFDBFE' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{pendingApprovals.length}</span>
            </div>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: '#2D3748', margin: 0 }}>
                {pendingApprovals.length} output{pendingApprovals.length !== 1 ? 's' : ''} waiting for your review
              </p>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
                {[...new Set(pendingApprovals.map(t => AGENTS[t.agent as AgentId]?.name ?? t.agent))].slice(0, 3).join(', ')}
                {pendingApprovals.length > 3 ? ` +${pendingApprovals.length - 3} more` : ''}
              </p>
            </div>
          </div>
          <span style={{ fontSize: 12.5, color: '#3B82F6', fontWeight: 500 }}>Review</span>
        </Link>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-circle-check" style={{ fontSize: 16, color: '#CBD5E1' }} />
          <span style={{ fontSize: 13, color: '#64748B' }}>Queue is clear — nothing waiting for review</span>
        </div>
      )}

      {/* ═══ ZONE 2: Agent Activity ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 24, height: 280 }}>

        {/* Left: Live feed */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, overflow: 'hidden', overflowY: 'auto' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 16 }}>Live activity</p>

          {activeOrchestration ? (
            <OrchestrationProgress
              orchestrationId={activeOrchestration}
              onComplete={(session) => {
                setActiveOrchestration(null)
                setRecentOrchestrations(prev => [{
                  id: session.id,
                  triggered_by: session.triggered_by,
                  total_tasks: session.total_tasks,
                  completed_tasks: session.completed_tasks,
                  total_cost_usd: session.total_cost_usd,
                  budget_exceeded: session.budget_exceeded,
                  completed_at: session.completed_at,
                }, ...prev].slice(0, 5))
              }}
            />
          ) : (
            <>
              {runningTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Running now</p>
                  {runningTasks.map(t => {
                    const def = AGENTS[t.agent as AgentId]
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'dotPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                        <i className={`ti ${def?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#555' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, color: '#2D3748' }}>{def?.name}</p>
                        </div>
                        <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(t.started_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {queuedTasks.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Queued</p>
                  {queuedTasks.map(t => {
                    const def = AGENTS[t.agent as AgentId]
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e5e5e5', flexShrink: 0 }} />
                        <i className={`ti ${def?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#bbb' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, color: '#888' }}>{def?.name}</p>
                        </div>
                        <span style={{ fontSize: 11, color: '#bbb' }}>Waiting</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {completedToday.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Completed today</p>
                  {completedToday.map(t => {
                    const def = AGENTS[t.agent as AgentId]
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                        <i className="ti ti-check" style={{ fontSize: 13, color: '#22c55e' }} />
                        <i className={`ti ${def?.icon ?? 'ti-robot'}`} style={{ fontSize: 14, color: '#bbb' }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12.5, color: '#555' }}>{def?.name}</p>
                        </div>
                        <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(t.completed_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTasks.length === 0 && completedToday.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <i className="ti ti-robot" style={{ fontSize: 18, color: '#CBD5E1' }} />
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Your agents are ready.</p>
                  <p style={{ fontSize: 12, color: '#CBD5E1' }}>Run an agent to see live activity here.</p>
                </div>
              )}
            </>
          )}

          {/* Recent orchestrations */}
          {!activeOrchestration && recentOrchestrations.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '0.5px solid #f0f0f0' }}>
              <p style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Recent runs</p>
              {recentOrchestrations.map(orch => (
                <div key={orch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f8f8f8' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#333', margin: 0 }}>
                      {orch.triggered_by.replace(/_/g, ' ')}
                    </p>
                    <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>
                      {orch.completed_tasks} agents · {relativeTime(orch.completed_at)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: '#888', margin: 0 }}>${(orch.total_cost_usd ?? 0).toFixed(4)}</p>
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 20,
                      background: orch.budget_exceeded ? '#fff7ed' : '#f0fdf4',
                      color: orch.budget_exceeded ? '#c2410c' : '#16a34a',
                    }}>
                      {orch.budget_exceeded ? 'budget hit' : 'completed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Scorecard */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, overflowY: 'auto' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 16 }}>Agent scorecard</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 16px', alignItems: 'center' }}>
            {/* Header */}
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Agent</span>
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Last run</span>
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Outputs</span>
            <span style={{ fontSize: 10, color: '#ccc', textTransform: 'uppercase', paddingBottom: 8, borderBottom: '0.5px solid #f0f0f0' }}>Status</span>

            {scorecardWithLiveCounts.map(entry => (
              <Fragment key={entry.agentId}>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '0.5px solid #f8f8f8', textDecoration: 'none' }}>
                  <i className={`ti ${entry.icon}`} style={{ fontSize: 14, color: '#888', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#333', whiteSpace: 'nowrap' }}>{entry.name}</span>
                </Link>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} style={{ fontSize: 12, color: '#888', padding: '9px 0', borderBottom: '0.5px solid #f8f8f8', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                  {relativeTime(entry.lastRunAt)}
                </Link>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} style={{ fontSize: 12, color: entry.totalOutputs > 0 ? '#3B82F6' : '#555', padding: '9px 0', borderBottom: '0.5px solid #f8f8f8', textAlign: 'center', textDecoration: 'none', fontWeight: entry.totalOutputs > 0 ? 600 : 400 }}>
                  {entry.totalOutputs}
                </Link>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} style={{ padding: '9px 0', borderBottom: '0.5px solid #f8f8f8', textDecoration: 'none' }}>
                  {entry.isScheduled ? (
                    <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.1)', color: '#10B981', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>Active</span>
                  ) : (
                    <span style={{ fontSize: 11, background: '#F8FAFC', color: '#64748B', borderRadius: 20, padding: '2px 8px', border: '1px solid #E2E8F0', fontWeight: 500 }}>Idle</span>
                  )}
                </Link>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ZONE 2B: Agent Outputs ═══ */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', marginBottom: 4 }}>Recent outputs</p>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Open an output archive to read the full result.</p>
          </div>
          <Link href="/dashboard/agents/approvals" style={{ fontSize: 12.5, color: '#3B82F6', textDecoration: 'none', fontWeight: 500 }}>
            Review approvals
          </Link>
        </div>

        {latestOutputs.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {latestOutputs.map(output => {
              const agent = AGENTS[output.agent as AgentId]
              return (
                <Link
                  key={output.id}
                  href={`/dashboard/agents/${output.agent}/outputs?output=${output.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 14px', border: '1px solid #E2E8F0', borderRadius: 10, textDecoration: 'none', background: '#fff' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#2D3748', fontWeight: 600, margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getOutputDescription(output)}
                    </p>
                    <p style={{ fontSize: 11.5, color: '#64748B', margin: 0 }}>
                      {agent?.name ?? output.agent} · {relativeTime(output.created_at)} · {output.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 500, whiteSpace: 'nowrap' }}>Open</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div style={{ border: '1px dashed #CBD5E1', borderRadius: 12, padding: '24px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Saved auto-agent outputs will appear here as one-line links.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
