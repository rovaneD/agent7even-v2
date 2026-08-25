import type { MayaPageContext } from '@/lib/maya/contextTypes'
import type { InboxDataState } from '@/lib/inbox/inboxDataState'
import type { InboxComment, InboxCommentPost, InboxConversation } from '@/lib/social/zernioInboxWorkspace'

export interface InboxMayaInput {
  companyName: string
  dataState: InboxDataState
  activeTab: 'dms' | 'comments'
  selectedConversation: InboxConversation | null
  selectedPost?: InboxCommentPost | null
  selectedComment?: InboxComment | null
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
    selectedPost = null,
    selectedComment = null,
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
    activeState = 'No social accounts connected — connect to read and reply to DMs and comments'
  } else if (activeTab === 'dms') {
    activeState = selectedConversation
      ? `DM thread with ${selectedConversation.participantName} on ${selectedConversation.platform} (${conversationCount} conversations)`
      : `${conversationCount} DM conversations — select one to read and reply`
  } else {
    activeState = selectedPost
      ? `Post comments on ${selectedPost.platform}${selectedComment ? ` — replying to ${selectedComment.authorName}` : ''}`
      : `${commentCount} posts with comments — select one to read and reply in-app`
  }

  const metrics: string[] = []
  if (dataState === 'live') {
    metrics.push(`Inbox: ${conversationCount} DM conversations, ${commentCount} posts with comments`)
    if (selectedConversation && activeTab === 'dms') {
      metrics.push(
        `Selected DM: ${selectedConversation.participantName}${selectedConversation.participantUsername ? ` (@${selectedConversation.participantUsername})` : ''} — last message preview: "${selectedConversation.lastMessage.slice(0, 80)}"`,
      )
    }
    if (selectedPost && activeTab === 'comments') {
      metrics.push(`Selected post: "${(selectedPost.content || 'Post').slice(0, 80)}" — ${selectedPost.commentCount} comments`)
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
      `${VOICE_RULE} User is on the Inbox workspace. Tabs: Direct messages and Post comments — both support read + reply in the composer. Draft with Maya inserts a suggested reply (user must click Send). For comments, user can select a specific comment to reply to. Do not tell the user to leave the app for replies unless send fails.`,
  }
}
