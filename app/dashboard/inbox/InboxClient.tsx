'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Hash, MessageCircle, Plus, RefreshCw, Send, User,
} from 'lucide-react'
import type { InboxDataState } from './page'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildInboxMayaContext } from '@/lib/maya/summaries/inboxContext'
import {
  formatRelativeTime,
  type InboxCommentPost,
  type InboxConversation,
  type InboxMessage,
} from '@/lib/social/zernioInboxWorkspace'

const PLATFORM_META: Record<string, { label: string; color: string; bgColor: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C', bgColor: '#FCE4EC' },
  facebook:  { label: 'Facebook',  color: '#1877F2', bgColor: '#E3F2FD' },
  tiktok:    { label: 'TikTok',    color: '#333',    bgColor: '#F5F5F5' },
}

function PlatformBadge({ platform }: { platform: string }) {
  const meta = PLATFORM_META[platform] ?? { label: platform, color: '#64748B', bgColor: '#F1F5F9' }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: meta.bgColor, color: meta.color }}
    >
      {platform === 'instagram' ? <Hash size={10} /> : null}
      {meta.label}
    </span>
  )
}

function EmptyConnect({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <Plus size={20} className="text-[#3B82F6]" />
      </div>
      <p className="text-[15px] font-semibold text-text mb-2">Connect a social account</p>
      <p className="text-[13px] text-text-sec max-w-md mx-auto mb-5">
        Your inbox will show DMs and post comments from connected Instagram, Facebook, and other platforms.
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
      >
        <Plus size={14} /> Connect accounts
      </button>
    </div>
  )
}

export default function InboxClient({
  companyName,
  dataState,
  zernioConnectedPlatforms,
}: {
  companyName: string
  dataState: InboxDataState
  zernioConnectedPlatforms: string[]
}) {
  const [activeTab, setActiveTab] = useState<'dms' | 'comments'>('dms')
  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [comments, setComments] = useState<InboxCommentPost[]>([])
  const [selected, setSelected] = useState<InboxConversation | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [reply, setReply] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [listError, setListError] = useState('')
  const [threadError, setThreadError] = useState('')
  const [sendError, setSendError] = useState('')

  const detailPaneRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)

  const isMock = dataState === 'mock'
  const isLive = dataState === 'live'
  const showMobileThread = activeTab === 'dms' && Boolean(selected)

  const fetchConversations = useCallback(async () => {
    if (!isLive) return
    setLoadingList(true)
    setListError('')
    try {
      const res = await fetch('/api/inbox/conversations', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setListError("Couldn't load conversations.")
        setConversations([])
        return
      }
      setConversations(json.conversations ?? [])
    } catch {
      setListError("Couldn't load conversations.")
      setConversations([])
    } finally {
      setLoadingList(false)
    }
  }, [isLive])

  const fetchComments = useCallback(async () => {
    if (!isLive) return
    setLoadingList(true)
    setListError('')
    try {
      const res = await fetch('/api/inbox/comments', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.error) {
        setListError("Couldn't load comments.")
        setComments([])
        return
      }
      setComments(json.comments ?? [])
    } catch {
      setListError("Couldn't load comments.")
      setComments([])
    } finally {
      setLoadingList(false)
    }
  }, [isLive])

  const fetchThread = useCallback(async (conv: InboxConversation) => {
    if (!isLive) return
    setLoadingThread(true)
    setThreadError('')
    setSendError('')
    try {
      const q = new URLSearchParams({ accountId: conv.accountId })
      const res = await fetch(`/api/inbox/conversations/${encodeURIComponent(conv.id)}/messages?${q}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setThreadError("Couldn't load this conversation.")
        setMessages([])
        return
      }
      setMessages(json.messages ?? [])
    } catch {
      setThreadError("Couldn't load this conversation.")
      setMessages([])
    } finally {
      setLoadingThread(false)
    }
  }, [isLive])

  useEffect(() => {
    if (activeTab === 'dms') fetchConversations()
    else fetchComments()
  }, [activeTab, fetchConversations, fetchComments])

  useEffect(() => {
    if (selected && activeTab === 'dms') {
      setMessages([])
      fetchThread(selected)
    } else {
      setMessages([])
    }
  }, [selected, activeTab, fetchThread])

  useEffect(() => {
    if (!selected || activeTab !== 'dms') return
    detailPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected?.id, activeTab])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el) return
    if (loadingThread) {
      el.scrollTo({ top: 0 })
      return
    }
    if (messages.length > 0) {
      el.scrollTop = el.scrollHeight
    }
  }, [loadingThread, messages, selected?.id])

  const handleSend = async () => {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(
        `/api/inbox/conversations/${encodeURIComponent(selected.id)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: selected.accountId, message: reply.trim() }),
        },
      )
      const json = await res.json()
      if (!res.ok || json.error) {
        setSendError("Couldn't send your reply. Try again.")
        return
      }
      setReply('')
      await fetchThread(selected)
      await fetchConversations()
    } catch {
      setSendError("Couldn't send your reply. Try again.")
    } finally {
      setSending(false)
    }
  }

  const mayaContext = useMemo(
    () => buildInboxMayaContext({
      companyName,
      dataState,
      activeTab,
      selectedConversation: selected,
      conversationCount: conversations.length,
      commentCount: comments.length,
      connectedPlatforms: zernioConnectedPlatforms,
    }),
    [companyName, dataState, activeTab, selected, conversations.length, comments.length, zernioConnectedPlatforms],
  )
  useMayaContext(mayaContext)

  const openConnect = () => {
    window.location.href = '/dashboard/analytics'
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-[500] text-text">Inbox</h1>
          <p className="text-[13px] text-text-sec mt-0.5">
            Read and reply to DMs and post comments from connected accounts
          </p>
        </div>
        {isLive && (
          <button
            type="button"
            onClick={() => (activeTab === 'dms' ? fetchConversations() : fetchComments())}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-sec border border-gray-200 bg-white px-3.5 py-2 rounded-xl hover:border-gray-300 transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        )}
      </div>

      {isMock && (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-800">
            Demo mode — upgrade to a paid plan and connect social accounts to use your inbox.
          </p>
        </div>
      )}

      {dataState === 'empty' && <EmptyConnect onConnect={openConnect} />}

      {isLive && (
        <>
          <div className="mb-4 flex items-end border-b border-gray-200 overflow-x-auto overflow-y-hidden">
            {([
              { id: 'dms' as const, label: 'Direct messages' },
              { id: 'comments' as const, label: 'Post comments' },
            ]).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setSelected(null) }}
                className={`whitespace-nowrap px-4 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-[#3B82F6] text-[#3B82F6] font-semibold'
                    : 'border-transparent text-text-sec hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {listError && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium text-red-600">{listError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:min-h-[560px]">
            {/* List pane — hidden on mobile when a thread is open */}
            <div className={`rounded-2xl border border-gray-100 bg-white overflow-hidden flex flex-col min-h-[320px] lg:min-h-0 ${
              showMobileThread ? 'hidden lg:flex' : 'flex'
            }`}>
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-[12px] font-semibold text-text">
                  {activeTab === 'dms' ? 'Conversations' : 'Posts with comments'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingList && (
                  <p className="px-4 py-6 text-xs text-text-sec">Loading…</p>
                )}
                {!loadingList && activeTab === 'dms' && conversations.length === 0 && (
                  <p className="px-4 py-8 text-center text-[13px] text-text-sec">No conversations yet.</p>
                )}
                {!loadingList && activeTab === 'comments' && comments.length === 0 && (
                  <p className="px-4 py-8 text-center text-[13px] text-text-sec">No post comments yet.</p>
                )}
                {activeTab === 'dms' && conversations.map(conv => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelected(conv)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      selected?.id === conv.id ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-text truncate">{conv.participantName}</p>
                        {conv.participantUsername && (
                          <p className="text-[11px] text-text-soft truncate">@{conv.participantUsername}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-text-soft whitespace-nowrap">
                        {formatRelativeTime(conv.updatedTime)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-text-sec truncate">{conv.lastMessage}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <PlatformBadge platform={conv.platform} />
                      {conv.unreadCount > 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {conv.unreadCount} unread
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {activeTab === 'comments' && comments.map(post => (
                  <div key={post.id} className="px-4 py-3 border-b border-gray-50">
                    <div className="flex gap-3">
                      {post.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.picture} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <MessageCircle size={16} className="text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-text line-clamp-2">{post.content || 'Post'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <PlatformBadge platform={post.platform} />
                          <span className="text-[10px] text-text-soft">
                            {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
                          </span>
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3B82F6] hover:underline"
                            >
                              View on platform <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail pane — full width on mobile when a thread is open */}
            <div
              ref={detailPaneRef}
              className={`rounded-2xl border border-gray-100 bg-white overflow-hidden flex flex-col min-h-[320px] lg:min-h-[560px] ${
                showMobileThread ? 'min-h-[calc(100dvh-12rem)]' : ''
              } ${!showMobileThread && activeTab === 'dms' ? 'hidden lg:flex' : 'flex'}`}
            >
              {activeTab === 'comments' ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <MessageCircle size={28} className="text-gray-300 mb-3" />
                  <p className="text-[14px] font-semibold text-text mb-1">Reply on the platform</p>
                  <p className="text-[13px] text-text-sec max-w-sm">
                    Post comments open on Instagram or Facebook. Use the link in the list to reply there — in-app comment replies are coming later.
                  </p>
                  <Link
                    href="/dashboard/analytics"
                    className="mt-4 text-[12px] font-semibold text-[#3B82F6] hover:underline"
                  >
                    View inbox analytics →
                  </Link>
                </div>
              ) : !selected ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <User size={28} className="text-gray-300 mb-3" />
                  <p className="text-[14px] font-semibold text-text mb-1">Select a conversation</p>
                  <p className="text-[13px] text-text-sec">Choose a DM from the list to read and reply.</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 text-text-sec hover:bg-gray-50 flex-shrink-0"
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-text truncate">{selected.participantName}</p>
                        {selected.participantUsername && (
                          <p className="text-[11px] text-text-soft truncate">@{selected.participantUsername}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PlatformBadge platform={selected.platform} />
                      {selected.externalUrl && (
                        <a
                          href={selected.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#3B82F6] hover:underline inline-flex items-center gap-1"
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div
                    ref={messagesScrollRef}
                    className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50/40"
                  >
                    {loadingThread && (
                      <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
                        <p className="text-xs font-medium text-text-sec">Loading messages…</p>
                      </div>
                    )}
                    {threadError && <p className="text-xs text-red-600">{threadError}</p>}
                    {!loadingThread && messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                            msg.direction === 'outgoing'
                              ? 'bg-[#3B82F6] text-white'
                              : 'bg-white border border-gray-100 text-text'
                          }`}
                        >
                          <p className="text-[10px] font-semibold opacity-70 mb-1">{msg.senderName}</p>
                          <p className="text-[13px] whitespace-pre-wrap break-words">
                            {msg.message || msg.attachmentPreview || '[Attachment]'}
                          </p>
                          <p className={`text-[10px] mt-1 ${msg.direction === 'outgoing' ? 'text-blue-100' : 'text-text-soft'}`}>
                            {formatRelativeTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 p-4 bg-white">
                    {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
                    <div className="flex gap-2">
                      <textarea
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        placeholder="Write a reply…"
                        rows={2}
                        className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6]"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || !reply.trim()}
                        className="self-end inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
                      >
                        <Send size={14} />
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
