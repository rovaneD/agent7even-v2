'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2, Send } from 'lucide-react'

interface Message {
  id: string
  sender_role: string
  body: string
  created_at: string
}

interface Props {
  orderId: string
  initialStatus: string
  ticketId: string
  initialMessages: Message[]
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminOrderConversation({ orderId, initialStatus, ticketId, initialMessages }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [status, setStatus] = useState(initialStatus)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [error, setError] = useState('')

  async function updateStatus(nextStatus: string) {
    if (nextStatus === status) return
    setUpdatingStatus(true)
    setError('')
    try {
      const res = await fetch('/api/admin/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setStatus(nextStatus)
      router.refresh()
    } catch {
      setError('Could not update the order status. Try again.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function sendReply() {
    if (!replyBody.trim()) return
    setReplying(true)
    setError('')
    try {
      const res = await fetch('/api/support/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, body: replyBody, role: 'admin' }),
      })
      if (!res.ok) throw new Error('Failed to send reply')
      const { message } = await res.json()
      setMessages(prev => [...prev, message])
      setReplyBody('')
    } catch {
      setError('Could not send that message. Try again.')
    } finally {
      setReplying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-2">
            Order status
          </label>
          <select
            value={status}
            disabled={updatingStatus}
            onChange={e => updateStatus(e.target.value)}
            className="w-full sm:w-56 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#3B82F6]/50 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => updateStatus('completed')}
          disabled={updatingStatus || status === 'completed'}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D3748] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updatingStatus ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {status === 'completed' ? 'Order completed' : 'Mark complete'}
        </button>
      </div>

      {messages.map(message => (
        <div
          key={message.id}
          className={`flex ${message.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
        >
          <div className={`max-w-[78%] rounded-2xl px-5 py-4 ${
            message.sender_role === 'admin'
              ? 'bg-[#2D3748] text-white rounded-br-none'
              : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-none'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold ${message.sender_role === 'admin' ? 'text-white/75' : 'text-[#3B82F6]'}`}>
                {message.sender_role === 'admin' ? 'Agent7even' : 'Client'}
              </span>
              <span className={`text-xs ${message.sender_role === 'admin' ? 'text-white/50' : 'text-gray-400'}`}>
                {formatDate(message.created_at)}
              </span>
            </div>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${message.sender_role === 'admin' ? 'text-white' : 'text-gray-700'}`}>
              {message.body}
            </p>
          </div>
        </div>
      ))}

      <div className="border-t border-gray-100 pt-4">
        <textarea
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          placeholder="Write a service follow-up message..."
          rows={4}
          className="w-full text-sm text-gray-800 placeholder:text-gray-300 resize-none focus:outline-none border border-gray-100 rounded-xl px-4 py-3"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end mt-3">
          <button
            onClick={sendReply}
            disabled={!replyBody.trim() || replying}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-[#2D3748] hover:bg-[#1E293B] px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {replying ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </div>
    </div>
  )
}
