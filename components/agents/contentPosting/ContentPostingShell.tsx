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

  // Video setup is the gallery — it needs the wide layout like the hub and format steps.
  const galleryStep = mode === 'video' && onSetupStep
  const layoutWidth = wideLayout || galleryStep ? 'max-w-[1040px]' : 'max-w-[820px]'

  return (
    <div className="min-h-screen bg-[#0E0F11] text-[#F2F3F5]">
      <div className={`mx-auto px-4 pb-16 pt-8 sm:px-8 ${layoutWidth}`}>
        <Link
          href={backHref}
          className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#9A9DA5] transition-colors hover:text-white"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          {backLabel}
        </Link>

        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#9A9DA5]">{kicker}</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-white">
            {headline}
          </h1>
          <p className="mt-2.5 max-w-[520px] text-[15px] leading-relaxed text-[#9A9DA5]">{description}</p>
        </div>

        {!onFormatStep && onSetupStep && <ContentPostingStepper current="setup" />}

        {!isHub && onSetupStep && (
          <nav className="mb-2 mt-9 flex flex-wrap justify-center gap-2.5" aria-label="Content posting modes">
            {MODES.map(m => {
              const href = MODE_HREFS[m]
              const active = pathname === href || pathname.startsWith(`${href}?`)
              const Icon = MODE_ICONS[m]
              return (
                <Link
                  key={m}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-5 text-[13.5px] font-medium transition-colors ${
                    active
                      ? 'border border-brand-primary bg-[#16181D] text-white'
                      : 'border border-white/[0.08] bg-[#1A1B1F] text-[#C9CBD1] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08]">
                    <Icon size={14} />
                  </span>
                  {CONTENT_POSTING_MODE_LABELS[m]}
                </Link>
              )
            })}
          </nav>
        )}

        <div className={isHub || onFormatStep ? '' : 'mt-2'}>{children}</div>
      </div>
    </div>
  )
}

function ShellFallback({ mode, children }: ContentPostingShellProps) {
  const isHub = mode === null
  return (
    <div className="min-h-screen bg-[#0E0F11] text-[#F2F3F5]">
      <div className={`mx-auto px-4 py-8 sm:px-8 ${isHub ? 'max-w-[1040px]' : 'max-w-[820px]'}`}>{children}</div>
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
