'use client'

import { Sparkles } from 'lucide-react'

export default function CalendarMayaButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent('maya:open-task', {
          detail: {
            task: 'Help me turn this content calendar into schedule-ready posts, captions, emails, and next actions for this week.',
          },
        }))
      }}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#2D3748] hover:border-gray-300 transition-colors"
    >
      <Sparkles size={14} />
      Ask Maya to plan this week
    </button>
  )
}
