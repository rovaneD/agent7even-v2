'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, Film, Image } from 'lucide-react'
import {
  contentPostingModeHref,
} from '@/lib/agents/contentPosting/platformFormats'

const WORKFLOWS = [
  {
    id: 'image' as const,
    href: contentPostingModeHref('image'),
    icon: Image,
    cardClass: 'i',
    iconBg: 'bg-brand-primary/15 text-[#7FB0FF]',
    title: 'Image post',
    desc: 'Generate or upload a still, and Maya writes the caption to match.',
    meta: '8 formats · Instagram, Facebook, X, LinkedIn',
    cta: 'Choose format',
    emblem: 'image' as const,
  },
  {
    id: 'video' as const,
    href: contentPostingModeHref('video'),
    icon: Film,
    cardClass: 'v',
    iconBg: 'bg-[#F5349B]/15 text-[#FF7DBE]',
    title: 'Video post',
    desc: 'Pick a video type, see an example, and Maya plans it before anything is made.',
    meta: '6 video types · Reels, Shorts, Stories, TikTok',
    cta: 'Choose format',
    emblem: 'video' as const,
  },
  {
    id: 'weekly' as const,
    href: '/dashboard/agents/content-posting/weekly',
    icon: CalendarDays,
    cardClass: 'w',
    iconBg: 'bg-[#16A34A]/15 text-[#5BD68B]',
    title: 'Weekly plan',
    desc: 'A full 7-day content plan across your channels, drafted in your voice.',
    meta: '7-day plan · every connected channel',
    cta: 'Set up plan',
    emblem: 'weekly' as const,
  },
]

function WorkflowEmblem({ type }: { type: 'image' | 'video' | 'weekly' }) {
  if (type === 'image') {
    return (
      <div className="w-[108px] rounded-[11px] border border-white/10 bg-[#202227] p-[7px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)]">
        <div
          className="aspect-[4/5] rounded-[7px]"
          style={{ background: 'linear-gradient(155deg,#2F4A86 0%,#14244A 100%)' }}
        />
        <div className="mt-1.5 h-1.5 w-[70%] rounded bg-white/[0.12]" />
        <div className="mt-1.5 h-1.5 w-[45%] rounded bg-white/[0.12]" />
      </div>
    )
  }
  if (type === 'video') {
    return (
      <div
        className="relative aspect-[9/16] w-[88px] overflow-hidden rounded-[13px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
        style={{ background: 'linear-gradient(155deg,#3a2a52,#140f22)' }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-[34px] w-[34px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90">
          <div className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-[#0E1116]" />
        </div>
        <div className="absolute bottom-3 right-[7px] flex flex-col gap-[7px]">
          <i className="block h-1.5 w-1.5 rounded-full bg-white/85" />
          <i className="block h-1.5 w-1.5 rounded-full bg-white/85" />
          <i className="block h-1.5 w-1.5 rounded-full bg-white/85" />
        </div>
      </div>
    )
  }
  return (
    <div className="w-[158px] rounded-[11px] border border-white/10 bg-[#202227] p-2.5 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.7)]">
      <div className="mb-2 flex items-center justify-between">
        <b className="text-[10.5px] font-semibold text-[#E6E7EA]">This week</b>
        <span className="rounded bg-[#16A34A]/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[#5BD68B]">
          Planned
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['b', '', 'p', '', 'a', '', 'b', '', 'b', '', 'p', '', 'a', ''].map((c, i) => (
          <i
            key={i}
            className={`relative aspect-square rounded ${
              c === 'b'
                ? 'bg-brand-primary/20 after:absolute after:inset-0 after:m-auto after:block after:h-[5px] after:w-[5px] after:rounded-full after:bg-brand-primary'
                : c === 'p'
                  ? 'bg-[#F5349B]/20 after:absolute after:inset-0 after:m-auto after:block after:h-[5px] after:w-[5px] after:rounded-full after:bg-[#F5349B]'
                  : c === 'a'
                    ? 'bg-[#F59E0B]/20 after:absolute after:inset-0 after:m-auto after:block after:h-[5px] after:w-[5px] after:rounded-full after:bg-[#F59E0B]'
                    : 'bg-white/[0.06]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function ContentPostingHubCards() {
  return (
    <div className="mt-8 grid gap-[18px] sm:grid-cols-3">
      {WORKFLOWS.map(workflow => {
        const Icon = workflow.icon
        return (
          <Link
            key={workflow.id}
            href={workflow.href}
            className="group flex flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#17181B] text-left transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]"
          >
            <div className="flex h-[172px] items-center justify-center border-b border-white/[0.06] bg-[radial-gradient(120%_90%_at_50%_0%,#24262C_0%,#141518_100%)]">
              <WorkflowEmblem type={workflow.emblem} />
            </div>

            <div className="flex flex-1 flex-col px-[19px] pb-[17px] pt-[18px]">
              <span
                className={`mb-3 inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] ${workflow.iconBg}`}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <p className="text-[17px] font-semibold tracking-tight text-white">{workflow.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-normal text-[#A4A7AF]">{workflow.desc}</p>
              <p className="mt-3 text-xs tabular-nums text-[#6B6E76]">{workflow.meta}</p>
            </div>

            <div className="mt-4 flex items-center border-t border-white/[0.06] px-[19px] py-3.5">
              <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#7FB0FF] transition-colors group-hover:text-white">
                {workflow.cta}
                <ArrowRight
                  size={15}
                  strokeWidth={2.2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
