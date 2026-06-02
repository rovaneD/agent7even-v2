'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-600',
  in_review: 'bg-yellow-50 text-yellow-600',
  in_progress: 'bg-purple-50 text-purple-600',
  delivered: 'bg-green-50 text-green-600',
  approved: 'bg-green-50 text-green-600',
  completed: 'bg-green-50 text-green-600',
  cancelled: 'bg-gray-50 text-gray-400',
  revision_requested: 'bg-orange-50 text-orange-600',
}

export default function OrderStatusUpdater({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  const updateStatus = async (newStatus: string) => {
    setSaving(true)
    try {
      await fetch('/api/admin/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      })
      setStatus(newStatus)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {saving && <Loader2 size={12} className="text-gray-400 animate-spin" />}
      <select
        value={status}
        onChange={e => updateStatus(e.target.value)}
        disabled={saving}
        className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-full border-0 outline-none cursor-pointer ${STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-400'}`}
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
}
