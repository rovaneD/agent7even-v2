import { createServiceClient } from '@/lib/supabase/server'
import { resolveContentPostingFlow } from '@/lib/agents/contentPosting'
import { AGENTS, type AgentId } from './registry'

type AgentInput = Record<string, unknown>

type AgentFlow = {
  role: string
  requires: string[]
  outputContract: string
  contextBuilder?: (userId: string, input: AgentInput) => Promise<string>
  defaultUserMessage: (input: AgentInput) => string
}

type AgentOutputRow = {
  agent: string
  title: string | null
  content: unknown
  status: string
  created_at: string
}

function inputText(input: AgentInput, key: string): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim() : ''
}

function stringify(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function outputText(output: AgentOutputRow): string {
  const content = output.content as { raw?: unknown; parsed?: unknown } | string | null
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content.raw === 'string') return content.raw
  if (content.parsed) return stringify(content.parsed)
  return stringify(content)
}

async function recentOutputsContext(userId: string, agents: string[], limit = 5): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('agent_outputs')
    .select('agent, title, content, status, created_at')
    .eq('user_id', userId)
    .in('agent', agents)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data?.length) return 'No prior relevant agent outputs are saved.'

  return data.map((row: AgentOutputRow) => {
    const preview = outputText(row).slice(0, 1200)
    return `## ${row.title ?? row.agent} (${row.status}, ${row.created_at})\n${preview}`
  }).join('\n\n')
}

async function campaignsContext(userId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('campaigns')
    .select('title, status, plan, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3)

  if (!data?.length) return 'No saved campaigns yet.'
  return stringify(data)
}

async function analyticsContext(userId: string, input: AgentInput): Promise<string> {
  const supabase = createServiceClient()
  const [{ data: profile }, campaigns] = await Promise.all([
    supabase
      .from('profiles')
      .select('ga_connected, ga_measurement_id, meta_connected, meta_ad_account_id, meta_ig_account_id, instagram_handle')
      .eq('id', userId)
      .single(),
    campaignsContext(userId),
  ])

  const providedSnapshot = input.analyticsSnapshot ?? input.analytics ?? null

  return `## Analytics Availability
- Google Analytics connected: ${profile?.ga_connected ? 'yes' : 'no'}
- GA property: ${profile?.ga_measurement_id ?? 'not selected'}
- Meta connected: ${profile?.meta_connected ? 'yes' : 'no'}
- Meta ad account: ${profile?.meta_ad_account_id ?? 'not selected'}
- Instagram business account: ${profile?.meta_ig_account_id ?? 'not selected'}
- Instagram handle: ${profile?.instagram_handle ?? 'not set'}

## Provided Analytics Snapshot
${providedSnapshot ? stringify(providedSnapshot) : 'No raw analytics snapshot was provided in this run.'}

## Recent Campaigns
${campaigns}`
}

async function websiteSnapshotContext(userId: string, input: AgentInput): Promise<string> {
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('website_url')
    .eq('id', userId)
    .single()

  const websiteUrl = inputText(input, 'websiteUrl') || profile?.website_url
  if (!websiteUrl) return 'No website URL is saved on the profile.'

  try {
    const res = await fetch(websiteUrl, { signal: AbortSignal.timeout(8000) })
    const html = await res.text()
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''
    const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim() ?? ''
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 5)
    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 10)
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i)?.[1]?.trim() ?? ''

    return `## Website Snapshot
- URL: ${websiteUrl}
- Fetch status: ${res.status}
- Title: ${title || 'missing'}
- Meta description: ${description || 'missing'}
- Canonical: ${canonical || 'missing'}
- H1s: ${h1s.length ? h1s.join(' | ') : 'none found'}
- H2s: ${h2s.length ? h2s.join(' | ') : 'none found'}`
  } catch (err) {
    return `## Website Snapshot
- URL: ${websiteUrl}
- Fetch failed: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function brandReviewContext(userId: string, input: AgentInput): Promise<string> {
  const explicitContent = inputText(input, 'content') || inputText(input, 'reviewContent') || inputText(input, 'contentToReview')
  if (explicitContent) return `## Content To Review\n${explicitContent}`

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('agent_outputs')
    .select('agent, title, content, status, created_at')
    .eq('user_id', userId)
    .in('agent', ['weekly_content', 'campaign_builder', 'email_sequence_builder', 'ad_variations'])
    .order('created_at', { ascending: false })
    .limit(1)

  const latest = data?.[0] as AgentOutputRow | undefined
  if (!latest) return 'No explicit content was provided and no recent creative output exists to review.'

  return `## Content To Review
Source: ${latest.title ?? latest.agent} (${latest.created_at})
${outputText(latest)}`
}

async function competitorContext(userId: string): Promise<string> {
  return recentOutputsContext(userId, ['competitor_watcher'], 3)
}

async function contentPlanningContext(userId: string): Promise<string> {
  const [campaigns, prior] = await Promise.all([
    campaignsContext(userId),
    recentOutputsContext(userId, ['weekly_content', 'campaign_builder', 'trend_spotter', 'performance_digest'], 5),
  ])

  return `## Recent Campaigns
${campaigns}

## Relevant Prior Agent Work
${prior}`
}

async function offerContext(userId: string): Promise<string> {
  const [campaigns, prior] = await Promise.all([
    campaignsContext(userId),
    recentOutputsContext(userId, ['campaign_builder', 'weekly_content', 'performance_digest'], 5),
  ])

  return `## Recent Campaigns
${campaigns}

## Relevant Prior Agent Work
${prior}`
}

export const AGENT_FLOWS: Record<AgentId, AgentFlow> = {
  competitor_watcher: {
    role: 'Competitive intelligence watcher. Use Foundation competitors first. Do not ask for competitor names when Foundation provides them.',
    requires: ['competitors from Foundation or user input', 'client positioning', 'one action recommendation'],
    outputContract: 'Return sections: What they are doing, What is working for them, The gap, Your move. Name the competitors when known.',
    contextBuilder: competitorContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Run the competitor watch using the Foundation competitors and produce a competitive read.',
  },
  weekly_content: {
    role: 'Weekly content planner and copywriter. Produce ready-to-use social/email content in the documented brand voice.',
    requires: ['brand voice', 'current campaign or monthly goal', 'platform/channel assumptions if not provided'],
    outputContract: 'Return a 7-day content plan with platform, post concept, caption/body copy, CTA, and any approval notes.',
    contextBuilder: contentPlanningContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Create this week’s content plan from the current brand, Foundation, campaigns, and recent agent work.',
  },
  post_caption: {
    role: 'Single-post caption writer. The user attaches the exact image they plan to publish; write one caption that fits that image in brand voice.',
    requires: ['platform', 'attached post image', 'brand voice from Foundation', 'post goal or CTA if provided'],
    outputContract: 'Return ONLY one social caption — no headings, no quotes, no markdown, no weekly plan, no alternate versions unless explicitly asked.',
    contextBuilder: userId => recentOutputsContext(userId, ['post_caption', 'content_posting', 'weekly_content'], 3),
    defaultUserMessage: input => inputText(input, 'instructions') || 'Write one social caption for the attached post image using the setup details, platform limits, and Foundation context.',
  },
  content_posting: {
    role: 'Content posting operator. Single post: caption for an attached image. Weekly: plan a week of posts and emails.',
    requires: ['contentFlow: single | weekly', 'brand voice from Foundation', 'flow-specific setup fields'],
    outputContract: 'Single post: one caption only. Weekly: 7-day content plan with platform, concept, copy, CTA, and approval notes.',
    contextBuilder: async (userId, input) => {
      const effectiveId = resolveContentPostingFlow(input) === 'weekly' ? 'weekly_content' : 'post_caption'
      const builder = AGENT_FLOWS[effectiveId].contextBuilder
      return builder ? builder(userId, input) : ''
    },
    defaultUserMessage: input => {
      const effectiveId = resolveContentPostingFlow(input) === 'weekly' ? 'weekly_content' : 'post_caption'
      return AGENT_FLOWS[effectiveId].defaultUserMessage(input)
    },
  },
  campaign_builder: {
    role: '30-day campaign strategist. Build an executable campaign, not a vague strategy document.',
    requires: ['goal', 'audience', 'offer/product', 'budget or budget assumption', 'channels'],
    outputContract: 'Return overview, weekly plan, content calendar, email sequence, budget allocation, success metrics, and day-one actions.',
    contextBuilder: offerContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Build a complete 30-day campaign using the current Foundation, brand context, goals, and recent agent findings.',
  },
  performance_digest: {
    role: 'Performance analyst. Convert analytics and campaign context into decisions.',
    requires: ['analytics snapshot or connected account status', 'recent campaigns', 'clear next action'],
    outputContract: 'Return The headline, Top 3 signals, Diagnosis, Next action, and Data gaps. Never invent metrics.',
    contextBuilder: analyticsContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Create a performance digest from the available analytics snapshot, connected account status, and recent campaigns.',
  },
  trend_spotter: {
    role: 'Trend scout. Separate relevant trend opportunities from noise for this specific business.',
    requires: ['industry/niche from Foundation', 'brand fit', 'time-sensitive content plays'],
    outputContract: 'Return What is moving, Relevance score, The play, Expiry estimate, and Source/data limitations. Do not fabricate live trend evidence.',
    contextBuilder: userId => recentOutputsContext(userId, ['trend_spotter', 'competitor_watcher', 'weekly_content'], 5),
    defaultUserMessage: input => inputText(input, 'instructions') || 'Spot the most relevant trend opportunities for this business using current brand/Foundation context and any provided trend inputs.',
  },
  email_sequence_builder: {
    role: 'Email strategist. Build complete flows with subject lines, preview text, body copy, and CTA.',
    requires: ['sequence type', 'list/source', 'offer/product', 'desired outcome'],
    outputContract: 'Return each email with subject, alternate subject, preview text, body copy, CTA, timing, and compliance notes. Label fields for manual paste into an ESP (Mailchimp, Klaviyo, etc.) — not a bulk-import file format.',
    contextBuilder: offerContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Build the email sequence that best supports the current campaign, offer, and Foundation context.',
  },
  ad_variations: {
    role: 'Ad variation generator. Produce test-ready ads for specific platforms and audiences.',
    requires: ['offer', 'audience', 'platform/ad format', 'proof or constraints'],
    outputContract: 'Return at least 3 variations with headline, primary text, CTA, format note, audience angle, and compliance risk.',
    contextBuilder: offerContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Create ad variations that support the current campaign and brand positioning.',
  },
  seo_scanner: {
    role: 'SEO auditor. Prioritize fixes a small business can actually execute.',
    requires: ['website URL', 'business niche', 'prioritized fixes'],
    outputContract: 'Return Critical issues, Quick wins, Content gaps, Technical notes, and exact fixes. Use fetched site snapshot when available.',
    contextBuilder: websiteSnapshotContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Run an SEO scan using the saved website URL and Foundation context.',
  },
  brand_voice_guardian: {
    role: 'Brand editor. Review specific content against brand voice and positioning.',
    requires: ['content to review', 'brand voice/positioning documents', 'specific flags and replacements'],
    outputContract: 'Return Tone check, Vocabulary check, Message check, Audience check, Flags with suggested replacements, and approval recommendation.',
    contextBuilder: brandReviewContext,
    defaultUserMessage: input => inputText(input, 'instructions') || 'Review the supplied or latest creative content against the Brand Kit and Foundation voice.',
  },
}

function effectiveContentFlowAgentId(agentId: AgentId, input: AgentInput): AgentId {
  if (agentId !== 'content_posting') return agentId
  return resolveContentPostingFlow(input) === 'weekly' ? 'weekly_content' : 'post_caption'
}

export async function buildAgentFlowPrompt(userId: string, agentId: AgentId, input: AgentInput): Promise<string> {
  const effectiveId = effectiveContentFlowAgentId(agentId, input)
  const flow = AGENT_FLOWS[effectiveId]
  const extraContext = flow.contextBuilder ? await flow.contextBuilder(userId, input) : ''
  const agent = AGENTS[agentId]
  const flowLabel = agentId === 'content_posting'
    ? (resolveContentPostingFlow(input) === 'weekly' ? 'Weekly content' : 'Single post')
    : null

  return `AGENT-SPECIFIC FLOW — ${agent.name}${flowLabel ? ` (${flowLabel})` : ''}

Role:
${flow.role}

Required task inputs/context:
${flow.requires.map(item => `- ${item}`).join('\n')}

Output contract:
${flow.outputContract}

Flow rules:
- Use the provided client, Foundation, Brand Kit, campaign, analytics, website, and prior-output context before asking for anything.
- If required information is missing, still produce the most useful safe output possible and include a short "Missing inputs" section.
- Do not pretend unavailable data was fetched or verified.
- Do not ask broad setup questions when a reasonable assumption can be stated and used.

${extraContext ? `Additional agent-specific context:\n${extraContext}` : ''}`
}

export function buildAgentUserMessage(agentId: AgentId, input: AgentInput): string {
  if (agentId === 'content_posting') {
    return AGENT_FLOWS.content_posting.defaultUserMessage(input)
  }
  return AGENT_FLOWS[agentId].defaultUserMessage(input)
}
