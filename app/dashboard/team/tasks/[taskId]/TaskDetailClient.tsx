'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, MessageSquare, Play, Send } from 'lucide-react'
import { useMayaContext } from '@/hooks/useMayaContext'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import type { AssignmentTaskRow, TaskNoteRow } from '@/lib/team/taskNotes'
import { formatNoteTimestamp, rosterForMentions } from '@/lib/team/taskNoteUi'
import type { WorkspaceTeamMemberRow } from '@/lib/team/teamRoster'

type Props = {
  task: AssignmentTaskRow
  initialNotes: TaskNoteRow[]
  viewerProfileId: string
  isOwner: boolean
  ownerMention: { id: string; name: string; email: string }
  teamRoster: WorkspaceTeamMemberRow[]
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TaskDetailClient({
  task,
  initialNotes,
  viewerProfileId,
  isOwner,
  ownerMention,
  teamRoster,
}: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAssignee = task.assigned_to_profile_id === viewerProfileId
  const canStart = isAssignee && task.status === 'pending'
  const mentionHints = rosterForMentions(ownerMention, teamRoster)

  useMayaContext(useMemo(() => ({
    page: 'Team task',
    dataSource: 'live' as const,
    metrics: [
      `Assignment: ${agentDisplayName(task.agent)}`,
      `Assignee: ${task.assigneeName ?? 'Team member'}`,
      `Status: ${task.status}`,
      `Discussion notes: ${notes.length}`,
    ],
    activeView: {
      label: 'Task discussion',
      state: agentDisplayName(task.agent),
    },
  }), [task, notes.length]))

  async function postNote() {
    const body = draft.trim()
    if (!body || posting) return
    setPosting(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/tasks/${task.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to post note')
      setNotes(prev => [...prev, data.note as TaskNoteRow])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post note')
    } finally {
      setPosting(false)
    }
  }

  async function startTask() {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/tasks/${task.id}/start`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start assignment')
      router.push('/dashboard/agents')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assignment')
    } finally {
      setStarting(false)
    }
  }

  const due = formatDue(task.assignment_due_at)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={isOwner ? '/dashboard/team' : '/dashboard'}
        className="mb-6 inline-flex items-center gap-2 text-sm text-text-sec hover:text-text transition-colors"
      >
        <ArrowLeft size={14} />
        {isOwner ? 'Back to Team' : 'Back to Dashboard'}
      </Link>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-soft">Assignment</p>
            <h1 className="mt-1 text-xl font-semibold text-text">{agentDisplayName(task.agent)}</h1>
            <p className="mt-2 text-sm text-text-sec">
              {task.assignerName ?? 'Account owner'} → {task.assigneeName ?? 'Team member'}
              {due ? ` · Due ${due}` : ''}
            </p>
          </div>
          {canStart && (
            <button
              type="button"
              onClick={startTask}
              disabled={starting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
            >
              {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Start assignment
            </button>
          )}
        </div>

        {task.assignment_note && (
          <div className="mt-5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1E40AF] mb-1">Assignment brief</p>
            <p className="text-sm leading-relaxed text-[#1E3A8A] whitespace-pre-wrap">{task.assignment_note}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-text-soft" />
          <h2 className="text-sm font-semibold text-text">Discussion</h2>
          <span className="text-xs text-text-soft">{notes.length} note{notes.length === 1 ? '' : 's'}</span>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-text-soft mb-4">
            No notes yet. Use this thread to align before and during the assignment.
          </p>
        ) : (
          <ul className="space-y-4 mb-5">
            {notes.map(note => {
              const isSelf = note.author_profile_id === viewerProfileId
              return (
                <li key={note.id} className={`flex gap-3 ${isSelf ? 'flex-row-reverse' : ''}`}>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-text-sec">
                    {(note.authorName ?? '?')[0]?.toUpperCase()}
                  </div>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2.5 ${isSelf ? 'bg-brand-primary/10' : 'bg-gray-50'}`}>
                    <div className={`flex items-baseline gap-2 mb-1 ${isSelf ? 'justify-end' : ''}`}>
                      <span className="text-xs font-semibold text-text">{note.authorName}</span>
                      <span className="text-[10px] text-text-soft">{formatNoteTimestamp(note.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-text-sec whitespace-pre-wrap">{note.body}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {error && (
          <p className="mb-3 text-xs text-status-danger">{error}</p>
        )}

        <div className="rounded-xl border border-gray-100 bg-[#FAFAFA] p-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
            placeholder="Add a note for the team… Use @name to mention someone."
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-text outline-none focus:border-brand-primary"
          />
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-text-soft">
              Mention: {mentionHints.join(' · ')}
            </p>
            <button
              type="button"
              onClick={postNote}
              disabled={!draft.trim() || posting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-50"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Post note
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
