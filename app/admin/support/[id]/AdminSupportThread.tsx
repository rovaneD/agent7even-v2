'use client'

import { useState, useEffect } from 'react'
import {
  ChevronLeft, Send, Loader2, CheckCircle,
  AlertCircle, X,
} from 'lucide-react'
import Link from 'next/link'

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
  profiles: {
    id: string
    full_name: string
    company_name: string
    email: string
  }
  support_messages: Message[]
}

interface Props {
  ticket: Ticket
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminSupportThread({ ticket: initial }: Props) {
  const [ticket, setTicket] = useState<Ticket>(initial)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = ticket.profiles

  useEffect(() => {
    const lines = [
      `ADMIN — SUPPORT THREAD: "${initial.subject}"`,
      `Client: ${initial.profiles.company_name ?? initial.profiles.full_name} (${initial.profiles.email})`,
      `Status: ${initial.status} | Priority: ${initial.priority ?? 'low'}`,
      `Messages: ${initial.support_messages.length}`,
      initial.support_messages.length > 0
        ? `Latest message (${initial.support_messages[initial.support_messages.length - 1].sender_role}): ${initial.support_messages[initial.support_messages.length - 1].body.slice(0, 120)}`
        : 'No messages yet',
    ]
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
  }, [])

  async function handleReply() {
    if (!replyBody.trim()) return
    setReplying(true)
    setError(null)
    try {
      const res = await fetch('/api/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, body: replyBody, role: 'admin' }),
      })
      if (!res.ok) throw new Error('Reply failed')
      const { message } = await res.json()
      setTicket(prev => ({
        ...prev,
        support_messages: [...prev.support_messages, message],
        updated_at: new Date().toISOString(),
      }))
      setReplyBody('')
    } catch {
      setError('Failed to send reply.')
    } finally {
      setReplying(false)
    }
  }

  async function handleUpdate(updates: { status?: string; priority?: string }) {
    setUpdating(true)
    try {
      const res = await fetch('/api/support/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, ...updates }),
      })
      if (!res.ok) throw new Error('Update failed')
      setTicket(prev => ({ ...prev, ...updates }))
    } catch {
      setError('Failed to update ticket.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Link
        href="/admin/support"
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 mb-8 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to support
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {client.company_name ?? client.full_name} · {client.email}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Opened {formatDate(ticket.created_at)}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <select
            value={ticket.priority ?? 'low'}
            onChange={e => handleUpdate({ priority: e.target.value })}
            disabled={updating}
            className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6] bg-white text-gray-700"
          >
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="urgent">Urgent</option>
          </select>

          {ticket.status === 'open' ? (
            <button
              onClick={() => handleUpdate({ status: 'closed' })}
              disabled={updating}
              className="flex items-center gap-2 text-xs font-semibold text-white bg-gray-800 hover:bg-gray-900 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircle size={13} />
              Close ticket
            </button>
          ) : (
            <button
              onClick={() => handleUpdate({ status: 'open' })}
              disabled={updating}
              className="flex items-center gap-2 text-xs font-semibold text-[#64748B] bg-[#2D3748]/10 hover:bg-[#2D3748]/15 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Reopen ticket
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {ticket.support_messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
              msg.sender_role === 'admin'
                ? 'bg-[#2D3748] text-white rounded-br-none'
                : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${msg.sender_role === 'admin' ? 'justify-end' : ''}`}>
                <span className={`text-xs font-semibold ${
                  msg.sender_role === 'admin' ? 'text-white/80' : 'text-[#64748B]'
                }`}>
                  {msg.sender_role === 'admin' ? 'You (Agent7even)' : client.full_name}
                </span>
                <span className={`text-xs ${msg.sender_role === 'admin' ? 'text-white/60' : 'text-gray-400'}`}>
                  {formatDate(msg.created_at)}
                </span>
              </div>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                msg.sender_role === 'admin' ? 'text-white' : 'text-gray-700'
              }`}>
                {msg.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      {ticket.status === 'open' ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <textarea
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            placeholder={`Reply to ${client.full_name}...`}
            rows={5}
            className="w-full text-sm text-gray-800 placeholder:text-gray-300 resize-none focus:outline-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleReply}
              disabled={!replyBody.trim() || replying}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-[#2D3748] hover:bg-[#b8471f] px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {replying ? 'Sending...' : 'Send reply'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-6 text-center">
          <CheckCircle size={20} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">This ticket is closed.</p>
          <button
            onClick={() => handleUpdate({ status: 'open' })}
            className="text-xs font-medium text-[#64748B] hover:underline mt-2 block mx-auto"
          >
            Reopen if needed
          </button>
        </div>
      )}
    </div>
  )
}
