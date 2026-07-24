export const CONTEXT_FRAGMENTS = [
  { id: 'day', label: 'Slowest day', value: 'Friday' },
  { id: 'offer', label: 'Previous offer', value: '20% off' },
  { id: 'voice', label: 'Voice', value: 'Warm, direct, no hype' },
  { id: 'audience', label: 'Audience', value: 'Neighborhood regulars' },
  { id: 'goal', label: 'Goal', value: 'Increase Friday traffic' },
  { id: 'channels', label: 'Channel history', value: 'Email + Instagram' },
] as const

/** @deprecated use CONTEXT_FRAGMENTS — kept for static fallback */
export const FOUNDATION_ITEMS = CONTEXT_FRAGMENTS.slice(0, 4)

export const AGENTS = [
  { id: 'campaign', name: 'Campaign Builder', action: 'Drafting offer', color: 'gold' as const },
  { id: 'content', name: 'Content', action: 'Creating three posts', color: 'violet' as const },
  { id: 'creative', name: 'Creative', action: 'Applying visual direction', color: 'coral' as const },
  { id: 'email', name: 'Email', action: 'Preparing email', color: 'gold' as const },
  { id: 'seo', name: 'SEO', action: 'Checking homepage', color: 'blue' as const },
  { id: 'competitors', name: 'Competitors', action: 'Reviewing promotions', color: 'violet' as const },
] as const

export type WorkItemType = 'campaign' | 'email' | 'social' | 'visual' | 'seo' | 'competitor'

export const WORK_ITEMS = [
  {
    id: 'campaign',
    type: 'campaign' as WorkItemType,
    title: 'Friday Slow-Day Promo',
    meta: 'From Foundation',
    status: 'Timeline · 3 posts + email',
    queueSource: 'From Foundation',
    queueStatus: 'Review',
    queueEffort: '4-minute review',
  },
  {
    id: 'email',
    type: 'email' as WorkItemType,
    title: 'Friday promo email',
    meta: 'Brand Kit applied',
    status: 'Drafted 12 seconds ago',
    queueSource: 'From Foundation',
    queueStatus: 'Ready to approve',
    queueEffort: 'Approve',
  },
  {
    id: 'social',
    type: 'social' as WorkItemType,
    title: 'Instagram post · Offer reel',
    meta: 'Brand Kit applied',
    status: 'Ready for review',
    queueSource: 'Brand Kit applied',
    queueStatus: 'Review',
    queueEffort: '2-minute review',
  },
  {
    id: 'visual',
    type: 'visual' as WorkItemType,
    title: 'Offer visual',
    meta: 'Saved colors applied',
    status: 'From Foundation',
    queueSource: 'Creative',
    queueStatus: 'Review',
    queueEffort: '1-minute review',
  },
  {
    id: 'seo',
    type: 'seo' as WorkItemType,
    title: 'Homepage title tags',
    meta: '2 missing tags found',
    status: 'Ready for review',
    queueSource: 'SEO scan',
    queueStatus: 'Review',
    queueEffort: 'Quick fix',
  },
  {
    id: 'competitor',
    type: 'competitor' as WorkItemType,
    title: 'Rival Coffee response',
    meta: 'Draft ready',
    status: 'Competitor brief',
    queueSource: 'Competitors',
    queueStatus: 'Approve',
    queueEffort: 'Approve',
  },
] as const

/** @deprecated */
export const DELIVERABLES = WORK_ITEMS.map((w) => ({
  title: w.title,
  meta: w.meta,
  tag: w.type,
}))

export const QUEUE_ITEMS = [
  {
    title: 'Friday promo email',
    source: 'From Foundation',
    status: 'Ready to approve',
    effort: 'Approve',
  },
  {
    title: 'Instagram post',
    source: 'Brand Kit applied',
    status: 'Review',
    effort: '2-minute review',
  },
  {
    title: 'Weekly content plan',
    source: 'Campaign Builder',
    status: '5 posts',
    effort: '4-minute review',
  },
  {
    title: 'Competitor response',
    source: 'Draft ready',
    status: 'Approve',
    effort: 'Approve',
  },
] as const

export const HERO_FRAGMENTS = CONTEXT_FRAGMENTS.slice(0, 4)
