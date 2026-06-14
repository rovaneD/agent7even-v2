import type { MayaPageContext } from '@/lib/maya/contextTypes'
import type { InboxDataState } from '@/app/dashboard/inbox/page'
import type { InboxConversation, InboxCommentPost } from '@/lib/social/zernioInboxWorkspace'

export interface InboxMayaInput {
  companyName: string
  dataState: InboxDataState
  activeTab: 'dms' | 'comments'
  selectedConversation: InboxConversation | null
  conversationCount: number
  commentCount: number
  connectedPlatforms: string[]
}

const VOICE_RULE =
  'VOICE: Never mention Zernio or other internal vendor/integration names to the user. Use product language only: Inbox, connected social accounts, Agent7even.'

export function buildInboxMayaContext(input: InboxMayaInput): MayaPageContext {
  const {
    companyName,
    dataState,
    activeTab,
    selectedConversation,
    conversationCount,
    commentCount,
    connectedPlatforms,
  } = input

  const dataSource =
    dataState === 'mock' ? 'sample'
    : dataState === 'empty' ? 'none'
    : 'live'

  const connections =
    dataState === 'mock'
      ? ['Social inbox: demo mode']
      : connectedPlatforms.length
        ? [`Social accounts connected: ${connectedPlatforms.join(', ')}`]
        : ['Social accounts: none connected']

  let activeState = ''
  if (dataState === 'mock') {
    activeState = 'SAMPLE / MOCK — demo inbox workspace'
  } else if (dataState === 'empty') {
    activeState = 'No social accounts connected — connect to read and reply to DMs'
  } else if (activeTab === 'dms') {
    activeState = selectedConversation
      ? `DM thread with ${selectedConversation.participantName} on ${selectedConversation.platform} (${conversationCount} conversations)`
      : `${conversationCount} DM conversations — select one to read and reply`
  } else {
    activeState = `${commentCount} posts with comments — view on platform to reply in-app`
  }

  const metrics: string[] = []
  if (dataState === 'live') {
    metrics.push(`Inbox: ${conversationCount} DM conversations, ${commentCount} posts with comments`)
    if (selectedConversation && activeTab === 'dms') {
      metrics.push(
        `Selected: ${selectedConversation.participantName}${selectedConversation.participantUsername ? ` (@${selectedConversation.participantUsername})` : ''} — last message preview: "${selectedConversation.lastMessage.slice(0, 80)}"`,
      )
    }
  } else if (dataState === 'mock') {
    metrics.push('INBOX DATA: SAMPLE / MOCK — demo inbox until social accounts are connected.')
  } else {
    metrics.push('Inbox: connect a social account to load messages.')
  }

  return {
    page: 'INBOX PAGE',
    dataSource,
    company: companyName || undefined,
    activeView: {
      label: activeTab === 'dms' ? 'Direct messages' : 'Post comments',
      state: activeState,
    },
    connections,
    metrics,
    affordance:
      `${VOICE_RULE} User is on the Inbox workspace. Tabs: Direct messages (read + reply in composer) and Post comments (read-only list with external links). Selecting a DM loads the thread in the detail pane; type a reply and click Send. Do not tell the user to click charts or filters that do not exist.`,
  }
}
