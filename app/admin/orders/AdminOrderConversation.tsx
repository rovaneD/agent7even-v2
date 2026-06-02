'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'

interface Message {
  id: string
  sender_role: string
  body: string
  created_at: string
}

interface Props {
  ticketId: string
  initialMessages: Message[]
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function displayMessageBody(body: string) {
  return body.split('\n\nVIRAL HOOKS SERVICE FRAMEWORK')[0].trim()
}

export default function AdminOrderConversation({ ticketId, initialMessages }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')

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
              {displayMessageBody(message.body)}
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
