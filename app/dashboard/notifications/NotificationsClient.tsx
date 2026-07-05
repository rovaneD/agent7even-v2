'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildNotificationsMayaContext } from '@/lib/maya/summaries/workspaceContext'
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

function typeColor(type: string): string {
  if (type.startsWith('order')) return '#3B82F6'
  if (type.startsWith('support')) return '#FCA509'
  if (type === 'deliverable_uploaded') return '#10B981'
  if (type === 'brand_kit_generated') return '#10B981'
  if (type === 'plan_activated') return '#10B981'
  if (type === 'trial_ending') return '#EE533B'
  if (type === 'approval_pending') return '#3B82F6'
  if (type === 'payment_failed' || type === 'subscription_canceled') return '#EE533B'
  if (type === 'team_member_joined') return '#10B981'
  if (type === 'assignment_created' || type === 'assignment_submitted') return '#3B82F6'
  if (type === 'credit_topup') return '#10B981'
  return '#9BA1AE'
}

function typeInitial(type: string): string {
  if (type.startsWith('order')) return 'OR'
  if (type.startsWith('support')) return 'SP'
  if (type === 'deliverable_uploaded') return 'DL'
  if (type === 'brand_kit_generated') return 'BK'
  if (type === 'plan_activated') return 'PL'
  if (type === 'trial_ending') return 'TR'
  if (type === 'approval_pending') return 'AP'
  if (type === 'payment_failed') return 'BL'
  if (type === 'subscription_canceled') return 'BL'
  if (type === 'team_member_joined') return 'TM'
  if (type === 'assignment_created') return 'AS'
  if (type === 'assignment_submitted') return 'SB'
  if (type === 'credit_topup') return 'CR'
  return 'NT'
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
    approval_pending: 'Approval',
    payment_failed: 'Billing',
    subscription_canceled: 'Billing',
    team_member_joined: 'Team',
    assignment_created: 'Assignment',
    assignment_submitted: 'Submitted',
    credit_topup: 'Credits',
    maya_nudge: 'Maya',
    foundation_milestone: 'Foundation',
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

  const mayaContext = useMemo(
    () => buildNotificationsMayaContext({ notifications, typeLabel }),
    [notifications],
  )
  useMayaContext(mayaContext)

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
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 sm:px-8">

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Notifications</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">Notification center</h1>
            <p className="mt-2 text-sm leading-6 text-text-sec">
              {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={marking}
              className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2563EB] disabled:opacity-50"
            >
              {marking
                ? <Loader2 size={14} className="animate-spin" />
                : <CheckCheck size={14} />
              }
              Mark all as read
            </button>
          )}
        </div>
      </section>

      {/* Filter tabs */}
      <div className="flex w-fit items-center gap-1 rounded-xl border border-gray-100 bg-white p-1">
        {(['all', 'unread', 'read'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-4 py-2 rounded-lg capitalize transition-all ${
              filter === f
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-text-sec hover:text-text'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-brand-primary text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
          <Bell size={24} className="mx-auto mb-3 text-text-soft" />
          <p className="mb-1 text-sm font-semibold text-text">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-xs text-text-soft">
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
              className={`rounded-2xl border transition-all ${
                !notif.read
                  ? 'border-brand-primary/20 bg-brand-primary/5 hover:border-brand-primary/30'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-4 p-5">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  !notif.read ? 'bg-surface' : 'bg-surface-2'
                }`} style={{ border: '1px solid #E2E8F0' }}>
                  <span style={{ background: typeColor(notif.type), color: '#fff', borderRadius: 5, padding: '2px 5px', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {typeInitial(notif.type)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wide text-text-sec">
                        {typeLabel(notif.type)}
                      </span>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-text-soft">
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                  <p className={`mb-1 text-sm font-semibold ${!notif.read ? 'text-text' : 'text-text-sec'}`}>
                    {notif.title}
                  </p>
                  <p className="text-sm leading-relaxed text-text-sec">{notif.body}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-3">
                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={() => { if (!notif.read) markRead(notif.id) }}
                        className="text-xs font-semibold text-brand-primary hover:text-[#2563EB] transition-colors"
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
