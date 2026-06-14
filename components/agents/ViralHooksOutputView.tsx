'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  parseViralHooksMarkdown,
  viralHookCopyText,
  type ParsedHookFamily,
  type ParsedViralHook,
} from '@/lib/services/viralHooksParse'
import { AgentOutputCopyButton } from '@/components/agents/EmailSequenceOutputView'

function markdownComponents() {
  return {
    h1: (props: React.ComponentProps<'h1'>) => (
      <h1 className="mb-3 text-[18px] font-semibold leading-snug text-text" {...props} />
    ),
    h2: (props: React.ComponentProps<'h2'>) => (
      <h2 className="mb-2 mt-4 text-[15px] font-semibold text-text" {...props} />
    ),
    h3: (props: React.ComponentProps<'h3'>) => (
      <h3 className="mb-2 mt-3 text-[14px] font-semibold text-text" {...props} />
    ),
    p: (props: React.ComponentProps<'p'>) => (
      <p className="mb-3 text-[13px] leading-relaxed text-text-sec last:mb-0" {...props} />
    ),
    ul: (props: React.ComponentProps<'ul'>) => (
      <ul className="mb-3 list-disc space-y-1 pl-5 text-[13px] text-text-sec" {...props} />
    ),
    ol: (props: React.ComponentProps<'ol'>) => (
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13px] text-text-sec" {...props} />
    ),
    li: (props: React.ComponentProps<'li'>) => <li className="leading-relaxed" {...props} />,
    strong: (props: React.ComponentProps<'strong'>) => (
      <strong className="font-semibold text-text" {...props} />
    ),
  }
}

function FormatBadge({ format }: { format?: string }) {
  if (!format?.trim()) return null
  const short = format.split('(')[0]?.trim() ?? format.trim()
  return (
    <span className="inline-flex max-w-full items-center rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
      {short}
    </span>
  )
}

function HookCard({ hook }: { hook: ParsedViralHook }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
            {hook.label}
          </p>
          <p className="text-[15px] font-semibold leading-snug text-text">
            &ldquo;{hook.text}&rdquo;
          </p>
        </div>
        <AgentOutputCopyButton
          text={viralHookCopyText(hook)}
          label="Copy hook"
          iconOnly
          title="Copy hook"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FormatBadge format={hook.format} />
      </div>
      {hook.rationale && (
        <p className="mt-3 text-[13px] leading-relaxed text-text-sec">
          <span className="font-semibold text-text">Why it works: </span>
          {hook.rationale}
        </p>
      )}
    </div>
  )
}

function HookFamilyCard({ family }: { family: ParsedHookFamily }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
          {family.hooks.length} hooks
        </p>
        <h3 className="text-[16px] font-semibold leading-snug text-text">{family.title}</h3>
        {family.blurb && (
          <div className="mt-3 text-[13px] leading-relaxed text-text-sec">
            <ReactMarkdown components={markdownComponents()}>{family.blurb}</ReactMarkdown>
          </div>
        )}
      </div>
      <div className="grid gap-3 p-5">
        {family.hooks.map(hook => (
          <HookCard key={`${family.title}-${hook.label}`} hook={hook} />
        ))}
      </div>
    </article>
  )
}

export default function ViralHooksOutputView({
  content,
  showGuide = true,
}: {
  content: string
  showGuide?: boolean
}) {
  const parsed = useMemo(() => parseViralHooksMarkdown(content), [content])

  if (!parsed) {
    return (
      <div className="grid gap-3">
        <AgentOutputCopyButton text={content} label="Copy all hooks" />
        <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4">
          <ReactMarkdown components={markdownComponents()}>{content}</ReactMarkdown>
        </div>
      </div>
    )
  }

  const totalHooks = parsed.families.reduce((sum, family) => sum + family.hooks.length, 0)

  return (
    <div className="grid gap-5">
      {showGuide && (
        <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5">
          <p className="mb-1 text-[12px] font-semibold text-[#1E40AF]">
            Use these as scroll-stopping openers
          </p>
          <p className="text-[12.5px] leading-relaxed text-text-sec">
            Pick one hook per post, film or write to the suggested format, and copy the line straight
            into your Reel, TikTok, carousel, or email opener.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AgentOutputCopyButton text={content} label="Copy full output" />
        <span className="text-[12px] text-text-soft">
          {totalHooks} hooks across {parsed.families.length} families
        </span>
      </div>

      {parsed.intro && (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
            How to use these hooks
          </p>
          <ReactMarkdown components={markdownComponents()}>{parsed.intro}</ReactMarkdown>
        </div>
      )}

      {parsed.families.map(family => (
        <HookFamilyCard key={family.title} family={family} />
      ))}

      {parsed.footer && (
        <div className="rounded-2xl border border-gray-100 bg-[#F8FAFC] px-5 py-4">
          <ReactMarkdown components={markdownComponents()}>{parsed.footer}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
