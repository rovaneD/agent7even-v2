'use client'

import { useEffect, useRef, useState } from 'react'
import { POST_IMAGE_MAX_BYTES } from '@/lib/postAssetLimits'
import DownloadImageButton from '@/components/media/DownloadImageButton'
import PostImageCropper from '@/components/agents/PostImageCropper'
import { blobToBase64, getCroppedImageBlob } from '@/lib/posts/cropImage'
import type { CropPreset, MediaEditMetadata } from '@/lib/posts/cropPresets'
import { COMMON_CROP_PRESETS } from '@/lib/posts/cropPresets'

import { imageContextAcceptHeader } from '@/lib/posts/imageContextCapabilities'

const ACCEPT = imageContextAcceptHeader()

export type AttachedPostImage = {
  storagePath: string
  mime: string
  previewUrl: string
  filename?: string
  mediaEdit?: MediaEditMetadata | null
}

type Props = {
  disabled?: boolean
  cropPresets?: CropPreset[]
  defaultCropPresetId?: string
  onAttached: (media: AttachedPostImage) => void
  onClear: () => void
  attached?: AttachedPostImage | null
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

async function uploadImagePayload(payload: {
  content: string
  filename: string
  mime: string
  mediaEdit?: MediaEditMetadata
}): Promise<AttachedPostImage> {
  const res = await fetch('/api/posts/attach-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : data.error ?? 'Upload failed')
  }
  return {
    storagePath: data.storagePath,
    mime: data.mime,
    previewUrl: data.previewUrl,
    filename: payload.filename,
    mediaEdit: payload.mediaEdit ?? null,
  }
}

export default function PostImageAttach({
  disabled,
  cropPresets = COMMON_CROP_PRESETS,
  defaultCropPresetId,
  onAttached,
  onClear,
  attached,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    }
  }, [pendingPreviewUrl])

  function clearPendingCrop() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null)
    setPendingPreviewUrl(null)
  }

  async function uploadFile(file: File, mediaEdit?: MediaEditMetadata) {
    setUploading(true)
    setError(null)
    try {
      const content = await fileToBase64(file)
      const attachedMedia = await uploadImagePayload({
        content,
        filename: file.name,
        mime: file.type,
        mediaEdit,
      })
      onAttached(attachedMedia)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

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

    clearPendingCrop()
    setPendingFile(file)
    setPendingPreviewUrl(URL.createObjectURL(file))
  }

  async function handleCropComplete(result: {
    pixelCrop: { x: number; y: number; width: number; height: number }
    preset: CropPreset
  }) {
    if (!pendingFile || !pendingPreviewUrl) return
    setUploading(true)
    setError(null)
    try {
      const preserveAlpha = pendingFile.type === 'image/png'
      const blob = await getCroppedImageBlob(pendingPreviewUrl, result.pixelCrop, {
        mime: preserveAlpha ? 'image/png' : 'image/jpeg',
        quality: 0.92,
      })
      if (blob.size > POST_IMAGE_MAX_BYTES) {
        setError('Cropped image must be under 20 MB. Zoom out or choose a smaller source file.')
        return
      }
      const content = await blobToBase64(blob)
      const ext = preserveAlpha ? 'png' : 'jpg'
      const baseName = pendingFile.name.replace(/\.[^.]+$/, '') || 'upload'
      const attachedMedia = await uploadImagePayload({
        content,
        filename: `${baseName}-cropped.${ext}`,
        mime: preserveAlpha ? 'image/png' : 'image/jpeg',
        mediaEdit: {
          cropped: true,
          aspect: result.preset.aspectLabel,
          source_filename: pendingFile.name,
        },
      })
      clearPendingCrop()
      onAttached(attachedMedia)
    } catch {
      setError('Crop export failed. Try again or skip crop.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleSkipCrop() {
    if (!pendingFile) return
    const file = pendingFile
    clearPendingCrop()
    await uploadFile(file)
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Post image</p>
          <p className="mt-1 text-sm leading-6 text-text-sec">
            Attach the visual you plan to post. Crop to your format, then Maya reads the final frame and writes the caption.
          </p>
        </div>
        {!attached && !pendingFile && (
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
        onChange={e => void handleFile(e.target.files?.[0] ?? null)}
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
            {attached.mediaEdit?.cropped && (
              <p className="text-[11px] font-medium text-text-muted">
                Cropped · {attached.mediaEdit.aspect}
              </p>
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

      {pendingFile && pendingPreviewUrl && (
        <PostImageCropper
          imageUrl={pendingPreviewUrl}
          filename={pendingFile.name}
          presets={cropPresets}
          defaultPresetId={defaultCropPresetId}
          onCancel={clearPendingCrop}
          onSkip={() => void handleSkipCrop()}
          onComplete={result => void handleCropComplete(result)}
        />
      )}
    </div>
  )
}
