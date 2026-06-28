import type { MayaDataSource, MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'
import { formatActiveFormState, truncateForMaya } from '@/lib/maya/formStateContext'

type PostsDataState = 'mock' | 'live' | 'empty'

function postsDataSource(state: PostsDataState): MayaDataSource {
  if (state === 'mock') return 'sample'
  if (state === 'empty') return 'none'
  return 'live'
}

const POSTS_AFFORDANCE =
  `${MAYA_VOICE_RULE} User is on the Posts page — create, schedule, and publish to connected social accounts inside Agent7even. Help with captions, timing, and platform choices; do not reference internal integration vendors.`

export function buildPostsMayaContext(input: {
  companyName: string
  plan: string
  dataState: PostsDataState
  connectedPlatforms: string[]
  accounts: { platform: string; username: string }[]
  posts: { status: string }[]
  statusFilter: string
  platformFilter: string
  drawerOpen: boolean
  publishMode: string
  selectedAccountCount: number
  isEditing?: boolean
  caption?: string
  captionLimit?: number | null
  mediaCount?: number
  videoCount?: number
  selectedTargets?: string
  scheduledLocal?: string
  timezone?: string
  queueSelected?: boolean
}): MayaPageContext {
  const counts = input.posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})
  const countSummary = Object.entries(counts).map(([s, n]) => `${s}: ${n}`).join('; ') || 'none loaded'

  const platformLabels = input.connectedPlatforms.length
    ? input.connectedPlatforms.join(', ')
    : 'none connected'

  const accountSummary = input.accounts.length
    ? input.accounts.map(a => `${a.platform} (@${a.username})`).join('; ')
    : 'no accounts'

  const composeStateParts: string[] = []
  if (input.isEditing) composeStateParts.push('Editing existing post')

  const caption = input.caption?.trim() ?? ''
  if (caption) {
    const limit = input.captionLimit ? `/${input.captionLimit}` : ''
    composeStateParts.push(
      `Caption (${caption.length}${limit} chars): ${truncateForMaya(caption)}`,
    )
  } else {
    composeStateParts.push('Caption: empty')
  }

  const mediaCount = input.mediaCount ?? 0
  const videoCount = input.videoCount ?? 0
  composeStateParts.push(
    mediaCount
      ? `Media: ${mediaCount} item(s)${videoCount ? ` (${videoCount} video)` : ''}`
      : 'Media: none attached',
  )

  composeStateParts.push(
    input.selectedTargets
      ? `Targets: ${input.selectedTargets}`
      : 'Targets: none selected',
  )
  composeStateParts.push(`Publish mode: ${input.publishMode}`)

  if (input.publishMode === 'schedule') {
    composeStateParts.push(
      input.scheduledLocal
        ? `Scheduled: ${input.scheduledLocal}${input.timezone ? ` (${input.timezone})` : ''}`
        : 'Scheduled: date/time not set',
    )
  }
  if (input.publishMode === 'queue') {
    composeStateParts.push(input.queueSelected ? 'Queue: selected' : 'Queue: not selected')
  }

  const composeAffordance =
    ' The compose drawer is open. Use visible caption, media, account, and schedule values — do not ask for information already shown in the form.'

  return {
    page: 'POSTS PAGE',
    dataSource: postsDataSource(input.dataState),
    company: input.companyName || undefined,
    activeView: input.drawerOpen
      ? {
          label: input.isEditing ? 'Post compose (edit)' : 'Post compose',
          state: composeStateParts.join(' · '),
        }
      : 'post list',
    connections: [
      `Plan: ${input.plan || 'none'}`,
      `Connected platforms: ${platformLabels}`,
      `Accounts: ${accountSummary}`,
    ],
    metrics: [
      `Posts on screen (${input.posts.length}): ${countSummary}`,
      `Filters: status=${input.statusFilter}, platform=${input.platformFilter}`,
      input.drawerOpen
        ? `Composer open: ${input.selectedAccountCount} account(s) selected`
        : 'Composer closed',
    ],
    affordance: input.drawerOpen
      ? `${POSTS_AFFORDANCE}${composeAffordance}`
      : POSTS_AFFORDANCE,
  }
}

export function buildAiToolkitMayaContext(input: {
  plan: string | null
  monthlyRuns: number
  unlimited: boolean
  limit: number
  activeCategory: string
  activeTab: string
  visibleToolCount: number
  runningPromptTitle: string | null
  brandKitComplete: boolean
  totalRuns: number
}): MayaPageContext {
  const usage = input.unlimited
    ? `${input.monthlyRuns} runs this month (unlimited plan)`
    : `${input.monthlyRuns}/${input.limit} runs used this month`
  return {
    page: 'AI TOOLKIT PAGE',
    dataSource: 'live',
    activeView: input.runningPromptTitle
      ? `running "${input.runningPromptTitle}"`
      : `${input.activeTab} · ${input.activeCategory}`,
    metrics: [
      `Plan: ${input.plan ?? 'none'}`,
      `Usage: ${usage}`,
      `Lifetime outputs: ${input.totalRuns}`,
      `Tools visible: ${input.visibleToolCount}`,
      `Brand voice in prompts: ${input.brandKitComplete ? 'available' : 'Brand Kit incomplete'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User runs reusable marketing prompts from the library. Help pick tools, fill variables, and refine generated copy.`,
  }
}

export function buildCampaignDetailMayaContext(input: {
  title: string
  status: string
  mode: string
  segment: string | null
  goal: string | null
  timelineDays: number | null
  strategySummary: string | null
  doThisTodayCount: number
  weekCount: number
  plannedItemCount: number
}): MayaPageContext {
  return {
    page: 'CAMPAIGN DETAIL PAGE',
    dataSource: 'live',
    metrics: [
      `Campaign: ${input.title} [${input.status}]`,
      `Mode: ${input.mode}${input.segment ? ` · segment: ${input.segment}` : ''}${input.goal ? ` · goal: ${input.goal}` : ''}`,
      input.timelineDays ? `Timeline: ${input.timelineDays} days` : 'Timeline: not set',
      `Do today items: ${input.doThisTodayCount}`,
      `Week plan: ${input.weekCount} week(s), ${input.plannedItemCount} planned item(s)`,
      input.strategySummary
        ? `Strategy: ${input.strategySummary.slice(0, 200)}${input.strategySummary.length > 200 ? '…' : ''}`
        : 'Strategy summary: not set',
    ],
    affordance: `${MAYA_VOICE_RULE} User is reviewing a campaign plan. Help execute today's tasks, adapt weekly content, or refine strategy.`,
  }
}

export function buildGuidedCampaignMayaContext(input: {
  step: number
  segment: string
  goal: string
  timeline: number
  budget: string
  selectedModel: string
  isGenerating: boolean
}): MayaPageContext {
  const SEGMENT_LABELS: Record<string, string> = {
    past_customers: 'Past customers',
    warm_leads: 'Warm leads gone quiet',
    current_customers: 'Current customers',
    cold_audience: 'Cold audience',
    re_engagement: 'Re-engagement',
  }
  const BUDGET_LABELS: Record<string, string> = {
    under_500: 'Under $500/mo',
    '500_1500': '$500–$1,500/mo',
    '1500_5000': '$1,500–$5,000/mo',
    over_5000: 'Over $5,000/mo',
  }
  const MODEL_LABELS: Record<string, string> = {
    sonnet: 'Claude Sonnet',
    opus: 'Claude Opus',
  }

  if (input.isGenerating) {
    return {
      page: 'NEW CAMPAIGN PAGE',
      dataSource: 'live',
      activeView: { label: 'Generating campaign', state: 'Plan generation in progress' },
      metrics: [
        `Audience segment: ${SEGMENT_LABELS[input.segment] ?? input.segment}`,
        `Goal: ${input.goal || 'not selected'}`,
        `Timeline: ${input.timeline} days`,
        `Budget band: ${BUDGET_LABELS[input.budget] ?? input.budget}`,
        `Model: ${MODEL_LABELS[input.selectedModel] ?? input.selectedModel}`,
      ],
      affordance: `${MAYA_VOICE_RULE} Campaign generation is running — do not ask the user to re-enter choices already submitted.`,
    }
  }

  const fields: { label: string; value: string }[] = [
    {
      label: 'Audience segment',
      value: input.segment ? (SEGMENT_LABELS[input.segment] ?? input.segment) : '',
    },
    { label: 'Goal', value: input.goal },
    { label: 'Timeline', value: input.timeline ? `${input.timeline} days` : '' },
    { label: 'Budget band', value: input.budget ? (BUDGET_LABELS[input.budget] ?? input.budget) : '' },
    {
      label: 'Model',
      value: input.selectedModel ? (MODEL_LABELS[input.selectedModel] ?? input.selectedModel) : '',
    },
  ]

  const visible =
    input.step === 1
      ? fields.slice(0, 1)
      : input.step === 2
        ? fields.slice(0, 2)
        : fields

  const filled = visible.filter(f => f.value.trim()).map(f => `${f.label}: ${truncateForMaya(f.value)}`)
  const empty = visible.filter(f => !f.value.trim()).map(f => f.label)

  return {
    page: 'NEW CAMPAIGN PAGE',
    dataSource: 'live',
    activeView: {
      label: `Guided campaign step ${input.step}/3`,
      state: formatActiveFormState(filled, empty),
    },
    metrics: filled.length ? filled : [`Step ${input.step}/3 — no selections yet`],
    affordance:
      `${MAYA_VOICE_RULE} User is creating a guided campaign. Use visible step selections — do not re-ask for segment, goal, timeline, or budget already shown on screen.`,
  }
}

export function buildOpenCanvasCampaignMayaContext(input: {
  messageCount: number
  readyToGenerate: boolean
  isCreating: boolean
  selectedModel: string
  draftInput?: string
  lastUserMessage?: string
}): MayaPageContext {
  const MODEL_LABELS: Record<string, string> = {
    sonnet: 'Claude Sonnet',
    opus: 'Claude Opus',
  }

  const stateParts = [
    `Model: ${MODEL_LABELS[input.selectedModel] ?? input.selectedModel}`,
    `Messages: ${input.messageCount}`,
  ]
  if (input.draftInput?.trim()) {
    stateParts.push(`Draft in input: ${truncateForMaya(input.draftInput)}`)
  }
  if (input.lastUserMessage?.trim()) {
    stateParts.push(`Last user message: ${truncateForMaya(input.lastUserMessage)}`)
  }
  if (input.readyToGenerate) stateParts.push('Ready to generate plan')
  if (input.isCreating) stateParts.push('Generating campaign')

  return {
    page: 'NEW CAMPAIGN PAGE',
    dataSource: 'live',
    activeView: {
      label: input.isCreating
        ? 'Open canvas — generating'
        : input.readyToGenerate
          ? 'Open canvas — ready to build'
          : 'Open canvas chat',
      state: stateParts.join(' · '),
    },
    metrics: stateParts,
    affordance:
      `${MAYA_VOICE_RULE} User is in open-canvas campaign creation. Use chat history and any visible draft input — do not ask for context already stated in the conversation.`,
  }
}

export function buildAgentOutputsMayaContext(input: {
  agentName: string
  companyName: string
  outputCount: number
  selectedTitle: string | null
  selectedStatus: string | null
  autonomyLevel: string
}): MayaPageContext {
  return {
    page: 'AGENT OUTPUTS ARCHIVE',
    dataSource: 'live',
    company: input.companyName || undefined,
    activeView: input.selectedTitle ?? 'none selected',
    metrics: [
      `Agent: ${input.agentName} (${input.autonomyLevel === 'autonomous' ? 'auto' : 'approval required'})`,
      `Saved outputs: ${input.outputCount}`,
      input.selectedTitle
        ? `Selected: "${input.selectedTitle}" [${input.selectedStatus ?? 'unknown'}]`
        : 'No output selected',
    ],
    affordance: `${MAYA_VOICE_RULE} User is browsing saved agent outputs. Help summarize, repurpose, or explain selected output content.`,
  }
}

export function buildServiceInquiryMayaContext(input: {
  companyName: string
  step: number
  serviceType: string
  projectName: string
  description: string
  platforms: string[]
  hasExistingBrand: boolean | null
  hasExistingDesigns: boolean | null
  timeline: string
  budgetRange: string
  additionalNotes: string
  submitted: boolean
}): MayaPageContext {
  const SERVICE_LABELS: Record<string, string> = {
    uiux: 'UI/UX Design',
    mobile_app: 'Mobile App Development',
    custom_dev: 'Custom Design & Development',
  }

  if (input.submitted) {
    return {
      page: 'SERVICE INQUIRY PAGE',
      dataSource: 'live',
      company: input.companyName || undefined,
      activeView: {
        label: 'Inquiry submitted',
        state: `Project "${input.projectName}" submitted for review`,
      },
      metrics: [
        `Service type: ${SERVICE_LABELS[input.serviceType] ?? input.serviceType}`,
        `Project: ${input.projectName}`,
      ],
      affordance: `${MAYA_VOICE_RULE} Inquiry is submitted — team will respond within 1–2 business days.`,
    }
  }

  const fmtBool = (v: boolean | null, yes: string, no: string) =>
    v === null ? '' : v ? yes : no

  const allFields: { label: string; value: string; steps: number[] }[] = [
    {
      label: 'Service type',
      value: input.serviceType ? (SERVICE_LABELS[input.serviceType] ?? input.serviceType) : '',
      steps: [1, 2, 3],
    },
    { label: 'Project name', value: input.projectName.trim(), steps: [1, 2, 3] },
    { label: 'Description', value: input.description.trim(), steps: [1, 2, 3] },
    {
      label: 'Target platforms',
      value: input.platforms.length ? input.platforms.join(', ') : '',
      steps: [1, 2, 3],
    },
    {
      label: 'Existing brand',
      value: fmtBool(input.hasExistingBrand, 'Yes — has brand', 'No — starting fresh'),
      steps: [2, 3],
    },
    {
      label: 'Existing designs',
      value: fmtBool(input.hasExistingDesigns, 'Yes — has designs', 'No — need design too'),
      steps: [2, 3],
    },
    { label: 'Timeline', value: input.timeline, steps: [3] },
    { label: 'Budget range', value: input.budgetRange, steps: [3] },
    { label: 'Additional notes', value: input.additionalNotes.trim(), steps: [3] },
  ]

  const visible = allFields.filter(f => f.steps.includes(input.step))
  const filled = visible.filter(f => f.value.trim()).map(f => `${f.label}: ${truncateForMaya(f.value)}`)
  const empty = visible.filter(f => !f.value.trim()).map(f => f.label)

  return {
    page: 'SERVICE INQUIRY PAGE',
    dataSource: 'live',
    company: input.companyName || undefined,
    activeView: {
      label: `Service inquiry step ${input.step}/3`,
      state: formatActiveFormState(filled, empty),
    },
    metrics: filled.length ? filled : [`Step ${input.step}/3 — no fields filled yet`],
    affordance:
      `${MAYA_VOICE_RULE} User is submitting a scoped design or development inquiry. Use visible form values — do not re-ask for project name, description, timeline, or budget already on screen.`,
  }
}
