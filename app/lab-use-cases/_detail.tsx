'use client';

import Link from 'next/link';
import { Metaballs } from '@paper-design/shaders-react';
import { cases, type UseCase } from './_data';

function readTime(uc: UseCase): number {
  const words = [uc.setup, uc.cost, uc.what, uc.where, ...uc.bullets.map((b) => b.body)].join(' ').split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
}

function MetaballsThumb({ seed = 1, height = '100%' }: { seed?: number; height?: string }) {
  const colorSets = [
    ['#F5349B', '#EE533B', '#FCA509', '#10B981', '#3286FE'],
    ['#3286FE', '#10B981', '#FCA509', '#F5349B', '#EE533B'],
    ['#10B981', '#3286FE', '#F5349B', '#FCA509', '#EE533B'],
    ['#FCA509', '#EE533B', '#3286FE', '#10B981', '#F5349B'],
  ];
  return (
    <Metaballs
      speed={0.5 + seed * 0.15}
      count={8}
      size={0.35 + seed * 0.02}
      scale={1}
      colors={colorSets[seed % colorSets.length]}
      colorBack="#00000000"
      style={{
        width: '100%',
        height,
        display: 'block',
        backgroundColor: '#F0F0F0',
        mixBlendMode: 'multiply',
      }}
    />
  );
}

export default function UseCaseDetail({ uc }: { uc: UseCase }) {
  const others = cases.filter((c) => c.slug !== uc.slug);
  const mins = readTime(uc);

  return (
    <div className="min-h-screen bg-white text-[#0d0d0d]">

      {/* Back link */}
      <div className="px-8 pt-6 pb-0">
        <Link
          href="/lab-use-cases"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#888] hover:text-[#0d0d0d] transition-colors"
        >
          ← Back to use cases
        </Link>
      </div>

      {/* Article header */}
      <header className="max-w-2xl mx-auto px-6 pt-10 pb-8 flex flex-col gap-5">
        {/* Meta */}
        <p className="text-[12px] text-[#aaa] flex items-center gap-2">
          <span style={{ color: uc.accent }} className="font-semibold">{uc.label}</span>
          <span>·</span>
          <span>Jun 5, 2026</span>
          <span>·</span>
          <span>{mins} min read</span>
        </p>

        {/* Headline */}
        <h1 className="text-[52px] leading-[1.08] font-bold tracking-tight">{uc.hero.headline}</h1>

        {/* Subhead */}
        <p className="text-[17px] text-[#555] leading-relaxed max-w-md">{uc.hero.subhead}</p>
      </header>

      {/* Featured image */}
      <div className="max-w-2xl mx-auto px-6 pb-12">
        <div className="w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <MetaballsThumb seed={cases.findIndex((c) => c.slug === uc.slug)} height="100%" />
        </div>
      </div>

      {/* Article body */}
      <article className="max-w-2xl mx-auto px-6 pb-20 flex flex-col gap-7 text-[16px] text-[#333] leading-[1.75]">
        {uc.setup.split('\n\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}

        <div className="flex flex-col gap-3 pt-2">
          <h2 className="text-[22px] font-bold text-[#0d0d0d]">{uc.costHeadline}</h2>
          {uc.cost.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <h2 className="text-[22px] font-bold text-[#0d0d0d]">{uc.whatHeadline}</h2>
          {uc.what.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="flex flex-col gap-4 pt-2">
          <h2 className="text-[22px] font-bold text-[#0d0d0d]">What that looks like in practice</h2>
          <ul className="flex flex-col gap-3.5">
            {uc.bullets.map((b) => (
              <li key={b.heading} className="flex gap-3 items-start">
                <span className="mt-[10px] w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: uc.accent }} />
                <span>
                  <strong className="text-[#0d0d0d]">{b.heading}</strong>{' '}{b.body}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <h2 className="text-[22px] font-bold text-[#0d0d0d]">Where Maya sits</h2>
          <p>{uc.where}</p>
        </div>

        <div className="pt-4">
          <a
            href="#"
            className="inline-block bg-[#3B82F6] text-white font-medium px-8 py-3 rounded-full text-[15px] hover:bg-blue-600 transition-colors"
          >
            Get access
          </a>
        </div>
      </article>

      {/* More use cases */}
      <section className="border-t border-gray-100 py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
          <h2 className="text-[22px] font-bold text-[#0d0d0d]">More use cases</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {others.map((c, i) => (
              <Link key={c.slug} href={`/lab-use-cases/${c.slug}`} className="group flex flex-col gap-3">
                {/* Thumbnail */}
                <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  <MetaballsThumb seed={cases.findIndex((x) => x.slug === c.slug)} height="100%" />
                </div>
                {/* Text */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.accent }} />
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-[#aaa]">{c.label}</span>
                  </div>
                  <p className="text-[16px] font-semibold text-[#0d0d0d] leading-snug group-hover:underline underline-offset-2">
                    {c.hero.headline}
                  </p>
                  <p className="text-[13px] text-[#666] leading-relaxed line-clamp-3">{c.hero.subhead}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Lab badge */}
      <div className="fixed bottom-4 right-4 z-50 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        🧪 /lab-use-cases — visual exploration
      </div>
    </div>
  );
}
