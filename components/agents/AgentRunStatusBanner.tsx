'use client'

import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react'
import type { RunTracker } from '@/lib/agents/agentRunUi'

export default function AgentRunStatusBanner({
  tracker,
  onDismiss,
}: {
  tracker: RunTracker
  onDismiss: () => void
}) {
  const isGenerating = tracker.phase === 'generating'
  const isDone = tracker.phase === 'done'
  const isError = tracker.phase === 'error'

  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border shadow-sm ${
        isGenerating
          ? 'border-blue-100 bg-blue-50'
          : isDone
            ? 'border-emerald-100 bg-emerald-50'
            : 'border-red-100 bg-red-50'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4 px-5 py-4">
        <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          isGenerating
            ? 'bg-white text-brand-primary'
            : isDone
              ? 'bg-white text-emerald-600'
              : 'bg-white text-red-600'
        }`}>
          {isGenerating && <Loader2 size={20} className="animate-spin" />}
          {isDone && <CheckCircle2 size={20} />}
          {isError && <AlertCircle size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${
            isGenerating ? 'text-blue-900' : isDone ? 'text-emerald-900' : 'text-red-900'
          }`}>
            {tracker.message}
          </p>
          {tracker.detail && (
            <p className={`mt-1 text-[13px] leading-relaxed ${
              isGenerating ? 'text-blue-800/80' : isDone ? 'text-emerald-800/80' : 'text-red-800/80'
            }`}>
              {tracker.detail}
            </p>
          )}
          {isGenerating && (
            <p className="mt-2 text-[12px] text-blue-700/70">
              Usually 15–45 seconds. Stay on this page — we&apos;ll show a link when it&apos;s ready.
            </p>
          )}
          {isDone && tracker.primaryHref && tracker.primaryLabel && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={tracker.primaryHref}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-[#2563EB]"
              >
                {tracker.primaryLabel}
                <ArrowRight size={14} />
              </Link>
              {tracker.contentFlow === 'single' && (
                <Link
                  href="/dashboard/posts"
                  className="text-[13px] font-medium text-emerald-800 no-underline hover:underline"
                >
                  Posts (after you approve)
                </Link>
              )}
            </div>
          )}
        </div>

        {!isGenerating && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 rounded-lg p-1.5 text-text-soft hover:bg-black/5 hover:text-text-primary"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
