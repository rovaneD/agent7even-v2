import { AGENTS, type AgentId } from '@/lib/agents/registry'
import { isCommandCenterAgent } from '@/lib/agents/contentPosting'

export type GuidedFieldType = 'text' | 'textarea' | 'select'

export interface GuidedField {
  key: string
  label: string
  placeholder?: string
  type?: GuidedFieldType
  options?: string[]
  columns?: 1 | 2 | 3
}

export interface AgentGuidedConfig {
  intro: string
  fields: GuidedField[]
}

export const AGENT_GUIDED_CONFIG: Record<AgentId, AgentGuidedConfig> = {
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
    intro: 'Build draft copy for each email — you paste subject, preview, and body into your email tool (Mailchimp, Klaviyo, etc.) one email at a time.',
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
  idea_analysis: {
    intro: 'Paste a post URL or describe your topic. Maya returns a Foundation-grounded analysis you can turn into Viral Hooks — no re-typing.',
    fields: [
      { key: 'sourceType', label: 'Source', type: 'select', options: ['Pasted URL', 'My own topic'], columns: 3 },
      { key: 'platform', label: 'Platform / format', type: 'select', options: ['Instagram Reel', 'TikTok', 'YouTube Short', 'Carousel', 'LinkedIn post', 'Email hook'], columns: 3 },
      { key: 'sourceUrl', label: 'Post URL', placeholder: 'https://instagram.com/reel/... or any public post link', columns: 3 },
      { key: 'topic', label: 'Your topic', placeholder: 'The idea you want to adapt — offer, pain point, or angle', columns: 2 },
      { key: 'contentNotes', label: 'What stood out', type: 'textarea', placeholder: 'Hook, caption snippet, offer, or why this idea is worth adapting (especially if the URL is paywalled).', columns: 2 },
    ],
  },
}

export const INITIAL_AGENT_FORMS = Object.fromEntries(
  Object.entries(AGENT_GUIDED_CONFIG).map(([agentId, config]) => [
    agentId,
    Object.fromEntries(config.fields.map(field => [field.key, field.options?.[0] ?? ''])),
  ]),
) as Record<AgentId, Record<string, string>>

export function buildGuidedInstructions(
  agentId: AgentId,
  form: Record<string, string>,
  extraInstructions: string,
): string {
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

export const AGENT_CONSTRAINT_TEMPLATES = [
  { label: 'No discounting', text: 'Never offer discounts, promotions, or reduced pricing without explicit client approval.' },
  { label: 'No delivery promises', text: 'Never promise specific delivery timelines, turnaround times, or completion dates.' },
  { label: 'No competitor mentions', text: 'Never name or reference specific competitors by name.' },
  { label: 'Route pricing to human', text: 'Always direct pricing and cost questions to a human team member.' },
  { label: 'No guarantees', text: 'Never promise specific results, outcomes, rankings, or revenue figures.' },
  { label: 'No sensitive topics', text: 'Never engage with political, religious, or controversial social topics.' },
] as const

export function agentRunHref(agentId: AgentId): string {
  if (agentId === 'content_posting') return '/dashboard/agents/content-posting'
  return `/dashboard/agents/${agentId}/run`
}

export function isAgentRunPageId(value: string): value is AgentId {
  return value in AGENTS && isCommandCenterAgent(value as AgentId) && value !== 'content_posting'
}
