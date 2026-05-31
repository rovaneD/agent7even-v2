export type AgentId =
  | 'competitor_watcher'
  | 'weekly_content'
  | 'campaign_builder'
  | 'performance_digest'
  | 'trend_spotter'
  | 'email_sequence_builder'
  | 'ad_variations'
  | 'seo_scanner'
  | 'brand_voice_guardian'

export type AgentTrigger = 'user' | 'maya' | 'scheduled' | 'event'

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
}

export const AGENTS: Record<AgentId, AgentDefinition> = {
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
  },
  weekly_content: {
    id: 'weekly_content',
    name: 'Weekly Content',
    description: 'Drafts your social posts and emails so you don\'t have to',
    icon: 'ti-pencil',
    autonomyLevel: 'approval_required',
    outputType: 'content',
    model: 'anthropic/claude-haiku-4',
    defaultConstraints: `Never make specific income or results claims without disclaimer. Never use urgency tactics like "limited time" unless explicitly provided by the client. Never post content that hasn't been approved if autonomy is set to approval_required. Always stay within the brand voice defined in Brand Kit.`,
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
  },
  ad_variations: {
    id: 'ad_variations',
    name: 'Ad Variations',
    description: 'Creates multiple ad options so you can test without writing each one',
    icon: 'ti-speakerphone',
    autonomyLevel: 'approval_required',
    outputType: 'ad_copy',
    model: 'anthropic/claude-haiku-4',
    defaultConstraints: `Never make before/after claims without client-provided proof. Never use superlatives like "best" or "number one" without substantiation. Never write copy that targets protected characteristics. Never promise specific results (e.g. "get 100 leads in 30 days").`,
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
  },
  brand_voice_guardian: {
    id: 'brand_voice_guardian',
    name: 'Brand Voice Guardian',
    description: 'Reviews all content against your brand voice before it goes out',
    icon: 'ti-shield-check',
    autonomyLevel: 'autonomous',
    outputType: 'brand_review',
    model: 'anthropic/claude-haiku-4',
    defaultConstraints: `Never approve content that contradicts the Brand Kit positioning. Never override explicit client instructions about tone even if they differ from the Brand Kit. Always explain why content was flagged — never just reject without reasoning.`,
  },
}

export const AUTONOMOUS_AGENTS = Object.values(AGENTS)
  .filter(a => a.autonomyLevel === 'autonomous')
  .map(a => a.id)

export const APPROVAL_REQUIRED_AGENTS = Object.values(AGENTS)
  .filter(a => a.autonomyLevel === 'approval_required')
  .map(a => a.id)
