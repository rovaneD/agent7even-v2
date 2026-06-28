'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildSupportMayaContext } from '@/lib/maya/summaries/workspaceContext'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { isServiceOrderTicketSubject } from '@/lib/support/serviceOrderLink'
import {
  MessageSquare, Plus, ChevronRight, ChevronLeft,
  Loader2, AlertCircle, X, CheckCircle,
  Send,
} from 'lucide-react'

interface Message {
  id: string
  sender_role: string
  body: string
  created_at: string
}

interface Ticket {
  id: string
  subject: string
  body: string | null
  status: string
  priority: string | null
  created_at: string
  updated_at: string
  support_messages: Message[]
  linked_order_id?: string | null
  linked_order_title?: string | null
}

interface Props {
  profileId: string
  companyName: string
  clientEmail: string
  clientName: string
  tickets: Ticket[]
  initialTicketId?: string | null
}

function priorityBadge(priority: string | null) {
  const map: Record<string, string> = {
    urgent: 'bg-status-danger/10 text-status-danger border border-status-danger/20',
    medium: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
    low: 'bg-surface-muted text-text-sec border border-border',
  }
  const label = priority ?? 'low'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[label] ?? map.low}`}>
      {label}
    </span>
  )
}

function statusBadge(status: string) {
  if (status === 'open') return (
    <span className="flex items-center gap-1 text-xs font-medium text-status-success bg-status-success/10 border border-status-success/20 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
      Open
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-text-sec bg-surface-muted border border-border px-2 py-0.5 rounded-full">
      <CheckCircle size={10} />
      Closed
    </span>
  )
}

function linkedOrderLabel(ticket: Ticket) {
  if (!ticket.linked_order_id) return null
  return ticket.linked_order_title ?? formatOrderNumber({ id: ticket.linked_order_id })
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SupportClient({
  profileId: _profileId, companyName, clientEmail: _clientEmail, clientName: _clientName, tickets: initial, initialTicketId = null,
}: Props) {
  const [tickets, setTickets] = useState<Ticket[]>(initial)
  const initialTicket = initialTicketId ? initial.find(t => t.id === initialTicketId) ?? null : null
  const [view, setView] = useState<'list' | 'new' | 'thread'>(initialTicket ? 'thread' : 'list')

  const mayaContext = useMemo(
    () => buildSupportMayaContext({ companyName, tickets }),
    [companyName, tickets],
  )
  useMayaContext(mayaContext)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(initialTicket)

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('low')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)

  async function handleSubmit() {
    if (!subject.trim() || !body.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/support/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, priority }),
      })
      if (!res.ok) throw new Error('Failed to submit ticket')
      const { ticket } = await res.json()
      setTickets(prev => [ticket, ...prev])
      setView('list')
      setSubject('')
      setBody('')
      setPriority('low')
    } catch {
      setError('Failed to submit ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReply() {
    if (!replyBody.trim() || !activeTicket) return
    setReplying(true)
    try {
      const res = await fetch('/api/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: activeTicket.id, body: replyBody, role: 'client' }),
      })
      if (!res.ok) throw new Error('Failed to send reply')
      const { message } = await res.json()
      const updated = {
        ...activeTicket,
        support_messages: [...activeTicket.support_messages, message],
        updated_at: new Date().toISOString(),
      }
      setActiveTicket(updated)
      setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
      setReplyBody('')
    } catch {
      setError('Failed to send reply.')
    } finally {
      setReplying(false)
    }
  }

  function openTicket(ticket: Ticket) {
    setActiveTicket(ticket)
    setView('thread')
  }

  // ── New ticket form ──────────────────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">
        <button
          onClick={() => setView('list')}
          className="mb-6 flex items-center gap-2 text-sm text-text-soft hover:text-text transition-colors"
        >
          <ChevronLeft size={16} />
          Back to support
        </button>

        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-7">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Support</p>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-text">New support ticket</h1>
          <p className="mt-2 text-sm text-text-sec">Share the issue, set priority, and keep the thread in one place.</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-text-soft uppercase tracking-wide block mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full text-sm border border-border rounded-xl px-4 py-3 text-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-text-soft"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-soft uppercase tracking-wide block mb-2">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'urgent'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`text-xs font-medium px-4 py-2 rounded-lg border capitalize transition-all ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-status-danger/10 border-status-danger/30 text-status-danger'
                        : p === 'medium'
                        ? 'bg-status-warning/10 border-status-warning/30 text-status-warning'
                        : 'bg-surface-muted border-border text-text-sec'
                      : 'border-border text-text-soft hover:border-brand-primary/30'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-soft uppercase tracking-wide block mb-2">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={6}
              className="w-full text-sm border border-border rounded-xl px-4 py-3 text-text focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-text-soft resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-status-danger/10 border border-status-danger/20 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-status-danger" />
              <p className="text-xs text-status-danger">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X size={12} className="text-status-danger" /></button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setView('list')}
              className="flex-1 text-sm font-medium text-text-sec bg-surface-muted hover:bg-bg-soft py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!subject.trim() || !body.trim() || submitting}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand-primary hover:bg-[#2563EB] py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? 'Submitting...' : 'Submit ticket'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Thread view ──────────────────────────────────────────────────────────────
  if (view === 'thread' && activeTicket) {
    return (
      <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8">
        <button
          onClick={() => setView('list')}
          className="mb-6 flex items-center gap-2 text-sm text-text-soft hover:text-text transition-colors"
        >
          <ChevronLeft size={16} />
          Back to support
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-text">{activeTicket.subject}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {statusBadge(activeTicket.status)}
              {priorityBadge(activeTicket.priority)}
              <span className="text-xs text-text-soft">Opened {formatDate(activeTicket.created_at)}</span>
            </div>
          </div>
        </div>

        {activeTicket.linked_order_id && (
          <div className="mb-6 flex flex-col gap-2 rounded-xl border border-brand-primary/15 bg-brand-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-sec">
              Linked to service order:{' '}
              <span className="font-semibold text-text">{linkedOrderLabel(activeTicket)}</span>
            </p>
            <Link
              href={`/dashboard/services?order=${encodeURIComponent(activeTicket.linked_order_id)}`}
              className="text-xs font-semibold text-brand-primary hover:text-[#2563EB] whitespace-nowrap"
            >
              View in Services →
            </Link>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4 mb-6">
          {activeTicket.support_messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_role === 'client' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                msg.sender_role === 'client'
                  ? 'bg-brand-primary text-white rounded-br-none'
                  : 'bg-surface border border-border text-text rounded-bl-none'
              }`}>
                <div className={`flex items-center gap-2 mb-2 ${msg.sender_role === 'client' ? 'justify-end' : ''}`}>
                  <span className={`text-xs font-semibold ${
                    msg.sender_role === 'client' ? 'text-white/80' : 'text-brand-primary'
                  }`}>
                    {msg.sender_role === 'client' ? 'You' : 'Agent7even Support'}
                  </span>
                  <span className={`text-xs ${msg.sender_role === 'client' ? 'text-white/60' : 'text-text-soft'}`}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender_role === 'client' ? 'text-white' : 'text-text-sec'
                }`}>
                  {msg.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {activeTicket.status === 'open' ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Write a reply..."
              rows={4}
              className="w-full text-sm text-text placeholder:text-text-soft resize-none focus:outline-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleReply}
                disabled={!replyBody.trim() || replying}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-brand-primary hover:bg-[#2563EB] px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {replying ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-muted rounded-2xl border border-border px-5 py-4 text-center">
            <CheckCircle size={18} className="text-text-soft mx-auto mb-2" />
            <p className="text-sm text-text-sec">This ticket has been closed.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Ticket list ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-8 sm:px-8">
      <div className="rounded-2xl border border-gray-100 bg-white p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Support</p>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-text">Help desk</h1>
          <p className="mt-2 text-sm text-text-sec">
            {companyName ? `${companyName} — ` : ''}Get help from the Agent7even team. Service order conversations also live on Services.
          </p>
        </div>
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-2 bg-brand-primary text-white text-[15px] font-medium px-4 py-2.5 rounded-xl hover:bg-[#2563EB] transition-colors"
        >
          <Plus size={15} />
          New ticket
        </button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={24} className="text-brand-primary" />
          </div>
          <h3 className="text-sm font-semibold text-text mb-1">No support tickets yet</h3>
          <p className="text-xs text-text-soft max-w-xs mx-auto mb-6 leading-relaxed">
            Have a question or issue? Open a ticket and we&apos;ll get back to you within one business day.
          </p>
          <button
            onClick={() => setView('new')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-primary hover:bg-[#2563EB] px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={14} />
            Open your first ticket
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => openTicket(ticket)}
              className="w-full rounded-2xl border border-gray-100 bg-white p-5 text-left transition-all hover:border-brand-primary/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {statusBadge(ticket.status)}
                    {priorityBadge(ticket.priority)}
                    {(ticket.linked_order_id || isServiceOrderTicketSubject(ticket.subject)) && (
                      <span className="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary">
                        Service order
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-text mb-1">{ticket.subject}</p>
                  {ticket.linked_order_id && (
                    <p className="mb-1 text-xs text-text-sec">
                      Order: {linkedOrderLabel(ticket)}
                    </p>
                  )}
                  <p className="text-xs text-text-soft">
                    {ticket.support_messages.length} message{ticket.support_messages.length !== 1 ? 's' : ''}
                    {' · '}Last updated {formatDate(ticket.updated_at)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-text-soft flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
