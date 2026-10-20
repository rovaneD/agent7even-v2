'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import ContentPostingStepper from '@/components/agents/contentPosting/ContentPostingStepper'
import PlatformBrandIcon from '@/components/agents/contentPosting/PlatformBrandIcon'
import PlatformPostPreview from '@/components/agents/contentPosting/PlatformPostPreview'
import {
  contentPostingFlowHref,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_VIDEO_FORMAT,
  platformsForMode,
  platformUsernameFromCompany,
  type PlatformFormatSpec,
  IMAGE_POST_FORMATS,
  VIDEO_POST_FORMATS,
} from '@/lib/agents/contentPosting/platformFormats'

type Props = {
  mode: 'image' | 'video'
  companyName: string
}

const IMAGE_CAPTION =
  'Drop ends. Payout lands. Ship and go again. Zwoe keeps your drop cycle moving.'
const REELS_HEADLINE = 'Set your supply. Watch demand follow.'

function FormatRow({
  format,
  selected,
  onSelect,
}: {
  format: PlatformFormatSpec
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-[11px] text-left transition-all ${
        selected
          ? 'border-brand-primary bg-brand-primary/[0.12] shadow-[inset_0_0_0_1px_#3B82F6]'
          : 'border-white/[0.08] bg-[#17181B] hover:border-white/20 hover:bg-[#1C1D21]'
      }`}
    >
      <span className={`min-w-0 flex-1 text-sm font-medium ${selected ? 'text-white' : 'text-[#E6E7EA]'}`}>
        {format.label.replace(`${format.platform} `, `${format.platform} · `)}
      </span>
      <span className={`text-[12.5px] tabular-nums ${selected ? 'text-[#9EC3FF]' : 'text-[#8A8D95]'}`}>
        {format.width} × {format.height}
      </span>
      <span
        className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums ${
          selected ? 'bg-brand-primary text-white' : 'bg-white/[0.06] text-[#8A8D95]'
        }`}
      >
        {format.aspectRatio}
      </span>
      <span
        className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-[1.5px] ${
          selected ? 'border-brand-primary bg-brand-primary' : 'border-white/20 bg-transparent'
        }`}
      >
        {selected && <Check size={11} className="text-white" strokeWidth={2.6} />}
      </span>
    </button>
  )
}

export default function ContentPostingFormatPicker({ mode, companyName }: Props) {
  const username = platformUsernameFromCompany(companyName)
  const formats = mode === 'image' ? IMAGE_POST_FORMATS : VIDEO_POST_FORMATS
  const defaultFormat = mode === 'image' ? DEFAULT_IMAGE_FORMAT : DEFAULT_VIDEO_FORMAT
  const platforms = platformsForMode(mode)

  const [formatId, setFormatId] = useState(defaultFormat.id)

  const selected = useMemo(
    () => formats.find(f => f.id === formatId) ?? defaultFormat,
    [formats, formatId, defaultFormat],
  )

  const grouped = useMemo(
    () =>
      platforms.map(platform => ({
        platform,
        formats: formats.filter(f => f.platform === platform),
      })),
    [formats, platforms],
  )

  const previewImage = mode === 'image' ? '/lab5/scale.jpg' : '/lab5/uc-creators.jpg'

  return (
    <>
      <ContentPostingStepper current="format" />

      <div className="mt-10 grid items-start gap-[22px] lg:grid-cols-[336px_minmax(0,1fr)] lg:items-end">
        <div className="flex w-full flex-col gap-[18px]">
          {grouped.map(group => (
            <div key={group.platform}>
              <div className="mb-2 flex items-center gap-2 pl-0.5">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-white"><PlatformBrandIcon platform={group.platform} size={16} /></span>
                <span className="text-[13px] font-semibold text-[#E6E7EA]">{group.platform}</span>
              </div>
                <div className="flex flex-col gap-1.5">
                  {group.formats.map(format => (
                    <FormatRow
                      key={format.id}
                      format={format}
                      selected={format.id === formatId}
                      onSelect={() => setFormatId(format.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="order-first overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#17181B] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)] lg:order-none lg:sticky lg:top-20">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-[18px] py-3.5">
            <span className="flex items-center gap-2 text-[13px] font-medium text-[#E6E7EA]">
              <span className="h-[7px] w-[7px] rounded-full bg-[#16A34A] shadow-[0_0_0_3px_rgba(22,163,74,0.25)]" />
              Live preview
            </span>
            <span className="flex items-center gap-2 text-xs text-[#8A8D95]">
              <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-white"><PlatformBrandIcon platform={selected.platform} size={13} /></span>
              {selected.platform}
            </span>
          </div>

          <div
            className={`flex items-center justify-center px-6 py-8 ${
              mode === 'video' ? 'bg-[radial-gradient(120%_90%_at_50%_0%,#24262C_0%,#111214_100%)]' : 'bg-[#111214]'
            }`}
          >
            <div className="w-full max-w-[320px]">
              <PlatformPostPreview
                format={selected}
                imageSrc={previewImage}
                username={username}
                caption={IMAGE_CAPTION}
                headline={REELS_HEADLINE}
                compact
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.06] px-[18px] py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {selected.platform} · {selected.label.replace(`${selected.platform} `, '')}
              </p>
              <p className="mt-0.5 text-[12.5px] tabular-nums text-[#8A8D95]">
                {selected.dimensions.replace(' × ', ' × ')} px · {selected.aspectRatio}
              </p>
            </div>
            <Link
              href={contentPostingFlowHref(mode, formatId)}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-brand-primary px-6 py-3.5 text-[15.5px] font-medium text-white transition-colors hover:bg-[#1D62D6] hover:shadow-[0_10px_22px_-10px_rgba(59,130,246,0.55)]"
            >
              {mode === 'video' ? 'Continue to video types' : 'Continue to setup'}
              <ArrowRight size={17} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
