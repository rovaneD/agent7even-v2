'use client'

import { useRef, useState } from 'react'
import { POST_IMAGE_MAX_BYTES } from '@/lib/postAssetLimits'
import DownloadImageButton from '@/components/media/DownloadImageButton'

import { imageContextAcceptHeader } from '@/lib/posts/imageContextCapabilities'

const ACCEPT = imageContextAcceptHeader()

type Props = {
  disabled?: boolean
  onAttached: (media: { storagePath: string; mime: string; previewUrl: string; filename?: string }) => void
  onClear: () => void
  attached?: {
    previewUrl: string
    filename?: string
    storagePath?: string
    mime?: string
  } | null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('read_failed'))
        return
      }
      const base64 = result.includes(',') ? result.split(',')[1]! : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

export default function PostImageAttach({ disabled, onAttached, onClear, attached }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file || disabled) return
    setError(null)

    if (!file.type.startsWith('image/') || !ACCEPT.split(',').includes(file.type)) {
      setError('Use JPEG, PNG, or WebP only.')
      return
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      setError('Image must be under 20 MB.')
      return
    }

    setUploading(true)
    try {
      const content = await fileToBase64(file)
      const res = await fetch('/api/posts/attach-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          filename: file.name,
          mime: file.type,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Upload failed')
        return
      }
      onAttached({
        storagePath: data.storagePath,
        mime: data.mime,
        previewUrl: data.previewUrl,
        filename: file.name,
      })
    } catch {
      setError('Upload failed. Try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Post image</p>
          <p className="mt-1 text-sm leading-6 text-text-sec">
            Attach the visual you plan to post. Maya will read it and write the caption to match what is in the frame.
          </p>
        </div>
        {!attached && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-gray-200 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : 'Choose image'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0] ?? null)}
      />

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {attached && (
        <div className="mt-4 flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attached.previewUrl}
            alt="Attached post preview"
            className="h-24 w-24 rounded-xl border border-gray-100 object-cover"
          />
          <div className="flex flex-col gap-2">
            {attached.filename && (
              <p className="text-xs text-text-sec">{attached.filename}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {attached.storagePath && (
                <DownloadImageButton
                  storagePath={attached.storagePath}
                  mime={attached.mime}
                  filename={attached.filename}
                  label="Download"
                  disabled={disabled || uploading}
                />
              )}
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={onClear}
                className="text-sm font-medium text-brand-primary hover:text-[#2563EB] disabled:opacity-60"
              >
                Remove image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
