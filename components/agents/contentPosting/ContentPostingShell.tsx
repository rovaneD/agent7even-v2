'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowLeft, Image, Video, CalendarDays } from 'lucide-react'

import {
  CONTENT_POSTING_MODE_DESCRIPTIONS,
  CONTENT_POSTING_MODE_LABELS,
  contentPostingAgentName,
  type ContentPostingMode,
} from '@/lib/agents/contentPosting/uiConfig'
import {
  contentPostingModeHref,
  isImageFormatId,
  isVideoFormatId,
} from '@/lib/agents/contentPosting/platformFormats'
import ContentPostingStepper from '@/components/agents/contentPosting/ContentPostingStepper'
import { useMayaContext } from '@/hooks/useMayaContext'

const MODES: ContentPostingMode[] = ['image', 'video', 'weekly']

const MODE_ICONS: Record<ContentPostingMode, typeof Image> = {
  image: Image,
  video: Video,
  weekly: CalendarDays,
}

const MODE_HREFS: Record<ContentPostingMode, string> = {
  image: contentPostingModeHref('image'),
  video: contentPostingModeHref('video'),
  weekly: '/dashboard/agents/content-posting/weekly',
}

interface ContentPostingShellProps {
  mode: ContentPostingMode | null
  children: ReactNode
}

function ShellInner({ mode, children }: ContentPostingShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isHub = mode === null

  const formatParam = searchParams.get('format')
  const onFormatStep =
    mode === 'image'
      ? !isImageFormatId(formatParam)
      : mode === 'video'
        ? !isVideoFormatId(formatParam)
        : false
  const onSetupStep =
    mode === 'weekly' || ((mode === 'image' || mode === 'video') && !onFormatStep)

  const wideLayout = isHub || onFormatStep
  const backHref = isHub ? '/dashboard/agents' : '/dashboard/agents/content-posting'
  const backLabel = isHub ? 'Back to Agents' : 'Back to workflows'

  const headline = isHub
    ? 'Choose a workflow'
    : onFormatStep
      ? 'Choose a format'
      : CONTENT_POSTING_MODE_LABELS[mode]

  const kicker = isHub
    ? contentPostingAgentName()
    : onFormatStep
      ? `Content Posting · ${mode === 'image' ? 'Image post' : 'Video post'}`
      : contentPostingAgentName()

  const description = isHub
    ? 'Three ways to put something out today. Pick where you want to start — Maya takes it from there.'
    : onFormatStep
      ? "Pick where you're posting and the exact size. Maya generates everything to fit the platform — preview updates as you choose."
      : CONTENT_POSTING_MODE_DESCRIPTIONS[mode]

  // Maya context — the Content Posting flow is the product's primary content
  // workflow, so Maya needs to know the exact step, mode, and chosen format.
  useMayaContext({
    page: 'CONTENT POSTING',
    dataSource: 'live',
    activeView: isHub
      ? { label: 'Workflow hub', state: 'Choosing between Image post, Video post, and Weekly plan' }
      : onFormatStep
        ? {
            label: `${CONTENT_POSTING_MODE_LABELS[mode]} — format picker`,
            state: 'Choosing the platform and post format (no format selected yet)',
          }
        : {
            label: `${CONTENT_POSTING_MODE_LABELS[mode]} — setup`,
            state: formatParam
              ? `Format: ${formatParam} — filling in the post setup form before generating`
              : 'Filling in the setup form before generating',
          },
    affordance: isHub
      ? 'The user can start an image post, video post, or weekly content plan from here.'
      : 'Generated output goes to the approval queue — nothing publishes without approval.',
  })

  return (
    <div className={`mx-auto px-4 py-8 sm:px-8 ${wideLayout ? 'max-w-[960px]' : 'max-w-[820px]'}`}>
      <Link
        href={backHref}
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-sec transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        {backLabel}
      </Link>

      {!onFormatStep && onSetupStep && <ContentPostingStepper current="setup" />}

      <div className={onSetupStep ? 'mt-4' : ''}>
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#F5349B]">{kicker}</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-text-primary sm:text-[30px]">
          {headline}
        </h1>
        <p className="mt-2.5 max-w-[520px] text-[15.5px] leading-relaxed text-text-sec">{description}</p>
      </div>

      {!isHub && onSetupStep && (
        <nav className="mb-2 mt-6 flex flex-wrap gap-2" aria-label="Content posting modes">
          {MODES.map(m => {
            const href = MODE_HREFS[m]
            const active = pathname === href || pathname.startsWith(`${href}?`)
            const Icon = MODE_ICONS[m]
            return (
              <Link
                key={m}
                href={href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border border-border bg-surface-2 text-text-sec hover:border-gray-200 hover:text-text-primary'
                }`}
              >
                <Icon size={15} />
                {CONTENT_POSTING_MODE_LABELS[m]}
              </Link>
            )
          })}
        </nav>
      )}

      <div className={isHub || onFormatStep ? '' : 'mt-2'}>{children}</div>
    </div>
  )
}

function ShellFallback({ mode, children }: ContentPostingShellProps) {
  const isHub = mode === null
  return (
    <div className={`mx-auto px-4 py-8 sm:px-8 ${isHub ? 'max-w-[960px]' : 'max-w-[820px]'}`}>
      {children}
    </div>
  )
}

export default function ContentPostingShell(props: ContentPostingShellProps) {
  return (
    <Suspense fallback={<ShellFallback {...props} />}>
      <ShellInner {...props} />
    </Suspense>
  )
}
