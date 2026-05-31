'use client'

import { useState, useEffect } from 'react'
import { Bell, CheckCheck, Loader2, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  link: string | null
  read: boolean
  created_at: string
}

interface Props {
  profileId: string
  initialNotifications: Notification[]
}

type Filter = 'all' | 'unread' | 'read'

function typeIcon(type: string) {
  const map: Record<string, string> = {
    order_status: '📦',
    order_delivered: '✅',
    support_reply: '💬',
    support_closed: '🔒',
    deliverable_uploaded: '📁',
    brand_kit_generated: '✨',
    plan_activated: '🎉',
    trial_ending: '⏰',
  }
  return map[type] ?? '🔔'
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    order_status: 'Order update',
    order_delivered: 'Delivery',
    support_reply: 'Support',
    support_closed: 'Support',
    deliverable_uploaded: 'Deliverable',
    brand_kit_generated: 'Brand Kit',
    plan_activated: 'Billing',
    trial_ending: 'Trial',
  }
  return map[type] ?? 'Notification'
}

function formatDate(str: string) {
  const date = new Date(str)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minutes ago`
  if (hours < 24) return `${hours} hours ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotificationsClient({ profileId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [filter, setFilter] = useState<Filter>('all')
  const [marking, setMarking] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const recentLines = initialNotifications.slice(0, 5).map(n =>
      `- [${typeLabel(n.type)}] "${n.title}" (${n.read ? 'read' : 'unread'})`
    ).join('\n')
    const context = `NOTIFICATIONS PAGE
Unread notifications: ${initialNotifications.filter(n => !n.read).length}
Total notifications: ${initialNotifications.length}
Recent notifications:
${recentLines || '- No notifications yet'}
The user can mark notifications as read and follow links to relevant pages.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`notifications-center:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === (payload.new as Notification).id ? payload.new as Notification : n)
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profileId, supabase])

  async function markRead(id: string) {
    setMarkingId(id)
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setMarkingId(null)
  }

  async function markAllRead() {
    setMarking(true)
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setMarking(false)
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (filter === 'read') return n.read
    return true
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={marking}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors"
          >
            {marking
              ? <Loader2 size={14} className="animate-spin" />
              : <CheckCheck size={14} />
            }
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['all', 'unread', 'read'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-4 py-2 rounded-lg capitalize transition-all ${
              filter === f
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-[#c8522a] text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Bell size={24} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-gray-400">
            {filter === 'unread'
              ? "You're all caught up."
              : "You'll see order updates, deliverables, and support replies here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notif => (
            <div
              key={notif.id}
              className={`bg-white rounded-2xl border transition-all ${
                !notif.read
                  ? 'border-[#c8522a]/20 bg-[#c8522a]/5 hover:border-[#c8522a]/30'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-4 p-5">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                  !notif.read ? 'bg-white' : 'bg-gray-50'
                }`}>
                  {typeIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#c8522a] uppercase tracking-wide">
                        {typeLabel(notif.type)}
                      </span>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c8522a]" />
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                  <p className={`text-sm font-semibold mb-1 ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>
                    {notif.title}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">{notif.body}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-3">
                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={() => { if (!notif.read) markRead(notif.id) }}
                        className="text-xs font-semibold text-[#c8522a] hover:text-[#b8471f] transition-colors"
                      >
                        View →
                      </Link>
                    )}
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif.id)}
                        disabled={markingId === notif.id}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {markingId === notif.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <CheckCheck size={11} />
                        }
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
