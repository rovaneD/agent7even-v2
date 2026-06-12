'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildAgentCommandCenterMayaContext } from '@/lib/maya/summaries/agentsContext'
import PostImageAttach from '@/components/agents/PostImageAttach'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AGENTS, AgentId, AgentDefinition, AGENT_COLORS, COMMAND_CENTER_AGENTS } from '@/lib/agents/registry'
import {
  CONTENT_POSTING_FLOW_LABELS,
  type ContentPostingFlow,
  contentPostingStatsAgentIds,
  isLegacyContentAgent,
} from '@/lib/agents/contentPosting'
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
  content_posting: {
    intro: 'Choose Single post or Weekly content, then complete the setup for that flow.',
    fields: [],
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
  post_caption: {
    intro: 'Attach the image you plan to post. Maya reads it and writes one caption to match what is in the frame — then you approve and publish.',
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', options: ['Instagram', 'LinkedIn', 'Facebook', 'X'], columns: 3 },
      { key: 'postGoal', label: 'Post goal', type: 'select', options: ['Awareness', 'Engagement', 'Traffic', 'Leads', 'Sales', 'Community'], columns: 3 },
      { key: 'audience', label: 'Audience', placeholder: 'Who should this post speak to?', columns: 3 },
      { key: 'offer', label: 'Offer / CTA', placeholder: 'Link, product, booking page, or action you want...', columns: 2 },
      { key: 'mustInclude', label: 'Must include', type: 'textarea', placeholder: 'Hashtags, link, promo code, event date...', columns: 2 },
      { key: 'mustAvoid', label: 'Must avoid', type: 'textarea', placeholder: 'Topics, phrases, or claims to avoid.', columns: 2 },
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

const CONTENT_POSTING_FLOW_CONFIG: Record<ContentPostingFlow, AgentGuidedConfig> = {
  single: {
    intro: 'Attach the image you plan to post. Maya reads it and writes one caption to match what is in the frame — then you approve and publish.',
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', options: ['Instagram', 'LinkedIn', 'Facebook', 'X'], columns: 3 },
      { key: 'postGoal', label: 'Post goal', type: 'select', options: ['Awareness', 'Engagement', 'Traffic', 'Leads', 'Sales', 'Community'], columns: 3 },
      { key: 'audience', label: 'Audience', placeholder: 'Who should this post speak to?', columns: 3 },
      { key: 'offer', label: 'Offer / CTA', placeholder: 'Link, product, booking page, or action you want...', columns: 2 },
      { key: 'mustInclude', label: 'Must include', type: 'textarea', placeholder: 'Hashtags, link, promo code, event date...', columns: 2 },
      { key: 'mustAvoid', label: 'Must avoid', type: 'textarea', placeholder: 'Topics, phrases, or claims to avoid.', columns: 2 },
    ],
  },
  weekly: {
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
}

const INITIAL_CONTENT_POSTING_FORMS = Object.fromEntries(
  Object.entries(CONTENT_POSTING_FLOW_CONFIG).map(([flow, config]) => [
    flow,
    Object.fromEntries(config.fields.map(field => [field.key, field.options?.[0] ?? ''])),
  ])
) as Record<ContentPostingFlow, Record<string, string>>

function buildContentPostingInstructions(
  flow: ContentPostingFlow,
  form: Record<string, string>,
  extraInstructions: string,
): string {
  const config = CONTENT_POSTING_FLOW_CONFIG[flow]
  const details = config.fields
    .map(field => `${field.label}: ${form[field.key]?.trim() || 'Use best assumption from Foundation/Brand context'}`)
    .join('\n')

  return `Run Content Posting (${CONTENT_POSTING_FLOW_LABELS[flow]}) using these setup details.

${details}

Additional instructions: ${extraInstructions.trim() || 'None'}

Return a complete, ready-to-review output that follows this flow's output contract. Do not ask setup questions. If anything is missing, state your assumption and continue.`
}

function agentDisplayName(agentId: string): string {
  if (isLegacyContentAgent(agentId)) return AGENTS.content_posting.name
  return AGENTS[agentId as AgentId]?.name ?? agentId
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
  const [contentPostingFlow, setContentPostingFlow] = useState<ContentPostingFlow>('single')
  const [contentPostingForms, setContentPostingForms] = useState(INITIAL_CONTENT_POSTING_FORMS)
  const [postImageMedia, setPostImageMedia] = useState<{
    storagePath: string
    mime: string
    previewUrl: string
    filename?: string
  } | null>(null)
  const [postImageRequiredError, setPostImageRequiredError] = useState<string | null>(null)

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

  const agentList = useMemo(() => COMMAND_CENTER_AGENTS, [])

  function startSinglePostFlow() {
    setSelectedAgent('content_posting')
    setContentPostingFlow('single')
    setPostImageRequiredError(null)
    setTimeout(() => {
      document.getElementById('run-agent')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const selectedAgentConfig = selectedAgent === 'content_posting'
    ? CONTENT_POSTING_FLOW_CONFIG[contentPostingFlow]
    : selectedAgent
      ? AGENT_GUIDED_CONFIG[selectedAgent]
      : null
  const selectedAgentForm = selectedAgent === 'content_posting'
    ? contentPostingForms[contentPostingFlow]
    : selectedAgent
      ? agentForms[selectedAgent]
      : {}
  const isSinglePostSelected = selectedAgent === 'content_posting' && contentPostingFlow === 'single'

  const CONSTRAINT_TEMPLATES = [
    { label: 'No discounting', text: 'Never offer discounts, promotions, or reduced pricing without explicit client approval.' },
    { label: 'No delivery promises', text: 'Never promise specific delivery timelines, turnaround times, or completion dates.' },
    { label: 'No competitor mentions', text: 'Never name or reference specific competitors by name.' },
    { label: 'Route pricing to human', text: 'Always direct pricing and cost questions to a human team member.' },
    { label: 'No guarantees', text: 'Never promise specific results, outcomes, rankings, or revenue figures.' },
    { label: 'No sensitive topics', text: 'Never engage with political, religious, or controversial social topics.' },
  ]

  const mayaContext = useMemo(
    () =>
      buildAgentCommandCenterMayaContext({
        companyName,
        activeTaskCount: activeTasks.length,
        pendingApprovalCount: pendingApprovals.length,
        scorecard,
      }),
    [companyName, activeTasks.length, pendingApprovals.length, scorecard],
  )
  useMayaContext(mayaContext)

  useEffect(() => {
    if (!isSinglePostSelected && postImageMedia) {
      setPostImageMedia(null)
    }
    if (!isSinglePostSelected) {
      setPostImageRequiredError(null)
    }
  }, [isSinglePostSelected, postImageMedia])

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
    setPostImageRequiredError(null)
    setSubmitting(true)
    try {
      let input: Record<string, unknown>
      if (selectedAgent === 'content_posting') {
        const form = contentPostingForms[contentPostingFlow]
        const instructions = buildContentPostingInstructions(contentPostingFlow, form, taskInstructions)
        input = { instructions, contentFlow: contentPostingFlow, ...form }

        if (contentPostingFlow === 'single') {
          if (!postImageMedia) {
            setPostImageRequiredError('Attach the post image before running Single post.')
            return
          }
          input.media_storage_path = postImageMedia.storagePath
          input.media_mime = postImageMedia.mime
          input.image_caption_mode = true
          input.platforms = form.platform ?? 'Instagram'
        }
      } else {
        const form = agentForms[selectedAgent] ?? {}
        const instructions = buildGuidedInstructions(selectedAgent, form, taskInstructions)
        input = { instructions, ...form }
      }

      await fetch('/api/agents/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: selectedAgent,
          input,
          priority: taskPriority,
        }),
      })
      setSubmitted(true)
      setTaskInstructions('')
      setPostImageMedia(null)
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

  function updateContentPostingForm(flow: ContentPostingFlow, key: string, value: string) {
    setContentPostingForms(prev => ({
      ...prev,
      [flow]: {
        ...prev[flow],
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
    totalOutputs: Math.max(
      entry.totalOutputs,
      recentOutputs.filter(output => {
        if (entry.agentId === 'content_posting') {
          return contentPostingStatsAgentIds().includes(output.agent as AgentId)
        }
        return output.agent === entry.agentId
      }).length,
    ),
  }))
  const latestOutputs = recentOutputs.slice(0, 5)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">

      <section className="mb-6 overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_20px_60px_rgba(45,55,72,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="p-7">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-menu-muted">Agents</p>
            <h1 className="max-w-2xl text-[34px] font-semibold leading-tight text-text-primary">
              Agent Command Center
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-sec">
              Run focused marketing agents, review approval-required work, and open saved outputs from one workspace.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startSinglePostFlow}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-[#2563EB]"
              >
                Post with your image
              </button>
              <a href="#run-agent" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-gray-200 hover:bg-surface-2">
                Run an agent
              </a>
              <Link href="/dashboard/agents/approvals" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-gray-200 hover:bg-surface-2">
                Review approvals
                {pendingApprovals.length > 0 && (
                  <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                    {pendingApprovals.length}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="border-t border-border bg-surface-2 p-6 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Operating snapshot</p>
            <p className="mt-1 text-sm text-text-sec">{companyName} · {agentList.length} agents available</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Running</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{runningTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Queued</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{queuedTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Approvals</p>
                <p className="mt-2 text-2xl font-semibold text-brand-primary">{pendingApprovals.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Outputs</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{recentOutputs.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="run-agent" className="mb-6 rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Run an agent</p>
            <h2 className="mt-1 text-[18px] font-semibold text-text-primary">Choose the specialist for this task</h2>
            <p className="mt-1 text-sm text-text-sec">Each agent has a guided setup so the output comes back ready to review.</p>
          </div>
          {submitted && (
            <span className="rounded-full bg-status-success/10 px-3 py-1.5 text-xs font-semibold text-status-success">
              Task queued
            </span>
          )}
        </div>

        {/* Agent grid */}
        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agentList.map((agent: AgentDefinition) => {
            const isSelected = selectedAgent === agent.id
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(isSelected ? null : agent.id as AgentId)}
                className={`group flex min-h-[118px] flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-brand-primary bg-brand-primary/5'
                    : 'border-border bg-surface hover:border-gray-200 hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
                    style={isSelected
                      ? { backgroundColor: 'rgba(59,130,246,0.1)', color: '#3B82F6' }
                      : { backgroundColor: AGENT_COLORS[agent.id as AgentId]?.bg ?? '#F3F4F6', color: AGENT_COLORS[agent.id as AgentId]?.fg ?? '#6B7280' }
                    }
                  >
                    <i className={`ti ${agent.icon}`} style={{ fontSize: 20 }} />
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    agent.autonomyLevel === 'autonomous'
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'bg-surface-2 text-text-sec'
                  }`}>
                    {agent.id === 'content_posting' ? 'Single · Weekly' : agent.autonomyLevel === 'autonomous' ? 'Auto' : 'Approval'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                  <p className="mt-1 text-xs leading-5 text-text-sec">{agent.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Instructions + submit */}
        {selectedAgent && (
          <div className="border-t border-border pt-5">
            {selectedAgentConfig && (
              <div className="mb-4">
                <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-text-primary">
                    {AGENTS[selectedAgent].name} setup
                  </p>
                  <p className="mt-1 text-sm leading-6 text-text-sec">
                    {selectedAgentConfig.intro}
                  </p>
                </div>

                {selectedAgent === 'content_posting' && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(['single', 'weekly'] as const).map(flow => (
                      <button
                        key={flow}
                        type="button"
                        onClick={() => setContentPostingFlow(flow)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          contentPostingFlow === flow
                            ? 'border border-brand-primary bg-brand-primary/10 text-brand-primary'
                            : 'border border-border bg-surface-2 text-text-sec hover:border-gray-200 hover:text-text-primary'
                        }`}
                      >
                        {CONTENT_POSTING_FLOW_LABELS[flow]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
                  {selectedAgentConfig.fields.map(field => {
                    const type = field.type ?? 'text'
                    const columnSpan = field.columns === 1 ? 6 : field.columns === 3 ? 2 : 3
                    const spanClass = columnSpan === 6 ? 'sm:col-span-6' : columnSpan === 2 ? 'sm:col-span-2' : 'sm:col-span-3'
                    const controlClass = 'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary'

                    return (
                      <label key={field.key} className={`grid gap-1.5 ${spanClass}`}>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                          {field.label}
                        </span>
                        {type === 'select' ? (
                          <select
                            value={selectedAgentForm[field.key] ?? ''}
                            onChange={e => {
                              if (selectedAgent === 'content_posting') {
                                updateContentPostingForm(contentPostingFlow, field.key, e.target.value)
                              } else {
                                updateAgentForm(selectedAgent, field.key, e.target.value)
                              }
                            }}
                            className={controlClass}
                          >
                            {(field.options ?? []).map(option => <option key={option}>{option}</option>)}
                          </select>
                        ) : type === 'textarea' ? (
                          <textarea
                            value={selectedAgentForm[field.key] ?? ''}
                            onChange={e => {
                              if (selectedAgent === 'content_posting') {
                                updateContentPostingForm(contentPostingFlow, field.key, e.target.value)
                              } else {
                                updateAgentForm(selectedAgent, field.key, e.target.value)
                              }
                            }}
                            rows={field.columns === 1 ? 4 : 3}
                            placeholder={field.placeholder}
                            className={`${controlClass} resize-y leading-6`}
                          />
                        ) : (
                          <input
                            value={selectedAgentForm[field.key] ?? ''}
                            onChange={e => {
                              if (selectedAgent === 'content_posting') {
                                updateContentPostingForm(contentPostingFlow, field.key, e.target.value)
                              } else {
                                updateAgentForm(selectedAgent, field.key, e.target.value)
                              }
                            }}
                            placeholder={field.placeholder}
                            className={controlClass}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                    Additional instructions
                  </span>
                  <textarea
                    value={taskInstructions}
                    onChange={e => setTaskInstructions(e.target.value)}
                    placeholder={`Optional: add anything specific ${AGENTS[selectedAgent].name} should know for this run.`}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary"
                  />
                </label>

                {isSinglePostSelected && (
                  <div className="mt-4">
                    <PostImageAttach
                      disabled={submitting}
                      attached={postImageMedia ? {
                        previewUrl: postImageMedia.previewUrl,
                        filename: postImageMedia.filename,
                      } : null}
                      onAttached={media => {
                        setPostImageRequiredError(null)
                        setPostImageMedia(media)
                      }}
                      onClear={() => setPostImageMedia(null)}
                    />
                    {postImageRequiredError && (
                      <p className="mt-2 text-sm text-red-600">{postImageRequiredError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                {(['normal', 'high'] as const).map(p => (
                  <button key={p} onClick={() => setTaskPriority(p)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      taskPriority === p
                        ? 'border border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border border-border bg-surface-2 text-text-sec hover:border-border-strong'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateTask}
                disabled={submitting || submitted || (isSinglePostSelected && !postImageMedia)}
                className={`ml-auto min-w-[180px] rounded-xl px-5 py-3 text-sm font-semibold text-text-inverse transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  submitted ? 'bg-status-success' : 'bg-brand-primary hover:bg-[#2563EB]'
                }`}
              >
                {submitted ? 'Task queued' : submitting ? 'Queuing...' : `Run ${AGENTS[selectedAgent].name}`}
              </button>
            </div>

            {/* Constraints section */}
            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                    What this agent will never do
                  </p>
                  <p className="mt-1 text-xs text-text-sec">
                    Brand safety guardrails applied to every run.
                  </p>
                </div>
                {isCustomized && (
                  <span className="flex-shrink-0 rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-semibold text-status-success">
                    Customized
                  </span>
                )}
              </div>

              {/* Template quick-insert buttons */}
              <div className="mb-3 flex flex-wrap gap-2">
                {CONSTRAINT_TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setConstraints(prev => prev ? `${prev}\n${t.text}` : t.text)}
                    className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-sec transition-colors hover:border-gray-200 hover:text-text-primary"
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
                className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary"
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {constraints !== savedConstraints && (
                  <button
                    onClick={handleSaveConstraints}
                    disabled={savingConstraints}
                    className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-text-inverse transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingConstraints ? 'Saving…' : 'Save constraints'}
                  </button>
                )}
                {constraintsSaved && (
                  <span className="text-xs font-medium text-status-success">Constraints saved</span>
                )}
                {constraintsLastUpdated && !constraintsSaved && (
                  <span className="text-xs text-text-muted">
                    Last updated {relativeTime(constraintsLastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedAgent && (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-text-sec">
            Select an agent above to get started
          </div>
        )}
      </div>

      {/* ═══ ZONE 1: Approval Queue Banner ═══ */}
      {pendingApprovals.length > 0 ? (
        <Link
          href="/dashboard/agents/approvals"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-brand-primary/25 bg-brand-primary/5 p-5 no-underline transition-colors hover:border-brand-primary/50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary">
              <span className="text-sm font-bold text-text-inverse">{pendingApprovals.length}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {pendingApprovals.length} output{pendingApprovals.length !== 1 ? 's' : ''} waiting for your review
              </p>
              <p className="mt-1 truncate text-xs text-text-sec">
                {[...new Set(pendingApprovals.map(t => agentDisplayName(t.agent)))].slice(0, 3).join(', ')}
                {pendingApprovals.length > 3 ? ` +${pendingApprovals.length - 3} more` : ''}
              </p>
            </div>
          </div>
          <span className="flex-shrink-0 text-sm font-semibold text-brand-primary">Review</span>
        </Link>
      ) : (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5">
          <i className="ti ti-circle-check text-status-success" style={{ fontSize: 16 }} />
          <span className="text-sm text-text-sec">Queue is clear. Nothing is waiting for review.</span>
        </div>
      )}

      {/* ═══ ZONE 2: Agent Activity ═══ */}
      <div className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.25fr]">

        {/* Left: Live feed */}
        <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Live activity</p>

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
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Running now</p>
                  {runningTasks.map(t => {
                    const def = AGENTS[t.agent as AgentId]
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-status-success" style={{ animation: 'dotPulse 1.5s ease-in-out infinite' }} />
                        <i className={`ti ${def?.icon ?? 'ti-robot'} text-text-sec`} style={{ fontSize: 14 }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">{relativeTime(t.started_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {queuedTasks.length > 0 && (
                <div className="mb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Queued</p>
                  {queuedTasks.map(t => {
                    const def = AGENTS[t.agent as AgentId]
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-border" />
                        <i className={`ti ${def?.icon ?? 'ti-robot'} text-text-muted`} style={{ fontSize: 14 }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-sec">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">Waiting</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {completedToday.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Completed today</p>
                  {completedToday.map(t => {
                    const def = AGENTS[t.agent as AgentId]
                    return (
                      <div key={t.id} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                        <i className="ti ti-check text-status-success" style={{ fontSize: 13 }} />
                        <i className={`ti ${def?.icon ?? 'ti-robot'} text-text-muted`} style={{ fontSize: 14 }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-sec">{agentDisplayName(t.agent)}</p>
                        </div>
                        <span className="text-xs text-text-muted">{relativeTime(t.completed_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTasks.length === 0 && completedToday.length === 0 && (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2">
                    <i className="ti ti-robot text-text-muted" style={{ fontSize: 18 }} />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Your agents are ready.</p>
                  <p className="mt-1 text-xs text-text-muted">Run an agent to see live activity here.</p>
                </div>
              )}
            </>
          )}

          {/* Recent orchestrations */}
          {!activeOrchestration && recentOrchestrations.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">Recent runs</p>
              {recentOrchestrations.map(orch => (
                <div key={orch.id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                  <div>
                    <p className="text-xs font-medium capitalize text-text-primary">
                      {orch.triggered_by.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {orch.completed_tasks} agents · {relativeTime(orch.completed_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-text-sec">${(orch.total_cost_usd ?? 0).toFixed(4)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      orch.budget_exceeded
                        ? 'bg-status-warning/10 text-status-warning'
                        : 'bg-status-success/10 text-status-success'
                    }`}>
                      {orch.budget_exceeded ? 'budget hit' : 'completed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Scorecard */}
        <div className="min-w-0 max-h-[360px] overflow-y-auto overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Agent scorecard</p>
          <div className="grid min-w-[440px] grid-cols-[1fr_auto_auto_auto] items-center gap-x-4">
            {/* Header */}
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Agent</span>
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Last run</span>
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Outputs</span>
            <span className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">Status</span>

            {scorecardWithLiveCounts.map(entry => (
              <Fragment key={entry.agentId}>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} className="flex items-center gap-2 border-b border-border py-2.5 no-underline">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: AGENT_COLORS[entry.agentId as AgentId]?.bg ?? '#F3F4F6',
                      color: AGENT_COLORS[entry.agentId as AgentId]?.fg ?? '#6B7280',
                    }}
                  >
                    <i className={`ti ${entry.icon}`} style={{ fontSize: 13 }} />
                  </span>
                  <span className="whitespace-nowrap text-sm font-medium text-text-primary">{entry.name}</span>
                </Link>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} className="whitespace-nowrap border-b border-border py-2.5 text-xs text-text-sec no-underline">
                  {relativeTime(entry.lastRunAt)}
                </Link>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} className={`border-b border-border py-2.5 text-center text-xs no-underline ${entry.totalOutputs > 0 ? 'font-semibold text-brand-primary' : 'text-text-sec'}`}>
                  {entry.totalOutputs}
                </Link>
                <Link href={`/dashboard/agents/${entry.agentId}/outputs`} className="border-b border-border py-2.5 no-underline">
                  {entry.isScheduled ? (
                    <span className="rounded-full bg-status-success/10 px-2 py-1 text-[11px] font-semibold text-status-success">Active</span>
                  ) : (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-sec">Idle</span>
                  )}
                </Link>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ ZONE 2B: Agent Outputs ═══ */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Recent outputs</p>
            <p className="mt-1 text-sm text-text-sec">Open an output archive to read the full result.</p>
          </div>
          <Link href="/dashboard/agents/approvals" className="text-sm font-semibold text-brand-primary hover:underline">
            Review approvals
          </Link>
        </div>

        {latestOutputs.length > 0 ? (
          <div className="grid gap-2">
            {latestOutputs.map(output => {
              const agent = AGENTS[output.agent as AgentId]
              const displayName = isLegacyContentAgent(output.agent)
                ? AGENTS.content_posting.name
                : (agent?.name ?? output.agent)
              return (
                <Link
                  key={output.id}
                  href={`/dashboard/agents/${output.agent}/outputs?output=${output.id}`}
                  className="flex min-w-0 items-center justify-between gap-4 overflow-hidden rounded-xl border border-gray-100 bg-white px-4 py-3 no-underline transition-colors hover:border-gray-200 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {getOutputDescription(output)}
                    </p>
                    <p className="mt-1 text-xs text-text-sec">
                      {displayName} · {relativeTime(output.created_at)} · {output.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-brand-primary">Open</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-text-sec">
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
