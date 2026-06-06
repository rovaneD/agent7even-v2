'use client';

import { Metaballs } from '@paper-design/shaders-react';
import Link from 'next/link';

const cases = [
  {
    slug: 'ecommerce',
    label: 'E-commerce brands',
    accent: '#EE533B',
    enemy: 'The brand goes quiet between launches.',
    tagline: 'Tell Maya about the drop. Get the launch sequence back — teasers, emails, posts — in your voice, ready to approve.',
    bullets: [
      "A drop becomes a campaign in an afternoon.",
      "You're never undercut blind.",
      "The list stays warm.",
      "One voice, every channel.",
    ],
  },
  {
    slug: 'local-service',
    label: 'Local service businesses',
    accent: '#10B981',
    enemy: "The competitor across town isn't better. They're just more present.",
    tagline: 'Tell Maya to fill next week. Get the offer and the posts to push it — in your voice, ready to approve.',
    bullets: [
      "A slow week becomes a promotion overnight.",
      "You're never the last to know.",
      "No review goes unanswered.",
      "One voice, everywhere you show up.",
    ],
  },
  {
    slug: 'coaches-creators',
    label: 'Coaches, creators & solo founders',
    accent: '#F5349B',
    enemy: "You can't scale yourself. That's the real ceiling.",
    tagline: 'Tell Maya about the offer. Get the full launch sequence in your voice — review, approve, ship.',
    bullets: [
      "A launch runs itself.",
      "You're never late to the conversation.",
      "The momentum doesn't leak.",
      "It still sounds like you.",
    ],
  },
  {
    slug: 'agencies',
    label: 'Agencies',
    accent: '#3286FE',
    enemy: 'Your best people get pulled out of work that matters to do work that just has to get done.',
    tagline: 'Brief Maya on a client. Your team reviews and refines instead of building from zero.',
    bullets: [
      "Campaigns drafted per account, in each client's voice.",
      "Competitive intel without the manual research.",
      "The routine output runs itself.",
      "Voice held per client, automatically.",
    ],
  },
];

export default function LabUseCasesPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F9F9FA', color: '#0d0d0d' }}>
      {/* Metaballs background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Metaballs
          speed={0.6}
          count={8}
          size={0.3}
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

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4 relative z-10">
        <Link href="/lab2" className="font-bold text-[15px] tracking-widest uppercase">
          AGENT<span className="text-[#F5349B]">7</span>EVEN
        </Link>
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
      <section className="relative z-10 pt-20 pb-16 px-16 max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#888] mb-4">Use cases</p>
        <h1 className="text-[48px] leading-[1.1] font-bold tracking-tight mb-5">
          <span className="text-[#F5349B]">Maya</span> works for your world,<br />whatever that looks like.
        </h1>
        <p className="text-[16px] text-[#555] leading-relaxed max-w-[480px]">
          Different business, same problem — the marketing never gets done. Here's how Maya solves it for each one.
        </p>
      </section>

      {/* Cards grid */}
      <section className="relative z-10 px-16 pb-24 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl">
        {cases.map((c) => (
          <Link
            key={c.slug}
            href={`/lab-use-cases/${c.slug}`}
            className="group bg-white/70 backdrop-blur-sm border border-white/80 rounded-2xl p-8 flex flex-col gap-4 hover:bg-white/90 transition-all duration-300 hover:shadow-md"
          >
            {/* Accent dot + label */}
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.accent }} />
              <span className="text-xs font-semibold tracking-widest uppercase text-[#888]">{c.label}</span>
            </div>

            {/* Enemy line */}
            <p className="text-[15px] font-semibold text-[#0d0d0d] leading-snug">{c.enemy}</p>

            {/* Tagline */}
            <p className="text-[14px] text-[#555] leading-relaxed">{c.tagline}</p>

            {/* Bullets */}
            <ul className="flex flex-col gap-1.5 mt-1">
              {c.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[13px] text-[#444]">
                  <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.accent }} />
                  {b}
                </li>
              ))}
            </ul>

            {/* CTA arrow */}
            <div className="mt-auto pt-3 flex items-center gap-1 text-[13px] font-medium transition-colors duration-200" style={{ color: c.accent }}>
              Read more
              <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
            </div>
          </Link>
        ))}
      </section>

      {/* Lab badge */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        🧪 /lab-use-cases — visual exploration
      </div>
    </div>
  );
}
