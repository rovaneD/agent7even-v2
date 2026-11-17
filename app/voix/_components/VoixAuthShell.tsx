import type { ReactNode } from 'react'
import { voixSans, voixSerif } from './voixFonts'

export default function VoixAuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className={`${voixSerif.variable} ${voixSans.variable} min-h-screen bg-[#F6F7F9] text-[#1B2236]`}
      style={{ fontFamily: 'var(--voix-sans), system-ui, sans-serif' }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-12">
        <a href="/voix" className="mb-6 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="inline-block h-6 w-6 rounded-full bg-gradient-to-br from-[#F7B3CF] to-[#3355D6]" />
          Voix <span className="font-normal text-[#5B6070]">by Agent7even</span>
        </a>
        <h1
          className="mb-6 text-center text-[34px] leading-tight"
          style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}
        >
          {title}
        </h1>
        {children}
        <p className="mt-8 text-center text-xs text-[#5B6070]">
          By continuing you agree to our{' '}
          <a href="/terms" className="underline underline-offset-2">Terms</a> and{' '}
          <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
