'use client'

/** Compact content calendar preview — matches lab5 marketing mockup (`public/lab5/mockups.js` calendar). */
export default function MarketingCalendarPreview() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-3 py-2.5">
        <div>
          <p className="text-[11px] font-semibold text-text-primary">Content calendar</p>
          <p className="text-[9px] text-text-soft">Your business · this week</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
          6 scheduled
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[10px] border border-blue-100 bg-[#F4F8FF] px-2.5 py-2">
            <p className="font-mono text-[9px] font-medium uppercase tracking-wide text-[#3286FE]">Mon</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[#3A3D44]">Instagram — product tip</p>
          </div>
          <div className="rounded-[10px] border border-emerald-100 bg-[#E9FBF3] px-2.5 py-2">
            <p className="font-mono text-[9px] font-medium uppercase tracking-wide text-emerald-600">Wed</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[#3A3D44]">Email — nurture touch</p>
          </div>
          <div className="rounded-[10px] border border-amber-100 bg-[#FFF3E2] px-2.5 py-2">
            <p className="font-mono text-[9px] font-medium uppercase tracking-wide text-[#B26B00]">Fri</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[#3A3D44]">Story — behind the scenes</p>
          </div>
          <div className="flex items-center justify-center rounded-[10px] border border-gray-200 bg-[#F4F4F6] px-2 py-2 text-center text-[10px] text-text-soft">
            + 3 more queued
          </div>
        </div>

        <div className="rounded-[10px] border border-[#FBD9EC] bg-[#FFF5FA] px-2.5 py-2">
          <p className="font-mono text-[8px] font-medium uppercase tracking-wider text-[#F5349B]">
            Maya suggestion
          </p>
          <p className="mt-1 text-[10px] leading-snug text-[#3A3D44]">
            Tuesday looks quiet. Want a behind-the-scenes post in your voice?
          </p>
        </div>
      </div>
    </div>
  )
}
