import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

export default async function CalendarPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="px-8 pt-8 pb-6 max-w-[1200px]">
      <CanvasContextDispatcher context="CONTENT CALENDAR PAGE
This feature is coming soon — the content calendar is not yet active.
When available, it will show a week-by-week view of all planned content across campaigns." />
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#3B82F6] mb-2">Content Calendar</p>
        <h1 className="text-2xl font-bold text-gray-900">Your content schedule</h1>
        <p className="text-gray-500 text-sm mt-1">Week-by-week view of all planned content across your campaigns.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">Content Calendar is coming soon</p>
        <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
          Your campaign tasks will appear here in a week-by-week view. Build a campaign with Maya to get started.
        </p>
      </div>
    </div>
  )
}
