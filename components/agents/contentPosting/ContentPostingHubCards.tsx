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
    iconBg: 'bg-brand-primary/10 text-brand-primary',
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
    iconBg: 'bg-[#FDEAF3] text-[#F5349B]',
    title: 'Video post',
    desc: 'Short-form vertical clip, sized per platform. Review it in Approvals.',
    meta: '6 formats · Reels, Shorts, Stories, TikTok',
    cta: 'Choose format',
    emblem: 'video' as const,
  },
  {
    id: 'weekly' as const,
    href: '/dashboard/agents/content-posting/weekly',
    icon: CalendarDays,
    cardClass: 'w',
    iconBg: 'bg-[#E7F7EE] text-[#16A34A]',
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
      <div className="w-[108px] rounded-[11px] border border-gray-200 bg-white p-[7px] shadow-[0_6px_16px_-10px_rgba(16,18,23,0.3)]">
        <div
          className="aspect-[4/5] rounded-[7px]"
          style={{ background: 'linear-gradient(155deg,#1B2C53 0%,#0C1730 100%)' }}
        />
        <div className="mt-1.5 h-1.5 w-[70%] rounded bg-[#E7EAEF]" />
        <div className="mt-1.5 h-1.5 w-[45%] rounded bg-[#E7EAEF]" />
      </div>
    )
  }
  if (type === 'video') {
    return (
      <div
        className="relative aspect-[9/16] w-[88px] overflow-hidden rounded-[13px] shadow-[0_8px_20px_-10px_rgba(16,18,23,0.4)]"
        style={{ background: 'linear-gradient(155deg,#21345e,#0C1730)' }}
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
    <div className="w-[158px] rounded-[11px] border border-gray-200 bg-white p-2.5 shadow-[0_6px_16px_-10px_rgba(16,18,23,0.3)]">
      <div className="mb-2 flex items-center justify-between">
        <b className="text-[10.5px] font-semibold text-[#363B44]">This week</b>
        <span className="rounded bg-[#E7F7EE] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-[#16A34A]">
          Planned
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['b', '', 'p', '', 'a', '', 'b', '', 'b', '', 'p', '', 'a', ''].map((c, i) => (
          <i
            key={i}
            className={`relative aspect-square rounded ${
              c === 'b'
                ? 'bg-brand-primary/10 after:absolute after:inset-0 after:m-auto after:block after:h-[5px] after:w-[5px] after:rounded-full after:bg-brand-primary'
                : c === 'p'
                  ? 'bg-[#FDE9F3] after:absolute after:inset-0 after:m-auto after:block after:h-[5px] after:w-[5px] after:rounded-full after:bg-[#F5349B]'
                  : c === 'a'
                    ? 'bg-[#FEF4E2] after:absolute after:inset-0 after:m-auto after:block after:h-[5px] after:w-[5px] after:rounded-full after:bg-[#F59E0B]'
                    : 'bg-[#F1F3F6]'
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
            className="group flex flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white text-left transition-all duration-200 hover:-translate-y-1 hover:border-[#E0E4EA] hover:shadow-[0_1px_2px_rgba(16,18,23,0.06),0_12px_28px_-14px_rgba(16,18,23,0.20)]"
          >
            <div className="flex h-[172px] items-center justify-center border-b border-[#F4F5F7] bg-gradient-to-b from-[#F8FAFD] to-[#F3F6FA]">
              <WorkflowEmblem type={workflow.emblem} />
            </div>

            <div className="flex flex-1 flex-col px-[19px] pb-[17px] pt-[18px]">
              <span
                className={`mb-3 inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] ${workflow.iconBg}`}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <p className="text-[17px] font-semibold tracking-tight text-text-primary">{workflow.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-normal text-text-sec">{workflow.desc}</p>
              <p className="mt-3 text-xs tabular-nums text-text-soft">{workflow.meta}</p>
            </div>

            <div className="mt-4 flex items-center border-t border-[#F4F5F7] px-[19px] py-3.5">
              <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-primary transition-colors group-hover:text-[#1D62D6]">
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
