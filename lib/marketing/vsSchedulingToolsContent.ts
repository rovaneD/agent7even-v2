export const SCHEDULING_TOOL_NAMES = [
  'Buffer',
  'Hootsuite',
  'Later',
  'Sprout Social',
  'Metricool',
] as const

export const AGENT7EVEN_SCHEDULING_LAYERS = [
  'Tell Maya the goal',
  'Agents draft in your voice',
  'Review in one approval queue',
  'Schedule when you sign off',
] as const

export type VsSchedulingStackRow = {
  dimension: string
  scheduling: string
  agent7even: string
}

export const VS_SCHEDULING_STACK_ROWS: VsSchedulingStackRow[] = [
  {
    dimension: 'Primary job',
    scheduling: 'Queue and publish what you already wrote',
    agent7even: 'Plan, draft, and queue for your approval',
  },
  {
    dimension: 'Who writes the copy',
    scheduling: 'You — every caption, every time',
    agent7even: 'Maya and specialist agents in your Brand Kit voice',
  },
  {
    dimension: 'Campaign planning',
    scheduling: 'Not included — strategy stays on you',
    agent7even: 'Campaign Builder and Weekly Content agents',
  },
  {
    dimension: 'Brand voice',
    scheduling: 'Generic unless you rewrite every word',
    agent7even: 'Foundation and Brand Kit on every draft',
  },
  {
    dimension: 'Channels',
    scheduling: 'Social queue — email and SEO live elsewhere',
    agent7even: 'Posts, emails, SEO, ads, and creative in one OS',
  },
  {
    dimension: 'Control',
    scheduling: 'Post when the slot opens',
    agent7even: 'Approval-first — nothing live without you',
  },
]

export const VS_SCHEDULING_WORKFLOW = [
  {
    title: 'Schedulers stop at the publish button',
    body: 'Buffer, Hootsuite, and Later are good at timing — but they do not plan campaigns, draft copy, or read your Brand Kit. You still do the strategy.',
  },
  {
    title: 'Agent7even starts with the goal',
    body: 'Tell Maya what you need — a launch, a quiet week, a promo slot. Campaign and content agents draft the work from Foundation before anything hits a queue.',
  },
  {
    title: 'One approval queue, then schedule',
    body: 'Every post, email, and creative lands in your queue first. Edit, approve, then schedule in a click — not the other way around.',
  },
  {
    title: 'Twelve agents, not one calendar',
    body: 'SEO audits, competitive reports, email sequences, and ad copy run alongside social — coordinated by Maya, not scattered across tabs.',
  },
] as const
