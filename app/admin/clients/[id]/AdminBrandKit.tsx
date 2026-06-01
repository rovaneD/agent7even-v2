'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'

interface BrandDoc {
  id: string
  type: string
  title: string
  content: string
  version: number
  updated_at: string
}

interface BrandAnswers {
  answers: Record<string, unknown>
  completed: boolean
  updated_at: string
}

interface Props {
  documents: BrandDoc[]
  answers: BrandAnswers | null
}

const DOCUMENT_TYPES = [
  { type: 'voice', title: 'Brand Voice Statement', abbr: 'BV' },
  { type: 'story', title: 'Brand Story', abbr: 'BS' },
  { type: 'persona', title: 'Ideal Client Profile', abbr: 'IC' },
  { type: 'positioning', title: 'Brand Positioning Statement', abbr: 'BP' },
]

export default function AdminBrandKit({ documents, answers }: Props) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText size={20} className="text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          {answers?.completed
            ? 'Brand documents are being generated'
            : 'Client has not completed their Brand Kit yet'}
        </p>
        {answers && !answers.completed && (
          <p className="text-xs text-gray-400 mt-1">
            {Object.keys(answers.answers).length} of 24 questions answered
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {DOCUMENT_TYPES.map(docType => {
        const doc = documents.find(d => d.type === docType.type)
        if (!doc) return null
        const isExpanded = expandedDoc === doc.type

        return (
          <div key={doc.type} className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedDoc(isExpanded ? null : doc.type)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span style={{ background: '#E2E8F0', color: '#2D3748', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>{docType.abbr}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{doc.title}</p>
                <p className="text-xs text-gray-400">
                  Version {doc.version} · Updated {new Date(doc.updated_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
              {isExpanded
                ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />
              }
            </button>

            {isExpanded && (
              <div className="border-t border-gray-50 px-4 py-4 bg-gray-50">
                <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">
                  {doc.content}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
