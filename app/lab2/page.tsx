'use client';

import Link from 'next/link';
import { Metaballs } from '@paper-design/shaders-react';

export default function Lab2Page() {
  return (
    <div className="min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#F9F9FA', color: '#0d0d0d' }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 relative z-10">
        <span className="font-bold text-[15px] tracking-widest uppercase">
          AGENT<span className="text-[#F5349B]">7</span>EVEN
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#444]">
          <a href="#" className="hover:text-black transition-colors">How it works</a>
          <a href="#" className="hover:text-black transition-colors">Services</a>
          <a href="#" className="hover:text-black transition-colors">Pricing</a>
          <a href="#" className="hover:text-black transition-colors">Blog</a>
          <a href="#" className="hover:text-black transition-colors">Free SEO Tool</a>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <a href="#" className="text-[#444] hover:text-black transition-colors">Sign in</a>
          <a href="#" className="bg-[#3B82F6] text-white font-medium px-5 py-2 rounded-full hover:bg-blue-600 transition-colors">
            Sign up
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center relative">
        {/* Left copy */}
        <div className="relative z-10 pl-16 pr-8 max-w-[640px] flex flex-col gap-5">
          <h1 className="text-[52px] leading-[1.12] font-bold tracking-tight">
            Meet <span className="text-[#F5349B]">Maya</span> — your AI marketing team that never clocks out.
          </h1>
          <p className="text-[16px] text-[#555] leading-relaxed max-w-[420px]">
            She plans, creates, and runs your campaigns while you run your business.
          </p>
          <p className="text-[13px] font-semibold tracking-wide text-[#0d0d0d] uppercase">
            No agency. No busywork. No missed momentum.
          </p>
          <div className="flex items-center gap-5 mt-1">
            <a href="#" className="bg-[#3B82F6] text-white font-medium px-6 py-2.5 rounded-full text-sm hover:bg-blue-600 transition-colors">
              Get access
            </a>
            <Link href="/lab-use-cases" className="text-sm text-[#555] hover:text-black transition-colors">
              See use cases
            </Link>
          </div>
        </div>

        {/* Metaballs — full viewport background */}
        <div className="fixed inset-0 pointer-events-none">
          <Metaballs
            speed={1}
            count={10}
            size={0.36}
            scale={1}
            colors={['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE']}
            colorBack="#00000000"
            style={{
              backgroundColor: '#F9F9FA',
              mixBlendMode: 'multiply',
              width: '100vw',
              height: '100vh',
              display: 'block',
            }}
          />
        </div>
      </main>

      {/* Lab badge */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        🧪 /lab2 — light mode
      </div>
    </div>
  );
}
