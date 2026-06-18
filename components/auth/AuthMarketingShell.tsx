import '@/app/lab5/styles.css'
import MarketingNav from '@/app/lab5/MarketingNav'
import type { ReactNode } from 'react'

type Highlight = { label: string; desc: string }

type Props = {
  eyebrow: string
  title: ReactNode
  lead: string
  note?: string
  highlights: Highlight[]
  children: ReactNode
  legalText: ReactNode
}

export default function AuthMarketingShell({
  eyebrow,
  title,
  lead,
  note,
  highlights,
  children,
  legalText,
}: Props) {
  return (
    <div className="lab5 min-h-screen flex flex-col bg-[var(--l5-bg)]">
      <MarketingNav />

      <main className="flex-1">
        <div className="wrap py-10 md:py-14 lg:py-16">
          <div className="mx-auto grid max-w-[1040px] items-start gap-10 lg:grid-cols-[1fr_420px] lg:gap-16">
            <div className="hidden lg:block pt-4">
              <span className="eyebrow">{eyebrow}</span>
              <h1 className="t-h2 mt-4">{title}</h1>
              <p className="t-lead mt-5 max-w-md">{lead}</p>
              {note ? (
                <p className="hero-note mt-4">{note}</p>
              ) : null}

              <ul className="mt-10 space-y-5">
                {highlights.map((item) => (
                  <li key={item.label} className="flex gap-4">
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--l5-brand)]" />
                    <div>
                      <p className="text-[15px] font-medium text-[var(--l5-ink)]">{item.label}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-[var(--l5-muted)]">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full max-w-[420px] justify-self-center lg:justify-self-end">
              <div className="mb-6 text-center lg:hidden">
                <img
                  src="/agent7even_logo.svg"
                  alt="Agent7even"
                  className="mx-auto h-9 w-auto"
                />
                <h1 className="mt-5 text-[28px] font-medium tracking-[-0.02em] text-[var(--l5-ink)]">
                  {title}
                </h1>
                <p className="mt-2 text-[15px] text-[var(--l5-muted)]">{lead}</p>
              </div>

              {children}

              <p className="mt-5 text-center text-[12px] leading-relaxed text-[var(--l5-faint)]">
                {legalText}
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--l5-line-2)] bg-white py-6">
        <div className="wrap flex flex-col items-center justify-between gap-3 text-[12px] text-[var(--l5-faint)] sm:flex-row">
          <p>© {new Date().getFullYear()} Agent7even. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-[var(--l5-ink-2)] transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-[var(--l5-ink-2)] transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
