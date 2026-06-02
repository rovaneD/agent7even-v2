'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'approved', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function AdminOrderStatusControls({
  orderId,
  initialStatus,
  variant = 'panel',
}: {
  orderId: string
  initialStatus: string
  variant?: 'panel' | 'inline'
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function updateStatus(nextStatus: string) {
    if (nextStatus === status) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: nextStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to update status')
      }
      setStatus(nextStatus)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status.')
    } finally {
      setSaving(false)
    }
  }

  if (variant === 'inline') {
    return (
      <div className="flex flex-col gap-2">
        <select
          value={status === 'completed' ? 'approved' : status}
          disabled={saving}
          onChange={e => updateStatus(e.target.value)}
          className="w-full min-w-[132px] rounded-full border border-gray-100 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600 outline-none disabled:opacity-60"
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {status !== 'completed' && status !== 'approved' && (
          <button
            type="button"
            onClick={() => updateStatus('completed')}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#2D3748] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:opacity-50"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
            Complete
          </button>
        )}
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-2">
          Order status
        </label>
        <select
          value={status}
          disabled={saving}
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
        disabled={saving || status === 'completed'}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D3748] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {status === 'completed' || status === 'approved' ? 'Order completed' : 'Mark complete'}
      </button>
      {error && <p className="text-xs text-red-600 sm:self-center">{error}</p>}
    </div>
  )
}
