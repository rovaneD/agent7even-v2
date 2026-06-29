'use client'

import { Check, X } from 'lucide-react'
import type { FormSurfaceSnapshot } from '@/lib/maya/formActuation'
import { diffFormPatch } from '@/lib/maya/formActuation'

export default function FormPatchApplyCard({
  snapshot,
  patch,
  errors,
  onApply,
  onDismiss,
  applied,
}: {
  snapshot: FormSurfaceSnapshot
  patch: Record<string, string>
  errors: string[]
  onApply: () => void
  onDismiss: () => void
  applied?: boolean
}) {
  const changes = diffFormPatch(patch, snapshot)

  if (applied) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
        <p className="text-[12px] font-medium text-emerald-800">Applied to {snapshot.label}</p>
      </div>
    )
  }

  if (errors.length > 0) {
    return (
      <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
        <p className="text-[12px] font-medium text-amber-900 mb-1">Could not use Maya&apos;s form suggestion</p>
        <p className="text-[11px] text-amber-800">{errors.join(' · ')}</p>
      </div>
    )
  }

  if (changes.length === 0) {
    return null
  }

  return (
    <div className="mt-2 rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/5 px-3 py-3">
      <p className="text-[12px] font-semibold text-text mb-2">
        Apply to {snapshot.label}?
      </p>
      <ul className="space-y-1.5 mb-3">
        {changes.map(change => (
          <li key={change.key} className="text-[11px] leading-snug text-text-sec">
            <span className="font-medium text-text">{change.label}:</span>{' '}
            {change.from} → {change.to}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onApply}
          className="inline-flex items-center gap-1 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2563EB]"
        >
          <Check size={12} />
          Apply
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-text-sec hover:bg-gray-50"
        >
          <X size={12} />
          Dismiss
        </button>
      </div>
    </div>
  )
}
