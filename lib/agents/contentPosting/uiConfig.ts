import { AGENTS } from '@/lib/agents/registry'
import { CONTENT_POSTING_FLOW_LABELS, type ContentPostingFlow } from '@/lib/agents/contentPosting'

export type ContentPostingMode = 'image' | 'video' | 'weekly'

export const CONTENT_POSTING_MODE_LABELS: Record<ContentPostingMode, string> = {
  image: 'Image post',
  video: 'Video post',
  weekly: 'Weekly plan',
}

export const CONTENT_POSTING_MODE_DESCRIPTIONS: Record<ContentPostingMode, string> = {
  image: 'Create a still post for Instagram, Facebook, X, or LinkedIn. Maya writes the caption for approval.',
  video: 'Create a Reels, Story, TikTok, Shorts, or LinkedIn clip. Review in Approvals when ready.',
  weekly: 'Build a 7-day content plan across your channels.',
}

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

export const CONTENT_POSTING_FLOW_CONFIG: Record<ContentPostingFlow, AgentGuidedConfig> = {
  single: {
    intro: 'Attach or generate the image you plan to post. Maya reads it and writes one caption to match what is in the frame — then you approve and publish.',
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

export const INITIAL_CONTENT_POSTING_FORMS = Object.fromEntries(
  Object.entries(CONTENT_POSTING_FLOW_CONFIG).map(([flow, config]) => [
    flow,
    Object.fromEntries(config.fields.map(field => [field.key, field.options?.[0] ?? ''])),
  ]),
) as Record<ContentPostingFlow, Record<string, string>>

export function contentPostingModeToFlow(mode: ContentPostingMode): ContentPostingFlow {
  return mode === 'weekly' ? 'weekly' : 'single'
}

export function mergePostContextForm(
  base: Record<string, string>,
  postContext: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!postContext) return base
  const merged = { ...base }
  for (const [key, value] of Object.entries(postContext)) {
    if (typeof value === 'string' && value.trim()) merged[key] = value.trim()
  }
  return merged
}

export function buildContentPostingInstructions(
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

export function contentPostingAgentName(): string {
  return AGENTS.content_posting.name
}
