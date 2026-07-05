'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Clock, Loader2, Sparkles, X } from 'lucide-react'
import { PROPOSAL_STATE_LABELS, type SurfacedFoundationProposal } from '@/lib/foundation/proposals/types'

type ProposalsResponse = {
  pending: SurfacedFoundationProposal[]
  recent: SurfacedFoundationProposal[]
}

export default function FoundationProposalsPanel() {
  const [pending, setPending] = useState<SurfacedFoundationProposal[]>([])
  const [recent, setRecent] = useState<SurfacedFoundationProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/foundation/proposals')
      const data = (await res.json()) as ProposalsResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load proposals')
      setPending(data.pending ?? [])
      setRecent(data.recent ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals')
      setPending([])
      setRecent([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(proposalId: string, decision: 'approved' | 'rejected' | 'deferred') {
    setActingId(proposalId)
    setError('')
    try {
      const res = await fetch(`/api/foundation/proposals/${proposalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center gap-2 text-[12px] text-text-soft py-1">
          <Loader2 size={14} className="animate-spin" /> Checking for Foundation updates…
        </div>
      </div>
    )
  }

  if (error && pending.length === 0 && recent.length === 0) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
        <p className="text-[13px] text-amber-900">{error}</p>
      </div>
    )
  }

  if (pending.length === 0 && recent.length === 0) {
    return null
  }

  return (
    <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center">
          <Sparkles size={15} className="text-[#2563EB]" />
        </div>
        <div>
          <p className="text-[14px] font-[500] text-text">Foundation evolution</p>
          <p className="text-[11px] text-text-soft">
            Maya noticed a pattern worth your call — approve to add it as a layer on Phase 1
          </p>
        </div>
      </div>

      {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}

      {pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map(proposal => (
            <li
              key={proposal.id}
              className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">
                  {PROPOSAL_STATE_LABELS[proposal.state]}
                </span>
                <span className="text-[11px] text-text-soft">
                  {new Date(proposal.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <p className="text-[14px] font-[500] text-text mb-1">{proposal.proposalTitle}</p>
              <p className="text-[13px] leading-relaxed text-text-sec mb-3">{proposal.proposalBody}</p>

              {proposal.phase1Excerpt && (
                <p className="text-[12px] text-text-soft border-l-2 border-[#BFDBFE] pl-3 mb-3">
                  Phase 1 anchor: {proposal.phase1Excerpt}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actingId === proposal.id}
                  onClick={() => void decide(proposal.id, 'approved')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B82F6] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                >
                  {actingId === proposal.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Approve layer
                </button>
                <button
                  type="button"
                  disabled={actingId === proposal.id}
                  onClick={() => void decide(proposal.id, 'deferred')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-text-sec hover:bg-gray-50 disabled:opacity-60"
                >
                  <Clock size={13} />
                  Not now
                </button>
                <button
                  type="button"
                  disabled={actingId === proposal.id}
                  onClick={() => void decide(proposal.id, 'rejected')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-text-soft hover:bg-gray-50 disabled:opacity-60"
                >
                  <X size={13} />
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending.length === 0 && recent.length > 0 && (
        <p className="text-[13px] text-text-sec">
          No pending updates. Your recent decisions are saved — approved layers feed agent context.
        </p>
      )}
    </div>
  )
}
