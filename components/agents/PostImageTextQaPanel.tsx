'use client'

import { Loader2, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react'
import type { GeneratedImageOption, TextQaResult } from '@/lib/agents/imageGeneration/types'

type Props = {
  qa: TextQaResult | null
  loading: boolean
  retryCount: number
  maxRetries: number
  selectedOption: GeneratedImageOption | null
  onRegenerate?: () => void
  regenerating?: boolean
}

/** Step 4 — text QA status after picking a generated image. */
export default function PostImageTextQaPanel({
  qa,
  loading,
  retryCount,
  maxRetries,
  selectedOption,
  onRegenerate,
  regenerating,
}: Props) {
  if (!selectedOption) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-surface px-4 py-3 text-sm text-text-sec">
        <Loader2 size={16} className="animate-spin text-brand-primary" />
        Checking text in your image…
      </div>
    )
  }

  if (!qa) return null

  if (qa.passed) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
        <div>
          <p className="font-semibold">Text QA passed</p>
          {qa.transcription ? (
            <p className="mt-1 text-xs leading-5 text-emerald-800/90">
              Read: {qa.transcription.slice(0, 200)}
              {qa.transcription.length > 200 ? '…' : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-emerald-800/90">No problematic text detected.</p>
          )}
        </div>
      </div>
    )
  }

  const canRegenerate = retryCount < maxRetries

  return (
    <div className="space-y-3 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-900">
      <div className="flex items-start gap-2">
        <ShieldX size={18} className="mt-0.5 shrink-0 text-red-600" />
        <div>
          <p className="font-semibold">Text QA failed</p>
          <ul className="mt-1 list-inside list-disc text-xs leading-5 text-red-800/90">
            {qa.issues.map((issue, i) => (
              <li key={`${issue.code}-${i}`}>{issue.message}</li>
            ))}
          </ul>
          {qa.transcription && (
            <p className="mt-2 text-xs text-red-800/80">
              Transcription: {qa.transcription.slice(0, 240)}
              {qa.transcription.length > 240 ? '…' : ''}
            </p>
          )}
        </div>
      </div>
      {canRegenerate && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-50 disabled:opacity-60"
        >
          {regenerating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Regenerate this option ({maxRetries - retryCount} left)
        </button>
      )}
      {!canRegenerate && (
        <p className="text-xs text-red-800/90">
          Pick a different option or upload your own image.
        </p>
      )}
    </div>
  )
}
