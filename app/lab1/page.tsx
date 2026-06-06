'use client';

import { useEffect, useState } from 'react';
import { Metaballs } from '@paper-design/shaders-react';

export default function LabPage() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setDark(d => !d), 8000);
    return () => clearInterval(id);
  }, []);

  const t = 'transition-all duration-[3500ms] ease-in-out';

  return (
    <div
      className={`min-h-screen flex flex-col overflow-hidden ${t}`}
      style={{ backgroundColor: dark ? '#0d0d0d' : '#F9F9FA', color: dark ? '#ffffff' : '#0d0d0d' }}
    >
      {/* Nav */}
      <header className={`flex items-center justify-between px-8 py-4 relative z-10 ${t}`}>
        <span className="font-bold text-[15px] tracking-widest uppercase">
          AGENT<span className="text-[#F5349B]">7</span>EVEN
        </span>
        <nav className={`hidden md:flex items-center gap-6 text-sm ${t}`} style={{ color: dark ? 'rgba(255,255,255,0.6)' : '#444' }}>
          <a href="#" className={`${t} hover:opacity-100`}>How it works</a>
          <a href="#" className={`${t} hover:opacity-100`}>Services</a>
          <a href="#" className={`${t} hover:opacity-100`}>Pricing</a>
          <a href="#" className={`${t} hover:opacity-100`}>Blog</a>
          <a href="#" className={`${t} hover:opacity-100`}>Free SEO Tool</a>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <a href="#" className={`${t}`} style={{ color: dark ? 'rgba(255,255,255,0.6)' : '#444' }}>
            Sign in
          </a>
          <a href="#" className={`bg-[#3B82F6] text-white font-medium px-5 py-2 rounded-full ${t}`}>
            Sign up
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center relative">
        {/* Left copy */}
        <div className="relative z-10 pl-16 pr-8 max-w-[640px] flex flex-col gap-5">
          <h1 className={`text-[52px] leading-[1.12] font-bold tracking-tight ${t}`}>
            Meet <span className="text-[#F5349B]">Maya</span> — your AI marketing team that never clocks out.
          </h1>
          <p className={`text-[16px] leading-relaxed max-w-[420px] ${t}`} style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#555' }}>
            She plans, creates, and runs your campaigns while you run your business. No agency, no busywork, no missed momentum.
          </p>
          <div className="flex items-center gap-5 mt-1">
            <a href="#" className={`bg-[#3B82F6] text-white font-medium px-6 py-2.5 rounded-full text-sm ${t}`}>
              Get access
            </a>
            <a href="#" className={`text-sm ${t}`} style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#555' }}>
              See use cases
            </a>
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
              backgroundColor: dark ? '#0d0d0d' : '#F9F9FA',
              mixBlendMode: dark ? 'screen' : 'multiply',
              width: '100vw',
              height: '100vh',
              display: 'block',
              transition: 'background-color 3500ms ease-in-out',
            }}
          />
        </div>
      </main>

      {/* Lab badge */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        🧪 /lab — visual exploration only
      </div>
    </div>
  );
}
