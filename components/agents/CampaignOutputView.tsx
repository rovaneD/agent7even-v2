'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { AgentOutputCopyButton } from '@/components/agents/EmailSequenceOutputView'
import {
  actionColor,
  actionLabel,
  parseCampaignMarkdown,
  type CampaignSection,
  type CampaignWeek,
} from '@/lib/agents/campaignParse'

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

function WeekSection({ week }: { week: CampaignWeek }) {
  const actionCount = week.days.reduce((sum, day) => sum + day.items.length, 0)

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
            Week {week.number}
          </p>
          <h3 className="text-[16px] font-semibold leading-snug text-text">{week.theme}</h3>
        </div>
        <span className="text-[12px] text-text-soft">{actionCount} actions</span>
      </div>

      {week.days.length > 0 ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          {week.days.map(day => (
            <div
              key={`${week.number}-${day.label}`}
              className="border-b border-r border-gray-100 p-4 last:border-r-0"
            >
              <p className="mb-3 text-[12px] font-semibold text-text">{day.label}</p>
              <div className="grid gap-2.5">
                {day.items.map((item, index) => {
                  const label = actionLabel(item)
                  const color = actionColor(label)
                  return (
                    <div
                      key={`${day.label}-${index}`}
                      className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-3"
                    >
                      <span
                        className="mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: color.background, color: color.color }}
                      >
                        {label}
                      </span>
                      <p className="text-[12.5px] leading-relaxed text-text-sec">{item}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-4 text-[13px] leading-relaxed text-text-sec">
          No day-by-day actions parsed for this week.
        </div>
      )}
    </section>
  )
}

function TrailingSection({ section }: { section: CampaignSection }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
        {section.title}
      </p>
      {section.body.length > 0 && (
        <div className="mb-3 grid gap-2">
          {section.body.map((paragraph, index) => (
            <p key={index} className="text-[13px] leading-relaxed text-text-sec">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {section.bullets.length > 0 && (
        <div className="grid gap-2">
          {section.bullets.map((bullet, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-100 bg-[#F8FAFC] px-4 py-3 text-[13px] leading-relaxed text-text-sec"
            >
              {bullet}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function CampaignOutputView({
  content,
  showActions = true,
  compact = false,
}: {
  content: string
  showActions?: boolean
  compact?: boolean
}) {
  const parsed = useMemo(() => parseCampaignMarkdown(content), [content])

  if (!parsed || (!parsed.overview && parsed.weeks.length === 0 && parsed.sections.length === 0)) {
    return (
      <div className="grid gap-3">
        <AgentOutputCopyButton text={content} label="Copy all" compact={compact} />
        <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4">
          <ReactMarkdown components={markdownComponents()}>{content}</ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {showActions && (
        <div className="flex flex-wrap items-center gap-2">
          <AgentOutputCopyButton text={content} label="Copy full campaign" compact={compact} />
          <Link
            href="/dashboard/calendar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-text-sec transition hover:border-gray-300 hover:text-text"
          >
            Open calendar
          </Link>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('maya:open-task', {
                detail: {
                  task: 'Turn this approved campaign into schedule-ready captions, emails, creative prompts, and a production checklist.',
                },
              }))
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D3748] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#1F2937]"
          >
            Build assets with Maya
          </button>
        </div>
      )}

      {(parsed.title || parsed.overview || parsed.budgetAssumption) && (
        <section className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
            Campaign brief
          </p>
          {parsed.title && (
            <h2 className="mb-3 text-[17px] font-semibold leading-snug text-text">{parsed.title}</h2>
          )}
          {parsed.overview && (
            <p className="text-[13.5px] leading-relaxed text-text-sec">{parsed.overview}</p>
          )}
          {parsed.budgetAssumption && (
            <p className="mt-3 text-[12.5px] text-text-soft">
              <span className="font-semibold text-text-sec">Budget assumption:</span>{' '}
              {parsed.budgetAssumption}
            </p>
          )}
        </section>
      )}

      {parsed.weeks.map(week => (
        <WeekSection key={week.number} week={week} />
      ))}

      {parsed.sections.map((section, index) => (
        <TrailingSection key={`${section.title}-${index}`} section={section} />
      ))}
    </div>
  )
}
