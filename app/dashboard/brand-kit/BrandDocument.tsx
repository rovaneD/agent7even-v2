'use client'

import { useState } from 'react'
import { ChevronLeft, Save, RefreshCw, Check, History, Loader2 } from 'lucide-react'
import { DOCUMENT_TYPES } from './questions'

interface BrandDoc {
  id: string
  type: string
  title: string
  content: string
  version: number
  updated_at: string
}

interface Props {
  document: BrandDoc
  onBack: () => void
  onSaved: (doc: BrandDoc) => void
  onRegenerate: () => void
}

export default function BrandDocument({ document, onBack, onSaved, onRegenerate }: Props) {
  const [content, setContent] = useState(document.content)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const docType = DOCUMENT_TYPES.find(d => d.type === document.type)

  function handleChange(val: string) {
    setContent(val)
    setIsDirty(true)
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/brand/save-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: document.id, content }),
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      onSaved(data.document)
      setSaved(true)
      setIsDirty(false)
    } catch {
      console.error('Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Brand Kit
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={12} />
            Regenerate
          </button>

          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
              saved
                ? 'bg-emerald-50 text-emerald-700'
                : isDirty
                ? 'bg-[#2D3748] text-white hover:bg-[#1E293B]'
                : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <><Loader2 size={12} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check size={12} /> Saved</>
            ) : (
              <><Save size={12} /> Save changes</>
            )}
          </button>
        </div>
      </div>

      {/* Document header */}
      <div className="flex items-center gap-4 mb-6">
        <span style={{ background: '#E2E8F0', color: '#2D3748', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>{docType?.abbr ?? 'BK'}</span>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{document.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400">{docType?.description}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <History size={11} />
              Version {document.version}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              Updated {new Date(document.updated_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Editable document */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-50 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs text-gray-400 font-medium">{document.title}</span>
          {isDirty && <span className="text-xs text-[#64748B] font-medium ml-auto">Unsaved changes</span>}
        </div>

        <textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          className="w-full min-h-[600px] p-8 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none"
          style={{ fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: '1.8' }}
          spellCheck
        />
      </div>

      {/* Tip */}
      <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
        <span className="text-[#64748B] font-bold flex-shrink-0">→</span>
        <span>
          This document is yours to edit freely. Click anywhere in the text to make changes,
          then save. To start fresh with new answers, click Regenerate.
        </span>
      </div>
    </div>
  )
}
