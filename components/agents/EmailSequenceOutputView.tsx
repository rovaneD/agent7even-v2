'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Check, Copy } from 'lucide-react'
import {
  parseEmailSequenceMarkdown,
  type EmailSequenceField,
  type ParsedSequenceEmail,
} from '@/lib/agents/emailSequenceParse'

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

export function AgentOutputCopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  compact = false,
  iconOnly = false,
  title,
}: {
  text: string
  label?: string
  copiedLabel?: string
  compact?: boolean
  iconOnly?: boolean
  title?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={copy}
        title={title ?? (copied ? copiedLabel : label)}
        aria-label={title ?? label}
        className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-text-soft transition-colors hover:bg-white hover:text-brand-primary"
      >
        {copied ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
        compact
          ? 'text-[11px] text-text-soft hover:text-brand-primary'
          : 'rounded-[10px] border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-text-sec hover:border-gray-300 hover:text-text'
      } ${copied ? 'text-status-success' : ''}`}
    >
      {copied ? <Check size={compact ? 12 : 13} /> : <Copy size={compact ? 12 : 13} />}
      {copied ? copiedLabel : label}
    </button>
  )
}

function EmailFieldBlock({
  label,
  value,
  multiline,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  if (!value.trim()) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
          {label}
        </p>
        <AgentOutputCopyButton
          text={value}
          label={`Copy ${label.toLowerCase()}`}
          iconOnly
          title={`Copy ${label.toLowerCase()}`}
        />
      </div>
      <p
        className={`text-[13px] leading-relaxed text-text-sec ${multiline ? 'whitespace-pre-wrap' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

function EmailSequenceCard({ email }: { email: ParsedSequenceEmail }) {
  const fieldById = Object.fromEntries(email.fields.map(f => [f.id, f])) as Partial<
    Record<EmailSequenceField['id'], EmailSequenceField>
  >

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7C3AED]">
            Email {email.number}
          </p>
          <h3 className="text-[15px] font-semibold leading-snug text-text">
            {email.heading}
          </h3>
        </div>
        <AgentOutputCopyButton text={email.text} label="Copy email" compact />
      </div>

      <div className="grid gap-3 p-5">
        {fieldById.send && (
          <EmailFieldBlock label={fieldById.send.label} value={fieldById.send.value} />
        )}

        {(fieldById.subject || fieldById.altSubject) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldById.subject && (
              <EmailFieldBlock label={fieldById.subject.label} value={fieldById.subject.value} />
            )}
            {fieldById.altSubject && (
              <EmailFieldBlock label={fieldById.altSubject.label} value={fieldById.altSubject.value} />
            )}
          </div>
        )}

        {fieldById.preview && (
          <EmailFieldBlock label={fieldById.preview.label} value={fieldById.preview.value} />
        )}

        {fieldById.body && (
          <EmailFieldBlock
            label={fieldById.body.label}
            value={fieldById.body.value}
            multiline
          />
        )}

        {fieldById.cta && (
          <EmailFieldBlock label={fieldById.cta.label} value={fieldById.cta.value} />
        )}

        {email.fields.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4 text-[13px] leading-relaxed text-text-sec">
            Could not split this email into fields — use Copy email above, or re-run with the standard EMAIL N format.
          </div>
        )}
      </div>
    </article>
  )
}

export default function EmailSequenceOutputView({
  content,
  showGuide = true,
}: {
  content: string
  showGuide?: boolean
}) {
  const parsed = useMemo(() => parseEmailSequenceMarkdown(content), [content])

  if (!parsed) {
    return (
      <div className="grid gap-3">
        <AgentOutputCopyButton text={content} label="Copy all" />
        <div className="rounded-xl border border-gray-100 bg-[#F8FAFC] p-4">
          <ReactMarkdown components={markdownComponents()}>{content}</ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {showGuide && (
        <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5">
          <p className="mb-1 text-[12px] font-semibold text-[#1E40AF]">
            Paste into your email software
          </p>
          <p className="text-[12.5px] leading-relaxed text-text-sec">
            Create one automation step per email below. Copy each labeled block into the matching field
            in Mailchimp, Klaviyo, ConvertKit, etc. — subject, preview text, body, then set the send delay.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AgentOutputCopyButton text={content} label="Copy full sequence" />
      </div>

      {parsed.intro && (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-soft">
            Sequence overview
          </p>
          <ReactMarkdown components={markdownComponents()}>{parsed.intro}</ReactMarkdown>
        </div>
      )}

      {parsed.emails.map(email => (
        <EmailSequenceCard key={email.number} email={email} />
      ))}

      {parsed.footer && (
        <div className="rounded-2xl border border-gray-100 bg-[#F8FAFC] px-5 py-4">
          <ReactMarkdown components={markdownComponents()}>{parsed.footer}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
