'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronLeft, Check, Loader2, AlertCircle, Save } from 'lucide-react'
import { BRAND_CHAPTERS } from './questions'

interface Props {
  profileId: string
  savedAnswers: Record<string, unknown> | null
  onComplete: (answers: Record<string, unknown>) => void
  onBack: () => void
  generating: boolean
  error: string | null
}

export default function BrandFlow({
  savedAnswers,
  onComplete,
  onBack,
  generating,
  error,
}: Props) {
  const [chapterIndex, setChapterIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    savedAnswers ?? {}
  )
  const [saving, setSaving] = useState(false)
  const [showTyping, setShowTyping] = useState(true)
  const [visibleQuestions, setVisibleQuestions] = useState<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const chapter = BRAND_CHAPTERS[chapterIndex]
  const isLastChapter = chapterIndex === BRAND_CHAPTERS.length - 1
  const totalQuestions = BRAND_CHAPTERS.reduce((a, c) => a + c.questions.length, 0)
  const answeredSoFar = Object.keys(answers).length
  const progress = Math.round((answeredSoFar / totalQuestions) * 100)

  useEffect(() => {
    setShowTyping(true)
    setVisibleQuestions(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    chapter.questions.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisibleQuestions(v => v + 1)
        if (i === chapter.questions.length - 1) setShowTyping(false)
      }, i * 600))
    })
    return () => timers.forEach(clearTimeout)
  }, [chapterIndex, chapter.questions.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visibleQuestions])

  function setAnswer(id: string, value: unknown) {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  function toggleMultiselect(id: string, option: string) {
    const current = (answers[id] as string[]) ?? []
    const updated = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option]
    setAnswer(id, updated)
  }

  function chapterAnswered() {
    return chapter.questions.every(q => {
      const val = answers[q.id]
      if (!val) return false
      if (Array.isArray(val)) return val.length > 0
      return String(val).trim().length > 0
    })
  }

  async function saveProgress() {
    setSaving(true)
    try {
      await fetch('/api/brand/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, completed: false }),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleNext() {
    await saveProgress()
    if (isLastChapter) {
      await fetch('/api/brand/save-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, completed: true }),
      })
      onComplete(answers)
    } else {
      setChapterIndex(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="max-w-[1200px] px-8 pt-8 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Brand Kit
        </button>
        <button
          onClick={saveProgress}
          disabled={saving}
          className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Save size={13} />
          {saving ? 'Saving...' : 'Save progress'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-400">
            Chapter {chapterIndex + 1} of {BRAND_CHAPTERS.length}
          </span>
          <span className="text-xs font-medium text-gray-400">{progress}% complete</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#2D3748] rounded-full transition-all duration-500"
            style={{ width: `${((chapterIndex) / BRAND_CHAPTERS.length) * 100}%` }}
          />
        </div>
        {/* Chapter dots */}
        <div className="flex items-center gap-2 mt-3">
          {BRAND_CHAPTERS.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                i === chapterIndex ? 'text-[#64748B]' : i < chapterIndex ? 'text-gray-400' : 'text-gray-200'
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all ${
                i < chapterIndex
                  ? 'bg-[#2D3748] text-white'
                  : i === chapterIndex
                  ? 'bg-[#2D3748]/10 text-[#64748B] border border-[#3B82F6]/30'
                  : 'bg-gray-100 text-gray-300'
              }`}>
                {i < chapterIndex ? <Check size={10} /> : i + 1}
              </div>
              <span className="hidden sm:block">{c.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chapter header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#2D3748]">{chapterIndex + 1}</span>
          </div>
          <div>
            <h2 className="text-[26px] font-semibold text-[#2D3748]">{chapter.title}</h2>
            <p className="text-sm text-gray-400">{chapter.description}</p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {chapter.questions.slice(0, visibleQuestions).map((q) => (
          <div
            key={q.id}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            {/* Question bubble */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#64748B]">A7</span>
              </div>
              <div className="bg-gray-50 rounded-2xl rounded-tl-none px-5 py-4 flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-1">{q.question}</p>
                {q.subtext && (
                  <p className="text-xs text-gray-400 leading-relaxed">{q.subtext}</p>
                )}
              </div>
            </div>

            {/* Answer input */}
            <div className="ml-11">
              {q.type === 'textarea' && (
                <textarea
                  value={(answers[q.id] as string) ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                  rows={4}
                  className="w-full text-sm text-gray-800 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300 resize-none transition-colors"
                />
              )}

              {q.type === 'text' && (
                <input
                  type="text"
                  value={(answers[q.id] as string) ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                  className="w-full text-sm text-gray-800 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]/20 placeholder:text-gray-300 transition-colors"
                />
              )}

              {q.type === 'select' && (
                <div className="space-y-2">
                  {q.options?.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.id, opt)}
                      className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-all ${
                        answers[q.id] === opt
                          ? 'border-[#3B82F6] bg-[#2D3748]/5 text-[#64748B] font-medium'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'multiselect' && (
                <div className="flex flex-wrap gap-2">
                  {q.options?.map(opt => {
                    const selected = ((answers[q.id] as string[]) ?? []).includes(opt)
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleMultiselect(q.id, opt)}
                        className={`text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                          selected
                            ? 'border-[#3B82F6] bg-[#2D3748] text-white'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {selected && <Check size={10} className="inline mr-1" />}
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {showTyping && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2D3748] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#64748B]">A7</span>
            </div>
            <div className="bg-gray-50 rounded-2xl rounded-tl-none px-5 py-4">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-6">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      {!showTyping && (
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100">
          <button
            onClick={() => {
              if (chapterIndex > 0) {
                setChapterIndex(i => i - 1)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              } else {
                onBack()
              }
            }}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={16} />
            {chapterIndex === 0 ? 'Cancel' : 'Previous'}
          </button>

          <button
            onClick={handleNext}
            disabled={!chapterAnswered() || generating}
            className="flex items-center gap-2 bg-[#2D3748] text-white text-[15px] font-medium px-6 py-3 rounded-xl hover:bg-[#1E293B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating your brand documents...
              </>
            ) : isLastChapter ? (
              <>
                <span>Generate Brand Kit</span>
              </>
            ) : (
              <>
                Next chapter
                <ChevronRight size={15} />
              </>
            )}
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
