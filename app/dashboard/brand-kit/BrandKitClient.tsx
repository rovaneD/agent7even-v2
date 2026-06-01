'use client'

import { useState, useEffect } from 'react'
import { Sparkles, FileText, RefreshCw, ChevronRight } from 'lucide-react'
import BrandFlow from './BrandFlow'
import BrandDocument from './BrandDocument'
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
  profileId: string
  companyName: string
  savedAnswers: Record<string, unknown> | null
  answersComplete: boolean
  documents: BrandDoc[]
}

export default function BrandKitClient({
  profileId,
  companyName,
  savedAnswers,
  answersComplete,
  documents: initialDocuments,
}: Props) {
  const [view, setView] = useState<'home' | 'flow' | 'document'>(
    answersComplete && initialDocuments.length > 0 ? 'home' :
    savedAnswers ? 'flow' : 'home'
  )
  const [documents, setDocuments] = useState<BrandDoc[]>(initialDocuments)
  const [activeDoc, setActiveDoc] = useState<BrandDoc | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  useEffect(() => {
    const docLines = initialDocuments.length
      ? initialDocuments.map(d => `- ${d.title} (type: ${d.type}, version: ${d.version})`).join('\n')
      : '- No brand documents generated yet'
    const context = `BRAND KIT PAGE
Company: ${companyName}
Brand questionnaire complete: ${answersComplete ? 'Yes' : 'No'}
Documents generated (${initialDocuments.length}):
${docLines}
${!answersComplete ? 'User needs to complete the brand questionnaire to generate their brand documents.' : 'User can view and edit their brand documents.'}
${generating ? 'Brand documents are currently being generated.' : ''}`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasDocuments = documents.length > 0

  async function handleFlowComplete(answers: Record<string, unknown>) {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/brand/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setDocuments(data.documents)
      setView('home')
    } catch {
      setGenerateError('Something went wrong generating your brand documents. Please try again.')
      setView('flow')
    } finally {
      setGenerating(false)
    }
  }

  function openDocument(doc: BrandDoc) {
    setActiveDoc(doc)
    setView('document')
  }

  function handleDocumentSaved(updated: BrandDoc) {
    setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))
    setActiveDoc(updated)
  }

  // ── Flow view ─────────────────────────────────────────────────────────────
  if (view === 'flow') {
    return (
      <BrandFlow
        profileId={profileId}
        savedAnswers={savedAnswers}
        onComplete={handleFlowComplete}
        onBack={() => setView('home')}
        generating={generating}
        error={generateError}
      />
    )
  }

  // ── Document view ─────────────────────────────────────────────────────────
  if (view === 'document' && activeDoc) {
    return (
      <BrandDocument
        document={activeDoc}
        onBack={() => setView('home')}
        onSaved={handleDocumentSaved}
        onRegenerate={() => setView('flow')}
      />
    )
  }

  // ── Home view ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Brand Kit</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {companyName ? `${companyName} — ` : ''}Your brand foundation documents
          </p>
        </div>
        {hasDocuments && (
          <button
            onClick={() => setView('flow')}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors"
          >
            <RefreshCw size={14} />
            Update answers
          </button>
        )}
      </div>

      {/* Empty state */}
      {!hasDocuments && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#2D3748]/10 flex items-center justify-center mx-auto mb-5">
            <Sparkles size={28} className="text-[#9BA1AE]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Build your brand foundation
          </h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
            Answer a series of guided questions about your business and brand.
            Claude will generate four professional brand documents that become
            the foundation for all your marketing.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 max-w-2xl mx-auto">
            {DOCUMENT_TYPES.map(doc => (
              <div key={doc.type} className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-2 mx-auto">
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#2D3748', letterSpacing: '0.04em' }}>{doc.abbr}</span>
                </div>
                <p className="text-xs font-semibold text-gray-700">{doc.title}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setView('flow')}
            className="inline-flex items-center gap-2 bg-[#2D3748] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#1a2535] transition-colors"
          >
            <Sparkles size={15} />
            Start brand build
            <ChevronRight size={15} />
          </button>

          <p className="text-xs text-gray-400 mt-4">
            Takes about 15-20 minutes. You can save and continue later.
          </p>
        </div>
      )}

      {/* Documents grid */}
      {hasDocuments && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DOCUMENT_TYPES.map(docType => {
              const doc = documents.find(d => d.type === docType.type)
              return (
                <div
                  key={docType.type}
                  onClick={() => doc && openDocument(doc)}
                  className={`bg-white rounded-2xl border p-6 transition-all ${
                    doc
                      ? 'border-gray-100 hover:border-[#3B82F6]/30 hover:shadow-sm cursor-pointer'
                      : 'border-dashed border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span style={{ background: '#E2E8F0', color: '#2D3748', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>{docType.abbr}</span>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{docType.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{docType.description}</p>
                      </div>
                    </div>
                    {doc && <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />}
                  </div>

                  {doc ? (
                    <>
                      <div className="bg-gray-50 rounded-xl p-4 mb-3">
                        <p className="text-xs text-gray-500 line-clamp-4 leading-relaxed">
                          {doc.content.slice(0, 280)}...
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          Version {doc.version} · Updated {new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-xs font-medium text-[#9BA1AE]">Open & edit →</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <FileText size={13} />
                      Not yet generated
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Tips */}
          <div className="bg-[#2D3748]/5 border border-[#3B82F6]/10 rounded-2xl p-5">
            <p className="text-xs font-semibold text-[#9BA1AE] uppercase tracking-wide mb-2">How to use your Brand Kit</p>
            <ul className="space-y-1.5">
              {[
                'Share your Brand Voice Statement with anyone creating content for your business',
                'Use your Brand Story on your About page, in pitch decks, and on social media',
                'Reference your Ideal Client Profile before writing any marketing copy',
                'Use your Positioning Statement as the foundation for ads and landing pages',
              ].map(tip => (
                <li key={tip} className="flex items-start gap-2 text-xs text-gray-600">
                  <span className="text-[#9BA1AE] mt-0.5 flex-shrink-0">→</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
