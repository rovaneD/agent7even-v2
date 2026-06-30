export const SCATTERED_TOOLS = [
  'ChatGPT',
  'Canva',
  'Buffer',
  'Mailchimp',
  'Google Docs',
  'Meta Ads',
  'Notion',
  'Sheets',
]

export const OS_STACK_LAYERS = [
  'Foundation',
  'Brand Kit',
  'Maya + 12 agents',
  'Approval queue',
] as const

export type StackCompareRow = {
  dimension: string
  scattered: string
  os: string
}

export const STACK_COMPARE_ROWS: StackCompareRow[] = [
  {
    dimension: 'Context',
    scattered: 'Re-explain your business in every app',
    os: 'Foundation once — shared by every agent',
  },
  {
    dimension: 'Voice',
    scattered: 'Generic until you prompt hard enough',
    os: 'Brand Kit on every draft',
  },
  {
    dimension: 'Workflow',
    scattered: 'You copy, paste, and stitch it together',
    os: 'Maya coordinates specialist agents from one conversation',
  },
  {
    dimension: 'Control',
    scattered: 'Post and hope it sounds like you',
    os: 'Approval-first — nothing live without you',
  },
]
