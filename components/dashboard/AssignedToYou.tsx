'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Loader2, MessageSquare, Play } from 'lucide-react'
import { agentDisplayName } from '@/lib/agents/digestPreview'
import type { AssignedTaskRow } from '@/lib/team/taskAssignments'

type Props = {
  tasks: AssignedTaskRow[]
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AssignedToYou({ tasks: initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (tasks.length === 0) return null

  async function startTask(taskId: string) {
    setStartingId(taskId)
    setError(null)
    try {
      const res = await fetch(`/api/agents/tasks/${taskId}/start`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start assignment')
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start assignment')
    } finally {
      setStartingId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-primary">
          <ClipboardList size={16} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-primary">Assigned to you</p>
          <h2 className="text-[17px] font-semibold text-text-primary">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} waiting
          </h2>
        </div>
      </div>

      {error && (
        <p className="mb-3 text-xs text-status-danger">{error}</p>
      )}

      <ul className="space-y-3">
        {tasks.map(task => {
          const due = formatDue(task.assignment_due_at)
          return (
            <li
              key={task.id}
              className="flex flex-col gap-3 rounded-xl border border-white/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">
                  {agentDisplayName(task.agent)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-sec">
                  From {task.assignerName ?? 'account owner'}
                  {due ? ` · Due ${due}` : ''}
                </p>
                {task.assignment_note && (
                  <p className="mt-2 text-sm leading-relaxed text-text-primary">
                    {task.assignment_note}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href={`/dashboard/team/tasks/${task.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-text-sec hover:border-gray-300 hover:text-text transition-colors"
                >
                  <MessageSquare size={14} />
                  Discussion
                </Link>
                <button
                  type="button"
                  onClick={() => startTask(task.id)}
                  disabled={startingId === task.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {startingId === task.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Start
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
