'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import type { IdeaAnalysis } from '@/lib/agents/ideaAnalysis'
import type { ViralHooksDraftHints } from '@/lib/services/viralHooks'
import {
  buildViralHooksBrief,
  createViralHooksOrder,
  isUserSuppliedIdeaSource,
  mapAnalysisToViralHooksForm,
  storeViralHooksPrefill,
} from '@/lib/services/viralHooks'

type Props = {
  analysis: IdeaAnalysis
  hints?: ViralHooksDraftHints
  compact?: boolean
}

export default function IdeaAnalysisOutputView({ analysis, hints, compact = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userSupplied = isUserSuppliedIdeaSource(analysis.source_ref)

  async function handleDraftMyVersion() {
    setError(null)
    setLoading(true)
    try {
      if (userSupplied) {
        storeViralHooksPrefill(mapAnalysisToViralHooksForm(analysis, hints))
        router.push('/dashboard/services?viralHooks=prefill')
        return
      }

      const result = await createViralHooksOrder(buildViralHooksBrief(analysis, hints))
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/dashboard/services?order=${result.orderId}`)
    } finally {
      setLoading(false)
    }
  }

  const fields: { label: string; value: string }[] = [
    { label: 'Topic', value: analysis.topic },
    { label: 'Idea seed', value: analysis.idea_seed },
    { label: 'Unique angle', value: analysis.unique_angle },
    { label: 'Belief to challenge', value: analysis.belief_to_challenge },
    { label: 'Contrarian reality', value: analysis.contrarian_reality },
  ]

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="grid gap-3">
        {fields.map(field => (
          <div key={field.label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-soft">
              {field.label}
            </p>
            <p className="text-sm leading-relaxed text-text-primary">{field.value}</p>
          </div>
        ))}

        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-soft">
            Supporting directions
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text-primary">
            {analysis.supporting_evidence.map(entry => (
              <li key={entry}>{entry}</li>
            ))}
          </ol>
        </div>

        {analysis.source_ref && (
          <p className="text-xs text-text-sec">
            Source: <span className="font-medium text-text-primary">{analysis.source_ref}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleDraftMyVersion}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Sparkles size={15} />
          {loading ? 'Opening Viral Hooks…' : 'Draft my version'}
        </button>
        <p className="text-xs text-text-sec">
          {userSupplied
            ? 'Opens Viral Hooks with these fields pre-filled — review once, then Generate.'
            : 'Generates Viral Hooks immediately from this analysis.'}
        </p>
      </div>

      {error && (
        <p className="text-sm text-status-danger">{error}</p>
      )}
    </div>
  )
}
