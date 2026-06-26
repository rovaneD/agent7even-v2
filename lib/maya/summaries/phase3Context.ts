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
  isGenerating: boolean
}): MayaPageContext {
  return {
    page: 'NEW CAMPAIGN PAGE',
    dataSource: 'live',
    activeView: input.isGenerating ? 'generating plan' : `guided flow step ${input.step}/3`,
    metrics: [
      `Audience segment: ${input.segment || 'not selected'}`,
      `Goal: ${input.goal || 'not selected'}`,
      `Timeline: ${input.timeline} days`,
      `Budget band: ${input.budget}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User is creating a guided campaign. Help them choose segment, goal, and timeline before generation runs.`,
  }
}

export function buildOpenCanvasCampaignMayaContext(input: {
  messageCount: number
  readyToGenerate: boolean
  isCreating: boolean
  selectedModel: string
}): MayaPageContext {
  return {
    page: 'NEW CAMPAIGN PAGE',
    dataSource: 'live',
    activeView: input.isCreating
      ? 'generating from open canvas'
      : input.readyToGenerate
        ? 'ready to generate'
        : 'open canvas chat',
    metrics: [
      `Chat messages: ${input.messageCount}`,
      `Model: ${input.selectedModel}`,
      `Ready to build: ${input.readyToGenerate ? 'yes' : 'no'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User is in open-canvas campaign creation — conversational planning before the campaign is generated.`,
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
  submitted: boolean
}): MayaPageContext {
  return {
    page: 'SERVICE INQUIRY PAGE',
    dataSource: 'live',
    company: input.companyName || undefined,
    activeView: input.submitted ? 'submitted' : `step ${input.step}`,
    metrics: [
      `Service type: ${input.serviceType || 'not selected'}`,
      `Project name: ${input.projectName || 'not set'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User is submitting a scoped design or development inquiry — help clarify scope, timeline, and budget before submit.`,
  }
}
