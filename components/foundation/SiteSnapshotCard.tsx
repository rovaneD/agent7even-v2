'use client'

import { useCallback, useEffect, useState } from 'react'
import { Globe, Loader2, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react'
import type { SiteSnapshot } from '@/lib/foundation/siteSnapshot'

type Props = {
  websiteUrl: string | null
}

export default function SiteSnapshotCard({ websiteUrl }: Props) {
  const [snapshot, setSnapshot] = useState<SiteSnapshot | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/foundation/site-snapshot')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load snapshot')
      setSnapshot(data.snapshot ?? null)
      setEnabled(Boolean(data.enabled))
      setGeneratedAt(data.generatedAt ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function generate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/foundation/site-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: websiteUrl ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setSnapshot(data.snapshot)
      setEnabled(true)
      setGeneratedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function toggleEnabled(next: boolean) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/foundation/site-snapshot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setEnabled(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (!websiteUrl?.trim()) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
        <p className="text-[13px] text-text-sec">
          Add your website URL in <strong>Your Business</strong> to generate a strategic snapshot from your site (like a brand profile deck).
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center">
            <Globe size={15} className="text-[#3B82F6]" />
          </div>
          <div>
            <p className="text-[14px] font-[500] text-text">From your website</p>
            <p className="text-[11px] text-text-soft truncate max-w-[280px] sm:max-w-md">{websiteUrl}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating || loading}
          className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {snapshot ? 'Refresh' : 'Generate'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[12px] text-text-soft py-2">
          <Loader2 size={14} className="animate-spin" /> Loading snapshot…
        </div>
      )}

      {error && (
        <p className="text-[12px] text-red-600 mb-2">{error}</p>
      )}

      {!loading && !snapshot && !generating && (
        <p className="text-[13px] text-text-sec leading-relaxed">
          Generate a Blaze-style strategic profile from your website — tiered positioning, competitors, segments, and advantages. Review it here; agents use it only when enabled (Phase 1 stays guarded).
        </p>
      )}

      {snapshot && (
        <>
          <div className="space-y-3 text-[13px] text-text-sec leading-relaxed border-t border-gray-100 pt-3 mt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-1">Overview</p>
              <p>{snapshot.businessOverview}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-1">Positioning</p>
              <p><span className="font-medium text-text">Primary:</span> {snapshot.marketPositioning.primary}</p>
              {snapshot.marketPositioning.secondary && (
                <p><span className="font-medium text-text">Secondary:</span> {snapshot.marketPositioning.secondary}</p>
              )}
              {snapshot.marketPositioning.tertiary && (
                <p><span className="font-medium text-text">Tertiary:</span> {snapshot.marketPositioning.tertiary}</p>
              )}
            </div>
            {(snapshot.competitors.local?.length || snapshot.competitors.international?.length) ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-1">Competitors</p>
                {snapshot.competitors.local?.length ? (
                  <p><span className="font-medium text-text">Local:</span> {snapshot.competitors.local.join(', ')}</p>
                ) : null}
                {snapshot.competitors.international?.length ? (
                  <p><span className="font-medium text-text">International:</span> {snapshot.competitors.international.join(', ')}</p>
                ) : null}
              </div>
            ) : null}
            {snapshot.competitiveAdvantages.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-1">Advantages</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {snapshot.competitiveAdvantages.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {snapshot.customerSegments.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-1">Customer segments</p>
                <ul className="space-y-1.5">
                  {snapshot.customerSegments.map(seg => (
                    <li key={seg.label}>
                      <span className="font-medium text-text">{seg.label}</span>
                      {seg.shareHint ? ` (${seg.shareHint})` : ''}: {seg.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-text-soft">
              {generatedAt
                ? `Generated ${new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Generated snapshot'}
              {' · '}Agents {enabled ? 'read this' : 'ignore this until enabled'}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void toggleEnabled(!enabled)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#3B82F6]"
            >
              {enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} className="text-text-soft" />}
              {enabled ? 'In agent context' : 'Enable for agents'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
