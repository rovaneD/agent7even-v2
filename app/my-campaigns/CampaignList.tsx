'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Task {
  day: string
  action: string
  channel: string
  time_required: string
  priority: string
}

interface Week {
  week: number
  theme: string
  focus: string
  tasks: Task[]
}

interface CampaignPlan {
  title: string
  summary: string
  weeks: Week[]
  quick_wins: string[]
  metrics_to_track: string[]
  budget_allocation: Record<string, string>
}

interface CompletedTask {
  id: string
  task: string
  status: string
  selected_option: string
  completed_at: string
  message_count: number
}

interface Campaign {
  id: string
  title: string
  plan: CampaignPlan
  status: string
  created_at: string
  tasks?: CompletedTask[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const [openCampaign, setOpenCampaign] = useState<string | null>(null)
  const [openWeeks, setOpenWeeks] = useState<number[]>([])
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  function toggleCampaign(id: string) {
    if (openCampaign === id) {
      setOpenCampaign(null)
      setOpenWeeks([])
    } else {
      setOpenCampaign(id)
      setOpenWeeks([1])
    }
  }

  function toggleWeek(n: number) {
    setOpenWeeks(prev => prev.includes(n) ? prev.filter(w => w !== n) : [...prev, n])
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-gray-400 text-lg font-bold">7</span>
        </div>
        <p className="text-gray-900 font-semibold mb-1">No campaigns yet</p>
        <p className="text-gray-400 text-sm mb-6">Talk to Maya to build your first one.</p>
        <Link
          href="/maya"
          className="bg-[#0a0a0a] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          Talk to Maya
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {campaigns.map(c => {
        const isOpen = openCampaign === c.id
        const plan = c.plan

        return (
          <div key={c.id} className="border border-gray-100 rounded-2xl bg-white overflow-hidden">
            {/* Card header */}
            <div className="p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900 leading-snug mb-1">{c.title}</p>
                <p className="text-xs text-gray-400">{formatDate(c.created_at)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
                {c.status === 'active' && (
                  <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                    Active
                  </span>
                )}
                <button
                  onClick={() => toggleCampaign(c.id)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {isOpen ? 'Hide plan' : 'View plan'}
                </button>
              </div>
            </div>

            {/* Expanded plan */}
            {isOpen && plan && (
              <div className="border-t border-gray-100 px-5 pb-6 pt-5 flex flex-col gap-6">

                {/* Summary */}
                <p className="text-sm text-gray-600 leading-relaxed">{plan.summary}</p>

                {/* Quick wins */}
                {plan.quick_wins?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Do this today</p>
                    <div className="flex flex-col gap-2">
                      {plan.quick_wins.map((win, i) => {
                        const isDone = c.tasks?.some(t => t.task === win) ?? false
                        return (
                          <div key={i} className="flex gap-2.5 items-start justify-between">
                            <div className="flex gap-2.5 items-start flex-1 min-w-0">
                              <span className={`text-sm mt-0.5 flex-shrink-0 ${isDone ? 'text-green-600' : 'text-[#c8522a]'}`}>
                                {isDone ? '✓' : '→'}
                              </span>
                              <p className="text-sm text-gray-700 leading-relaxed">{win}</p>
                            </div>
                            {isDone ? (
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3 mt-0.5">
                                <span className="text-emerald-600 text-xs font-medium whitespace-nowrap">Done ✓</span>
                                <a
                                  href={`/maya?task=${encodeURIComponent(win)}&campaignId=${c.id}&edit=true&prior=${encodeURIComponent(
                                    (c.tasks ?? []).find(t =>
                                      t.task.toLowerCase().includes(win.toLowerCase().slice(0, 30))
                                    )?.selected_option?.slice(0, 120) ?? ''
                                  )}`}
                                  className="text-gray-300 hover:text-gray-500 transition-colors"
                                  title="Redo with Maya"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </a>
                              </div>
                            ) : (
                              <a
                                href={`/maya?task=${encodeURIComponent(win)}&campaignId=${c.id}`}
                                className="flex-shrink-0 text-xs font-medium text-[#c8522a] hover:underline whitespace-nowrap ml-3 mt-0.5"
                              >
                                Do this with Maya →
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Weeks */}
                {plan.weeks?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Week by week</p>
                    {plan.weeks.map(week => {
                      const weekOpen = openWeeks.includes(week.week)
                      return (
                        <div key={week.week} className="border border-gray-100 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleWeek(week.week)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <div>
                              <span className="text-sm font-medium text-gray-900">Week {week.week}</span>
                              <span className="text-sm text-gray-400 ml-2">— {week.theme}</span>
                            </div>
                            <span className="text-gray-300 text-xs">{weekOpen ? '▲' : '▼'}</span>
                          </button>
                          {weekOpen && (
                            <div className="border-t border-gray-100 px-4 py-3 flex flex-col gap-2">
                              {week.tasks?.map((task, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-gray-500">{task.day} · {task.channel}</span>
                                    <span className="text-xs text-gray-300">{task.time_required}</span>
                                  </div>
                                  <p className="text-sm text-gray-700 leading-snug">{task.action}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Metrics */}
                {plan.metrics_to_track?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Track these</p>
                    <div className="flex flex-wrap gap-2">
                      {plan.metrics_to_track.map((m, i) => (
                        <span key={i} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed tasks */}
                {c.tasks && c.tasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Completed tasks</p>
                    <div className="flex flex-col gap-2">
                      {c.tasks.map(t => (
                        <div key={t.id} className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="flex items-start justify-between px-4 py-3 gap-3">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span className="text-green-600 text-sm mt-0.5 flex-shrink-0">✓</span>
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 leading-snug">{t.task}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{formatRelative(t.completed_at)}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setOpenTaskId(openTaskId === t.id ? null : t.id)}
                              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap mt-0.5"
                            >
                              {openTaskId === t.id ? 'Hide' : 'View selected'}
                            </button>
                          </div>
                          {openTaskId === t.id && (
                            <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Selected option</p>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{t.selected_option}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
