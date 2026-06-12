import { buildImageContextAgentConstraints } from '@/lib/posts/imageContextCapabilities'
import { isCommandCenterAgent } from '@/lib/agents/contentPosting'

export type AgentId =
  | 'competitor_watcher'
  | 'content_posting'
  | 'weekly_content'
  | 'post_caption'
  | 'campaign_builder'
  | 'performance_digest'
  | 'trend_spotter'
  | 'email_sequence_builder'
  | 'ad_variations'
  | 'seo_scanner'
  | 'brand_voice_guardian'

export type AgentTrigger = 'user' | 'maya' | 'scheduled' | 'event'

export type FoundationSectionKey = 'business' | 'customer' | 'position' | 'voice' | 'plan' | 'memory'

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  icon: string
  autonomyLevel: 'autonomous' | 'approval_required'
  defaultSchedule?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    dayOfWeek?: number
    hourOfDay?: number
  }
  outputType: string
  model: string
  defaultConstraints: string
  /** Foundation sections this agent reads when generating */
  foundationSections: FoundationSectionKey[]
  /** Sections where thin content materially degrades this agent's output */
  warnIfThinSections: FoundationSectionKey[]
}

export const AGENTS: Record<AgentId, AgentDefinition> = {
  content_posting: {
    id: 'content_posting',
    name: 'Content Posting',
    description: 'Single post with your image, or plan a week of content',
    icon: 'ti-image',
    autonomyLevel: 'approval_required',
    outputType: 'content_posting',
    model: 'anthropic/claude-haiku-4-5',
    defaultConstraints: `Never make specific income or results claims without disclaimer. Never use urgency tactics like "limited time" unless explicitly provided by the client. Never post content that hasn't been approved if autonomy is set to approval_required. Always stay within the brand voice defined in Brand Kit. ${buildImageContextAgentConstraints()}`,
    foundationSections: ['business', 'voice', 'memory'],
    warnIfThinSections: ['voice'],
  },
  post_caption: {
    id: 'post_caption',
    name: 'Post Caption',
    description: 'Attach one image — Maya writes the caption to match what\'s in the frame',
    icon: 'ti-image',
    autonomyLevel: 'approval_required',
    outputType: 'post_caption',
    model: 'anthropic/claude-haiku-4-5',
    defaultConstraints: `Never make specific income or results claims without disclaimer. Never use urgency tactics like "limited time" unless explicitly provided by the client. Always stay within the brand voice defined in Brand Kit. ${buildImageContextAgentConstraints()}`,
    foundationSections: ['business', 'voice', 'memory'],
    warnIfThinSections: ['voice'],
  },
  competitor_watcher: {
    id: 'competitor_watcher',
    name: 'Competitor Watcher',
    description: 'Monitors your competitors and surfaces what\'s working for them',
    icon: 'ti-eye',
    autonomyLevel: 'autonomous',
    defaultSchedule: { frequency: 'weekly', dayOfWeek: 1, hourOfDay: 8 },
    outputType: 'competitor_report',
    model: 'google/gemini-2.5-flash',
    defaultConstraints: `Never disparage competitors by name. Never make claims about competitor products that aren't publicly verifiable. Never suggest illegal or unethical competitive tactics.`,
    foundationSections: ['position'],
    warnIfThinSections: ['position'],
  },
  weekly_content: {
    id: 'weekly_content',
    name: 'Weekly Content',
    description: 'Plans a week of posts and emails — copy only, no image upload',
    icon: 'ti-pencil',
    autonomyLevel: 'approval_required',
    outputType: 'content',
    model: 'anthropic/claude-haiku-4-5',
    defaultConstraints: `Never make specific income or results claims without disclaimer. Never use urgency tactics like "limited time" unless explicitly provided by the client. Never post content that hasn't been approved if autonomy is set to approval_required. Always stay within the brand voice defined in Brand Kit.`,
    foundationSections: ['business', 'voice', 'memory'],
    warnIfThinSections: ['voice'],
  },
  campaign_builder: {
    id: 'campaign_builder',
    name: 'Campaign Builder',
    description: 'Builds complete 30-day marketing campaigns',
    icon: 'ti-rocket',
    autonomyLevel: 'approval_required',
    outputType: 'campaign',
    model: 'anthropic/claude-sonnet-4',
    defaultConstraints: `Never promise specific ROI or revenue outcomes. Never recommend ad spend above the client's stated marketing budget. Never build campaigns targeting demographics that conflict with the client's stated audience. Always flag if a campaign strategy requires budget the client hasn't confirmed.`,
    foundationSections: ['business', 'customer', 'position', 'plan', 'memory'],
    warnIfThinSections: [],
  },
  performance_digest: {
    id: 'performance_digest',
    name: 'Performance Digest',
    description: 'Surfaces what\'s working and what to do about it',
    icon: 'ti-chart-bar',
    autonomyLevel: 'autonomous',
    defaultSchedule: { frequency: 'daily', hourOfDay: 7 },
    outputType: 'analytics_insight',
    model: 'google/gemini-2.5-flash',
    defaultConstraints: `Never draw conclusions from fewer than 7 days of data without flagging the sample size. Never recommend stopping a channel based on a single week of poor performance. Never share raw data in outputs — always summarize with context.`,
    foundationSections: ['plan', 'memory'],
    warnIfThinSections: [],
  },
  trend_spotter: {
    id: 'trend_spotter',
    name: 'Trend Spotter',
    description: 'Monitors industry trends and viral content in your niche',
    icon: 'ti-trending-up',
    autonomyLevel: 'autonomous',
    defaultSchedule: { frequency: 'daily', hourOfDay: 6 },
    outputType: 'trend_report',
    model: 'google/gemini-2.5-flash',
    defaultConstraints: `Never recommend jumping on a trend without checking brand fit first. Never surface trends related to politics, religion, or sensitive social topics unless explicitly asked. Never present a trend as an opportunity without noting the timing risk.`,
    foundationSections: ['business', 'plan', 'memory'],
    warnIfThinSections: [],
  },
  email_sequence_builder: {
    id: 'email_sequence_builder',
    name: 'Email Sequence Builder',
    description: 'Builds complete email flows — welcome, nurture, promotional',
    icon: 'ti-mail',
    autonomyLevel: 'approval_required',
    outputType: 'email_sequence',
    model: 'anthropic/claude-sonnet-4',
    defaultConstraints: `Never include discount offers or pricing without explicit client approval. Never make delivery or timeline promises. Never send to unsubscribed contacts. Always include an unsubscribe mechanism. Never use deceptive subject lines.`,
    foundationSections: ['business', 'customer', 'voice', 'memory'],
    warnIfThinSections: ['voice'],
  },
  ad_variations: {
    id: 'ad_variations',
    name: 'Ad Variations',
    description: 'Creates multiple ad options so you can test without writing each one',
    icon: 'ti-speakerphone',
    autonomyLevel: 'approval_required',
    outputType: 'ad_copy',
    model: 'anthropic/claude-haiku-4-5',
    defaultConstraints: `Never make before/after claims without client-provided proof. Never use superlatives like "best" or "number one" without substantiation. Never write copy that targets protected characteristics. Never promise specific results (e.g. "get 100 leads in 30 days").`,
    foundationSections: ['business', 'customer', 'position', 'voice'],
    warnIfThinSections: ['customer', 'voice'],
  },
  seo_scanner: {
    id: 'seo_scanner',
    name: 'SEO Scanner',
    description: 'Audits your website and suggests improvements',
    icon: 'ti-search',
    autonomyLevel: 'autonomous',
    defaultSchedule: { frequency: 'weekly', dayOfWeek: 1, hourOfDay: 9 },
    outputType: 'seo_report',
    model: 'anthropic/claude-sonnet-4',
    defaultConstraints: `Never recommend black-hat SEO tactics (keyword stuffing, cloaking, paid links). Never suggest removing existing content without explaining the traffic risk. Never make specific ranking guarantees.`,
    foundationSections: ['position'],
    warnIfThinSections: ['position'],
  },
  brand_voice_guardian: {
    id: 'brand_voice_guardian',
    name: 'Brand Voice Guardian',
    description: 'Reviews all content against your brand voice before it goes out',
    icon: 'ti-shield-check',
    autonomyLevel: 'autonomous',
    outputType: 'brand_review',
    model: 'anthropic/claude-haiku-4-5',
    defaultConstraints: `Never approve content that contradicts the Brand Kit positioning. Never override explicit client instructions about tone even if they differ from the Brand Kit. Always explain why content was flagged — never just reject without reasoning.`,
    foundationSections: ['voice', 'memory'],
    warnIfThinSections: ['voice'],
  },
}

export const AUTONOMOUS_AGENTS = Object.values(AGENTS)
  .filter(a => a.autonomyLevel === 'autonomous')
  .map(a => a.id)

export const APPROVAL_REQUIRED_AGENTS = Object.values(AGENTS)
  .filter(a => a.autonomyLevel === 'approval_required')
  .map(a => a.id)

/** Agents shown in Command Center (legacy content agents hidden). */
export const COMMAND_CENTER_AGENTS = Object.values(AGENTS).filter(a => isCommandCenterAgent(a.id))

export const AGENT_COLORS: Record<AgentId, { bg: string; fg: string }> = {
  competitor_watcher:     { bg: '#C5F9CD', fg: '#15803D' },
  content_posting:        { bg: '#DBEAFE', fg: '#1D4ED8' },
  weekly_content:         { bg: '#C5EFF9', fg: '#0369A1' },
  post_caption:           { bg: '#DBEAFE', fg: '#1D4ED8' },
  campaign_builder:       { bg: '#F7C5F9', fg: '#7E22CE' },
  performance_digest:     { bg: '#C5F9EC', fg: '#0F766E' },
  trend_spotter:          { bg: '#FFE3AD', fg: '#92400E' },
  email_sequence_builder: { bg: '#EAE1F9', fg: '#6D28D9' },
  ad_variations:          { bg: '#E6F4AD', fg: '#3F6212' },
  seo_scanner:            { bg: '#AFDAF7', fg: '#075985' },
  brand_voice_guardian:   { bg: '#E2F7F2', fg: '#065F46' },
}
