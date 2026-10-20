import type { ReactNode } from 'react'

/**
 * The Image and Weekly setup forms are still the light design. Inside the dark Content Posting
 * shell they sit on one light card until they move to the gallery + panel pattern (decision D3).
 */
export default function ContentPostingLightPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-[22px] bg-white px-5 py-6 text-text-primary shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] sm:px-8 sm:py-8">
      {children}
    </div>
  )
}
