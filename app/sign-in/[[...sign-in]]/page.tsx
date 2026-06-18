import { SignIn } from '@clerk/nextjs'
import { Zap, BarChart2, Layers } from 'lucide-react'

const highlights = [
  { icon: Zap, label: 'AI Toolkit', desc: 'Generate copy, campaigns, and strategy in seconds.' },
  { icon: BarChart2, label: 'Live Analytics', desc: 'Google Analytics, Instagram, and Meta in one view.' },
  { icon: Layers, label: 'Managed Services', desc: 'Request work and track deliverables from your team.' },
]

export default function SignInPage() {
  return (
    <div className="min-h-screen flex bg-[#0d0d0d]">

      {/* Left — branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 border-r border-white/5">
        <a href="/" className="text-sm font-semibold tracking-widest uppercase text-[#2D3748]">
          Agent7even
        </a>

        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-[#2D3748] mb-5">
            Your marketing command center
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#f5f4f0] leading-snug mb-10">
            AI-powered marketing<br />for small businesses.
          </h1>

          <div className="space-y-6">
            {highlights.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-[#2D3748]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f5f4f0] mb-0.5">{label}</p>
                  <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/20">
          © {new Date().getFullYear()} Agent7even. All rights reserved.
        </p>
      </div>

      {/* Right — sign in */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#111111]">

        {/* Mobile logo */}
        <a href="/" className="lg:hidden text-sm font-semibold tracking-widest uppercase text-[#2D3748] mb-10">
          Agent7even
        </a>

        <SignIn
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: '#3B82F6',
              borderRadius: '0.75rem',
              fontSize: '0.9rem',
            },
            elements: {
              card: 'shadow-xl',
              formButtonPrimary: '!bg-[#2D3748] hover:!bg-[#1a2535] !text-white font-semibold',
              footerActionLink: '!text-[#2D3748] hover:!text-[#1a2535] font-semibold',
              identityPreviewEditButton: '!text-[#2D3748]',
            },
          }}
        />

        <p className="mt-5 text-xs text-white/30 text-center">
          By signing in you agree to our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-white/50 transition-colors">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-white/50 transition-colors">
            Privacy Policy
          </a>.
        </p>
      </div>
    </div>
  )
}
