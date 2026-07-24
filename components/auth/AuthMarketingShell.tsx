import './auth.css'
import { AUTH_HIGHLIGHTS, AUTH_VARIANTS, type AuthHighlight } from '@/lib/auth/authContent'
import type { ReactNode } from 'react'

type Variant = keyof typeof AUTH_VARIANTS

type Props = {
  variant: Variant
  children: ReactNode
  legalText: ReactNode
  highlights?: AuthHighlight[]
}

function AuthHeadline() {
  return (
    <h1 className="text-[2rem] font-semibold leading-[1.12] tracking-tight text-[#0E0E11] sm:text-4xl lg:text-[2.75rem] xl:text-[3.25rem]">
      <span className="text-[#F5349B]">AI-powered</span> marketing
      <br />
      for small business.
    </h1>
  )
}

function HighlightList({ items }: { items: AuthHighlight[] }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      {items.map(({ icon: Icon, label, desc, iconClass, bgClass }) => (
        <div key={label} className="flex items-start gap-4">
          <div
            className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${bgClass}`}
          >
            <Icon size={18} className={iconClass} />
          </div>
          <div>
            <p className="mb-1 text-[15px] font-semibold text-[#0E0E11] sm:text-base">{label}</p>
            <p className="text-[14px] leading-relaxed text-[#6C7079] sm:text-[15px] sm:leading-7">
              {desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function BrandPanel({
  eyebrow,
  highlights,
}: {
  eyebrow: string
  highlights: AuthHighlight[]
}) {
  return (
    <div className="auth-brand-panel flex w-full flex-col lg:min-h-screen lg:w-1/2 lg:border-r lg:border-[#E8E8EB]">
      <div className="flex flex-1 flex-col justify-between px-6 py-10 sm:px-10 sm:py-12 lg:px-16 lg:py-16 xl:px-24 xl:py-20">
        <a href="/" className="inline-block">
          <img
            src="/agent7even_logo.svg"
            alt="Agent7even"
            className="h-[38px] w-auto sm:h-[42px]"
          />
        </a>

        <div className="my-10 w-full max-w-xl lg:my-0 lg:max-w-[34rem] xl:max-w-[36rem]">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9AA0AA] sm:mb-5 sm:text-xs">
            {eyebrow}
          </p>
          <AuthHeadline />
          <div className="mt-8 sm:mt-10 lg:mt-12">
            <HighlightList items={highlights} />
          </div>
        </div>

        <p className="hidden text-xs text-[#9AA0AA] lg:block">
          © {new Date().getFullYear()} Agent7even. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function AuthMarketingShell({
  variant,
  children,
  legalText,
  highlights = AUTH_HIGHLIGHTS,
}: Props) {
  const { eyebrow } = AUTH_VARIANTS[variant]

  return (
    <div className="auth-page flex min-h-screen flex-col bg-white lg:flex-row">
      <BrandPanel eyebrow={eyebrow} highlights={highlights} />

      <div className="auth-form-panel flex min-h-screen w-full flex-col items-center justify-center border-t border-[#E8E8EB] px-6 py-12 lg:w-1/2 lg:border-t-0">
        <div className="w-full max-w-[420px] min-h-[320px]">{children}</div>

        <p className="mt-5 max-w-[420px] text-center text-xs leading-relaxed text-[#9AA0AA]">
          {legalText}
        </p>

        <p className="mt-6 text-center text-xs text-[#9AA0AA] lg:hidden">
          © {new Date().getFullYear()} Agent7even. All rights reserved.
        </p>
      </div>
    </div>
  )
}
