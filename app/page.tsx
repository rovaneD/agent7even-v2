import Link from 'next/link'
import { Show } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="font-bold text-base tracking-wide">
          AGENT<span className="text-[#64748B]">7</span>EVEN
        </span>
        <div className="flex items-center gap-4">
          <Show when="signed-out">
            <Link href="/sign-in" className="text-sm text-white/60 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="bg-[#2D3748] text-white text-[15px] font-medium px-5 py-2 rounded-lg hover:bg-[#1E293B] transition-colors">
              Sign up
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="text-sm text-white/70 hover:text-white transition-colors mr-2"
            >
              Dashboard
            </Link>
            <UserButton />
          </Show>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#64748B] mb-4">
          Your marketing command center
        </p>
        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 max-w-3xl">
          Everything your business needs to grow — in one place
        </h1>
        <p className="text-base text-white/50 max-w-lg mb-10 font-light leading-relaxed">
          AI tools, content systems, analytics, and a team working on your marketing — all inside one dashboard built for small businesses.
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Show when="signed-out">
            <Link href="/sign-up" className="bg-[#2D3748] text-white font-medium px-8 py-3 rounded-xl hover:bg-[#1E293B] transition-colors">
              Start free →
            </Link>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="bg-[#2D3748] text-white font-medium px-8 py-3 rounded-xl hover:bg-[#1E293B] transition-colors"
            >
              Go to dashboard →
            </Link>
          </Show>
          <a
            href="https://agent7even.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            Learn more about Agent7even
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <span>© {new Date().getFullYear()} Agent7even. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <span className="text-white/20">·</span>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
