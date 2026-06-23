'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { downloadImageUrl, downloadPostAssetFile } from '@/lib/downloadMedia'
import { cn } from '@/lib/utils'

type Props = {
  storagePath?: string | null
  url?: string | null
  filename?: string
  mime?: string
  label?: string
  iconOnly?: boolean
  disabled?: boolean
  className?: string
  onClick?: (event: React.MouseEvent) => void
}

export default function DownloadImageButton({
  storagePath,
  url,
  filename,
  mime,
  label = 'Download',
  iconOnly = false,
  disabled,
  className = '',
  onClick,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick(event: React.MouseEvent) {
    onClick?.(event)
    event.stopPropagation()
    event.preventDefault()
    if (disabled || loading || (!storagePath && !url)) return

    setLoading(true)
    try {
      if (storagePath) {
        await downloadPostAssetFile({ storagePath, filename, mime })
      } else if (url) {
        await downloadImageUrl(url, filename)
      }
    } catch {
      // Best-effort fallback for public URLs
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setLoading(false)
    }
  }

  const baseClass = iconOnly
    ? 'inline-flex items-center justify-center rounded-lg border border-gray-100 bg-white p-1.5 text-text-primary shadow-sm hover:bg-gray-50 disabled:opacity-60'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-text-primary hover:border-gray-300 disabled:opacity-60'

  return (
    <button
      type="button"
      disabled={disabled || loading || (!storagePath && !url)}
      onClick={e => void handleClick(e)}
      className={cn(baseClass, className)}
      title={label}
      aria-label={label}
    >
      {loading ? <Loader2 size={iconOnly ? 14 : 12} className="animate-spin" /> : <Download size={iconOnly ? 14 : 12} />}
      {!iconOnly && label}
    </button>
  )
}
