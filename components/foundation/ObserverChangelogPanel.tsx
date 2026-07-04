'use client'

import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'

type ChangelogRow = {
  id: string
  signalType: string
  agentId: string | null
  summary: string
  createdAt: string
}

export default function ObserverChangelogPanel() {
  const [rows, setRows] = useState<ChangelogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/foundation/changelog')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        if (!cancelled) setRows(data.rows ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center">
          <Eye size={15} className="text-[#7C3AED]" />
        </div>
        <div>
          <p className="text-[14px] font-[500] text-text">What Maya has noticed</p>
          <p className="text-[11px] text-text-soft">From your approvals, rejections, and edits — not changes to Foundation yet</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[12px] text-text-soft py-3">
          <Loader2 size={14} className="animate-spin" /> Loading observations…
        </div>
      )}

      {error && <p className="text-[12px] text-red-600 py-2">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="text-[13px] text-text-sec py-2">
          No observations yet. Approve, reject, or edit agent outputs — Maya will log decision signals here.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <ul className="mt-2 space-y-2 border-t border-gray-100 pt-3">
          {rows.map(row => (
            <li key={row.id} className="text-[13px] leading-relaxed">
              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mr-2 ${
                row.signalType === 'approved'
                  ? 'bg-[#F0FDF4] text-[#166534]'
                  : row.signalType === 'rejected'
                    ? 'bg-[#FEF2F2] text-[#991B1B]'
                    : 'bg-[#EFF6FF] text-[#1D4ED8]'
              }`}>
                {row.signalType}
              </span>
              <span className="text-text-sec">{row.summary}</span>
              <span className="text-[11px] text-text-soft ml-2">
                {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
