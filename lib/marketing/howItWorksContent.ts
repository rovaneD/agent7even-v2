export type HowItWorksStep = {
  n: string
  kicker: string
  title: string
  titleBreak?: string
  body: string
  accent: 'pink' | 'blue' | 'green'
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    n: '01',
    kicker: 'Conversation',
    title: 'Describe the goal.',
    titleBreak: 'Maya handles the work.',
    body: '“Promote the Friday slot.” “We’ve gone quiet — fix it.” Maya already reads your Foundation and Brand Kit — then coordinates the agents.',
    accent: 'pink',
  },
  {
    n: '02',
    kicker: 'Shared context',
    title: 'Agents read Foundation',
    titleBreak: 'and Brand Kit',
    body: 'Campaign plans, post copy, emails, images, and Reels — each specialist pulls from the same saved context before drafting.',
    accent: 'blue',
  },
  {
    n: '03',
    kicker: 'Approval queue',
    title: 'Everything waits',
    titleBreak: 'for your approval.',
    body: 'Every post, email, ad, and image lands in one approval queue. Review what changed, make edits, then publish when you\'re ready.',
    accent: 'green',
  },
]

export const HOW_IT_WORKS_WORKFLOW = [
  {
    title: 'Foundation once',
    body: 'Your business, audience, and positioning live in Foundation. Maya and every agent pull from the same source — no re-briefing every week.',
  },
  {
    title: 'Brand Kit sets the voice',
    body: 'Colors, tone, offers, and creative direction live in Brand Kit. Every image and caption agent reads them before generating — not a blank prompt each time.',
  },
  {
    title: 'Twelve specialist agents',
    body: 'Campaigns, content, creative, SEO, competitive reports, and more — each agent handles a lane. Maya coordinates them from chat or the Command Center.',
  },
  {
    title: 'Approval before anything ships',
    body: 'Every artifact lands in your queue first. You stay in control — Maya plans and drafts; you decide what goes live.',
  },
]
