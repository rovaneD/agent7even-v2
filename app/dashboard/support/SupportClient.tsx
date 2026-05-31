'use client'

import { useState, useEffect } from 'react'
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
}

interface Props {
  profileId: string
  companyName: string
  clientEmail: string
  clientName: string
  tickets: Ticket[]
}

function priorityBadge(priority: string | null) {
  const map: Record<string, string> = {
    urgent: 'bg-red-50 text-red-600 border border-red-100',
    medium: 'bg-amber-50 text-amber-600 border border-amber-100',
    low: 'bg-gray-50 text-gray-500 border border-gray-100',
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
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Open
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
      <CheckCircle size={10} />
      Closed
    </span>
  )
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SupportClient({
  profileId: _profileId, companyName, clientEmail: _clientEmail, clientName: _clientName, tickets: initial,
}: Props) {
  const [tickets, setTickets] = useState<Ticket[]>(initial)
  const [view, setView] = useState<'list' | 'new' | 'thread'>('list')

  useEffect(() => {
    const openTickets = initial.filter(t => t.status === 'open')
    const ticketLines = initial.length
      ? initial.map(t => `- "${t.subject}" (status: ${t.status}, priority: ${t.priority ?? 'low'})`).join('\n')
      : '- No support tickets yet'
    const context = `SUPPORT PAGE
Company: ${companyName}
Open tickets: ${openTickets.length}
All tickets (${initial.length}):
${ticketLines}
The user can view existing tickets or open a new support ticket with the Agent7even team.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)

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
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-8 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to support
        </button>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">New support ticket</h1>
        <p className="text-sm text-gray-400 mb-8">We typically respond within one business day.</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20 placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Priority</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'urgent'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`text-xs font-medium px-4 py-2 rounded-lg border capitalize transition-all ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : p === 'medium'
                        ? 'bg-amber-50 border-amber-200 text-amber-600'
                        : 'bg-gray-100 border-gray-300 text-gray-700'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={6}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20 placeholder:text-gray-300 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertCircle size={13} className="text-red-500" />
              <p className="text-xs text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X size={12} className="text-red-400" /></button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setView('list')}
              className="flex-1 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!subject.trim() || !body.trim() || submitting}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#c8522a] hover:bg-[#b8471f] py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-8 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to support
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{activeTicket.subject}</h1>
            <div className="flex items-center gap-3 mt-2">
              {statusBadge(activeTicket.status)}
              {priorityBadge(activeTicket.priority)}
              <span className="text-xs text-gray-400">Opened {formatDate(activeTicket.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4 mb-6">
          {activeTicket.support_messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_role === 'client' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                msg.sender_role === 'client'
                  ? 'bg-[#c8522a] text-white rounded-br-none'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
              }`}>
                <div className={`flex items-center gap-2 mb-2 ${msg.sender_role === 'client' ? 'justify-end' : ''}`}>
                  <span className={`text-xs font-semibold ${
                    msg.sender_role === 'client' ? 'text-white/80' : 'text-[#c8522a]'
                  }`}>
                    {msg.sender_role === 'client' ? 'You' : 'Agent7even Support'}
                  </span>
                  <span className={`text-xs ${msg.sender_role === 'client' ? 'text-white/60' : 'text-gray-400'}`}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender_role === 'client' ? 'text-white' : 'text-gray-700'
                }`}>
                  {msg.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {activeTicket.status === 'open' ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Write a reply..."
              rows={4}
              className="w-full text-sm text-gray-800 placeholder:text-gray-300 resize-none focus:outline-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleReply}
                disabled={!replyBody.trim() || replying}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-[#c8522a] hover:bg-[#b8471f] px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {replying ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 text-center">
            <CheckCircle size={18} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">This ticket has been closed.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Ticket list ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Support</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {companyName ? `${companyName} — ` : ''}Get help from the Agent7even team
          </p>
        </div>
        <button
          onClick={() => setView('new')}
          className="flex items-center gap-2 bg-[#c8522a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#b8471f] transition-colors"
        >
          <Plus size={15} />
          New ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={24} className="text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No support tickets yet</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-6 leading-relaxed">
            Have a question or issue? Open a ticket and we&apos;ll get back to you within one business day.
          </p>
          <button
            onClick={() => setView('new')}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#c8522a] bg-[#c8522a]/10 hover:bg-[#c8522a]/15 px-4 py-2.5 rounded-xl transition-colors"
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
              className="w-full bg-white rounded-2xl border border-gray-100 hover:border-[#c8522a]/20 hover:shadow-sm p-5 text-left transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    {statusBadge(ticket.status)}
                    {priorityBadge(ticket.priority)}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">{ticket.subject}</p>
                  <p className="text-xs text-gray-400">
                    {ticket.support_messages.length} message{ticket.support_messages.length !== 1 ? 's' : ''}
                    {' · '}Last updated {formatDate(ticket.updated_at)}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
