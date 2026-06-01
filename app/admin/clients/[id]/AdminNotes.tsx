'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'

interface Note {
  id: string
  body: string
  created_at: string
  profiles?: { full_name: string | null }
}

export default function AdminNotes({
  clientId,
  adminId,
  initialNotes,
}: {
  clientId: string
  adminId: string
  initialNotes: Note[]
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const addNote = async () => {
    if (!body.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, body }),
      })
      const data = await res.json()
      if (data.note) {
        setNotes(prev => [data.note, ...prev])
        setBody('')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
        Internal notes <span className="text-gray-300 font-normal normal-case tracking-normal">(not visible to client)</span>
      </p>

      {/* Add note */}
      <div className="flex gap-2 mb-4">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add an internal note..."
          rows={2}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-300 outline-none focus:border-[#3B82F6]/40 resize-none transition-colors"
        />
        <button
          onClick={addNote}
          disabled={!body.trim() || saving}
          className="w-10 h-10 rounded-xl bg-[#2D3748] flex items-center justify-center disabled:opacity-40 hover:bg-[#1E293B] transition-colors flex-shrink-0 self-end"
        >
          {saving ? <Loader2 size={14} className="text-white animate-spin" /> : <Send size={14} className="text-white" />}
        </button>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-300 text-center py-4">No notes yet</p>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-700 leading-relaxed">{note.body}</p>
              <p className="text-[10px] text-gray-400 mt-1.5">
                {note.profiles?.full_name ?? 'Admin'} · {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
