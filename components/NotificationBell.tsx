'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react'
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function typeColor(type: string): string {
  if (type.startsWith('order')) return '#3B82F6'
  if (type.startsWith('support')) return '#F59E0B'
  if (type === 'deliverable_uploaded') return '#10B981'
  if (type === 'brand_kit_generated') return '#10B981'
  if (type === 'plan_activated') return '#10B981'
  if (type === 'trial_ending') return '#EF4444'
  return '#64748B'
}

function typeInitial(type: string): string {
  if (type.startsWith('order')) return 'OR'
  if (type.startsWith('support')) return 'SP'
  if (type === 'deliverable_uploaded') return 'DL'
  if (type === 'brand_kit_generated') return 'BK'
  if (type === 'plan_activated') return 'PL'
  if (type === 'trial_ending') return 'TR'
  return 'NT'
}

export default function NotificationBell({ profileId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const instanceId = useId()

  const unreadCount = notifications.filter(n => !n.read).length

  // Realtime subscription — instanceId makes the channel unique per mounted instance
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${profileId}:${instanceId}`)
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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markRead(id: string) {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
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

  const recent = notifications.slice(0, 5)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
      >
        <Bell size={18} className="text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#2D3748] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-white bg-[#2D3748] px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={marking}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)}>
                <X size={15} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={20} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              recent.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.read) markRead(notif.id)
                    if (notif.link) setOpen(false)
                  }}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notif.read ? 'bg-[#2D3748]/5' : ''
                  }`}
                >
                  <span style={{ background: typeColor(notif.type), color: '#fff', borderRadius: 5, padding: '2px 5px', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0, marginTop: 2 }}>
                    {typeInitial(notif.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug ${!notif.read ? 'text-gray-900' : 'text-gray-600'}`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2D3748] flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{notif.body}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                  {notif.link && (
                    <Link
                      href={notif.link}
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0 mt-0.5"
                    >
                      <ExternalLink size={12} className="text-gray-300 hover:text-gray-500" />
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-50 text-center">
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-[#64748B] hover:text-[#b8471f] transition-colors"
              >
                View all notifications →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
