/** Normalized inbox workspace types — UI-facing, not raw Zernio payloads. */

export type InboxConversation = {
  id: string
  accountId: string
  accountUsername: string
  platform: string
  participantName: string
  participantUsername: string | null
  participantPicture: string | null
  lastMessage: string
  updatedTime: string
  unreadCount: number
  externalUrl: string | null
}

export type InboxMessage = {
  id: string
  conversationId: string
  accountId: string
  platform: string
  message: string
  senderName: string
  direction: 'incoming' | 'outgoing'
  createdAt: string
  attachmentPreview: string | null
}

export type InboxCommentPost = {
  id: string
  accountId: string
  accountUsername: string
  platform: string
  content: string
  createdTime: string
  permalink: string | null
  picture: string | null
  commentCount: number
  likeCount: number
}

export type InboxComment = {
  id: string
  message: string
  createdTime: string
  authorName: string
  authorUsername: string | null
  authorPicture: string | null
  direction: 'incoming' | 'outgoing'
  canReply: boolean
  replyCount: number
  parentId: string | null
  depth: number
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
}

function extractList(raw: unknown, keys: string[]): unknown[] {
  const obj = asObject(raw)
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[]
  }
  for (const wrap of ['data', 'result', 'response'] as const) {
    const nested = obj[wrap]
    if (nested && typeof nested === 'object') {
      const found = extractList(nested, keys)
      if (found.length) return found
    }
  }
  return []
}

function messagePreview(row: Record<string, unknown>): string {
  const text = str(row.message).trim()
  if (text) return text
  const attachments = asArray(row.attachments)
  if (attachments.length > 0) {
    const first = asObject(attachments[0])
    const title = str(asObject(first.payload).title).trim()
    if (title) return title.slice(0, 120)
    return `[${str(first.type, 'Attachment')}]`
  }
  return ''
}

function attachmentPreview(row: Record<string, unknown>): string | null {
  const attachments = asArray(row.attachments)
  if (!attachments.length) return null
  const first = asObject(attachments[0])
  const title = str(asObject(first.payload).title).trim()
  if (title) return title.slice(0, 160)
  return str(first.type) || 'Attachment'
}

export function parseInboxConversations(raw: unknown): {
  conversations: InboxConversation[]
  pagination: { hasMore: boolean; nextCursor: string | null }
} {
  const root = asObject(raw)
  const rows = extractList(raw, ['data', 'conversations', 'items']) as Record<string, unknown>[]
  const pagination = asObject(root.pagination)

  const conversations = rows.map(row => ({
    id: str(row.id ?? row.conversationId),
    accountId: str(row.accountId),
    accountUsername: str(row.accountUsername),
    platform: str(row.platform).toLowerCase(),
    participantName: str(row.participantName) || str(row.participantUsername) || 'Direct message',
    participantUsername: str(row.participantUsername) || null,
    participantPicture: str(row.participantPicture) || null,
    lastMessage: str(row.lastMessage) || '[No preview]',
    updatedTime: str(row.updatedTime ?? row.lastMessageAt),
    unreadCount: num(row.unreadCount),
    externalUrl: str(row.url) || null,
  })).filter(c => c.id)

  return {
    conversations,
    pagination: {
      hasMore: Boolean(pagination.hasMore),
      nextCursor: str(pagination.nextCursor) || null,
    },
  }
}

export function parseInboxMessages(raw: unknown): InboxMessage[] {
  const rows = extractList(raw, ['messages', 'data', 'items']) as Record<string, unknown>[]
  return rows.map(row => {
    const directionRaw = str(row.direction).toLowerCase()
    const direction: InboxMessage['direction'] = directionRaw === 'outgoing' ? 'outgoing' : 'incoming'
    return {
      id: str(row.id),
      conversationId: str(row.conversationId),
      accountId: str(row.accountId),
      platform: str(row.platform).toLowerCase(),
      message: messagePreview(row),
      senderName: str(row.senderName) || (direction === 'outgoing' ? 'You' : 'Contact'),
      direction,
      createdAt: str(row.createdAt ?? row.sentAt),
      attachmentPreview: attachmentPreview(row),
    }
  }).filter(m => m.id)
}

export function parseInboxComments(raw: unknown): {
  comments: InboxCommentPost[]
  pagination: { hasMore: boolean; nextCursor: string | null }
} {
  const root = asObject(raw)
  const rows = extractList(raw, ['data', 'comments', 'items']) as Record<string, unknown>[]
  const pagination = asObject(root.pagination)

  const comments = rows.map(row => ({
    id: str(row.id),
    accountId: str(row.accountId),
    accountUsername: str(row.accountUsername),
    platform: str(row.platform).toLowerCase(),
    content: str(row.content),
    createdTime: str(row.createdTime),
    permalink: str(row.permalink) || null,
    picture: str(row.picture) || null,
    commentCount: num(row.commentCount),
    likeCount: num(row.likeCount),
  })).filter(c => c.id)

  return {
    comments,
    pagination: {
      hasMore: Boolean(pagination.hasMore),
      nextCursor: str(pagination.nextCursor) || null,
    },
  }
}

function mapInboxCommentRow(row: Record<string, unknown>, depth: number): InboxComment {
  const from = asObject(row.from)
  const isOwner = Boolean(from.isOwner)
  return {
    id: str(row.id),
    message: str(row.message),
    createdTime: str(row.createdTime),
    authorName: str(from.name) || str(from.username) || 'Commenter',
    authorUsername: str(from.username) || null,
    authorPicture: str(from.picture) || null,
    direction: isOwner ? 'outgoing' : 'incoming',
    canReply: row.canReply !== false,
    replyCount: num(row.replyCount),
    parentId: str(row.parentId) || null,
    depth,
  }
}

function flattenInboxCommentRows(rows: Record<string, unknown>[], depth = 0): InboxComment[] {
  const out: InboxComment[] = []
  for (const row of rows) {
    const mapped = mapInboxCommentRow(row, depth)
    if (!mapped.id) continue
    out.push(mapped)
    const replies = asArray(row.replies) as Record<string, unknown>[]
    if (replies.length > 0) {
      out.push(...flattenInboxCommentRows(replies, depth + 1))
    }
  }
  return out
}

export function parseInboxPostComments(raw: unknown): {
  comments: InboxComment[]
  pagination: { hasMore: boolean; nextCursor: string | null }
} {
  const root = asObject(raw)
  const rows = extractList(raw, ['comments', 'data', 'items']) as Record<string, unknown>[]
  const pagination = asObject(root.pagination)
  const comments = flattenInboxCommentRows(rows)

  return {
    comments,
    pagination: {
      hasMore: Boolean(pagination.hasMore),
      nextCursor: str(pagination.nextCursor) || null,
    },
  }
}

export function mergeConversations(batches: InboxConversation[]): InboxConversation[] {
  const map = new Map<string, InboxConversation>()
  for (const row of batches) {
    const existing = map.get(row.id)
    if (!existing || new Date(row.updatedTime).getTime() > new Date(existing.updatedTime).getTime()) {
      map.set(row.id, row)
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedTime).getTime() - new Date(a.updatedTime).getTime(),
  )
}

export function mergeCommentPosts(batches: InboxCommentPost[]): InboxCommentPost[] {
  const map = new Map<string, InboxCommentPost>()
  for (const row of batches) {
    map.set(row.id, row)
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime(),
  )
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
