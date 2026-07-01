'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, Copy } from 'lucide-react'
import {
  adVariationPasteBlock,
  parseAdVariationsMarkdown,
  type AdVariationField,
  type ParsedAdVariation,
} from '@/lib/agents/adVariationsParse'
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

function FieldBlock({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-soft">
        {label}
      </p>
      <div
        className={`rounded-xl border border-gray-100 bg-[#F8FAFC] text-[13px] leading-relaxed text-text-sec ${
          multiline ? 'whitespace-pre-wrap p-4' : 'px-4 py-3'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function VariationCard({ variation }: { variation: ParsedAdVariation }) {
  const [copied, setCopied] = useState(false)
  const pasteText = adVariationPasteBlock(variation)

  const fieldById = Object.fromEntries(
    variation.fields.map(field => [field.id, field]),
  ) as Partial<Record<AdVariationField['id'], AdVariationField>>

  async function copyVariation() {
    await navigator.clipboard.writeText(pasteText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
            Variation {variation.number}
          </p>
          <h3 className="text-[15px] font-semibold leading-snug text-text">
            {variation.heading}
          </h3>
        </div>
        <button
          type="button"
          onClick={copyVariation}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-text-sec transition hover:border-gray-300 hover:text-text"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy variation'}
        </button>
      </div>

      <div className="grid gap-4">
        {fieldById.headline && (
          <FieldBlock label={fieldById.headline.label} value={fieldById.headline.value} />
        )}

        {fieldById.primaryText && (
          <FieldBlock
            label={fieldById.primaryText.label}
            value={fieldById.primaryText.value}
            multiline
          />
        )}

        {fieldById.cta && (
          <FieldBlock label={fieldById.cta.label} value={fieldById.cta.value} />
        )}

        {fieldById.formatNote && (
          <FieldBlock
            label={fieldById.formatNote.label}
            value={fieldById.formatNote.value}
            multiline
          />
        )}

        {(fieldById.audienceAngle || fieldById.complianceRisk) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldById.audienceAngle && (
              <FieldBlock
                label={fieldById.audienceAngle.label}
                value={fieldById.audienceAngle.value}
                multiline
              />
            )}
            {fieldById.complianceRisk && (
              <FieldBlock
                label={fieldById.complianceRisk.label}
                value={fieldById.complianceRisk.value}
                multiline
              />
            )}
          </div>
        )}

        {variation.fields.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4 text-[13px] leading-relaxed text-text-sec">
            Could not split this variation into fields — use Copy variation above, or re-run with the standard VARIATION N format.
          </div>
        )}
      </div>
    </article>
  )
}

export default function AdVariationsOutputView({
  content,
  showGuide = true,
  compact = false,
}: {
  content: string
  showGuide?: boolean
  compact?: boolean
}) {
  const parsed = useMemo(() => parseAdVariationsMarkdown(content), [content])

  if (!parsed) {
    return (
      <div className="grid gap-3">
        <AgentOutputCopyButton text={content} label="Copy all" compact={compact} />
        <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4">
          <ReactMarkdown components={markdownComponents()}>{content}</ReactMarkdown>
        </div>
      </div>
    )
  }

  const metadataEntries = Object.entries(parsed.metadata)

  return (
    <div className="grid gap-5">
      {showGuide && (
        <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5">
          <p className="mb-1 text-[12px] font-semibold text-[#1E40AF]">
            Paste into your ad platform
          </p>
          <p className="text-[12.5px] leading-relaxed text-text-sec">
            Create one ad per variation below. Copy each labeled block into Meta Ads Manager, Google Ads,
            or your platform of choice — headline, primary text, then CTA.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AgentOutputCopyButton text={content} label="Copy all variations" compact={compact} />
      </div>

      {(parsed.title || metadataEntries.length > 0 || parsed.intro) && (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
            Campaign brief
          </p>
          {parsed.title && (
            <h2 className="mb-3 text-[16px] font-semibold leading-snug text-text">{parsed.title}</h2>
          )}
          {metadataEntries.length > 0 && (
            <dl className="mb-3 grid gap-2 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-soft">
                    {key}
                  </dt>
                  <dd className="mt-0.5 text-[13px] leading-relaxed text-text-sec">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {parsed.intro && !parsed.title && metadataEntries.length === 0 && (
            <ReactMarkdown components={markdownComponents()}>{parsed.intro}</ReactMarkdown>
          )}
        </div>
      )}

      {parsed.variations.map(variation => (
        <VariationCard key={variation.number} variation={variation} />
      ))}

      {parsed.footer && (
        <div className="rounded-2xl border border-gray-100 bg-[#F8FAFC] px-5 py-4">
          <ReactMarkdown components={markdownComponents()}>{parsed.footer}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
